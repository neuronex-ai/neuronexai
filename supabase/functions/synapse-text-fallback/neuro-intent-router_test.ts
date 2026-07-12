import { resolveExplicitNeuroIntent } from "./neuro-intent-router.ts";

const equal = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("roteia criação explícita de NeuroFlow sem depender do modelo", () => {
  const intent = resolveExplicitNeuroIntent(
    "Crie um NeuroFlow do Carlos mostrando a evolução do tratamento",
  );
  equal(
    intent?.toolName,
    "create_neuroflow_from_patient_history",
    "ferramenta",
  );
  equal(intent?.arguments.patient_name, "Carlos", "paciente");
});

Deno.test("roteia NeuroPulse e preserva a lente clínica", () => {
  const intent = resolveExplicitNeuroIntent(
    "Monte um NeuroPulse sistêmico da Nathalia Gasperi sobre padrões relacionais",
  );
  equal(
    intent?.toolName,
    "create_neuropulse_cause_effect_diagram",
    "ferramenta",
  );
  equal(intent?.arguments.patient_name, "Nathalia Gasperi", "paciente");
  equal(intent?.arguments.lens, "sistemica", "lente");
});

Deno.test("roteia análise explícita no NeuroView", () => {
  const intent = resolveExplicitNeuroIntent(
    "Analise no NeuroView os padrões clínicos do Carlos",
  );
  equal(intent?.toolName, "analyze_neuroview_patient_patterns", "ferramenta");
  equal(intent?.arguments.patient_name, "Carlos", "paciente");
});

Deno.test("não transforma pergunta conceitual em mutação", () => {
  equal(
    resolveExplicitNeuroIntent("O que é o NeuroFlow?"),
    null,
    "pergunta conceitual",
  );
});
