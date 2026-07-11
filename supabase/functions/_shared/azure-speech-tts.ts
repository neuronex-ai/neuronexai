export const DEFAULT_AZURE_SPEECH_VOICE = "pt-BR-MacerioMultilingualNeural";
export const DEFAULT_AZURE_SPEECH_STYLE = "none";
export const MAX_AZURE_TTS_INPUT_LENGTH = 2000;

export interface OpenAiSpeechRequest {
  input: string;
  model?: string;
  voice?: string;
  response_format?: string;
  speed?: number;
}

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

export function escapeSsml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function normalizeSpeechSpeed(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1.2, Math.max(0.8, parsed));
}

export function speedToAzureRate(value: unknown) {
  const speed = normalizeSpeechSpeed(value);
  const percentage = Math.round((speed - 1) * 100);
  return `${percentage >= 0 ? "+" : ""}${percentage}%`;
}

export function parseOpenAiSpeechRequest(value: unknown): OpenAiSpeechRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Corpo da solicitação de voz inválido.");
  }
  const body = value as Record<string, unknown>;
  const input = clean(body.input, MAX_AZURE_TTS_INPUT_LENGTH + 1);
  if (!input) throw new Error("O texto para síntese está vazio.");
  if (input.length > MAX_AZURE_TTS_INPUT_LENGTH) {
    throw new Error(`O texto para síntese excede ${MAX_AZURE_TTS_INPUT_LENGTH} caracteres.`);
  }
  return {
    input,
    model: clean(body.model, 120) || undefined,
    voice: clean(body.voice, 160) || undefined,
    response_format: clean(body.response_format, 40) || undefined,
    speed: normalizeSpeechSpeed(body.speed),
  };
}

export function buildAzureSpeechSsml({
  input,
  voice = DEFAULT_AZURE_SPEECH_VOICE,
  style = DEFAULT_AZURE_SPEECH_STYLE,
  speed = 1,
}: {
  input: string;
  voice?: string;
  style?: string;
  speed?: number;
}) {
  const safeVoice = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9:.-]+$/.test(voice)
    ? voice
    : DEFAULT_AZURE_SPEECH_VOICE;
  const normalizedStyle = clean(style, 40);
  const safeStyle = /^(?:none|default|neutral)$/i.test(normalizedStyle)
    ? ""
    : /^[a-z][a-z0-9-]{0,39}$/i.test(normalizedStyle)
      ? normalizedStyle
      : "";
  const text = escapeSsml(input);
  const prosody = `<prosody rate="${speedToAzureRate(speed)}">${text}</prosody>`;
  const spokenContent = safeStyle
    ? `<mstts:express-as style="${escapeSsml(safeStyle)}">${prosody}</mstts:express-as>`
    : prosody;
  return [
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pt-BR">`,
    `<voice name="${safeVoice}">${spokenContent}</voice>`,
    "</speak>",
  ].join("");
}
