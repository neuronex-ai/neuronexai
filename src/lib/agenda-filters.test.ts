import { describe, expect, it } from "vitest";
import type { Appointment } from "@/types";
import {
  EMPTY_AGENDA_FILTERS,
  countActiveAgendaFilters,
  matchesAgendaFilters,
  type AgendaFilters,
} from "@/lib/agenda-filters";
import { getAppointmentDetailStatusLabel } from "@/lib/appointment-detail-presentation";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "professional-1",
  patient_id: "patient-1",
  patient_name: "Ana",
  start_time: "2099-08-04T12:00:00.000-03:00",
  end_time: "2099-08-04T12:50:00.000-03:00",
  type: "presencial",
  status: "unscored",
  lifecycle_status: "confirmed",
  notes: null,
  location: "Clínica",
  created_at: "2099-01-01T00:00:00.000Z",
  metadata: { kind: "session", origin: "neuronex" },
  ...overrides,
});

const filters = (overrides: Partial<AgendaFilters> = {}): AgendaFilters => ({
  ...EMPTY_AGENDA_FILTERS,
  ...overrides,
});

describe("agenda desktop filters", () => {
  it("keeps the default agenda clean but reveals cancelled appointments on demand", () => {
    const cancelled = appointment({ status: "cancelled_by_patient" });
    expect(matchesAgendaFilters(cancelled, EMPTY_AGENDA_FILTERS)).toBe(false);
    expect(matchesAgendaFilters(cancelled, filters({ status: "Cancelada" }))).toBe(true);
  });

  it("filters patient, modality, origin and the single-word visual status", () => {
    const waitlist = appointment({
      type: "online",
      metadata: { kind: "session", origin: "waitlist" },
      lifecycle_status: "awaiting_confirmation",
    });

    expect(matchesAgendaFilters(waitlist, filters({
      patientId: "patient-1",
      modality: "online",
      origin: "waitlist",
      status: "Pendente",
    }))).toBe(true);
    expect(matchesAgendaFilters(waitlist, filters({ origin: "google" }))).toBe(false);
  });

  it("supports an exact local date or an inclusive date interval", () => {
    const item = appointment();
    expect(matchesAgendaFilters(item, filters({ date: "2099-08-04" }))).toBe(true);
    expect(matchesAgendaFilters(item, filters({ date: "2099-08-03" }))).toBe(false);
    expect(matchesAgendaFilters(item, filters({
      dateFrom: "2099-08-01",
      dateTo: "2099-08-04",
    }))).toBe(true);
    expect(matchesAgendaFilters(item, filters({ dateFrom: "2099-08-05" }))).toBe(false);
  });

  it("counts the exact date and interval as distinct filter intents", () => {
    expect(countActiveAgendaFilters(filters({
      patientId: "patient-1",
      date: "2099-08-04",
      modality: "online",
    }))).toBe(3);
    expect(countActiveAgendaFilters(filters({
      dateFrom: "2099-08-01",
      dateTo: "2099-08-04",
    }))).toBe(1);
  });

  it("exposes every appointment status as one word", () => {
    const samples: Appointment[] = [
      appointment({ lifecycle_status: "created" }),
      appointment({ lifecycle_status: "confirmed" }),
      appointment({ lifecycle_status: "reschedule_requested" }),
      appointment({ lifecycle_status: "in_progress" }),
      appointment({ status: "attended" }),
      appointment({ status: "absent" }),
      appointment({ status: "cancelled_by_professional" }),
    ];

    samples.forEach((item) => {
      expect(getAppointmentDetailStatusLabel(item)).not.toMatch(/\s/u);
    });
  });
});
