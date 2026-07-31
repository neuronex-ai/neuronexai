import type {
  UserFacingError,
  UserFacingErrorCode,
} from "@/lib/neurofinance-types";

type ErrorContext =
  | "balance"
  | "payment"
  | "transfer"
  | "sync"
  | "save"
  | "load"
  | "delete"
  | "generic";

const contextMessages: Record<ErrorContext, string> = {
  balance: "Não conseguimos atualizar seu saldo agora. Os últimos valores continuam disponíveis.",
  payment: "Não foi possível concluir a cobrança agora. Confira os dados e tente novamente.",
  transfer: "Não foi possível concluir a transferência agora. Nenhum valor foi movimentado.",
  sync: "Não conseguimos atualizar os dados agora. Você pode continuar usando as últimas informações disponíveis.",
  save: "Não conseguimos salvar as alterações agora. Tente novamente em instantes.",
  load: "Não conseguimos carregar estas informações agora. Tente novamente em instantes.",
  delete: "Não conseguimos excluir este item agora. Tente novamente em instantes.",
  generic: "Algo não saiu como esperado. Tente novamente em instantes.",
};

function rawMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return String(value.message || value.error || "");
  }
  return "";
}

function structuredEdgeError(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = error as Record<string, unknown>;
  if (value.name !== "EdgeFunctionInvocationError") return null;
  return {
    message: typeof value.message === "string" ? value.message : "",
    code: typeof value.code === "string" ? value.code : "",
    status: typeof value.status === "number" ? value.status : null,
    kind: typeof value.kind === "string" ? value.kind : "unknown",
  };
}

function createSupportReference() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NX-${time}-${random}`;
}

function classify(message: string): {
  code: UserFacingErrorCode;
  title: string;
  message?: string;
  retryable: boolean;
} {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("patient_document_required")
    || normalized.includes("patient_cpf_required")
    || normalized.includes("cpf do paciente")
  ) {
    return {
      code: "PATIENT_DOCUMENT_REQUIRED",
      title: "Complete o CPF do paciente",
      message: "O NeuroFinance precisa do CPF para gerar a cobrança. Você pode completar o cadastro ou continuar sem cobrança.",
      retryable: true,
    };
  }

  if (
    normalized.includes("validação de segurança") ||
    normalized.includes("duplo fator") ||
    normalized.includes("código de segurança")
  ) {
    return {
      code: "SECURITY_VERIFICATION_REQUIRED",
      title: "Validação de segurança necessária",
      message,
      retryable: true,
    };
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("edge function") ||
    normalized.includes("functionshttperror") ||
    normalized.includes("timeout")
  ) {
    return {
      code: "NETWORK_UNAVAILABLE",
      title: "Conexão interrompida",
      message: "Sua conexão parece instável. Verifique a internet e tente novamente.",
      retryable: true,
    };
  }

  if (
    normalized.includes("jwt") ||
    normalized.includes("session") ||
    normalized.includes("não autenticado") ||
    normalized.includes("unauthorized") ||
    normalized.includes("token expirado") ||
    normalized.includes("expired token")
  ) {
    return {
      code: "SESSION_EXPIRED",
      title: "Entre novamente",
      message: "Sua sessão expirou. Entre novamente para continuar.",
      retryable: false,
    };
  }

  if (
    normalized.includes("permission") ||
    normalized.includes("forbidden") ||
    normalized.includes("row-level security") ||
    normalized.includes("42501")
  ) {
    return {
      code: "PERMISSION_DENIED",
      title: "Ação não permitida",
      message: "Sua conta não tem permissão para concluir esta ação.",
      retryable: false,
    };
  }

  if (
    normalized.includes("duplicate") ||
    normalized.includes("already exists") ||
    normalized.includes("409")
  ) {
    return {
      code: "CONFLICT",
      title: "Ação já registrada",
      message: "Esta ação já foi registrada. Atualize a tela para conferir.",
      retryable: true,
    };
  }

  if (
    normalized.includes("invalid") ||
    normalized.includes("inválid") ||
    normalized.includes("required") ||
    normalized.includes("obrigat")
  ) {
    return {
      code: "VALIDATION_ERROR",
      title: "Confira os dados",
      retryable: true,
    };
  }

  if (
    normalized.includes("503") ||
    normalized.includes("502") ||
    normalized.includes("service unavailable")
  ) {
    return {
      code: "SERVICE_UNAVAILABLE",
      title: "Serviço temporariamente indisponível",
      retryable: true,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    title: "Não foi possível concluir",
    retryable: true,
  };
}

export function toUserFacingError(
  error: unknown,
  context: ErrorContext = "generic",
): UserFacingError {
  const edge = structuredEdgeError(error);
  if (edge) {
    const classification = classify(edge.message);
    const code = edge.code === "FINANCIAL_SECURITY_VERIFICATION_REQUIRED"
      ? "SECURITY_VERIFICATION_REQUIRED"
      : edge.code === "PATIENT_DOCUMENT_REQUIRED" || edge.code === "PATIENT_CPF_REQUIRED"
        ? "PATIENT_DOCUMENT_REQUIRED"
        : classification.code;
    const title = code === "SECURITY_VERIFICATION_REQUIRED"
      ? "Validação de segurança necessária"
      : code === "PATIENT_DOCUMENT_REQUIRED"
        ? "Complete o CPF do paciente"
        : classification.title;
    const message = code === "PATIENT_DOCUMENT_REQUIRED"
      ? "O NeuroFinance precisa do CPF para gerar a cobrança. Você pode completar o cadastro ou continuar sem cobrança."
      : classification.message || contextMessages[context];
    return {
      code,
      title,
      message,
      retryable: edge.kind !== "http" || edge.status === null || edge.status >= 500 || edge.status === 409 || edge.status === 429,
      supportReference: createSupportReference(),
    };
  }

  const classification = classify(rawMessage(error));
  return {
    code: classification.code,
    title: classification.title,
    message: classification.message || contextMessages[context],
    retryable: classification.retryable,
    supportReference: createSupportReference(),
  };
}

export function getUserFacingErrorMessage(
  error: unknown,
  context: ErrorContext = "generic",
) {
  return toUserFacingError(error, context).message;
}
