import {
  buildAzureSpeechSsml,
  DEFAULT_AZURE_SPEECH_STYLE,
  DEFAULT_AZURE_SPEECH_VOICE,
  parseOpenAiSpeechRequest,
} from "../_shared/azure-speech-tts.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-synapse-tts-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

function secretsMatch(received: string, expected: string) {
  if (!received || !expected || received.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < received.length; index += 1) {
    mismatch |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const expectedSecret = clean(Deno.env.get("SYNAPSE_VOICE_TTS_ADAPTER_SECRET"), 8000);
  const receivedSecret = clean(request.headers.get("x-synapse-tts-secret"), 8000);
  if (!secretsMatch(receivedSecret, expectedSecret)) {
    return json({ error: "Não autorizado." }, 401);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return json({ error: "Solicitação de voz muito grande." }, 413);
  }

  const speechKey = clean(Deno.env.get("AZURE_SPEECH_KEY"), 8000);
  const region = clean(Deno.env.get("AZURE_SPEECH_REGION") || "brazilsouth", 80).toLowerCase();
  const voice = clean(Deno.env.get("AZURE_SPEECH_VOICE") || DEFAULT_AZURE_SPEECH_VOICE, 160);
  const style = clean(Deno.env.get("AZURE_SPEECH_STYLE") || DEFAULT_AZURE_SPEECH_STYLE, 40);
  if (!speechKey || !/^[a-z0-9-]+$/.test(region)) {
    return json({ error: "Azure Speech não está configurado." }, 503);
  }

  try {
    const body = parseOpenAiSpeechRequest(await request.json());
    const ssml = buildAzureSpeechSsml({ input: body.input, voice, style, speed: body.speed });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let azureResponse: Response;
    try {
      azureResponse = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm",
          "User-Agent": "NeuroNex-Synapse-Voice",
        },
        body: ssml,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!azureResponse.ok || !azureResponse.body) {
      const upstreamMessage = clean(await azureResponse.text().catch(() => ""), 500);
      console.error("[synapse-voice-azure-tts] Azure Speech failed", {
        status: azureResponse.status,
        requestId: azureResponse.headers.get("x-requestid"),
        message: upstreamMessage,
      });
      return json({ error: "A síntese principal não respondeu.", upstreamStatus: azureResponse.status }, 502);
    }

    const headers = new Headers({
      ...CORS,
      "Content-Type": "audio/pcm",
      "Cache-Control": "no-store",
      "X-Synapse-TTS-Provider": "azure-speech",
    });
    const responseLength = azureResponse.headers.get("content-length");
    if (responseLength) headers.set("Content-Length", responseLength);
    return new Response(azureResponse.body, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sintetizar a voz.";
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error("[synapse-voice-azure-tts] request failed", { message, isTimeout });
    return json({ error: isTimeout ? "Tempo limite da síntese excedido." : message }, isTimeout ? 504 : 400);
  }
});
