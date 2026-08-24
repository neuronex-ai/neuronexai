import type { EvidenceNode, EvidenceSource } from "./evidence-types";

export const NEUROTIME_NOMENCLATURA = {
  horizonte: "Horizonte de eventos",
  singularidade: "Singularidade",
  campo: "Campo temporal",
} as const;

export type NeuroTimeFonte =
  | "prontuario"
  | "neuroflow"
  | "resumos"
  | "humor"
  | "agenda"
  | "financeiro"
  | "lembretes";

export type NeuroTimePeriodo = "90-dias" | "6-meses" | "1-ano" | "tudo";

export type NeuroTimeResolucao = "dia" | "semana" | "mes" | "trimestre";

export type NeuroTimeOrigemDeRisco =
  | "registrado-pelo-profissional"
  | "substituido-pelo-profissional";

export type NeuroTimeRiscoRegistrado = {
  valor: number;
  escala: 10 | 100;
  percentual: number;
  origem: NeuroTimeOrigemDeRisco;
  registradoEm: number;
  patientId: string;
};

export type NeuroTimeHorizonteDeEvento = {
  id: string;
  patientId: string;
  patientName: string;
  sourceId: string;
  sourceType: EvidenceSource;
  fonte: NeuroTimeFonte;
  title: string;
  theme: string;
  tags: string[];
  occurredAt: number;
  updatedAt: number;
  density: number;
  attention: number;
  recency: number;
  actionable: boolean;
  overdue: boolean;
  reviewed: boolean;
  confidence: number;
  recordedRisk: NeuroTimeRiscoRegistrado | null;
  evidence: EvidenceNode;
};

export type NeuroTimeContagemDeFonte = {
  fonte: NeuroTimeFonte;
  quantidade: number;
};

export type NeuroTimeSingularidade = {
  id: string;
  startAt: number;
  endAt: number;
  inicioNormalizado: number;
  fimNormalizado: number;
  centroNormalizado: number;
  label: string;
  compactLabel: string;
  density: number;
  attention: number;
  recency: number;
  thermalScore: number;
  massaVisual: number;
  confianca: number;
  recordedRisk: NeuroTimeRiscoRegistrado | null;
  eventCount: number;
  patientCount: number;
  reviewedCount: number;
  sourceCounts: NeuroTimeContagemDeFonte[];
  dominantThemes: string[];
  summary: string;
  events: NeuroTimeHorizonteDeEvento[];
};

export type NeuroTimeCampoTemporal = {
  versaoDoCampo: "neurotime-campo-v1";
  startAt: number;
  endAt: number;
  resolution: NeuroTimeResolucao;
  singularities: NeuroTimeSingularidade[];
  eventCount: number;
  patientCount: number;
  sourceCount: number;
  latestActivityAt: number | null;
  hasRecordedRisk: boolean;
};

export type NeuroTimeFiltros = {
  patientIds: string[];
  sources: NeuroTimeFonte[];
  period: NeuroTimePeriodo;
};

export const NEUROTIME_FONTES: ReadonlyArray<{
  value: NeuroTimeFonte;
  label: string;
  shortLabel: string;
}> = [
  { value: "prontuario", label: "Prontuário e sub-abas", shortLabel: "Prontuário" },
  { value: "neuroflow", label: "NeuroFlow", shortLabel: "NeuroFlow" },
  { value: "resumos", label: "Resumos de IA revisados", shortLabel: "Resumos" },
  { value: "humor", label: "Diário de humor", shortLabel: "Humor" },
  { value: "agenda", label: "Agenda", shortLabel: "Agenda" },
  { value: "financeiro", label: "Financeiro", shortLabel: "Financeiro" },
  { value: "lembretes", label: "Lembretes", shortLabel: "Lembretes" },
] as const;

export const fonteDoNeuroTime = (source: EvidenceSource): NeuroTimeFonte => ({
  personal_note: "prontuario",
  flow: "neuroflow",
  session_note: "prontuario",
  ai_summary: "resumos",
  mood: "humor",
  goal: "prontuario",
  anamnesis: "prontuario",
  appointment: "agenda",
  reminder: "lembretes",
  finance: "financeiro",
} as const)[source];
