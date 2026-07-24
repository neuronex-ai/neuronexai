type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

const source = (error: unknown) => {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "string") return error.toLowerCase();
  if (error && typeof error === "object") {
    const value = error as ErrorLike;
    return [value.code, value.message, value.details, value.hint]
      .filter((item): item is string => typeof item === "string")
      .join(" ")
      .toLowerCase();
  }
  return "";
};

/** Keeps database/RPC details out of the professional's operational flow. */
export const getProfessionalWaitlistErrorMessage = (
  error: unknown,
  fallback = "Não foi possível atualizar a lista de espera agora.",
) => {
  const value = source(error);

  if (value.includes("suggest_professional_waitlist_slot") || value.includes("schema cache") || value.includes("could not find the function")) {
    return "Estamos atualizando a busca de vagas. Tente novamente em instantes.";
  }

  if (value.includes("já foi aceita") || value.includes("ja foi aceita") || value.includes("status = 'scheduled'") || value.includes("status=scheduled")) {
    return "A vaga já foi aceita e o agendamento está confirmado na Agenda.";
  }

  if (value.includes("não está mais disponível") || value.includes("nao esta mais disponivel") || value.includes("não foi encontrada") || value.includes("nao foi encontrada")) {
    return "Esta entrada não está mais disponível. Atualize a lista para continuar.";
  }

  if (
    value.includes("appointment_slot_holds_professional_id_idempotency_key_key")
    || (value.includes("appointment_slot_holds") && value.includes("idempotency_key"))
  ) {
    return "Esta tentativa de oferta já foi registrada. Revise a vaga antes de oferecê-la novamente.";
  }

  if (value.includes("já possui uma espera ativa") || value.includes("ja possui uma espera ativa") || value.includes("duplicate") || value.includes("23505")) {
    return "Este paciente já possui uma entrada ativa na lista de espera.";
  }

  if (value.includes("horário acabou de ser ocupado") || value.includes("horario acabou de ser ocupado") || value.includes("23p01")) {
    return "Esse horário acabou de ser ocupado. Escolha outra vaga sugerida.";
  }

  if (value.includes("55000") || value.includes("state does not allow") || value.includes("invalid state")) {
    return "Não foi possível concluir essa ação com o estado atual da lista. Atualize a tela e tente novamente.";
  }

  if (value.includes("permission") || value.includes("42501") || value.includes("forbidden") || value.includes("not authorized")) {
    return "Sua conta não tem permissão para alterar esta entrada.";
  }

  if (value.includes("network") || value.includes("failed to fetch") || value.includes("timeout")) {
    return "Não foi possível conectar agora. Verifique sua internet e tente novamente.";
  }

  return fallback;
};
