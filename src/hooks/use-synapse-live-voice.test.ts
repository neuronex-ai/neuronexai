import { describe, expect, it } from "vitest";

import { shouldPreviewAssistedVoiceTool } from "./use-synapse-live-voice";

describe("shouldPreviewAssistedVoiceTool", () => {
  it("permite antecipar somente a leitura do NeuroView", () => {
    expect(shouldPreviewAssistedVoiceTool("analyze_neuroview_patient_patterns", "tool_active")).toBe(true);
  });

  it("não navega para ferramentas de escrita antes ou durante a confirmação", () => {
    expect(shouldPreviewAssistedVoiceTool("create_neuroflow_from_patient_history", "awaiting_confirmation", true)).toBe(false);
    expect(shouldPreviewAssistedVoiceTool("create_neuropulse_cause_effect_diagram", "tool_active")).toBe(false);
  });

  it("não antecipa uma leitura enquanto ela ainda aguarda confirmação", () => {
    expect(shouldPreviewAssistedVoiceTool("analyze_neuroview_patient_patterns", "awaiting_confirmation", true)).toBe(false);
  });
});
