import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const VOICE_RENDERER_PROMPT = `Você é o renderizador de fala do Synapse. Sua única tarefa é converter uma resposta técnica já pronta em uma fala curta, humana e natural em português brasileiro.

Regras obrigatórias:
- Preserve os fatos e a intenção. Não invente dados nem execute ações.
- Escreva como uma pessoa fala, não como um texto é lido.
- Use uma ou duas falas curtas, normalmente entre 8 e 45 palavras.
- Use pontuação para ritmo natural. Reticências podem ser usadas com moderação para uma pausa breve.
- Nunca use títulos, tópicos, markdown, listas, tabelas ou blocos de código.
- Nunca pronuncie rotas, caminhos, URLs, nomes de endpoints, nomes de tabelas, JSON, UUIDs, IDs ou códigos internos.
- Nunca diga palavras como rota, path, endpoint, UUID, JSON ou identificador técnico.
- Quando houver navegação, diga apenas algo natural como: "Certo, abri o prontuário" ou "Pronto, levei você até essa área".
- Quando houver muitos resultados, resuma os principais e pergunte se a pessoa quer ouvir os demais.
- Leia datas, horários, valores e percentuais como seriam ditos em uma conversa brasileira.
- Para uma confirmação, faça uma única pergunta direta e clara.
- Não acrescente saudações repetitivas, avisos técnicos ou explicações sobre o sistema.

Retorne somente a frase que será falada.`;

const escapeXml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const hardSanitize = (value: string) => value
  .replace(/```[\s\S]*?```/g, " ")
  .replace(/https?:\/\/\S+/gi, " ")
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, " ")
  .replace(/(?:\/?[a-zA-ZÀ-ÿ0-9_-]+){2,}\/[a-zA-ZÀ-ÿ0-9_/-]+/g, " essa área ")
  .replace(/\b(?:rota|path|endpoint|uuid|json|id interno|identificador interno)\b\s*[:=-]?\s*/gi, " ")
  .replace(/[*_#>`~{}]/g, " ")
  .replace(/\[|\]/g, " ")
  .replace(/^\s*[-•]\s*/gm, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 700);

const toSsmlBody = (text: string, voice: string) => {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((part) => escapeXml(part));

  const spoken = parts.join('<break time="190ms"/>');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR"><voice name="${escapeXml(voice)}"><prosody rate="-3%" pitch="-1%">${spoken}</prosody></voice></speak>`;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

async function renderConversationalText(rawText: string, groqKey: string) {
  const sanitizedInput = hardSanitize(rawText);
  if (!sanitizedInput) return "Pronto. A ação foi concluída.";

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("GROQ_VOICE_RENDER_MODEL") || Deno.env.get("GROQ_CHAT_MODEL") || "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: VOICE_RENDERER_PROMPT },
          { role: "user", content: sanitizedInput },
        ],
        temperature: 0.45,
        max_completion_tokens: 180,
      }),
    });

    if (!response.ok) return sanitizedInput;
    const payload = await response.json().catch(() => null);
    const rendered = payload?.choices?.[0]?.message?.content;
    return hardSanitize(typeof rendered === "string" ? rendered : sanitizedInput) || sanitizedInput;
  } catch (error) {
    console.warn("[synapse-voice-speak] renderer fallback", error);
    return sanitizedInput;
  }
}

async function synthesizeWithAzure({
  endpoint,
  key,
  spokenText,
  voices,
}: {
  endpoint: string;
  key: string;
  spokenText: string;
  voices: string[];
}) {
  let lastStatus = 500;
  let lastDetail = "";

  for (const voice of voices) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
        "User-Agent": "NeuroNex-Synapse-Voice",
      },
      body: toSsmlBody(spokenText, voice),
    });

    if (response.ok) {
      return {
        audioBuffer: await response.arrayBuffer(),
        voice,
      };
    }

    lastStatus = response.status;
    lastDetail = await response.text().catch(() => "");
    console.warn("[synapse-voice-speak] Azure voice rejected", voice, response.status, lastDetail);

    if (![400, 404].includes(response.status)) break;
  }

  throw new Error(`Azure Speech HTTP ${lastStatus}: ${lastDetail || "síntese indisponível"}`);
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

    const payload = await req.json().catch(() => ({}));
    const rawText = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!rawText) return jsonResponse({ error: "Texto ausente" }, 400);
    if (rawText.length > 6000) return jsonResponse({ error: "Texto excede o limite" }, 413);

    const azureKey = Deno.env.get("AZURE_SPEECH_KEY");
    const azureRegion = (Deno.env.get("AZURE_SPEECH_REGION") || "brazilsouth").trim().toLowerCase();
    const preferredVoice = Deno.env.get("AZURE_SPEECH_VOICE")?.trim();
    const groqKey = Deno.env.get("GROQ_API_KEY");

    if (!azureKey) return jsonResponse({ error: "AZURE_SPEECH_KEY não configurada" }, 503);
    if (!groqKey) return jsonResponse({ error: "GROQ_API_KEY não configurada" }, 503);

    const spokenText = await renderConversationalText(rawText, groqKey);
    const endpoint = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const voices = Array.from(new Set([
      preferredVoice,
      "pt-BR-ThalitaMultilingualNeural",
      "pt-BR-ThalitaNeural",
      "pt-BR-AntonioNeural",
    ].filter(Boolean))) as string[];

    const { audioBuffer, voice } = await synthesizeWithAzure({
      endpoint,
      key: azureKey,
      spokenText,
      voices,
    });

    return jsonResponse({
      spokenText,
      audioBase64: arrayBufferToBase64(audioBuffer),
      mimeType: "audio/mpeg",
      provider: "azure-speech",
      voice,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[synapse-voice-speak]", message);
    return jsonResponse({ error: "Não foi possível gerar a voz neural.", detail: message }, 502);
  }
});
