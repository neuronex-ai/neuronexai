import type { PersonalNote } from "@/types";
import { buildEvidenceNodes } from "./evidence-model";
import type { EvidenceIndexRow, EvidenceNode } from "./evidence-types";

export type NeuroTimeFlowDisponivel = {
  id: string;
  user_id?: string | null;
  patient_id?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const noteRow = (note: PersonalNote): EvidenceIndexRow => ({
  id: `neurotime-note-${note.id}`,
  user_id: note.user_id,
  patient_id: note.patient_id,
  source_type: "personal_note",
  source_id: note.id,
  occurred_at: note.reference_date || note.created_at,
  updated_at: note.updated_at || note.created_at,
  title: note.title || "Nota sem título",
  tags: note.tags || [],
  reviewed: true,
  is_actionable: false,
  action_due_at: null,
  action_completed: false,
  metadata: {
    category: "prontuario",
    contentLength: note.content?.length || 0,
  },
});

const flowRow = (flow: NeuroTimeFlowDisponivel): EvidenceIndexRow | null => {
  if (!flow.patient_id) return null;
  const occurredAt = flow.updated_at || flow.created_at;
  if (!occurredAt) return null;
  return {
    id: `neurotime-flow-${flow.id}`,
    user_id: flow.user_id || "frontend",
    patient_id: flow.patient_id,
    source_type: "flow",
    source_id: flow.id,
    occurred_at: occurredAt,
    updated_at: occurredAt,
    title: flow.title || "Fluxo sem título",
    tags: flow.tags || [],
    reviewed: true,
    is_actionable: false,
    action_due_at: null,
    action_completed: false,
    metadata: {
      category: "neuroflow",
      contentLength: flow.description?.length || 0,
    },
  };
};

/**
 * Completa a projeção temporal com notas e fluxos que já estão carregados na
 * tela. Não abre consultas nem cria uma nova camada de processamento.
 */
export const mergeNeuroTimeEvidence = ({
  evidence,
  notes,
  flows,
  now = Date.now(),
}: {
  evidence: EvidenceNode[];
  notes: PersonalNote[];
  flows: NeuroTimeFlowDisponivel[];
  now?: number;
}) => {
  const rows = [
    ...notes.filter((note) => Boolean(note.patient_id)).map(noteRow),
    ...flows.map(flowRow).filter(Boolean) as EvidenceIndexRow[],
  ];
  const availableEvidence = buildEvidenceNodes(rows, [], now);
  const merged = new Map<string, EvidenceNode>();
  availableEvidence.forEach((item) => merged.set(`${item.sourceType}:${item.sourceId}`, item));
  // The normalized clinical index is authoritative when both representations exist.
  evidence.forEach((item) => merged.set(`${item.sourceType}:${item.sourceId}`, item));
  return Array.from(merged.values());
};
