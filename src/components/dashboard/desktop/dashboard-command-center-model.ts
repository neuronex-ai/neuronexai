import { isAfter, isSameDay } from "date-fns";

import type { Appointment } from "@/types";
import { getAppointmentKind } from "@/lib/appointment-metadata";
import { isCancelledAppointmentStatus, normalizeAppointmentStatus } from "@/lib/appointment-status";
import { getAppointmentDisplayTitle } from "@/lib/appointment-utils";
import { polishPortugueseUiText } from "@/lib/portuguese-ui-text";

export type DashboardNotificationSeverity = "success" | "info" | "warning" | "destructive";

export type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  severity: DashboardNotificationSeverity;
  priority?: string | null;
  category?: string | null;
  actionUrl?: string | null;
  createdAt?: string | null;
  isRead?: boolean;
};

export type AttentionQueueCategory = "sessions" | "appointments" | "registrations" | "neurofinance" | "system";

export type AttentionQueueItem = {
  id: string;
  label: string;
  title: string;
  description: string;
  actionUrl: string;
  tone: "default" | "warning" | "destructive";
  source: "notification" | "patients" | "finance" | "appointment";
  category: AttentionQueueCategory;
};

export type ManagerialMetrics = {
  income?: number | null;
  expense?: number | null;
  result?: number | null;
  receivable?: number | null;
  payable?: number | null;
};

export type NeurofinanceSnapshot = {
  available_balance?: number | null;
  pending_receivables?: number | null;
};

export type FinancialSignal = {
  statusLabel: string;
  statusTone: "default" | "success" | "warning";
  ctaLabel: string;
  ctaPath: string;
  result: number;
  receivable: number;
  bankBalanceCents: number | null;
  bankPendingCents: number | null;
};

export type PaginatedAttentionItems = {
  items: AttentionQueueItem[];
  pageIndex: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const severityRank: Record<DashboardNotificationSeverity, number> = {
  destructive: 0,
  warning: 1,
  info: 2,
  success: 3,
};

const priorityRank = (priority?: string | null) => {
  const value = priority?.toLowerCase();
  if (value === "urgent") return 0;
  if (value === "high") return 1;
  if (value === "normal") return 2;
  return 3;
};

const normalizeSearchText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const includesAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

export const getNotificationQueueCategory = (notification: DashboardNotification): AttentionQueueCategory => {
  const text = normalizeSearchText(
    [notification.category, notification.title, notification.message, notification.actionUrl].filter(Boolean).join(" "),
  );

  if (includesAny(text, ["neurofinance", "financeiro", "pix", "boleto", "cobranca", "pagamento", "conta"])) {
    return "neurofinance";
  }

  if (includesAny(text, ["agenda", "agendamento", "reagendamento", "consulta", "confirmou", "cancelou", "cancelamento", "horario"])) {
    return "appointments";
  }

  if (includesAny(text, ["cadastro", "convite", "link", "perfil", "conta criada"])) {
    return "registrations";
  }

  if (includesAny(text, ["anamnese", "diario", "emocao", "resumo", "sessao", "teleconsulta", "paciente", "prontuario"])) {
    return "sessions";
  }

  return "system";
};

export const getAttentionQueueCategoryLabel = (category: AttentionQueueCategory) => {
  const labels: Record<AttentionQueueCategory, string> = {
    sessions: "Sessões",
    appointments: "Agenda",
    registrations: "Cadastros",
    neurofinance: "NeuroFinance",
    system: "Sistema",
  };

  return labels[category];
};

export const getActiveAppointments = (appointments?: Appointment[] | null) =>
  [...(appointments || [])]
    .filter((appointment) => !isCancelledAppointmentStatus(appointment.status, appointment.notes))
    .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime());

export const getTodayAppointments = (appointments: Appointment[], today: Date) =>
  appointments.filter((appointment) => isSameDay(new Date(appointment.start_time), today));

export const isSessionAppointment = (appointment?: Appointment | null) =>
  Boolean(appointment) && getAppointmentKind(appointment!) === "session";

export const isOnlineAppointment = (appointment?: Appointment | null) =>
  Boolean(appointment) && (appointment!.type === "online" || String(appointment!.type) === "teleconsulta" || Boolean(appointment!.google_meet_link));

export const getNextSession = (appointments: Appointment[], now: Date) =>
  appointments.find((appointment) => isSessionAppointment(appointment) && isAfter(new Date(appointment.end_time), now));

export const getNextScheduleItem = (appointments: Appointment[], now: Date) =>
  appointments.find((appointment) => isAfter(new Date(appointment.end_time), now));

export const paginateAttentionItems = (
  items: AttentionQueueItem[],
  requestedPageIndex: number,
  requestedPageSize = 4,
): PaginatedAttentionItems => {
  const pageSize = Number.isFinite(requestedPageSize) ? Math.max(1, Math.floor(requestedPageSize)) : 4;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPageIndex = Number.isFinite(requestedPageIndex) ? Math.max(0, Math.floor(requestedPageIndex)) : 0;
  const pageIndex = Math.min(normalizedPageIndex, totalPages - 1);
  const pageStart = pageIndex * pageSize;

  return {
    items: items.slice(pageStart, pageStart + pageSize),
    pageIndex,
    pageSize,
    totalItems,
    totalPages,
  };
};

export const buildAttentionQueue = ({
  notifications,
  appointments,
  now = new Date(),
  pendingPatients,
  financialConnected,
  financialLoading = false,
  limit = 5,
}: {
  notifications?: DashboardNotification[] | null;
  appointments?: Appointment[] | null;
  now?: Date;
  pendingPatients: number;
  financialConnected: boolean;
  financialLoading?: boolean;
  limit?: number;
}): AttentionQueueItem[] => {
  const notificationLimit = Math.max(3, Math.ceil(limit / 2));
  const appointmentLimit = Math.max(2, Math.ceil(limit / 3));
  const notificationItems = [...(notifications || [])]
    .filter((notification) => !notification.isRead && notification.severity !== "success")
    .sort((left, right) => {
      const bySeverity = severityRank[left.severity] - severityRank[right.severity];
      if (bySeverity !== 0) return bySeverity;

      const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
      if (byPriority !== 0) return byPriority;

      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    })
    .slice(0, notificationLimit)
    .map<AttentionQueueItem>((notification) => {
      const category = getNotificationQueueCategory(notification);

      return {
        id: `notification-${notification.id}`,
        label: getAttentionQueueCategoryLabel(category),
        title: polishPortugueseUiText(notification.title),
        description: polishPortugueseUiText(notification.message),
        actionUrl: notification.actionUrl || "/dashboard",
        tone: notification.severity === "destructive" ? "destructive" : notification.severity === "warning" ? "warning" : "default",
        source: "notification",
        category,
      };
    });

  const items = [...notificationItems];

  const attendanceItems = [...(appointments || [])]
    .filter(
      (appointment) =>
        isSessionAppointment(appointment) &&
        new Date(appointment.end_time).getTime() < now.getTime() &&
        normalizeAppointmentStatus(appointment.status, appointment.notes) === "unscored",
    )
    .slice(0, appointmentLimit)
    .map<AttentionQueueItem>((appointment) => ({
      id: `appointment-score-${appointment.id}`,
      label: "Agenda",
      title: "Pontuar comparecimento",
      description: `${getAppointmentDisplayTitle(appointment) || appointment.patient_name || "Paciente"} ainda precisa de presença ou ausência registrada.`,
      actionUrl: "/agenda",
      tone: "warning",
      source: "appointment",
      category: "appointments",
    }));

  items.push(...attendanceItems);

  if (pendingPatients > 0) {
    items.push({
      id: "pending-patients",
      label: "Cadastros",
      title: "Pacientes em atenção",
      description: `${pendingPatients} cadastro${pendingPatients === 1 ? "" : "s"} ou retorno${pendingPatients === 1 ? "" : "s"} aguardando revisão.`,
      actionUrl: "/pacientes",
      tone: "warning",
      source: "patients",
      category: "registrations",
    });
  }

  if (!financialLoading && !financialConnected) {
    items.push({
      id: "financial-activation",
      label: "Financeiro",
      title: "Ativar NeuroFinance",
      description: "Conclua a ativação para acompanhar recebimentos e cobranças.",
      actionUrl: "/financeiro?view=conta-digital",
      tone: "warning",
      source: "finance",
      category: "neurofinance",
    });
  }

  return items.slice(0, limit);
};

export const buildFinancialSignal = ({
  financialConnected,
  financialLoading = false,
  managerial,
  neuroSnapshot,
}: {
  financialConnected: boolean;
  financialLoading?: boolean;
  managerial?: ManagerialMetrics | null;
  neuroSnapshot?: NeurofinanceSnapshot | null;
}): FinancialSignal => ({
  statusLabel: financialLoading ? "Verificando" : financialConnected ? "NeuroFinance conectado" : "Ativação pendente",
  statusTone: financialLoading ? "default" : financialConnected ? "success" : "warning",
  ctaLabel: financialConnected ? "Abrir conta" : "Ativar",
  ctaPath: "/financeiro?view=conta-digital",
  result: Number(managerial?.result || 0),
  receivable: Number(managerial?.receivable || 0),
  bankBalanceCents: financialConnected ? Number(neuroSnapshot?.available_balance || 0) : null,
  bankPendingCents: financialConnected ? Number(neuroSnapshot?.pending_receivables || 0) : null,
});
