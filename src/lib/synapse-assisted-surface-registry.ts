import type {
  SynapseInterfaceActionName,
  SynapseNotesView,
} from "@/lib/synapse-interface-actions";

export type SynapseAssistedProduct = "neuroview" | "neuroflow" | "neuropulse";

export type SynapseReadSurfaceId =
  | "dashboard_agenda"
  | "dashboard_pending"
  | "dashboard_finance"
  | "agenda_calendar"
  | "agenda_appointments"
  | "patients_search"
  | "patients_grid"
  | "patient_summary"
  | "patient_sessions"
  | "patient_files"
  | "patient_finance"
  | "finance_overview"
  | "finance_entries"
  | "finance_charges";

export interface SynapseReadSurface {
  id: SynapseReadSurfaceId;
  route: string;
  selector: string;
  title: string;
  detail: string;
  writesData: false;
}

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

/**
 * Read-only destinations that can receive contextual Synapse focus. Keeping
 * routes and selectors in one registry prevents arbitrary DOM selectors or
 * navigation paths from being accepted from model output.
 */
export const SYNAPSE_READ_SURFACES: Record<SynapseReadSurfaceId, SynapseReadSurface> = {
  dashboard_agenda: { id: "dashboard_agenda", route: "/dashboard", selector: "[data-synapse-target='dashboard-agenda']", title: "Agenda", detail: "Fluxo clínico", writesData: false },
  dashboard_pending: { id: "dashboard_pending", route: "/dashboard", selector: "[data-synapse-target='dashboard-pending']", title: "Pendências", detail: "Lista operacional", writesData: false },
  dashboard_finance: { id: "dashboard_finance", route: "/dashboard", selector: "[data-synapse-target='dashboard-finance']", title: "Financeiro", detail: "Resumo útil", writesData: false },
  agenda_calendar: { id: "agenda_calendar", route: "/agenda", selector: "[data-synapse-target='agenda-calendar']", title: "Agenda", detail: "Calendário clínico", writesData: false },
  agenda_appointments: { id: "agenda_appointments", route: "/agenda", selector: "[data-synapse-target='agenda-appointments']", title: "Agenda", detail: "Agendamentos", writesData: false },
  patients_search: { id: "patients_search", route: "/pacientes", selector: "[data-synapse-target='patients-search'] input", title: "Pacientes", detail: "Busca de prontuários", writesData: false },
  patients_grid: { id: "patients_grid", route: "/pacientes", selector: "[data-synapse-target='patients-grid']", title: "Pacientes", detail: "Diretório clínico", writesData: false },
  patient_summary: { id: "patient_summary", route: "/pacientes/:patientId?tab=summary", selector: "[data-synapse-target='patient-summary']", title: "Prontuário", detail: "Resumo do paciente", writesData: false },
  patient_sessions: { id: "patient_sessions", route: "/pacientes/:patientId?tab=sessions", selector: "[data-synapse-target='patient-sessions']", title: "Prontuário", detail: "Sessões", writesData: false },
  patient_files: { id: "patient_files", route: "/pacientes/:patientId?tab=documents", selector: "[data-synapse-target='patient-files']", title: "Prontuário", detail: "Arquivos", writesData: false },
  patient_finance: { id: "patient_finance", route: "/pacientes/:patientId?tab=finance", selector: "[data-synapse-target='patient-finance']", title: "Prontuário", detail: "Financeiro do paciente", writesData: false },
  finance_overview: { id: "finance_overview", route: "/financeiro?view=gestao-visao-geral", selector: "[data-synapse-target='finance-overview']", title: "Financeiro", detail: "Visão geral", writesData: false },
  finance_entries: { id: "finance_entries", route: "/financeiro?view=gestao-lancamentos", selector: "[data-synapse-target='finance-entries']", title: "Financeiro", detail: "Lançamentos", writesData: false },
  finance_charges: { id: "finance_charges", route: "/financeiro?view=gestao-cobrancas", selector: "[data-synapse-target='finance-charges']", title: "Financeiro", detail: "Cobranças", writesData: false },
};

export const getSynapseReadSurface = (id?: string | null) =>
  id && id in SYNAPSE_READ_SURFACES
    ? SYNAPSE_READ_SURFACES[id as SynapseReadSurfaceId]
    : undefined;
