import { format } from "date-fns";

import {
  getAppointmentMetadata,
  isWaitlistAppointment,
  type AppointmentOrigin,
} from "@/lib/appointment-metadata";
import {
  isCancelledAppointmentStatus,
  normalizeAppointmentStatus,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import type { Appointment } from "@/types";

export type AgendaDateFilterMode = "all" | "day" | "range" | "year";
export type AgendaModalityFilter = "online" | "presencial";

export interface AgendaFilterState {
  patientIds: string[];
  dateMode: AgendaDateFilterMode;
  day: string;
  rangeStart: string;
  rangeEnd: string;
  year: string;
  statuses: AppointmentStatus[];
  modalities: AgendaModalityFilter[];
  origins: AppointmentOrigin[];
}

export interface AgendaPatientFilterOption {
  id: string;
  name: string;
}

export const createEmptyAgendaFilters = (referenceDate = new Date()): AgendaFilterState => {
  const dateKey = format(referenceDate, "yyyy-MM-dd");
  return {
    patientIds: [],
    dateMode: "all",
    day: dateKey,
    rangeStart: dateKey,
    rangeEnd: dateKey,
    year: format(referenceDate, "yyyy"),
    statuses: [],
    modalities: [],
    origins: [],
  };
};

export const getAgendaAppointmentOrigin = (appointment: Appointment): AppointmentOrigin => {
  if (isWaitlistAppointment(appointment)) return "waitlist";

  const metadata = getAppointmentMetadata(appointment);
  if (metadata.origin === "google" || appointment.google_event_id) return "google";
  return "neuronex";
};

export const getAgendaPatientFilterOptions = (
  appointments: Appointment[],
): AgendaPatientFilterOption[] => {
  const options = new Map<string, AgendaPatientFilterOption>();

  appointments.forEach((appointment) => {
    if (!appointment.patient_id || !appointment.patient_name?.trim()) return;
    options.set(appointment.patient_id, {
      id: appointment.patient_id,
      name: appointment.patient_name.trim(),
    });
  });

  return [...options.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }),
  );
};

const matchesDateFilter = (appointment: Appointment, filters: AgendaFilterState) => {
  if (filters.dateMode === "all") return true;

  const appointmentDate = format(new Date(appointment.start_time), "yyyy-MM-dd");

  if (filters.dateMode === "day") return appointmentDate === filters.day;
  if (filters.dateMode === "year") return appointmentDate.startsWith(`${filters.year}-`);

  if (!filters.rangeStart || !filters.rangeEnd) return true;
  const rangeStart = filters.rangeStart <= filters.rangeEnd ? filters.rangeStart : filters.rangeEnd;
  const rangeEnd = filters.rangeStart <= filters.rangeEnd ? filters.rangeEnd : filters.rangeStart;
  return appointmentDate >= rangeStart && appointmentDate <= rangeEnd;
};

export const filterAgendaAppointments = (
  appointments: Appointment[],
  filters: AgendaFilterState,
) =>
  appointments.filter((appointment) => {
    const normalizedStatus = normalizeAppointmentStatus(appointment.status, appointment.notes);

    // The default agenda remains operational: cancelled items only return when
    // the professional explicitly asks for a cancellation status.
    if (filters.statuses.length === 0 && isCancelledAppointmentStatus(normalizedStatus)) {
      return false;
    }

    if (
      filters.patientIds.length > 0
      && (!appointment.patient_id || !filters.patientIds.includes(appointment.patient_id))
    ) {
      return false;
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(normalizedStatus)) {
      return false;
    }

    if (
      filters.modalities.length > 0
      && !filters.modalities.includes(appointment.type as AgendaModalityFilter)
    ) {
      return false;
    }

    if (
      filters.origins.length > 0
      && !filters.origins.includes(getAgendaAppointmentOrigin(appointment))
    ) {
      return false;
    }

    return matchesDateFilter(appointment, filters);
  });

export const countActiveAgendaFilterGroups = (filters: AgendaFilterState) =>
  [
    filters.patientIds.length > 0,
    filters.dateMode !== "all",
    filters.statuses.length > 0,
    filters.modalities.length > 0,
    filters.origins.length > 0,
  ].filter(Boolean).length;

export const validateAgendaDateFilter = (filters: AgendaFilterState) => {
  if (filters.dateMode === "day" && !filters.day) return "Escolha o dia.";
  if (filters.dateMode === "range" && (!filters.rangeStart || !filters.rangeEnd)) {
    return "Preencha o início e o fim do intervalo.";
  }
  if (filters.dateMode === "year" && !/^\d{4}$/.test(filters.year)) {
    return "Informe um ano com quatro dígitos.";
  }
  return null;
};
