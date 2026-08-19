import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildSynapseVoicePrompt } from "../_shared/synapse-voice-prompt.ts";
import {
  ensureVoiceConversation,
  ensureVoiceSessionRecord,
} from "../_shared/synapse-voice-session.ts";
import {
  SYNAPSE_ELEVENLABS_LANGUAGE,
  SYNAPSE_ELEVENLABS_MODEL_ID,
} from "../_shared/synapse-voice-settings.ts";
import { resolveAccessibleElevenLabsVoice } from "../_shared/elevenlabs-voice.ts";
import { loadConversationContext } from "../synapse-text-fallback/entity-context.ts";
import {
  buildSynapseVoiceFunctions,
  SYNAPSE_VOICE_ONLY_TOOLS,
  SYNAPSE_VOICE_TOOLSET_VERSION,
} from "../_shared/synapse-voice-toolset.ts";

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
const PRIMARY_THINK_MODEL = "gpt-5.4-mini";
const FALLBACK_THINK_MODEL = "gemini-3.5-flash";
const LAST_RESORT_THINK_MODEL = "claude-haiku-4-5";
const SYNAPSE_VOICE_THINK_TEMPERATURE = 0.25;
const AZURE_TTS_ADAPTER_PATH = "/functions/v1/synapse-voice-azure-tts";
const OPENAI_COMPATIBLE_TTS_MODEL = "tts-1";
const OPENAI_COMPATIBLE_TTS_VOICE = "alloy";
const DEFAULT_ELEVENLABS_PT_BR_MALE_VOICE_ID = "NQ10OlqJ7vYH6XwegHSW";

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

type DeepgramHistoryMessage = {
  type: "History";
  role: "user" | "assistant";
  content: string;
};

const envFlag = (name: string, fallback = false) => {
  const value = clean(Deno.env.get(name), 40).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
};

const isLocalDevelopmentHost = (host: string) =>
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(host) ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

function ttsAdapterSecret() {
  const value = clean(Deno.env.get("SYNAPSE_VOICE_TTS_ADAPTER_SECRET"), 8000);
  if (!value) throw new Error("SYNAPSE_VOICE_TTS_ADAPTER_SECRET não configurado para o Synapse de voz.");
  return value;
}

function elevenLabsApiKey() {
  const value = clean(Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_LABS_API_KEY"), 8000);
  if (!value) throw new Error("Chave da ElevenLabs não configurada para a voz principal.");
  return value;
}

function azureTtsAdapterUrl() {
  const configured = clean(Deno.env.get("SYNAPSE_VOICE_TTS_ADAPTER_URL"), 1000);
  if (configured) return configured;
  const supabaseUrl = clean(Deno.env.get("SUPABASE_URL"), 1000).replace(/\/$/, "");
  if (!supabaseUrl) throw new Error("SUPABASE_URL não configurada para o adaptador de voz.");
  return `${supabaseUrl}${AZURE_TTS_ADAPTER_PATH}`;
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

function professionalNameFromProfile(profile: any) {
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return clean(profile?.full_name || joined || profile?.clinic_name || "", 160);
}

async function loadProfessionalProfile(admin: any, userId: string) {
  const [{ data, error }, { data: preferences }] = await Promise.all([
    admin.from("profiles").select("first_name,last_name,full_name,clinic_name").eq("id", userId).maybeSingle(),
    admin.from("user_preferences").select("timezone,language").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) {
    console.warn("[synapse-voice-agent-session] profile load failed", error.message);
    return { professionalName: "", timezone: "America/Sao_Paulo", locale: "pt-BR" };
  }
  return {
    professionalName: professionalNameFromProfile(data),
    clinicName: clean(data?.clinic_name, 160),
    timezone: clean(preferences?.timezone || "America/Sao_Paulo", 80),
    locale: clean(preferences?.language || "pt-BR", 20),
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

async function loadRecentAgentContext(admin: any, userId: string, conversationId: string) {
  const { data, error } = await admin
    .from("synapse_voice_turns")
    .select("role,transcript,response_text,created_at")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .eq("is_final", true)
    .order("created_at", { ascending: false })
    .limit(32);
  if (error) {
    console.warn("[synapse-voice-agent-session] recent context load failed", error.message);
    return [];
  }

  let size = 0;
  const messages: DeepgramHistoryMessage[] = [];
  for (const row of [...(data || [])].reverse()) {
    let role: "user" | "assistant";
    let content = "";
    if (row.role === "user") {
      role = "user";
      content = clean(row.transcript, 1200);
    } else if (row.role === "assistant") {
      role = "assistant";
      content = clean(row.response_text, 1600);
    } else {
      // Tool rows use a different Deepgram History schema. Omit them until we
      // persist the exact function-call request/response pair required by the provider.
      continue;
    }
    if (!content || size + content.length > 12000) continue;
    messages.push({ type: "History", role, content });
    size += content.length;
  }
  return messages.slice(-12);
}

function buildSpeakConfig(
  timezone = "America/Sao_Paulo",
  resolvedElevenLabsVoiceId = DEFAULT_ELEVENLABS_PT_BR_MALE_VOICE_ID,
) {
  const elevenLabsVoice = clean(resolvedElevenLabsVoiceId, 160);
  const elevenLabsModel = SYNAPSE_ELEVENLABS_MODEL_ID;
  const elevenLabsProvider: Record<string, string> = {
    type: "eleven_labs",
    model_id: elevenLabsModel,
    language: SYNAPSE_ELEVENLABS_LANGUAGE,
  };
  // `multi` is a Deepgram third-party TTS provider setting, not an ElevenLabs
  // `language_code` value in our Settings payload. Deepgram maps it internally.
  return {
    speak: [
      {
        provider: elevenLabsProvider,
        endpoint: {
          url: `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoice)}/multi-stream-input`,
          headers: { "xi-api-key": elevenLabsApiKey() },
        },
      },
      {
        provider: {
          type: "open_ai",
          model: OPENAI_COMPATIBLE_TTS_MODEL,
          voice: OPENAI_COMPATIBLE_TTS_VOICE,
        },
        endpoint: {
          url: azureTtsAdapterUrl(),
          headers: {
            "x-synapse-tts-secret": ttsAdapterSecret(),
            "x-synapse-timezone": clean(timezone, 80) || "America/Sao_Paulo",
          },
        },
      },
    ],
    ttsProvider: "deepgram-elevenlabs-multi+azure-speech-fallback",
    ttsVoice: elevenLabsVoice,
  };
}

function stripUnsupportedSchemaKeywords(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsupportedSchemaKeywords);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "additionalProperties") continue;
    output[key] = stripUnsupportedSchemaKeywords(entry);
  }
  return output;
}

function buildThinkConfig(
  prompt: string,
  functions: Array<Record<string, unknown>>,
) {
  const portableFunctions = functions.map((fn) => ({
    ...fn,
    parameters: stripUnsupportedSchemaKeywords(fn.parameters),
  }));
  return [
    {
      provider: {
        type: "open_ai",
        model: PRIMARY_THINK_MODEL,
        temperature: SYNAPSE_VOICE_THINK_TEMPERATURE,
      },
      prompt,
      functions: portableFunctions,
    },
    {
      provider: {
        type: "google",
        model: FALLBACK_THINK_MODEL,
        temperature: SYNAPSE_VOICE_THINK_TEMPERATURE,
      },
    },
    {
      provider: {
        type: "anthropic",
        model: LAST_RESORT_THINK_MODEL,
        temperature: SYNAPSE_VOICE_THINK_TEMPERATURE,
      },
    },
  ];
}

function buildAgentSettings(
  prompt: string,
  context: Record<string, unknown>,
  functions: Array<Record<string, unknown>>,
  contextMessages: DeepgramHistoryMessage[],
  timezone = "America/Sao_Paulo",
  resolvedElevenLabsVoiceId = DEFAULT_ELEVENLABS_PT_BR_MALE_VOICE_ID,
) {
  const { speak, ttsProvider, ttsVoice } = buildSpeakConfig(timezone, resolvedElevenLabsVoiceId);
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

  const thinkModel = PRIMARY_THINK_MODEL;
  const inputSampleRate = Number(Deno.env.get("SYNAPSE_VOICE_INPUT_SAMPLE_RATE") || "48000");
  const outputSampleRate = Number(Deno.env.get("SYNAPSE_VOICE_OUTPUT_SAMPLE_RATE") || "24000");

  const settings = {
    type: "Settings",
    tags: ["neuronex", "synapse", "voice", "pt-BR"],
    flags: { history: envFlag("SYNAPSE_VOICE_HISTORY", true) },
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
      context: contextMessages.length ? { messages: contextMessages } : undefined,
      listen: {
        provider: listenProvider,
      },
      think: buildThinkConfig(prompt, functions),
      speak,
      greeting: clean(context?.greeting, 280) || undefined,
    },
  };

  return {
    settings,
    metadata: {
      listenModel,
      listenLanguage: Deno.env.get("DEEPGRAM_LISTEN_LANGUAGE") || "pt-BR",
      thinkModel,
      ttsProvider,
      ttsVoice,
      inputSampleRate,
      outputSampleRate,
      fallbackThinkModel: FALLBACK_THINK_MODEL,
      lastResortThinkModel: LAST_RESORT_THINK_MODEL,
      historyEnabled: envFlag("SYNAPSE_VOICE_HISTORY", true),
      functionsCount: functions.length,
      promptCharacters: prompt.length,
      settingsCharacters: JSON.stringify(settings).length,
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
    const functions = buildSynapseVoiceFunctions();
    if (functions.length <= SYNAPSE_VOICE_ONLY_TOOLS.length) {
      return json({ error: "Ferramentas reais do Synapse nao foram registradas para o modo voz." }, 500);
    }
    const pendingActionSummary = await loadPendingActionSummary(admin, user.id, conversationId);
    const contextMessages = await loadRecentAgentContext(admin, user.id, conversationId);
    const prompt = buildSynapseVoicePrompt({
      systemInstruction: clean(body.systemInstruction, 600),
      state: loadedContext.state,
      memorySummary: loadedContext.memorySummary,
      context,
      professionalName: profile.professionalName,
      pendingActionSummary,
    });

    const configuredVoiceId = clean(
      Deno.env.get("SYNAPSE_VOICE_TTS_PT_BR_VOICE_ID") || DEFAULT_ELEVENLABS_PT_BR_MALE_VOICE_ID,
      160,
    );
    const resolvedVoice = await resolveAccessibleElevenLabsVoice({
      apiKey: elevenLabsApiKey(),
      configuredVoiceId,
    });
    console.info("[synapse-voice-agent-session] ElevenLabs voice resolved", {
      configuredVoiceId,
      voiceId: resolvedVoice.voiceId,
      voiceName: resolvedVoice.name,
      category: resolvedVoice.category,
      selection: resolvedVoice.selection,
    });

    const { settings, metadata } = buildAgentSettings(
      prompt,
      context,
      functions,
      contextMessages,
      profile.timezone,
      resolvedVoice.voiceId,
    );
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
          promptCharacters: metadata.promptCharacters,
          settingsCharacters: metadata.settingsCharacters,
          voiceSelection: resolvedVoice.selection,
          voiceName: resolvedVoice.name,
          voiceCategory: resolvedVoice.category,
          toolsetVersion: SYNAPSE_VOICE_TOOLSET_VERSION,
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
      voiceName: resolvedVoice.name,
      voiceId: metadata.ttsVoice,
      voiceSelection: resolvedVoice.selection,
      listenModel: metadata.listenModel,
      listenLanguage: metadata.listenLanguage,
      ttsProvider: metadata.ttsProvider,
      inputSampleRate: metadata.inputSampleRate,
      outputSampleRate: metadata.outputSampleRate,
      functionsCount: metadata.functionsCount,
      toolsetVersion: SYNAPSE_VOICE_TOOLSET_VERSION,
      agentSettings: includeSettings ? settings : undefined,
    });
  } catch (error) {
    console.error("[synapse-voice-agent-session]", error);
    return json({ error: error instanceof Error ? error.message : "Falha ao preparar sessao de voz." }, 500);
  }
});
