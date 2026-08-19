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

Deno.test("pacote sem mutações não se disfarça de execução", () => {
  assertIncludes("O pacote ficou sem ações executáveis depois dos preflights", "erro recuperável para pacote sem ações");
});

Deno.test("planner recupera somente fatos explícitos recentes da fala do profissional", () => {
  assertIncludes('.eq("role", "user")', "fallback deve ler apenas mensagens do profissional");
  assertIncludes('.from("patients")', "fallback deve comparar com pacientes reais da conta");
  assertIncludes("uniqueFirstMatches.length === 1", "primeiro nome só pode resolver quando for único");
  assertIncludes("rawArgs.patient_name = fallbackPatientName", "patient_name ausente deve reutilizar paciente explícito/durável");
  assertIncludes("explicitAmountFromText", "valor explícito recente deve poder preencher o card financeiro");
  assertIncludes("cento: 100", "parser deve compreender valores falados como cento e cinquenta reais");
  assertExcludes('.eq("role", "assistant")', "fallback não pode escolher paciente apenas porque o Synapse o citou");
});

Deno.test("anotação de prontuário expõe conteúdo editável no card", () => {
  assertIncludes('push("notes", "anotação"', "create_session_note deve mostrar notes para revisão");
});
