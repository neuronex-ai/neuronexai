import { describe, expect, it } from "vitest";

import type { Appointment } from "@/types";

import { getDailyBriefingCounts } from "./desktop-dashboard-morning-briefing-model";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "professional-1",
  patient_id: "patient-1",
  patient_name: "Carlos Almeida",
  start_time: "2026-08-25T09:00:00.000-03:00",
  end_time: "2026-08-25T09:50:00.000-03:00",
  type: "presencial",
  status: "confirmed",
  lifecycle_status: "confirmed",
  notes: null,
  location: "Consultório",
  created_at: "2026-08-20T12:00:00.000Z",
  metadata: { kind: "session", modality: "presencial" },
  ...overrides,
});

describe("desktop dashboard morning briefing", () => {
  it("keeps total, pending and confirmed counts internally consistent", () => {
    const counts = getDailyBriefingCounts([
      appointment(),
      appointment({ id: "pending", status: "pending", lifecycle_status: "awaiting_confirmation" }),
      appointment({ id: "event", patient_id: null, metadata: { kind: "event" } }),
    ]);

    expect(counts).toEqual({ total: 2, pending: 1, confirmed: 1, online: 0 });
  });
});
