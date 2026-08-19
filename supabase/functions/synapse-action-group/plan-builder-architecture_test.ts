const source = await Deno.readTextFile(new URL("./plan-builder.ts", import.meta.url));

const assertIncludes = (needle: string, message: string) => {
  if (!source.includes(needle)) throw new Error(`${message}: trecho ausente: ${needle}`);
};

const assertExcludes = (needle: string, message: string) => {
  if (source.includes(needle)) throw new Error(`${message}: trecho proibido: ${needle}`);
};

Deno.test("consultas dentro de um pacote viram preflight e não derrubam o grupo", () => {
  assertIncludes('if (policy.executor === "read") continue;', "read-only deve ser omitido da timeline");
  assertExcludes('que é consulta/preflight e não conta como etapa executável.', "read-only não pode lançar o erro legado");
  assertIncludes("const order = steps.length + 1;", "ordem precisa ser renumerada após preflights");
  assertIncludes("stepIdByRawIndex", "dependências precisam sobreviver à filtragem de preflights");
});

Deno.test("cards de agenda editam os argumentos canônicos atuais", () => {
  assertIncludes('push("datetime", "data e horário"', "create_appointment deve editar datetime");
  assertIncludes('push("new_datetime", "nova data e horário"', "reschedule deve editar new_datetime");
});
