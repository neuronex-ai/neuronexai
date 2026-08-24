import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/synapse/SynapseVoiceActionOverlays.tsx"),
  "utf8",
);

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
    const respondCall = source.match(/respondOpaqueConfirmation\(\{[\s\S]*?\}\);/)?.[0] || "";
    expect(respondCall).toContain("requestId");
    expect(respondCall).toContain("success");
    expect(respondCall).toContain("cancelled");
    expect(respondCall).not.toContain("code");
    expect(respondCall).not.toContain("challengeNumber");
  });

  it("hands off review and confirmation as one directional, lossless flow", () => {
    expect(source).toContain('getPendingOpaqueConfirmationRequest()');
    expect(source).toContain('<AnimatePresence mode="wait" initial={false}>');
    expect(source).toContain('x: "calc(-100vw - 48px)"');
    expect(source).toContain('x: "calc(100vw + 48px)"');
    expect(source).toContain('if (confirmed) setReview(null)');
  });

  it("uses localized native controls for review dates and appointment times", () => {
    expect(source).toContain("getSynapseReviewFieldPresentation");
    expect(source).toContain("type={presentation.inputType}");
    expect(source).toContain("presentation.formatForRequest(value)");
  });
});
