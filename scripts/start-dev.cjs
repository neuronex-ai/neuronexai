const { spawn } = require("node:child_process");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const viteArgs = process.argv.slice(2);

const children = [
  spawn(npmCommand, ["run", "dev:web", "--", ...viteArgs], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  }),
  spawn(npmCommand, ["run", "voice:gateway"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  }),
];

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
    stopAll(signal || "SIGTERM");
    if (code && code !== 0) process.exitCode = code;
  });
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
