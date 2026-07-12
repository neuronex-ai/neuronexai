export type SynapseNeuroToolName =
  | "analyze_neuroview_patient_patterns"
  | "create_neuroflow_from_patient_history"
  | "create_neuropulse_cause_effect_diagram";

export interface SynapseNeuroIntent {
  toolName: SynapseNeuroToolName;
  arguments: Record<string, unknown>;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CREATE =
  /\b(crie|criar|gere|gerar|monte|montar|prepare|preparar|construa|construir|faca|fazer|mapeie|mapear|desenhe|desenhar)\b/;
const ANALYZE =
  /\b(analise|analisar|investigue|investigar|procure|procurar|encontre|encontrar|mostre|mostrar|abra|abrir|mapeie|mapear|conecte|conectar)\b/;

const extractPatientName = (message: string) => {
  const match = message.match(
    /(?:paciente\s+|(?:do|da|de)\s+)([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}'-]*(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}'-]*){0,4})/u,
  );
  return match?.[1]?.trim() || undefined;
};

const detectLens = (text: string) => {
  if (/\bpsicanalis/.test(text)) return "psicanalise";
  if (/\bsistemic/.test(text)) return "sistemica";
  if (/\bhumanist/.test(text)) return "humanista";
  if (/\bgestalt/.test(text)) return "gestalt";
  if (/\bjung/.test(text)) return "junguiana";
  if (/\bneuropsic/.test(text)) return "neuropsicologia";
  return "tcc";
};

export function resolveExplicitNeuroIntent(
  message: string,
): SynapseNeuroIntent | null {
  const text = normalize(message);
  if (!text) return null;

  const patientName = extractPatientName(message);
  const patient = patientName ? { patient_name: patientName } : {};

  if (/\bneuroflow\b/.test(text) && CREATE.test(text)) {
    return {
      toolName: "create_neuroflow_from_patient_history",
      arguments: { ...patient, objective: message.trim().slice(0, 800) },
    };
  }

  if (
    (/\bneuropulse\b/.test(text) ||
      /\b(causa e efeito|diagrama causal|fluxograma)\b/.test(text)) &&
    CREATE.test(text)
  ) {
    return {
      toolName: "create_neuropulse_cause_effect_diagram",
      arguments: {
        ...patient,
        prompt: message.trim().slice(0, 800),
        lens: detectLens(text),
      },
    };
  }

  if (/\bneuroview\b/.test(text) && ANALYZE.test(text)) {
    return {
      toolName: "analyze_neuroview_patient_patterns",
      arguments: { ...patient, focus: message.trim().slice(0, 800) },
    };
  }

  return null;
}
