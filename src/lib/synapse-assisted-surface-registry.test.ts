import { describe, expect, it } from "vitest";

import {
  getSynapseAssistedSurface,
  getSynapseAssistedSurfaceByProduct,
} from "./synapse-assisted-surface-registry";

describe("synapse assisted surface registry", () => {
  it("maps the read-only NeuroView tool to its live surface", () => {
    expect(getSynapseAssistedSurface("analyze_neuroview_patient_patterns")).toMatchObject({
      product: "neuroview",
      notesView: "neuroview",
      action: "open_neuroview_reasoning",
      writesData: false,
    });
  });

  it("marks generated artifacts as write operations", () => {
    expect(getSynapseAssistedSurface("create_neuroflow_from_patient_history")?.writesData).toBe(true);
    expect(getSynapseAssistedSurface("create_neuropulse_cause_effect_diagram")?.writesData).toBe(true);
  });

  it("supports reverse lookup for contextual presentation", () => {
    expect(getSynapseAssistedSurfaceByProduct("neuropulse")?.title).toBe("NeuroPulse");
  });

  it("does not expose unknown tools as assisted surfaces", () => {
    expect(getSynapseAssistedSurface("delete_everything")).toBeUndefined();
  });
});
