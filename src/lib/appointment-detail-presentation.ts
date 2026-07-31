import type { Appointment } from "@/types";
import {
  getAppointmentMetadata,
  isWaitlistAppointmentMetadata,
} from "@/lib/appointment-metadata";
import { normalizeAppointmentStatus } from "@/lib/appointment-status";

export type AppointmentRecurrencePosition = {
  current: number;
  total: number | null;
  label: string;
  accessibleLabel: string;
};

const positiveInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

export const getAppointmentDetailStatusLabel = (appointment: Appointment) => {
  const clinicalStatus = normalizeAppointmentStatus(appointment.status, appointment.notes);
  if (clinicalStatus === "attended") return "Realizado";
  if (clinicalStatus === "absent") return "Ausência";
  if (clinicalStatus === "cancelled_by_patient") return "Cancelado pelo paciente";
  if (clinicalStatus === "cancelled_by_professional") return "Cancelado";

  const metadata = getAppointmentMetadata(appointment);
  const waitlistAccepted = isWaitlistAppointmentMetadata(metadata)
    && Boolean(metadata.waitlistAcceptedAt || metadata.acceptedAt);
  const lifecycleStatus = waitlistAccepted
    ? "confirmed"
    : String(appointment.lifecycle_status || "created");

  switch (lifecycleStatus) {
    case "invitation_sent":
    case "awaiting_confirmation":
      return "Aguardando confirmação";
    case "awaiting_reconfirmation":
      return "Aguardando nova confirmação";
    case "confirmed":
    case "reschedule_approved":
    case "reschedule_rejected":
      return "Confirmado";
    case "cancellation_requested":
      return "Cancelamento solicitado";
    case "cancelled":
      return "Cancelado";
    case "reschedule_requested":
      return "Reagendamento solicitado";
    case "in_progress":
      return "Em atendimento";
    case "completed":
    case "closed":
      return "Realizado";
    case "professional_response_overdue":
      return "Resposta pendente";
    default:
      break;
  }

  if (
    appointment.confirmed_at
    && positiveInteger(appointment.confirmed_revision)
    && appointment.confirmed_revision === appointment.confirmation_revision
  ) {
    return "Confirmado";
  }

  return "Pendente";
};

export const getAppointmentOriginLabel = (appointment: Appointment) => {
  const origin = getAppointmentMetadata(appointment).origin;
  if (origin === "waitlist") return "Lista de espera";
  if (origin === "google") return "Google Agenda";
  return "NeuroNex";
};

export const getAppointmentRecurrencePosition = (
  appointment: Appointment,
): AppointmentRecurrencePosition | null => {
  const metadata = getAppointmentMetadata(appointment);
  const configuredTotal = positiveInteger(
    appointment.occurrence_count || metadata.recurrence?.count,
  );
  const recurring = Boolean(
    appointment.series_id
    || metadata.recurrence?.enabled
    || (configuredTotal && configuredTotal > 1),
  );
  if (!recurring) return null;

  const current = positiveInteger(appointment.occurrence_number) || 1;
  const total = configuredTotal && configuredTotal >= current ? configuredTotal : null;

  return {
    current,
    total,
    label: `${current} / ${total || "∞"}`,
    accessibleLabel: total
      ? `${current} de ${total}`
      : `${current} de uma recorrência sem limite`,
  };
};
