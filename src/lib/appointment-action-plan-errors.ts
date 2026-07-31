type ErrorDetails = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  cause?: unknown;
};

type AppointmentPlanAction = "create" | "reschedule" | "generic";

const collectErrorText = (error: unknown, seen = new Set<unknown>()): string => {
  if (error === null || error === undefined || seen.has(error)) return "";
  if (typeof error === "string") return error.toLowerCase();
  if (typeof error !== "object") return String(error).toLowerCase();

  seen.add(error);
  const value = error as ErrorDetails;
  const ownText = [value.code, value.message, value.details, value.hint]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();

  return `${ownText} ${collectErrorText(value.cause, seen)}`.trim();
};

/**
 * Keeps database and RPC details out of the professional's rescheduling flow.
 * The server remains the authority for protected appointment states; this only
 * turns its expected rejection into an actionable message.
 */
export const getAppointmentPlanErrorMessage = (
  error: unknown,
  action: AppointmentPlanAction = "generic",
) => {
  const value = collectErrorText(error);

  if (value.includes("past_time") || value.includes("data ou o horário já passou")) {
    return "A data ou o horário escolhido já passou. Selecione um horário futuro para continuar.";
  }

  if (
    value.includes("crosses_day")
    || value.includes("invalid_interval")
    || value.includes("horário final")
  ) {
    return "O horário final precisa ser posterior ao horário inicial no mesmo dia.";
  }

  if (
    value.includes("appointment state does not allow")
    || value.includes("state does not allow this action")
    || value.includes("55000")
    || value.includes("invalid state")
  ) {
    return action === "reschedule"
      ? "Este agendamento não pode ser reagendado no estado atual. Atualize a Agenda e tente novamente."
      : "Esta alteração não pode ser concluída com o estado atual do agendamento. Atualize a Agenda e tente novamente.";
  }

  if (
    value.includes("23p01")
    || value.includes("slot conflict")
    || value.includes("schedule conflict")
    || value.includes("overlap")
    || value.includes("already occupied")
  ) {
    return "O horário escolhido acabou de ser ocupado. Escolha outro horário para continuar.";
  }

  if (
    value.includes("not available")
    || value.includes("unavailable")
    || value.includes("availability")
    || value.includes("outside working hours")
  ) {
    return "O novo horário não está disponível na Agenda. Escolha outro horário para continuar.";
  }

  if (
    value.includes("cancelled")
    || value.includes("canceled")
    || value.includes("not found")
    || value.includes("does not exist")
  ) {
    return action === "reschedule"
      ? "Este agendamento não está mais disponível para reagendamento. Atualize a Agenda e tente novamente."
      : "Este agendamento não está mais disponível. Atualize a Agenda e tente novamente.";
  }

  if (
    value.includes("prepare_appointment_action_plan")
    || value.includes("execute_appointment_action_plan")
    || value.includes("execute_agenda_action_plan")
    || value.includes("schema cache")
    || value.includes("could not find the function")
    || value.includes("function digest")
  ) {
    return "Estamos atualizando a Agenda. Tente novamente em instantes.";
  }

  if (
    value.includes("appointment lifecycle")
    || value.includes("database-owned")
    || value.includes("p0001")
  ) {
    return "Não foi possível confirmar o agendamento agora. Nenhuma alteração foi feita; revise e tente novamente.";
  }

  if (
    value.includes("patient_document_required")
    || value.includes("patient_cpf_required")
    || value.includes("cpf")
  ) {
    return "Complete o CPF do paciente para gerar a cobrança NeuroFinance. O agendamento pode ser criado sem cobrança.";
  }

  if (
    value.includes("42501")
    || value.includes("permission")
    || value.includes("forbidden")
    || value.includes("not authorized")
  ) {
    return "Sua conta não tem permissão para alterar este agendamento.";
  }

  if (
    value.includes("failed to fetch")
    || value.includes("network")
    || value.includes("timeout")
  ) {
    return "Não foi possível conectar à Agenda agora. Verifique sua internet e tente novamente.";
  }

  return action === "reschedule"
    ? "Não foi possível preparar o reagendamento agora. Nenhuma alteração foi feita."
    : action === "create"
      ? "Não foi possível criar o agendamento agora. Revise os dados e tente novamente."
      : "Não foi possível concluir esta alteração do agendamento agora. Tente novamente em instantes.";
};
