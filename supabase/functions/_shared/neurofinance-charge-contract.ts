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
