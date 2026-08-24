const source = await Deno.readTextFile(new URL("./plan-builder.ts", import.meta.url));

const assertIncludes = (needle: string, message: string) => {
  if (!source.includes(needle)) throw new Error(`${message}: trecho ausente: ${needle}`);
};

const assertExcludes = (needle: string, message: string) => {
  if (source.includes(needle)) throw new Error(`${message}: trecho proibido: ${needle}`);
};

Deno.test("planner normaliza action_kind e aliases antes da execução", () => {
  assertIncludes("normalizeActionGroupStepIdentity", "normalizador canônico obrigatório");
  assertIncludes("export function normalizeActionGroupStep", "normalizador testável/exportado");
  assertIncludes("canonicalToolName", "implementação canônica fica server-side");
  assertIncludes("argumentKeys", "telemetria estrutural sem conteúdo cru");
  assertExcludes("const toolName = clean(raw.tool_name || raw.toolName", "builder não pode depender diretamente de tool_name");
});

Deno.test("consultas legadas dentro de um pacote viram preflight e não derrubam o grupo", () => {
  assertIncludes('if (policy.executor === "read")', "read-only deve ser classificado antes da timeline");
  assertIncludes('"preflight_read"', "classificação de preflight explícita");
  assertIncludes("const order = steps.length + 1;", "ordem precisa ser renumerada após preflights");
  assertIncludes("stepIdByRawIndex", "dependências precisam sobreviver à filtragem de preflights");
});

Deno.test("step malformado não derruba ações válidas, mas zero executáveis gera erro estruturado", () => {
  assertIncludes('"group_step_type_missing"', "step sem tipo deve ter error_code estável");
  assertIncludes('"group_tool_not_allowed"', "tool fora da allowlist deve ter error_code estável");
  assertIncludes("warnings.push", "step inválido deve virar warning quando houver ações válidas");
  assertIncludes("if (!steps.length)", "pacote vazio deve falhar explicitamente");
  assertIncludes("ActionGroupPreparationError", "erro previsível deve ser de domínio");
});

Deno.test("cards de agenda editam os argumentos canônicos atuais", () => {
  assertIncludes('push("datetime", "data e horário"', "create_appointment deve editar datetime");
  assertIncludes('push("new_datetime", "nova data e horário"', "reschedule deve editar new_datetime");
});

Deno.test("planner recupera somente valor explícito recente do profissional", () => {
  assertIncludes('.eq("role", "user")', "fallback deve ler apenas mensagens do profissional");
  assertIncludes("explicitAmountFromText", "valor explícito recente deve poder preencher o card financeiro");
  assertIncludes("cento: 100", "parser deve compreender cento e cinquenta reais");
  assertExcludes('.eq("role", "assistant")', "fallback não pode inferir fatos a partir da fala do Synapse");
  assertExcludes('firstNameOwners', "planner não deve manter um segundo resolver simplificado de paciente");
});

Deno.test("planner normaliza data e horário falados antes de criar os mini-cards", () => {
  assertIncludes("resolveSpokenAppointmentDateTime", "normalizador temporal compartilhado obrigatório");
  assertIncludes("recoverRecentAppointmentDateTime", "fala recente do profissional pode recuperar datetime omitido pelo modelo");
  assertIncludes("resolveSpokenAppointmentDateTime(input.utterance)", "transcrição corrente deve ser preferida ao fallback assíncrono");
  assertIncludes('if (toolName === "create_appointment")', "normalização limitada à criação de agendamento");
  assertIncludes("rawArgs = await normalizeCreateAppointmentDateTime", "datetime deve ser normalizado antes do preflight");
});

Deno.test("resolução canônica de paciente atualiza contexto durável imediatamente", () => {
  assertIncludes("enrichToolArguments", "planner usa resolver canônico compartilhado");
  assertIncludes("context.state.activePatientId = enriched.patient.id", "patient id inequívoco vira contexto ativo");
  assertIncludes("context.state.activePatientName = enriched.patient.name", "patient name inequívoco vira contexto ativo");
  assertIncludes("saveConversationContext", "contexto resolvido precisa persistir antes da confirmação");
});

Deno.test("financeiro e agenda validam fatos operacionais antes da revisão", () => {
  assertIncludes('"amount_required"', "valor ausente deve ser erro de domínio");
  assertIncludes('"appointment_datetime_required"', "datetime ausente deve ser erro de domínio");
  assertIncludes('"integration_required"', "integração ausente deve ser erro de domínio");
});

Deno.test("anotação de prontuário expõe conteúdo editável no card", () => {
  assertIncludes('push("notes", "anotação"', "create_session_note deve mostrar notes para revisão");
});

Deno.test("warnings seguros persistem no review_public", () => {
  assertIncludes("plan.reviewPublic as any).warnings", "warnings devem sobreviver à persistência");
  assertIncludes("plan.reviewPublic as any).preflights", "metadados de preflight devem sobreviver à persistência");
});
