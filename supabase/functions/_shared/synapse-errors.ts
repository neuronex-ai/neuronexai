export type SynapseFailureCode =
  | "patient_not_found"
  | "patient_ambiguous"
  | "patient_name_required"
  | "resolver_query_failed"
  | "tool_failed"
  | "client_action_failed"
  | "client_action_timeout";

export class SynapseOperationalError extends Error {
  code: SynapseFailureCode;
  details: Record<string, unknown>;

  constructor(
    code: SynapseFailureCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "SynapseOperationalError";
    this.code = code;
    this.details = details;
  }
}

const clean = (value: unknown, max = 1200) =>
  String(value ?? "").trim().slice(0, max);

export function normalizeSynapseError(
  value: unknown,
  fallbackCode: SynapseFailureCode = "tool_failed",
) {
  if (value instanceof SynapseOperationalError) {
    return {
      code: value.code,
      message: value.message,
      details: value.details,
      technicalMessage: value.message,
    };
  }

  if (value instanceof Error) {
    return {
      code: fallbackCode,
      message: value.message || "Não foi possível concluir a consulta.",
      details: {},
      technicalMessage: value.message,
    };
  }

  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const technicalMessage = clean(
    record.message || record.error || record.details || record.hint || value,
  );
  return {
    code: fallbackCode,
    message: technicalMessage || "Não foi possível concluir a consulta.",
    details: {
      providerCode: clean(record.code, 80) || undefined,
      status: typeof record.status === "number" ? record.status : undefined,
    },
    technicalMessage: technicalMessage || "Unknown operational error",
  };
}
