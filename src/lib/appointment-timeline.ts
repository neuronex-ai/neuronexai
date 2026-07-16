import { repairMojibake } from "@/lib/text-encoding";

export type AppointmentTimelineVisualKind =
  | "default"
  | "email"
  | "cancel"
  | "reschedule"
  | "financial"
  | "success";

export interface AppointmentTimelineRecord {
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_type: string;
  action_origin: string;
  created_at: string;
}

export interface AppointmentTimelineItem {
  title: string;
  actorName: string;
  channelName: string;
  occurredAt: string;
  statusChange: string | null;
  detail: string | null;
  visualKind: AppointmentTimelineVisualKind;
}

export interface AppointmentTimelineNames {
  patientName?: string | null;
  psychologistName?: string | null;
}

export const repairAppointmentTimelineItem = (
  item: AppointmentTimelineItem,
): AppointmentTimelineItem => ({
  ...item,
  title: repairMojibake(item.title),
  actorName: repairMojibake(item.actorName),
  channelName: repairMojibake(item.channelName),
  statusChange: item.statusChange ? repairMojibake(item.statusChange) : null,
  detail: item.detail ? repairMojibake(item.detail) : null,
});

const EVENT_LABELS: Record<string, string> = {
  appointment_created: "Agendamento criado",
  invitation_sent: "Convite enviado por e-mail",
  awaiting_confirmation: "Aguardando confirmação",
  appointment_reconfirmation_required: "Agendamento alterado; nova confirmação solicitada",
  invitation_opened: "Paciente abriu o convite",
  patient_confirmed: "Paciente confirmou",
  cancellation_requested: "Cancelamento solicitado",
  patient_cancelled: "Paciente cancelou",
  appointment_cancelled: "Agendamento cancelado",
  patient_requested_reschedule: "Paciente solicitou reagendamento",
  psychologist_approved_reschedule: "Reagendamento aprovado",
  psychologist_rejected_reschedule: "Reagendamento recusado",
  appointment_rescheduled: "Data oficial atualizada",
  clinical_status_changed: "Situação clínica atualizada",
  consultation_started: "Consulta iniciada",
  consultation_completed: "Consulta realizada",
  consultation_closed: "Consulta encerrada",
  financial_entry_created: "Cobrança criada",
  financial_launch_created: "Lançamento financeiro criado",
  charge_created: "Cobrança vinculada",
  charge_cancelled: "Cobrança cancelada",
  boleto_generated: "Boleto gerado",
  boleto_viewed: "Paciente visualizou o boleto",
  charge_viewed: "Paciente visualizou a cobrança",
  pix_generated: "PIX gerado",
  payment_paid: "Cobrança paga",
  payment_overdue: "Cobrança vencida",
  payment_expired: "Cobrança expirada",
  payment_failed: "Falha na cobrança",
  payment_refunded: "Pagamento estornado",
  package_session_linked: "Sessão vinculada ao pacote",
  package_sessions_reserved: "Sessão reservada no pacote",
  package_session_consumed: "Sessão consumida do pacote",
  package_reservation_released: "Reserva do pacote liberada",
  package_session_reversed: "Consumo do pacote estornado",
  package_replacement_linked: "Novo pacote vinculado às sessões futuras",
  package_ended_partial: "Pacote encerrado após uso parcial",
  future_charges_preserved: "Cobranças futuras mantidas",
  charge_cancellation_requested: "Cancelamento de cobrança solicitado",
  new_charges_prepared: "Novas cobranças preparadas",
  financial_adjustment_review: "Ajuste financeiro aguardando revisão",
  cancellation_email_sent: "E-mail de cancelamento enviado",
  reschedule_approved_email_sent: "Novo horário enviado ao paciente",
  reschedule_rejected_email_sent: "Recusa enviada ao paciente",
  reschedule_decision_email_failed: "Não foi possível enviar a decisão por e-mail",
  reschedule_decision_email_skipped: "Paciente sem e-mail para receber a decisão",
};

const EVENT_DETAILS: Record<string, string> = {
  invitation_opened: "O link seguro da consulta foi acessado.",
  appointment_reconfirmation_required: "Os detalhes da consulta mudaram e o paciente precisa confirmar esta nova versão.",
  patient_requested_reschedule: "A solicitação aguarda a análise do profissional.",
  psychologist_approved_reschedule: "O novo horário solicitado foi aceito.",
  psychologist_rejected_reschedule: "O agendamento original foi mantido.",
  appointment_rescheduled: "O novo horário passou a ser o horário oficial da consulta.",
  reschedule_approved_email_sent: "Os novos detalhes da consulta foram enviados ao paciente.",
  reschedule_rejected_email_sent: "A decisão foi comunicada ao paciente.",
  package_sessions_reserved: "A sessão foi reservada sem consumir o saldo realizado.",
  package_session_consumed: "O consumo foi registrado para esta ocorrência específica.",
  package_reservation_released: "A reserva futura foi liberada sem alterar sessões já realizadas.",
  package_replacement_linked: "A ocorrência futura passou a ser coberta pelo novo pacote.",
  package_ended_partial: "Sessões realizadas, pagamentos e documentos fiscais anteriores foram preservados.",
  future_charges_preserved: "A cobrança existente foi mantida sem nova chamada ao provedor.",
  charge_cancellation_requested: "O cancelamento será processado antes de qualquer nova cobrança.",
  new_charges_prepared: "A nova cobrança permanece bloqueada até a confirmação do cancelamento anterior.",
  financial_adjustment_review: "A operação exige análise financeira antes de continuar.",
};

const STATUS_LABELS: Record<string, string> = {
  created: "Criado",
  invitation_sent: "Convite enviado",
  awaiting_confirmation: "Aguardando confirmação",
  awaiting_reconfirmation: "Aguardando nova confirmação",
  confirmed: "Confirmado",
  cancellation_requested: "Cancelamento solicitado",
  cancelled: "Cancelado",
  reschedule_requested: "Reagendamento solicitado",
  reschedule_approved: "Reagendamento aprovado",
  reschedule_rejected: "Reagendamento recusado",
  in_progress: "Em atendimento",
  completed: "Realizado",
  closed: "Encerrado",
};

const CHANNEL_LABELS: Record<string, string> = {
  public_appointment: "Link seguro do paciente",
  professional_app: "Painel da NeuroNex",
  email_delivery: "Automação de e-mail",
  patient_portal: "Portal do paciente",
  google_calendar: "Google Agenda",
  provider_webhook: "Integração financeira segura",
  database_trigger: "Automação da NeuroNex",
  edge_function: "Automação da NeuroNex",
  system: "Automação da NeuroNex",
  migration: "Automação da NeuroNex",
};

const cleanName = (name: string | null | undefined) =>
  name?.trim() ? repairMojibake(name.trim()) : null;

const actorName = (actorType: string, names: AppointmentTimelineNames) => {
  if (actorType === "patient") return cleanName(names.patientName) || "Paciente";
  if (actorType === "psychologist") {
    return cleanName(names.psychologistName) || "Psicólogo responsável";
  }
  return "NeuroNex";
};

const channelName = (origin: string) => CHANNEL_LABELS[origin] || "NeuroNex";

const statusLabel = (status: string | null) => (status ? STATUS_LABELS[status] || null : null);

const statusChange = (fromStatus: string | null, toStatus: string | null) => {
  const from = statusLabel(fromStatus);
  const to = statusLabel(toStatus);
  if (!from && !to) return null;
  if (from === to) return null;
  if (!from) return `Situação atual: ${to}`;
  if (!to) return `Situação anterior: ${from}`;
  return `${from} → ${to}`;
};

const visualKind = (eventType: string): AppointmentTimelineVisualKind => {
  if (eventType.includes("email") || eventType.includes("invitation")) return "email";
  if (eventType.includes("cancel")) return "cancel";
  if (eventType.includes("reschedule")) return "reschedule";
  if (
    eventType.includes("payment") ||
    eventType.includes("financial") ||
    eventType.includes("charge") ||
    eventType.includes("pix") ||
    eventType.includes("boleto") ||
    eventType.includes("package")
  ) {
    return "financial";
  }
  if (
    eventType.includes("confirm") ||
    eventType.includes("completed") ||
    eventType.includes("closed") ||
    eventType.includes("approved")
  ) {
    return "success";
  }
  return "default";
};

export function toSafeAppointmentTimeline(
  records: readonly AppointmentTimelineRecord[],
  names: AppointmentTimelineNames = {},
): AppointmentTimelineItem[] {
  return records.map((record) => repairAppointmentTimelineItem({
    title: EVENT_LABELS[record.event_type] || "Atualização do agendamento",
    actorName: actorName(record.actor_type, names),
    channelName: channelName(record.action_origin),
    occurredAt: record.created_at,
    statusChange: statusChange(record.from_status, record.to_status),
    detail: EVENT_DETAILS[record.event_type] || null,
    visualKind: visualKind(record.event_type),
  }));
}
