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
  | "filter_patients_directory";

export type SynapseNavigationTarget =
  | "dashboard"
  | "agenda"
  | "patients"
  | "finance"
  | "notes"
  | "teleconsultation"
  | "synapse";

export interface SynapseInterfaceAction {
  action: SynapseInterfaceActionName;
  target?: SynapseNavigationTarget;
  patientId?: string;
  appointmentId?: string;
  date?: string;
  query?: string;
  element?: "next_appointment" | "daily_schedule" | "patient_header" | "financial_balance" | "transcription_decision" | "patient_invite" | "patients_search" | "patients_grid";
  modal?: "new_appointment" | "new_patient" | "new_transaction" | "patient_details" | "patient_invite";
  reason?: string;
}

export interface SynapseActionExecutionResult {
  success: boolean;
  action: SynapseInterfaceActionName;
  message: string;
  durationMs: number;
  cancelled?: boolean;
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
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,80}$/;

const SCREEN_AGENT_EVENT = "synapse:screen-agent-state";
const PAGE_ACTION_EVENT = "synapse:page-action";

let activeController: AbortController | null = null;

const sleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => { window.clearTimeout(timeout); reject(new DOMException("Cancelled", "AbortError")); }, { once: true });
  });

const validEntityId = (value?: string) => Boolean(value && (UUID_PATTERN.test(value) || SAFE_ID_PATTERN.test(value)));
const emitScreenState = (detail: Record<string, unknown>) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SCREEN_AGENT_EVENT, { detail })); };
const emitPageAction = (action: SynapseInterfaceAction) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PAGE_ACTION_EVENT, { detail: action })); };

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
  const selectors: Record<NonNullable<SynapseInterfaceAction["element"]>, string> = {
    next_appointment: "[data-synapse-target='next-appointment']",
    daily_schedule: "[data-synapse-target='daily-schedule']",
    patient_header: "[data-synapse-target='patient-header']",
    financial_balance: "[data-synapse-target='financial-balance']",
    transcription_decision: "[data-synapse-target='transcription-decision']",
    patient_invite: "[data-synapse-target='patient-invite']",
    patients_search: "[data-synapse-target='patients-search'] input, [data-synapse-target='patients-search']",
    patients_grid: "[data-synapse-target='patients-grid']",
  };
  return action.element ? selectors[action.element] : "";
};

async function recordTelemetry(action: SynapseInterfaceAction, channel: "text" | "voice", result: SynapseActionExecutionResult, error?: unknown) {
  const safePayload = { action: action.action, target: action.target || null, has_patient_id: Boolean(action.patientId), has_appointment_id: Boolean(action.appointmentId), element: action.element || null, modal: action.modal || null };
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
  emitScreenState({ active: false, cancelled: true, label: "Ação cancelada" });
}

export function normalizeSynapseClientAction(value: unknown): SynapseInterfaceAction | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Record<string, any>;
  const data = (envelope.data || envelope.payload || envelope) as Record<string, any>;
  if (envelope.type === "interface_action" || data.action) {
    const action = String(data.action || "") as SynapseInterfaceActionName;
    if (!["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal", "open_teleconsultation_lobby", "open_patient_invite_modal", "filter_patients_directory"].includes(action)) return null;
    return { action, target: data.target, patientId: data.patientId || data.patient_id, appointmentId: data.appointmentId || data.appointment_id, date: data.date, query: data.query, element: data.element, modal: data.modal, reason: data.reason };
  }
  if (envelope.type === "navigation_action" && typeof data.path === "string") {
    const path = data.path.replace(/\/$/, "") || "/";
    if (path === "/dashboard") return { action: "navigate", target: "dashboard", reason: data.reason };
    if (path === "/agenda") return { action: "open_daily_schedule", reason: data.reason };
    if (path === "/pacientes") return { action: "navigate", target: "patients", reason: data.reason };
    if (path === "/financeiro") return { action: "navigate", target: "finance", reason: data.reason };
    if (path === "/notas") return { action: "navigate", target: "notes", reason: data.reason };
    if (path === "/teleconsulta") return { action: "navigate", target: "teleconsultation", reason: data.reason };
    const patientMatch = path.match(/^\/pacientes\/([a-zA-Z0-9_-]{6,80})(?:\?tab=(prontuario))?$/);
    if (patientMatch && validEntityId(patientMatch[1])) return { action: patientMatch[2] ? "open_patient_record" : "open_patient", patientId: patientMatch[1], reason: data.reason };
  }
  if (envelope.type === "patient_created" && validEntityId(data.id)) return { action: "open_patient", patientId: data.id, reason: "Paciente cadastrado" };
  if (envelope.type === "appointment_scheduled" && validEntityId(data.id || data.appointmentId)) return { action: "scroll_to_appointment", appointmentId: data.id || data.appointmentId, date: data.start_time, reason: "Consulta agendada" };
  return null;
}

export async function executeSynapseInterfaceAction(rawAction: unknown, options: { navigate: Navigate; channel: "text" | "voice" }): Promise<SynapseActionExecutionResult> {
  const action = normalizeSynapseClientAction(rawAction);
  const startedAt = performance.now();
  if (!action) return { success: false, action: "navigate", message: "Ação de interface inválida.", durationMs: 0 };
  cancelSynapseInterfaceAction();
  const controller = new AbortController();
  activeController = controller;
  const label = action.reason || "Synapse está utilizando sua tela";
  emitScreenState({ active: true, action: action.action, label });

  try {
    const { navigate } = options;
    switch (action.action) {
      case "navigate": {
        if (!action.target || !ROUTES[action.target]) throw new Error("Destino não permitido.");
        const state = action.target === "teleconsultation" && action.appointmentId ? { activeAppointmentId: action.appointmentId } : action.query ? { synapseQuery: action.query } : undefined;
        navigate(ROUTES[action.target], state ? { state } : undefined);
        await sleep(420, controller.signal);
        if (action.query || action.appointmentId) emitPageAction(action);
        break;
      }
      case "open_patient":
      case "open_patient_record": {
        if (!validEntityId(action.patientId)) throw new Error("Paciente inválido.");
        const suffix = action.action === "open_patient_record" ? "?tab=prontuario" : "";
        navigate(`/pacientes/${encodeURIComponent(action.patientId!)}${suffix}`);
        await sleep(520, controller.signal);
        emitPageAction(action);
        break;
      }
      case "open_daily_schedule": {
        navigate("/agenda");
        await sleep(520, controller.signal);
        emitPageAction(action);
        await sleep(180, controller.signal);
        highlightNode(document.querySelector("[data-synapse-target='daily-schedule']"));
        break;
      }
      case "scroll_to_appointment": {
        if (!validEntityId(action.appointmentId)) throw new Error("Agendamento inválido.");
        navigate("/agenda");
        await sleep(540, controller.signal);
        emitPageAction({ ...action, action: "open_daily_schedule" });
        await sleep(260, controller.signal);
        emitPageAction(action);
        await sleep(180, controller.signal);
        highlightNode(document.querySelector(targetSelector(action)));
        break;
      }
      case "open_teleconsultation_lobby": {
        if (!validEntityId(action.appointmentId)) throw new Error("Sessão inválida.");
        navigate("/teleconsulta", { state: { activeAppointmentId: action.appointmentId } });
        await sleep(620, controller.signal);
        emitPageAction(action);
        await sleep(180, controller.signal);
        highlightNode(document.querySelector(targetSelector({ ...action, element: action.element || "transcription_decision" })));
        break;
      }
      case "open_patient_invite_modal": {
        if (!validEntityId(action.appointmentId)) throw new Error("Sessão inválida.");
        navigate("/teleconsulta", { state: { activeAppointmentId: action.appointmentId, openInvite: true } });
        await sleep(720, controller.signal);
        emitPageAction(action);
        await sleep(180, controller.signal);
        highlightNode(document.querySelector(targetSelector({ ...action, element: "patient_invite" })));
        break;
      }
      case "filter_patients_directory": {
        navigate("/pacientes", { state: { synapseQuery: action.query || "" } });
        await sleep(520, controller.signal);
        emitPageAction(action);
        await sleep(180, controller.signal);
        highlightNode(document.querySelector(targetSelector({ ...action, element: "patients_search" })));
        break;
      }
      case "highlight_element": {
        const selector = targetSelector(action);
        if (!selector || !highlightNode(document.querySelector(selector))) emitPageAction(action);
        break;
      }
      case "open_modal": {
        const route = action.modal ? MODAL_ROUTES[action.modal] : null;
        if (!route) throw new Error("Modal nao permitido.");
        navigate(route, action.appointmentId ? { state: { activeAppointmentId: action.appointmentId } } : undefined);
        await sleep(520, controller.signal);
        if (!action.modal) throw new Error("Modal não permitido.");
        emitPageAction(action);
        break;
      }
    }
    const result: SynapseActionExecutionResult = { success: true, action: action.action, message: "Ação executada com segurança.", durationMs: Math.round(performance.now() - startedAt) };
    await recordTelemetry(action, options.channel, result);
    emitScreenState({ active: false, completed: true, action: action.action, label: "Ação concluída" });
    return result;
  } catch (error) {
    const cancelled = error instanceof DOMException && error.name === "AbortError";
    const result: SynapseActionExecutionResult = { success: false, cancelled, action: action.action, message: cancelled ? "Ação cancelada." : error instanceof Error ? error.message : "Falha na ação.", durationMs: Math.round(performance.now() - startedAt) };
    await recordTelemetry(action, options.channel, result, error);
    emitScreenState({ active: false, cancelled, error: !cancelled, label: result.message });
    return result;
  } finally {
    if (activeController === controller) activeController = null;
  }
}

export const SYNAPSE_SCREEN_AGENT_EVENT = SCREEN_AGENT_EVENT;
export const SYNAPSE_PAGE_ACTION_EVENT = PAGE_ACTION_EVENT;
