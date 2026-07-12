import type {
  SynapseInterfaceActionName,
  SynapseNotesView,
} from "@/lib/synapse-interface-actions";

export type SynapseAssistedProduct = "neuroview" | "neuroflow" | "neuropulse";

export interface SynapseAssistedSurface {
  product: SynapseAssistedProduct;
  toolName: string;
  action: SynapseInterfaceActionName;
  notesView: SynapseNotesView;
  title: string;
  detail: string;
  writesData: boolean;
}

/**
 * Presentation registry for assisted actions. The authorization and confirmation
 * policy remains canonical in synapse-tool-contract; this registry only maps a
 * verified tool to the surface where its progress and result should appear.
 */
export const SYNAPSE_ASSISTED_SURFACES: Record<string, SynapseAssistedSurface> = {
  analyze_neuroview_patient_patterns: {
    product: "neuroview",
    toolName: "analyze_neuroview_patient_patterns",
    action: "open_neuroview_reasoning",
    notesView: "neuroview",
    title: "NeuroView",
    detail: "Leitura clínica assistida",
    writesData: false,
  },
  create_neuroflow_from_patient_history: {
    product: "neuroflow",
    toolName: "create_neuroflow_from_patient_history",
    action: "open_neuroflow_generation",
    notesView: "neuroflow",
    title: "NeuroFlow",
    detail: "Mapeamento clínico assistido",
    writesData: true,
  },
  create_neuropulse_cause_effect_diagram: {
    product: "neuropulse",
    toolName: "create_neuropulse_cause_effect_diagram",
    action: "open_neuropulse_diagram",
    notesView: "neuropulse",
    title: "NeuroPulse",
    detail: "Síntese causal assistida",
    writesData: true,
  },
};

export const getSynapseAssistedSurface = (toolName?: string | null) =>
  toolName ? SYNAPSE_ASSISTED_SURFACES[toolName] : undefined;

export const getSynapseAssistedSurfaceByProduct = (product?: SynapseAssistedProduct | null) =>
  product
    ? Object.values(SYNAPSE_ASSISTED_SURFACES).find((surface) => surface.product === product)
    : undefined;
