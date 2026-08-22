import {
  canonicalizeSaoPauloDateTime,
  resolveNaturalSaoPauloDateTime,
} from "./brazil-datetime.ts";

const assertEquals = (actual: unknown, expected: unknown, message = "") => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message ? `${message}: ` : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const reference = new Date("2026-08-22T19:57:00.000Z"); // 16:57 em São Paulo

Deno.test("hoje às 4 da tarde mantém o mesmo dia civil em São Paulo", () => {
  const resolved = resolveNaturalSaoPauloDateTime("agende hoje às 4 da tarde", reference);
  assertEquals(resolved?.iso, "2026-08-22T16:00:00-03:00");
  assertEquals(resolved?.date, "2026-08-22");
  assertEquals(resolved?.time, "16:00");
});

Deno.test("daqui 6 dias às 4 da tarde resolve dia mês ano e hora", () => {
  const resolved = resolveNaturalSaoPauloDateTime("agende daqui 6 dias às 4 da tarde", reference);
  assertEquals(resolved?.iso, "2026-08-28T16:00:00-03:00");
});

Deno.test("daqui seis dias às quatro da tarde também funciona com fala por extenso", () => {
  const resolved = resolveNaturalSaoPauloDateTime("agende daqui seis dias às quatro da tarde", reference);
  assertEquals(resolved?.iso, "2026-08-28T16:00:00-03:00");
});

Deno.test("em 10 dias às 15 horas atravessa mês corretamente", () => {
  const resolved = resolveNaturalSaoPauloDateTime("agende em 10 dias às 15 horas", new Date("2026-08-28T15:00:00.000Z"));
  assertEquals(resolved?.iso, "2026-09-07T15:00:00-03:00");
});

Deno.test("amanhã três da tarde funciona sem preposição às", () => {
  const resolved = resolveNaturalSaoPauloDateTime("amanhã três da tarde", reference);
  assertEquals(resolved?.iso, "2026-08-23T15:00:00-03:00");
});

Deno.test("contagem de sessões não é confundida com hora", () => {
  const resolved = resolveNaturalSaoPauloDateTime("amanhã com recorrência de quatro sessões mensais", reference);
  assertEquals(resolved, null);
});

Deno.test("canonicalização usa a referência explícita para linguagem relativa", () => {
  assertEquals(
    canonicalizeSaoPauloDateTime("daqui 6 dias às 4 da tarde", reference),
    "2026-08-28T16:00:00-03:00",
  );
});
