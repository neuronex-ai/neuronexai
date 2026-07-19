import { supabase } from "@/integrations/supabase/client";

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
    const details = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .map(String)
      .join(" ");
    const wrappedError = new Error(`RPC ${name} falhou${details ? `: ${details}` : "."}`) as Error & {
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
  action: "create" | "reschedule" | "cancel",
  input: Record<string, unknown>,
  idempotencyKey: string,
) => rpc("prepare_appointment_action_plan", {
  p_action: action,
  p_input: input,
  p_provenance: { origin_channel: "professional_app" },
  p_idempotency_key: idempotencyKey,
});

export const executeAppointmentActionPlan = (
  plan: Pick<AppointmentActionPlan, "planId" | "planVersion" | "planHash">,
) => rpc("execute_appointment_action_plan", {
  p_plan_id: plan.planId,
  p_plan_version: plan.planVersion,
  p_plan_hash: plan.planHash,
  p_confirmation_channel: "professional_app",
  p_conversation_id: null,
});

export const executeAgendaActionPlan = (
  plan: Pick<AppointmentActionPlan, "planId" | "planVersion" | "planHash">,
) => rpc("execute_agenda_action_plan", {
  p_plan_id: plan.planId,
  p_plan_version: plan.planVersion,
  p_plan_hash: plan.planHash,
  p_confirmation_channel: "professional_app",
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
  action: "create" | "reschedule" | "cancel",
  input: Record<string, unknown>,
  idempotencyKey: string,
) => {
  const prepared = await prepareAppointmentActionPlan(action, input, idempotencyKey);
  if (prepared.status === "review_required") {
    throw new Error("O impacto financeiro ou fiscal precisa de revisão antes desta alteração.");
  }
  if (prepared.status !== "awaiting_confirmation") {
    throw new Error("O plano não está disponível para confirmação. Atualize os dados e tente novamente.");
  }
  const executed = await executeAppointmentActionPlan(prepared);
  if (executed.status === "completed") return executed;
  if (executed.status === "awaiting_confirmation" || executed.status === "superseded") {
    throw new Error("Os dados mudaram durante a confirmação. Revise o agendamento atualizado e confirme novamente.");
  }
  throw new Error("O plano não pôde ser executado com segurança.");
};
