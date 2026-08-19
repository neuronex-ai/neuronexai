import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "SynapseVoiceActionOverlays.tsx"), "utf8");

describe("Synapse opaque confirmation contract", () => {
  it("uses the requested 1..999 range and accepts 1-3 typed/spoken digits", () => {
    expect(source).toContain("1 + (array[0] % 999)");
    expect(source).toContain('/^\\d{1,3}$/.test(digits)');
    expect(source).toContain("typedCode.length >= 1");
    expect(source).toContain("typedCode.length < 1");
  });
});
