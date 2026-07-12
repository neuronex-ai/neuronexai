import { describe, expect, it } from "vitest";

import {
  getSynapseAssistedSurface,
  getSynapseAssistedSurfaceByProduct,
  getSynapseReadSurface,
  SYNAPSE_READ_SURFACES,
} from "./synapse-assisted-surface-registry";

describe("synapse assisted surface registry", () => {
  it("maps the read-only NeuroView tool to its live surface", () => {
    expect(
      getSynapseAssistedSurface("analyze_neuroview_patient_patterns"),
    ).toMatchObject({
      product: "neuroview",
      notesView: "neuroview",
      action: "open_neuroview_reasoning",
      writesData: false,
    });
  });

  it("marks generated artifacts as write operations", () => {
    expect(
      getSynapseAssistedSurface("create_neuroflow_from_patient_history")
        ?.writesData,
    ).toBe(true);
    expect(
      getSynapseAssistedSurface("create_neuropulse_cause_effect_diagram")
        ?.writesData,
    ).toBe(true);
  });

  it("supports reverse lookup for contextual presentation", () => {
    expect(getSynapseAssistedSurfaceByProduct("neuropulse")?.title).toBe(
      "NeuroPulse",
    );
  });
});

describe("Synapse read surfaces", () => {
  it("maps the first desktop expansion to allowlisted routes and selectors", () => {
    expect(getSynapseReadSurface("dashboard_agenda")).toMatchObject({
      route: "/dashboard",
      selector: "[data-synapse-target='dashboard-agenda']",
      writesData: false,
    });
    expect(getSynapseReadSurface("patient_files")).toMatchObject({
      route: "/pacientes/:patientId?tab=documents",
      selector: "[data-synapse-target='patient-files']",
      writesData: false,
    });
    expect(getSynapseReadSurface("finance_charges")).toMatchObject({
      route: "/financeiro?view=gestao-cobrancas",
      selector: "[data-synapse-target='finance-charges']",
      writesData: false,
    });
  });

  it("keeps every expanded surface read-only", () => {
    expect(
      Object.values(SYNAPSE_READ_SURFACES).every(
        (surface) => surface.writesData === false,
      ),
    ).toBe(true);
  });

  it("rejects unknown surface identifiers", () => {
    expect(getSynapseReadSurface("admin_secrets")).toBeUndefined();
  });
});
