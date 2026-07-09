import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSynapseVoicePrompt } from "../_shared/synapse-voice-prompt.ts";
import {
  ensureVoiceConversation,
  ensureVoiceSessionRecord,
} from "../_shared/synapse-voice-session.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";
import { loadConversationContext } from "../synapse-text-fallback/entity-context.ts";

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
const DEFAULT_CARTESIA_MALE_VOICE_ID = "a167e0f3-df7e-4d52-a9c3-f949145efdab";
const DEFAULT_DEEPGRAM_THINK_PROVIDER = "nvidia";
const DEFAULT_DEEPGRAM_THINK_MODEL = "nemotron-3-nano-30B-A3B";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_VOICE_ID = "UgBBYS2sOqTuMpoF3BR0";
const SUPPORTED_PROVIDER = "deepgram-agent";

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

function normalizeThinkModel(provider: string, model: string) {
  const cleanProvider = clean(provider, 80).toLowerCase();
  const cleanModel = clean(model, 160);
  if (cleanProvider !== "nvidia") return cleanModel || DEFAULT_DEEPGRAM_THINK_MODEL;
  if (/^nvidia\/nemotron-3-nano-30b-a3b$/i.test(cleanModel)) return DEFAULT_DEEPGRAM_THINK_MODEL;
  if (/^nemotron-3-nano-30b-a3b$/i.test(cleanModel)) return DEFAULT_DEEPGRAM_THINK_MODEL;
  return cleanModel || DEFAULT_DEEPGRAM_THINK_MODEL;
}

const publicGatewayUrl = () =>
  Deno.env.get("SYNAPSE_VOICE_GATEWAY_URL") ||
  Deno.env.get("PUBLIC_SYNAPSE_VOICE_GATEWAY_URL") ||
  DEFAULT_GATEWAY_URL;

const configuredVoiceProvider = () =>
  clean(Deno.env.get("SYNAPSE_VOICE_PROVIDER") || SUPPORTED_PROVIDER, 80).toLowerCase();

const configuredTtsProvider = () =>
  clean(Deno.env.get("SYNAPSE_VOICE_TTS_PROVIDER") || "deepgram-elevenlabs", 80).toLowerCase();

const toDeepgramFunction = (tool: any) => {
  const fn = tool?.function || {};
  return {
    name: String(fn.name || ""),
    description: String(fn.description || ""),
    parameters: fn.parameters || { type: "object", properties: {} },
  };
};

function parseJsonEnv(name: string) {
  const raw = clean(Deno.env.get(name), 5000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    throw new Error(`${name} deve ser um JSON valido.`);
  }
}

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

async function loadPendingActionSummary(admin: any, userId: string, conversationId: string) {
  const { data, error } = await admin
    .from("messages")
    .select("attachments,created_at")
    .eq("user_id", userId)
    .eq("session_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.warn("[synapse-voice-agent-session] pending action load failed", error.message);
    return "";
  }

  for (const row of data || []) {
    const attachments = Array.isArray(row.attachments)
      ? row.attachments
      : row.attachments && typeof row.attachments === "object"
        ? [row.attachments]
        : [];
    const pending = attachments.find((item: any) =>
      item?.kind === "synapse_pending_action" &&
      item?.status === "pending" &&
      new Date(item.expiresAt).getTime() > Date.now()
    );
    if (pending?.summary) return clean(pending.summary, 800);
  }
  return "";
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

function buildVoiceFunctions() {
  return [
    ...VOICE_ONLY_TOOLS,
    ...AGENT_TOOLS_V3.map(toDeepgramFunction).filter((item) => item.name),
  ];
}

function buildSpeakConfig() {
  const ttsProvider = configuredTtsProvider();

  const speakProviderOverride = parseJsonEnv("SYNAPSE_VOICE_SPEAK_PROVIDER_JSON");
  if (speakProviderOverride) {
    return {
      speak: {
        provider: speakProviderOverride,
      },
      ttsProvider: `deepgram-managed-${clean(speakProviderOverride.type || "custom", 80)}`,
      ttsVoice: clean(
        speakProviderOverride.voice ||
          speakProviderOverride.voice_id ||
          speakProviderOverride.model_id ||
          speakProviderOverride.model,
        160,
      ),
    };
  }

  if (ttsProvider === "deepgram-elevenlabs" || ttsProvider === "eleven_labs") {
    const modelId = Deno.env.get("DEEPGRAM_ELEVENLABS_MODEL_ID") || DEFAULT_ELEVENLABS_MODEL_ID;
    const voiceId = Deno.env.get("DEEPGRAM_ELEVENLABS_VOICE_ID") || DEFAULT_ELEVENLABS_VOICE_ID;
    return {
      speak: {
        provider: {
          type: "eleven_labs",
          model_id: modelId,
          voice_id: voiceId,
          language_code: Deno.env.get("DEEPGRAM_ELEVENLABS_LANGUAGE_CODE") || "pt-BR",
        },
      },
      ttsProvider: "deepgram-managed-elevenlabs",
      ttsVoice: voiceId,
    };
  }

  const cartesiaVoiceId =
    Deno.env.get("CARTESIA_VOICE_ID") ||
    Deno.env.get("DEEPGRAM_CARTESIA_VOICE_ID") ||
    DEFAULT_CARTESIA_MALE_VOICE_ID;
  const cartesiaApiKey =
    Deno.env.get("CARTESIA_API_KEY") ||
    Deno.env.get("DEEPGRAM_CARTESIA_API_KEY") ||
    "";
  const cartesiaManaged = Deno.env.get("DEEPGRAM_MANAGED_CARTESIA") !== "false" && ttsProvider !== "cartesia-byo";
  const modelId = Deno.env.get("CARTESIA_MODEL_ID") || "sonic-2";

  const speak: Record<string, unknown> = {
    provider: {
      type: "cartesia",
      model_id: modelId,
      voice: {
        mode: "id",
        id: cartesiaVoiceId,
      },
      language: Deno.env.get("CARTESIA_LANGUAGE") || "pt-BR",
      speed: Deno.env.get("CARTESIA_SPEED") || "normal",
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
  functions: Array<Record<string, unknown>>,
) {
  const { speak, ttsProvider, ttsVoice } = buildSpeakConfig();
  const listenModel = Deno.env.get("DEEPGRAM_LISTEN_MODEL") || "flux-general-multi";
  const listenProvider: Record<string, unknown> = {
    type: "deepgram",
    version: listenModel.startsWith("flux-") ? "v2" : "v1",
    model: listenModel,
  };

  if (listenModel === "flux-general-multi") {
    listenProvider.language_hints = ["pt"];
    listenProvider.eot_threshold = Number(Deno.env.get("DEEPGRAM_EOT_THRESHOLD") || "0.72");
    listenProvider.eager_eot_threshold = Number(Deno.env.get("DEEPGRAM_EAGER_EOT_THRESHOLD") || "0.45");
    listenProvider.eot_timeout_ms = Number(Deno.env.get("DEEPGRAM_EOT_TIMEOUT_MS") || "1200");
  } else if (listenModel.startsWith("flux-")) {
    listenProvider.eot_threshold = Number(Deno.env.get("DEEPGRAM_EOT_THRESHOLD") || "0.72");
    listenProvider.eager_eot_threshold = Number(Deno.env.get("DEEPGRAM_EAGER_EOT_THRESHOLD") || "0.45");
    listenProvider.eot_timeout_ms = Number(Deno.env.get("DEEPGRAM_EOT_TIMEOUT_MS") || "1200");
  } else {
    listenProvider.language = Deno.env.get("DEEPGRAM_LISTEN_LANGUAGE") || "pt-BR";
    listenProvider.smart_format = true;
  }

  const thinkProvider = Deno.env.get("DEEPGRAM_THINK_PROVIDER") || DEFAULT_DEEPGRAM_THINK_PROVIDER;
  const thinkModel = normalizeThinkModel(
    thinkProvider,
    Deno.env.get("DEEPGRAM_THINK_MODEL") || DEFAULT_DEEPGRAM_THINK_MODEL,
  );
  const inputSampleRate = Number(Deno.env.get("SYNAPSE_VOICE_INPUT_SAMPLE_RATE") || "16000");
  const outputSampleRate = Number(Deno.env.get("SYNAPSE_VOICE_OUTPUT_SAMPLE_RATE") || "24000");

  return {
    settings: {
      type: "Settings",
      tags: ["neuronex", "synapse", "voice", "pt-BR"],
      flags: { history: true },
      audio: {
        input: {
          encoding: "linear16",
          sample_rate: inputSampleRate,
        },
        output: {
          encoding: "linear16",
          sample_rate: outputSampleRate,
          container: "none",
        },
      },
      agent: {
        listen: {
          provider: listenProvider,
        },
        think: {
          provider: {
            type: thinkProvider,
            model: thinkModel,
            temperature: Number(Deno.env.get("DEEPGRAM_THINK_TEMPERATURE") || "0.35"),
          },
          prompt,
          functions,
        },
        speak,
        greeting: clean(context?.greeting, 280) || undefined,
      },
    },
    metadata: {
      listenModel,
      listenLanguage: Deno.env.get("DEEPGRAM_LISTEN_LANGUAGE") || "pt-BR",
      thinkModel,
      ttsProvider,
      ttsVoice,
      inputSampleRate,
      outputSampleRate,
      functionsCount: functions.length,
    },
  };
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

    const context = body.context && typeof body.context === "object" ? body.context : {};
    const conversationId = await ensureVoiceConversation(
      admin,
      user.id,
      clean(body.conversationId || body.conversation_id || body.sessionId, 120),
    );
    const loadedContext = await loadConversationContext(admin, user.id, conversationId);
    const profile = await loadProfessionalProfile(admin, user.id);
    const functions = buildVoiceFunctions();
    const pendingActionSummary = await loadPendingActionSummary(admin, user.id, conversationId);
    const prompt = buildSynapseVoicePrompt({
      systemInstruction: clean(body.systemInstruction, 1600),
      state: loadedContext.state,
      memorySummary: loadedContext.memorySummary,
      context,
      professionalName: profile.professionalName,
      pendingActionSummary,
      tools: functions,
    });
    const { settings, metadata } = buildAgentSettings(prompt, context, functions);
    const voiceSessionId = await ensureVoiceSessionRecord(
      admin,
      user.id,
      conversationId,
      clean(body.voiceSessionId || body.voice_session_id, 120),
      {
        provider: "deepgram-agent",
        sttProvider: "deepgram-flux",
        ttsProvider: String(metadata.ttsProvider),
        voiceId: String(metadata.ttsVoice),
        listenModel: String(metadata.listenModel),
        thinkModel: String(metadata.thinkModel),
        metadata: {
          includeSettings,
          route: clean(context.route || context.currentContext, 180),
          functionsCount: metadata.functionsCount,
        },
      },
    );
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return json({
      provider: "deepgram-agent",
      sessionId: conversationId,
      conversationId,
      voiceSessionId,
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
