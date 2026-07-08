import { describe, expect, it } from "vitest";
import { normalizeSynapseClientAction } from "../synapse-interface-actions";

describe("synapse interface actions", () => {
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
});
