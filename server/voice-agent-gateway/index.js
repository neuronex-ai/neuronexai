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
const MANAGED_THINK_MODELS = new Set([
  "open_ai:gpt-5.4-mini",
  "google:gemini-3.5-flash",
  "anthropic:claude-haiku-4-5",
]);
const MAX_VOICE_FUNCTIONS = 16;

const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);

function envFlag(name, fallback = false) {
  const value = clean(process.env[name], 40).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

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

function missingGatewayConfiguration() {
  return [
    !process.env.DEEPGRAM_API_KEY ? "DEEPGRAM_API_KEY" : "",
    !getSupabaseUrl() ? "SUPABASE_URL ou VITE_SUPABASE_URL" : "",
    !getSupabaseAnonKey() ? "SUPABASE_ANON_KEY ou VITE_SUPABASE_ANON_KEY" : "",
    !getGatewaySecret() ? "SYNAPSE_VOICE_GATEWAY_SECRET" : "",
  ].filter(Boolean);
}

function assertGatewayConfiguration() {
  const missing = missingGatewayConfiguration();
  if (!missing.length) return;
  console.error("[voice-agent-gateway] configuracao obrigatoria ausente:", missing.join(", "));
  console.error("[voice-agent-gateway] o Synapse de voz usa provedores gerenciados pela Deepgram e Azure Speech.");
  process.exit(1);
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
  if (/sessao|token|auth|unauthorized|401|403|jwt|gateway nao autorizado/.test(text)) return "auth_error";
  if (/settings|config|api[_ -]?key|secret|supabase nao configurado|ausentes|missing/.test(text)) return "config_error";
  if (/deepgram|eleven|openai|nvidia|provider|websocket|socket|1005|failed_to_speak|failed_to_think/.test(text)) return "provider_error";
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

  const flags = settings.flags && typeof settings.flags === "object" ? settings.flags : {};
  settings.flags = flags;
  flags.history = envFlag("SYNAPSE_VOICE_HISTORY", true);

  const thinkChain = Array.isArray(agent.think) ? agent.think : [agent.think];
  if (!thinkChain.length || thinkChain.some((item) => !item || typeof item !== "object")) {
    throw new Error("Settings de voz inválidos: agent.think ausente.");
  }
  for (const think of thinkChain) {
    const thinkProvider = think.provider;
    if (!thinkProvider || typeof thinkProvider !== "object") {
      throw new Error("Settings de voz inválidos: provedor de raciocínio ausente.");
    }
    const providerKey = `${clean(thinkProvider.type, 40)}:${clean(thinkProvider.model, 120)}`;
    if (!MANAGED_THINK_MODELS.has(providerKey) || think.endpoint) {
      throw new Error("Settings de voz inválidos: apenas LLMs gerenciados aprovados são permitidos.");
    }
    if (!clean(think.prompt, 8000)) throw new Error("Settings de voz inválidos: prompt ausente.");
    if (!Array.isArray(think.functions) || think.functions.length > MAX_VOICE_FUNCTIONS) {
      throw new Error("Settings de voz inválidos: conjunto de ferramentas excede o núcleo permitido.");
    }
  }
  agent.think = thinkChain;

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

  const speakChain = Array.isArray(agent.speak) ? agent.speak : [agent.speak];
  if (speakChain.length !== 2 || speakChain.some((item) => !item || typeof item !== "object")) {
    throw new Error("Settings de voz inválidos: cadeia Azure/Cartesia ausente.");
  }
  const [azureSpeak, fallbackSpeak] = speakChain;
  const azureProvider = azureSpeak.provider;
  const azureEndpoint = azureSpeak.endpoint;
  const azureHeaders = azureEndpoint?.headers;
  if (
    azureProvider?.type !== "open_ai" ||
    !clean(azureEndpoint?.url, 1000).includes("/functions/v1/synapse-voice-azure-tts") ||
    !clean(azureHeaders?.["x-synapse-tts-secret"], 8000)
  ) {
    throw new Error("Settings de voz inválidos: adaptador Azure Speech incompleto.");
  }
  if (fallbackSpeak?.provider?.type !== "cartesia" || fallbackSpeak.endpoint) {
    throw new Error("Settings de voz inválidos: fallback Cartesia gerenciado ausente.");
  }
  agent.speak = speakChain;

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
    this.lastProviderEvent = null;
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
    const primaryThink = Array.isArray(settings.agent.think) ? settings.agent.think[0] : settings.agent.think;
    const primarySpeak = Array.isArray(settings.agent.speak) ? settings.agent.speak[0] : settings.agent.speak;

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
      ttsProvider: sessionConfig.ttsProvider || primarySpeak?.provider?.type,
      functionsCount: Array.isArray(primaryThink?.functions) ? primaryThink.functions.length : 0,
      azureTtsAdapterConfigured: Boolean(primarySpeak?.endpoint?.url),
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
      thinkProvider: primaryThink?.provider?.type,
      thinkModel: primaryThink?.provider?.model,
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
        systemInstruction: clean(payload.systemInstruction, 600),
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

    if (payload.type === "client_action_result") {
      this.runner.handleClientActionResult(payload);
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

assertGatewayConfiguration();

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === `${PATHNAME}/health`) {
    jsonResponse(res, 200, {
      ok: true,
      service: "synapse-voice-agent-gateway",
      path: PATHNAME,
      voicePath: "deepgram-managed-gpt54mini-azure-speech-cartesia-fallback",
      thinkPrimary: "open_ai/gpt-5.4-mini",
      thinkFallback: "google/gemini-3.5-flash",
      thinkLastResort: "anthropic/claude-haiku-4-5",
      speakPrimary: "azure-speech",
      speakFallback: "deepgram-managed-cartesia",
      deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY),
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
