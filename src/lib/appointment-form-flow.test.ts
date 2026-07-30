import { describe, expect, it, vi } from "vitest";

import {
  appointmentPayloadFingerprint,
  dateAtTimeInZone,
  findFirstInvalidAppointmentField,
  getAppointmentFieldStep,
  getAppointmentFieldsForStep,
  getAppointmentStepLabels,
  getInitialAppointmentSlot,
  getOccurrenceOverrideIssue,
  normalizeOccurrenceOverride,
  revealAppointmentField,
  resolveAppointmentFinancialMode,
  validateAppointmentTiming,
} from "@/lib/appointment-form-flow";

describe("appointment form flow", () => {
  it("keeps the financial step in a recurring clinical appointment", () => {
    expect(getAppointmentStepLabels("session", true)).toEqual([
      "Atendimento",
      "Sessão",
      "Financeiro",
      "Revisão",
    ]);
  });

  it("always ends clinical and general appointments with a review step", () => {
    expect(getAppointmentStepLabels("session", false)).toEqual([
      "Atendimento",
      "Sessão",
      "Financeiro",
      "Revisão",
    ]);
    expect(getAppointmentStepLabels("event", false)).toEqual([
      "Compromisso",
      "Detalhes",
      "Revisão",
    ]);
  });

  it("sends financial errors to the financial step", () => {
    expect(getAppointmentFieldStep("transactionAmount", "session", true)).toBe(3);
    expect(getAppointmentFieldStep("transactionAmount", "session", false)).toBe(3);
  });

  it("keeps details out of the attendance step", () => {
    expect(getAppointmentFieldStep("type", "session", false)).toBe(2);
    expect(getAppointmentFieldStep("eventLocation", "event", false)).toBe(2);
  });

  it("uses visual order instead of object insertion order", () => {
    expect(findFirstInvalidAppointmentField(
      { startTime: {}, patientId: {} },
      "session",
      false,
    )).toBe("patientId");
    expect(findFirstInvalidAppointmentField({}, "event", false)).toBeNull();
  });

  it("returns only the visible fields for each step", () => {
    expect(getAppointmentFieldsForStep("event", false, 1)).not.toContain("recurrenceCount");
    expect(getAppointmentFieldsForStep("session", true, 3)).toContain("transactionAmount");
  });
});

describe("appointment timing", () => {
  it("combines the professional local time using the configured IANA timezone", () => {
    expect(
      dateAtTimeInZone(new Date(2026, 0, 2), "09:00", "America/Sao_Paulo")?.toISOString(),
    ).toBe("2026-01-02T12:00:00.000Z");
  });

  const now = new Date(2026, 6, 30, 14, 10, 0, 0);

  it("rejects a time that already passed on the current day", () => {
    expect(validateAppointmentTiming({
      date: now,
      startTime: "14:00",
      endTime: "14:50",
      now,
    })).toContainEqual(expect.objectContaining({ field: "startTime" }));
  });

  it("requires the end to follow the start on the same day", () => {
    expect(validateAppointmentTiming({
      date: new Date(2026, 6, 31),
      startTime: "18:00",
      endTime: "17:00",
      now,
    })).toContainEqual(expect.objectContaining({ field: "endTime" }));
  });

  it("accepts a strictly future interval", () => {
    expect(validateAppointmentTiming({
      date: new Date(2026, 6, 31),
      startTime: "09:00",
      endTime: "09:50",
      now,
    })).toEqual([]);
  });

  it("rounds a new unslotted appointment to the next interval", () => {
    expect(getInitialAppointmentSlot({ now })).toMatchObject({
      startTime: "14:15",
    });
  });

  it("preserves an explicitly selected slot", () => {
    expect(getInitialAppointmentSlot({
      now,
      effectiveDate: new Date(2026, 6, 30),
      selectedTime: "13:40",
    }).startTime).toBe("13:40");
  });

  it("moves an unslotted appointment to the next configured working window", () => {
    const fridayEvening = new Date(2026, 6, 31, 20, 10);
    const slot = getInitialAppointmentSlot({
      now: fridayEvening,
      workingHours: {
        "1": { enabled: true, start: "08:00", end: "19:00" },
        "5": { enabled: true, start: "08:00", end: "19:00" },
      },
    });
    expect(slot.date.getDay()).toBe(1);
    expect(slot.startTime).toBe("08:00");
  });
});

describe("appointment draft identity", () => {
  it("is deterministic regardless of object key order", () => {
    expect(appointmentPayloadFingerprint({ b: 2, a: { y: 2, x: 1 } }))
      .toBe(appointmentPayloadFingerprint({ a: { x: 1, y: 2 }, b: 2 }));
  });

  it("changes when scheduling input changes", () => {
    expect(appointmentPayloadFingerprint({ start: "09:00" }))
      .not.toBe(appointmentPayloadFingerprint({ start: "10:00" }));
  });

  it("removes empty overrides and preserves meaningful ones", () => {
    expect(normalizeOccurrenceOverride({
      occurrenceNumber: 2,
      date: "",
      startTime: "",
      durationMinutes: 0,
    })).toBeNull();
    expect(normalizeOccurrenceOverride({
      occurrenceNumber: 2,
      startTime: "08:00",
    })).toMatchObject({
      occurrenceNumber: 2,
      startTime: "08:00",
      source: "professional",
    });
  });

  it("reports an invalid personalized duration without discarding the draft", () => {
    const override = normalizeOccurrenceOverride({
      occurrenceNumber: 3,
      durationMinutes: 10,
    });
    expect(override).toMatchObject({ durationMinutes: 10 });
    expect(getOccurrenceOverrideIssue(override ? [override] : []))
      .toMatchObject({ occurrenceNumber: 3 });
  });
});

describe("financial mode", () => {
  it("keeps events and explicit no-charge sessions financially neutral", () => {
    expect(resolveAppointmentFinancialMode({
      eventType: "event",
      usePackage: true,
      packageId: "package-id",
      shouldCreateTransaction: true,
      shouldGenerateNeurofinanceCharge: true,
      canUseNeurofinance: true,
    })).toBe("none");
    expect(resolveAppointmentFinancialMode({
      eventType: "session",
      usePackage: false,
      shouldCreateTransaction: false,
      shouldGenerateNeurofinanceCharge: false,
      canUseNeurofinance: true,
    })).toBe("none");
  });

  it("preserves a configured insurance receivable without charging the patient", () => {
    expect(resolveAppointmentFinancialMode({
      eventType: "session",
      usePackage: false,
      shouldCreateTransaction: false,
      shouldGenerateNeurofinanceCharge: false,
      canUseNeurofinance: true,
      insuranceConfigured: true,
    })).toBe("insurance");
  });
});

describe("invalid field reveal", () => {
  it("scrolls the modal body and focuses the custom control", () => {
    const container = document.createElement("div");
    const field = document.createElement("div");
    const trigger = document.createElement("button");
    field.dataset.appointmentField = "patientId";
    trigger.dataset.appointmentFocus = "true";
    field.append(trigger);
    container.append(field);
    document.body.append(container);
    Object.defineProperty(container, "clientHeight", { configurable: true, value: 500 });
    const scrollTo = vi.fn();
    container.scrollTo = scrollTo;

    expect(revealAppointmentField(container, "patientId", true)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" }));
    expect(document.activeElement).toBe(trigger);
  });
});
