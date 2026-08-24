import { describe, expect, it } from "vitest";

import {
  getNeuroVisionDisplayLabel,
  shouldUseNeuroVisionLabelSurface,
} from "./neurovision-labels";

describe("NeuroVision display labels", () => {
  it("preserves patient names for unambiguous identification", () => {
    expect(getNeuroVisionDisplayLabel({
      label: "Henrique Gomes de Alcântara",
      type: "patient",
    })).toBe("Henrique Gomes de Alcântara");
  });

  it("limits clinical artifact titles to two words", () => {
    expect(getNeuroVisionDisplayLabel({
      label: "NeuroPulse Carlos 15/08/2026",
      type: "note",
    })).toBe("NeuroPulse Carlos…");
  });

  it("uses a material surface only for patient labels", () => {
    expect(shouldUseNeuroVisionLabelSurface({ type: "patient" })).toBe(true);
    expect(shouldUseNeuroVisionLabelSurface({ type: "flow" })).toBe(false);
  });
});
