import {
  neurofinanceBillingType,
  neurofinanceChargeOperationId,
  requireNeurofinancePatientDocument,
} from "./neurofinance-charge-contract.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${String(expected)}, recebido ${String(actual)}`);
  }
};

Deno.test("NeuroFinance mantém a mesma operação em retries do efeito", () => {
  const payload = {
    operation_id: "appointment:effect:11111111-1111-4111-8111-111111111111",
    financial_entry_id: "22222222-2222-4222-8222-222222222222",
  };

  const first = neurofinanceChargeOperationId(payload);
  const retry = neurofinanceChargeOperationId(payload);
  equal(first, retry, "a operação explícita precisa ser determinística");
  equal(first, payload.operation_id, "operation_id prevalece sobre o lançamento");
});

Deno.test("NeuroFinance usa o lançamento como fallback idempotente", () => {
  const financialEntryId = "22222222-2222-4222-8222-222222222222";
  equal(
    neurofinanceChargeOperationId({ financial_entry_id: financialEntryId }),
    financialEntryId,
    "o lançamento aprovado deve estabilizar a cobrança",
  );
});

Deno.test("Paciente decide é enviado ao provedor sem impor meio de pagamento", () => {
  equal(neurofinanceBillingType("patient_decides"), "UNDEFINED", "paciente decide");
  equal(neurofinanceBillingType(null), "UNDEFINED", "ausência de escolha");
  equal(neurofinanceBillingType("pix"), "PIX", "Pix explícito");
});

Deno.test("NeuroFinance recusa identificador externo curto ou excessivo", () => {
  for (const value of ["short", "x".repeat(121)]) {
    let rejected = false;
    try {
      neurofinanceChargeOperationId({ operation_id: value });
    } catch {
      rejected = true;
    }
    equal(rejected, true, `identificador inválido ${value.length}`);
  }
});

Deno.test("NeuroFinance exige CPF antes de chamar o provedor", () => {
  equal(
    requireNeurofinancePatientDocument("123.456.789-01"),
    "12345678901",
    "o CPF deve ser normalizado",
  );

  for (const value of [null, "", "123", "000.000.000-00"]) {
    let code = "";
    try {
      requireNeurofinancePatientDocument(value);
    } catch (error) {
      code = String((error as { code?: string }).code || "");
    }
    equal(code, "PATIENT_DOCUMENT_REQUIRED", "a falha precisa ser estável e tratável");
  }
});
