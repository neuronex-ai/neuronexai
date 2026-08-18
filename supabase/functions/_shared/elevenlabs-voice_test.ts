import { selectAccessibleElevenLabsVoice } from "./elevenlabs-voice.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("preserva a voz configurada quando ela é acessível", () => {
  const selected = selectAccessibleElevenLabsVoice([
    {
      voice_id: "available-pt",
      name: "Configured",
      category: "generated",
      labels: { language: "pt", gender: "male" },
    },
    {
      voice_id: "english-male",
      name: "English Male",
      category: "generated",
      labels: { language: "en", gender: "male" },
    },
  ], "available-pt");

  equal(selected?.voiceId, "available-pt", "voice id configurado");
  equal(selected?.selection, "configured", "origem da seleção");
});

Deno.test("troca uma voz inacessível por uma voz inglesa masculina acessível", () => {
  const selected = selectAccessibleElevenLabsVoice([
    {
      voice_id: "neutral",
      name: "Neutral",
      category: "generated",
      labels: { language: "pt", gender: "female" },
    },
    {
      voice_id: "english-male",
      name: "English Male",
      category: "generated",
      labels: { language: "en-US", gender: "male" },
    },
  ], "missing-voice");

  equal(selected?.voiceId, "english-male", "fallback inglês acessível");
  equal(selected?.selection, "accessible_english", "origem da seleção");
});

Deno.test("prefere voz masculina profissional a voz casual quando ambas são acessíveis", () => {
  const selected = selectAccessibleElevenLabsVoice([
    {
      voice_id: "roger",
      name: "Roger - Laid-Back, Casual, Resonant",
      category: "premade",
      labels: {
        language: "en-US",
        gender: "male",
        description: "laid-back casual resonant",
      },
    },
    {
      voice_id: "professional",
      name: "Professional Narrator",
      category: "premade",
      labels: {
        language: "en-US",
        gender: "male",
        description: "professional confident warm clear narrator",
      },
    },
  ], "missing-voice");

  equal(selected?.voiceId, "professional", "voz profissional acessível");
  equal(selected?.selection, "accessible_english", "origem da seleção profissional");
});
