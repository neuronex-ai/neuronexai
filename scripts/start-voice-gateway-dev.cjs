const http = require("node:http");
const { spawn } = require("node:child_process");

const port = Number(process.env.SYNAPSE_VOICE_GATEWAY_PORT || process.env.PORT || "8789");

function checkHealth() {
  return new Promise((resolve) => {
    const request = http.get(`http://localhost:${port}/health`, { timeout: 1500 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 500) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ ok: true });
        }
      });
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

(async () => {
  if (process.argv.includes("--local")) {
    console.error("[voice-agent-gateway] --local foi removido. O Synapse de voz tem somente o caminho Deepgram Agent + ElevenLabs.");
    process.exit(1);
  }

  const health = await checkHealth();
  if (health) {
    const missing = Array.isArray(health.missing)
      ? health.missing
      : [
          health.deepgramConfigured === false ? "DEEPGRAM_API_KEY" : "",
          health.supabaseConfigured === false ? "SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY" : "",
          health.gatewaySecretConfigured === false ? "SYNAPSE_VOICE_GATEWAY_SECRET" : "",
        ].filter(Boolean);
    if (missing.length) {
      console.error(`[voice-agent-gateway] ja existe um gateway em http://localhost:${port}, mas ele esta sem: ${missing.join(", ")}.`);
      console.error("[voice-agent-gateway] pare esse processo antigo e reinicie o dev server com as secrets server-side corretas.");
      process.exit(1);
    }
    console.log(`[voice-agent-gateway] already running on ws://localhost:${port}/v1/synapse/voice`);
    console.log("[voice-agent-gateway] reusing existing process; stop it before restarting with new env values.");
    setInterval(() => undefined, 2 ** 30);
    return;
  }

  const child = spawn(process.execPath, ["server/voice-agent-gateway/index.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
})();
