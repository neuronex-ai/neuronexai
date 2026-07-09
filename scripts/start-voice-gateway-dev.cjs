const http = require("node:http");
const { spawn } = require("node:child_process");

const forceLocal = process.argv.includes("--local");
const port = Number(process.env.SYNAPSE_VOICE_GATEWAY_PORT || process.env.PORT || "8789");

function checkHealth() {
  return new Promise((resolve) => {
    const request = http.get(`http://localhost:${port}/health`, { timeout: 1500 }, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

(async () => {
  if (await checkHealth()) {
    console.log(`[voice-agent-gateway] already running on ws://localhost:${port}/v1/synapse/voice`);
    console.log("[voice-agent-gateway] reusing existing process; stop it before restarting with new env values.");
    setInterval(() => undefined, 2 ** 30);
    return;
  }

  const child = spawn(process.execPath, ["server/voice-agent-gateway/index.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      ...(forceLocal ? { SYNAPSE_VOICE_FORCE_LOCAL_SETTINGS: "true" } : {}),
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
})();
