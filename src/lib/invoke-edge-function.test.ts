import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  EdgeFunctionInvocationError,
  normalizeEdgeFunctionError,
} from "./invoke-edge-function";

describe("normalizeEdgeFunctionError", () => {
  it("exposes the safe Edge Function message instead of the generic SDK text", async () => {
    const error = new FunctionsHttpError(new Response(JSON.stringify({
      error: "Reconecte sua conta Google para enviar pelo Gmail.",
      code: "google_reconnect_required",
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }));

    const normalized = await normalizeEdgeFunctionError(error);

    expect(normalized).toBeInstanceOf(EdgeFunctionInvocationError);
    expect(normalized.message).toBe("Reconecte sua conta Google para enviar pelo Gmail.");
    expect(normalized.code).toBe("google_reconnect_required");
    expect(normalized.status).toBe(503);
    expect(normalized.retryWithSameRequest).toBe(true);
    expect(normalized.message).not.toContain("non-2xx");
  });

  it("uses a fresh request after a definitive validation response", async () => {
    const error = new FunctionsHttpError(new Response(JSON.stringify({
      error: "Paciente sem e-mail válido.",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));

    const normalized = await normalizeEdgeFunctionError(error);

    expect(normalized.message).toBe("Paciente sem e-mail válido.");
    expect(normalized.retryWithSameRequest).toBe(false);
  });

  it.each([
    [new FunctionsFetchError({}), "fetch"],
    [new FunctionsRelayError({}), "relay"],
  ] as const)("preserves the request identity for ambiguous provider failures", async (error, kind) => {
    const normalized = await normalizeEdgeFunctionError(error);

    expect(normalized.kind).toBe(kind);
    expect(normalized.retryWithSameRequest).toBe(true);
    expect(normalized.message).not.toContain("Edge Function");
  });
});
