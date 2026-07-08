import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";
import {
  formatContextForPrompt,
  loadConversationContext,
  type SynapseConversationState,
} from "../synapse-text-fallback/entity-context.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-synapse-gateway-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const DEFAULT_GATEWAY_URL = "ws://localhost:8789/v1/synapse/voice";
const DEFAULT_DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse";
const DEFAULT_CARTESIA_PT_BR_VOICE_ID = "a167e0f3-df7e-4d52-a9c3-f949145efdab";
const SUPPORTED_PROVIDER = "deepgram-agent";

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

const publicGatewayUrl = () =>
  Deno.env.get("SYNAPSE_VOICE_GATEWAY_URL") ||
  Deno.env.get("PUBLIC_SYNAPSE_VOICE_GATEWAY_URL") ||
  DEFAULT_GATEWAY_URL;

const configuredVoiceProvider = () =>
  clean(Deno.env.get("SYNAPSE_VOICE_PROVIDER") || SUPPORTED_PROVIDER, 80).toLowerCase();

const toDeepgramFunction = (tool: any) => {
  const fn = tool?.function || {};
  return {
    name: String(fn.name || ""),
    description: String(fn.description || ""),
    parameters: fn.parameters || { type: "object", properties: {} },
  };
};

function professionalNameFromProfile(profile: any) {
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return clean(profile?.full_name || joined || profile?.clinic_name || "", 160);
}

async function loadProfessionalProfile(admin: any, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("first_name,last_name,full_name,clinic_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[synapse-voice-agent-session] profile load failed", error.message);
    return { professionalName: "" };
  }
  return {
    professionalName: professionalNameFromProfile(data),
    clinicName: clean(data?.clinic_name, 160),
  };
}

const VOICE_ONLY_TOOLS = [
  {
    name: "confirm_pending_action",
    description:
      "Use quando o profissional confirmar verbalmente uma acao pendente preparada anteriormente, como 'confirmo', 'pode executar' ou 'pode prosseguir'.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "cancel_pending_action",
    description:
      "Use quando o profissional cancelar uma acao pendente ou uma execucao em andamento, como 'cancela', 'deixa', 'nao precisa' ou 'para isso'.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

function buildVoicePrompt(
  systemInstruction: string,
  state: SynapseConversationState,
  memorySummary: string,
  context: Record<string, unknown>,
  professionalName: string,
) {
  const now = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

  return [
    "Voce e o Synapse, agente operacional por voz da NeuroNex para psicologos.",
    "Fale em portugues brasileiro natural, curto e humano. Evite listas longas em voz alta.",
    "Use vocabulario, ritmo e construcoes de portugues brasileiro; evite expressoes de portugues europeu.",
    `Data e hora de Brasilia: ${now}.`,
    professionalName ? `Profissional conectado: ${professionalName}. Chame pelo primeiro nome quando soar natural, sem repetir em toda fala.` : "",
    "Use ferramentas para qualquer dado real do sistema: pacientes, agenda, prontuarios, financeiro, NeuroFinance, NFS-e, documentos e comunicacoes.",
    "Nunca invente nomes, horarios, valores, saldos, pagamentos, notas fiscais, diagnosticos ou resultado de acoes.",
    "Nunca peca IDs, UUIDs, rotas, nomes de tabelas, JSON ou codigos internos ao profissional.",
    "Quando chamar uma ferramenta, aguarde o FunctionCallResponse real antes de entregar conclusoes. O gateway de voz vai falar os feedbacks de progresso automaticamente enquanto a ferramenta roda.",
    "Se uma ferramenta retornar retryable=true, voce pode solicitar nova tentativa apenas uma vez ou explicar a oscilacao de forma breve. Se needs_clarification=true, faca uma pergunta curta.",
    "Se confirmation_required=true, peça confirmacao explicita antes de qualquer acao mutavel.",
    "Se o usuario interromper para cancelar, use cancel_pending_action quando houver acao pendente ou em andamento.",
    "Se o usuario interromper para complementar, incorpore a informacao nova e continue sem cancelar automaticamente.",
    "Acoes que alteram dados, enviam mensagens, criam cobrancas ou emitem NFS-e exigem confirmacao separada antes da execucao final.",
    "Nao narre nomes de ferramentas nem raciocinio interno. Entregue apenas o resultado util.",
    systemInstruction ? `INSTRUCAO DE TELA:\n${clean(systemInstruction, 1400)}` : "",
    `CONTEXTO DURAVEL:\n${formatContextForPrompt(state)}`,
    memorySummary ? `RESUMO ANTERIOR DA CONVERSA:\n${clean(memorySummary, 5000)}` : "",
    context?.route || context?.currentContext
      ? `TELA ATUAL INFORMADA PELO APP: ${clean(context.route || context.currentContext, 180)}`
      : "",
  ].filter(Boolean).join("\n\n");
}

function buildSpeakConfig() {
  const cartesiaVoiceId =
    Deno.env.get("CARTESIA_VOICE_ID") ||
    Deno.env.get("DEEPGRAM_CARTESIA_VOICE_ID") ||
    DEFAULT_CARTESIA_PT_BR_VOICE_ID;
  const cartesiaApiKey =
    Deno.env.get("CARTESIA_API_KEY") ||
    Deno.env.get("DEEPGRAM_CARTESIA_API_KEY") ||
    "";
  const cartesiaManaged = Deno.env.get("DEEPGRAM_MANAGED_CARTESIA") !== "false";
  const modelId = Deno.env.get("CARTESIA_MODEL_ID") || "sonic-2";
  const language = Deno.env.get("CARTESIA_LANGUAGE") || "pt-BR";
  const speed = Deno.env.get("CARTESIA_SPEED") || "normal";

  const speak: Record<string, unknown> = {
    provider: {
      type: "cartesia",
      model_id: modelId,
      voice: {
        mode: "id",
        id: cartesiaVoiceId,
      },
      language,
      speed,
      volume: Number(Deno.env.get("CARTESIA_VOLUME") || "1"),
    },
  };

  if (cartesiaApiKey && !cartesiaManaged) {
    speak.endpoint = {
      url: Deno.env.get("CARTESIA_TTS_URL") || "https://api.cartesia.ai/tts/bytes",
      headers: { "x-api-key": cartesiaApiKey },
    };
  }

  if (Deno.env.get("DEEPGRAM_ENABLE_AURA_FALLBACK") === "true") {
    return {
      speak: [
        speak,
        {
          provider: {
            type: "deepgram",
            model: Deno.env.get("DEEPGRAM_FALLBACK_TTS_MODEL") || "aura-2-thalia-en",
          },
        },
      ],
      ttsProvider: cartesiaManaged ? "deepgram-managed-cartesia+aura-fallback" : "byo-cartesia+aura-fallback",
      ttsVoice: cartesiaVoiceId,
    };
  }

  return {
    speak,
    ttsProvider: cartesiaManaged ? "deepgram-managed-cartesia" : "byo-cartesia",
    ttsVoice: cartesiaVoiceId,
  };
}

function buildAgentSettings(
  prompt: string,
  context: Record<string, unknown>,
) {
  const { speak, ttsProvider, ttsVoice } = buildSpeakConfig();
  const functions = [
    ...VOICE_ONLY_TOOLS,
    ...AGENT_TOOLS_V3.map(toDeepgramFunction).filter((item) => item.name),
  ];

  return {
    settings: {
      type: "Settings",
      tags: ["neuronex", "synapse", "voice", "pt-BR"],
      flags: { history: true },
      audio: {
        input: {
          encoding: "linear16",
          sample_rate: Number(Deno.env.get("SYNAPSE_VOICE_INPUT_SAMPLE_RATE") || "16000"),
        },
        output: {
          encoding: "linear16",
          sample_rate: Number(Deno.env.get("SYNAPSE_VOICE_OUTPUT_SAMPLE_RATE") || "24000"),
          container: "none",
        },
      },
      agent: {
        listen: {
          provider: {
            type: "deepgram",
            version: "v2",
            model: Deno.env.get("DEEPGRAM_LISTEN_MODEL") || "flux-general-multi",
            language: Deno.env.get("DEEPGRAM_LISTEN_LANGUAGE") || "pt-BR",
            language_hints: ["pt-BR", "pt"],
            eot_threshold: Number(Deno.env.get("DEEPGRAM_EOT_THRESHOLD") || "0.78"),
            eager_eot_threshold: Number(Deno.env.get("DEEPGRAM_EAGER_EOT_THRESHOLD") || "0.52"),
            eot_timeout_ms: Number(Deno.env.get("DEEPGRAM_EOT_TIMEOUT_MS") || "1800"),
            smart_format: true,
          },
        },
        think: {
          provider: {
            type: Deno.env.get("DEEPGRAM_THINK_PROVIDER") || "open_ai",
            model: Deno.env.get("DEEPGRAM_THINK_MODEL") || "gpt-4o-mini",
          },
          prompt,
          functions,
        },
        speak,
        greeting: clean(context?.greeting, 280) || undefined,
      },
    },
    metadata: {
      listenModel: Deno.env.get("DEEPGRAM_LISTEN_MODEL") || "flux-general-multi",
      listenLanguage: Deno.env.get("DEEPGRAM_LISTEN_LANGUAGE") || "pt-BR",
      thinkModel: Deno.env.get("DEEPGRAM_THINK_MODEL") || "gpt-4o-mini",
      ttsProvider,
      ttsVoice,
      inputSampleRate: Number(Deno.env.get("SYNAPSE_VOICE_INPUT_SAMPLE_RATE") || "16000"),
      outputSampleRate: Number(Deno.env.get("SYNAPSE_VOICE_OUTPUT_SAMPLE_RATE") || "24000"),
      functionsCount: functions.length,
    },
  };
}

async function ensureVoiceSession(admin: any, userId: string, requestedSessionId: string) {
  if (requestedSessionId) {
    const { data, error } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("id", requestedSessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  const { data: latest, error: latestError } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  if (latest?.id) return latest.id as string;

  const { data, error } = await admin
    .from("chat_sessions")
    .insert({ user_id: userId, title: "Conversa por voz" })
    .select("id")
    .single();
  if (error || !data?.id) throw error || new Error("Nao foi possivel criar a conversa por voz.");
  return data.id as string;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Sessao ausente." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "Supabase nao configurado para voz." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    if (configuredVoiceProvider() !== SUPPORTED_PROVIDER) {
      return json({
        error: "synapse-voice-agent-session atende somente o provider deepgram-agent.",
        provider: SUPPORTED_PROVIDER,
      }, 409);
    }

    const includeSettings = Boolean(body.includeSettings);
    const gatewaySecret = Deno.env.get("SYNAPSE_VOICE_GATEWAY_SECRET") || "";
    const gatewayAuthorized = gatewaySecret &&
      request.headers.get("x-synapse-gateway-secret") === gatewaySecret;
    if (includeSettings && !gatewayAuthorized) {
      return json({ error: "Gateway nao autorizado." }, 403);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: "Sessao invalida." }, 401);

    const sessionId = await ensureVoiceSession(admin, user.id, clean(body.sessionId, 120));
    const loadedContext = await loadConversationContext(admin, user.id, sessionId);
    const profile = await loadProfessionalProfile(admin, user.id);
    const context = body.context && typeof body.context === "object" ? body.context : {};
    const prompt = buildVoicePrompt(
      clean(body.systemInstruction, 1600),
      loadedContext.state,
      loadedContext.memorySummary,
      context,
      profile.professionalName,
    );
    const { settings, metadata } = buildAgentSettings(prompt, context);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return json({
      provider: "deepgram-agent",
      sessionId,
      gatewayUrl: publicGatewayUrl(),
      deepgramUrl: includeSettings ? Deno.env.get("DEEPGRAM_AGENT_URL") || DEFAULT_DEEPGRAM_URL : undefined,
      expiresAt,
      model: metadata.thinkModel,
      voiceName: metadata.ttsVoice,
      listenModel: metadata.listenModel,
      listenLanguage: metadata.listenLanguage,
      ttsProvider: metadata.ttsProvider,
      inputSampleRate: metadata.inputSampleRate,
      outputSampleRate: metadata.outputSampleRate,
      functionsCount: metadata.functionsCount,
      agentSettings: includeSettings ? settings : undefined,
    });
  } catch (error) {
    console.error("[synapse-voice-agent-session]", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao preparar sessao de voz." }, 500);
  }
});
