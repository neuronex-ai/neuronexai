import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { VoiceFunctionRunner } from "./function-runner.js";
import { isAssistantRole, isUserRole } from "./intent.js";
import { normalizeVoiceText } from "./speech-normalizer.js";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

loadLocalEnv();

const PORT = Number(process.env.SYNAPSE_VOICE_GATEWAY_PORT || process.env.PORT || "8789");
const PATHNAME = process.env.SYNAPSE_VOICE_GATEWAY_PATH || "/v1/synapse/voice";
const DEFAULT_DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse";
const DEFAULT_VOICE_LLM_ENDPOINT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_VOICE_LLM_MODEL = "nvidia/nemotron-3-nano-30b-a3b";
const DEFAULT_VOICE_LLM_PROVIDER_TYPE = "open_ai";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";
const DEFAULT_ELEVENLABS_VOICE_ID = "cjVigY5qzO86Huf0OWal";
const DEFAULT_ELEVENLABS_LANGUAGE_CODE = "pt";

const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);

function jsonResponse(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
}

function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

function getFunctionsUrl() {
  return process.env.SUPABASE_FUNCTIONS_URL || `${getSupabaseUrl().replace(/\/$/, "")}/functions/v1`;
}

function getGatewaySecret() {
  return process.env.SYNAPSE_VOICE_GATEWAY_SECRET || "";
}

function getElevenLabsApiKey() {
  return process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || "";
}

function getNvidiaVoiceApiKey() {
  return process.env.NVIDIA_VOICE_API_KEY || "";
}

function voiceLlmProviderType() {
  return clean(process.env.SYNAPSE_VOICE_LLM_PROVIDER_TYPE || DEFAULT_VOICE_LLM_PROVIDER_TYPE, 80);
}

function voiceLlmModel() {
  return clean(process.env.SYNAPSE_VOICE_LLM_MODEL || DEFAULT_VOICE_LLM_MODEL, 180);
}

function voiceLlmEndpointUrl() {
  return clean(process.env.SYNAPSE_VOICE_LLM_ENDPOINT_URL || DEFAULT_VOICE_LLM_ENDPOINT_URL, 500);
}

function voiceLlmApiKey() {
  return clean(process.env.SYNAPSE_VOICE_LLM_API_KEY || getNvidiaVoiceApiKey(), 8000);
}

function nvidiaThinkingOff() {
  return clean(process.env.SYNAPSE_VOICE_NVIDIA_THINKING || "off", 20).toLowerCase() !== "on";
}

function voiceThinkTemperature() {
  const explicit = clean(process.env.SYNAPSE_VOICE_THINK_TEMPERATURE, 20);
  if (explicit) return Number(explicit);
  return 0.35;
}

function voiceTtsModelId() {
  return clean(process.env.SYNAPSE_VOICE_TTS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID, 120);
}

function voiceTtsVoiceId() {
  return clean(process.env.SYNAPSE_VOICE_TTS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID, 160);
}

function voiceTtsLanguageCode() {
  return clean(process.env.SYNAPSE_VOICE_TTS_LANGUAGE_CODE || DEFAULT_ELEVENLABS_LANGUAGE_CODE, 20);
}

function missingGatewayConfiguration() {
  return [
    !process.env.DEEPGRAM_API_KEY ? "DEEPGRAM_API_KEY" : "",
    voiceLlmEndpointUrl() && !voiceLlmApiKey() ? "SYNAPSE_VOICE_LLM_API_KEY ou NVIDIA_VOICE_API_KEY" : "",
    !getElevenLabsApiKey() ? "ELEVENLABS_API_KEY ou ELEVEN_LABS_API_KEY" : "",
    !getSupabaseUrl() ? "SUPABASE_URL ou VITE_SUPABASE_URL" : "",
    !getSupabaseAnonKey() ? "SUPABASE_ANON_KEY ou VITE_SUPABASE_ANON_KEY" : "",
    !getGatewaySecret() ? "SYNAPSE_VOICE_GATEWAY_SECRET" : "",
  ].filter(Boolean);
}

function assertGatewayConfiguration() {
  const missing = missingGatewayConfiguration();
  if (!missing.length) return;
  console.error("[voice-agent-gateway] configuração obrigatória ausente:", missing.join(", "));
  console.error("[voice-agent-gateway] o Synapse de voz usa somente Deepgram Agent + NVIDIA BYO + ElevenLabs.");
  process.exit(1);
}

function isFunctionNotFound(response, data) {
  const code = clean(data?.code || data?.error_code || data?.sb_error_code, 120).toUpperCase();
  const message = clean(data?.message || data?.error, 500).toLowerCase();
  return response.status === 404 || code === "NOT_FOUND" || /function was not found|fun[cç][aã]o.*n[aã]o.*encontrada/.test(message);
}

function edgeFunctionMissingMessage(functionName) {
  return [
    `Edge Function ${functionName} não está deployada no projeto Supabase configurado.`,
    "Deploy necessário: supabase functions deploy synapse-voice-agent-session synapse-voice-tool --project-ref krewdaklcyzqfxkkgvqr.",
  ].join(" ");
}

function parseJson(data) {
  try {
    return JSON.parse(data.toString("utf8"));
  } catch {
    return null;
  }
}

function isOpen(ws) {
  return ws && ws.readyState === WebSocket.OPEN;
}

function conversationText(event) {
  const role = clean(event?.role || event?.speaker || event?.channel?.role, 40);
  const content = clean(event?.content || event?.text || event?.transcript || event?.message, 20000);
  if (!content) return null;
  return { role, content };
}

function gatewayErrorType(error) {
  const text = clean(error?.message || error, 1200).toLowerCase();
  if (/sessao|sessão|token|auth|unauthorized|401|403|jwt|gateway nao autorizado|gateway não autorizado/.test(text)) return "auth_error";
  if (/settings|config|api[_ -]?key|secret|supabase nao configurado|supabase não configurado|ausentes|missing/.test(text)) return "config_error";
  if (/deepgram|eleven|nvidia|provider|websocket|socket|1005|failed_to_speak|failed_to_think/.test(text)) return "provider_error";
  if (/tool|ferramenta/.test(text)) return "tool_error";
  if (/network|fetch|timeout|econn|gateway|503|502|504/.test(text)) return "network_error";
  if (/permiss|permission|ownership|rls/.test(text)) return "permission_error";
  return "voice_error";
}

function providerEventMessage(event) {
  return clean(event?.description || event?.message || event?.error || event?.reason || "", 1000);
}

function sanitizeProviderEvent(event) {
  const message = providerEventMessage(event);
  return {
    type: clean(event?.type, 80),
    code: clean(event?.code || event?.error_code || event?.status, 120) || undefined,
    message,
    errorType: gatewayErrorType(message || event?.type),
  };
}

function normalizeAgentSettings(settings) {
  const agent = settings?.agent;
  if (!agent || typeof agent !== "object") {
    throw new Error("Settings de voz invalidos: agent ausente.");
  }

  const think = agent.think && typeof agent.think === "object" ? agent.think : {};
  agent.think = think;
  const thinkProvider = think.provider && typeof think.provider === "object" ? think.provider : {};
  think.provider = thinkProvider;
  thinkProvider.type = voiceLlmProviderType();
  thinkProvider.model = voiceLlmModel();
  thinkProvider.temperature = voiceThinkTemperature();
  if (nvidiaThinkingOff() && clean(process.env.SYNAPSE_VOICE_ENABLE_REASONING_EFFORT, 20).toLowerCase() === "true") {
    thinkProvider.reasoning_effort = "low";
  }

  const llmEndpointUrl = voiceLlmEndpointUrl();
  if (llmEndpointUrl) {
    const thinkEndpoint = think.endpoint && typeof think.endpoint === "object" ? think.endpoint : {};
    think.endpoint = thinkEndpoint;
    thinkEndpoint.url = llmEndpointUrl;
    thinkEndpoint.headers = {
      ...(thinkEndpoint.headers && typeof thinkEndpoint.headers === "object" ? thinkEndpoint.headers : {}),
      authorization: `Bearer ${voiceLlmApiKey()}`,
    };
    if (!voiceLlmApiKey()) {
      throw new Error("Settings de voz incompletos: endpoint LLM ou chave de LLM de voz ausente.");
    }
  } else {
    delete think.endpoint;
  }

  const listenProvider = settings?.agent?.listen?.provider;
  if (listenProvider && typeof listenProvider === "object") {
    const listenModel = clean(listenProvider.model, 120);
    const listenVersion = clean(listenProvider.version, 40);
    if (listenModel.startsWith("flux-") || listenVersion === "v2") {
      delete listenProvider.language;
      delete listenProvider.smart_format;
      if (listenModel === "flux-general-multi") {
        listenProvider.language_hints = ["pt"];
      } else {
        delete listenProvider.language_hints;
      }
    }
  }

  const speak = settings?.agent?.speak;
  const speakProvider = speak?.provider;
  if (speakProvider?.type !== "eleven_labs") {
    throw new Error("Settings de voz invalidos: o Synapse usa somente ElevenLabs via Deepgram.");
  }
  speakProvider.model_id = voiceTtsModelId();
  speakProvider.language_code = voiceTtsLanguageCode();
  const voiceId = clean(speakProvider.voice_id, 160) || voiceTtsVoiceId();
  if ("voice_id" in speakProvider) {
    delete speakProvider.voice_id;
  }
  const endpoint = speak.endpoint && typeof speak.endpoint === "object" ? speak.endpoint : {};
  speak.endpoint = endpoint;
  endpoint.url = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/multi-stream-input`;
  endpoint.headers = {
    ...(endpoint.headers && typeof endpoint.headers === "object" ? endpoint.headers : {}),
    "xi-api-key": getElevenLabsApiKey(),
  };
  const endpointUrl = clean(endpoint?.url, 500);
  const apiKey = clean(endpoint?.headers?.["xi-api-key"], 8000);
  if (!endpointUrl || !apiKey) {
    throw new Error("Settings de voz incompletos: endpoint ElevenLabs ou ELEVENLABS_API_KEY ausente.");
  }

  return settings;
}

class SynapseVoiceSession {
  constructor(client) {
    this.client = client;
    this.deepgram = null;
    this.deepgramReady = false;
    this.settingsApplied = false;
    this.started = false;
    this.closed = false;
    this.sessionId = "";
    this.conversationId = "";
    this.voiceSessionId = "";
    this.authorization = "";
    this.keepAliveTimer = null;
    this.persistQueue = Promise.resolve();
    this.persistenceDisabled = false;
    this.startedAt = Date.now();
    this.latencyMs = {};
    this.firstAudioByteSeen = false;
    this.lastUserTranscriptAt = 0;
    this.lastResponseActivityAt = 0;
    this.noResponseRecoveryTimer = null;
    this.noResponseRecoveryCount = 0;
    this.lastFunctionResponseAt = 0;
    this.waitingAudioAfterUser = false;
    this.waitingAudioAfterFunction = false;
    this.lastProviderEvent = null;
    this.runner = new VoiceFunctionRunner({
      sendDeepgram: (payload) => this.sendDeepgram(payload),
      sendClient: (payload) => this.sendClient(payload),
      invokeTool: (call) => this.invokeTool(call),
      markLatency: (event, data) => this.markRunnerLatency(event, data),
    });
  }

  sendClient(payload, binary = false) {
    if (!isOpen(this.client)) return;
    if (binary) {
      this.client.send(payload, { binary: true });
      return;
    }
    this.client.send(JSON.stringify(payload));
  }

  sendDeepgram(payload, binary = false) {
    if (!isOpen(this.deepgram)) return;
    if (binary) {
      this.deepgram.send(payload, { binary: true });
      return;
    }
    this.deepgram.send(JSON.stringify(payload));
  }

  async start(payload) {
    if (this.started) return;
    this.started = true;
    this.startedAt = Date.now();
    this.latencyMs = { gateway_start_ms: 0 };
    this.authorization = clean(payload.authorization || payload.token, 4000);
    if (this.authorization && !this.authorization.startsWith("Bearer ")) {
      this.authorization = `Bearer ${this.authorization}`;
    }
    if (!this.authorization) throw new Error("Sessao ausente para iniciar voz.");

    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) throw new Error("DEEPGRAM_API_KEY não configurada no gateway.");
    const sessionConfig = await this.fetchSessionConfig(payload);
    const settings = sessionConfig.agentSettings;
    if (!settings) throw new Error("Settings Deepgram ausentes na resposta segura do Supabase.");
    normalizeAgentSettings(settings);

    this.conversationId = clean(sessionConfig.conversationId || sessionConfig.sessionId || payload.conversationId || payload.sessionId, 120);
    this.sessionId = this.conversationId;
    this.voiceSessionId = clean(sessionConfig.voiceSessionId || payload.voiceSessionId, 120);
    console.log("[voice-agent-gateway] starting deepgram session", {
      provider: sessionConfig.provider,
      conversationId: this.conversationId,
      voiceSessionId: this.voiceSessionId,
      listenModel: settings?.agent?.listen?.provider?.model,
      listenVersion: settings?.agent?.listen?.provider?.version,
      smartFormat: settings?.agent?.listen?.provider?.smart_format,
      ttsProvider: sessionConfig.ttsProvider || settings?.agent?.speak?.provider?.type,
      functionsCount: Array.isArray(settings?.agent?.think?.functions) ? settings.agent.think.functions.length : 0,
      elevenLabsEndpointConfigured: Boolean(settings?.agent?.speak?.endpoint?.url),
    });
    this.sendClient({
      type: "gateway_status",
      status: "connecting_deepgram",
      sessionId: this.conversationId,
      conversationId: this.conversationId,
      voiceSessionId: this.voiceSessionId,
      provider: "deepgram-agent",
      model: sessionConfig.model,
      voiceName: sessionConfig.voiceName,
      ttsProvider: sessionConfig.ttsProvider,
      functionsCount: sessionConfig.functionsCount,
      outputSampleRate: sessionConfig.outputSampleRate,
      thinkProvider: settings?.agent?.think?.provider?.type,
      thinkModel: settings?.agent?.think?.provider?.model,
    });

    await this.connectDeepgram(sessionConfig.deepgramUrl || DEFAULT_DEEPGRAM_URL, settings);
  }

  async fetchSessionConfig(payload) {
    if (!getGatewaySecret() || !getSupabaseUrl() || !getSupabaseAnonKey()) {
      throw new Error("Gateway de voz seguro incompleto. Configure Supabase URL, anon key e SYNAPSE_VOICE_GATEWAY_SECRET.");
    }

    const response = await fetch(`${getFunctionsUrl()}/synapse-voice-agent-session`, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        apikey: getSupabaseAnonKey(),
        "Content-Type": "application/json",
        "x-synapse-gateway-secret": getGatewaySecret(),
      },
      body: JSON.stringify({
        includeSettings: true,
        conversationId: clean(payload.conversationId || payload.sessionId, 120),
        sessionId: clean(payload.sessionId || payload.conversationId, 120),
        voiceSessionId: clean(payload.voiceSessionId, 120),
        systemInstruction: clean(payload.systemInstruction, 1600),
        context: payload.context && typeof payload.context === "object" ? payload.context : {},
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      if (isFunctionNotFound(response, data)) {
        throw new Error(edgeFunctionMissingMessage("synapse-voice-agent-session"));
      }
      throw new Error(data?.error || data?.message || `Falha ao criar sessao de voz (${response.status}).`);
    }
    return data;
  }

  connectDeepgram(url, settings) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
      });
      this.deepgram = ws;
      let settled = false;

      const settleReady = () => {
        if (settled) return;
        settled = true;
        clearTimeout(failTimer);
        this.settingsApplied = true;
        this.startKeepAlive();
        resolve();
      };

      const settleFailure = (error) => {
        if (settled) return false;
        settled = true;
        clearTimeout(failTimer);
        reject(error);
        return true;
      };

      const failTimer = setTimeout(() => {
        if (!settleFailure(new Error("Timeout ao conectar na Deepgram."))) return;
        this.closeDeepgram();
      }, 12000);

      ws.on("open", () => {
        this.latencyMs.deepgram_ws_open_ms = Date.now() - this.startedAt;
        this.sendClient({ type: "gateway_status", status: "waiting_welcome" });
      });

      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          this.markAgentActivity();
          if (!this.firstAudioByteSeen) {
            this.firstAudioByteSeen = true;
            this.latencyMs.first_audio_byte_ms = Date.now() - this.startedAt;
          }
          if (this.waitingAudioAfterUser && this.lastUserTranscriptAt) {
            this.waitingAudioAfterUser = false;
            this.latencyMs.first_audio_after_last_user_ms = Date.now() - this.lastUserTranscriptAt;
          }
          if (this.waitingAudioAfterFunction && this.lastFunctionResponseAt) {
            this.waitingAudioAfterFunction = false;
            this.latencyMs.first_audio_after_last_function_ms = Date.now() - this.lastFunctionResponseAt;
          }
          this.sendClient(data, true);
          return;
        }

        const event = parseJson(data);
        if (!event) return;
        this.handleDeepgramEvent(event, settings);

        if (event.type === "SettingsApplied") {
          this.latencyMs.settings_applied_ms = Date.now() - this.startedAt;
          settleReady();
        }
      });

      ws.on("close", (code, reason) => {
        const wasSettled = settled;
        clearTimeout(failTimer);
        this.deepgramReady = false;
        void this.updateVoiceSession(wasSettled ? "ended" : "error", {
          closeCode: code,
          closeReason: reason?.toString?.() || this.lastProviderEvent?.message || "",
        });
        this.sendClient({
          type: "gateway_status",
          status: "deepgram_closed",
          code,
          reason: reason?.toString?.() || "",
        });
        if (!wasSettled) {
          const detail = reason?.toString?.() || this.lastProviderEvent?.message || `codigo ${code}`;
          settleFailure(new Error(`Conexao com a Deepgram encerrada antes de ficar pronta (${detail}).`));
          this.settingsApplied = false;
        }
      });

      ws.on("error", (error) => {
        this.sendClient({
          type: "gateway_error",
          errorType: gatewayErrorType(error),
          error: clean(error?.message || "Erro no WebSocket da Deepgram.", 800),
        });
        settleFailure(error);
      });
    });
  }

  handleDeepgramEvent(event, settings) {
    this.sendClient({ type: "deepgram_event", event });

    switch (event.type) {
      case "Welcome":
        this.deepgramReady = true;
        this.latencyMs.deepgram_welcome_ms = Date.now() - this.startedAt;
        this.sendDeepgram(settings);
        this.latencyMs.settings_sent_ms = Date.now() - this.startedAt;
        this.sendClient({ type: "gateway_status", status: "settings_sent" });
        break;
      case "SettingsApplied":
        this.settingsApplied = true;
        void this.updateVoiceSession("ready");
        this.sendClient({
          type: "gateway_status",
          status: "ready",
          sessionId: this.conversationId,
          conversationId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
        });
        break;
      case "FunctionCallRequest":
        this.markAgentActivity();
        this.latencyMs.first_tool_request_ms ??= Date.now() - this.startedAt;
        this.latencyMs.last_tool_request_ms = Date.now() - this.startedAt;
        if (this.lastUserTranscriptAt) {
          this.latencyMs.last_transcript_to_tool_request_ms = Date.now() - this.lastUserTranscriptAt;
        }
        void this.runner.handleFunctionCallRequest(event);
        break;
      case "UserStartedSpeaking":
      case "AgentAudioInterrupted":
        this.runner.onUserStartedSpeaking();
        break;
      case "AgentThinking":
      case "AgentStartedSpeaking":
        this.markAgentActivity();
        break;
      case "ConversationText": {
        const text = conversationText(event);
        if (!text) break;
        if (isUserRole(text.role)) this.runner.onUserTranscript(text.content);
        if (isUserRole(text.role) || isAssistantRole(text.role)) {
          if (isUserRole(text.role)) {
            this.latencyMs.first_transcript_ms ??= Date.now() - this.startedAt;
            this.latencyMs.last_user_transcript_ms = Date.now() - this.startedAt;
            this.lastUserTranscriptAt = Date.now();
            this.waitingAudioAfterUser = true;
            this.armNoResponseRecovery(text.content);
          } else if (isAssistantRole(text.role)) {
            this.markAgentActivity();
          }
          void this.persistMessage(text.role, text.content, event);
        }
        break;
      }
      case "Error":
      case "Warning":
        this.lastProviderEvent = sanitizeProviderEvent(event);
        this.sendClient({
          type: event.type === "Error" ? "gateway_error" : "gateway_warning",
          errorType: this.lastProviderEvent.errorType,
          error: this.lastProviderEvent.message,
          providerEvent: this.lastProviderEvent,
        });
        if (event.type === "Error") {
          void this.updateVoiceSession("error", {
            closeReason: this.lastProviderEvent.message,
            metadata: {
              providerLastEvent: this.lastProviderEvent,
            },
          });
        }
        break;
      default:
        break;
    }
  }

  markAgentActivity() {
    this.lastResponseActivityAt = Date.now();
    this.clearNoResponseRecovery();
  }

  clearNoResponseRecovery() {
    if (!this.noResponseRecoveryTimer) return;
    clearTimeout(this.noResponseRecoveryTimer);
    this.noResponseRecoveryTimer = null;
  }

  armNoResponseRecovery(text) {
    this.clearNoResponseRecovery();
    this.noResponseRecoveryCount = 0;
    const transcript = normalizeVoiceText(clean(text, 1600));
    if (!transcript) return;

    const runRecovery = () => {
      if (this.closed || !this.settingsApplied || !isOpen(this.deepgram)) return;
      if (!this.lastUserTranscriptAt || this.lastResponseActivityAt >= this.lastUserTranscriptAt) return;

      this.noResponseRecoveryCount += 1;
      if (this.noResponseRecoveryCount === 1) {
        this.latencyMs.last_silent_transcript_reinject_ms = Date.now() - this.startedAt;
        this.sendDeepgram({ type: "InjectUserMessage", message: transcript });
        this.sendClient({
          type: "gateway_warning",
          errorType: "voice_recovery",
          error: "O comando foi ouvido, mas o agente demorou para responder. Reenviei a fala para manter a conversa.",
        });
        this.noResponseRecoveryTimer = setTimeout(runRecovery, 8500);
        return;
      }

      this.latencyMs.last_silent_transcript_fallback_ms = Date.now() - this.startedAt;
      this.sendDeepgram({
        type: "InjectAgentMessage",
        message: "Estou te ouvindo, mas a resposta demorou mais que o normal. Pode repetir o comando de forma mais direta?",
        behavior: "queue",
      });
      this.noResponseRecoveryTimer = null;
    };

    this.noResponseRecoveryTimer = setTimeout(runRecovery, 6000);
  }

  markRunnerLatency(event, data = {}) {
    const now = Date.now();
    if (event === "tool_started") {
      this.latencyMs.last_tool_started_ms = now - this.startedAt;
      if (this.lastUserTranscriptAt) {
        this.latencyMs.last_transcript_to_tool_started_ms = now - this.lastUserTranscriptAt;
      }
      return;
    }
    if (event === "tool_completed") {
      this.latencyMs.last_tool_completed_ms = now - this.startedAt;
      this.latencyMs.last_tool_duration_ms = Math.max(0, Number(data.durationMs || 0));
      return;
    }
    if (event === "function_response_sent") {
      this.lastFunctionResponseAt = now;
      this.waitingAudioAfterFunction = true;
      this.latencyMs.last_function_response_sent_ms = now - this.startedAt;
    }
  }

  async updateVoiceSession(status, extra = {}) {
    if (!this.voiceSessionId || !this.conversationId) return;
    const metadata = {
      provider: "deepgram-agent",
      runtime: "node-local",
      settingsApplied: this.settingsApplied,
      firstAudioByteSeen: this.firstAudioByteSeen,
      ...(this.lastProviderEvent ? { providerLastEvent: this.lastProviderEvent } : {}),
      ...(extra.metadata && typeof extra.metadata === "object" ? extra.metadata : {}),
    };
    const { metadata: _ignoredMetadata, ...rest } = extra;
    try {
      await fetch(`${getFunctionsUrl()}/synapse-voice-tool`, {
        method: "POST",
        headers: {
          Authorization: this.authorization,
          apikey: getSupabaseAnonKey(),
          "Content-Type": "application/json",
          "x-synapse-gateway-secret": getGatewaySecret(),
        },
        body: JSON.stringify({
          action: "update_voice_session",
          conversationId: this.conversationId,
          sessionId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
          status,
          latencyMs: this.latencyMs,
          ...rest,
          metadata,
        }),
      });
    } catch (error) {
      console.warn("[voice-agent-gateway] voice session update failed", error?.message || error);
    }
  }

  async invokeTool({ id, name, arguments: args, signal }) {
    const response = await fetch(`${getFunctionsUrl()}/synapse-voice-tool`, {
      method: "POST",
      headers: {
        Authorization: this.authorization,
        apikey: getSupabaseAnonKey(),
        "Content-Type": "application/json",
        "x-synapse-gateway-secret": getGatewaySecret(),
      },
      signal,
      body: JSON.stringify({
        action: "execute_tool",
        callId: id,
        sessionId: this.conversationId,
        conversationId: this.conversationId,
        voiceSessionId: this.voiceSessionId,
        name,
        arguments: args,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Falha na ferramenta ${name} (${response.status}).`);
    }
    return data;
  }

  persistMessage(role, content, event = {}) {
    const normalizedRole = isUserRole(role) ? "user" : isAssistantRole(role) ? "assistant" : "";
    const text = clean(content, 20000);
    if (!normalizedRole || !text || !this.conversationId || this.persistenceDisabled) return Promise.resolve();

    this.persistQueue = this.persistQueue.catch(() => undefined).then(async () => {
      const response = await fetch(`${getFunctionsUrl()}/synapse-voice-tool`, {
        method: "POST",
        headers: {
          Authorization: this.authorization,
          apikey: getSupabaseAnonKey(),
          "Content-Type": "application/json",
          "x-synapse-gateway-secret": getGatewaySecret(),
        },
        body: JSON.stringify({
          action: "persist_message",
          sessionId: this.conversationId,
          conversationId: this.conversationId,
          voiceSessionId: this.voiceSessionId,
          role: normalizedRole,
          content: text,
          origin: "deepgram_conversation_text",
          isFinal: true,
          confidence: typeof event?.confidence === "number" ? event.confidence : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (isFunctionNotFound(response, data)) {
          this.persistenceDisabled = true;
          console.warn("[voice-agent-gateway] persist disabled: synapse-voice-tool is not deployed.");
          return;
        }
        console.warn("[voice-agent-gateway] persist failed", data?.error || response.status);
      }
    });
    return this.persistQueue;
  }

  injectUserMessage(message) {
    const text = normalizeVoiceText(clean(message, 2000));
    if (!text) return;
    this.sendDeepgram({ type: "InjectUserMessage", message: text });
  }

  startKeepAlive() {
    clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = setInterval(() => {
      this.sendDeepgram({ type: "KeepAlive" });
    }, 8000);
  }

  handleClientMessage(data, isBinary) {
    if (isBinary) {
      if (this.settingsApplied) this.sendDeepgram(data, true);
      return;
    }

    const payload = parseJson(data);
    if (!payload) return;

    if (payload.type === "start") {
      this.start(payload).catch((error) => {
        this.sendClient({
          type: "gateway_error",
          errorType: gatewayErrorType(error),
          error: clean(error?.message || "Não foi possível iniciar voz.", 1000),
        });
        void this.updateVoiceSession("error", { closeReason: error?.message || "start_failed" });
        this.close();
      });
      return;
    }

    if (payload.type === "inject_user_message") {
      this.injectUserMessage(payload.message);
      return;
    }

    if (payload.type === "update_speak" && payload.speak) {
      this.sendDeepgram({ type: "UpdateSpeak", speak: payload.speak });
      return;
    }

    if (payload.type === "update_think" && payload.think) {
      this.sendDeepgram({ type: "UpdateThink", think: payload.think });
      return;
    }

    if (payload.type === "stop") {
      this.close();
    }
  }

  closeDeepgram() {
    if (isOpen(this.deepgram)) this.deepgram.close(1000, "client_closed");
    this.deepgram = null;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.keepAliveTimer);
    this.clearNoResponseRecovery();
    void this.updateVoiceSession(this.settingsApplied ? "ended" : "cancelled", { closeReason: "client_closed" });
    this.closeDeepgram();
    if (isOpen(this.client)) this.client.close(1000, "session_closed");
  }
}

assertGatewayConfiguration();

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === `${PATHNAME}/health`) {
    jsonResponse(res, 200, {
      ok: true,
      service: "synapse-voice-agent-gateway",
      path: PATHNAME,
      voicePath: "deepgram-agent-nvidia-byo-elevenlabs",
      deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY),
      nvidiaVoiceConfigured: Boolean(getNvidiaVoiceApiKey()),
      voiceLlmProvider: voiceLlmProviderType(),
      voiceLlmModel: voiceLlmModel(),
      voiceLlmEndpointConfigured: Boolean(voiceLlmEndpointUrl()),
      nvidiaThinking: nvidiaThinkingOff() ? "off" : "on",
      voiceThinkTemperature: voiceThinkTemperature(),
      voiceTtsModel: voiceTtsModelId(),
      voiceTtsVoiceId: voiceTtsVoiceId(),
      voiceTtsLanguageCode: voiceTtsLanguageCode(),
      elevenLabsConfigured: Boolean(getElevenLabsApiKey()),
      supabaseConfigured: Boolean(getSupabaseUrl() && getSupabaseAnonKey()),
      gatewaySecretConfigured: Boolean(getGatewaySecret()),
      missing: missingGatewayConfiguration(),
    });
    return;
  }
  jsonResponse(res, 404, { error: "Not found" });
});

const wss = new WebSocketServer({ server, path: PATHNAME });

wss.on("connection", (client) => {
  const session = new SynapseVoiceSession(client);
  client.on("message", (data, isBinary) => session.handleClientMessage(data, isBinary));
  client.on("close", () => session.close());
  client.on("error", () => session.close());
});

server.listen(PORT, () => {
  console.log(`[voice-agent-gateway] listening on ws://localhost:${PORT}${PATHNAME}`);
});
