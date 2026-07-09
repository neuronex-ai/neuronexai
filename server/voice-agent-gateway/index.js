import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { VoiceFunctionRunner } from "./function-runner.js";
import { isAssistantRole, isUserRole } from "./intent.js";

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
const DEFAULT_DEEPGRAM_THINK_PROVIDER = "nvidia";
const DEFAULT_DEEPGRAM_THINK_MODEL = "nemotron-3-nano-30B-A3B";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_VOICE_ID = "UgBBYS2sOqTuMpoF3BR0";

const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);
const newId = () => globalThis.crypto?.randomUUID?.() || `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

function isFunctionNotFound(response, data) {
  const code = clean(data?.code || data?.error_code || data?.sb_error_code, 120).toUpperCase();
  const message = clean(data?.message || data?.error, 500).toLowerCase();
  return response.status === 404 || code === "NOT_FOUND" || /function was not found|fun[cç][aã]o.*n[aã]o.*encontrada/.test(message);
}

function edgeFunctionMissingMessage(functionName) {
  return [
    `Edge Function ${functionName} nao esta deployada no projeto Supabase configurado.`,
    "Deploy necessario: supabase functions deploy synapse-voice-agent-session synapse-voice-tool --project-ref krewdaklcyzqfxkkgvqr.",
    "Enquanto isso, use SYNAPSE_VOICE_FORCE_LOCAL_SETTINGS=true apenas para diagnostico local sem tools reais.",
  ].join(" ");
}

function parseJson(data) {
  try {
    return JSON.parse(data.toString("utf8"));
  } catch {
    return null;
  }
}

function parseJsonEnv(name) {
  const raw = clean(process.env[name], 5000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    throw new Error(`${name} deve ser um JSON valido.`);
  }
}

function isOpen(ws) {
  return ws && ws.readyState === WebSocket.OPEN;
}

function normalizeThinkModel(provider, model) {
  const cleanProvider = clean(provider, 80).toLowerCase();
  const cleanModel = clean(model, 160);
  if (cleanProvider !== "nvidia") return cleanModel || DEFAULT_DEEPGRAM_THINK_MODEL;
  if (/^nvidia\/nemotron-3-nano-30b-a3b$/i.test(cleanModel)) return DEFAULT_DEEPGRAM_THINK_MODEL;
  if (/^nemotron-3-nano-30b-a3b$/i.test(cleanModel)) return DEFAULT_DEEPGRAM_THINK_MODEL;
  return cleanModel || DEFAULT_DEEPGRAM_THINK_MODEL;
}

function conversationText(event) {
  const role = clean(event?.role || event?.speaker || event?.channel?.role, 40);
  const content = clean(event?.content || event?.text || event?.transcript || event?.message, 20000);
  if (!content) return null;
  return { role, content };
}

function buildLocalSpeak() {
  const ttsProvider = clean(process.env.SYNAPSE_VOICE_TTS_PROVIDER || "deepgram-elevenlabs", 80).toLowerCase();
  const speakProviderOverride = parseJsonEnv("SYNAPSE_VOICE_SPEAK_PROVIDER_JSON");
  if (speakProviderOverride) {
    return {
      speak: { provider: speakProviderOverride },
      ttsProvider: `deepgram-managed-${clean(speakProviderOverride.type || "custom", 80)}`,
      ttsVoice: clean(speakProviderOverride.voice || speakProviderOverride.voice_id || speakProviderOverride.model_id || speakProviderOverride.model, 160),
    };
  }

  if (ttsProvider === "deepgram-elevenlabs" || ttsProvider === "eleven_labs") {
    const modelId = process.env.DEEPGRAM_ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID;
    const voiceId = process.env.DEEPGRAM_ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID;
    return {
      speak: {
        provider: {
          type: "eleven_labs",
          model_id: modelId,
          voice_id: voiceId,
          language_code: process.env.DEEPGRAM_ELEVENLABS_LANGUAGE_CODE || "pt-BR",
        },
      },
      ttsProvider: "deepgram-managed-elevenlabs",
      ttsVoice: voiceId,
    };
  }

  const cartesiaVoiceId =
    process.env.CARTESIA_VOICE_ID ||
    process.env.DEEPGRAM_CARTESIA_VOICE_ID ||
    "a167e0f3-df7e-4d52-a9c3-f949145efdab";

  return {
    speak: {
      provider: {
        type: "cartesia",
        model_id: process.env.CARTESIA_MODEL_ID || "sonic-2",
        language: process.env.CARTESIA_LANGUAGE || "pt-BR",
        voice: {
          mode: "id",
          id: cartesiaVoiceId,
        },
        speed: process.env.CARTESIA_SPEED || "normal",
      },
    },
    ttsProvider: "deepgram-managed-cartesia",
    ttsVoice: cartesiaVoiceId,
  };
}

function buildLocalSpeakConfig() {
  return buildLocalSpeak().speak;
}

function buildLocalAgentSettings(payload) {
  const listenModel = process.env.DEEPGRAM_LISTEN_MODEL || "flux-general-multi";
  const listenProvider = {
    type: "deepgram",
    version: listenModel.startsWith("flux-") ? "v2" : "v1",
    model: listenModel,
  };
  if (listenModel === "flux-general-multi") {
    listenProvider.language_hints = ["pt"];
    listenProvider.eot_threshold = Number(process.env.DEEPGRAM_EOT_THRESHOLD || "0.72");
    listenProvider.eager_eot_threshold = Number(process.env.DEEPGRAM_EAGER_EOT_THRESHOLD || "0.45");
    listenProvider.eot_timeout_ms = Number(process.env.DEEPGRAM_EOT_TIMEOUT_MS || "1200");
  } else if (listenModel.startsWith("flux-")) {
    listenProvider.eot_threshold = Number(process.env.DEEPGRAM_EOT_THRESHOLD || "0.72");
    listenProvider.eager_eot_threshold = Number(process.env.DEEPGRAM_EAGER_EOT_THRESHOLD || "0.45");
    listenProvider.eot_timeout_ms = Number(process.env.DEEPGRAM_EOT_TIMEOUT_MS || "1200");
  } else {
    listenProvider.language = process.env.DEEPGRAM_LISTEN_LANGUAGE || "pt-BR";
    listenProvider.smart_format = true;
  }

  const thinkProvider = process.env.DEEPGRAM_THINK_PROVIDER || DEFAULT_DEEPGRAM_THINK_PROVIDER;
  const thinkModel = normalizeThinkModel(thinkProvider, process.env.DEEPGRAM_THINK_MODEL || DEFAULT_DEEPGRAM_THINK_MODEL);
  const prompt = [
    "Voce e o Synapse, agente de voz da NeuroNex para psicologos.",
    "Fale em portugues brasileiro natural, curto e humano.",
    "Use frases breves, nao leia rotas, IDs, JSON, SQL, nomes de tabelas ou detalhes internos.",
    "Quando precisar consultar algo, aguarde o retorno real da ferramenta antes de responder conclusoes ao psicologo.",
    "O sistema de voz injeta mensagens curtas de progresso automaticamente enquanto ferramentas rodam; nao invente resultados.",
    clean(payload.systemInstruction, 1600),
  ].filter(Boolean).join("\n\n");

  return {
    type: "Settings",
    tags: ["neuronex", "synapse", "voice", "pt-BR", "local-gateway"],
    flags: { history: true },
    audio: {
      input: {
        encoding: "linear16",
        sample_rate: Number(process.env.SYNAPSE_VOICE_INPUT_SAMPLE_RATE || "16000"),
      },
      output: {
        encoding: "linear16",
        sample_rate: Number(process.env.SYNAPSE_VOICE_OUTPUT_SAMPLE_RATE || "24000"),
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
          temperature: Number(process.env.DEEPGRAM_THINK_TEMPERATURE || "0.35"),
        },
        prompt,
        functions: [],
      },
      speak: buildLocalSpeakConfig(),
    },
  };
}

function buildLocalSessionConfig(payload, reason) {
  const conversationId = clean(payload.conversationId || payload.sessionId, 120) || `voice-local-${Date.now()}`;
  const voiceSessionId = clean(payload.voiceSessionId, 120) || newId();
  const speak = buildLocalSpeak();
  return {
    provider: "deepgram-agent-local",
    sessionId: conversationId,
    conversationId,
    voiceSessionId,
    deepgramUrl: process.env.DEEPGRAM_AGENT_URL || DEFAULT_DEEPGRAM_URL,
    agentSettings: buildLocalAgentSettings(payload),
    model: normalizeThinkModel(
      process.env.DEEPGRAM_THINK_PROVIDER || DEFAULT_DEEPGRAM_THINK_PROVIDER,
      process.env.DEEPGRAM_THINK_MODEL || DEFAULT_DEEPGRAM_THINK_MODEL,
    ),
    voiceName: speak.ttsVoice,
    ttsProvider: speak.ttsProvider,
    functionsCount: 0,
    outputSampleRate: Number(process.env.SYNAPSE_VOICE_OUTPUT_SAMPLE_RATE || "24000"),
    localFallbackReason: reason,
  };
}

function gatewayErrorType(error) {
  const text = clean(error?.message || error, 1200).toLowerCase();
  if (/sessao|token|auth|unauthorized|401|403|gateway nao autorizado/.test(text)) return "auth_error";
  if (/settings|config|api[_ -]?key|secret|supabase nao configurado|ausentes|missing/.test(text)) return "config_error";
  if (/deepgram|eleven|cartesia|provider|websocket|socket|1005|failed_to_speak/.test(text)) return "provider_error";
  if (/tool|ferramenta/.test(text)) return "tool_error";
  if (/network|fetch|timeout|econn|gateway|503|502|504/.test(text)) return "network_error";
  if (/permiss|permission|ownership|rls/.test(text)) return "permission_error";
  return "voice_error";
}

function normalizeAgentSettings(settings) {
  const listenProvider = settings?.agent?.listen?.provider;
  if (!listenProvider || typeof listenProvider !== "object") return settings;

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
    this.runner = new VoiceFunctionRunner({
      sendDeepgram: (payload) => this.sendDeepgram(payload),
      sendClient: (payload) => this.sendClient(payload),
      invokeTool: (call) => this.invokeTool(call),
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
    if (!deepgramKey) throw new Error("DEEPGRAM_API_KEY nao configurada no gateway.");
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
    });

    await this.connectDeepgram(sessionConfig.deepgramUrl || DEFAULT_DEEPGRAM_URL, settings);
  }

  async fetchSessionConfig(payload) {
    if (process.env.SYNAPSE_VOICE_FORCE_LOCAL_SETTINGS === "true") {
      return buildLocalSessionConfig(payload, "forced_local_settings");
    }

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
          if (!this.firstAudioByteSeen) {
            this.firstAudioByteSeen = true;
            this.latencyMs.first_audio_byte_ms = Date.now() - this.startedAt;
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
        this.settingsApplied = false;
        void this.updateVoiceSession(wasSettled ? "ended" : "error", {
          closeCode: code,
          closeReason: reason?.toString?.() || "",
        });
        this.sendClient({
          type: "gateway_status",
          status: "deepgram_closed",
          code,
          reason: reason?.toString?.() || "",
        });
        if (!wasSettled) {
          const detail = reason?.toString?.() || `codigo ${code}`;
          settleFailure(new Error(`Conexao com a Deepgram encerrada antes de ficar pronta (${detail}).`));
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
        this.latencyMs.first_tool_request_ms ??= Date.now() - this.startedAt;
        void this.runner.handleFunctionCallRequest(event);
        break;
      case "UserStartedSpeaking":
      case "AgentAudioInterrupted":
        this.runner.onUserStartedSpeaking();
        break;
      case "ConversationText": {
        const text = conversationText(event);
        if (!text) break;
        if (isUserRole(text.role)) this.runner.onUserTranscript(text.content);
        if (isUserRole(text.role) || isAssistantRole(text.role)) {
          if (isUserRole(text.role)) this.latencyMs.first_transcript_ms ??= Date.now() - this.startedAt;
          void this.persistMessage(text.role, text.content, event);
        }
        break;
      }
      case "Error":
      case "Warning":
        this.sendClient({
          type: event.type === "Error" ? "gateway_error" : "gateway_warning",
          errorType: gatewayErrorType(event.description || event.message || event.error),
          error: clean(event.description || event.message || event.error, 1000),
          event,
        });
        break;
      default:
        break;
    }
  }

  async updateVoiceSession(status, extra = {}) {
    if (!this.voiceSessionId || !this.conversationId) return;
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
          metadata: {
            provider: "deepgram-agent",
            firstAudioByteSeen: this.firstAudioByteSeen,
          },
          ...extra,
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
    const text = clean(message, 2000);
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
          error: clean(error?.message || "Nao foi possivel iniciar voz.", 1000),
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
    void this.updateVoiceSession(this.settingsApplied ? "ended" : "cancelled", { closeReason: "client_closed" });
    this.closeDeepgram();
    if (isOpen(this.client)) this.client.close(1000, "session_closed");
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === `${PATHNAME}/health`) {
    jsonResponse(res, 200, {
      ok: true,
      service: "synapse-voice-agent-gateway",
      deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY),
      supabaseConfigured: Boolean(getSupabaseUrl() && getSupabaseAnonKey()),
      gatewaySecretConfigured: Boolean(getGatewaySecret()),
      forceLocalSettings: process.env.SYNAPSE_VOICE_FORCE_LOCAL_SETTINGS === "true",
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
