import {
  actionGroupRow,
  nextGroupStatus,
  prepareSynapseActionGroupPlan,
  publicReviewCards,
  resolveConfirmationPolicy,
  stableJson,
  type SynapseActionGroupStep,
} from "./synapse-action-group.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
};

const step = (index: number, risk: "normal" | "critical" | "neurofinance" = "normal"): SynapseActionGroupStep => ({
  stepId: `step-${index}`,
  order: index,
  area: index % 2 ? "Agenda" : "Financeiro",
  title: `Etapa ${index}`,
  spokenSummary: `Executar etapa ${index}.`,
  actionType: `action_${index}`,
  risk,
  dependencies: index > 1 ? [`step-${index - 1}`] : [],
  expectedEffect: "persist_record",
  editableFields: [{ fieldId: `field-${index}`, label: "Valor", type: "text", value: `valor-${index}` }],
  toolName: `tool_${index}`,
  arguments: { internal_secret_shape: `server-only-${index}` },
});

Deno.test("grupo explícito normal sempre exige mini-cards e confirmação por voz", () => {
  equal(resolveConfirmationPolicy([step(1)]), "voice", "política de uma etapa em grupo explícito");
  equal(resolveConfirmationPolicy([1, 2, 3, 4].map((index) => step(index))), "voice", "política de quatro etapas em grupo explícito");
  equal(resolveConfirmationPolicy([1, 2, 3, 4, 5].map((index) => step(index))), "voice", "política de cinco etapas");
});

Deno.test("ação crítica e NeuroFinance exigem confirmação opaca", () => {
  equal(resolveConfirmationPolicy([step(1, "critical")]), "opaque", "política crítica");
  equal(resolveConfirmationPolicy([step(1, "neurofinance")]), "opaque", "política NeuroFinance");
});

Deno.test("review_public nunca carrega argumentos internos da ferramenta", () => {
  const review = publicReviewCards([step(1)]);
  const serialized = JSON.stringify(review);
  equal(serialized.includes("internal_secret_shape"), false, "argumento interno ausente na revisão");
  equal(serialized.includes("server-only-1"), false, "valor interno ausente na revisão");
});

Deno.test("hash estável ignora ordem de chaves de objetos", () => {
  equal(stableJson({ b: 2, a: { d: 4, c: 3 } }), stableJson({ a: { c: 3, d: 4 }, b: 2 }), "json canônico");
});

async function preparedPlan(steps: SynapseActionGroupStep[]) {
  return await prepareSynapseActionGroupPlan({
    professionalId: "11111111-1111-4111-8111-111111111111",
    conversationId: "22222222-2222-4222-8222-222222222222",
    title: "Pós-sessão completo",
    intent: "post_session_bundle",
    spokenSummary: "Revise as ações preparadas.",
    steps,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
}

Deno.test("persistência não depende de capability_version no schema cache do PostgREST", async () => {
  const plan = await preparedPlan([step(1)]);
  equal(plan.capabilityVersion, 1, "capability version permanece no plano interno");
  const row = actionGroupRow(plan) as Record<string, unknown>;
  equal("capability_version" in row, false, "write REST usa default do banco e não depende do cache da coluna");
});

Deno.test("grupo normal com quatro cards permanece awaiting_confirmation após preflight", async () => {
  const plan = await preparedPlan([1, 2, 3, 4].map((index) => step(index)));
  equal(plan.confirmationPolicy, "voice", "política persistida");
  equal(plan.status, "awaiting_confirmation", "quatro cards aguardam revisão/confirmação");
  equal(plan.reviewPublic.cards.length, 4, "quatro mini-cards públicos");
  equal(plan.planHash.length, 64, "hash SHA-256");
});

Deno.test("plano crítico preparado também fica aguardando confirmação", async () => {
  const plan = await preparedPlan([step(1, "critical")]);
  equal(plan.confirmationPolicy, "opaque", "política crítica persistida");
  equal(plan.status, "awaiting_confirmation", "crítico aguarda desafio");
});

Deno.test("resultado principal diferencia warnings, falha e parcial", () => {
  equal(nextGroupStatus([{ stepId: "a", status: "completed", message: "ok" }, { stepId: "b", status: "completed", message: "ok" }]), "completed", "tudo concluído");
  equal(nextGroupStatus([{ stepId: "a", status: "completed", message: "sessão criada" }, { stepId: "b", status: "queued", message: "Google pendente" }]), "completed_with_warnings", "efeito externo pendente");
  equal(nextGroupStatus([{ stepId: "a", status: "failed", message: "falhou" }]), "failed", "nenhum commit principal");
  equal(nextGroupStatus([{ stepId: "a", status: "completed", message: "agenda criada" }, { stepId: "b", status: "failed", message: "documento falhou" }]), "partially_completed", "grupo entre domínios parcial");
});
