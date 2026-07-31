import { describe, expect, it } from "vitest";

import {
  countActiveAgendaFilterGroups,
  createEmptyAgendaFilters,
  filterAgendaAppointments,
  getAgendaAppointmentOrigin,
  getAgendaPatientFilterOptions,
  validateAgendaDateFilter,
} from "@/lib/agenda-filters";
import type { Appointment } from "@/types";

const appointment = (
  id: string,
  overrides: Partial<Appointment> = {},
): Appointment => ({
  id,
  user_id: "professional-1",
  patient_id: "patient-1",
  patient_name: "Ana",
  start_time: "2026-08-10T15:00:00.000Z",
  end_time: "2026-08-10T15:50:00.000Z",
  type: "online",
  status: "unscored",
  notes: null,
  location: null,
  created_at: "2026-07-31T12:00:00.000Z",
  ...overrides,
});

describe("agenda filters", () => {
  it("keeps the default operational view and only returns cancellations when requested", () => {
    const active = appointment("active");
    const cancelled = appointment("cancelled", {
      status: "cancelled_by_patient",
    });
    const filters = createEmptyAgendaFilters(new Date("2026-08-10T12:00:00"));

    expect(filterAgendaAppointments([active, cancelled], filters)).toEqual([active]);

    filters.statuses = ["cancelled_by_patient"];
    expect(filterAgendaAppointments([active, cancelled], filters)).toEqual([cancelled]);
  });

  it("combines patient, period, status, modality and origin deterministically", () => {
    const target = appointment("target", {
      patient_id: "patient-2",
      patient_name: "Bruno",
      type: "presencial",
      status: "attended",
      metadata: { origin: "waitlist" },
    });
    const other = appointment("other");
    const filters = createEmptyAgendaFilters(new Date("2026-08-10T12:00:00"));

    filters.patientIds = ["patient-2"];
    filters.dateMode = "range";
    filters.rangeStart = "2026-08-01";
    filters.rangeEnd = "2026-08-31";
    filters.statuses = ["attended"];
    filters.modalities = ["presencial"];
    filters.origins = ["waitlist"];

    expect(filterAgendaAppointments([other, target], filters)).toEqual([target]);
    expect(countActiveAgendaFilterGroups(filters)).toBe(5);
  });

  it("normalizes origins and patient options without duplicating patients", () => {
    const google = appointment("google", { google_event_id: "google-event" });
    const waitlist = appointment("waitlist", { metadata: { waitlistOfferId: "offer-1" } });
    const neuronex = appointment("neuronex");

    expect(getAgendaAppointmentOrigin(google)).toBe("google");
    expect(getAgendaAppointmentOrigin(waitlist)).toBe("waitlist");
    expect(getAgendaAppointmentOrigin(neuronex)).toBe("neuronex");
    expect(getAgendaPatientFilterOptions([
      appointment("one"),
      appointment("two", { patient_name: "Ana atualizada" }),
      appointment("three", { patient_id: "patient-2", patient_name: "Bruno" }),
    ])).toEqual([
      { id: "patient-1", name: "Ana atualizada" },
      { id: "patient-2", name: "Bruno" },
    ]);
  });

  it("validates incomplete date filters before applying them", () => {
    const filters = createEmptyAgendaFilters();
    filters.dateMode = "range";
    filters.rangeEnd = "";

    expect(validateAgendaDateFilter(filters)).toBe(
      "Preencha o início e o fim do intervalo.",
    );

    filters.dateMode = "year";
    filters.year = "26";
    expect(validateAgendaDateFilter(filters)).toBe(
      "Informe um ano com quatro dígitos.",
    );
  });
});
