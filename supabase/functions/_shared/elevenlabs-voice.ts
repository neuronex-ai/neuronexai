export interface ElevenLabsVoiceSummary {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
  available_for_tiers?: string[];
}

export interface ResolvedElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string;
  selection: "configured" | "accessible_english" | "accessible_fallback";
}

const clean = (value: unknown, max = 5000) =>
  String(value ?? "").trim().slice(0, max);

const normalize = (value: unknown) => clean(value, 120).toLowerCase();

const isEnglishVoice = (voice: ElevenLabsVoiceSummary) => {
  const labels = voice.labels || {};
  const language = normalize(labels.language || labels.locale);
  const accent = normalize(labels.accent);
  return language === "en" || language.startsWith("en-") ||
    /american|british|english|australian|canadian/.test(accent);
};

const isMaleVoice = (voice: ElevenLabsVoiceSummary) =>
  normalize(voice.labels?.gender) === "male";

const usableVoice = (voice: ElevenLabsVoiceSummary) =>
  Boolean(clean(voice.voice_id, 160));

const voiceDescriptor = (voice: ElevenLabsVoiceSummary) =>
  normalize([
    voice.name,
    voice.category,
    ...Object.values(voice.labels || {}),
  ].filter(Boolean).join(" "));

const professionalVoiceScore = (voice: ElevenLabsVoiceSummary) => {
  const descriptor = voiceDescriptor(voice);
  let score = 0;

  if (isMaleVoice(voice)) score += 20;
  if (isEnglishVoice(voice)) score += 10;
  if (normalize(voice.category) === "premade") score += 3;

  const positivePatterns: Array<[RegExp, number]> = [
    [/professional|corporate|business|executive/, 12],
    [/confident|authoritative|assured|commanding/, 10],
    [/calm|grounded|steady|balanced/, 8],
    [/warm|empathetic|reassuring|trustworthy/, 7],
    [/deep|resonant|baritone|rich/, 6],
    [/narrat|broadcast|news|presenter|documentary/, 6],
    [/middle.?aged|mature/, 4],
    [/clear|articulate|crisp/, 4],
  ];
  const negativePatterns: Array<[RegExp, number]> = [
    [/laid.?back|casual|relaxed/, -12],
    [/playful|quirky|funny|comedic|cartoon/, -12],
    [/character|anime|gaming|villain|monster/, -10],
    [/child|kid|teen|young/, -7],
    [/raspy|whisper|breathy/, -4],
  ];

  for (const [pattern, weight] of positivePatterns) {
    if (pattern.test(descriptor)) score += weight;
  }
  for (const [pattern, weight] of negativePatterns) {
    if (pattern.test(descriptor)) score += weight;
  }
  return score;
};

const bestByScore = (voices: ElevenLabsVoiceSummary[]) =>
  [...voices].sort((left, right) => {
    const scoreDelta = professionalVoiceScore(right) - professionalVoiceScore(left);
    if (scoreDelta !== 0) return scoreDelta;
    return normalize(left.name).localeCompare(normalize(right.name));
  })[0];

export function selectAccessibleElevenLabsVoice(
  voices: ElevenLabsVoiceSummary[],
  configuredVoiceId = "",
): ResolvedElevenLabsVoice | null {
  const available = voices.filter(usableVoice);
  const configured = clean(configuredVoiceId, 160);
  const configuredVoice = configured
    ? available.find((voice) => clean(voice.voice_id, 160) === configured)
    : undefined;

  const englishMale = available.filter((voice) => isEnglishVoice(voice) && isMaleVoice(voice));
  const english = available.filter(isEnglishVoice);
  const selected = configuredVoice ||
    bestByScore(englishMale) ||
    bestByScore(english) ||
    bestByScore(available);

  if (!selected?.voice_id) return null;
  return {
    voiceId: clean(selected.voice_id, 160),
    name: clean(selected.name, 160) || "ElevenLabs voice",
    category: clean(selected.category, 80) || "unknown",
    selection: configuredVoice
      ? "configured"
      : isEnglishVoice(selected)
        ? "accessible_english"
        : "accessible_fallback",
  };
}

let cachedVoice: { value: ResolvedElevenLabsVoice; expiresAt: number } | null = null;

export async function resolveAccessibleElevenLabsVoice(options: {
  apiKey: string;
  configuredVoiceId?: string;
  cacheMs?: number;
}): Promise<ResolvedElevenLabsVoice> {
  const apiKey = clean(options.apiKey, 8000);
  if (!apiKey) throw new Error("Chave da ElevenLabs ausente para resolver a voz.");

  if (cachedVoice && cachedVoice.expiresAt > Date.now()) return cachedVoice.value;

  const url = new URL("https://api.elevenlabs.io/v2/voices");
  url.searchParams.set("page_size", "100");
  url.searchParams.set("include_total_count", "false");

  const response = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = clean(data?.detail?.message || data?.detail || data?.message, 400);
    throw new Error(
      `ElevenLabs não permitiu listar as vozes acessíveis (${response.status})${detail ? `: ${detail}` : "."}`,
    );
  }

  const voices = Array.isArray(data?.voices)
    ? data.voices as ElevenLabsVoiceSummary[]
    : [];
  const selected = selectAccessibleElevenLabsVoice(voices, options.configuredVoiceId);
  if (!selected) {
    throw new Error(
      "Nenhuma voz ElevenLabs utilizável está acessível por esta API key. Crie/salve uma voz compatível ou use uma chave com acesso TTS.",
    );
  }

  cachedVoice = {
    value: selected,
    expiresAt: Date.now() + Math.max(60_000, options.cacheMs ?? 10 * 60_000),
  };
  return selected;
}
