import {
  actionKindForCanonicalTool,
  canonicalToolForActionKind,
  normalizeActionGroupStepIdentity,
  SYNAPSE_ACTION_KINDS,
} from "./synapse-action-kind.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
};

Deno.test("action_kind converte intenção estável em ferramenta canônica", () => {
  equal(canonicalToolForActionKind("session_note"), "create_session_note", "anotação");
  equal(canonicalToolForActionKind("manual_financial_entry"), "create_financial_entry", "financeiro manual");
  equal(canonicalToolForActionKind("patient_email"), "send_patient_email", "e-mail");
  equal(canonicalToolForActionKind("appointment_create"), "create_appointment", "agenda");
  equal(canonicalToolForActionKind("neurofinance_charge"), "create_neurofinance_charge", "NeuroFinance");
  equal(canonicalToolForActionKind("fiscal_invoice"), "create_fiscal_invoice", "fiscal");
  equal(canonicalToolForActionKind("patient_record_open"), "request_interface_action", "interface");
  equal(new Set(SYNAPSE_ACTION_KINDS).size, SYNAPSE_ACTION_KINDS.length, "enum sem duplicatas");
});

Deno.test("normalizador aceita aliases legados sem aceitar nome livre", () => {
  for (const [source, payload] of [
    ["action_kind", { action_kind: "session_note" }],
    ["actionKind", { actionKind: "session_note" }],
    ["tool_name", { tool_name: "create_session_note" }],
    ["toolName", { toolName: "create_session_note" }],
    ["action_type", { action_type: "session_note" }],
    ["actionType", { actionType: "create_session_note" }],
  ] as const) {
    const normalized = normalizeActionGroupStepIdentity(payload);
    equal(normalized.source, source, `source ${source}`);
    equal(normalized.canonicalToolName, "create_session_note", `canonical ${source}`);
  }

  const blocked = normalizeActionGroupStepIdentity({ tool_name: "arbitrary_runtime_function" });
  equal(blocked.canonicalToolName, null, "nome livre bloqueado");
  equal(blocked.hasIdentityField, true, "campo inválido detectado");
});

Deno.test("reads legados continuam reconhecidos apenas como compatibilidade de preflight", () => {
  const normalized = normalizeActionGroupStepIdentity({ tool_name: "get_calendar" });
  equal(normalized.canonicalToolName, "get_calendar", "read canônico legado");
  equal(normalized.kind, null, "read não recebe action_kind executável");
});

Deno.test("reverse lookup mantém implementação interna fora do modelo", () => {
  equal(actionKindForCanonicalTool("create_financial_entry"), "manual_financial_entry", "reverse financeiro");
  equal(actionKindForCanonicalTool("send_patient_email"), "patient_email", "reverse e-mail");
  equal(actionKindForCanonicalTool("get_calendar"), null, "read sem kind executável");
});
