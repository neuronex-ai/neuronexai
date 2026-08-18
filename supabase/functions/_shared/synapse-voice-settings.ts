export const SYNAPSE_ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";
export const SYNAPSE_ELEVENLABS_LANGUAGE = "multi";

const clean = (value: unknown, max = 5000) =>
  String(value ?? "").trim().slice(0, max);

type JsonObject = Record<string, unknown>;

const speakChainFromSettings = (settings: JsonObject) => {
  const agent = settings.agent as JsonObject | undefined;
  if (!agent || typeof agent !== "object") return [];
  return Array.isArray(agent.speak)
    ? agent.speak
    : agent.speak
      ? [agent.speak]
      : [];
};

/**
 * Accepts the legacy Synapse payload emitted before issue #16 and rewrites it
 * into Deepgram's multilingual third-party TTS contract.
 */
export function normalizeLegacyElevenLabsMultilingualSettings(
  settings: JsonObject,
) {
  for (const rawSpeak of speakChainFromSettings(settings)) {
    if (!rawSpeak || typeof rawSpeak !== "object") continue;
    const provider = (rawSpeak as JsonObject).provider as JsonObject | undefined;
    if (
      provider?.type === "eleven_labs" &&
      clean(provider.language_code, 40).toLowerCase() === SYNAPSE_ELEVENLABS_LANGUAGE &&
      !clean(provider.language, 40)
    ) {
      provider.language = SYNAPSE_ELEVENLABS_LANGUAGE;
      delete provider.language_code;
    }
  }
  return settings;
}

/**
 * Final Deepgram Settings must never contain the ElevenLabs pseudo language
 * in language_code. `multi` belongs to provider.language instead.
 */
export function assertNoLegacyElevenLabsMultiLanguageCode(
  settings: JsonObject,
) {
  for (const rawSpeak of speakChainFromSettings(settings)) {
    if (!rawSpeak || typeof rawSpeak !== "object") continue;
    const provider = (rawSpeak as JsonObject).provider as JsonObject | undefined;
    if (
      provider?.type === "eleven_labs" &&
      clean(provider.language_code, 40).toLowerCase() === SYNAPSE_ELEVENLABS_LANGUAGE
    ) {
      throw new Error(
        'Settings Deepgram inválidos: eleven_labs.language_code não pode ser "multi".',
      );
    }
  }
}
