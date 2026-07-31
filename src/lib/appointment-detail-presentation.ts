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
  if (clinicalStatus === "attended") return "Realizada";
  if (clinicalStatus === "absent") return "Ausente";
  if (clinicalStatus === "cancelled_by_patient") return "Cancelada";
  if (clinicalStatus === "cancelled_by_professional") return "Cancelada";

  const metadata = getAppointmentMetadata(appointment);
  const waitlistAccepted = isWaitlistAppointmentMetadata(metadata)
    && Boolean(metadata.waitlistAcceptedAt || metadata.acceptedAt);
  const lifecycleStatus = waitlistAccepted
    ? "confirmed"
    : String(appointment.lifecycle_status || "created");

  switch (lifecycleStatus) {
    case "invitation_sent":
    case "awaiting_confirmation":
      return "Pendente";
    case "awaiting_reconfirmation":
      return "Pendente";
    case "confirmed":
    case "reschedule_approved":
    case "reschedule_rejected":
      return "Confirmada";
    case "cancellation_requested":
      return "Cancelando";
    case "cancelled":
      return "Cancelada";
    case "reschedule_requested":
      return "Reagendando";
    case "in_progress":
      return "Atendimento";
    case "completed":
    case "closed":
      return "Realizada";
    case "professional_response_overdue":
      return "Pendente";
    default:
      break;
  }

  if (
    appointment.confirmed_at
    && positiveInteger(appointment.confirmed_revision)
    && appointment.confirmed_revision === appointment.confirmation_revision
  ) {
    return "Confirmada";
  }

  return "Pendente";
};

export const getAppointmentOriginLabel = (appointment: Appointment) => {
  const metadata = getAppointmentMetadata(appointment);
  if (isWaitlistAppointmentMetadata(metadata)) return "Lista de espera";
  if (metadata.origin === "google" || appointment.google_event_id) return "Google Agenda";
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
