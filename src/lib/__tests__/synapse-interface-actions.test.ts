import { afterEach, describe, expect, it, vi } from "vitest";
import { executeSynapseInterfaceAction, normalizeSynapseClientAction } from "../synapse-interface-actions";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: () => Promise.resolve({ error: null }) }),
  },
}));

describe("synapse interface actions", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });
  it("normalizes NeuroFlow generation actions with run and flow ids", () => {
    const action = normalizeSynapseClientAction({
      type: "interface_action",
      data: {
        action: "open_neuroflow_generation",
        notesView: "neuroflow",
        patientId: "patient-123456",
        flowId: "flow-123456",
        runId: "run-123456",
      },
    });

    expect(action).toMatchObject({
      action: "open_neuroflow_generation",
      notesView: "neuroflow",
      patientId: "patient-123456",
      flowId: "flow-123456",
      runId: "run-123456",
    });
  });

  it("rejects unknown interface actions", () => {
    expect(normalizeSynapseClientAction({
      type: "interface_action",
      data: { action: "open_private_credentials" },
    })).toBeNull();
  });

  it("normalizes only whitelisted deep destinations and their context", () => {
    expect(normalizeSynapseClientAction({
      type: "interface_action",
      data: {
        action: "navigate",
        destination: "patient.sessions.pending",
        patient_id: "patient-123456",
      },
    })).toMatchObject({
      action: "navigate",
      destination: "patient.sessions.pending",
      patientId: "patient-123456",
    });

    expect(normalizeSynapseClientAction({
      type: "interface_action",
      data: { action: "navigate", destination: "admin.private-secrets" },
    })).toMatchObject({ action: "navigate", destination: undefined });
  });

  it("normalizes continuous NeuroView scope, focus and 3D directives", () => {
    const action = normalizeSynapseClientAction({
      type: "interface_action",
      data: {
        action: "open_neuroview_reasoning",
        patient_id: "patient-123456",
        neuroview_scope: "subgraph",
        neuroview_mode: "3d",
        neuroview_node_ids: ["pat-patient-123456", "note-note-123456", "note-note-123456", "bad\u0000node"],
        neuroview_focus_node_id: "note-note-123456",
      },
    });

    expect(action).toMatchObject({
      action: "open_neuroview_reasoning",
      patientId: "patient-123456",
      neuroViewScope: "subgraph",
      neuroViewMode: "3d",
      neuroViewNodeIds: ["pat-patient-123456", "note-note-123456"],
      neuroViewFocusNodeId: "note-note-123456",
    });
  });

  it("maps legacy modal intents to existing native actions", () => {
    expect(normalizeSynapseClientAction({
      type: "interface_action",
      data: { action: "open_modal", modal: "new_note" },
    })).toMatchObject({ action: "open_new_note", notesView: "notes" });

    expect(normalizeSynapseClientAction({
      type: "interface_action",
      data: { action: "open_modal", modal: "patient_details", patient_id: "patient-123456" },
    })).toMatchObject({ action: "open_patient", patientId: "patient-123456" });

    expect(normalizeSynapseClientAction({
      type: "interface_action",
      data: { action: "open_modal", modal: "patient_invite", appointment_id: "appointment-123456" },
    })).toMatchObject({ action: "open_patient_invite_modal", appointmentId: "appointment-123456" });
  });

  it("waits for the explicit NeuroFlow surface-ready handshake", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const navigate = vi.fn(() => {
      window.setTimeout(() => {
        const surface = document.createElement("div");
        surface.dataset.synapseTarget = "neuroflow-canvas";
        surface.dataset.synapseReady = "true";
        surface.dataset.synapseRunId = "run-123456";
        document.body.appendChild(surface);
        window.dispatchEvent(new CustomEvent("synapse:surface-ready", {
          detail: { target: "neuroflow-canvas", runId: "run-123456" },
        }));
      }, 20);
    });

    const result = await executeSynapseInterfaceAction({
      action: "open_neuroflow_generation",
      notesView: "neuroflow",
      flowId: "flow-123456",
      runId: "run-123456",
    }, { navigate, channel: "voice" });

    expect(result.success).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/notas", expect.any(Object));
    expect(document.querySelector("[data-synapse-ready='true']")).not.toBeNull();
  });
});
