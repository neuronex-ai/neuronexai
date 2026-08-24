const sourceUrl = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(sourceUrl);

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("synapse-voice-tool executa action-group em processo e não depende de Edge Function separada", () => {
  for (const required of [
    'from "../synapse-action-group/plan-builder.ts"',
    'from "../synapse-action-group/plan-executor.ts"',
    "prepareAndPersistActionGroup",
    "editPersistedActionGroup",
    "executePersistedActionGroup",
    "rowReviewClientAction",
  ]) {
    equal(source.includes(required), true, `integração interna ${required}`);
  }

  for (const forbidden of [
    'fetch(`${functionsUrl()}/synapse-action-group',
    "/functions/v1/synapse-action-group",
  ]) {
    equal(source.includes(forbidden), false, `dependência HTTP legada ${forbidden}`);
  }
});

Deno.test("prepare_action_group mantém revisão versionada no caminho de voz", () => {
  equal(source.includes('if (name === "prepare_action_group")'), true, "handler do planner");
  equal(source.includes("prepared.pendingAction"), true, "ação pendente persistida");
  equal(source.includes("prepared.clientAction"), true, "revisão enviada ao Desktop");
  equal(source.includes('tool: confirmationPolicy === "opaque" ? "manage_action_group" : "execute_action_group"'), true, "classe de confirmação exposta ao gateway");
  equal(source.includes("utterance: clean(body.utterance, 2000)"), true, "fala corrente chega ao planner");
});
