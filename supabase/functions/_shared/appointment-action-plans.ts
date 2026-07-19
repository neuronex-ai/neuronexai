export type AppointmentPlanChannel =
  | "synapse_text"
  | "synapse_voice"
  | "synapse_whatsapp"
  | "professional_app";

export type AppointmentPlanReference = {
  planId: string;
  planVersion: number;
  planHash: string;
  status: string;
  createdAt?: string;
  expiresAt?: string;
  summary?: Record<string, unknown>;
  result?: Record<string, unknown>;
  confirmationRequired?: boolean;
};

export type AppointmentPlanContext = {
  admin: any;
  userId: string;
  sessionId?: string | null;
  channel?: string | null;
  voiceSessionId?: string | null;
  whatsappMessageId?: string | null;
  toolCallId?: string | null;
  correlationId?: string | null;
};

export type AppointmentPlanAction =
  | "create"
  | "reschedule"
  | "cancel"
  | "set_teleconsultation_transcription"
  | "close_teleconsultation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAN_HASH = /^[0-9a-f]{64}$/;

export function normalizeAppointmentPlanChannel(channel?: string | null): AppointmentPlanChannel {
  switch (String(channel || "").toLowerCase()) {
    case "panel":
    case "text":
    case "synapse_text":
      return "synapse_text";
    case "voice":
    case "synapse_voice":
      return "synapse_voice";
    case "whatsapp":
    case "synapse_whatsapp":
      return "synapse_whatsapp";
    default:
      return "professional_app";
  }
}

function nullableUuid(value?: string | null) {
  if (!value) return null;
  if (!UUID.test(value)) throw new Error("Contexto do plano inválido.");
  return value;
}

function assertReference(reference: Pick<AppointmentPlanReference, "planId" | "planVersion" | "planHash">) {
  if (!UUID.test(reference.planId) || !Number.isInteger(reference.planVersion) || reference.planVersion < 1) {
    throw new Error("Referência do plano inválida.");
  }
  if (!PLAN_HASH.test(String(reference.planHash || "").toLowerCase())) {
    throw new Error("Versão do plano inválida.");
  }
}

async function rpc(admin: any, name: string, params: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, params);
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("O orquestrador não retornou um plano válido.");
  return data as AppointmentPlanReference;
}

function provenance(context: AppointmentPlanContext, toolName: string) {
  return {
    origin_channel: normalizeAppointmentPlanChannel(context.channel),
    conversation_id: nullableUuid(context.sessionId),
    voice_session_id: nullableUuid(context.voiceSessionId),
    whatsapp_message_id: context.whatsappMessageId || null,
    tool_call: toolName,
    correlation_id: context.correlationId || context.toolCallId || null,
  };
}

export async function prepareAppointmentActionPlan(
  context: AppointmentPlanContext,
  toolName: string,
  action: AppointmentPlanAction,
  input: Record<string, unknown>,
  idempotencyKey: string,
) {
  return rpc(context.admin, "prepare_appointment_action_plan_internal", {
    p_actor_user_id: context.userId,
    p_action: action,
    p_input: input,
    p_provenance: provenance(context, toolName),
    p_idempotency_key: idempotencyKey,
    p_plan_id: null,
  });
}

export async function prepareAgendaActionPlan(
  context: AppointmentPlanContext,
  toolName: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
) {
  return rpc(context.admin, "prepare_agenda_action_plan_internal", {
    p_actor_user_id: context.userId,
    p_input: input,
    p_provenance: provenance(context, toolName),
    p_idempotency_key: idempotencyKey,
  });
}

export async function executeAppointmentActionPlan(
  context: AppointmentPlanContext,
  reference: Pick<AppointmentPlanReference, "planId" | "planVersion" | "planHash">,
) {
  assertReference(reference);
  return rpc(context.admin, "execute_appointment_action_plan_internal", {
    p_actor_user_id: context.userId,
    p_plan_id: reference.planId,
    p_plan_version: reference.planVersion,
    p_plan_hash: reference.planHash.toLowerCase(),
    p_confirmation_channel: normalizeAppointmentPlanChannel(context.channel),
    p_conversation_id: nullableUuid(context.sessionId),
  });
}

export async function executeAgendaActionPlan(
  context: AppointmentPlanContext,
  reference: Pick<AppointmentPlanReference, "planId" | "planVersion" | "planHash">,
) {
  assertReference(reference);
  return rpc(context.admin, "execute_agenda_action_plan_internal", {
    p_actor_user_id: context.userId,
    p_plan_id: reference.planId,
    p_plan_version: reference.planVersion,
    p_plan_hash: reference.planHash.toLowerCase(),
    p_confirmation_channel: normalizeAppointmentPlanChannel(context.channel),
  });
}

export async function getAppointmentActionPlanStatus(
  context: AppointmentPlanContext,
  planId: string,
  planVersion?: number | null,
) {
  if (!UUID.test(planId)) throw new Error("Plano inválido.");
  return rpc(context.admin, "get_appointment_action_plan_status_internal", {
    p_actor_user_id: context.userId,
    p_plan_id: planId,
    p_plan_version: planVersion || null,
  });
}

export async function cancelAppointmentActionPlan(
  context: AppointmentPlanContext,
  reference: Pick<AppointmentPlanReference, "planId" | "planVersion" | "planHash">,
) {
  assertReference(reference);
  return rpc(context.admin, "cancel_appointment_action_plan_internal", {
    p_actor_user_id: context.userId,
    p_plan_id: reference.planId,
    p_plan_version: reference.planVersion,
    p_plan_hash: reference.planHash.toLowerCase(),
    p_conversation_id: nullableUuid(context.sessionId),
  });
}

export function appointmentPlanSummary(plan: AppointmentPlanReference) {
  const summary = plan.summary || {};
  const agenda = (summary.agenda || {}) as Record<string, unknown>;
  const financial = (summary.financial || {}) as Record<string, unknown>;
  const title = String(summary.title || "Revisar alteração do agendamento");
  const patient = String(agenda.patientName || "paciente selecionado");
  const date = agenda.startTime
    ? new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(String(agenda.startTime)))
    : null;
  const impact = String(financial.impactMessage || "");
  return [title, `Paciente: ${patient}`, date ? `Data: ${date}` : "", impact]
    .filter(Boolean)
    .join(". ");
}
