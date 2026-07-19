// @ts-nocheck
import { MUTATING_TOOLS, SYNAPSE_INTERFACE_DESTINATIONS } from "./tools.ts";
import {
  executeConfirmedNotesMutation,
  executeNotesTool,
  NOTES_MUTATION_TOOLS,
  NOTES_READ_TOOLS,
  summarizeNotesMutation,
} from "./notes-tools.ts";
import { executeNeuroNotesAgentTool } from "./neuro-notes-tools.ts";
import {
  appointmentPlanSummary,
  cancelAppointmentActionPlan,
  executeAgendaActionPlan,
  executeAppointmentActionPlan,
  normalizeAppointmentPlanChannel,
  prepareAgendaActionPlan,
  prepareAppointmentActionPlan,
} from "../_shared/appointment-action-plans.ts";
import {
  formatPatientAmbiguity,
  resolvePatientCandidates,
  resolvePatientByName as resolvePatientNameReference,
} from "./patient-resolver.ts";

export interface AgentToolContext {
  admin: any;
  userId: string;
  sessionId: string;
  channel?: "panel" | "voice" | "whatsapp";
  voiceSessionId?: string | null;
  whatsappMessageId?: string | null;
  toolCallId?: string | null;
  correlationId?: string | null;
}

export interface PendingAction {
  kind: "synapse_pending_action";
  actionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  summary: string;
  status: "pending" | "executing" | "executed" | "cancelled" | "failed";
  createdAt: string;
  expiresAt: string;
}

export interface AgentToolResult {
  ok: boolean;
  grounded: boolean;
  data?: any;
  error?: string;
  recordCount?: number;
  structuredData?: any;
  clientAction?: any;
  pendingAction?: PendingAction;
  message?: string;
  errorCode?: string;
}

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelled_by_patient", "cancelled_by_professional"]);
const PAID_STATUSES = new Set(["paid", "received", "completed"]);
const APPOINTMENT_MUTATION_TOOLS = new Set([
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "set_teleconsultation_transcription_decision",
  "close_teleconsultation_room",
]);

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};
const cleanText = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const cleanId = (value: unknown) => {
  const result = cleanText(value, 100);
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(result)) throw new Error("Identificador inválido.");
  return result;
};
const cleanGraphNodeId = (value: unknown) => {
  const result = cleanText(value, 160);
  const hasControlCharacter = Array.from(result).some((character) => {
    const codePoint = character.codePointAt(0) || 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (!result || hasControlCharacter) throw new Error("Identificador de node inválido.");
  return result;
};
const cleanGraphNodeIds = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  const ids = Array.from(new Set(value.slice(0, 80).map(cleanGraphNodeId)));
  return ids.length ? ids : undefined;
};
const dateOnly = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
const addDays = (date: Date, amount: number) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };
const localDate = (value: string) => dateOnly(new Date(value));
const formatDateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const formatTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const brazilIso = (value: string) => {
  const raw = cleanText(value, 40);
  if (!raw) throw new Error("Data e hora ausentes.");
  const withZone = raw.includes("T") && !/Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw}-03:00` : raw;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data e hora inválidas.");
  return parsed.toISOString();
};

const dateBounds = (startValue?: unknown, endValue?: unknown) => {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const defaultEnd = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  const start = cleanText(startValue || defaultStart, 10);
  const end = cleanText(endValue || start || defaultEnd, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error("Período inválido.");
  return { start, end, startIso: new Date(`${start}T00:00:00-03:00`).toISOString(), endIso: new Date(`${end}T23:59:59-03:00`).toISOString() };
};

const summarizeMutation = (name: string, args: Record<string, any>) => {
  if (NOTES_MUTATION_TOOLS.has(name)) return summarizeNotesMutation(name, args);
  switch (name) {
    case "create_patient": return `Cadastrar o paciente ${cleanText(args.name, 120)}${args.email ? `, e-mail ${cleanText(args.email, 160)}` : ""}.`;
    case "update_patient":
    case "update_patient_basic_info": {
      const fields = Object.keys(args).filter((key) => !["patient_id", "patient_name"].includes(key));
      return `Atualizar ${fields.join(", ") || "os dados cadastrais"} de ${cleanText(args.patient_name || "paciente selecionado", 120)}.`;
    }
    case "inactivate_patient": return `Inativar o paciente ${cleanText(args.patient_name || "selecionado", 120)}${args.reason ? `, motivo: ${cleanText(args.reason, 180)}` : ""}.`;
    case "create_session_note": return `Registrar uma anotação no prontuário de ${cleanText(args.patient_name || "paciente selecionado", 120)}: “${cleanText(args.notes, 240)}”.`;
    case "create_appointment": return `Agendar ${cleanText(args.patient_name || "a consulta", 120)} para ${formatDateTime(brazilIso(args.datetime))}, com ${clamp(args.duration_minutes, 50, 15, 240)} minutos.`;
    case "reschedule_appointment": return `Remarcar a consulta de ${cleanText(args.patient_name || "paciente selecionado", 120)} para ${formatDateTime(brazilIso(args.new_datetime))}.`;
    case "cancel_appointment": return `Cancelar a consulta de ${cleanText(args.patient_name || "paciente selecionado", 120)}${args.reason ? `, motivo: ${cleanText(args.reason, 240)}` : ""}.`;
    case "set_teleconsultation_transcription_decision": return `${args.enabled === false ? "Desativar" : "Autorizar"} transcrição da sessão de ${cleanText(args.patient_name || "paciente selecionado", 120)}.`;
    case "close_teleconsultation_room": return `Encerrar a sala de teleconsulta de ${cleanText(args.patient_name || "paciente selecionado", 120)}${args.reason ? `, motivo: ${cleanText(args.reason, 180)}` : ""}.`;
    case "create_neuroflow_from_patient_history": return `Criar e salvar um NeuroFlow para ${cleanText(args.patient_name || "paciente selecionado", 120)}${args.objective ? ` com o objetivo “${cleanText(args.objective, 220)}”` : ""}.`;
    case "create_neuropulse_cause_effect_diagram": return `Criar e salvar um NeuroPulse para ${cleanText(args.patient_name || "paciente selecionado", 120)}${args.prompt ? ` a partir de “${cleanText(args.prompt, 220)}”` : ""}.`;
    case "create_financial_entry": return `Registrar ${args.entry_type === "expense" ? "a despesa" : "a receita"} “${cleanText(args.title, 160)}” no valor de ${formatMoney(Math.abs(Number(args.amount || 0)))}.`;
    default: return "Executar a alteração solicitada.";
  }
};

const stageMutation = (name: string, args: Record<string, unknown>): AgentToolResult => {
  const now = new Date();
  const pendingAction: PendingAction = { kind: "synapse_pending_action", actionId: crypto.randomUUID(), toolName: name, arguments: args, summary: summarizeMutation(name, args), status: "pending", createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString() };
  return { ok: true, grounded: false, pendingAction, message: pendingAction.summary, data: { confirmation_required: true, summary: pendingAction.summary }, structuredData: { type: "confirmation_required", data: { actionId: pendingAction.actionId, summary: pendingAction.summary } } };
};

function mapPatient(row: any) {
  return { id: row.id, name: row.name, email: row.email || null, phone: row.phone || null, cpf: row.cpf || null, status: row.status || null, diagnosis: row.diagnosis || null, birth_date: row.birth_date || null, address: row.address || null, emergency_contact: row.emergency_contact || null, risk_score: row.risk_score ?? null, last_session: row.last_session || null, next_session: row.next_session || null, created_at: row.created_at || null };
}
function mapAppointment(item: any) {
  return { id: item.id, patient_id: item.patient_id, patient_name: item.patient?.name || (item.type === "block" ? "Bloqueio" : "Sem paciente"), patient_email: item.patient?.email || null, patient_phone: item.patient?.phone || null, start_time: item.start_time, end_time: item.end_time, start_time_local: item.start_time ? formatDateTime(item.start_time) : null, end_time_local: item.end_time ? formatDateTime(item.end_time) : null, time_label: item.start_time ? formatTime(item.start_time) : null, date: item.start_time ? localDate(item.start_time) : null, type: item.type, status: item.status, notes: item.notes, location: item.location || null, google_meet_link: typeof item.google_meet_link === "string" && /\/join\/[a-f0-9]{64}$/i.test(item.google_meet_link) ? item.google_meet_link : null, price: item.price ?? null, metadata: item.metadata || {} };
}
async function queryPatients(admin: any, userId: string, args: Record<string, any> = {}) {
  const resultLimit = clamp(args.limit, 50, 1, 100);
  const term = cleanText(args.query, 120).replace(/[%_]/g, "");
  let query = admin.from("patients").select("id,name,email,phone,cpf,status,diagnosis,birth_date,address,emergency_contact,risk_score,last_session,next_session,created_at").eq("user_id", userId).order("name").limit(term ? 200 : resultLimit);
  const status = cleanText(args.status || "all", 30);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const patients = (data || []).map(mapPatient);
  if (!term) return patients.slice(0, resultLimit);

  const normalizedContactTerm = term.toLocaleLowerCase("pt-BR").replace(/\s+/g, "");
  const contactMatches = patients.filter((patient: any) => [patient.email, patient.phone, patient.cpf]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("pt-BR").replace(/\s+/g, "").includes(normalizedContactTerm)));
  const nameResolution = resolvePatientCandidates(term, patients);
  const nameMatches = nameResolution.status === "resolved"
    ? [nameResolution.patient]
    : nameResolution.status === "ambiguous"
      ? nameResolution.candidates
      : [];
  const unique = new Map<string, any>();
  for (const patient of [...contactMatches, ...nameMatches]) unique.set(patient.id, patient);
  return Array.from(unique.values()).slice(0, resultLimit);
}
async function queryAppointments(admin: any, userId: string, startDate: string, endDate: string, options: Record<string, any> = {}) {
  const period = dateBounds(startDate, endDate);
  let query = admin.from("appointments").select("id,user_id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)").eq("user_id", userId).gte("start_time", period.startIso).lte("start_time", period.endIso).order("start_time").limit(clamp(options.limit, 80, 1, 200));
  if (!options.include_cancelled) query = query.not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)");
  if (options.patient_id) query = query.eq("patient_id", cleanId(options.patient_id));
  if (options.type) query = query.eq("type", cleanText(options.type, 30));
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapAppointment);
}
function summarizeAgenda(appointments: any[], period: { start: string; end: string }) {
  const now = Date.now();
  const active = appointments.filter((item) => !CANCELLED_STATUSES.has(String(item.status || "").toLowerCase()));
  const sessions = active.filter((item) => item.type !== "block" && item.patient_id);
  const blocks = active.filter((item) => item.type === "block");
  const cancelled = appointments.filter((item) => CANCELLED_STATUSES.has(String(item.status || "").toLowerCase()));
  const pendingReview = appointments.filter((item) => item.status === "pending" || item.metadata?.syncStatus === "pending_professional_review");
  const nextAppointment = active.find((item) => item.start_time && new Date(item.start_time).getTime() >= now) || null;
  const byDay: Record<string, any> = {};
  for (const item of appointments) {
    const date = item.date || "sem_data";
    byDay[date] ||= { date, total: 0, sessions: 0, blocks: 0, cancelled: 0, appointments: [] };
    byDay[date].total += 1;
    if (item.type === "block") byDay[date].blocks += 1;
    else if (CANCELLED_STATUSES.has(String(item.status || "").toLowerCase())) byDay[date].cancelled += 1;
    else byDay[date].sessions += 1;
    byDay[date].appointments.push(item);
  }
  return { period, total: appointments.length, active_count: active.length, sessions_count: sessions.length, blocks_count: blocks.length, cancelled_count: cancelled.length, pending_review_count: pendingReview.length, next_appointment: nextAppointment, day_groups: Object.values(byDay), attention: pendingReview.map((appointment) => ({ kind: appointment.metadata?.syncStatus === "pending_professional_review" ? "reschedule_request" : "pending_appointment", appointment })) };
}
async function resolvePatientByName(admin: any, userId: string, name: string) {
  const term = cleanText(name, 160).replace(/[%_]/g, "");
  if (!term) return null;
  const resolution = await resolvePatientNameReference(admin, userId, term);
  if (resolution.status === "not_found") throw new Error(`Não encontrei paciente compatível com “${term}”.`);
  if (resolution.status === "ambiguous") throw new Error(formatPatientAmbiguity(resolution.candidates));
  return resolution.patient;
}
async function findAppointment(admin: any, userId: string, args: Record<string, any>) {
  if (args.appointment_id) {
    const { data, error } = await admin.from("appointments").select("id,user_id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)").eq("id", cleanId(args.appointment_id)).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? mapAppointment(data) : null;
  }
  let patientId = args.patient_id ? cleanId(args.patient_id) : null;
  if (!patientId && args.patient_name) patientId = (await resolvePatientByName(admin, userId, args.patient_name))?.id || null;
  const date = cleanText(args.appointment_date || args.current_date || args.date || "", 10);
  const time = cleanText(args.appointment_time || args.current_time || "", 8).slice(0, 5);
  const today = dateOnly(new Date());
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dateOnly(addDays(new Date(), 90));
  let appointments = await queryAppointments(admin, userId, startDate, endDate, { patient_id: patientId, include_cancelled: false, limit: 30 });
  if (time) appointments = appointments.filter((item) => String(item.time_label || "").slice(0, 5) === time || String(item.time_label || "").replace("h", ":").slice(0, 5) === time);
  if (!appointments.length) return null;
  if (appointments.length > 1) throw new Error(`Há mais de uma consulta possível. Especifique uma destas datas: ${appointments.slice(0, 5).map((item) => item.start_time_local).join(", ")}.`);
  return appointments[0];
}

const appointmentPlanContext = (context: AgentToolContext) => ({
  admin: context.admin,
  userId: context.userId,
  sessionId: context.sessionId,
  channel: context.channel,
  voiceSessionId: context.voiceSessionId,
  whatsappMessageId: context.whatsappMessageId,
  toolCallId: context.toolCallId,
  correlationId: context.correlationId,
});

const appointmentPlanReference = (args: Record<string, any>) => ({
  planId: cleanText(args.plan_id, 80),
  planVersion: Number(args.plan_version),
  planHash: cleanText(args.plan_hash, 80).toLowerCase(),
});

const planIdempotencyKey = (context: AgentToolContext, name: string, actionId: string) =>
  `synapse:${context.sessionId}:${context.correlationId || context.toolCallId || actionId}:${name}`.slice(0, 240);

const localDatePart = (value: string, part: "day" | "weekday") => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(value));
  const raw = parts.find((item) => item.type === part)?.value || "";
  if (part === "day") return Number(raw);
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[raw] ?? 0;
};

const agendaV2Requested = (args: Record<string, any>) => {
  const count = Number(args.occurrence_count || 1);
  return count > 1
    || Boolean(args.recurrence_kind)
    || ["until", "open"].includes(String(args.termination_kind || ""))
    || Array.isArray(args.overrides)
    || Array.isArray(args.custom_dates)
    || Array.isArray(args.week_days)
    || Array.isArray(args.month_days);
};

const normalizedIntegerArray = (value: unknown, minimum: number, maximum: number) => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map(Number)
    .filter((item) => Number.isInteger(item) && item >= minimum && item <= maximum),
));

function agendaV2CreateInput(args: Record<string, any>) {
  const firstStartTime = brazilIso(args.datetime);
  const durationMinutes = clamp(args.duration_minutes, 50, 15, 240);
  const legacyFrequency = cleanText(args.frequency || args.recurrence_frequency || "weekly", 24);
  const kind = cleanText(args.recurrence_kind || (legacyFrequency === "monthly" ? "monthly" : "weekly"), 32);
  const terminationKind = cleanText(args.termination_kind || "count", 16);
  const count = clamp(args.occurrence_count, 1, 1, 500);
  const rule: Record<string, unknown> = {
    kind,
    interval: clamp(args.interval, legacyFrequency === "biweekly" ? 2 : 1, 1, 365),
    missing_month_day: cleanText(args.missing_month_day || "last_business_day", 40),
    termination: terminationKind === "open"
      ? { kind: "open" }
      : terminationKind === "until"
        ? { kind: "until", until_date: cleanText(args.until_date, 10) }
        : { kind: "count", count },
  };

  if (kind === "weekly") {
    rule.week_days = normalizedIntegerArray(args.week_days, 0, 6);
    if (!(rule.week_days as number[]).length) rule.week_days = [localDatePart(firstStartTime, "weekday")];
  } else if (kind === "monthly") {
    rule.month_days = normalizedIntegerArray(args.month_days, 1, 31);
    if (!(rule.month_days as number[]).length) rule.month_days = [localDatePart(firstStartTime, "day")];
  } else if (kind === "custom_dates") {
    rule.custom_dates = Array.from(new Set((Array.isArray(args.custom_dates) ? args.custom_dates : [])
      .map((item) => cleanText(item, 10))
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))));
  } else if (kind === "range_distribution") {
    rule.until_date = cleanText(args.distribution_until_date || args.until_date, 10);
  }

  const overrides = (Array.isArray(args.overrides) ? args.overrides : []).slice(0, 500).map((item: any) => ({
    occurrence_number: clamp(item?.occurrence_number, 1, 1, 500),
    ...(item?.date ? { date: cleanText(item.date, 10) } : {}),
    ...(item?.start_time ? { start_time: cleanText(item.start_time, 8) } : {}),
    ...(item?.duration_minutes ? { duration_minutes: clamp(item.duration_minutes, durationMinutes, 15, 240) } : {}),
    ...(item?.modality ? { modality: cleanText(item.modality, 24) } : {}),
    ...(item?.location !== undefined ? { location: cleanText(item.location, 300) } : {}),
    reason: cleanText(item?.reason || "Personalização solicitada ao Synapse", 300),
    source: "synapse",
  }));

  const input: Record<string, unknown> = {
    patient_id: args.patient_id ? cleanId(args.patient_id) : null,
    first_start_time: firstStartTime,
    duration_minutes: durationMinutes,
    timezone: "America/Sao_Paulo",
    type: cleanText(args.appointment_type || "presencial", 24),
    location: args.location ? cleanText(args.location, 300) : null,
    notes: args.notes ? cleanText(args.notes, 3000) : null,
    recurrence_rule: rule,
    overrides,
    default_config: {
      durationMinutes,
      modality: cleanText(args.appointment_type || "presencial", 24),
      location: args.location ? cleanText(args.location, 300) : null,
    },
    metadata: { createdBy: "synapse", recurrenceSchemaVersion: 2 },
  };

  if (args.package_id) {
    input.financial = { mode: "package", package_id: cleanId(args.package_id) };
  } else if (args.financial_mode || args.value_per_session !== undefined || args.price !== undefined) {
    input.financial = {
      mode: cleanText(args.financial_mode || "manual", 40),
      value_per_session: Number(args.value_per_session ?? args.price ?? 0),
      total: Number(args.total ?? 0),
      charge_mode: cleanText(args.charge_mode || "per_occurrence", 40),
      create_charge: args.create_charge === true,
    };
  }

  return input;
}

async function prepareAppointmentMutation(
  name: string,
  args: Record<string, any>,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const actionId = crypto.randomUUID();
  let action:
    | "create"
    | "reschedule"
    | "cancel"
    | "set_teleconsultation_transcription"
    | "close_teleconsultation";
  let input: Record<string, unknown>;

  if (name === "create_appointment") {
    if (agendaV2Requested(args)) {
      const plan = await prepareAgendaActionPlan(
        appointmentPlanContext(context),
        name,
        agendaV2CreateInput(args),
        planIdempotencyKey(context, name, actionId),
      );
      const summaryData = plan.summary || {};
      const total = Number(summaryData.totalOccurrences || args.occurrence_count || 1);
      const conflictCount = Number(summaryData.conflictCount || 0);
      const summary = conflictCount > 0
        ? `Série preparada com ${total} sessões e ${conflictCount} conflito(s) para revisar.`
        : `Série preparada com ${total} sessões. Confirme esta versão para criar.`;
      const agendaPendingAction: PendingAction = {
        kind: "synapse_pending_action",
        actionId,
        toolName: name,
        arguments: {
          plan_id: plan.planId,
          plan_version: plan.planVersion,
          plan_hash: plan.planHash,
          conversation_id: context.sessionId,
          agenda_v2: true,
        },
        summary,
        status: "pending",
        createdAt: plan.createdAt || new Date().toISOString(),
        expiresAt: plan.expiresAt || new Date(Date.now() + 15 * 60_000).toISOString(),
      };
      return {
        ok: true,
        grounded: true,
        pendingAction: agendaPendingAction,
        message: summary,
        data: {
          confirmation_required: plan.status === "awaiting_confirmation",
          review_required: plan.status === "review_required",
          status: plan.status,
          summary: plan.summary,
        },
        structuredData: { type: "appointment_plan_prepared", data: { status: plan.status, summary: plan.summary } },
        clientAction: plan.status === "awaiting_confirmation" ? {
          type: "review_appointment_plan",
          data: {
            planId: plan.planId,
            planVersion: plan.planVersion,
            planHash: plan.planHash,
            conversationId: context.sessionId,
            originChannel: normalizeAppointmentPlanChannel(context.channel),
          },
        } : undefined,
      };
    }
    action = "create";
    const start = brazilIso(args.datetime);
    const duration = clamp(args.duration_minutes, 50, 15, 240);
    const occurrenceCount = clamp(args.occurrence_count, 1, 1, 20);
    input = {
      patient_id: args.patient_id ? cleanId(args.patient_id) : null,
      start_time: start,
      end_time: new Date(new Date(start).getTime() + duration * 60_000).toISOString(),
      frequency: cleanText(
        args.frequency || args.recurrence_frequency || (occurrenceCount > 1 ? "weekly" : "single"),
        24,
      ),
      occurrence_count: occurrenceCount,
      type: cleanText(args.appointment_type || "presencial", 24),
      location: args.location ? cleanText(args.location, 300) : null,
      notes: args.notes ? cleanText(args.notes, 3000) : null,
      package_id: args.package_id ? cleanId(args.package_id) : null,
      communication: args.communication || {
        sendConfirmation: args.send_confirmation !== false,
        provider: cleanText(args.communication_provider || "configured", 40),
        template: cleanText(args.confirmation_template || "appointment_invitation", 80),
        reminderPolicy: cleanText(args.reminder_policy || "professional_settings", 80),
      },
      financial: args.financial || {
        mode: cleanText(args.financial_mode || (args.package_id ? "package" : args.price ? "manual" : "none"), 40),
        value_per_session: Number(args.value_per_session ?? args.price ?? 0),
        total: Number(args.total ?? 0),
        charge_mode: cleanText(args.charge_mode || "per_occurrence", 40),
      },
      fiscal: args.fiscal || {
        automationEnabled: Boolean(args.fiscal_automation_enabled),
        trigger: cleanText(args.fiscal_trigger || "professional_settings", 80),
        potentialDocuments: occurrenceCount,
        blocked: false,
      },
    };
  } else {
    const appointment = await findAppointment(context.admin, context.userId, args);
    if (!appointment) throw new Error("Consulta não encontrada.");
    if (name === "reschedule_appointment") {
      action = "reschedule";
      const start = brazilIso(args.new_datetime);
      const currentDuration = Math.max(
        15,
        Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60_000),
      );
      const duration = clamp(args.new_duration_minutes, currentDuration || 50, 15, 240);
      input = {
        appointment_id: appointment.id,
        start_time: start,
        end_time: new Date(new Date(start).getTime() + duration * 60_000).toISOString(),
        type: cleanText(args.appointment_type || appointment.type, 24),
        location: args.location === undefined ? appointment.location : cleanText(args.location, 300),
        communication: {
          sendConfirmation: args.send_confirmation !== false,
          provider: "configured",
          template: "appointment_reconfirmation_required",
          reminderPolicy: "professional_settings",
        },
      };
    } else if (name === "cancel_appointment") {
      action = "cancel";
      input = {
        appointment_id: appointment.id,
        reason: cleanText(args.reason || "Sem motivo informado", 500),
        communication: {
          sendConfirmation: true,
          provider: "configured",
          template: "appointment_cancelled",
          reminderPolicy: "cancelled",
        },
      };
    } else if (name === "set_teleconsultation_transcription_decision") {
      action = "set_teleconsultation_transcription";
      input = {
        appointment_id: appointment.id,
        enabled: Boolean(args.enabled),
        notes: args.notes ? cleanText(args.notes, 500) : null,
      };
    } else {
      action = "close_teleconsultation";
      input = {
        appointment_id: appointment.id,
        reason: cleanText(args.reason || "synapse_close", 120),
      };
    }
  }

  const plan = await prepareAppointmentActionPlan(
    appointmentPlanContext(context),
    name,
    action,
    input,
    planIdempotencyKey(context, name, actionId),
  );
  const summary = appointmentPlanSummary(plan);
  const pendingAction: PendingAction = {
    kind: "synapse_pending_action",
    actionId,
    toolName: name,
    arguments: {
      plan_id: plan.planId,
      plan_version: plan.planVersion,
      plan_hash: plan.planHash,
      conversation_id: context.sessionId,
    },
    summary,
    status: "pending",
    createdAt: plan.createdAt || new Date().toISOString(),
    expiresAt: plan.expiresAt || new Date(Date.now() + 15 * 60_000).toISOString(),
  };
  return {
    ok: true,
    grounded: true,
    pendingAction,
    message: summary,
    data: {
      confirmation_required: plan.status === "awaiting_confirmation",
      review_required: plan.status === "review_required",
      status: plan.status,
      summary: plan.summary,
    },
    structuredData: {
      type: "appointment_plan_prepared",
      data: { status: plan.status, summary: plan.summary },
    },
    clientAction: plan.status === "awaiting_confirmation" ? {
      type: "review_appointment_plan",
      data: {
        planId: plan.planId,
        planVersion: plan.planVersion,
        planHash: plan.planHash,
        conversationId: context.sessionId,
        originChannel: normalizeAppointmentPlanChannel(context.channel),
      },
    } : undefined,
  };
}

export async function cancelPendingAppointmentPlan(pending: PendingAction, context: AgentToolContext) {
  if (!APPOINTMENT_MUTATION_TOOLS.has(pending.toolName)) return null;
  return cancelAppointmentActionPlan(
    appointmentPlanContext(context),
    appointmentPlanReference(pending.arguments as Record<string, any>),
  );
}
async function buildSlots(admin: any, userId: string, args: Record<string, any>) {
  const start = cleanText(args.start_date || dateOnly(new Date()), 10);
  const end = cleanText(args.end_date || start, 10);
  const duration = clamp(args.duration_minutes, 50, 15, 240);
  const limit = clamp(args.limit, 10, 1, 30);
  const period = dateBounds(start, end);
  const { data, error } = await admin.from("appointments").select("start_time,end_time,status").eq("user_id", userId).not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)").gte("start_time", period.startIso).lte("start_time", period.endIso).order("start_time");
  if (error) throw error;
  const appointments = data || [];
  const slots: Array<{ date: string; time: string; datetime: string; end_datetime: string }> = [];
  const cursor = new Date(`${start}T00:00:00-03:00`);
  const endCursor = new Date(`${end}T23:59:59-03:00`);
  while (cursor <= endCursor && slots.length < limit) {
    const date = dateOnly(cursor);
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) {
      for (let hour = 8; hour < 20 && slots.length < limit; hour++) {
        if (hour === 12) continue;
        if (args.preferred_period === "morning" && hour >= 12) continue;
        if (args.preferred_period === "afternoon" && (hour < 13 || hour >= 18)) continue;
        if (args.preferred_period === "evening" && hour < 18) continue;
        for (const minute of [0, 30]) {
          const slotStart = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`);
          const slotEnd = new Date(slotStart.getTime() + duration * 60000);
          if (slotStart <= new Date()) continue;
          const conflict = appointments.some((appointment: any) => slotStart < new Date(appointment.end_time) && slotEnd > new Date(appointment.start_time));
          if (!conflict) slots.push({ date, time: formatTime(slotStart.toISOString()), datetime: slotStart.toISOString(), end_datetime: slotEnd.toISOString() });
          if (slots.length >= limit) break;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { duration_minutes: duration, slots };
}
const teleRoomStatus = (appointment: any) => appointment?.metadata?.teleconsultationRoom?.status || "waiting";
const transcriptionDecision = (appointment: any) => {
  const decision = appointment?.metadata?.teleconsultationTranscription;
  return decision && typeof decision.enabled === "boolean" ? decision : null;
};
const meetLinkFor = (appointment: any) =>
  typeof appointment?.google_meet_link === "string" && /\/join\/[a-f0-9]{64}$/i.test(appointment.google_meet_link)
    ? appointment.google_meet_link
    : null;
function teleStatus(appointment: any) {
  const decision = transcriptionDecision(appointment);
  const roomStatus = teleRoomStatus(appointment);
  const isOnline = appointment?.type === "online";
  const hasPatient = Boolean(appointment?.patient_id);
  const hasPatientEmail = Boolean(appointment?.patient_email);
  const isClosed = isOnline && roomStatus === "closed";
  return { appointment, is_online: isOnline, room_status: roomStatus, transcription_decision: decision, transcription_required: isOnline && !decision, meet_link: meetLinkFor(appointment), can_invite_patient: isOnline && hasPatient && hasPatientEmail && Boolean(decision) && !isClosed, readiness: { has_patient: hasPatient, has_patient_email: hasPatientEmail, has_transcription_decision: !isOnline || Boolean(decision), room_not_closed: !isClosed, ready_to_enter: !isOnline || (Boolean(decision) && !isClosed), ready_to_invite: isOnline && hasPatient && hasPatientEmail && Boolean(decision) && !isClosed } };
}

export async function executeAgentTool(name: string, args: Record<string, any>, context: AgentToolContext): Promise<AgentToolResult> {
  if (APPOINTMENT_MUTATION_TOOLS.has(name)) {
    try {
      return await prepareAppointmentMutation(name, args, context);
    } catch (error) {
      return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao preparar o plano do agendamento." };
    }
  }
  if (MUTATING_TOOLS.has(name)) return stageMutation(name, args);
  try {
    const neuroNotesResult = await executeNeuroNotesAgentTool(name, args, context);
    if (neuroNotesResult) return neuroNotesResult;
  } catch (error) {
    return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao executar o agente de Notas." };
  }
  if (NOTES_READ_TOOLS.has(name)) return executeNotesTool(name, args, context);
  const { admin, userId } = context;
  try {
    switch (name) {
      case "get_system_help": {
        const modules = [
          { name: "Agenda Desktop", capabilities: ["visão diária e semanal", "detalhes de consulta", "horários livres", "criar/remarcar/cancelar com confirmação"] },
          { name: "Teleconsulta Desktop", capabilities: ["próxima sessão", "status da sala", "decisão de transcrição", "lobby e convite do paciente"] },
          { name: "Pacientes Desktop", capabilities: ["buscar pacientes", "ver cards cadastrais", "cadastrar/atualizar/inativar com confirmação", "listar pacientes sem próxima sessão"] },
          { name: "Notas Desktop", capabilities: ["notas", "módulos", "tarefas", "arquivos", "Notion básico", "sem importação do Google Drive nesta versão"] },
          { name: "NeuroView", capabilities: ["visualizar conexões clínicas", "cruzar evidências vinculadas", "destacar padrões de um paciente"] },
          { name: "NeuroFlow", capabilities: ["criar mapas clínicos pelo histórico", "organizar hipóteses, ciclos e intervenções", "salvar o fluxo vinculado ao paciente após confirmação explícita"] },
          { name: "NeuroPulse", capabilities: ["transformar relatos em diagramas de causa e efeito", "aplicar uma lente clínica", "salvar a síntese visual vinculada ao paciente após confirmação explícita"] },
          { name: "NeuroFinance", capabilities: ["consultar cobranças", "criar cobranças com confirmação", "acompanhar pagamentos"] },
        ];
        return { ok: true, grounded: true, recordCount: modules.length, data: { query: cleanText(args.query, 240), modules }, structuredData: { type: "system_help", data: { modules } } };
      }
      case "get_workspace_overview": {
        const now = new Date();
        const today = dateOnly(now);
        const upcomingEnd = dateOnly(addDays(now, 14));
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const [patients, todayAppointments, upcomingAppointments, sessionNotesResult, personalNotesResult, documentsResult, financialResult] = await Promise.all([
          queryPatients(admin, userId, { limit: 1000 }), queryAppointments(admin, userId, today, today, { limit: 120 }), queryAppointments(admin, userId, today, upcomingEnd, { limit: 200 }), admin.from("session_notes").select("id", { count: "exact", head: true }).eq("user_id", userId), admin.from("personal_notes").select("id", { count: "exact", head: true }).eq("user_id", userId), admin.from("document_files").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null), admin.from("financial_entries").select("id,title,amount,type,status,due_date", { count: "exact" }).eq("professional_id", userId).gte("due_date", monthStart).lte("due_date", monthEnd).limit(200),
        ]);
        const firstError = [sessionNotesResult.error, personalNotesResult.error, documentsResult.error, financialResult.error].find(Boolean);
        if (firstError) throw firstError;
        const monthEntries = financialResult.data || [];
        const income = monthEntries.filter((item: any) => item.type === "income").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
        const expenses = monthEntries.filter((item: any) => item.type === "expense").reduce((sum: number, item: any) => sum + Math.abs(Number(item.amount || 0)), 0);
        const overview = { patients_count: patients.length, appointments_today_count: todayAppointments.length, upcoming_appointments_14d_count: upcomingAppointments.length, clinical_notes_count: sessionNotesResult.count || 0, personal_notes_count: personalNotesResult.count || 0, documents_count: documentsResult.count || 0, agenda_today: summarizeAgenda(todayAppointments, { start: today, end: today }), financial_month: { start_date: monthStart, end_date: monthEnd, entries_count: financialResult.count || monthEntries.length, income, expenses, balance: income - expenses } };
        return { ok: true, grounded: true, recordCount: overview.patients_count + overview.appointments_today_count + overview.financial_month.entries_count, data: { overview }, structuredData: { type: "workspace_overview", data: overview } };
      }
      case "list_patients":
      case "search_patients":
      case "search_patient_directory": {
        const patients = await queryPatients(admin, userId, { ...args, query: args.query || (name === "search_patients" ? args.query : undefined), limit: args.limit || 20 });
        return { ok: true, grounded: true, recordCount: patients.length, data: { query: args.query || null, patients }, structuredData: patients.length === 1 ? { type: "patient_card", data: patients[0] } : { type: "patient_list", data: { patients } } };
      }
      case "get_patients_directory_overview": {
        const patients = await queryPatients(admin, userId, { limit: 1000 });
        const active = patients.filter((p) => p.status === "active");
        const pending = patients.filter((p) => ["pending", "new", "triage"].includes(String(p.status || "")));
        const inactive = patients.filter((p) => p.status === "inactive");
        const withoutNextSession = patients.filter((p) => !p.next_session);
        const withoutDiagnosis = patients.filter((p) => !cleanText(p.diagnosis, 20));
        const data = { total: patients.length, active_count: active.length, pending_count: pending.length, inactive_count: inactive.length, without_next_session_count: withoutNextSession.length, without_diagnosis_count: withoutDiagnosis.length, recent_patients: patients.slice(0, 8), without_next_session: withoutNextSession.slice(0, 12), pending_patients: pending.slice(0, 12) };
        return { ok: true, grounded: true, recordCount: patients.length, data, structuredData: { type: "patients_directory_overview", data } };
      }
      case "get_patient_card_summary": {
        const patientId = cleanId(args.patient_id);
        const { data, error } = await admin.from("patients").select("id,name,email,phone,cpf,status,diagnosis,birth_date,address,emergency_contact,risk_score,last_session,next_session,created_at").eq("id", patientId).eq("user_id", userId).maybeSingle();
        if (error) throw error;
        const patient = data ? mapPatient(data) : null;
        return { ok: true, grounded: true, recordCount: patient ? 1 : 0, data: { patient }, structuredData: patient ? { type: "patient_card", data: patient } : undefined };
      }
      case "list_patients_without_next_session": {
        const patients = (await queryPatients(admin, userId, { status: args.status || "active", limit: args.limit || 50 })).filter((p) => !p.next_session);
        return { ok: true, grounded: true, recordCount: patients.length, data: { patients }, structuredData: { type: "patient_list", data: { patients } } };
      }
      case "list_pending_patients": {
        const patients = (await queryPatients(admin, userId, { limit: args.limit || 50 })).filter((p) => ["pending", "new", "triage"].includes(String(p.status || "")));
        return { ok: true, grounded: true, recordCount: patients.length, data: { patients }, structuredData: { type: "patient_list", data: { patients } } };
      }
      case "get_patient_details": {
        const patientId = cleanId(args.patient_id);
        const { data, error } = await admin.from("patients").select("id,name,email,phone,status,diagnosis,notes,risk_score,birth_date,address,emergency_contact,medications,last_session,next_session").eq("id", patientId).eq("user_id", userId).maybeSingle();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: data ? 1 : 0, data: { patient: data || null }, structuredData: data ? { type: "patient_card", data } : undefined };
      }
      case "get_clinical_history": {
        const patientId = cleanId(args.patient_id);
        const { data: patient } = await admin.from("patients").select("id,name").eq("id", patientId).eq("user_id", userId).maybeSingle();
        if (!patient) return { ok: false, grounded: true, recordCount: 0, error: "Paciente não encontrado." };
        let query = admin.from("session_notes").select("id,notes,ai_summary,created_at,appointment_id").eq("user_id", userId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(clamp(args.limit, 5, 1, 10));
        const keywords = cleanText(args.keywords, 120).replace(/[%_]/g, "");
        if (keywords) query = query.ilike("notes", `%${keywords}%`);
        const { data, error } = await query;
        if (error) throw error;
        const notes = (data || []).map((note: any) => ({ id: note.id, date: note.created_at, summary: typeof note.ai_summary === "object" && note.ai_summary?.summary ? cleanText(note.ai_summary.summary, 1200) : cleanText(note.notes, 1200), appointment_id: note.appointment_id }));
        return { ok: true, grounded: true, recordCount: notes.length, data: { patient, notes }, structuredData: { type: "clinical_history", data: { patient, notes } } };
      }
      case "get_calendar": {
        const period = dateBounds(args.start_date, args.end_date);
        const appointments = await queryAppointments(admin, userId, period.start, period.end, { patient_id: args.patient_id, include_cancelled: Boolean(args.include_cancelled), limit: args.limit });
        const summary = summarizeAgenda(appointments, { start: period.start, end: period.end });
        return { ok: true, grounded: true, recordCount: appointments.length, data: { period: { start: period.start, end: period.end }, appointments, summary }, structuredData: { type: "agenda", data: { appointments, summary } } };
      }
      case "get_agenda_daily_overview": {
        const date = cleanText(args.date || dateOnly(new Date()), 10);
        const appointments = await queryAppointments(admin, userId, date, date, { include_cancelled: Boolean(args.include_cancelled), limit: 120 });
        const slots = await buildSlots(admin, userId, { start_date: date, end_date: date, duration_minutes: 50, limit: 6 });
        const summary = summarizeAgenda(appointments, { start: date, end: date });
        const data = { date, appointments, available_slots: slots.slots, summary };
        return { ok: true, grounded: true, recordCount: appointments.length, data, structuredData: { type: "agenda_daily_overview", data } };
      }
      case "get_agenda_week_overview": {
        const start = cleanText(args.start_date || dateOnly(new Date()), 10);
        const end = cleanText(args.end_date || dateOnly(addDays(new Date(`${start}T00:00:00-03:00`), 6)), 10);
        const appointments = await queryAppointments(admin, userId, start, end, { include_cancelled: Boolean(args.include_cancelled), limit: 200 });
        const slots = await buildSlots(admin, userId, { start_date: start, end_date: end, duration_minutes: 50, limit: 10 });
        const summary = summarizeAgenda(appointments, { start, end });
        const data = { period: { start, end }, appointments, available_slots: slots.slots, summary };
        return { ok: true, grounded: true, recordCount: appointments.length, data, structuredData: { type: "agenda_week_overview", data } };
      }
      case "get_appointment_details": {
        const appointment = await findAppointment(admin, userId, args);
        if (!appointment) return { ok: true, grounded: true, recordCount: 0, data: { appointment: null }, error: "Consulta não encontrada." };
        return { ok: true, grounded: true, recordCount: 1, data: { appointment }, structuredData: { type: "appointment_card", data: appointment } };
      }
      case "find_available_slots": {
        const result = await buildSlots(admin, userId, args);
        return { ok: true, grounded: true, recordCount: result.slots.length, data: result, structuredData: { type: "available_slots", data: { slots: result.slots } } };
      }
      case "get_teleconsultation_overview": {
        const today = new Date();
        const start = cleanText(args.start_date || dateOnly(today), 10);
        const end = cleanText(args.end_date || dateOnly(addDays(today, 90)), 10);
        const appointments = (await queryAppointments(admin, userId, start, end, { limit: args.limit || 80 })).filter((appointment) => appointment.type !== "block");
        const sessions = appointments.map((appointment) => teleStatus(appointment));
        const data = {
          period: { start, end },
          sessions,
          summary: {
            total: sessions.length,
            online_count: sessions.filter((s) => s.is_online).length,
            open_rooms_count: sessions.filter((s) => s.room_status === "open").length,
            closed_rooms_count: sessions.filter((s) => s.room_status === "closed").length,
            missing_transcription_decision_count: sessions.filter((s) => s.transcription_required).length,
            invite_ready_count: sessions.filter((s) => s.can_invite_patient).length,
            next_session: sessions.find((s) => new Date(s.appointment.start_time).getTime() >= Date.now()) || null,
          },
        };
        return { ok: true, grounded: true, recordCount: sessions.length, data, structuredData: { type: "teleconsultation_overview", data } };
      }
      case "get_next_teleconsultation": {
        const modality = cleanText(args.modality || "any", 20);
        let appointments = await queryAppointments(admin, userId, dateOnly(new Date()), dateOnly(addDays(new Date(), 90)), { limit: 80 });
        appointments = appointments.filter((appointment) => appointment.type !== "block" && new Date(appointment.start_time).getTime() >= Date.now());
        if (modality === "online") appointments = appointments.filter((appointment) => appointment.type === "online");
        if (modality === "presencial") appointments = appointments.filter((appointment) => appointment.type !== "online");
        const session = appointments[0] ? teleStatus(appointments[0]) : null;
        return { ok: true, grounded: true, recordCount: session ? 1 : 0, data: { session }, structuredData: session ? { type: "teleconsultation_session_status", data: session } : undefined };
      }
      case "get_teleconsultation_session_status":
      case "get_teleconsultation_readiness": {
        const appointment = await findAppointment(admin, userId, args);
        if (!appointment) return { ok: false, grounded: true, recordCount: 0, error: "Sessão não encontrada." };
        const data = teleStatus(appointment);
        return { ok: true, grounded: true, recordCount: 1, data, structuredData: { type: name === "get_teleconsultation_readiness" ? "teleconsultation_readiness" : "teleconsultation_session_status", data } };
      }
      case "get_financial_summary": {
        const period = dateBounds(args.start_date, args.end_date);
        const { data, error } = await admin.from("financial_entries").select("id,title,amount,type,status,due_date,paid_at,patient_id,metadata").eq("professional_id", userId).gte("due_date", period.start).lte("due_date", period.end).order("due_date");
        if (error) throw error;
        const entries = data || [];
        const income = entries.filter((item: any) => item.type === "income").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
        const expenses = entries.filter((item: any) => item.type === "expense").reduce((sum: number, item: any) => sum + Math.abs(Number(item.amount || 0)), 0);
        const pending = entries.filter((item: any) => !PAID_STATUSES.has(String(item.status || "").toLowerCase())).reduce((sum: number, item: any) => sum + Math.abs(Number(item.amount || 0)), 0);
        const summary = { start_date: period.start, end_date: period.end, income, expenses, balance: income - expenses, pending, entries_count: entries.length };
        return { ok: true, grounded: true, recordCount: entries.length, data: summary, structuredData: { type: "financial_summary", data: summary } };
      }
      case "list_financial_entries": {
        let query = admin.from("financial_entries").select("id,title,description,amount,type,status,due_date,paid_at,patient_id,metadata,created_at").eq("professional_id", userId).order("due_date", { ascending: false }).limit(clamp(args.limit, 20, 1, 50));
        if (args.start_date) query = query.gte("due_date", cleanText(args.start_date, 10));
        if (args.end_date) query = query.lte("due_date", cleanText(args.end_date, 10));
        if (args.entry_type && args.entry_type !== "all") query = query.eq("type", args.entry_type);
        if (args.status) query = query.eq("status", cleanText(args.status, 40));
        if (args.patient_id) query = query.eq("patient_id", cleanId(args.patient_id));
        const { data, error } = await query;
        if (error) throw error;
        const entries = data || [];
        return { ok: true, grounded: true, recordCount: entries.length, data: { entries }, structuredData: { type: "financial_entries", data: { entries } } };
      }
      case "list_personal_notes": {
        let query = admin.from("personal_notes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(clamp(args.limit, 10, 1, 20));
        const term = cleanText(args.query, 120).replace(/[%_]/g, "");
        if (term) query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
        const { data, error } = await query;
        if (error) throw error;
        const notes = (data || []).map((note: any) => ({ id: note.id, title: note.title || note.name || "Sem título", preview: cleanText(note.content || note.body || note.text, 600), updated_at: note.updated_at || note.created_at }));
        return { ok: true, grounded: true, recordCount: notes.length, data: { notes }, structuredData: { type: "notes_list", data: { notes } } };
      }
      case "list_documents": {
        let query = admin.from("document_files").select("id,patient_id,category,original_name,mime_type,size_bytes,status,uploaded_at,created_at").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(clamp(args.limit, 15, 1, 30));
        if (args.patient_id) query = query.eq("patient_id", cleanId(args.patient_id));
        if (args.category) query = query.eq("category", cleanText(args.category, 60));
        const { data, error } = await query;
        if (error) throw error;
        const documents = data || [];
        return { ok: true, grounded: true, recordCount: documents.length, data: { documents }, structuredData: { type: "documents_list", data: { documents } } };
      }
      case "request_interface_action": {
        const allowedActions = new Set(["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal", "open_teleconsultation_lobby", "open_patient_invite_modal", "filter_patients_directory", "open_notes_desktop", "switch_notes_view", "open_note", "filter_notes", "open_new_note", "open_note_module", "open_tasks_board", "open_files_manager", "open_notion_panel", "open_file_preview", "open_neuroview_reasoning", "open_neuroflow_generation", "open_neuropulse_diagram"]);
        const allowedTargets = new Set(["dashboard", "agenda", "patients", "finance", "notes", "teleconsultation", "synapse"]);
        const allowedDestinations = new Set<string>(SYNAPSE_INTERFACE_DESTINATIONS);
        const allowedNeuroViewScopes = new Set(["all", "patient", "subgraph"]);
        const allowedNeuroViewModes = new Set(["2d", "3d"]);
        let action = cleanText(args.action, 50);
        const target = args.target ? cleanText(args.target, 50) : undefined;
        let destination = args.destination ? cleanText(args.destination, 100) : undefined;
        const neuroViewScope = args.neuroview_scope ? cleanText(args.neuroview_scope, 20) : undefined;
        const neuroViewMode = args.neuroview_mode ? cleanText(args.neuroview_mode, 10) : undefined;
        const neuroViewNodeIds = cleanGraphNodeIds(args.neuroview_node_ids);
        const neuroViewFocusNodeId = args.neuroview_focus_node_id ? cleanGraphNodeId(args.neuroview_focus_node_id) : undefined;
        let notesView = args.notes_view ? cleanText(args.notes_view, 30) : undefined;
        if (action === "navigate" && destination === "notes.neuroview") {
          action = "open_neuroview_reasoning";
          destination = undefined;
          notesView = "neuroview";
        } else if (action === "navigate" && destination === "notes.neuroflow") {
          action = "open_neuroflow_generation";
          destination = undefined;
          notesView = "neuroflow";
        } else if (action === "navigate" && destination === "notes.neuropulse") {
          action = "open_neuropulse_diagram";
          destination = undefined;
          notesView = "neuropulse";
        }
        if (!allowedActions.has(action)) throw new Error("Ação visual inválida.");
        if (target && !allowedTargets.has(target)) throw new Error("Destino visual inválido.");
        if (destination && !allowedDestinations.has(destination)) throw new Error("Destino profundo inválido.");
        if (destination && action !== "navigate") throw new Error("Destinos profundos devem usar a ação de navegação.");
        if (destination?.startsWith("patient.") && !args.patient_id) throw new Error("Paciente ausente para abrir essa seção do prontuário.");
        if (destination?.startsWith("teleconsultation.") && destination !== "teleconsultation.overview" && !args.appointment_id) {
          throw new Error("Consulta ausente para abrir essa seção da teleconsulta.");
        }
        if (neuroViewScope && !allowedNeuroViewScopes.has(neuroViewScope)) throw new Error("Escopo do NeuroView inválido.");
        if (neuroViewMode && !allowedNeuroViewModes.has(neuroViewMode)) throw new Error("Modo do NeuroView inválido.");
        if ((neuroViewScope || neuroViewMode || neuroViewNodeIds || neuroViewFocusNodeId) && action !== "open_neuroview_reasoning") {
          throw new Error("Diretiva do NeuroView usada fora do NeuroView.");
        }
        if (neuroViewScope === "subgraph" && !neuroViewNodeIds?.length) throw new Error("Subgrafo sem nodes válidos.");
        if (neuroViewScope === "patient" && !args.patient_id) throw new Error("Paciente ausente para o grafo individual.");
        const clientAction = { type: "interface_action", data: { action, target, destination, patientId: args.patient_id ? cleanId(args.patient_id) : undefined, appointmentId: args.appointment_id ? cleanId(args.appointment_id) : undefined, noteId: args.note_id ? cleanId(args.note_id) : undefined, moduleId: args.module_id ? cleanId(args.module_id) : undefined, taskId: args.task_id ? cleanId(args.task_id) : undefined, fileId: args.file_id ? cleanId(args.file_id) : undefined, flowId: args.flow_id ? cleanId(args.flow_id) : undefined, runId: args.run_id ? cleanId(args.run_id) : undefined, pulseEntryId: args.pulse_entry_id ? cleanId(args.pulse_entry_id) : undefined, mermaid: args.mermaid ? cleanText(args.mermaid, 6000) : undefined, trace: args.trace && typeof args.trace === "object" ? args.trace : undefined, neuroViewScope, neuroViewMode, neuroViewNodeIds, neuroViewFocusNodeId, date: args.date ? cleanText(args.date, 40) : undefined, query: args.query ? cleanText(args.query, 120) : undefined, notesView, element: args.element ? cleanText(args.element, 60) : undefined, modal: args.modal ? cleanText(args.modal, 60) : undefined, reason: args.reason ? cleanText(args.reason, 180) : undefined } };
        return { ok: true, grounded: false, data: { action_requested: action, destination: destination || null }, clientAction };
      }
      default: return { ok: false, grounded: false, error: `Ferramenta não suportada: ${name}` };
    }
  } catch (error) {
    return { ok: false, grounded: name !== "request_interface_action", error: error instanceof Error ? error.message : "Falha ao consultar o sistema." };
  }
}

export async function executeConfirmedMutation(pending: PendingAction, context: AgentToolContext): Promise<AgentToolResult> {
  if (APPOINTMENT_MUTATION_TOOLS.has(pending.toolName)) {
    try {
      const reference = appointmentPlanReference(pending.arguments as Record<string, any>);
      const plan = pending.arguments.agenda_v2 === true
        ? await executeAgendaActionPlan(appointmentPlanContext(context), reference)
        : await executeAppointmentActionPlan(appointmentPlanContext(context), reference);
      const result = plan.result || {};
      return {
        ok: plan.status === "completed",
        grounded: true,
        recordCount: Array.isArray((result as any).appointmentIds)
          ? (result as any).appointmentIds.length
          : plan.status === "completed" ? 1 : 0,
        data: { plan_status: plan.status, result },
        message: String((result as any).message || (plan.status === "completed"
          ? "Alteração do agendamento concluída."
          : "O plano mudou e precisa de uma nova revisão.")),
        structuredData: { type: "appointment_plan_result", data: { status: plan.status, result } },
      };
    } catch (error) {
      return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao executar o plano do agendamento." };
    }
  }
  const notesResult = await executeConfirmedNotesMutation(pending, context);
  if (notesResult) return notesResult;

  if (["create_neuroflow_from_patient_history", "create_neuropulse_cause_effect_diagram"].includes(pending.toolName)) {
    try {
      const result = await executeNeuroNotesAgentTool(
        pending.toolName,
        pending.arguments as Record<string, any>,
        context,
      );
      if (result) return result;
    } catch (error) {
      return {
        ok: false,
        grounded: true,
        error: error instanceof Error ? error.message : "Não foi possível concluir a criação assistida.",
      };
    }
  }

  const { admin, userId, sessionId } = context;
  const args = pending.arguments as Record<string, any>;
  try {
    switch (pending.toolName) {
      case "create_patient": {
        const { data, error } = await admin.from("patients").insert({ user_id: userId, name: cleanText(args.name, 160), email: args.email ? cleanText(args.email, 200) : null, phone: args.phone ? cleanText(args.phone, 50) : null, cpf: args.cpf ? cleanText(args.cpf, 30) : null, diagnosis: args.diagnosis ? cleanText(args.diagnosis, 500) : null, notes: args.notes ? cleanText(args.notes, 5000) : null, status: "pending", birth_date: args.birth_date || null, address: args.address ? cleanText(args.address, 500) : null, emergency_contact: args.emergency_contact ? cleanText(args.emergency_contact, 300) : null, medications: [] }).select("id,name,status,email,phone,diagnosis").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { patient: data }, message: `Paciente ${data.name} cadastrado com sucesso.`, structuredData: { type: "patient_card", data }, clientAction: { type: "interface_action", data: { action: "open_patient", patientId: data.id, reason: "Paciente cadastrado" } } };
      }
      case "update_patient":
      case "update_patient_basic_info": {
        const patientId = cleanId(args.patient_id);
        const fields = pending.toolName === "update_patient_basic_info" ? ["name", "email", "phone", "cpf", "birth_date", "address", "emergency_contact", "status"] : ["name", "email", "phone", "diagnosis", "notes", "birth_date", "address", "emergency_contact", "status"];
        const update: Record<string, unknown> = {};
        for (const field of fields) if (args[field] !== undefined && args[field] !== null) update[field] = args[field];
        if (!Object.keys(update).length) throw new Error("Nenhum campo foi informado para atualização.");
        const { data, error } = await admin.from("patients").update(update).eq("id", patientId).eq("user_id", userId).select("id,name,status,email,phone,diagnosis,birth_date,address,emergency_contact").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { patient: data, updated_fields: Object.keys(update) }, message: `Dados de ${data.name} atualizados com sucesso.`, structuredData: { type: "patient_updated", data }, clientAction: { type: "interface_action", data: { action: "open_patient", patientId: data.id, reason: "Cadastro atualizado" } } };
      }
      case "inactivate_patient": {
        const patientId = cleanId(args.patient_id);
        const { data, error } = await admin.from("patients").update({ status: "inactive", notes: args.reason ? `[Inativado pelo Synapse: ${cleanText(args.reason, 500)}]` : undefined }).eq("id", patientId).eq("user_id", userId).select("id,name,status,email,phone").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { patient: data }, message: `Paciente ${data.name} inativado com segurança.`, structuredData: { type: "patient_updated", data }, clientAction: { type: "interface_action", data: { action: "open_patient", patientId: data.id, reason: "Cadastro inativado" } } };
      }
      case "create_session_note": {
        const patientId = cleanId(args.patient_id);
        const { data: patient } = await admin.from("patients").select("name").eq("id", patientId).eq("user_id", userId).maybeSingle();
        if (!patient) throw new Error("Paciente não encontrado.");
        const { data, error } = await admin.from("session_notes").insert({ user_id: userId, patient_id: patientId, appointment_id: args.appointment_id ? cleanId(args.appointment_id) : null, notes: cleanText(args.notes, 12000), created_at: new Date().toISOString() }).select("id,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: data, patient_id: patientId, patient_name: patient.name }, message: `Anotação registrada no prontuário de ${patient.name}.`, structuredData: { type: "session_note_created", data: { ...data, patientName: patient.name } }, clientAction: { type: "interface_action", data: { action: "navigate", destination: "patient.sessions.history", patientId, reason: "Anotação registrada no prontuário" } } };
      }
      case "create_financial_entry": {
        const amount = Math.abs(Number(args.amount || 0));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor financeiro inválido.");
        const date = cleanText(args.date || new Date().toISOString().slice(0, 10), 10);
        const idempotencyKey = `synapse:fallback:${sessionId}:${pending.actionId}`;
        const { data: existing } = await admin.from("financial_entries").select("*").eq("professional_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
        if (existing) return { ok: true, grounded: true, recordCount: 1, data: { entry: existing }, message: "Esse lançamento já estava registrado; mantive o registro existente.", structuredData: { type: "transaction_created", data: { transaction: existing } }, clientAction: { type: "interface_action", data: { action: "navigate", destination: "finance.gestao-lancamentos", reason: "Lançamento localizado" } } };
        const { data, error } = await admin.from("financial_entries").insert({ professional_id: userId, idempotency_key: idempotencyKey, title: cleanText(args.title, 200), description: args.description ? cleanText(args.description, 1000) : cleanText(args.title, 200), amount, type: args.entry_type, patient_id: args.patient_id ? cleanId(args.patient_id) : null, due_date: date, competence_date: date, paid_at: `${date}T12:00:00.000Z`, status: "paid", payment_method: "manual", origin: "manual", metadata: { category: cleanText(args.category || "Outros", 100), source: "synapse_fallback_agent", session_id: sessionId } }).select().single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { entry: data }, message: `${args.entry_type === "expense" ? "Despesa" : "Receita"} de ${formatMoney(amount)} registrada com sucesso.`, structuredData: { type: "transaction_created", data: { transaction: data } }, clientAction: { type: "interface_action", data: { action: "navigate", destination: "finance.gestao-lancamentos", reason: "Lançamento registrado" } } };
      }
      default: return { ok: false, grounded: false, error: "Ação pendente desconhecida." };
    }
  } catch (error) {
    return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao executar a alteração." };
  }
}
