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
  const health = await checkHealth();
  if (health) {
    if (health.runtime !== "node-local-edge-proxy") {
      console.error(`[voice-agent-gateway] ja existe um gateway antigo em http://localhost:${port}.`);
      console.error("[voice-agent-gateway] pare esse processo e reinicie o dev server para usar o proxy do runtime Edge canônico.");
      process.exit(1);
    }
    console.log(`[voice-agent-gateway] local Edge proxy already running on ws://localhost:${port}/v1/synapse/voice`);
    setInterval(() => undefined, 2 ** 30);
    return;
  }

  const child = spawn(process.execPath, ["server/voice-agent-gateway/edge-proxy.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
})();
