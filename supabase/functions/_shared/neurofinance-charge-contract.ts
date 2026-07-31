export type NeurofinanceBillingType =
  | "PIX"
  | "CREDIT_CARD"
  | "BOLETO"
  | "UNDEFINED";

const BILLING_TYPE_BY_METHOD: Record<string, NeurofinanceBillingType> = {
  pix: "PIX",
  card: "CREDIT_CARD",
  credit_card: "CREDIT_CARD",
  boleto: "BOLETO",
  patient_decides: "UNDEFINED",
  undefined: "UNDEFINED",
};

export const neurofinanceBillingType = (paymentMethod: unknown) =>
  BILLING_TYPE_BY_METHOD[String(paymentMethod || "patient_decides").toLowerCase()]
    || "UNDEFINED";

export class NeurofinancePatientDocumentRequiredError extends Error {
  readonly code = "PATIENT_DOCUMENT_REQUIRED";
  readonly status = 422;

  constructor() {
    super("Complete o CPF do paciente para gerar a cobrança NeuroFinance.");
    this.name = "NeurofinancePatientDocumentRequiredError";
  }
}

export const requireNeurofinancePatientDocument = (value?: string | null) => {
  const normalized = String(value || "").replace(/\D/g, "");
  if (normalized.length !== 11 || /^0+$/.test(normalized)) {
    throw new NeurofinancePatientDocumentRequiredError();
  }
  return normalized;
};

export const neurofinanceChargeOperationId = (
  payload: {
    operation_id?: string | null;
    financial_entry_id?: string | null;
  },
  createFallback: () => string = () => crypto.randomUUID(),
) => {
  const operationId = String(
    payload.operation_id || payload.financial_entry_id || createFallback(),
  ).trim();
  if (operationId.length < 8 || operationId.length > 120) {
    throw new Error("Identificador da operação inválido.");
  }
  return operationId;
};
