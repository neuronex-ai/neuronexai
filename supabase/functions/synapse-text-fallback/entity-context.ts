import { normalizePatientName, resolvePatientByName } from "./patient-resolver.ts";

export interface ConfirmedPatientAlias {
  alias: string;
  patientId: string;
  confirmedAt: string;
}

export interface SynapseConversationState {
  activePatientId?: string | null;
  activePatientName?: string | null;
  activeAppointmentId?: string | null;
  activeAppointmentLabel?: string | null;
  activeChargeId?: string | null;
  activeInvoiceId?: string | null;
  activeNoteId?: string | null;
  activeNoteTitle?: string | null;
  activeTaskId?: string | null;
  activeTaskTitle?: string | null;
  activeFileId?: string | null;
  activeFileName?: string | null;
  patientAliases?: ConfirmedPatientAlias[];
  lastTool?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
}

export interface LoadedConversationContext {
  state: SynapseConversationState;
  memorySummary: string;
  memoryUpdatedAt: string | null;
  persistenceAvailable: boolean;
}

export class EntityResolutionError extends Error {
  code: "patient_not_found" | "patient_ambiguous" | "patient_name_required";
  details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "EntityResolutionError";
    this.code = (details.resolution as EntityResolutionError["code"]) || "patient_not_found";
    this.details = details;
  }
}

const clean = (value: unknown, max = 300) => String(value ?? "").trim().slice(0, max);
const safeId = (value: unknown) => {
  const id = clean(value, 100);
  return /^[a-zA-Z0-9_-]{6,100}$/.test(id) ? id : "";
};

export async function loadConversationContext(admin: any, userId: string, sessionId: string): Promise<LoadedConversationContext> {
  const { data, error } = await admin.from("chat_sessions").select("context_state,memory_summary,memory_updated_at").eq("id", sessionId).eq("user_id", userId).maybeSingle();
  if (error) {
    console.warn("[synapse-context] Durable context columns unavailable:", error.message);
    return { state: {}, memorySummary: "", memoryUpdatedAt: null, persistenceAvailable: false };
  }
  return { state: data?.context_state && typeof data.context_state === "object" ? data.context_state : {}, memorySummary: clean(data?.memory_summary, 12000), memoryUpdatedAt: data?.memory_updated_at || null, persistenceAvailable: true };
}

export async function saveConversationContext(admin: any, userId: string, sessionId: string, state: SynapseConversationState, memorySummary?: string) {
  const nextState = { ...state, updatedAt: new Date().toISOString() };
  const payload: Record<string, unknown> = { context_state: nextState, updated_at: new Date().toISOString() };
  if (memorySummary !== undefined) {
    payload.memory_summary = clean(memorySummary, 12000) || null;
    payload.memory_updated_at = new Date().toISOString();
  }
  const { error } = await admin.from("chat_sessions").update(payload).eq("id", sessionId).eq("user_id", userId);
  if (error) console.warn("[synapse-context] Could not persist context:", error.message);
  return nextState;
}

async function findOwnedPatientById(admin: any, userId: string, patientId: string) {
  const { data, error } = await admin.from("patients").select("id,name,status,email,phone,cpf").eq("id", patientId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data || null;
}

type PatientReferenceOptions = { required?: boolean; searchClient?: any };

export async function resolvePatientReference(admin: any, userId: string, args: Record<string, any>, state: SynapseConversationState, options: PatientReferenceOptions = {}) {
  const explicitId = safeId(args.patient_id || args.patientId);
  if (explicitId) {
    const patient = await findOwnedPatientById(admin, userId, explicitId);
    if (!patient) throw new EntityResolutionError("Não encontrei esse paciente na sua conta.");
    return { patient, args: { ...args, patient_id: patient.id, patient_name: patient.name } };
  }
  const explicitName = clean(args.patient_name || args.patientName || "", 160);
  if (explicitName) {
    const normalizedAlias = normalizePatientName(explicitName);
    const alias = (state.patientAliases || []).find((item) =>
      item.alias === normalizedAlias && safeId(item.patientId)
    );
    if (alias) {
      const patient = await findOwnedPatientById(admin, userId, alias.patientId);
      if (patient) return { patient, args: { ...args, patient_id: patient.id, patient_name: patient.name, _confirmed_patient_alias: normalizedAlias } };
    }
    const resolution = await resolvePatientByName(admin, userId, explicitName, {
      preferredPatientId: safeId(state.activePatientId) || null,
      searchClient: options.searchClient,
    });
    if (resolution.status === "not_found") {
      throw new EntityResolutionError(`Não encontrei paciente compatível com “${explicitName}”.`, { resolution: "patient_not_found", query: explicitName });
    }
    if (resolution.status === "ambiguous") {
      throw new EntityResolutionError(`Encontrei mais de um paciente compatível com “${explicitName}”. Qual deles: ${resolution.candidates.slice(0, 5).map((item) => item.name).join(", ")}?`, {
        resolution: "patient_ambiguous",
        candidates: resolution.candidates.slice(0, 5).map((item) => ({ name: item.name, status: item.status })),
      });
    }
    const patient = resolution.patient;
    return { patient, args: { ...args, patient_id: patient.id, patient_name: patient.name, _confirmed_patient_alias: normalizedAlias } };
  }
  const contextualId = safeId(state.activePatientId);
  if (contextualId) {
    const patient = await findOwnedPatientById(admin, userId, contextualId);
    if (patient) return { patient, args: { ...args, patient_id: patient.id, patient_name: patient.name } };
  }
  if (options.required) throw new EntityResolutionError("Diga o nome do paciente para eu localizar o cadastro correto.", { resolution: "patient_name_required" });
  return { patient: null, args };
}

const sameLocalDate = (iso: string, date: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso)) === date;
const localTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const localDateTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export async function resolveAppointmentReference(admin: any, userId: string, args: Record<string, any>, state: SynapseConversationState, options: PatientReferenceOptions = {}) {
  const explicitId = safeId(args.appointment_id || args.appointmentId);
  if (explicitId) {
    const { data, error } = await admin.from("appointments").select("id,patient_id,start_time,end_time,type,status,location,google_meet_link,patient:patient_id(name,email,phone)").eq("id", explicitId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) throw new EntityResolutionError("Não encontrei essa consulta na sua agenda.");
    return { appointment: data, args: { ...args, appointment_id: data.id } };
  }
  const patientResolution = await resolvePatientReference(admin, userId, args, state, { required: false, searchClient: options.searchClient });
  const patient = patientResolution.patient;
  const contextualAppointmentId = safeId(state.activeAppointmentId);
  if (!patient && contextualAppointmentId) return resolveAppointmentReference(admin, userId, { ...args, appointment_id: contextualAppointmentId }, state, options);
  if (!patient) {
    if (options.required) throw new EntityResolutionError("Diga o nome do paciente ou a data da consulta para eu localizar o agendamento.");
    return { appointment: null, args: patientResolution.args };
  }
  const nowMinusDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("appointments").select("id,patient_id,start_time,end_time,type,status,location,google_meet_link,patient:patient_id(name,email,phone)").eq("user_id", userId).eq("patient_id", patient.id).not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)").gte("start_time", nowMinusDay).order("start_time").limit(20);
  if (error) throw error;
  let candidates = data || [];
  const date = clean(args.appointment_date || args.current_date || "", 10);
  const time = clean(args.appointment_time || args.current_time || "", 8).slice(0, 5);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) candidates = candidates.filter((item: any) => sameLocalDate(item.start_time, date));
  if (time) candidates = candidates.filter((item: any) => localTime(item.start_time).replace("h", ":").slice(0, 5) === time);
  if (!candidates.length) throw new EntityResolutionError(`Não encontrei uma consulta compatível para ${patient.name}.`, { resolution: "appointment_not_found", patient_name: patient.name });
  if (candidates.length > 1) throw new EntityResolutionError(`Há mais de uma consulta possível para ${patient.name}. Qual delas: ${candidates.slice(0, 5).map((item: any) => localDateTime(item.start_time)).join(", ")}?`, { resolution: "appointment_ambiguous", patient_name: patient.name, candidates: candidates.slice(0, 5).map((item: any) => ({ date: localDateTime(item.start_time), type: item.type })) });
  return { appointment: candidates[0], args: { ...patientResolution.args, appointment_id: candidates[0].id, patient_id: patient.id, patient_name: patient.name } };
}

const PATIENT_REQUIRED_TOOLS = new Set([
  "get_patient_details", "get_clinical_history", "get_patient_card_summary", "update_patient", "update_patient_basic_info", "inactivate_patient", "create_session_note", "create_appointment", "reschedule_appointment", "cancel_appointment", "create_neurofinance_charge", "create_fiscal_invoice", "send_appointment_reminder", "send_patient_email", "get_patient_system_snapshot", "get_patient_payment_status", "get_patient_timeline", "analyze_neuroview_patient_patterns", "create_neuroflow_from_patient_history", "create_neuropulse_cause_effect_diagram",
]);
const PATIENT_OPTIONAL_TOOLS = new Set([
  "get_calendar", "get_appointment_details", "get_teleconsultation_session_status", "get_teleconsultation_readiness", "list_financial_entries", "list_documents", "request_interface_action", "create_financial_entry", "list_neurofinance_charges", "get_neurofinance_charge", "list_fiscal_invoices", "get_fiscal_invoice", "create_personal_note", "search_patient_files", "list_files_by_patient", "link_file_to_patient",
]);
const APPOINTMENT_REQUIRED_TOOLS = new Set([
  "get_appointment_details", "get_teleconsultation_session_status", "get_teleconsultation_readiness", "set_teleconsultation_transcription_decision", "close_teleconsultation_room", "reschedule_appointment", "cancel_appointment", "send_appointment_reminder",
]);
const NOTE_CONTEXT_TOOLS = new Set([
  "get_personal_note_details", "summarize_note", "extract_tasks_from_note", "update_personal_note", "append_to_personal_note", "rename_personal_note", "move_note_to_module", "tag_personal_note", "delete_personal_note", "create_task",
]);
const TASK_CONTEXT_TOOLS = new Set(["get_task_details", "update_task", "complete_task", "reopen_task", "move_task_category", "delete_task"]);
const FILE_CONTEXT_TOOLS = new Set(["get_file_details", "link_file_to_patient", "unlink_file_from_patient", "delete_file"]);

export async function enrichToolArguments(admin: any, userId: string, toolName: string, originalArgs: Record<string, any>, state: SynapseConversationState, searchClient?: any) {
  let args = { ...originalArgs };
  let patient: any = null;
  let appointment: any = null;
  if (PATIENT_REQUIRED_TOOLS.has(toolName) || PATIENT_OPTIONAL_TOOLS.has(toolName)) {
    const patientResult = await resolvePatientReference(admin, userId, args, state, { required: PATIENT_REQUIRED_TOOLS.has(toolName), searchClient });
    args = patientResult.args;
    patient = patientResult.patient;
  }
  if (APPOINTMENT_REQUIRED_TOOLS.has(toolName)) {
    const appointmentResult = await resolveAppointmentReference(admin, userId, args, state, { required: true, searchClient });
    args = appointmentResult.args;
    appointment = appointmentResult.appointment;
  }
  if (NOTE_CONTEXT_TOOLS.has(toolName) && !args.note_id && !args.note_title && state.activeNoteId) args.note_id = state.activeNoteId;
  if (TASK_CONTEXT_TOOLS.has(toolName) && !args.task_id && !args.task_title && state.activeTaskId) args.task_id = state.activeTaskId;
  if (FILE_CONTEXT_TOOLS.has(toolName) && !args.file_id && !args.file_name && state.activeFileId) args.file_id = state.activeFileId;
  if (toolName === "get_neurofinance_charge" && !args.charge_id && state.activeChargeId) args.charge_id = state.activeChargeId;
  if (toolName === "get_fiscal_invoice" && !args.invoice_id && state.activeInvoiceId) args.invoice_id = state.activeInvoiceId;
  return { args, patient, appointment };
}

export function updateContextFromResult(current: SynapseConversationState, toolName: string, args: Record<string, any>, result: any): SynapseConversationState {
  const next: SynapseConversationState = { ...current, lastTool: toolName, updatedAt: new Date().toISOString() };
  const data = result?.data || result || {};
  const singlePatient = Array.isArray(data.patients) && data.patients.length === 1 ? data.patients[0] : null;
  const patient = data.patient || singlePatient || data?.appointment?.patient || data?.appointment || data?.session?.appointment || data?.charge?.patient || data?.invoice?.patient;
  const patientId = safeId(patient?.id || data.patient_id || data?.appointment?.patient_id || data?.session?.appointment?.patient_id || data?.charge?.patient_id || args.patient_id);
  const patientName = clean(patient?.name || data.patient_name || data?.appointment?.patient_name || data?.session?.appointment?.patient_name || data?.charge?.patient_name || args.patient_name, 180);
  if (patientId) next.activePatientId = patientId;
  if (patientName) next.activePatientName = patientName;
  const confirmedAlias = normalizePatientName(args._confirmed_patient_alias);
  if (patientId && confirmedAlias && confirmedAlias !== normalizePatientName(patientName)) {
    const aliases = (next.patientAliases || []).filter((item) => item.alias !== confirmedAlias && item.patientId !== patientId);
    next.patientAliases = [{ alias: confirmedAlias, patientId, confirmedAt: new Date().toISOString() }, ...aliases].slice(0, 10);
  }
  const appointment = data.appointment || data?.session?.appointment || (Array.isArray(data.appointments) && data.appointments.length === 1 ? data.appointments[0] : null);
  const appointmentId = safeId(appointment?.id || data.appointment_id || args.appointment_id);
  if (appointmentId) next.activeAppointmentId = appointmentId;
  if (appointment?.start_time || appointment?.start_time_local) next.activeAppointmentLabel = clean(appointment.start_time_local || localDateTime(appointment.start_time), 180);
  const charge = data.charge || data.payment || (Array.isArray(data.charges) && data.charges.length === 1 ? data.charges[0] : null);
  const chargeId = safeId(charge?.id || data.charge_id || data.payment_id || args.charge_id);
  if (chargeId) next.activeChargeId = chargeId;
  const invoice = data.invoice || (Array.isArray(data.invoices) && data.invoices.length === 1 ? data.invoices[0] : null);
  const invoiceId = safeId(invoice?.id || data.invoice_id || args.invoice_id);
  if (invoiceId) next.activeInvoiceId = invoiceId;
  const note = data.note || (Array.isArray(data.notes) && data.notes.length === 1 ? data.notes[0] : null);
  const noteId = safeId(note?.id || data.note_id || args.note_id);
  if (noteId) next.activeNoteId = noteId;
  if (note?.title || args.note_title) next.activeNoteTitle = clean(note?.title || args.note_title, 180);
  const task = data.task || (Array.isArray(data.tasks) && data.tasks.length === 1 ? data.tasks[0] : null);
  const taskId = safeId(task?.id || data.task_id || args.task_id);
  if (taskId) next.activeTaskId = taskId;
  if (task?.title || args.task_title) next.activeTaskTitle = clean(task?.title || args.task_title, 180);
  const file = data.file || (Array.isArray(data.files) && data.files.length === 1 ? data.files[0] : null);
  const fileId = safeId(file?.id || data.file_id || args.file_id);
  if (fileId) next.activeFileId = fileId;
  if (file?.name || args.file_name) next.activeFileName = clean(file?.name || args.file_name, 180);
  return next;
}

export function formatContextForPrompt(state: SynapseConversationState) {
  const lines = [
    state.activePatientName ? `Paciente em contexto: ${state.activePatientName}.` : "",
    state.activeAppointmentLabel ? `Consulta em contexto: ${state.activeAppointmentLabel}.` : "",
    state.activeNoteTitle ? `Nota em contexto: ${state.activeNoteTitle}.` : "",
    state.activeTaskTitle ? `Tarefa em contexto: ${state.activeTaskTitle}.` : "",
    state.activeFileName ? `Arquivo em contexto: ${state.activeFileName}.` : "",
    state.activeChargeId ? "Há uma cobrança NeuroFinance ativa no contexto interno." : "",
    state.activeInvoiceId ? "Há uma NFS-e ativa no contexto interno." : "",
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "Nenhuma entidade específica está selecionada no contexto durável.";
}
