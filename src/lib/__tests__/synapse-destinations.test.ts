import { describe, expect, it } from "vitest";
import {
  resolveSynapseDestination,
  safeSynapseDestination,
  SYNAPSE_DESTINATIONS,
} from "../synapse-destinations";

describe("Synapse deep destinations", () => {
  it("keeps a single safe catalog without duplicate destinations", () => {
    expect(new Set(SYNAPSE_DESTINATIONS).size).toBe(SYNAPSE_DESTINATIONS.length);
    expect(safeSynapseDestination("settings.integrations")).toBe("settings.integrations");
    expect(safeSynapseDestination("admin.private-secrets")).toBeUndefined();
  });

  it("opens an exact patient record subtab and preserves its inner session view", () => {
    expect(resolveSynapseDestination("patient.sessions.pending", { patientId: "patient-123456" })).toMatchObject({
      path: "/pacientes/patient-123456?tab=sessions&sessionView=pending",
      selector: "#patient-record-panel-sessions",
    });
    expect(resolveSynapseDestination("patient.finance")).toEqual({ requires: "patient" });
  });

  it("opens existing Notes, Finance and modal subviews through route state", () => {
    expect(resolveSynapseDestination("notes.files.patients")).toMatchObject({
      path: "/notas",
      state: { synapseNotesView: "files", synapseFilesTab: "patients" },
      pageAction: { action: "open_files_manager", filesTab: "patients" },
    });
    expect(resolveSynapseDestination("finance.extrato.assinaturas").path)
      .toBe("/financeiro?view=extrato&subview=assinaturas");
    expect(resolveSynapseDestination("finance.new-charge")).toMatchObject({
      path: "/financeiro?view=gestao-cobrancas",
      pageAction: { action: "open_modal", modal: "new_charge" },
    });
  });

  it("requires an appointment for specific teleconsultation workspaces", () => {
    expect(resolveSynapseDestination("teleconsultation.notes")).toEqual({ requires: "appointment" });
    expect(resolveSynapseDestination("teleconsultation.notes", { appointmentId: "appointment-123456" })).toMatchObject({
      path: "/teleconsulta",
      state: { activeAppointmentId: "appointment-123456", synapseWorkspaceTab: "notes" },
      pageAction: { action: "open_teleconsultation_lobby", workspaceTab: "notes" },
    });
  });
});
