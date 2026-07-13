const fs = require("node:fs");
const path = require("node:path");
const { WebSocket } = require("ws");

for (const file of [".env.local", ".env"]) {
  const fullPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

const required = ["DEEPGRAM_API_KEY", "VITE_SUPABASE_URL", "SYNAPSE_VOICE_TTS_ADAPTER_SECRET"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Configuração ausente: ${missing.join(", ")}`);
  process.exit(1);
}

const adapterUrl = `${process.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/synapse-voice-azure-tts`;
const prompt = [
  "Você é o Synapse AI da NeuroNex.",
  "Responda sempre em português brasileiro, em uma frase curta e natural.",
  "Não mencione infraestrutura nem fornecedores.",
].join(" ");

const think = (provider) => ({ provider, prompt, functions: [] });
const settings = {
  type: "Settings",
  experimental: true,
  flags: { history: false },
  audio: {
    input: { encoding: "linear16", sample_rate: 48000 },
    output: { encoding: "linear16", sample_rate: 24000, container: "none" },
  },
  agent: {
    listen: {
      provider: {
        type: "deepgram",
        version: "v2",
        model: "flux-general-multi",
        language_hints: ["pt"],
      },
    },
    think: [
      // Deepgram currently sends managed tool calls through Chat Completions.
      // GPT-5.4 Mini only supports function tools there with reasoning_effort=none.
      think({ type: "open_ai", model: "gpt-5.4-mini" }),
      think({ type: "google", model: "gemini-3.5-flash", temperature: 0.25 }),
      think({ type: "anthropic", model: "claude-haiku-4-5", temperature: 0.25 }),
    ],
    speak: [
      {
        provider: {
          type: "open_ai",
          model: "tts-1",
          voice: "alloy",
        },
        endpoint: {
          url: adapterUrl,
          headers: { "x-synapse-tts-secret": process.env.SYNAPSE_VOICE_TTS_ADAPTER_SECRET },
        },
      },
      {
        provider: {
          type: "cartesia",
          model_id: "sonic-2",
          voice: { mode: "id", id: "a167e0f3-df7e-4d52-a9c3-f949145efdab" },
          speed: "normal",
        },
      },
    ],
  },
};

const startedAt = Date.now();
const result = {
  settingsAppliedMs: null,
  firstAssistantTextMs: null,
  firstAudioMs: null,
  assistantText: "",
  audioBytes: 0,
  warnings: [],
  latencyReports: [],
};

let finished = false;
const ws = new WebSocket("wss://agent.deepgram.com/v1/agent/converse", {
  headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
});

const timeout = setTimeout(() => finish(new Error("Tempo limite do teste de voz excedido.")), 35_000);

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();

  if (!error && (!result.assistantText || result.audioBytes < 1000)) {
    error = new Error("A cadeia não produziu texto e áudio suficientes.");
  }
  const summary = {
    ok: !error,
    settingsAppliedMs: result.settingsAppliedMs,
    firstAssistantTextMs: result.firstAssistantTextMs,
    firstAudioMs: result.firstAudioMs,
    assistantText: result.assistantText,
    audioBytes: result.audioBytes,
    warnings: result.warnings,
    latencyReports: result.latencyReports,
    error: error?.message || null,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = error ? 1 : 0;
}

ws.on("message", (data, isBinary) => {
  if (isBinary) {
    result.audioBytes += data.length;
    if (result.firstAudioMs === null) result.firstAudioMs = Date.now() - startedAt;
    return;
  }

  let event;
  try {
    event = JSON.parse(data.toString("utf8"));
  } catch {
    return;
  }

  if (event.type === "Welcome") {
    ws.send(JSON.stringify(settings));
    return;
  }
  if (event.type === "SettingsApplied") {
    result.settingsAppliedMs = Date.now() - startedAt;
    ws.send(JSON.stringify({
      type: "InjectUserMessage",
      content: "Cumprimente-me e confirme em uma frase que consegue responder por voz.",
    }));
    return;
  }
  if (event.type === "ConversationText" && ["assistant", "agent", "ai"].includes(String(event.role || "").toLowerCase())) {
    result.assistantText = String(event.content || event.text || event.message || "").trim();
    if (result.firstAssistantTextMs === null) result.firstAssistantTextMs = Date.now() - startedAt;
    return;
  }
  if (event.type === "Warning") {
    result.warnings.push({ code: event.code, description: event.description });
    return;
  }
  if (event.type === "LatencyReport") {
    result.latencyReports.push(event);
    return;
  }
  if (event.type === "Error") {
    finish(new Error(`${event.code || "VOICE_ERROR"}: ${event.description || event.message || "Erro do provedor"}`));
    return;
  }
  if (event.type === "AgentAudioDone") finish();
});

ws.on("error", (error) => finish(error));
ws.on("close", () => {
  if (!finished) finish(new Error("A conexão foi encerrada antes do fim do teste."));
});
