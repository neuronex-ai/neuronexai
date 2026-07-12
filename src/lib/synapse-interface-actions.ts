import { supabase } from "@/integrations/supabase/client";

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

export interface SynapseInterfaceAction {
  action: SynapseInterfaceActionName;
  target?: SynapseNavigationTarget;
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
  date?: string;
  query?: string;
  notesView?: SynapseNotesView;
  element?: "next_appointment" | "daily_schedule" | "patient_header" | "financial_balance" | "transcription_decision" | "patient_invite" | "patients_search" | "patients_grid" | "notes_search" | "notes_editor" | "notes_list" | "notes_sidebar" | "tasks_board" | "files_manager" | "notion_panel" | "neuroview_graph" | "neuroflow_canvas" | "neuropulse_panel";
  modal?: "new_appointment" | "new_patient" | "new_transaction" | "patient_details" | "patient_invite" | "new_note";
  reason?: string;
}

export interface SynapseActionExecutionResult {
  success: boolean;
  action: SynapseInterfaceActionName;
  message: string;
  durationMs: number;
  cancelled?: boolean;
}

export type SynapseActionPhase = "preparing" | "navigating" | "focusing" | "completed" | "error";

export interface SynapseActionLifecycleEvent {
  id: string;
  phase: SynapseActionPhase;
  action: SynapseInterfaceActionName;
  label: string;
  message: string;
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
  patient_details: "/pacientes",
  patient_invite: "/teleconsulta",
  new_note: "/notas",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,80}$/;
const NOTES_VIEWS = new Set(["notes", "tasks", "files", "notion", "neuroview", "neuroflow", "neuropulse"]);
const ALLOWED_INTERFACE_ACTIONS = new Set<SynapseInterfaceActionName>(["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal", "open_teleconsultation_lobby", "open_patient_invite_modal", "filter_patients_directory", "open_notes_desktop", "switch_notes_view", "open_note", "filter_notes", "open_new_note", "open_note_module", "open_tasks_board", "open_files_manager", "open_notion_panel", "open_file_preview", "open_neuroview_reasoning", "open_neuroflow_generation", "open_neuropulse_diagram"]);

const PAGE_ACTION_EVENT = "synapse:page-action";

let activeController: AbortController | null = null;

const sleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => { window.clearTimeout(timeout); reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
  });

const validEntityId = (value?: string) => Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
const safeNotesView = (value?: string): SynapseNotesView | undefined => value && NOTES_VIEWS.has(value) ? value as SynapseNotesView : undefined;
const emitPageAction = (action: SynapseInterfaceAction) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAGE_ACTION_EVENT, { detail: action })); };

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

const highlightNode = (node: Element | null) => {
  if (!(node instanceof HTMLElement)) return false;
  node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  node.dataset.synapseHighlighted = "true";
  node.classList.add("synapse-interface-highlight");
  window.setTimeout(() => { node.classList.remove("synapse-interface-highlight"); delete node.dataset.synapseHighlighted; }, 4200);
  return true;
};

const targetSelector = (action: SynapseInterfaceAction) => {
  if (action.appointmentId && validEntityId(action.appointmentId)) {
    const escaped = CSS.escape(action.appointmentId);
    return `[data-synapse-appointment-id="${escaped}"], [data-appointment-id="${escaped}"]`;
  }
  if (action.noteId && validEntityId(action.noteId)) return `[data-synapse-note-id="${CSS.escape(action.noteId)}"]`;
  if (action.fileId && validEntityId(action.fileId)) return `[data-synapse-file-id="${CSS.escape(action.fileId)}"]`;
  const selectors: Record<NonNullable<SynapseInterfaceAction["element"]>, string> = {
    next_appointment: "[data-synapse-target='next-appointment']",
    daily_schedule: "[data-synapse-target='daily-schedule']",
    patient_header: "[data-synapse-target='patient-header']",
    financial_balance: "[data-synapse-target='financial-balance']",
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
    neuroview_graph: "[data-synapse-target='neuroview-graph']",
    neuroflow_canvas: "[data-synapse-target='neuroflow-canvas']",
    neuropulse_panel: "[data-synapse-target='neuropulse-panel']",
  };
  return action.element ? selectors[action.element] : "";
};

async function recordTelemetry(action: SynapseInterfaceAction, channel: "text" | "voice", result: SynapseActionExecutionResult, error?: unknown) {
  const safePayload = { action: action.action, target: action.target || null, has_patient_id: Boolean(action.patientId), has_appointment_id: Boolean(action.appointmentId), has_note_id: Boolean(action.noteId), has_file_id: Boolean(action.fileId), has_flow_id: Boolean(action.flowId), has_run_id: Boolean(action.runId), has_pulse_entry_id: Boolean(action.pulseEntryId), element: action.element || null, modal: action.modal || null };
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
    return { action, target: data.target, patientId: data.patientId || data.patient_id, appointmentId: data.appointmentId || data.appointment_id, noteId: data.noteId || data.note_id, moduleId: data.moduleId || data.module_id, taskId: data.taskId || data.task_id, fileId: data.fileId || data.file_id, flowId: data.flowId || data.flow_id, runId: data.runId || data.run_id, pulseEntryId: data.pulseEntryId || data.pulse_entry_id, mermaid: data.mermaid, trace: data.trace, date: data.date, query: data.query, notesView: safeNotesView(data.notesView || data.notes_view), element: data.element, modal: data.modal, reason: data.reason };
  }
  if (envelope.type === "navigation_action" && typeof data.path === "string") {
    const path = data.path.replace(/\/$/, "") || "/";
    if (path === "/dashboard") return { action: "navigate", target: "dashboard", reason: data.reason };
    if (path === "/agenda") return { action: "open_daily_schedule", reason: data.reason };
    if (path === "/pacientes") return { action: "navigate", target: "patients", reason: data.reason };
    if (path === "/financeiro") return { action: "navigate", target: "finance", reason: data.reason };
    if (path === "/notas") return { action: "open_notes_desktop", reason: data.reason };
    if (path === "/teleconsulta") return { action: "navigate", target: "teleconsultation", reason: data.reason };
    const patientMatch = path.match(/^\/pacientes\/([a-zA-Z0-9_-]{6,80})(?:\?tab=(prontuario))?$/);
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
  const action = normalizeSynapseClientAction(rawAction);
  const startedAt = performance.now();
  if (!action) return { success: false, action: "navigate", message: "Ação de interface inválida.", durationMs: 0 };
  cancelSynapseInterfaceAction();
  const controller = new AbortController();
  activeController = controller;
  const lifecycleId = globalThis.crypto?.randomUUID?.() || `synapse-action-${Date.now()}`;
  const label = describeSynapseInterfaceAction(action);
  let lastPhase: SynapseActionPhase = "preparing";
  const report = (phase: SynapseActionPhase, message: string) => {
    lastPhase = phase;
    options.onLifecycle?.({ id: lifecycleId, phase, action: action.action, label, message });
  };
  const reportPhase = (phase: SynapseActionPhase, message: string) => {
    if (lastPhase !== phase) report(phase, message);
  };
  const focusPageAction = (pageAction: SynapseInterfaceAction) => {
    reportPhase("focusing", "Destacando o resultado na tela");
    emitPageAction(pageAction);
  };
  const focusNode = (node: Element | null) => {
    reportPhase("focusing", "Destacando o resultado na tela");
    return highlightNode(node);
  };
  report("preparing", "Preparando a solicitação");
  try {
    const { navigate } = options;
    if (action.action !== "highlight_element") reportPhase("navigating", "Abrindo a área correta");
    switch (action.action) {
      case "navigate": {
        if (!action.target || !ROUTES[action.target]) throw new Error("Destino não permitido.");
        const state = action.target === "teleconsultation" && action.appointmentId ? { activeAppointmentId: action.appointmentId } : action.query ? { synapseQuery: action.query } : undefined;
        navigate(ROUTES[action.target], state ? { state } : undefined);
        await sleep(420, controller.signal);
        if (action.query || action.appointmentId) focusPageAction(action);
        break;
      }
      case "open_patient":
      case "open_patient_record": {
        if (!validEntityId(action.patientId)) throw new Error("Paciente inválido.");
        const suffix = action.action === "open_patient_record" ? "?tab=prontuario" : "";
        navigate(`/pacientes/${encodeURIComponent(action.patientId!)}${suffix}`);
        await sleep(520, controller.signal);
        focusPageAction(action);
        break;
      }
      case "open_daily_schedule": {
        navigate("/agenda");
        await sleep(520, controller.signal);
        focusPageAction(action);
        await sleep(180, controller.signal);
        focusNode(document.querySelector("[data-synapse-target='daily-schedule']"));
        break;
      }
      case "scroll_to_appointment": {
        if (!validEntityId(action.appointmentId)) throw new Error("Agendamento inválido.");
        navigate("/agenda");
        await sleep(540, controller.signal);
        focusPageAction({ ...action, action: "open_daily_schedule" });
        await sleep(260, controller.signal);
        focusPageAction(action);
        await sleep(180, controller.signal);
        focusNode(document.querySelector(targetSelector(action)));
        break;
      }
      case "open_teleconsultation_lobby": {
        if (!validEntityId(action.appointmentId)) throw new Error("Sessão inválida.");
        navigate("/teleconsulta", { state: { activeAppointmentId: action.appointmentId } });
        await sleep(620, controller.signal);
        focusPageAction(action);
        await sleep(180, controller.signal);
        focusNode(document.querySelector(targetSelector({ ...action, element: action.element || "transcription_decision" })));
        break;
      }
      case "open_patient_invite_modal": {
        if (!validEntityId(action.appointmentId)) throw new Error("Sessão inválida.");
        navigate("/teleconsulta", { state: { activeAppointmentId: action.appointmentId, openInvite: true } });
        await sleep(720, controller.signal);
        focusPageAction(action);
        await sleep(180, controller.signal);
        focusNode(document.querySelector(targetSelector({ ...action, element: "patient_invite" })));
        break;
      }
      case "filter_patients_directory": {
        navigate("/pacientes", { state: { synapseQuery: action.query || "" } });
        await sleep(520, controller.signal);
        focusPageAction(action);
        await sleep(180, controller.signal);
        focusNode(document.querySelector(targetSelector({ ...action, element: "patients_search" })));
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
        navigate(path, { state: { synapseNotesView: notesView, synapseQuery: action.query || "", synapseNoteId: action.noteId, synapseModuleId: action.moduleId, synapseTaskId: action.taskId, synapseFileId: action.fileId, synapseFlowId: action.flowId, synapseRunId: action.runId, synapsePatientId: action.patientId, synapsePulseEntryId: action.pulseEntryId, synapseMermaid: action.mermaid, synapseTrace: action.trace, synapseAction: action.action } });
        await sleep(560, controller.signal);
        focusPageAction({ ...action, notesView });
        await sleep(180, controller.signal);
        const element = action.element || (notesView === "tasks" ? "tasks_board" : notesView === "files" ? "files_manager" : notesView === "notion" ? "notion_panel" : notesView === "neuroview" ? "neuroview_graph" : notesView === "neuroflow" ? "neuroflow_canvas" : notesView === "neuropulse" ? "neuropulse_panel" : action.query ? "notes_search" : "notes_editor");
        focusNode(document.querySelector(targetSelector({ ...action, element })));
        break;
      }
      case "highlight_element": {
        const selector = targetSelector(action);
        if (!selector || !focusNode(document.querySelector(selector))) focusPageAction(action);
        break;
      }
      case "open_modal": {
        const route = action.modal ? MODAL_ROUTES[action.modal] : null;
        if (!route) throw new Error("Modal nao permitido.");
        navigate(route, action.appointmentId ? { state: { activeAppointmentId: action.appointmentId } } : undefined);
        await sleep(520, controller.signal);
        if (!action.modal) throw new Error("Modal não permitido.");
        focusPageAction(action);
        break;
      }
    }
    const result: SynapseActionExecutionResult = { success: true, action: action.action, message: "Ação executada com segurança.", durationMs: Math.round(performance.now() - startedAt) };
    reportPhase("completed", "Ação concluída");
    await recordTelemetry(action, options.channel, result);
    return result;
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    const result: SynapseActionExecutionResult = { success: false, cancelled, action: action.action, message: cancelled ? "Ação cancelada." : error instanceof Error ? error.message : "Falha na ação.", durationMs: Math.round(performance.now() - startedAt) };
    if (!cancelled) reportPhase("error", "Não foi possível concluir a ação");
    await recordTelemetry(action, options.channel, result, error);
    return result;
  } finally {
    if (activeController === controller) activeController = null;
  }
}

export const SYNAPSE_PAGE_ACTION_EVENT = PAGE_ACTION_EVENT;
