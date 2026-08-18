import {
  assertNoLegacyElevenLabsMultiLanguageCode,
  normalizeLegacyElevenLabsMultilingualSettings,
} from "./synapse-voice-settings.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test('normaliza eleven_labs.language_code="multi" antes de enviar ao Deepgram', () => {
  const settings: Record<string, unknown> = {
    agent: {
      speak: [
        {
          provider: {
            type: "eleven_labs",
            model_id: "eleven_turbo_v2_5",
            language_code: "multi",
          },
        },
      ],
    },
  };

  normalizeLegacyElevenLabsMultilingualSettings(settings);

  const agent = settings.agent as Record<string, unknown>;
  const speak = agent.speak as Array<Record<string, unknown>>;
  const provider = speak[0].provider as Record<string, unknown>;

  equal(provider.language, "multi", "idioma multilingual do Deepgram");
  equal("language_code" in provider, false, "language_code legado removido");
  assertNoLegacyElevenLabsMultiLanguageCode(settings);
});

Deno.test('rejeita settings finais com eleven_labs.language_code="multi"', () => {
  const settings: Record<string, unknown> = {
    agent: {
      speak: [
        {
          provider: {
            type: "eleven_labs",
            model_id: "eleven_turbo_v2_5",
            language: "multi",
            language_code: "multi",
          },
        },
      ],
    },
  };

  let rejected = false;
  try {
    assertNoLegacyElevenLabsMultiLanguageCode(settings);
  } catch {
    rejected = true;
  }

  equal(rejected, true, 'language_code="multi" deve violar a invariante final');
});
