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

export type AppointmentActionOriginChannel =
  | "professional_app"
  | "synapse_text"
  | "synapse_voice"
  | "synapse_whatsapp";

type AppointmentAction = "create" | "reschedule" | "cancel";

const appointmentActionErrorDetails = (error: unknown) => {
  const values: unknown[] = [error];
  const seen = new Set<unknown>();
  const details: string[] = [];
  let code = "";

  while (values.length) {
    const value = values.shift();
    if (!value || seen.has(value)) continue;
    seen.add(value);

    if (value instanceof Error) {
      details.push(value.message);
      const withCause = value as Error & { cause?: unknown; code?: unknown; details?: unknown; hint?: unknown };
      if (!code && withCause.code) code = String(withCause.code);
      details.push(String(withCause.details || ""), String(withCause.hint || ""));
      if (withCause.cause) values.push(withCause.cause);
      continue;
    }

    if (typeof value === "string") {
      details.push(value);
      continue;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (!code && record.code) code = String(record.code);
      details.push(
        String(record.message || ""),
        String(record.details || ""),
        String(record.hint || ""),
      );
      if (record.cause) values.push(record.cause);
    }
  }

  return {
    code: code.toUpperCase(),
    message: details.filter(Boolean).join(" ").toLowerCase(),
  };
};

export const getPrepareAppointmentActionPlanErrorMessage = (
  error: unknown,
  action: AppointmentAction = "reschedule",
) => {
  const { code, message } = appointmentActionErrorDetails(error);
  const actionLabel = action === "reschedule"
    ? "reagendamento"
    : action === "cancel"
      ? "cancelamento"
      : "agendamento";

  if (
    code === "55000"
    || message.includes("appointment state does not allow this action")
    || message.includes("appointment_state_does_not_allow")
  ) {
    return action === "reschedule"
      ? "Este agendamento não pode ser reagendado no estado atual. Atualize a agenda e confira o status da sessão."
      : `Este ${actionLabel} não está disponível no estado atual. Atualize a agenda e tente novamente.`;
  }

  if (
    message.includes("appointment_time_conflict")
    || message.includes("schedule changed")
    || message.includes("time conflict")
    || message.includes("slot is no longer available")
  ) {
    return "Este horário não está mais disponível. Escolha outro horário e tente novamente.";
  }

  if (
    message.includes("outside availability")
    || message.includes("working hours")
    || message.includes("professional availability")
  ) {
    return "O novo horário está fora da disponibilidade configurada. Escolha outro horário.";
  }

  if (
    code === "PGRST202"
    || code === "42883"
    || message.includes("could not find the function")
    || message.includes("schema cache")
  ) {
    return `O ${actionLabel} está temporariamente indisponível. Tente novamente em instantes.`;
  }

  if (
    message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("timeout")
  ) {
    return "Não foi possível conectar à agenda. Verifique sua conexão e tente novamente.";
  }

  if (code === "42501" || message.includes("permission denied")) {
    return `Sua conta não tem permissão para concluir este ${actionLabel}.`;
  }

  return action === "reschedule"
    ? "Não foi possível preparar o reagendamento. Atualize a agenda e tente novamente."
    : `Não foi possível preparar este ${actionLabel}. Atualize a agenda e tente novamente.`;
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
  action: AppointmentAction,
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
  action: AppointmentAction,
  input: Record<string, unknown>,
  idempotencyKey: string,
  originChannel: AppointmentActionOriginChannel = "professional_app",
) => {
  const prepared = await prepareAppointmentActionPlan(action, input, idempotencyKey, originChannel);
  if (prepared.status === "review_required") {
    throw new Error("O impacto financeiro ou fiscal precisa de revisão antes desta alteração.");
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
