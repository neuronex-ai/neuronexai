import { describe, expect, it } from "vitest";

import type { Appointment } from "@/types";
import {
  getAppointmentDetailStatusLabel,
  getAppointmentOriginLabel,
  getAppointmentRecurrencePosition,
} from "@/lib/appointment-detail-presentation";

const appointment = (patch: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "professional-1",
  patient_id: "patient-1",
  start_time: "2026-08-10T12:00:00.000Z",
  end_time: "2026-08-10T12:50:00.000Z",
  type: "presencial",
  status: "unscored",
  lifecycle_status: "created",
  notes: null,
  location: null,
  created_at: "2026-08-01T12:00:00.000Z",
  metadata: { kind: "session", origin: "neuronex" },
  ...patch,
});

describe("appointment detail presentation", () => {
  it("uses the same confirmed status for a waitlist acceptance", () => {
    const item = appointment({
      lifecycle_status: "awaiting_confirmation",
      metadata: {
        kind: "session",
        origin: "waitlist",
        waitlistAcceptedAt: "2026-08-01T12:00:00.000Z",
      },
    });

    expect(getAppointmentDetailStatusLabel(item)).toBe("Confirmado");
    expect(getAppointmentOriginLabel(item)).toBe("Lista de espera");
  });

  it("keeps legacy Google-linked appointments identified as Google origin", () => {
    expect(getAppointmentOriginLabel(appointment({
      google_event_id: "google-event-1",
      metadata: { kind: "event" },
    }))).toBe("Google Agenda");
  });

  it("prioritizes clinical outcomes over invitation state", () => {
    expect(getAppointmentDetailStatusLabel(appointment({
      status: "attended",
      lifecycle_status: "awaiting_confirmation",
    }))).toBe("Realizado");
  });

  it("presents the canonical position inside a finite series", () => {
    expect(getAppointmentRecurrencePosition(appointment({
      series_id: "series-1",
      occurrence_number: 3,
      occurrence_count: 6,
    }))).toEqual({
      current: 3,
      total: 6,
      label: "3 / 6",
      accessibleLabel: "3 de 6",
    });
  });

  it("does not render a recurrence card for a standalone appointment", () => {
    expect(getAppointmentRecurrencePosition(appointment())).toBeNull();
  });
});
