import type { Appointment } from "@/types";
import {
  getAppointmentDetailStatusLabel,
  getAppointmentOriginLabel,
} from "@/lib/appointment-detail-presentation";
import { isCancelledAppointmentStatus } from "@/lib/appointment-status";

export type AgendaFilterOrigin = "all" | "google" | "neuronex" | "waitlist";
export type AgendaFilterModality = "all" | "online" | "presencial";
export type AgendaFilterStatus =
  | "all"
  | "Pendente"
  | "Confirmada"
  | "Realizada"
  | "Ausente"
  | "Cancelada"
  | "Cancelando"
  | "Reagendando"
  | "Atendimento";

export interface AgendaFilters {
  patientId: string;
  date: string;
  dateFrom: string;
  dateTo: string;
  modality: AgendaFilterModality;
  origin: AgendaFilterOrigin;
  status: AgendaFilterStatus;
}

export const EMPTY_AGENDA_FILTERS: AgendaFilters = {
  patientId: "all",
  date: "",
  dateFrom: "",
  dateTo: "",
  modality: "all",
  origin: "all",
  status: "all",
};

export const countActiveAgendaFilters = (filters: AgendaFilters) =>
  [
    filters.patientId !== "all",
    Boolean(filters.date),
    Boolean(filters.dateFrom || filters.dateTo),
    filters.modality !== "all",
    filters.origin !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

const startOfLocalDate = (value: string) => new Date(`${value}T00:00:00`);
const endOfLocalDate = (value: string) => new Date(`${value}T23:59:59.999`);

export const matchesAgendaFilters = (
  appointment: Appointment,
  filters: AgendaFilters,
) => {
  const visualStatus = getAppointmentDetailStatusLabel(appointment);
  const cancelled = isCancelledAppointmentStatus(
    appointment.status,
    appointment.notes,
  );

  if (filters.status === "all" && cancelled) return false;
  if (
    filters.patientId !== "all"
    && appointment.patient_id !== filters.patientId
  ) return false;
  if (
    filters.modality !== "all"
    && appointment.type !== filters.modality
  ) return false;
  if (filters.status !== "all" && visualStatus !== filters.status) return false;

  const origin = getAppointmentOriginLabel(appointment);
  if (
    (filters.origin === "google" && origin !== "Google Agenda")
    || (filters.origin === "neuronex" && origin !== "NeuroNex")
    || (filters.origin === "waitlist" && origin !== "Lista de espera")
  ) return false;

  const startsAt = new Date(appointment.start_time);
  if (
    filters.date
    && (
      startsAt < startOfLocalDate(filters.date)
      || startsAt > endOfLocalDate(filters.date)
    )
  ) return false;
  if (filters.dateFrom && startsAt < startOfLocalDate(filters.dateFrom)) return false;
  if (filters.dateTo && startsAt > endOfLocalDate(filters.dateTo)) return false;

  return true;
};
