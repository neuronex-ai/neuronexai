import {
  nextGroupStatus,
  prepareSynapseActionGroupPlan,
  publicReviewCards,
  resolveConfirmationPolicy,
  stableJson,
  type SynapseActionGroupStep,
} from "./synapse-action-group.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
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

Deno.test("quatro etapas normais executam direto sem timeline obrigatória", () => {
  equal(resolveConfirmationPolicy([1, 2, 3, 4].map((index) => step(index))), "direct", "política de quatro etapas");
});

Deno.test("cinco etapas normais exigem timeline e confirmação por voz", () => {
  equal(resolveConfirmationPolicy([1, 2, 3, 4, 5].map((index) => step(index))), "voice", "política de cinco etapas");
});

Deno.test("ação crítica de uma etapa exige confirmação opaca", () => {
  equal(resolveConfirmationPolicy([step(1, "critical")]), "opaque", "política crítica");
});

Deno.test("NeuroFinance de uma etapa exige confirmação opaca", () => {
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

Deno.test("plano preparado é versionado, hasheado e não guarda comando bruto na idempotência", async () => {
  const plan = await prepareSynapseActionGroupPlan({
    professionalId: "11111111-1111-4111-8111-111111111111",
    conversationId: "22222222-2222-4222-8222-222222222222",
    title: "Pós-sessão completo",
    intent: "post_session_bundle",
    spokenSummary: "Vou preparar evolução, financeiro, recibo, mensagem e navegação.",
    steps: [1, 2, 3, 4, 5].map((index) => step(index)),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });

  equal(plan.confirmationPolicy, "voice", "política persistida");
  equal(plan.planHash.length, 64, "hash SHA-256");
  equal(plan.idempotencyKey.length, 64, "idempotência SHA-256");
  equal(plan.reviewPublic.planHash, plan.planHash, "hash visível corresponde ao executável");
  equal(JSON.stringify(plan.reviewPublic).includes("server-only"), false, "revisão sem argumentos internos");
});

Deno.test("resultado principal diferencia warnings, falha e parcial", () => {
  equal(nextGroupStatus([
    { stepId: "a", status: "completed", message: "ok" },
    { stepId: "b", status: "completed", message: "ok" },
  ]), "completed", "tudo concluído");

  equal(nextGroupStatus([
    { stepId: "a", status: "completed", message: "sessão criada" },
    { stepId: "b", status: "queued", message: "Google pendente" },
  ]), "completed_with_warnings", "efeito externo pendente");

  equal(nextGroupStatus([
    { stepId: "a", status: "failed", message: "falhou" },
  ]), "failed", "nenhum commit principal");

  equal(nextGroupStatus([
    { stepId: "a", status: "completed", message: "agenda criada" },
    { stepId: "b", status: "failed", message: "documento falhou" },
  ]), "partially_completed", "grupo entre domínios parcial");
});
