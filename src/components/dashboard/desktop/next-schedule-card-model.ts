import { getAppointmentKind, getAppointmentMetadata, type AppointmentKind } from "@/lib/appointment-metadata";
import { getAppointmentStatusMeta } from "@/lib/appointment-status";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import type { Appointment } from "@/types";

import { isOnlineAppointment } from "./dashboard-command-center-model";

export type ScheduleStatusTone = "neutral" | "positive" | "warning" | "critical";

export type NextScheduleCardPresentation = {
  kind: AppointmentKind;
  title: string;
  eyebrow: string;
  dateLabel: string;
  timeLabel: string;
  intervalLabel: string;
  modalityLabel: string;
  recurrenceLabel: string | null;
  confirmationLabel: string;
  confirmationTone: ScheduleStatusTone;
  financialValueLabel: string | null;
  financialStatusLabel: string | null;
  financialStatusTone: ScheduleStatusTone;
  locationLabel: string;
  notesLabel: string;
  followingLabel: string | null;
  isOnline: boolean;
  canShare: boolean;
};

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  weekday: "short",
});

const scheduleDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRAZIL_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRAZIL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatTime = (date: Date) => timeFormatter.format(date);
const dateKey = (date: Date) => dateKeyFormatter.format(date);

const tomorrowKey = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const next = new Date(Date.UTC(Number(mapped.year), Number(mapped.month) - 1, Number(mapped.day) + 1, 12));
  return dateKey(next);
};

const formatScheduleDate = (date: Date) => {
  const parts = scheduleDateFormatter.formatToParts(date);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.weekday}, ${mapped.day} de ${mapped.month}`;
};

const normalizeStatus = (value?: string | null) => (value || "").trim().toLowerCase();

const getConfirmationPresentation = (appointment: Appointment) => {
  const lifecycleStatus = normalizeStatus(appointment.lifecycle_status);

  if (["confirmed", "in_progress", "completed", "closed"].includes(lifecycleStatus)) {
    return { label: "Confirmada", tone: "positive" as const };
  }
  if (["awaiting_confirmation", "awaiting_reconfirmation", "invitation_sent", "created"].includes(lifecycleStatus)) {
    return {
      label: lifecycleStatus === "invitation_sent" ? "Convite enviado" : "Aguardando confirmação",
      tone: "warning" as const,
    };
  }
  if (["cancellation_requested", "reschedule_requested"].includes(lifecycleStatus)) {
    return {
      label: lifecycleStatus === "reschedule_requested" ? "Reagendamento solicitado" : "Cancelamento solicitado",
      tone: "critical" as const,
    };
  }

  const fallback = getAppointmentStatusMeta(appointment.status, appointment.notes);
  return { label: fallback.label, tone: "neutral" as const };
};

const getFinancialPresentation = (appointment: Appointment) => {
  const metadata = getAppointmentMetadata(appointment);
  const financial = metadata.financial;
  const amount = financial?.transactionAmount ?? appointment.price ?? null;
  const paymentStatus = normalizeStatus(appointment.payment_status);

  if (financial?.mode === "package" || financial?.usePackage || appointment.package_id) {
    return {
      valueLabel: "Pacote",
      statusLabel: "Sessão vinculada",
      statusTone: "positive" as const,
    };
  }

  if (financial?.mode === "insurance") {
    return {
      valueLabel: typeof amount === "number" && amount > 0 ? currencyFormatter.format(amount) : "Convênio",
      statusLabel: "A receber do convênio",
      statusTone: "neutral" as const,
    };
  }

  if (financial?.mode === "none" && !appointment.financial_entry_id && !appointment.financial_launch_id && !appointment.charge_id) {
    return {
      valueLabel: "Sem valor",
      statusLabel: "Sem lançamento",
      statusTone: "neutral" as const,
    };
  }

  if (["paid", "completed", "received", "settled"].includes(paymentStatus)) {
    return {
      valueLabel: typeof amount === "number" && amount > 0 ? currencyFormatter.format(amount) : "Recebido",
      statusLabel: "Pago",
      statusTone: "positive" as const,
    };
  }

  if (["overdue", "late", "past_due"].includes(paymentStatus)) {
    return {
      valueLabel: typeof amount === "number" && amount > 0 ? currencyFormatter.format(amount) : "Em aberto",
      statusLabel: "Atrasado",
      statusTone: "critical" as const,
    };
  }

  if (["refunded", "reversed", "cancelled", "canceled"].includes(paymentStatus)) {
    return {
      valueLabel: typeof amount === "number" && amount > 0 ? currencyFormatter.format(amount) : "Estornado",
      statusLabel: "Estornado",
      statusTone: "neutral" as const,
    };
  }

  const hasFinancialIntent = Boolean(
    appointment.financial_entry_id
    || appointment.financial_launch_id
    || appointment.charge_id
    || financial?.mode === "manual"
    || financial?.mode === "neurofinance"
    || financial?.transactionId,
  );

  return {
    valueLabel: typeof amount === "number" && amount > 0 ? currencyFormatter.format(amount) : "A definir",
    statusLabel: hasFinancialIntent || paymentStatus ? "Pendente" : "Sem lançamento",
    statusTone: hasFinancialIntent || paymentStatus ? "warning" as const : "neutral" as const,
  };
};

const getFollowingLabel = (followingAppointment?: Appointment) => {
  if (!followingAppointment) return null;

  const start = new Date(followingAppointment.start_time);
  const now = new Date();
  const startKey = dateKey(start);
  const dayLabel = startKey === dateKey(now)
    ? "hoje"
    : startKey === tomorrowKey(now)
      ? `amanhã, ${shortDateFormatter.format(start)}`
      : `${weekdayFormatter.format(start)}, ${shortDateFormatter.format(start)}`;
  const followingTitle = getAppointmentDisplayTitle(followingAppointment)
    || followingAppointment.patient_name
    || (getAppointmentKind(followingAppointment) === "session" ? "Atendimento" : "Compromisso");

  return `Depois: ${followingTitle} · ${dayLabel} às ${formatTime(start)}`;
};

export const buildNextScheduleCardPresentation = (
  appointment: Appointment,
  followingAppointment?: Appointment,
): NextScheduleCardPresentation => {
  const metadata = getAppointmentMetadata(appointment);
  const kind = getAppointmentKind(appointment);
  const isOnline = isOnlineAppointment(appointment);
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const title = getAppointmentDisplayTitle(appointment)
    || appointment.patient_name
    || metadata.eventTitle
    || (kind === "block" ? "Bloqueio de agenda" : kind === "event" ? "Evento geral" : "Atendimento");
  const recurrenceLabel = appointment.series_id || metadata.recurrence?.enabled
    ? appointment.occurrence_number && appointment.occurrence_count
      ? `${appointment.occurrence_number}/${appointment.occurrence_count}`
      : "Recorrência"
    : null;
  const confirmation = kind === "session"
    ? getConfirmationPresentation(appointment)
    : { label: kind === "block" ? "Agenda bloqueada" : "Na agenda", tone: "neutral" as const };
  const financial = kind === "session" ? getFinancialPresentation(appointment) : null;
  const location = metadata.eventLocation || appointment.location || "";

  return {
    kind,
    title,
    eyebrow: kind === "block" ? "Próximo bloqueio" : kind === "event" ? "Próximo evento" : "Próximo atendimento",
    dateLabel: formatScheduleDate(start),
    timeLabel: formatTime(start),
    intervalLabel: `${formatTime(start)}–${formatTime(end)}`,
    modalityLabel: kind === "block" ? "Bloqueio de agenda" : isOnline ? "Online" : "Presencial",
    recurrenceLabel,
    confirmationLabel: confirmation.label,
    confirmationTone: confirmation.tone,
    financialValueLabel: financial?.valueLabel || null,
    financialStatusLabel: financial?.statusLabel || null,
    financialStatusTone: financial?.statusTone || "neutral",
    locationLabel: kind === "block"
      ? "Período reservado"
      : isOnline && kind === "session"
        ? "Sala protegida NeuroNex"
        : location || (isOnline ? "Link do evento" : "Local não informado"),
    notesLabel: metadata.eventNotes?.replace(/\s+/g, " ").trim() || appointment.notes?.replace(/\s+/g, " ").trim() || "",
    followingLabel: kind === "block" ? getFollowingLabel(followingAppointment) : null,
    isOnline,
    canShare: kind === "session" ? isOnline || Boolean(location) : Boolean(location),
  };
};
