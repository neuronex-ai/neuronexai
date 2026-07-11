import { describe, expect, it } from "vitest";
import {
  buildAzureSpeechSsml,
  escapeSsml,
  parseOpenAiSpeechRequest,
  speedToAzureRate,
} from "../../supabase/functions/_shared/azure-speech-tts";

describe("Azure Speech TTS adapter", () => {
  it("escapes user text before placing it in SSML", () => {
    expect(escapeSsml(`Olá <Synapse> & "equipe"`)).toBe("Olá &lt;Synapse&gt; &amp; &quot;equipe&quot;");
  });

  it("builds multilingual pt-BR SSML with a bounded rate", () => {
    const ssml = buildAzureSpeechSsml({ input: "Olá, tudo bem?", speed: 3 });
    expect(ssml).toContain('xml:lang="pt-BR"');
    expect(ssml).toContain('name="pt-BR-MacerioMultilingualNeural"');
    expect(ssml).not.toContain("mstts:express-as");
    expect(ssml).toContain('rate="+20%"');
  });

  it("keeps supported expressive styles available for compatible voices", () => {
    const ssml = buildAzureSpeechSsml({
      input: "Olá, tudo bem?",
      voice: "pt-BR-FranciscaNeural",
      style: "calm",
    });
    expect(ssml).toContain('style="calm"');
  });

  it("parses OpenAI-compatible input and rejects oversized text", () => {
    expect(parseOpenAiSpeechRequest({ input: "Resposta curta", speed: 0.5 })).toMatchObject({
      input: "Resposta curta",
      speed: 0.8,
    });
    expect(() => parseOpenAiSpeechRequest({ input: "a".repeat(2001) })).toThrow(/excede 2000/);
  });

  it("maps speed to Azure prosody percentages", () => {
    expect(speedToAzureRate(0.9)).toBe("-10%");
    expect(speedToAzureRate(1)).toBe("+0%");
    expect(speedToAzureRate(1.1)).toBe("+10%");
  });
});
