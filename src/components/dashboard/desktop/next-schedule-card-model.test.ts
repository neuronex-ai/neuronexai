import { describe, expect, it } from "vitest";

import type { Appointment } from "@/types";

import { buildNextScheduleCardPresentation } from "./next-schedule-card-model";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "professional-1",
  patient_id: "patient-1",
  patient_name: "Carlos Almeida",
  start_time: "2026-08-25T19:00:00.000-03:00",
  end_time: "2026-08-25T19:50:00.000-03:00",
  type: "presencial",
  status: "confirmed",
  lifecycle_status: "confirmed",
  notes: null,
  location: "Consultório Jardins",
  created_at: "2026-08-20T12:00:00.000Z",
  metadata: {
    kind: "session",
    modality: "presencial",
    financial: { mode: "manual", transactionAmount: 220 },
  },
  ...overrides,
});

describe("buildNextScheduleCardPresentation", () => {
  it("shows useful financial and location data for a one-off in-person session", () => {
    const result = buildNextScheduleCardPresentation(appointment({ payment_status: "paid" }));

    expect(result.kind).toBe("session");
    expect(result.modalityLabel).toBe("Presencial");
    expect(result.financialValueLabel).toContain("220");
    expect(result.financialStatusLabel).toBe("Pago");
    expect(result.locationLabel).toBe("Consultório Jardins");
  });

  it("identifies the occurrence inside an online recurring session", () => {
    const result = buildNextScheduleCardPresentation(appointment({
      type: "online",
      location: "Teleconsulta NeuroNex",
      series_id: "series-1",
      occurrence_number: 5,
      occurrence_count: 6,
      metadata: {
        kind: "session",
        modality: "online",
        recurrence: { enabled: true, count: 6 },
        financial: { mode: "neurofinance", transactionAmount: 220 },
      },
    }));

    expect(result.isOnline).toBe(true);
    expect(result.recurrenceLabel).toBe("5/6");
    expect(result.locationLabel).toBe("Sala protegida NeuroNex");
    expect(result.canShare).toBe(true);
  });

  it("keeps recurring general events separate from clinical sessions", () => {
    const result = buildNextScheduleCardPresentation(appointment({
      patient_id: null,
      patient_name: undefined,
      type: "block",
      series_id: "event-series",
      occurrence_number: 2,
      occurrence_count: 4,
      location: "Auditório",
      metadata: {
        kind: "event",
        eventTitle: "Supervisão clínica",
        eventCategory: "supervisao",
        eventCategoryLabel: "Supervisão",
        eventLocation: "Auditório",
        recurrence: { enabled: true, count: 4 },
      },
    }));

    expect(result.kind).toBe("event");
    expect(result.title).toBe("Supervisão clínica");
    expect(result.recurrenceLabel).toBe("2/4");
    expect(result.financialValueLabel).toBeNull();
  });

  it("shows who comes next after an agenda block", () => {
    const block = appointment({
      patient_id: null,
      patient_name: undefined,
      type: "block",
      start_time: "2026-08-25T17:00:00.000-03:00",
      end_time: "2026-08-25T18:30:00.000-03:00",
      metadata: { kind: "block", eventTitle: "Bloqueio de agenda" },
    });
    const result = buildNextScheduleCardPresentation(block, appointment());

    expect(result.kind).toBe("block");
    expect(result.intervalLabel).toBe("17:00–18:30");
    expect(result.followingLabel).toContain("Carlos Almeida");
    expect(result.financialStatusLabel).toBeNull();
  });
});
