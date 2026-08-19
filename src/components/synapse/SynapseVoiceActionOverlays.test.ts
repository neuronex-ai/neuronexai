import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./SynapseVoiceActionOverlays.tsx", import.meta.url), "utf8");

describe("Synapse opaque confirmation contract", () => {
  it("uses the requested 1..999 range and accepts 1-3 typed/spoken digits", () => {
    expect(source).toContain("1 + (array[0] % 999)");
    expect(source).toContain('/^\\d{1,3}$/.test(digits)');
    expect(source).toContain("typedCode.length >= 1");
    expect(source).toContain("typedCode.length < 1");
  });

  it("keeps the challenge number browser-only", () => {
    expect(source).toContain("setOpaqueCaptureBlocked(true)");
    expect(source).toContain("Número confirmado localmente no navegador.");
    expect(source).not.toContain("challengeNumber: code");
    expect(source).not.toContain("code: code");
  });
});
