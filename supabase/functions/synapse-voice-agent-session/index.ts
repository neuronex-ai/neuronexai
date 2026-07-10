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
const SUPABASE_EDGE_GATEWAY_PATH = "/functions/v1/synapse-voice-gateway";
const DEFAULT_DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse";
const NVIDIA_VOICE_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_VOICE_MODEL = "nvidia/nemotron-3-nano-30b-a3b";
const SYNAPSE_VOICE_THINK_TEMPERATURE = 0.35;
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";
const DEFAULT_ELEVENLABS_VOICE_ID = "cjVigY5qzO86Huf0OWal";
const DEFAULT_ELEVENLABS_LANGUAGE_CODE = "pt";

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

const isLocalDevelopmentHost = (host: string) =>
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host) ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

function elevenLabsApiKey() {
  const value = clean(Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_LABS_API_KEY"), 8000);
  if (!value) {
    throw new Error("ELEVENLABS_API_KEY ou ELEVEN_LABS_API_KEY nao configurada para o Synapse de voz.");
  }
  return value;
}

function nvidiaVoiceApiKey() {
  const value = clean(Deno.env.get("NVIDIA_VOICE_API_KEY"), 8000);
  if (!value) {
    throw new Error("NVIDIA_VOICE_API_KEY nao configurada para o Synapse de voz.");
  }
  return value;
}

const supabaseEdgeGatewayUrl = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return DEFAULT_GATEWAY_URL;
  try {
    const url = new URL(supabaseUrl);
    url.protocol = "wss:";
    url.pathname = SUPABASE_EDGE_GATEWAY_PATH;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return DEFAULT_GATEWAY_URL;
  }
};

const publicGatewayUrl = (originHeader?: string | null) => {
  const configured =
    Deno.env.get("SYNAPSE_VOICE_GATEWAY_URL") ||
    Deno.env.get("PUBLIC_SYNAPSE_VOICE_GATEWAY_URL");
  if (configured) return configured;

  try {
    const origin = originHeader ? new URL(originHeader) : null;
    const host = origin?.hostname || "";
    if (isLocalDevelopmentHost(host)) {
      const protocol = origin?.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${origin!.host}/v1/synapse/voice`;
    }
  } catch {
    // Fall through to the Supabase Edge gateway default.
  }

  return supabaseEdgeGatewayUrl();
};

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
  const modelId = DEFAULT_ELEVENLABS_MODEL_ID;
  const voiceId = DEFAULT_ELEVENLABS_VOICE_ID;
  const languageCode = DEFAULT_ELEVENLABS_LANGUAGE_CODE;
  const elevenLabsKey = elevenLabsApiKey();

  const speak: Record<string, unknown> = {
    provider: {
      type: "eleven_labs",
      model_id: modelId,
      language_code: languageCode,
    },
    endpoint: {
      url: `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/multi-stream-input`,
      headers: {
        "xi-api-key": elevenLabsKey,
      },
    },
  };

  return {
    speak,
    ttsProvider: "deepgram-elevenlabs",
    ttsVoice: voiceId,
  };
}

function buildThinkConfig(
  prompt: string,
  functions: Array<Record<string, unknown>>,
) {
  return {
    provider: {
      type: "open_ai",
      model: NVIDIA_VOICE_MODEL,
      temperature: SYNAPSE_VOICE_THINK_TEMPERATURE,
    },
    endpoint: {
      url: NVIDIA_VOICE_CHAT_URL,
      headers: {
        authorization: `Bearer ${nvidiaVoiceApiKey()}`,
      },
    },
    prompt,
    functions,
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

  const thinkModel = NVIDIA_VOICE_MODEL;
  const inputSampleRate = Number(Deno.env.get("SYNAPSE_VOICE_INPUT_SAMPLE_RATE") || "48000");
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
        think: buildThinkConfig(prompt, functions),
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
    if (functions.length <= VOICE_ONLY_TOOLS.length) {
      return json({ error: "Ferramentas reais do Synapse nao foram registradas para o modo voz." }, 500);
    }
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
      gatewayUrl: publicGatewayUrl(request.headers.get("Origin")),
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
