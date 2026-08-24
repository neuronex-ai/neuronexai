import { describe, expect, it } from "vitest";
import {
  SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT,
  getPendingOpaqueConfirmationRequest,
  requestOpaqueConfirmation,
  respondOpaqueConfirmation,
  type SynapseOpaqueConfirmationRequest,
} from "./synapse-voice-ui-protocol";

describe("Synapse opaque confirmation delivery", () => {
  it("retains the local request until the visual confirmation responds", async () => {
    let retainedChallengeId = "";
    const onRequest = (event: Event) => {
      const request = (event as CustomEvent<SynapseOpaqueConfirmationRequest>).detail;
      retainedChallengeId = getPendingOpaqueConfirmationRequest()?.challengeId || "";
      respondOpaqueConfirmation({
        requestId: request.requestId,
        success: true,
        message: "Confirmado no teste local.",
      });
    };

    window.addEventListener(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, onRequest as EventListener, { once: true });
    const result = await requestOpaqueConfirmation("challenge-test", 5_000);

    expect(retainedChallengeId).toBe("challenge-test");
    expect(result).toEqual({ success: true, cancelled: false, message: "Confirmado no teste local." });
    expect(getPendingOpaqueConfirmationRequest()).toBeNull();
  });
});
