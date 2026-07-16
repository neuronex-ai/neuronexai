import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type EdgeFunctionErrorKind = "http" | "relay" | "fetch" | "unknown";

export class EdgeFunctionInvocationError extends Error {
  readonly kind: EdgeFunctionErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly retryWithSameRequest: boolean;

  constructor(params: {
    message: string;
    kind: EdgeFunctionErrorKind;
    status?: number | null;
    code?: string | null;
    retryWithSameRequest?: boolean;
  }) {
    super(params.message);
    this.name = "EdgeFunctionInvocationError";
    this.kind = params.kind;
    this.status = params.status ?? null;
    this.code = params.code ?? null;
    this.retryWithSameRequest = params.retryWithSameRequest ?? false;
  }
}

const contextOf = (error: unknown) =>
  typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: unknown }).context
    : undefined;

const responseStatus = (context: unknown) =>
  typeof context === "object" && context !== null && "status" in context &&
      typeof (context as { status?: unknown }).status === "number"
    ? (context as { status: number }).status
    : null;

async function edgePayload(context: unknown) {
  if (!context || typeof context !== "object" || !("json" in context)) {
    return null;
  }

  try {
    const readable = "clone" in context && typeof context.clone === "function"
      ? context.clone()
      : context;
    const body = await (readable as { json: () => Promise<unknown> }).json();
    return body && typeof body === "object"
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

const payloadText = (payload: Record<string, unknown> | null) => {
  const value = payload?.error || payload?.message;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const payloadCode = (payload: Record<string, unknown> | null) =>
  typeof payload?.code === "string" && payload.code.trim()
    ? payload.code.trim()
    : null;

export async function normalizeEdgeFunctionError(
  error: unknown,
  fallbackMessage = "Não foi possível concluir esta operação.",
) {
  const context = contextOf(error);

  if (
    error instanceof FunctionsHttpError ||
    error instanceof Error && error.name === "FunctionsHttpError"
  ) {
    const status = responseStatus(context);
    const payload = await edgePayload(context);
    const message = payloadText(payload) || (status === 401
      ? "Sua sessão expirou. Entre novamente e tente de novo."
      : status === 403
      ? "Sua conta não tem permissão para concluir esta operação."
      : status === 429
      ? "Muitas tentativas em sequência. Aguarde um instante e tente novamente."
      : fallbackMessage);

    return new EdgeFunctionInvocationError({
      message,
      kind: "http",
      status,
      code: payloadCode(payload),
      // A resposta 5xx pode ocorrer depois que um provedor externo aceitou a
      // operação. Repetir a mesma chave mantém a tentativa idempotente.
      retryWithSameRequest: status === null || status >= 500,
    });
  }

  if (
    error instanceof FunctionsRelayError ||
    error instanceof Error && error.name === "FunctionsRelayError"
  ) {
    return new EdgeFunctionInvocationError({
      message: "O serviço está temporariamente indisponível. Tente novamente em instantes.",
      kind: "relay",
      retryWithSameRequest: true,
    });
  }

  if (
    error instanceof FunctionsFetchError ||
    error instanceof Error && error.name === "FunctionsFetchError"
  ) {
    return new EdgeFunctionInvocationError({
      message: "Não foi possível alcançar o serviço. Verifique sua conexão e tente novamente.",
      kind: "fetch",
      retryWithSameRequest: true,
    });
  }

  return new EdgeFunctionInvocationError({
    message: error instanceof Error && error.message &&
        !error.message.includes("Edge Function returned")
      ? error.message
      : fallbackMessage,
    kind: "unknown",
  });
}

export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw await normalizeEdgeFunctionError(error);
  if (data?.error) throw new Error(data.error);
  return data as T;
}
