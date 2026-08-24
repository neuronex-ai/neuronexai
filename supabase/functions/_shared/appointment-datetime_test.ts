import { resolveSpokenAppointmentDateTime } from "./appointment-datetime.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

const reference = new Date("2026-08-24T15:00:00.000Z"); // 12h em Brasília

Deno.test("resolve amanhã e período da tarde para ISO de Brasília", () => {
  equal(
    resolveSpokenAppointmentDateTime("amanhã às 4 da tarde", reference),
    "2026-08-25T16:00:00-03:00",
    "amanhã às quatro da tarde",
  );
});

Deno.test("resolve deslocamento relativo em dias com hora por extenso", () => {
  equal(
    resolveSpokenAppointmentDateTime(
      "daqui 3 dias, às quatro da tarde",
      reference,
    ),
    "2026-08-27T16:00:00-03:00",
    "daqui a três dias",
  );
});

Deno.test("resolve dia e mês narrados sem exigir ano", () => {
  equal(
    resolveSpokenAppointmentDateTime(
      "dia 22 do mês 8, às 14 horas",
      new Date("2026-08-01T15:00:00.000Z"),
    ),
    "2026-08-22T14:00:00-03:00",
    "dia e mês explícitos",
  );
});

Deno.test("leva data sem ano para a próxima ocorrência quando a deste ano passou", () => {
  equal(
    resolveSpokenAppointmentDateTime("dia 22 do mês 8, às 14 horas", reference),
    "2027-08-22T14:00:00-03:00",
    "próxima ocorrência anual",
  );
});

Deno.test("preserva ISO local válido e acrescenta o fuso quando ausente", () => {
  equal(
    resolveSpokenAppointmentDateTime("2026-08-25T16:30", reference),
    "2026-08-25T16:30:00-03:00",
    "ISO local",
  );
});

Deno.test("não inventa horário quando a fala contém somente a data", () => {
  equal(
    resolveSpokenAppointmentDateTime("amanhã", reference),
    null,
    "horário ausente",
  );
});

Deno.test("rejeita uma data de calendário inexistente", () => {
  equal(
    resolveSpokenAppointmentDateTime("dia 31 do mês 2 às 14 horas", reference),
    null,
    "data inválida",
  );
});
