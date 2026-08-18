import {
  cpfStatus,
  googleCapabilitySnapshot,
  isValidBrazilianCpf,
} from "./agenda-action-context.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("CPF seguro retorna apenas estado válido/ausente/inválido", () => {
  equal(isValidBrazilianCpf("529.982.247-25"), true, "CPF de fixture válido");
  equal(cpfStatus("529.982.247-25"), "valid", "estado válido");
  equal(cpfStatus(""), "missing", "estado ausente");
  equal(cpfStatus("111.111.111-11"), "invalid", "sequência repetida inválida");
  equal(cpfStatus("529.982.247-24"), "invalid", "dígito verificador inválido");
});

Deno.test("Google Calendar e Gmail são avaliados separadamente por escopo", () => {
  const now = new Date("2026-08-18T21:00:00.000Z");
  const snapshot = googleCapabilitySnapshot({
    expires_at: "2026-08-18T22:00:00.000Z",
    scope: "openid https://www.googleapis.com/auth/calendar.events",
    updated_at: "2026-08-18T20:00:00.000Z",
  }, now);

  equal(snapshot.calendar.health, "configured", "Calendar configurado");
  equal(snapshot.gmail.health, "scope_missing", "Gmail sem escopo");
  equal(snapshot.calendar.scopePresent, true, "escopo Calendar");
  equal(snapshot.gmail.scopePresent, false, "escopo Gmail");
});

Deno.test("token expirado não é tratado como integração saudável", () => {
  const now = new Date("2026-08-18T21:00:00.000Z");
  const snapshot = googleCapabilitySnapshot({
    expires_at: "2026-08-14T23:22:47.843Z",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
    updated_at: "2026-08-14T22:22:48.867Z",
  }, now);

  equal(snapshot.calendar.health, "token_expired", "Calendar expirado");
  equal(snapshot.gmail.health, "token_expired", "Gmail expirado");
});

Deno.test("ausência de token mantém Calendar e Gmail desconectados", () => {
  const snapshot = googleCapabilitySnapshot(null, new Date("2026-08-18T21:00:00.000Z"));
  equal(snapshot.calendar.health, "not_connected", "Calendar desconectado");
  equal(snapshot.gmail.health, "not_connected", "Gmail desconectado");
});
