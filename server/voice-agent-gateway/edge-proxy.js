import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

loadLocalEnv();

const PORT = Number(process.env.SYNAPSE_VOICE_GATEWAY_PORT || process.env.PORT || "8789");
const PATHNAME = process.env.SYNAPSE_VOICE_GATEWAY_PATH || "/v1/synapse/voice";

const clean = (value, max = 2000) => String(value ?? "").trim().slice(0, max);

function getSupabaseUrl() {
  return clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, 1000);
}

function remoteGatewayUrl() {
  const explicit = clean(process.env.SYNAPSE_VOICE_REMOTE_GATEWAY_URL, 1000);
  if (explicit) return explicit;

  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) return "";
  try {
    const url = new URL(supabaseUrl);
    url.protocol = "wss:";
    url.pathname = "/functions/v1/synapse-voice-gateway";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

const REMOTE_GATEWAY_URL = remoteGatewayUrl();
if (!REMOTE_GATEWAY_URL) {
  console.error("[voice-agent-gateway] SUPABASE_URL/VITE_SUPABASE_URL ausente; não foi possível resolver o gateway Edge remoto.");
  process.exit(1);
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function exactArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return data;
}

function pcm16Stats(data) {
  const bytes = Buffer.isBuffer(data)
    ? data
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : ArrayBuffer.isView(data)
        ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        : null;
  if (!bytes || bytes.byteLength < 2) return { rms: 0, peak: 0 };

  let sumSquares = 0;
  let peak = 0;
  let samples = 0;
  for (let offset = 0; offset + 1 < bytes.byteLength; offset += 2) {
    const sample = bytes.readInt16LE(offset);
    const normalized = sample / 32768;
    sumSquares += normalized * normalized;
    peak = Math.max(peak, Math.abs(normalized));
    samples += 1;
  }
  return {
    rms: samples ? Math.sqrt(sumSquares / samples) : 0,
    peak,
  };
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === `${PATHNAME}/health`) {
    jsonResponse(res, 200, {
      ok: true,
      service: "synapse-voice-agent-gateway-local-proxy",
      runtime: "node-local-edge-proxy",
      path: PATHNAME,
      remoteGatewayConfigured: Boolean(REMOTE_GATEWAY_URL),
      remoteGatewayHost: (() => {
        try {
          return new URL(REMOTE_GATEWAY_URL).host;
        } catch {
          return "";
        }
      })(),
      canonicalRuntime: "supabase-edge",
    });
    return;
  }
  jsonResponse(res, 404, { error: "Not found" });
});

const wss = new WebSocketServer({ server, path: PATHNAME });

wss.on("connection", (client) => {
  const upstream = new WebSocket(REMOTE_GATEWAY_URL);
  const pending = [];
  let closed = false;
  let clientBinaryFrames = 0;
  let clientBinaryBytes = 0;
  let maxInputRms = 0;
  let maxInputPeak = 0;
  let speechLogged = false;

  const closeBoth = (code = 1000, reason = "proxy_closed") => {
    if (closed) return;
    closed = true;
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      try {
        upstream.close(code, reason);
      } catch {
        // Ignore close races.
      }
    }
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.close(code, reason);
      } catch {
        // Ignore close races.
      }
    }
  };

  upstream.on("open", () => {
    console.log("[voice-agent-gateway] Edge gateway conectado", {
      remoteHost: new URL(REMOTE_GATEWAY_URL).host,
      queuedFrames: pending.length,
    });
    while (pending.length && upstream.readyState === WebSocket.OPEN) {
      const frame = pending.shift();
      upstream.send(frame.isBinary ? exactArrayBuffer(frame.data) : frame.data, { binary: frame.isBinary });
    }
  });

  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  upstream.on("error", (error) => {
    console.error("[voice-agent-gateway] falha no proxy para o Edge gateway", {
      message: clean(error?.message || error, 500),
    });
    closeBoth(1011, "edge_gateway_error");
  });

  upstream.on("close", (code, reason) => {
    console.log("[voice-agent-gateway] Edge gateway encerrado", {
      code,
      reason: clean(reason?.toString(), 120),
      clientBinaryFrames,
      clientBinaryBytes,
      maxInputRms: Number(maxInputRms.toFixed(5)),
      maxInputPeak: Number(maxInputPeak.toFixed(5)),
    });
    if (client.readyState === WebSocket.OPEN) {
      client.close(code >= 1000 && code <= 4999 ? code : 1011, clean(reason?.toString(), 120) || "edge_gateway_closed");
    }
    closed = true;
  });

  client.on("message", (data, isBinary) => {
    const outbound = isBinary ? exactArrayBuffer(data) : data;
    if (isBinary) {
      const bytes = Number(data?.byteLength ?? data?.length ?? 0);
      const stats = pcm16Stats(data);
      clientBinaryFrames += 1;
      clientBinaryBytes += Number.isFinite(bytes) ? bytes : 0;
      maxInputRms = Math.max(maxInputRms, stats.rms);
      maxInputPeak = Math.max(maxInputPeak, stats.peak);
      if (clientBinaryFrames === 1) {
        console.log("[voice-agent-gateway] primeiro frame PCM do microfone recebido", {
          bytes,
          rms: Number(stats.rms.toFixed(5)),
          peak: Number(stats.peak.toFixed(5)),
          forwardedAs: outbound instanceof ArrayBuffer ? "ArrayBuffer" : typeof outbound,
        });
      }
      if (!speechLogged && stats.rms >= 0.01 && stats.peak >= 0.03) {
        speechLogged = true;
        console.log("[voice-agent-gateway] fala detectada no PCM do microfone", {
          frame: clientBinaryFrames,
          rms: Number(stats.rms.toFixed(5)),
          peak: Number(stats.peak.toFixed(5)),
        });
      }
    }

    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(outbound, { binary: isBinary });
      return;
    }
    if (upstream.readyState === WebSocket.CONNECTING) {
      pending.push({ data: outbound, isBinary });
      if (pending.length > 256) closeBoth(1013, "proxy_queue_overflow");
    }
  });

  client.on("close", () => closeBoth(1000, "client_closed"));
  client.on("error", () => closeBoth(1011, "client_error"));
});

server.listen(PORT, () => {
  console.log(`[voice-agent-gateway] local proxy listening on ws://localhost:${PORT}${PATHNAME}`);
  console.log("[voice-agent-gateway] canonical runtime: Supabase Edge synapse-voice-gateway");
});
