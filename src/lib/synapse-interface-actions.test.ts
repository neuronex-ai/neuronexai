import { describe, expect, it } from "vitest";
import { isCurrentCancelledSynapseAction, normalizeSynapseClientAction } from "./synapse-interface-actions";

describe("normalizeSynapseClientAction", () => {
  it("accepts a structured daily schedule action", () => {
    expect(
      normalizeSynapseClientAction({
        type: "interface_action",
        data: {
          action: "open_daily_schedule",
          date: "2026-06-18",
          reason: "Agenda de hoje",
        },
      }),
    ).toEqual({
      action: "open_daily_schedule",
      target: undefined,
      patientId: undefined,
      appointmentId: undefined,
      date: "2026-06-18",
      element: undefined,
      modal: undefined,
      reason: "Agenda de hoje",
    });
  });

  it("converts a known legacy route into a safe target", () => {
    expect(
      normalizeSynapseClientAction({
        type: "navigation_action",
        data: { path: "/agenda", reason: "Mostrar consultas" },
      }),
    ).toEqual({ action: "open_daily_schedule", reason: "Mostrar consultas" });
  });

  it("converts a patient route without exposing it to the executor", () => {
    const patientId = "550e8400-e29b-41d4-a716-446655440000";
    expect(
      normalizeSynapseClientAction({
        type: "navigation_action",
        data: { path: `/pacientes/${patientId}?tab=prontuario` },
      }),
    ).toEqual({ action: "open_patient_record", patientId, reason: undefined });
  });

  it("keeps the current patient summary route compatible", () => {
    const patientId = "550e8400-e29b-41d4-a716-446655440000";
    expect(
      normalizeSynapseClientAction({
        type: "navigation_action",
        data: { path: `/pacientes/${patientId}?tab=summary` },
      }),
    ).toEqual({ action: "open_patient_record", patientId, reason: undefined });
  });

  it("rejects external and arbitrary routes", () => {
    expect(
      normalizeSynapseClientAction({
        type: "navigation_action",
        data: { path: "https://example.com" },
      }),
    ).toBeNull();
    expect(
      normalizeSynapseClientAction({
        type: "navigation_action",
        data: { path: "/admin/secrets" },
      }),
    ).toBeNull();
  });

  it("rejects unknown structured actions", () => {
    expect(
      normalizeSynapseClientAction({
        type: "interface_action",
        data: { action: "run_javascript", payload: "alert(1)" },
      }),
    ).toBeNull();
  });

  it("accepts allowlisted read-only desktop targets", () => {
    expect(
      normalizeSynapseClientAction({
        type: "interface_action",
        data: {
          action: "navigate",
          target: "dashboard",
          element: "dashboard_pending",
        },
      }),
    ).toMatchObject({
      action: "navigate",
      target: "dashboard",
      element: "dashboard_pending",
    });

    expect(
      normalizeSynapseClientAction({
        type: "interface_action",
        data: {
          action: "navigate",
          target: "finance",
          element: "finance_entries",
        },
      }),
    ).toMatchObject({
      action: "navigate",
      target: "finance",
      element: "finance_entries",
    });
  });

  it("drops arbitrary DOM targets from structured actions", () => {
    expect(
      normalizeSynapseClientAction({
        type: "interface_action",
        data: {
          action: "navigate",
          target: "dashboard",
          element: "body > script",
        },
      }),
    ).toMatchObject({
      action: "navigate",
      target: "dashboard",
      element: undefined,
    });
  });

  it("does not let a stale cancellation clear a newer action lifecycle", () => {
    const cancelled = {
      success: false,
      cancelled: true,
      lifecycleId: "action-old",
      action: "navigate" as const,
      message: "Ação cancelada.",
      durationMs: 20,
    };

    expect(isCurrentCancelledSynapseAction(cancelled, "action-new")).toBe(false);
    expect(isCurrentCancelledSynapseAction(cancelled, "action-old")).toBe(true);
  });
});
