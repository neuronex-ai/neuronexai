const TOOL_LABELS: Record<string, string> = {
  get_patient_timeline: "linha do tempo clínica",
  get_clinical_history: "histórico clínico",
  get_patient_system_snapshot: "resumo clínico do paciente",
  get_patient_payment_status: "situação financeira do paciente",
  analyze_neuroview_patient_patterns: "análise no NeuroView",
  create_neuroflow_from_patient_history: "criação no NeuroFlow",
  create_neuropulse_cause_effect_diagram: "diagrama no NeuroPulse",
};

const INTERNAL_IDENTIFIER =
  /\b(?:get|list|search|find|create|update|delete|send|request|analyze|open|navigate|resolve|execute)_[a-z0-9_]+\b/gi;

const readableLabel = (identifier: string) =>
  TOOL_LABELS[identifier.toLowerCase()] || "recurso interno do Synapse";

/** Removes implementation vocabulary without changing ordinary clinical language. */
export function sanitizeSynapseResponse(value: unknown) {
  return String(value || "")
    .replace(
      new RegExp(`\\(\\s*\`?(${INTERNAL_IDENTIFIER.source})\`?\\s*\\)`, "gi"),
      (_match, identifier) => `(${readableLabel(identifier)})`,
    )
    .replace(
      new RegExp(`\`(${INTERNAL_IDENTIFIER.source})\``, "gi"),
      (_match, identifier) => readableLabel(identifier),
    )
    .replace(INTERNAL_IDENTIFIER, (identifier) => readableLabel(identifier))
    .replace(
      /\b(?:tool(?:_call)?|function_call|endpoint|payload|session_id|clientAction)\b/gi,
      "recurso",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeSynapseResponseWithWidget(value: unknown) {
  const content = String(value || "");
  const widgetStart = content.indexOf("```json synapse_widget");
  if (widgetStart < 0) return sanitizeSynapseResponse(content);
  return `${sanitizeSynapseResponse(content.slice(0, widgetStart))}\n\n${
    content.slice(widgetStart).trim()
  }`;
}

export function deterministicNeuroReadResponse(
  toolName: string,
  result: { ok?: boolean; message?: unknown; data?: { summary?: unknown } },
) {
  if (toolName !== "analyze_neuroview_patient_patterns" || !result.ok) {
    return null;
  }
  return sanitizeSynapseResponse(
    result.message || result.data?.summary ||
      "Concluí a análise no NeuroView e preparei a visualização.",
  );
}
