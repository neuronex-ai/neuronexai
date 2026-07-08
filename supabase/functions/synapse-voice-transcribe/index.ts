import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
]);

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);
const legacyCascadeEnabled = () => Deno.env.get("SYNAPSE_ENABLE_LEGACY_CASCADE") === "true";
const legacyGroqFallbackEnabled = () => Deno.env.get("SYNAPSE_LEGACY_CASCADE_ALLOW_GROQ_STT") === "true";

const toDeepgramListenUrl = () => {
  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", Deno.env.get("DEEPGRAM_STT_MODEL") || "nova-3");
  url.searchParams.set("language", Deno.env.get("DEEPGRAM_STT_LANGUAGE") || "pt-BR");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("paragraphs", "false");
  url.searchParams.set("utterances", "true");
  url.searchParams.set("filler_words", Deno.env.get("DEEPGRAM_STT_FILLER_WORDS") || "false");
  return url.toString();
};

async function transcribeWithDeepgram(audio: File, apiKey: string) {
  const response = await fetch(toDeepgramListenUrl(), {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": audio.type || "application/octet-stream",
    },
    body: audio,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.err_msg || payload?.error || payload?.message || `Deepgram HTTP ${response.status}`;
    throw new Error(message);
  }

  const alternative = payload?.results?.channels?.[0]?.alternatives?.[0];
  const text = clean(alternative?.transcript || payload?.transcript || "", 12000);
  return {
    text,
    language: payload?.metadata?.language || Deno.env.get("DEEPGRAM_STT_LANGUAGE") || "pt-BR",
    duration: typeof payload?.metadata?.duration === "number" ? payload.metadata.duration : null,
    provider: "deepgram",
    model: Deno.env.get("DEEPGRAM_STT_MODEL") || "nova-3",
    confidence: typeof alternative?.confidence === "number" ? alternative.confidence : null,
  };
}

async function transcribeWithGroq(audio: File, apiKey: string) {
  const groqForm = new FormData();
  groqForm.append("file", audio, audio.name || "voice.webm");
  groqForm.append("model", Deno.env.get("GROQ_STT_MODEL") || "whisper-large-v3-turbo");
  groqForm.append("language", "pt");
  groqForm.append("response_format", "verbose_json");
  groqForm.append("temperature", "0");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: groqForm,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const providerMessage = payload?.error?.message || "Falha na transcrição de voz";
    throw new Error(providerMessage);
  }

  return {
    text: clean(payload?.text, 12000),
    language: payload?.language || "pt",
    duration: typeof payload?.duration === "number" ? payload.duration : null,
    provider: "groq",
    model: Deno.env.get("GROQ_STT_MODEL") || "whisper-large-v3-turbo",
    confidence: null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Token ausente" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return jsonResponse({ error: "Token inválido" }, 401);

    const incoming = await req.formData();
    if (!legacyCascadeEnabled()) {
      return jsonResponse({ error: "synapse-voice-transcribe esta isolado para legacy-cascade e desativado neste ambiente." }, 410);
    }

    const provider = clean(incoming.get("provider"), 80).toLowerCase();
    if (provider !== "legacy-cascade") {
      return jsonResponse({ error: "synapse-voice-transcribe aceita somente provider=legacy-cascade." }, 400);
    }

    const audio = incoming.get("audio");
    if (!(audio instanceof File)) return jsonResponse({ error: "Arquivo de áudio ausente" }, 400);
    if (audio.size === 0) return jsonResponse({ error: "Arquivo de áudio vazio" }, 400);
    if (audio.size > 20 * 1024 * 1024) return jsonResponse({ error: "Áudio excede o limite de 20 MB" }, 413);

    const normalizedType = audio.type.split(";")[0].toLowerCase();
    if (normalizedType && !allowedAudioTypes.has(normalizedType)) {
      return jsonResponse({ error: `Formato de áudio não suportado: ${normalizedType}` }, 415);
    }

    const deepgramKey = Deno.env.get("DEEPGRAM_API_KEY")?.trim();
    const groqKey = legacyGroqFallbackEnabled() ? Deno.env.get("GROQ_API_KEY")?.trim() : "";

    let result: Awaited<ReturnType<typeof transcribeWithDeepgram>> | Awaited<ReturnType<typeof transcribeWithGroq>> | null = null;
    let fallbackReason: string | null = null;

    if (deepgramKey) {
      try {
        result = await transcribeWithDeepgram(audio, deepgramKey);
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : "Deepgram indisponível";
        if (groqKey) {
          console.warn("[synapse-voice-transcribe] Deepgram failed; trying legacy Groq fallback", fallbackReason);
        }
      }
    }

    if (!result && groqKey) {
      result = await transcribeWithGroq(audio, groqKey);
    }

    if (!result) {
      return jsonResponse({
        error: legacyGroqFallbackEnabled()
          ? "Configure DEEPGRAM_API_KEY ou GROQ_API_KEY para transcricao legacy-cascade."
          : "Configure DEEPGRAM_API_KEY para transcricao legacy-cascade.",
      }, 503);
    }

    return jsonResponse({
      ...result,
      fallbackReason,
      primaryProvider: "deepgram",
      legacyCascade: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[synapse-voice-transcribe]", message);
    return jsonResponse({ error: message }, 500);
  }
});
