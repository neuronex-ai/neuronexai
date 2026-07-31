import { describe, expect, it } from "vitest";
import { toUserFacingError } from "@/lib/user-facing-error";
import { EdgeFunctionInvocationError } from "@/lib/invoke-edge-function";

describe("toUserFacingError", () => {
  it("hides Edge Function implementation details", () => {
    const result = toUserFacingError(
      new Error("Failed to send a request to the Edge Function"),
      "payment",
    );

    expect(result.code).toBe("NETWORK_UNAVAILABLE");
    expect(result.message).not.toContain("Edge Function");
    expect(result.message).toContain("conexão");
  });

  it("uses a contextual fallback without exposing database errors", () => {
    const result = toUserFacingError(
      new Error("relation public.secret_table does not exist"),
      "balance",
    );

    expect(result.message).toContain("saldo");
    expect(result.message).not.toContain("secret_table");
  });

  it("preserves a safe financial security challenge instead of calling it a network failure", () => {
    const result = toUserFacingError(new EdgeFunctionInvocationError({
      kind: "http",
      status: 403,
      code: "FINANCIAL_SECURITY_VERIFICATION_REQUIRED",
      message: "Esta ação exige uma validação de segurança da sua conta NeuroFinance.",
    }), "delete");

    expect(result.code).toBe("SECURITY_VERIFICATION_REQUIRED");
    expect(result.title).toBe("Validação de segurança necessária");
    expect(result.message).toContain("NeuroFinance");
    expect(result.message).not.toContain("conexão");
  });

  it("turns a missing patient document into a short actionable message", () => {
    const result = toUserFacingError(new EdgeFunctionInvocationError({
      kind: "http",
      status: 422,
      code: "PATIENT_DOCUMENT_REQUIRED",
      message: "provider rejected cpfCnpj",
    }), "payment");

    expect(result.code).toBe("PATIENT_DOCUMENT_REQUIRED");
    expect(result.title).toBe("Complete o CPF do paciente");
    expect(result.message).toContain("continuar sem cobrança");
    expect(result.message).not.toContain("cpfCnpj");
  });
});
