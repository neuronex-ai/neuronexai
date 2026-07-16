import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toNeurofinanceOperationError } from "./neurofinance-operation-error.ts";

Deno.test("maps provider security challenges without exposing the provider", () => {
  const error = Object.assign(new Error("Token de autorização obrigatório na Asaas"), {
    status: 403,
  });
  const result = toNeurofinanceOperationError(error);

  assertEquals(result.code, "FINANCIAL_SECURITY_VERIFICATION_REQUIRED");
  assertEquals(result.message.includes("Asaas"), false);
  assertEquals(result.message.includes("NeuroFinance"), true);
});

Deno.test("maps provider validation without returning its raw detail", () => {
  const error = Object.assign(new Error("A cobrança não pode ser removida neste estado"), {
    status: 400,
  });
  const result = toNeurofinanceOperationError(error);

  assertEquals(result.code, "FINANCIAL_ACTION_NOT_ALLOWED");
  assertEquals(result.message.includes("cobrança"), false);
});

Deno.test("never returns identifiers or personal data from provider errors", () => {
  const rawMessage = "CPF 123.456.789-00, chave pix pessoa@exemplo.com e payment_123 são inválidos";
  const error = Object.assign(new Error(rawMessage), { status: 422 });
  const result = toNeurofinanceOperationError(error);

  assertEquals(result.message.includes("123.456.789-00"), false);
  assertEquals(result.message.includes("pessoa@exemplo.com"), false);
  assertEquals(result.message.includes("payment_123"), false);
  assertEquals(result.code, "FINANCIAL_INPUT_REVIEW_REQUIRED");
});

Deno.test("does not leak technical provider details", () => {
  const error = Object.assign(new Error("SQL stack trace at endpoint /payments/uuid"), {
    status: 400,
  });
  const result = toNeurofinanceOperationError(error, "Operação não concluída.");

  assertEquals(
    result.message,
    "Não foi possível concluir esta ação com os dados atuais. Revise as informações ou fale com o suporte da NeuroNex.",
  );
  assertEquals(result.message.includes("SQL"), false);
  assertEquals(result.message.includes("/payments/uuid"), false);
});
