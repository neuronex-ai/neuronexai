import { MUTATING_TOOLS } from "./tools.ts";

export interface AgentToolContext {
  admin: any;
  userId: string;
  sessionId: string;
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
}

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelled_by_patient", "cancelled_by_professional"]);
const PAID_STATUSES = new Set(["paid", "received", "completed"]);

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

const dateOnly = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

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
  return {
    start,
    end,
    startIso: new Date(`${start}T00:00:00-03:00`).toISOString(),
    endIso: new Date(`${end}T23:59:59-03:00`).toISOString(),
  };
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const localDate = (value: string) => dateOnly(new Date(value));

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const summarizeMutation = (name: string, args: Record<string, any>) => {
  switch (name) {
    case "create_patient":
      return `Cadastrar o paciente ${cleanText(args.name, 120)}${args.email ? `, e-mail ${cleanText(args.email, 160)}` : ""}.`;
    case "update_patient": {
      const fields = Object.keys(args).filter((key) => !["patient_id", "patient_name"].includes(key));
      return `Atualizar ${fields.join(", ") || "os dados informados"} de ${cleanText(args.patient_name || "paciente selecionado", 120)}.`;
    }
    case "create_session_note":
      return `Registrar uma anotação no prontuário de ${cleanText(args.patient_name || "paciente selecionado", 120)}: “${cleanText(args.notes, 240)}”.`;
    case "create_appointment":
      return `Agendar ${cleanText(args.patient_name || "a consulta", 120)} para ${formatDateTime(brazilIso(args.datetime))}, com ${clamp(args.duration_minutes, 50, 15, 240)} minutos.`;
    case "reschedule_appointment":
      return `Remarcar a consulta de ${cleanText(args.patient_name || "paciente selecionado", 120)} para ${formatDateTime(brazilIso(args.new_datetime))}.`;
    case "cancel_appointment":
      return `Cancelar a consulta de ${cleanText(args.patient_name || "paciente selecionado", 120)}${args.reason ? `, motivo: ${cleanText(args.reason, 240)}` : ""}.`;
    case "create_financial_entry":
      return `Registrar ${args.entry_type === "expense" ? "a despesa" : "a receita"} “${cleanText(args.title, 160)}” no valor de ${formatMoney(Math.abs(Number(args.amount || 0)))}.`;
    default:
      return "Executar a alteração solicitada.";
  }
};

const stageMutation = (name: string, args: Record<string, unknown>): AgentToolResult => {
  const now = new Date();
  const pendingAction: PendingAction = {
    kind: "synapse_pending_action",
    actionId: crypto.randomUUID(),
    toolName: name,
    arguments: args,
    summary: summarizeMutation(name, args),
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
  };
  return {
    ok: true,
    grounded: false,
    pendingAction,
    message: pendingAction.summary,
    data: { confirmation_required: true, summary: pendingAction.summary },
    structuredData: { type: "confirmation_required", data: { actionId: pendingAction.actionId, summary: pendingAction.summary } },
  };
};

function mapAppointment(item: any) {
  return {
    id: item.id,
    patient_id: item.patient_id,
    patient_name: item.patient?.name || (item.type === "block" ? "Bloqueio" : "Sem paciente"),
    patient_email: item.patient?.email || null,
    patient_phone: item.patient?.phone || null,
    start_time: item.start_time,
    end_time: item.end_time,
    start_time_local: item.start_time ? formatDateTime(item.start_time) : null,
    end_time_local: item.end_time ? formatDateTime(item.end_time) : null,
    time_label: item.start_time ? formatTime(item.start_time) : null,
    date: item.start_time ? localDate(item.start_time) : null,
    type: item.type,
    status: item.status,
    notes: item.notes,
    location: item.location || null,
    google_meet_link: item.google_meet_link || null,
    price: item.price ?? null,
    metadata: item.metadata || {},
  };
}

async function queryAppointments(admin: any, userId: string, startDate: string, endDate: string, options: Record<string, any> = {}) {
  const period = dateBounds(startDate, endDate);
  let query = admin
    .from("appointments")
    .select("id,user_id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)")
    .eq("user_id", userId)
    .gte("start_time", period.startIso)
    .lte("start_time", period.endIso)
    .order("start_time")
    .limit(clamp(options.limit, 80, 1, 120));
  if (!options.include_cancelled) query = query.not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)");
  if (options.patient_id) query = query.eq("patient_id", cleanId(options.patient_id));
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
  return {
    period,
    total: appointments.length,
    active_count: active.length,
    sessions_count: sessions.length,
    blocks_count: blocks.length,
    cancelled_count: cancelled.length,
    pending_review_count: pendingReview.length,
    next_appointment: nextAppointment,
    day_groups: Object.values(byDay),
    attention: pendingReview.map((item) => ({
      kind: item.metadata?.syncStatus === "pending_professional_review" ? "reschedule_request" : "pending_appointment",
      appointment: item,
    })),
  };
}

async function resolvePatientByName(admin: any, userId: string, name: string) {
  const term = cleanText(name, 160).replace(/[%_]/g, "");
  if (!term) return null;
  const { data, error } = await admin
    .from("patients")
    .select("id,name,status,email,phone")
    .eq("user_id", userId)
    .ilike("name", `%${term}%`)
    .order("name")
    .limit(12);
  if (error) throw error;
  const matches = data || [];
  if (!matches.length) throw new Error(`Não encontrei paciente com o nome “${term}”.`);
  const normalized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const exact = matches.filter((item: any) => String(item.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalized);
  const candidates = exact.length === 1 ? exact : matches;
  if (candidates.length !== 1) throw new Error(`Encontrei mais de um paciente compatível: ${candidates.slice(0, 5).map((item: any) => item.name).join(", ")}.`);
  return candidates[0];
}

async function findAppointment(admin: any, userId: string, args: Record<string, any>) {
  if (args.appointment_id) {
    const { data, error } = await admin
      .from("appointments")
      .select("id,user_id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)")
      .eq("id", cleanId(args.appointment_id))
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAppointment(data) : null;
  }

  let patientId = args.patient_id ? cleanId(args.patient_id) : null;
  if (!patientId && args.patient_name) {
    const patient = await resolvePatientByName(admin, userId, args.patient_name);
    patientId = patient?.id || null;
  }

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

async function hasAppointmentConflict(admin: any, userId: string, start: string, end: string, excludeId?: string | null) {
  let query = admin
    .from("appointments")
    .select("id,start_time,end_time,type,status,patient:patient_id(name)")
    .eq("user_id", userId)
    .not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)")
    .lt("start_time", end)
    .gt("end_time", start)
    .limit(5);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

async function buildSlots(admin: any, userId: string, args: Record<string, any>) {
  const start = cleanText(args.start_date || dateOnly(new Date()), 10);
  const end = cleanText(args.end_date || start, 10);
  const duration = clamp(args.duration_minutes, 50, 15, 240);
  const limit = clamp(args.limit, 10, 1, 30);
  const period = dateBounds(start, end);
  const { data, error } = await admin
    .from("appointments")
    .select("start_time,end_time,status")
    .eq("user_id", userId)
    .not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)")
    .gte("start_time", period.startIso)
    .lte("start_time", period.endIso)
    .order("start_time");
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
          if (!conflict) {
            slots.push({ date, time: formatTime(slotStart.toISOString()), datetime: slotStart.toISOString(), end_datetime: slotEnd.toISOString() });
          }
          if (slots.length >= limit) break;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { duration_minutes: duration, slots };
}

export async function executeAgentTool(name: string, args: Record<string, any>, context: AgentToolContext): Promise<AgentToolResult> {
  if (MUTATING_TOOLS.has(name)) return stageMutation(name, args);
  const { admin, userId } = context;

  try {
    switch (name) {
      case "get_system_help": {
        const modules = [
          { name: "Agenda Desktop", capabilities: ["visão diária e semanal", "detalhes de consulta", "horários livres", "criar/remarcar/cancelar com confirmação"] },
          { name: "Pacientes", capabilities: ["cadastrar e atualizar pacientes", "consultar dados cadastrais", "abrir prontuário"] },
          { name: "NeuroFinance", capabilities: ["consultar cobranças", "criar cobranças com confirmação", "acompanhar pagamentos"] },
          { name: "Financeiro gerencial", capabilities: ["ver receitas e despesas", "listar lançamentos", "registrar entradas e saídas com confirmação"] },
        ];
        return { ok: true, grounded: true, recordCount: modules.length, data: { query: cleanText(args.query, 240), modules }, structuredData: { type: "system_help", data: { modules } } };
      }

      case "get_workspace_overview": {
        const now = new Date();
        const today = dateOnly(now);
        const upcomingEnd = dateOnly(addDays(now, 14));
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const monthEnd = dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const [patientsResult, todayAppointments, upcomingAppointments, sessionNotesResult, personalNotesResult, documentsResult, financialResult] = await Promise.all([
          admin.from("patients").select("id", { count: "exact", head: true }).eq("user_id", userId),
          queryAppointments(admin, userId, today, today, { limit: 120 }),
          queryAppointments(admin, userId, today, upcomingEnd, { limit: 200 }),
          admin.from("session_notes").select("id", { count: "exact", head: true }).eq("user_id", userId),
          admin.from("personal_notes").select("id", { count: "exact", head: true }).eq("user_id", userId),
          admin.from("document_files").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
          admin.from("financial_entries").select("id,title,amount,type,status,due_date", { count: "exact" }).eq("professional_id", userId).gte("due_date", monthStart).lte("due_date", monthEnd).limit(200),
        ]);
        const firstError = [patientsResult.error, sessionNotesResult.error, personalNotesResult.error, documentsResult.error, financialResult.error].find(Boolean);
        if (firstError) throw firstError;
        const monthEntries = financialResult.data || [];
        const monthIncome = monthEntries.filter((item: any) => item.type === "income").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
        const monthExpenses = monthEntries.filter((item: any) => item.type === "expense").reduce((sum: number, item: any) => sum + Math.abs(Number(item.amount || 0)), 0);
        const overview = {
          patients_count: patientsResult.count || 0,
          appointments_today_count: todayAppointments.length,
          upcoming_appointments_14d_count: upcomingAppointments.length,
          clinical_notes_count: sessionNotesResult.count || 0,
          personal_notes_count: personalNotesResult.count || 0,
          documents_count: documentsResult.count || 0,
          agenda_today: summarizeAgenda(todayAppointments, { start: today, end: today }),
          financial_month: { start_date: monthStart, end_date: monthEnd, entries_count: financialResult.count || monthEntries.length, income: monthIncome, expenses: monthExpenses, balance: monthIncome - monthExpenses },
        };
        return { ok: true, grounded: true, recordCount: overview.patients_count + overview.appointments_today_count + overview.financial_month.entries_count, data: { overview }, structuredData: { type: "workspace_overview", data: overview } };
      }

      case "list_patients": {
        const limit = clamp(args.limit, 20, 1, 50);
        let query = admin.from("patients").select("id,name,status,diagnosis,risk_score,last_session,next_session,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
        if (args.status && args.status !== "all") query = query.eq("status", args.status);
        const { data, error } = await query;
        if (error) throw error;
        const patients = data || [];
        return { ok: true, grounded: true, recordCount: patients.length, data: { patients }, structuredData: { type: "patient_list", data: { patients } } };
      }

      case "search_patients": {
        const term = cleanText(args.query, 120).replace(/[%_]/g, "");
        if (!term) throw new Error("Informe um nome para buscar.");
        const { data, error } = await admin.from("patients").select("id,name,status,diagnosis,risk_score,last_session,next_session,email,phone").eq("user_id", userId).ilike("name", `%${term}%`).order("name").limit(clamp(args.limit, 10, 1, 20));
        if (error) throw error;
        const patients = data || [];
        return { ok: true, grounded: true, recordCount: patients.length, data: { query: term, patients }, structuredData: patients.length === 1 ? { type: "patient_card", data: patients[0] } : { type: "patient_list", data: { patients } } };
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
        const allowedActions = new Set(["navigate", "open_patient", "open_patient_record", "open_daily_schedule", "scroll_to_appointment", "highlight_element", "open_modal"]);
        const allowedTargets = new Set(["dashboard", "agenda", "patients", "finance", "notes", "teleconsultation", "synapse"]);
        const action = cleanText(args.action, 50);
        const target = args.target ? cleanText(args.target, 50) : undefined;
        if (!allowedActions.has(action)) throw new Error("Ação visual inválida.");
        if (target && !allowedTargets.has(target)) throw new Error("Destino visual inválido.");
        const clientAction = { type: "interface_action", data: { action, target, patientId: args.patient_id ? cleanId(args.patient_id) : undefined, appointmentId: args.appointment_id ? cleanId(args.appointment_id) : undefined, date: args.date ? cleanText(args.date, 40) : undefined, element: args.element ? cleanText(args.element, 60) : undefined, modal: args.modal ? cleanText(args.modal, 60) : undefined, reason: args.reason ? cleanText(args.reason, 180) : undefined } };
        return { ok: true, grounded: false, data: { action_requested: action }, clientAction };
      }

      default:
        return { ok: false, grounded: false, error: `Ferramenta não suportada: ${name}` };
    }
  } catch (error) {
    return { ok: false, grounded: name !== "request_interface_action", error: error instanceof Error ? error.message : "Falha ao consultar o sistema." };
  }
}

export async function executeConfirmedMutation(pending: PendingAction, context: AgentToolContext): Promise<AgentToolResult> {
  const { admin, userId, sessionId } = context;
  const args = pending.arguments as Record<string, any>;

  try {
    switch (pending.toolName) {
      case "create_patient": {
        const { data, error } = await admin.from("patients").insert({ user_id: userId, name: cleanText(args.name, 160), email: args.email ? cleanText(args.email, 200) : null, phone: args.phone ? cleanText(args.phone, 50) : null, cpf: args.cpf ? cleanText(args.cpf, 30) : null, diagnosis: args.diagnosis ? cleanText(args.diagnosis, 500) : null, notes: args.notes ? cleanText(args.notes, 5000) : null, status: "pending", birth_date: args.birth_date || null, address: args.address ? cleanText(args.address, 500) : null, emergency_contact: args.emergency_contact ? cleanText(args.emergency_contact, 300) : null, medications: [] }).select("id,name,status,email,phone,diagnosis").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { patient: data }, message: `Paciente ${data.name} cadastrado com sucesso.`, structuredData: { type: "patient_card", data } };
      }

      case "update_patient": {
        const patientId = cleanId(args.patient_id);
        const update: Record<string, unknown> = {};
        for (const field of ["name", "email", "phone", "diagnosis", "notes", "birth_date", "address", "emergency_contact", "status"]) if (args[field] !== undefined && args[field] !== null) update[field] = args[field];
        if (!Object.keys(update).length) throw new Error("Nenhum campo foi informado para atualização.");
        const { data, error } = await admin.from("patients").update(update).eq("id", patientId).eq("user_id", userId).select("id,name,status,email,phone,diagnosis").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { patient: data, updated_fields: Object.keys(update) }, message: `Dados de ${data.name} atualizados com sucesso.`, structuredData: { type: "patient_updated", data } };
      }

      case "create_session_note": {
        const patientId = cleanId(args.patient_id);
        const { data: patient } = await admin.from("patients").select("name").eq("id", patientId).eq("user_id", userId).maybeSingle();
        if (!patient) throw new Error("Paciente não encontrado.");
        const { data, error } = await admin.from("session_notes").insert({ user_id: userId, patient_id: patientId, appointment_id: args.appointment_id ? cleanId(args.appointment_id) : null, notes: cleanText(args.notes, 12000), created_at: new Date().toISOString() }).select("id,created_at").single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { note: data, patient_name: patient.name }, message: `Anotação registrada no prontuário de ${patient.name}.`, structuredData: { type: "session_note_created", data: { ...data, patientName: patient.name } } };
      }

      case "create_appointment": {
        const start = brazilIso(args.datetime);
        const duration = clamp(args.duration_minutes, 50, 15, 240);
        const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();
        const conflicts = await hasAppointmentConflict(admin, userId, start, end, null);
        if (conflicts.length) throw new Error(`Já existe compromisso nesse horário: ${conflicts.map((item) => `${item.patient_name} às ${item.time_label}`).join(", ")}.`);
        const patientId = args.patient_id ? cleanId(args.patient_id) : null;
        if (patientId) {
          const { data: patient } = await admin.from("patients").select("id,name").eq("id", patientId).eq("user_id", userId).maybeSingle();
          if (!patient) throw new Error("Paciente não encontrado.");
        }
        const { data, error } = await admin.from("appointments").insert({ user_id: userId, patient_id: patientId, start_time: start, end_time: end, type: args.appointment_type || "presencial", notes: args.notes ? cleanText(args.notes, 3000) : null, location: args.location ? cleanText(args.location, 300) : null, price: args.price ?? null, status: "confirmed", metadata: { source: "synapse", created_from: "agenda_desktop" } }).select("id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)").single();
        if (error) throw error;
        const appointment = mapAppointment(data);
        return { ok: true, grounded: true, recordCount: 1, data: { appointment }, message: `Agendamento criado para ${appointment.start_time_local}.`, structuredData: { type: "appointment_card", data: appointment } };
      }

      case "reschedule_appointment": {
        const appointmentId = cleanId(args.appointment_id);
        const { data: current } = await admin.from("appointments").select("id,start_time,end_time,metadata,patient:patient_id(name)").eq("id", appointmentId).eq("user_id", userId).maybeSingle();
        if (!current) throw new Error("Consulta não encontrada.");
        const start = brazilIso(args.new_datetime);
        const currentDuration = (new Date(current.end_time).getTime() - new Date(current.start_time).getTime()) / 60000;
        const duration = clamp(args.new_duration_minutes, currentDuration || 50, 15, 240);
        const end = new Date(new Date(start).getTime() + duration * 60000).toISOString();
        const conflicts = await hasAppointmentConflict(admin, userId, start, end, appointmentId);
        if (conflicts.length) throw new Error(`Não dá para remarcar para esse horário porque há conflito com ${conflicts.map((item) => item.patient_name).join(", ")}.`);
        const metadata = { ...(current.metadata || {}), rescheduled_by: "synapse", previous_start_time: current.start_time, updated_from: "agenda_desktop" };
        const { data, error } = await admin.from("appointments").update({ start_time: start, end_time: end, status: "confirmed", metadata, updated_at: new Date().toISOString() }).eq("id", appointmentId).eq("user_id", userId).select("id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)").single();
        if (error) throw error;
        const appointment = mapAppointment(data);
        return { ok: true, grounded: true, recordCount: 1, data: { appointment }, message: `Consulta de ${appointment.patient_name || "paciente"} remarcada para ${appointment.start_time_local}.`, structuredData: { type: "appointment_rescheduled", data: appointment } };
      }

      case "cancel_appointment": {
        const appointmentId = cleanId(args.appointment_id);
        const { data: current } = await admin.from("appointments").select("id,notes,start_time,metadata,patient:patient_id(name)").eq("id", appointmentId).eq("user_id", userId).maybeSingle();
        if (!current) throw new Error("Consulta não encontrada.");
        const reason = cleanText(args.reason || "Sem motivo informado", 500);
        const notes = current.notes ? `${current.notes}\n[Cancelado pelo Synapse: ${reason}]` : `[Cancelado pelo Synapse: ${reason}]`;
        const metadata = { ...(current.metadata || {}), cancelled_by: "synapse", cancellation_reason: reason, updated_from: "agenda_desktop" };
        const { data, error } = await admin.from("appointments").update({ status: "cancelled", notes, metadata, updated_at: new Date().toISOString() }).eq("id", appointmentId).eq("user_id", userId).select("id,patient_id,start_time,end_time,type,status,notes,location,google_meet_link,price,metadata,patient:patient_id(name,email,phone)").single();
        if (error) throw error;
        const appointment = mapAppointment(data);
        return { ok: true, grounded: true, recordCount: 1, data: { appointment }, message: `Consulta de ${appointment.patient_name || "paciente"} cancelada.`, structuredData: { type: "appointment_cancelled", data: { ...appointment, reason } } };
      }

      case "create_financial_entry": {
        const amount = Math.abs(Number(args.amount || 0));
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor financeiro inválido.");
        const date = cleanText(args.date || new Date().toISOString().slice(0, 10), 10);
        const idempotencyKey = `synapse:fallback:${sessionId}:${pending.actionId}`;
        const { data: existing } = await admin.from("financial_entries").select("*").eq("professional_id", userId).eq("idempotency_key", idempotencyKey).maybeSingle();
        if (existing) return { ok: true, grounded: true, recordCount: 1, data: { entry: existing }, message: "Esse lançamento já estava registrado; mantive o registro existente.", structuredData: { type: "transaction_created", data: { transaction: existing } } };
        const { data, error } = await admin.from("financial_entries").insert({ professional_id: userId, idempotency_key: idempotencyKey, title: cleanText(args.title, 200), description: args.description ? cleanText(args.description, 1000) : cleanText(args.title, 200), amount, type: args.entry_type, patient_id: args.patient_id ? cleanId(args.patient_id) : null, due_date: date, competence_date: date, paid_at: `${date}T12:00:00.000Z`, status: "paid", payment_method: "manual", origin: "manual", metadata: { category: cleanText(args.category || "Outros", 100), source: "synapse_fallback_agent", session_id: sessionId } }).select().single();
        if (error) throw error;
        return { ok: true, grounded: true, recordCount: 1, data: { entry: data }, message: `${args.entry_type === "expense" ? "Despesa" : "Receita"} de ${formatMoney(amount)} registrada com sucesso.`, structuredData: { type: "transaction_created", data: { transaction: data } } };
      }

      default:
        return { ok: false, grounded: false, error: "Ação pendente desconhecida." };
    }
  } catch (error) {
    return { ok: false, grounded: true, error: error instanceof Error ? error.message : "Falha ao executar a alteração." };
  }
}
