export type NeurofinanceOperationError = {
  status: number;
  code: string;
  message: string;
};

const textOf = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

function providerMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const record = error as Record<string, unknown>;
  const raw = record.raw && typeof record.raw === "object"
    ? record.raw as Record<string, unknown>
    : {};
  const errors = Array.isArray(raw.errors) ? raw.errors : [];
  const first = errors[0] && typeof errors[0] === "object"
    ? errors[0] as Record<string, unknown>
    : {};

  return textOf(first.description) || textOf(raw.message) ||
    textOf(record.message);
}

export function toNeurofinanceOperationError(
  error: unknown,
  fallback = "Não foi possível concluir esta operação agora.",
): NeurofinanceOperationError {
  const record = error && typeof error === "object"
    ? error as Record<string, unknown>
    : {};
  const status = Number(record.status || 500);
  const providerDetail = providerMessage(error);
  const normalized = providerDetail.toLocaleLowerCase("pt-BR");

  if (
    status === 401 || status === 403 ||
    /(token|autentica|assinatura|duplo fator|2fa|mfa|código de segurança|codigo de seguranca)/i
      .test(providerDetail)
  ) {
    return {
      status: status === 401 ? 401 : 403,
      code: "FINANCIAL_SECURITY_VERIFICATION_REQUIRED",
      message:
        "Esta ação exige uma validação de segurança da sua conta NeuroFinance. Conclua a validação e tente novamente.",
    };
  }

  if (/saldo.*insuficiente|insufficient.*balance/i.test(normalized)) {
    return {
      status: 422,
      code: "INSUFFICIENT_BALANCE",
      message: "O saldo disponível não é suficiente para concluir esta operação.",
    };
  }

  if (/j[aá].*existe|already exists|duplicad/i.test(normalized)) {
    return {
      status: 409,
      code: "FINANCIAL_RESOURCE_ALREADY_EXISTS",
      message: "Esta operação já foi registrada. Atualize a lista para conferir o resultado.",
    };
  }

  if (/n[aã]o pode.*(remov|exclu|cancel)|cannot.*(remove|delete|cancel)|estado.*n[aã]o permite/i.test(normalized)) {
    return {
      status: 409,
      code: "FINANCIAL_ACTION_NOT_ALLOWED",
      message: "Esta ação não está disponível na situação atual do item. Atualize a lista e confira os detalhes.",
    };
  }

  if (/inv[aá]lid|invalid|obrigat|required|formato|format/i.test(normalized)) {
    return {
      status: 422,
      code: "FINANCIAL_INPUT_REVIEW_REQUIRED",
      message: "Revise os dados informados e tente novamente.",
    };
  }

  if (status === 429) {
    return {
      status,
      code: "TOO_MANY_ATTEMPTS",
      message: "Muitas tentativas foram feitas em sequência. Aguarde um instante e tente novamente.",
    };
  }

  if (status === 404) {
    return {
      status,
      code: "FINANCIAL_RESOURCE_NOT_FOUND",
      message: "Este item não está mais disponível. Atualize a lista para conferir a situação atual.",
    };
  }

  if (status === 409) {
    return {
      status,
      code: "FINANCIAL_STATE_CONFLICT",
      message: "A situação deste item mudou. Atualize a lista antes de tentar novamente.",
    };
  }

  if (status >= 400 && status < 500) {
    return {
      status,
      code: "FINANCIAL_VALIDATION_FAILED",
      message: "Não foi possível concluir esta ação com os dados atuais. Revise as informações ou fale com o suporte da NeuroNex.",
    };
  }

  return {
    status: Number.isFinite(status) ? status : 500,
    code: "FINANCIAL_OPERATION_FAILED",
    message: fallback,
  };
}
