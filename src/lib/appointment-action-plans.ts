import { supabase } from "@/integrations/supabase/client";
import { getAppointmentPlanErrorMessage } from "@/lib/appointment-action-plan-errors";

export type AppointmentActionPlan = {
  planId: string;
  planVersion: number;
  planHash: string;
  status: string;
  createdAt?: string;
  expiresAt?: string;
  confirmedAt?: string;
  confirmationChannel?: string;
  confirmationRequired?: boolean;
  summary?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

export type AppointmentPlanIssue = {
  code: string;
  message: string;
  field?: string;
  occurrenceNumber?: number;
  source: "agenda" | "financial" | "policy" | "unknown";
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const issueField = (code: string): string | undefined => {
  if (code === "past_time") return "startTime";
  if (["crosses_day", "invalid_interval", "invalid_end_time"].includes(code)) return "endTime";
  if (["appointment_conflict", "slot_conflict", "outside_working_hours", "blocked_time"].includes(code)) {
    return "startTime";
  }
  if (code.includes("package")) return "packageId";
  if (code.includes("payment_method")) return "transactionMethod";
  if (code.includes("financial") || code.includes("amount")) return "transactionAmount";
  return undefined;
};

export const getAppointmentPlanIssues = (plan: Pick<AppointmentActionPlan, "summary">): AppointmentPlanIssue[] => {
  const summary = asRecord(plan.summary);
  const agenda = asRecord(summary.agenda);
  const conflicts = Array.isArray(agenda.conflicts) ? agenda.conflicts : [];
  const agendaIssues = conflicts.map((value): AppointmentPlanIssue => {
    const conflict = asRecord(value);
    const code = String(conflict.reasonCode || "appointment_conflict");
    const occurrence = Number(conflict.occurrenceNumber);
    return {
      code,
      message: String(conflict.reason || "O horário precisa ser revisado."),
      field: issueField(code),
      occurrenceNumber: Number.isInteger(occurrence) && occurrence > 0 ? occurrence : undefined,
      source: "agenda",
    };
  });

  if (agendaIssues.length > 0) return agendaIssues;

  const financial = asRecord(summary.financial);
  const financialCode = String(financial.reasonCode || financial.errorCode || "");
  if (financialCode) {
    return [{
      code: financialCode,
      message: String(financial.reason || financial.impactMessage || "Revise a configuração financeira."),
      field: issueField(financialCode),
      source: "financial",
    }];
  }

  return [{
    code: "review_required",
    message: "Revise os dados destacados antes de continuar.",
    source: "unknown",
  }];
};

export class AppointmentPlanReviewRequiredError extends Error {
  readonly code = "APPOINTMENT_PLAN_REVIEW_REQUIRED";
  readonly plan: AppointmentActionPlan;
  readonly issues: AppointmentPlanIssue[];

  constructor(plan: AppointmentActionPlan) {
    const issues = getAppointmentPlanIssues(plan);
    super(issues[0]?.message || "Revise os dados do agendamento antes de continuar.");
    this.name = "AppointmentPlanReviewRequiredError";
    this.plan = plan;
    this.issues = issues;
  }
}

export const isAppointmentPlanReviewRequiredError = (
  error: unknown,
): error is AppointmentPlanReviewRequiredError =>
  error instanceof AppointmentPlanReviewRequiredError
  || asRecord(error).code === "APPOINTMENT_PLAN_REVIEW_REQUIRED";

export type AppointmentActionOriginChannel =
  | "professional_app"
  | "synapse_text"
  | "synapse_voice"
  | "synapse_whatsapp";

export type AppointmentPlanAction =
  | "create"
  | "reschedule"
  | "cancel"
  | "set_teleconsultation_transcription"
  | "close_teleconsultation";

const toPlan = (value: unknown): AppointmentActionPlan => {
  if (!value || typeof value !== "object") throw new Error("O servidor não retornou um plano válido.");
  const plan = value as Record<string, unknown>;
  if (typeof plan.planId !== "string" || typeof plan.planHash !== "string" || !Number.isInteger(Number(plan.planVersion))) {
    throw new Error("O servidor não retornou uma versão válida do plano.");
  }
  return plan as AppointmentActionPlan;
};

const rpc = async (name: string, params: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name as any, params as any);
  if (error) {
    const action = name.includes("agenda") || name.includes("prepare")
      ? "create"
      : "generic";
    const wrappedError = new Error(getAppointmentPlanErrorMessage(error, action)) as Error & {
      code?: string;
      details?: string;
      hint?: string;
      cause?: unknown;
    };
    wrappedError.code = error.code;
    wrappedError.details = error.details;
    wrappedError.hint = error.hint;
    wrappedError.cause = error;
    throw wrappedError;
  }
  return toPlan(data);
};

export const prepareAppointmentActionPlan = (
  action: AppointmentPlanAction,
  input: Record<string, unknown>,
  idempotencyKey: string,
  originChannel: AppointmentActionOriginChannel = "professional_app",
) => rpc("prepare_appointment_action_plan", {
  p_action: action,
  p_input: input,
  p_provenance: { origin_channel: originChannel },
  p_idempotency_key: idempotencyKey,
});

export const executeAppointmentActionPlan = (
  plan: Pick<AppointmentActionPlan, "planId" | "planVersion" | "planHash">,
  confirmationChannel: AppointmentActionOriginChannel = "professional_app",
) => rpc("execute_appointment_action_plan", {
  p_plan_id: plan.planId,
  p_plan_version: plan.planVersion,
  p_plan_hash: plan.planHash,
  p_confirmation_channel: confirmationChannel,
  p_conversation_id: null,
});

export const executeAgendaActionPlan = (
  plan: Pick<AppointmentActionPlan, "planId" | "planVersion" | "planHash">,
  confirmationChannel: AppointmentActionOriginChannel = "professional_app",
) => rpc("execute_agenda_action_plan", {
  p_plan_id: plan.planId,
  p_plan_version: plan.planVersion,
  p_plan_hash: plan.planHash,
  p_confirmation_channel: confirmationChannel,
});

export const prepareAgendaActionPlan = (
  input: Record<string, unknown>,
  idempotencyKey: string,
  originChannel: AppointmentActionOriginChannel = "professional_app",
) => rpc("prepare_agenda_action_plan", {
  p_action: "create_series_v2",
  p_input: input,
  p_provenance: { origin_channel: originChannel },
  p_idempotency_key: idempotencyKey,
});

export const getAppointmentActionPlan = (planId: string, planVersion?: number | null) =>
  rpc("get_appointment_action_plan_status", {
    p_plan_id: planId,
    p_plan_version: planVersion || null,
  });

export const cancelAppointmentActionPlan = (
  plan: Pick<AppointmentActionPlan, "planId" | "planVersion" | "planHash"> & { conversationId?: string | null },
) => rpc("cancel_appointment_action_plan", {
  p_plan_id: plan.planId,
  p_plan_version: plan.planVersion,
  p_plan_hash: plan.planHash,
  p_conversation_id: plan.conversationId || null,
});

export const prepareAndExecuteAppointmentAction = async (
  action: AppointmentPlanAction,
  input: Record<string, unknown>,
  idempotencyKey: string,
  originChannel: AppointmentActionOriginChannel = "professional_app",
) => {
  const prepared = await prepareAppointmentActionPlan(action, input, idempotencyKey, originChannel);
  if (prepared.status === "review_required") {
    throw new AppointmentPlanReviewRequiredError(prepared);
  }
  if (prepared.status !== "awaiting_confirmation") {
    throw new Error("O plano não está disponível para confirmação. Atualize os dados e tente novamente.");
  }
  const executed = await executeAppointmentActionPlan(prepared, originChannel);
  if (executed.status === "completed") return executed;
  if (executed.status === "awaiting_confirmation" || executed.status === "superseded") {
    throw new Error("Os dados mudaram durante a confirmação. Revise o agendamento atualizado e confirme novamente.");
  }
  throw new Error("O plano não pôde ser executado com segurança.");
};
