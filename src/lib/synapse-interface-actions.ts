import { supabase } from "@/integrations/supabase/client";
import {
  resolveSynapseDestination,
  safeSynapseDestination,
  type SynapseDestination,
} from "@/lib/synapse-destinations";
import { requestOpaqueConfirmation } from "@/lib/synapse-voice-ui-protocol";

export type SynapseInterfaceActionName =
  | "navigate"
  | "open_patient"
  | "open_patient_record"
  | "open_daily_schedule"
  | "scroll_to_appointment"
  | "highlight_element"
  | "open_modal"
  | "open_teleconsultation_lobby"
  | "open_patient_invite_modal"
  | "filter_patients_directory"
  | "open_notes_desktop"
  | "switch_notes_view"
  | "open_note"
  | "filter_notes"
  | "open_new_note"
  | "open_note_module"
  | "open_tasks_board"
  | "open_files_manager"
  | "open_notion_panel"
  | "open_file_preview"
  | "open_neuroview_reasoning"
  | "open_neuroflow_generation"
  | "open_neuropulse_diagram";

export type SynapseNavigationTarget =
  | "dashboard"
  | "agenda"
  | "patients"
  | "finance"
  | "notes"
  | "teleconsultation"
  | "synapse";

export type SynapseNotesView = "notes" | "tasks" | "files" | "notion" | "neuroview" | "neuroflow" | "neuropulse";

export type SynapseNeuroViewScope = "all" | "patient" | "subgraph";
export type SynapseNeuroViewMode = "2d" | "3d";

export interface SynapseNeuroViewDirective {
  scope?: SynapseNeuroViewScope;
  mode?: SynapseNeuroViewMode;
  nodeIds?: string[];
  focusNodeId?: string;
}

export type SynapseInterfaceElement =
  | "next_appointment"
  | "daily_schedule"
  | "dashboard_agenda"
  | "dashboard_pending"
  | "dashboard_finance"
  | "agenda_calendar"
  | "agenda_appointments"
  | "patient_header"
  | "patient_summary"
  | "patient_sessions"
  | "patient_files"
  | "patient_finance"
  | "financial_balance"
  | "finance_overview"
  | "finance_entries"
  | "finance_charges"
  | "finance_workspace"
  | "transcription_decision"
  | "patient_invite"
  | "patients_search"
  | "patients_grid"
  | "notes_search"
  | "notes_editor"
  | "notes_list"
  | "notes_sidebar"
  | "tasks_board"
  | "files_manager"
  | "notion_panel"
  | "neuroview_graph"
  | "neuroflow_canvas"
  | "neuropulse_panel";

export interface SynapseInterfaceAction {
  action: SynapseInterfaceActionName;
  target?: SynapseNavigationTarget;
  destination?: SynapseDestination;
  patientId?: string;
  appointmentId?: string;
  noteId?: string;
  moduleId?: string;
  taskId?: string;
  fileId?: string;
  flowId?: string;
  runId?: string;
  pulseEntryId?: string;
  mermaid?: string;
  trace?: unknown;
  neuroViewScope?: SynapseNeuroViewScope;
  neuroViewMode?: SynapseNeuroViewMode;
  neuroViewNodeIds?: string[];
  neuroViewFocusNodeId?: string;
  date?: string;
  query?: string;
  notesView?: SynapseNotesView;
  filesTab?: "personal" | "patients";
  agendaView?: "daily" | "weekly" | "monthly";
  workspaceTab?: "transcript" | "notes" | "patient";
  element?: SynapseInterfaceElement;
  modal?: "new_appointment" | "new_patient" | "new_transaction" | "new_charge" | "patient_details" | "patient_invite" | "new_note";
  reason?: string;
}

export interface SynapseActionExecutionResult {
  success: boolean;
  action: SynapseInterfaceActionName;
  message: string;
  durationMs: number;
  cancelled?: boolean;
  lifecycleId?: string;
}

export const isCurrentCancelledSynapseAction = (
  result: SynapseActionExecutionResult,
  currentLifecycleId?: string | null,
) => Boolean(result.cancelled && result.lifecycleId && result.lifecycleId === currentLifecycleId);

export type SynapseActionPhase = "preparing" | "navigating" | "focusing" | "completed" | "error";

export interface SynapseActionLifecycleEvent {
  id: string;
  phase: SynapseActionPhase;
  action: SynapseInterfaceActionName;
  label: string;
  message: string;
  runId?: string;
  product?: "neuroview" | "neuroflow" | "neuropulse";
  targetSelector?: string;
}

type Navigate = (path: string, options?: { replace?: boolean; state?: unknown }) => void;

const ROUTES: Record<SynapseNavigationTarget, string> = {
  dashboard: "/dashboard",
  agenda: "/agenda",
  patients: "/pacientes",
  finance: "/financeiro",
  notes: "/notas",
  teleconsultation: "/teleconsulta",
  synapse: "/synapse-ai",
};

const MODAL_ROUTES: Record<NonNullable<SynapseInterfaceAction["modal"]>, string> = {
  new_appointment: "/agenda",
  new_patient: "/pacientes",
  new_transaction: "/financeiro",
  new_charge: "/financeiro",
  patient_details: "/pacientes",
  patient_invite: "/teleconsulta",
  new_note: "/notas",
};

const MODAL_TARGETS: Partial<Record<NonNullable<SynapseInterfaceAction["modal"]>, string>> = {
  new_appointment: "[data-synapse-target='new-appointment-modal']",
  new_patient: "[data-synapse-target='new-patient-modal']",
  new_transaction: "[data-synapse-target='new-transaction-modal']",
  new_charge: "[data-synapse-target='new-charge-modal']",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,80}$/;
const NOTES_VIEWS = new Set(["notes", "tasks", "files", "notion", "neuroview", "neuroflow", "neuropulse"]);
const NEUROVIEW_SCOPES = new Set<SynapseNeuroViewScope>(["all", "patient", "subgraph"]);
const NEUROVIEW_MODES = new Set<SynapseNeuroViewMode>(["2d", "3d"]);
const INTERFACE_ELEMENTS = new Set<SynapseInterfaceElement>([
  "next_appointment", "daily_schedule", "dashboard_agenda", "dashboard_pending", "dashboard_finance",
  "agenda_calendar", "agenda_appointments", "patient_header", "patient_summary", "patient_sessions",
  "patient_files", "patient_finance", "financial_balance", "finance_overview", "finance_entries",
  "finance_charges", "finance_workspace", "transcription_decision", "patient_invite", "patients_search",
  "patients_grid", "notes_search", "notes_editor", "notes_list", "notes_sidebar", "tasks_board",
  "files_manager", "notion_panel", "neuroview_graph", "neuroflow_canvas", "neuropulse_panel",
]);
const ALLOWED_INTERFACE_ACTIONS = new Set<SynapseInterfaceActionName>(["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal", "open_teleconsultation_lobby", "open_patient_invite_modal", "filter_patients_directory", "open_notes_desktop", "switch_notes_view", "open_note", "filter_notes", "open_new_note", "open_note_module", "open_tasks_board", "open_files_manager", "open_notion_panel", "open_file_preview", "open_neuroview_reasoning", "open_neuroflow_generation", "open_neuropulse_diagram"]);

const PAGE_ACTION_EVENT = "synapse:page-action";
const SURFACE_READY_EVENT = "synapse:surface-ready";

let activeController: AbortController | null = null;

const nextFrame = (signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const onAbort = () => {
      window.cancelAnimationFrame(frame);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const frame = window.requestAnimationFrame(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    });
    signal.addEventListener("abort", onAbort, { once: true });
  });

const waitForTarget = (selector: string, signal: AbortSignal, timeoutMs = 4200) =>
  new Promise<Element | null>((resolve, reject) => {
    if (!selector) return resolve(null);
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));

    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    let settled = false;
    const finish = (node: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve(node);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const observer = new MutationObserver(() => {
      const node = document.querySelector(selector);
      if (node) finish(node);
    });
    const timeout = window.setTimeout(() => finish(document.querySelector(selector)), timeoutMs);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });

const waitForSurfaceReady = (selector: string, runId: string | undefined, signal: AbortSignal) =>
  new Promise<Element | null>((resolve, reject) => {
    if (!selector) return resolve(null);
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    let settled = false;
    const finish = (node: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(safetyTimeout);
      signal.removeEventListener("abort", onAbort);
      window.removeEventListener(SURFACE_READY_EVENT, onReady as EventListener);
      resolve(node);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(safetyTimeout);
      window.removeEventListener(SURFACE_READY_EVENT, onReady as EventListener);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const onReady = (event: Event) => {
      const detail = (event as CustomEvent<{ runId?: string | null }>).detail;
      if (runId && detail?.runId && detail.runId !== runId) return;
      finish(document.querySelector(selector));
    };
    const observer = new MutationObserver(() => {
      const node = document.querySelector(selector);
      if (node) finish(node);
    });
    const safetyTimeout = window.setTimeout(() => finish(document.querySelector(selector)), 15000);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-synapse-ready", "data-synapse-run-id"],
    });
    window.addEventListener(SURFACE_READY_EVENT, onReady as EventListener);
    signal.addEventListener("abort", onAbort, { once: true });
  });

const validEntityId = (value?: string) => Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
const safeNotesView = (value?: string): SynapseNotesView | undefined => value && NOTES_VIEWS.has(value) ? value as SynapseNotesView : undefined;
const safeNeuroViewScope = (value?: string): SynapseNeuroViewScope | undefined =>
  value && NEUROVIEW_SCOPES.has(value as SynapseNeuroViewScope) ? value as SynapseNeuroViewScope : undefined;
const safeNeuroViewMode = (value?: string): SynapseNeuroViewMode | undefined =>
  value && NEUROVIEW_MODES.has(value as SynapseNeuroViewMode) ? value as SynapseNeuroViewMode : undefined;
const safeGraphNodeId = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) || 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (!normalized || normalized.length > 160 || hasControlCharacter) return undefined;
  return normalized;
};
const safeGraphNodeIds = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const normalized = Array.from(new Set(
    value.slice(0, 80).map(safeGraphNodeId).filter((id): id is string => Boolean(id)),
  ));
  return normalized.length ? normalized : undefined;
};
const safeInterfaceElement = (value?: string): SynapseInterfaceElement | undefined =>
  value && INTERFACE_ELEMENTS.has(value as SynapseInterfaceElement) ? value as SynapseInterfaceElement : undefined;
const emitPageAction = (action: SynapseInterfaceAction) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAGE_ACTION_EVENT, { detail: action })); };

const waitForPageActionTarget = async (
  selector: string,
  action: SynapseInterfaceAction,
  signal: AbortSignal,
  timeoutMs = 12000,
) => {
  const deadline = performance.now() + timeoutMs;
  let node = document.querySelector(selector);
  while (!node && performance.now() < deadline) {
    emitPageAction(action);
    const remaining = deadline - performance.now();
    node = await waitForTarget(selector, signal, Math.max(50, Math.min(500, remaining)));
  }
  return node;
};

const ACTION_LABELS: Partial<Record<SynapseInterfaceActionName, string>> = {
  navigate: "Abrindo uma área do sistema",
  open_patient: "Abrindo a ficha do paciente",
  open_patient_record: "Abrindo o prontuário",
  open_daily_schedule: "Abrindo a agenda clínica",
  scroll_to_appointment: "Localizando o atendimento",
  highlight_element: "Destacando a informação",
  open_modal: "Preparando a janela",
  open_teleconsultation_lobby: "Abrindo a teleconsulta",
  open_patient_invite_modal: "Preparando o convite",
  filter_patients_directory: "Filtrando pacientes",
  open_notes_desktop: "Abrindo o NeuroDrive",
  switch_notes_view: "Organizando o NeuroDrive",
  open_note: "Abrindo a nota",
  filter_notes: "Filtrando notas",
  open_new_note: "Preparando uma nova nota",
  open_note_module: "Abrindo o módulo de notas",
  open_tasks_board: "Abrindo as tarefas",
  open_files_manager: "Abrindo os arquivos",
  open_notion_panel: "Abrindo o Notion",
  open_file_preview: "Abrindo o arquivo",
  open_neuroview_reasoning: "Preparando o NeuroView",
  open_neuroflow_generation: "Preparando o NeuroFlow",
  open_neuropulse_diagram: "Preparando o NeuroPulse",
};

export const describeSynapseInterfaceAction = (action: SynapseInterfaceAction) =>
  ACTION_LABELS[action.action] || action.reason || "Atualizando a interface";

const highlightNode = (node: Element | null, product?: "neuroview" | "neuroflow" | "neuropulse") => {
  if (!(node instanceof HTMLElement)) return false;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
  node.dataset.synapseHighlighted = "true";
  if (product) node.dataset.synapseProduct = product;
  node.classList.add("synapse-interface-highlight");
  window.setTimeout(() => {
    node.classList.remove("synapse-interface-highlight");
    delete node.dataset.synapseHighlighted;
    delete node.dataset.synapseProduct;
  }, 4600);
  return true;
};

const notesProduct = (action: SynapseInterfaceAction) => {
  if (action.action === "open_neuroview_reasoning") return "neuroview" as const;
  if (action.action === "open_neuroflow_generation") return "neuroflow" as const;
  if (action.action === "open_neuropulse_diagram") return "neuropulse" as const;
  if (action.destination === "notes.neuroview") return "neuroview" as const;
  if (action.destination === "notes.neuroflow") return "neuroflow" as const;
  if (action.destination === "notes.neuropulse") return "neuropulse" as const;
  return undefined;
};

const targetSelector = (action: SynapseInterfaceAction) => {
  const selectors: Record<SynapseInterfaceElement, string> = {
    next_appointment: "[data-synapse-target='next-appointment'], [data-synapse-target='dashboard-agenda']",
    daily_schedule: "[data-synapse-target='daily-schedule']",
    dashboard_agenda: "[data-synapse-target='dashboard-agenda']",
    dashboard_pending: "[data-synapse-target='dashboard-pending']",
    dashboard_finance: "[data-synapse-target='dashboard-finance']",
    agenda_calendar: "[data-synapse-target='agenda-calendar']",
    agenda_appointments: "[data-synapse-target='agenda-appointments']",
    patient_header: "[data-synapse-target='patient-header']",
    patient_summary: "[data-synapse-target='patient-summary']",
    patient_sessions: "[data-synapse-target='patient-sessions']",
    patient_files: "[data-synapse-target='patient-files']",
    patient_finance: "[data-synapse-target='patient-finance']",
    financial_balance: "[data-synapse-target='financial-balance'], [data-synapse-target='finance-overview'], [data-synapse-target='dashboard-finance']",
    finance_overview: "[data-synapse-target='finance-overview']",
    finance_entries: "[data-synapse-target='finance-entries']",
    finance_charges: "[data-synapse-target='finance-charges']",
    finance_workspace: "[data-synapse-target='finance-workspace']",
    transcription_decision: "[data-synapse-target='transcription-decision']",
    patient_invite: "[data-synapse-target='patient-invite']",
    patients_search: "[data-synapse-target='patients-search'] input, [data-synapse-target='patients-search']",
    patients_grid: "[data-synapse-target='patients-grid']",
    notes_search: "[data-synapse-target='notes-search'] input, [data-synapse-target='notes-search']",
    notes_editor: "[data-synapse-target='notes-editor']",
    notes_list: "[data-synapse-target='notes-list']",
    notes_sidebar: "[data-synapse-target='notes-sidebar']",
    tasks_board: "[data-synapse-target='tasks-board']",
    files_manager: "[data-synapse-target='files-manager']",
    notion_panel: "[data-synapse-target='notion-panel']",
    neuroview_graph: "[data-synapse-target='neuroview-graph'][data-synapse-ready='true']",
    neuroflow_canvas: "[data-synapse-target='neuroflow-canvas'][data-synapse-ready='true']",
    neuropulse_panel: "[data-synapse-target='neuropulse-panel'][data-synapse-ready='true']",
  };
  if (action.element) return selectors[action.element];
  if (action.appointmentId && validEntityId(action.appointmentId)) {
    const escaped = CSS.escape(action.appointmentId);
    return `[data-synapse-appointment-id="${escaped}"], [data-appointment-id="${escaped}"]`;
  }
  if (action.noteId && validEntityId(action.noteId)) return `[data-synapse-note-id="${CSS.escape(action.noteId)}"]`;
  if (action.fileId && validEntityId(action.fileId)) return `[data-synapse-file-id="${CSS.escape(action.fileId)}"]`;
  if (action.patientId && validEntityId(action.patientId)) {
    return `[data-synapse-patient-id="${CSS.escape(action.patientId)}"]`;
  }
  return "";
};

const patientRecordTab = (element?: SynapseInterfaceElement) => {
  if (element === "patient_sessions") return "sessions";
  if (element === "patient_files") return "documents";
  if (element === "patient_finance") return "finance";
  return "summary";
};

const financeView = (element?: SynapseInterfaceElement) => {
  if (element === "finance_entries") return "gestao-lancamentos";
  if (element === "finance_charges") return "gestao-cobrancas";
  return "gestao-visao-geral";
};

async function recordTelemetry(action: SynapseInterfaceAction, channel: "text" | "voice", result: SynapseActionExecutionResult, error?: unknown) {
  const safePayload = {
    action: action.action,
    target: action.target || null,
    destination: action.destination || null,
    has_patient_id: Boolean(action.patientId),
    has_appointment_id: Boolean(action.appointmentId),
    has_note_id: Boolean(action.noteId),
    has_file_id: Boolean(action.fileId),
    has_flow_id: Boolean(action.flowId),
    has_run_id: Boolean(action.runId),
    has_pulse_entry_id: Boolean(action.pulseEntryId),
    neuroview_scope: action.neuroViewScope || null,
    neuroview_mode: action.neuroViewMode || null,
    neuroview_node_count: action.neuroViewNodeIds?.length || 0,
    has_neuroview_focus: Boolean(action.neuroViewFocusNodeId),
    element: action.element || null,
    modal: action.modal || null,
  };
  try {
    await supabase.from("synapse_action_logs").insert({ channel, action_type: action.action, status: result.cancelled ? "cancelled" : result.success ? "success" : "error", duration_ms: result.durationMs, payload: safePayload, error_message: error instanceof Error ? error.message.slice(0, 500) : null });
  } catch {
    const key = "synapse_action_telemetry";
    const current = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
    localStorage.setItem(key, JSON.stringify([...current.slice(-49), { ...safePayload, channel, ...result }]));
  }
}

export function cancelSynapseInterfaceAction() {
  activeController?.abort();
  activeController = null;
}

export function normalizeSynapseClientAction(value: unknown): SynapseInterfaceAction | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Record<string, any>;
  const data = (envelope.data || envelope.payload || envelope) as Record<string, any>;
  if (envelope.type === "interface_action" || data.action) {
    const action = String(data.action || "") as SynapseInterfaceActionName;
    if (!ALLOWED_INTERFACE_ACTIONS.has(action)) return null;
    const normalized: SynapseInterfaceAction = {
      action,
      target: data.target,
      destination: safeSynapseDestination(data.destination),
      patientId: data.patientId || data.patient_id,
      appointmentId: data.appointmentId || data.appointment_id,
      noteId: data.noteId || data.note_id,
      moduleId: data.moduleId || data.module_id,
      taskId: data.taskId || data.task_id,
      fileId: data.fileId || data.file_id,
      flowId: data.flowId || data.flow_id,
      runId: data.runId || data.run_id,
      pulseEntryId: data.pulseEntryId || data.pulse_entry_id,
      mermaid: data.mermaid,
      trace: data.trace,
      neuroViewScope: safeNeuroViewScope(data.neuroViewScope || data.neuroview_scope),
      neuroViewMode: safeNeuroViewMode(data.neuroViewMode || data.neuroview_mode),
      neuroViewNodeIds: safeGraphNodeIds(data.neuroViewNodeIds || data.neuroview_node_ids),
      neuroViewFocusNodeId: safeGraphNodeId(data.neuroViewFocusNodeId || data.neuroview_focus_node_id),
      date: data.date,
      query: data.query,
      notesView: safeNotesView(data.notesView || data.notes_view),
      filesTab: ["personal", "patients"].includes(data.filesTab || data.files_tab)
        ? data.filesTab || data.files_tab
        : undefined,
      agendaView: ["daily", "weekly", "monthly"].includes(data.agendaView || data.agenda_view)
        ? data.agendaView || data.agenda_view
        : undefined,
      workspaceTab: ["transcript", "notes", "patient"].includes(data.workspaceTab || data.workspace_tab)
        ? data.workspaceTab || data.workspace_tab
        : undefined,
      element: safeInterfaceElement(data.element),
      modal: data.modal,
      reason: data.reason,
    };
    if (normalized.action === "open_modal") {
      if (normalized.modal === "new_note") return { ...normalized, action: "open_new_note", notesView: "notes" };
      if (normalized.modal === "patient_details") return { ...normalized, action: "open_patient" };
      if (normalized.modal === "patient_invite") return { ...normalized, action: "open_patient_invite_modal" };
    }
    if (normalized.action === "navigate" && normalized.destination === "notes.neuroview") {
      return { ...normalized, action: "open_neuroview_reasoning", destination: undefined, notesView: "neuroview" };
    }
    if (normalized.action === "navigate" && normalized.destination === "notes.neuroflow") {
      return { ...normalized, action: "open_neuroflow_generation", destination: undefined, notesView: "neuroflow" };
    }
    if (normalized.action === "navigate" && normalized.destination === "notes.neuropulse") {
      return { ...normalized, action: "open_neuropulse_diagram", destination: undefined, notesView: "neuropulse" };
    }
    return normalized;
  }
  if (envelope.type === "navigation_action" && typeof data.path === "string") {
    const path = data.path.replace(/\/$/, "") || "/";
    if (path === "/dashboard") return { action: "navigate", target: "dashboard", reason: data.reason };
    if (path === "/agenda") return { action: "open_daily_schedule", reason: data.reason };
    if (path === "/pacientes") return { action: "navigate", target: "patients", reason: data.reason };
    if (path === "/financeiro") return { action: "navigate", target: "finance", reason: data.reason };
    if (path === "/notas") return { action: "open_notes_desktop", reason: data.reason };
    if (path === "/teleconsulta") return { action: "navigate", target: "teleconsultation", reason: data.reason };
    const patientMatch = path.match(/^\/pacientes\/([a-zA-Z0-9_-]{6,80})(?:\?tab=(prontuario|summary))?$/);
    if (patientMatch && validEntityId(patientMatch[1])) return { action: patientMatch[2] ? "open_patient_record" : "open_patient", patientId: patientMatch[1], reason: data.reason };
  }
  if (envelope.type === "patient_created" && validEntityId(data.id)) return { action: "open_patient", patientId: data.id, reason: "Paciente cadastrado" };
  if (envelope.type === "appointment_scheduled" && validEntityId(data.id || data.appointmentId)) return { action: "scroll_to_appointment", appointmentId: data.id || data.appointmentId, date: data.start_time, reason: "Consulta agendada" };
  if (envelope.type === "personal_note" && validEntityId(data.id)) return { action: "open_note", noteId: data.id, reason: "Nota aberta" };
  return null;
}

export async function executeSynapseInterfaceAction(rawAction: unknown, options: {
  navigate: Navigate;
  channel: "text" | "voice";
  onLifecycle?: (event: SynapseActionLifecycleEvent) => void;
}): Promise<SynapseActionExecutionResult> {
  const startedAt = performance.now();
  const protocolAction = rawAction && typeof rawAction === "object"
    ? rawAction as Record<string, unknown>
    : null;
  if (protocolAction?.type === "synapse_confirmation_challenge") {
    const data = protocolAction.data && typeof protocolAction.data === "object"
      ? protocolAction.data as Record<string, unknown>
      : {};
    const result = await requestOpaqueConfirmation(data.challengeId);
    return {
      success: result.success,
      cancelled: Boolean(result.cancelled),
      action: "navigate",
      message: result.message,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  const action = normalizeSynapseClientAction(rawAction);
  if (!action) return { success: false, action: "navigate", message: "Ação de interface inválida.", durationMs: 0 };
  cancelSynapseInterfaceAction();
  const controller = new AbortController();
  activeController = controller;
  const lifecycleId = globalThis.crypto?.randomUUID?.() || `synapse-action-${Date.now()}`;
  const label = describeSynapseInterfaceAction(action);
  let lastPhase: SynapseActionPhase = "preparing";
  const report = (phase: SynapseActionPhase, message: string, selector?: string) => {
    lastPhase = phase;
    options.onLifecycle?.({
      id: lifecycleId,
      phase,
      action: action.action,
      label,
      message,
      runId: action.runId,
      product: notesProduct(action),
      targetSelector: selector,
    });
  };
  const reportPhase = (phase: SynapseActionPhase, message: string) => {
    if (lastPhase !== phase) report(phase, message);
  };
  const focusPageAction = (pageAction: SynapseInterfaceAction) => {
    reportPhase("focusing", "Destacando o resultado na tela");
    emitPageAction(pageAction);
  };
  const focusNode = (node: Element | null, selector?: string) => {
    if (lastPhase !== "focusing") report("focusing", "Conectando o resultado à interface", selector);
    return highlightNode(node, notesProduct(action));
  };
  report("preparing", "Preparando a solicitação");
  try {
    const { navigate } = options;
    if (action.action !== "highlight_element") reportPhase("navigating", "Abrindo a área correta");
    switch (action.action) {
      case "navigate": {
        if (action.destination) {
          const destination = resolveSynapseDestination(action.destination, {
            patientId: action.patientId,
            appointmentId: action.appointmentId,
            date: action.date,
          });
          if (destination.requires === "patient") throw new Error("Paciente necessário para abrir essa seção.");
          if (destination.requires === "appointment") throw new Error("Consulta necessária para abrir essa seção.");
          if (!destination.path && !destination.pageAction) throw new Error("Destino não permitido.");

          if (destination.path) {
            navigate(destination.path, destination.state ? { state: destination.state } : undefined);
            await nextFrame(controller.signal);
          }

          const pageAction = {
            ...action,
            ...(destination.pageAction || {}),
            destination: action.destination,
          } as SynapseInterfaceAction;
          focusPageAction(pageAction);

          if (destination.selector) {
            const shouldReplayPageAction = pageAction.action === "open_modal";
            const node = shouldReplayPageAction
              ? await waitForPageActionTarget(destination.selector, pageAction, controller.signal)
              : notesProduct(action)
                ? await waitForSurfaceReady(destination.selector, action.runId, controller.signal)
                : await waitForTarget(destination.selector, controller.signal);
            if (!node) throw new Error("A área foi aberta, mas o destino ainda não ficou disponível.");
            focusNode(node, destination.selector);
          }
          break;
        }
        if (!action.target || !ROUTES[action.target]) throw new Error("Destino não permitido.");
        const state = action.target === "teleconsultation" && action.appointmentId ? { activeAppointmentId: action.appointmentId } : action.query ? { synapseQuery: action.query } : undefined;
        const route = action.target === "finance"
          ? `${ROUTES.finance}?view=${financeView(action.element)}`
          : ROUTES[action.target];
        navigate(route, state ? { state } : undefined);
        await nextFrame(controller.signal);
        if (action.query || action.appointmentId) focusPageAction(action);
        const selector = targetSelector(action);
        if (selector) {
          const node = await waitForTarget(selector, controller.signal);
          if (!node) throw new Error("A área foi aberta, mas o destino ainda não ficou disponível.");
          focusNode(node, selector);
        }
        break;
      }
      case "open_patient":
      case "open_patient_record": {
        if (!validEntityId(action.patientId)) throw new Error("Paciente inválido.");
        const suffix = action.action === "open_patient_record" ? `?tab=${patientRecordTab(action.element)}` : "";
        navigate(`/pacientes/${encodeURIComponent(action.patientId!)}${suffix}`);
        await nextFrame(controller.signal);
        focusPageAction(action);
        const selector = targetSelector({
          ...action,
          element: action.action === "open_patient_record" ? action.element || "patient_summary" : action.element || "patient_header",
        });
        const node = await waitForTarget(selector, controller.signal);
        if (!node) throw new Error("A área foi aberta, mas o resultado ainda não ficou disponível.");
        focusNode(node, selector);
        break;
      }
      case "open_daily_schedule": {
        navigate("/agenda");
        const shellSelector = targetSelector({ ...action, element: "daily_schedule" });
        const shellNode = await waitForTarget(shellSelector, controller.signal);
        if (!shellNode) throw new Error("A agenda foi aberta, mas ainda não ficou disponível.");
        focusPageAction(action);
        const selector = targetSelector({ ...action, element: action.element || "agenda_calendar" });
        const node = await waitForTarget(selector, controller.signal);
        if (!node) throw new Error("A agenda foi aberta, mas o período solicitado não ficou disponível.");
        focusNode(node, selector);
        break;
      }
      case "scroll_to_appointment": {
        if (!validEntityId(action.appointmentId)) throw new Error("Agendamento inválido.");
        navigate("/agenda");
        const shellSelector = targetSelector({ ...action, appointmentId: undefined, element: "daily_schedule" });
        const shellNode = await waitForTarget(shellSelector, controller.signal);
        if (!shellNode) throw new Error("A agenda foi aberta, mas ainda não ficou disponível.");
        focusPageAction({ ...action, action: "open_daily_schedule" });
        focusPageAction(action);
        const selector = targetSelector(action);
        const node = await waitForTarget(selector, controller.signal);
        if (!node) throw new Error("A consulta não ficou disponível na agenda.");
        focusNode(node, selector);
        break;
      }
      case "open_teleconsultation_lobby": {
        if (!validEntityId(action.appointmentId)) throw new Error("Sessão inválida.");
        navigate("/teleconsulta", { state: { activeAppointmentId: action.appointmentId } });
        await nextFrame(controller.signal);
        focusPageAction(action);
        const selector = targetSelector({ ...action, element: action.element || "transcription_decision" });
        const node = await waitForTarget(selector, controller.signal, 8000);
        if (!node) throw new Error("A teleconsulta foi aberta, mas a sessão ainda não ficou disponível.");
        focusNode(node, selector);
        break;
      }
      case "open_patient_invite_modal": {
        if (!validEntityId(action.appointmentId)) throw new Error("Sessão inválida.");
        navigate("/teleconsulta", { state: { activeAppointmentId: action.appointmentId, openInvite: true } });
        await nextFrame(controller.signal);
        focusPageAction(action);
        const selector = targetSelector({ ...action, element: "patient_invite" });
        const node = await waitForTarget(selector, controller.signal, 8000);
        if (!node) throw new Error("A teleconsulta foi aberta, mas o convite ainda não ficou disponível.");
        focusNode(node, selector);
        break;
      }
      case "filter_patients_directory": {
        navigate("/pacientes", { state: { synapseQuery: action.query || "" } });
        const selector = targetSelector({ ...action, element: "patients_search" });
        const searchNode = await waitForTarget(selector, controller.signal);
        if (!searchNode) throw new Error("A lista de pacientes foi aberta, mas a busca ainda não ficou disponível.");
        focusPageAction(action);
        const node = await waitForTarget(selector, controller.signal);
        if (!node || !focusNode(node, selector)) throw new Error("Não consegui aplicar o filtro na lista de pacientes.");
        break;
      }
      case "open_notes_desktop":
      case "switch_notes_view":
      case "filter_notes":
      case "open_note":
      case "open_new_note":
      case "open_note_module":
      case "open_tasks_board":
      case "open_files_manager":
      case "open_notion_panel":
      case "open_file_preview":
      case "open_neuroview_reasoning":
      case "open_neuroflow_generation":
      case "open_neuropulse_diagram": {
        const notesView = action.action === "open_tasks_board" ? "tasks" : action.action === "open_files_manager" || action.action === "open_file_preview" ? "files" : action.action === "open_notion_panel" ? "notion" : action.action === "open_neuroview_reasoning" ? "neuroview" : action.action === "open_neuroflow_generation" ? "neuroflow" : action.action === "open_neuropulse_diagram" ? "neuropulse" : action.notesView || "notes";
        const query = new URLSearchParams();
        if (action.noteId && validEntityId(action.noteId)) query.set("noteId", action.noteId);
        const path = query.toString() ? `/notas?${query.toString()}` : "/notas";
        navigate(path, { state: { synapseNotesView: notesView, synapseQuery: action.query || "", synapseNoteId: action.noteId, synapseModuleId: action.moduleId, synapseTaskId: action.taskId, synapseFileId: action.fileId, synapseFlowId: action.flowId, synapseRunId: action.runId, synapsePatientId: action.patientId, synapsePulseEntryId: action.pulseEntryId, synapseMermaid: action.mermaid, synapseTrace: action.trace, synapseNeuroViewScope: action.neuroViewScope, synapseNeuroViewMode: action.neuroViewMode, synapseNeuroViewNodeIds: action.neuroViewNodeIds, synapseNeuroViewFocusNodeId: action.neuroViewFocusNodeId, synapseAction: action.action } });
        await nextFrame(controller.signal);
        focusPageAction({ ...action, notesView });
        const element = action.element || (notesView === "tasks" ? "tasks_board" : notesView === "files" ? "files_manager" : notesView === "notion" ? "notion_panel" : notesView === "neuroview" ? "neuroview_graph" : notesView === "neuroflow" ? "neuroflow_canvas" : notesView === "neuropulse" ? "neuropulse_panel" : action.query ? "notes_search" : "notes_editor");
        const selector = targetSelector({ ...action, element });
        const node = notesProduct(action)
          ? await waitForSurfaceReady(selector, action.runId, controller.signal)
          : await waitForTarget(selector, controller.signal);
        if (!node) throw new Error("A área foi aberta, mas o resultado ainda não ficou disponível.");
        focusNode(node, selector);
        break;
      }
      case "highlight_element": {
        const selector = targetSelector(action);
        if (!selector) throw new Error("Elemento de interface não permitido.");
        const node = await waitForTarget(selector, controller.signal);
        if (!node || !focusNode(node, selector)) throw new Error("O elemento solicitado não ficou disponível.");
        break;
      }
      case "open_modal": {
        const route = action.modal ? MODAL_ROUTES[action.modal] : null;
        const selector = action.modal ? MODAL_TARGETS[action.modal] : null;
        if (!route || !selector) throw new Error("Modal não disponível por esta ação.");
        navigate(route, action.appointmentId ? { state: { activeAppointmentId: action.appointmentId } } : undefined);
        await nextFrame(controller.signal);
        focusPageAction(action);
        const node = await waitForPageActionTarget(selector, action, controller.signal);
        if (!node) throw new Error("A área foi aberta, mas a janela solicitada não ficou disponível.");
        focusNode(node, selector);
        break;
      }
    }
    const result: SynapseActionExecutionResult = { success: true, action: action.action, message: "Ação executada com segurança.", durationMs: Math.round(performance.now() - startedAt), lifecycleId };
    reportPhase("completed", "Ação concluída");
    await recordTelemetry(action, options.channel, result);
    return result;
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    const result: SynapseActionExecutionResult = { success: false, cancelled, action: action.action, message: cancelled ? "Ação cancelada." : error instanceof Error ? error.message : "Falha na ação.", durationMs: Math.round(performance.now() - startedAt), lifecycleId };
    if (!cancelled) reportPhase("error", "Não foi possível concluir a ação");
    await recordTelemetry(action, options.channel, result, error);
    return result;
  } finally {
    if (activeController === controller) activeController = null;
  }
}

export const SYNAPSE_PAGE_ACTION_EVENT = PAGE_ACTION_EVENT;
