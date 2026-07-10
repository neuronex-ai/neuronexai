const { spawn } = require("node:child_process");
const path = require("node:path");

const viteBin = path.resolve(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const viteArgs = process.argv
  .slice(2)
  .map((arg) => String(arg || "").replace(/^['"]|['"]$/g, ""))
  .filter(Boolean);

const children = [];

function startProcess(label, args, { required }) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  child.__label = label;
  child.__required = required;
  child.on("error", (error) => {
    console.error(`[dev:${label}] failed to start: ${error.message}`);
    if (required) {
      process.exitCode = 1;
      stopAll("SIGTERM");
    }
  });
  children.push(child);
  return child;
}

startProcess("vite", [viteBin, ...viteArgs], { required: true });
startProcess("voice", ["scripts/start-voice-gateway-dev.cjs"], { required: false });

let shuttingDown = false;

function stopAll(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal || "SIGTERM");
  }
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (child.__required) {
      stopAll(signal || "SIGTERM");
      if (code && code !== 0) process.exitCode = code;
      return;
    }
    if (code && code !== 0) {
      console.warn(`[dev:${child.__label}] exited with code ${code}. Preview remains available; voice local gateway is not running.`);
    }
  });
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
