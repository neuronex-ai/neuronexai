import {
  GoogleCalendarConnectionRequiredError,
  GoogleCalendarProviderError,
  syncCommittedAppointmentToGoogle,
} from "./google-calendar-provider.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${String(expected)}, recebido ${String(actual)}`);
  }
};

const appointment = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  patient_id: null,
  start_time: "2026-08-05T15:00:00.000Z",
  end_time: "2026-08-05T15:50:00.000Z",
  type: "block",
  status: "confirmed",
  lifecycle_status: "confirmed",
  notes: "Compromisso",
  location: null,
  google_meet_link: null,
  google_event_id: null,
  metadata: { kind: "event", eventTitle: "Compromisso" },
  confirmation_revision: 1,
};

const queryReturning = (result: { data: unknown; error: unknown }) => {
  const query = {
    select: () => query,
    update: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve(result),
  };
  return query;
};

const mockDb = (token: Record<string, unknown> | null) => ({
  from(table: string) {
    if (table === "appointments") {
      return queryReturning({ data: appointment, error: null });
    }
    if (table === "user_google_tokens") {
      return queryReturning({ data: token, error: null });
    }
    throw new Error(`Tabela inesperada no teste: ${table}`);
  },
});

const expectRejectedWith = async (
  operation: Promise<unknown>,
  expected: new (...args: never[]) => Error,
) => {
  try {
    await operation;
  } catch (error) {
    if (error instanceof expected) return error;
    throw error;
  }
  throw new Error(`Era esperado erro ${expected.name}.`);
};

Deno.test("Google ausente mantém o compromisso local e pede conexão sem chamar o provedor", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (() => {
    fetchCalls += 1;
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;

  try {
    await expectRejectedWith(
      syncCommittedAppointmentToGoogle({
        db: mockDb(null),
        professionalId: appointment.user_id,
        appointmentId: appointment.id,
        operation: "create",
      }),
      GoogleCalendarConnectionRequiredError,
    );
    equal(fetchCalls, 0, "o Google não deve ser chamado sem uma conexão configurada");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("cancelamento usa id determinístico e classifica falhas transitórias do Google", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    urls.push(String(input));
    return Promise.resolve(new Response("indisponível", { status: 503 }));
  }) as typeof fetch;

  try {
    const error = await expectRejectedWith(
      syncCommittedAppointmentToGoogle({
        db: mockDb({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_at: "2099-01-01T00:00:00.000Z",
        }),
        professionalId: appointment.user_id,
        appointmentId: appointment.id,
        operation: "cancel",
      }),
      GoogleCalendarProviderError,
    ) as GoogleCalendarProviderError;

    equal(error.status, 503, "status do provedor");
    equal(error.retryable, true, "falha 503 deve aceitar retry");
    equal(urls.length, 1, "quantidade de chamadas ao provedor");
    if (!urls[0].includes("/events/a") || !urls[0].endsWith("?sendUpdates=all")) {
      throw new Error(`URL de cancelamento não determinística: ${urls[0]}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("token expirado com refresh recusado vira reconexão, não retry cego", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response("invalid_grant", { status: 401 }))) as typeof fetch;

  try {
    await expectRejectedWith(
      syncCommittedAppointmentToGoogle({
        db: mockDb({
          access_token: "expired",
          refresh_token: "refresh-token",
          expires_at: "2020-01-01T00:00:00.000Z",
        }),
        professionalId: appointment.user_id,
        appointmentId: appointment.id,
        operation: "update",
      }),
      GoogleCalendarConnectionRequiredError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
