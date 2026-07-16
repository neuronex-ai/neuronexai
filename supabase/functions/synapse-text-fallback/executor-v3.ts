import {
  executeAgentTool as executeBaseAgentTool,
  executeConfirmedMutation as executeBaseConfirmedMutation,
  type AgentToolResult,
  type PendingAction,
} from "./executor.ts";
import { MUTATING_TOOLS_V3 } from "./tools-v3.ts";
import {
  EntityResolutionError,
  enrichToolArguments,
  updateContextFromResult,
  type SynapseConversationState,
} from "./entity-context.ts";
import { ensureTeleconsultationInvite } from "../_shared/teleconsultation-access.ts";
import { normalizeSynapseError } from "../_shared/synapse-errors.ts";
import { shouldBlockSynapseExternalAction } from "../_shared/synapse-channel-policy.ts";

export interface AgentToolContextV3 {
  admin: any;
  userId: string;
  sessionId: string;
  authorization: string;
  requestOrigin?: string | null;
  userClient?: any;
  channel?: "panel" | "voice" | "whatsapp";
  voiceSessionId?: string | null;
  whatsappMessageId?: string | null;
  toolCallId?: string | null;
  correlationId?: string | null;
}

export interface AgentToolExecutionV3 {
  result: AgentToolResult;
  state: SynapseConversationState;
  resolvedArgs: Record<string, any>;
}

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
};
const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

const dateOnly = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const listFrom = (value: any, key: string) => Array.isArray(value?.data?.[key]) ? value.data[key] : [];

const getDateValue = (item: any) =>
  item?.date || item?.start_time || item?.created_at || item?.paid_at || item?.due_date || item?.uploaded_at || null;

const paidStatuses = new Set(["paid", "received", "completed", "confirmed"]);
const openStatuses = new Set(["planned", "pending", "overdue", "scheduled", "processing"]);
const cancelledAppointmentStatuses = new Set(["cancelled", "canceled", "cancelled_by_patient", "cancelled_by_professional"]);

function summarizePaymentTotals(charges: any[], entries: any[]) {
  const chargePendingStatuses = new Set(["pending", "overdue", "processing"]);
  const chargePaidStatuses = new Set(["paid", "received", "confirmed", "completed"]);
  const entryPaidStatuses = new Set(["paid", "received", "completed"]);
  const pendingCharges = charges.filter((charge) => chargePendingStatuses.has(String(charge.status || "").toLowerCase()));
  const paidCharges = charges.filter((charge) => chargePaidStatuses.has(String(charge.status || "").toLowerCase()));
  const pendingEntries = entries.filter((entry) => !entryPaidStatuses.has(String(entry.status || "").toLowerCase()));
  const paidEntries = entries.filter((entry) => entryPaidStatuses.has(String(entry.status || "").toLowerCase()));
  return {
    neurofinance_total: charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
    neurofinance_paid: paidCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
    neurofinance_pending: pendingCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
    manual_total: entries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0),
    manual_paid: paidEntries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0),
    manual_pending: pendingEntries.reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0),
    pending_count: pendingCharges.length + pendingEntries.length,
    paid_count: paidCharges.length + paidEntries.length,
  };
}

const safeJson = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || payload?.message || `Serviço indisponível (${response.status}).`);
  }
  return payload;
};

const functionUrl = (name: string) => `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;

async function invokeAuthenticatedFunction(
  context: AgentToolContextV3,
  name: string,
  body: Record<string, unknown>,
) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const response = await fetch(functionUrl(name), {
    method: "POST",
    headers: {
      Authorization: context.authorization,
      ...(anonKey ? { apikey: anonKey } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return safeJson(response);
}

function accountUiState(account: any) {
  if (!account?.asaas_account_id) return "not_started";
  const raw = String(
    account.ui_status ||
    account.status ||
    account.account_status?.generalStatus ||
    account.accountStatus?.generalStatus ||
    "pending",
  ).toLowerCase();
  if (["active", "approved", "enabled"].includes(raw) || account.charges_enabled === true) return "active";
  if (["restricted", "disabled", "rejected"].includes(raw)) return "restricted";
  if (["account_missing", "missing"].includes(raw)) return "account_missing";
  if (["onboarding", "not_started"].includes(raw)) return raw;
  return "pending_review";
}

async function getFinancialAccount(admin: any, userId: string) {
  const { data, error } = await admin
    .from("financial_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function safeAccount(account: any) {
  const state = accountUiState(account);
  return {
    has_account: Boolean(account?.asaas_account_id),
    state,
    is_active: state === "active",
    charges_enabled: Boolean(account?.charges_enabled),
    payouts_enabled: Boolean(account?.payouts_enabled),
    pix_enabled: Boolean(account?.pix_enabled),
    card_enabled: Boolean(account?.card_enabled),
    details_submitted: Boolean(account?.details_submitted),
    provider: account?.provider || "asaas",
    environment: account?.asaas_environment || null,
    open_requirements: account?.requirements || account?.account_status || account?.accountStatus || {},
    last_provider_event: account?.last_asaas_event_type || null,
    last_provider_event_at: account?.last_asaas_event_at || null,
    last_sync_error: account?.last_sync_error || null,
  };
}

function mapCharge(row: any) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.patient?.name || null,
    appointment_id: row.appointment_id || null,
    description: row.description || "Cobrança NeuroFinance",
    amount: Number(row.gross_amount || 0) / 100,
    net_amount: Number(row.net_amount || 0) / 100,
    status: row.normalized_status || row.status || row.funds_status || "pending",
    funds_status: row.funds_status || null,
    payment_method: row.payment_method_type || null,
    due_date: row.expires_at || null,
    paid_at: row.paid_at || null,
    created_at: row.created_at,
    checkout_available: Boolean(row.checkout_url),
    provider_payment_id: row.provider_payment_id,
  };
}

async function queryCharges(
  admin: any,
  userId: string,
  args: Record<string, any>,
  single = false,
) {
  let query = admin
    .from("nb_payments")
    .select("id,patient_id,appointment_id,gross_amount,net_amount,status,normalized_status,funds_status,payment_method_type,expires_at,paid_at,created_at,description,checkout_url,provider_payment_id,metadata,patient:patient_id(name,email,phone)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (args.charge_id) query = query.eq("id", args.charge_id);
  if (args.patient_id) query = query.eq("patient_id", args.patient_id);
  const status = clean(args.status, 30).toLowerCase();
  if (status && status !== "all") query = query.eq("normalized_status", status === "overdue" ? "overdue" : status);
  query = query.limit(single ? 1 : clamp(args.limit, 20, 1, 50));

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapCharge);
}

function referenceDate(entry: any) {
  return String(entry.paid_at || entry.competence_date || entry.due_date || entry.created_at || "").slice(0, 10);
}

async function getMonthFinancialEntries(admin: any, userId: string) {
  const now = new Date();
  const start = dateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const { data, error } = await admin
    .from("financial_entries")
    .select("id,type,title,description,amount,status,due_date,competence_date,paid_at,created_at,origin,patient_id,appointment_id,neurofinance_charge_id,metadata,patient:patient_id(name)")
    .eq("professional_id", userId)
    .neq("status", "cancelled")
    .order("due_date", { ascending: false })
    .limit(1000);
  if (error) throw error;

  return {
    start_date: start,
    end_date: end,
    entries: (data || []).filter((entry: any) => {
      const date = referenceDate(entry);
      return date >= start && date <= end;
    }),
  };
}

async function getFinancialPlanningGoal(admin: any, userId: string) {
  const now = new Date();
  const month = dateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
  const { data, error } = await admin
    .from("financial_planning_goals")
    .select("*")
    .eq("professional_id", userId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function summarizeManagerialFinance(entries: any[]) {
  return entries.reduce((acc, entry) => {
    const amount = Math.abs(Number(entry.amount || 0));
    const status = String(entry.status || "").toLowerCase();
    const isPaid = paidStatuses.has(status);
    const isOpen = openStatuses.has(status) || !isPaid;

    if (entry.type === "income") {
      if (isPaid) acc.income += amount;
      if (isOpen) acc.receivable += amount;
    }
    if (entry.type === "expense") {
      if (isPaid) acc.expense += amount;
      if (isOpen) acc.payable += amount;
    }
    return acc;
  }, { income: 0, expense: 0, receivable: 0, payable: 0, result: 0 });
}

async function getNeurofinanceOverviewData(admin: any, userId: string) {
  const account = await getFinancialAccount(admin, userId);
  const status = safeAccount(account);
  if (!status.has_account) return { account: status, overview: null };

  const { data: snapshot, error } = await admin
    .from("neurofinance_overview_snapshot_v")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const overview = snapshot ? {
    available_balance: Number(snapshot.available_balance || 0) / 100,
    pending_receivables: Number(snapshot.pending_receivables || 0) / 100,
    gross_received: Number(snapshot.gross_received || 0) / 100,
    fees_total: Number(snapshot.fees_total || 0) / 100,
    total_outflow: Number(snapshot.total_outflow || 0) / 100,
    calculated_available_balance: Number(snapshot.calculated_available_balance || 0) / 100,
    reconciliation_difference: Number(snapshot.reconciliation_difference || 0) / 100,
    is_stale: Boolean(snapshot.is_stale),
    provider_as_of: snapshot.provider_as_of || snapshot.updated_at || null,
    last_sync_error: snapshot.last_sync_error || status.last_sync_error || null,
  } : null;

  return { account: status, overview };
}

function mapAppointment(row: any) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.patient?.name || null,
    start_time: row.start_time,
    end_time: row.end_time,
    type: row.type,
    status: row.status,
    location: row.location || null,
    google_meet_link: typeof row.google_meet_link === "string" && /\/join\/[a-f0-9]{64}$/i.test(row.google_meet_link)
      ? row.google_meet_link
      : null,
    notes: row.notes || null,
    metadata: row.metadata || {},
  };
}

async function queryDashboardAppointments(admin: any, userId: string, startDate: string, endDate: string, limit = 50) {
  const start = `${startDate}T00:00:00.000-03:00`;
  const end = `${endDate}T23:59:59.999-03:00`;
  const { data, error } = await admin
    .from("appointments")
    .select("id,patient_id,start_time,end_time,type,status,location,google_meet_link,notes,metadata,patient:patient_id(name)")
    .eq("user_id", userId)
    .gte("start_time", new Date(start).toISOString())
    .lte("start_time", new Date(end).toISOString())
    .order("start_time", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

async function getNextAppointment(admin: any, userId: string) {
  const { data, error } = await admin
    .from("appointments")
    .select("id,patient_id,start_time,end_time,type,status,location,google_meet_link,notes,metadata,patient:patient_id(name)")
    .eq("user_id", userId)
    .gte("start_time", new Date().toISOString())
    .not("status", "in", "(cancelled,canceled,cancelled_by_patient,cancelled_by_professional)")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAppointment(data) : null;
}

async function getDashboardFinancialOverview(admin: any, userId: string) {
  const month = await getMonthFinancialEntries(admin, userId);
  const managerial = summarizeManagerialFinance(month.entries);
  managerial.result = managerial.income - managerial.expense;
  const neurofinance = await getNeurofinanceOverviewData(admin, userId);
  const planning = await getFinancialPlanningGoal(admin, userId);
  const revenueGoal = Number(planning?.revenue_goal_cents || 0) / 100;
  const expenseLimit = Number(planning?.expense_limit_cents || 0) / 100;
  const desiredProfit = Number(planning?.desired_profit_cents || 0) / 100;

  return {
    period: { start_date: month.start_date, end_date: month.end_date },
    management: {
      ...managerial,
      entry_count: month.entries.length,
      recent_entries: month.entries.slice(0, 8).map((entry: any) => ({
        id: entry.id,
        type: entry.type,
        title: entry.title || entry.description,
        amount: Math.abs(Number(entry.amount || 0)),
        status: entry.status,
        due_date: entry.due_date,
        patient_name: entry.patient?.name || null,
      })),
    },
    neurofinance,
    planning: planning ? {
      id: planning.id,
      month: planning.month,
      revenue_goal: revenueGoal,
      expense_limit: expenseLimit,
      desired_profit: desiredProfit,
      target_sessions: planning.target_sessions || 0,
      notes: planning.notes || null,
      revenue_progress_percent: revenueGoal > 0 ? Math.min(100, (managerial.income / revenueGoal) * 100) : 0,
      expense_usage_percent: expenseLimit > 0 ? Math.min(100, (managerial.expense / expenseLimit) * 100) : 0,
      remaining_revenue: Math.max(0, revenueGoal - managerial.income),
    } : null,
  };
}

async function getDashboardAttentionQueue(admin: any, userId: string, limit = 20) {
  const today = dateOnly(new Date());
  const yesterday = dateOnly(addDays(new Date(), -1));
  const upcoming = await queryDashboardAppointments(admin, userId, yesterday, today, 80);
  const appointmentItems = upcoming
    .filter((appointment: any) => !cancelledAppointmentStatuses.has(String(appointment.status || "").toLowerCase()))
    .filter((appointment: any) => ["unscored", "pending"].includes(String(appointment.status || "").toLowerCase()) || appointment.metadata?.syncStatus === "pending_professional_review")
    .map((appointment: any) => ({
      kind: "appointment_attention",
      priority: appointment.metadata?.syncStatus === "pending_professional_review" ? "high" : "normal",
      title: appointment.metadata?.syncStatus === "pending_professional_review" ? "Reagendamento pendente" : "Consulta precisa de atenção",
      description: `${appointment.patient_name || "Paciente"} · ${appointment.start_time}`,
      appointment,
    }));

  const { data: pendingPatients, error: pendingPatientsError } = await admin
    .from("patients")
    .select("id,name,status,created_at")
    .eq("user_id", userId)
    .in("status", ["pending", "new", "triage"])
    .order("created_at", { ascending: false })
    .limit(10);
  if (pendingPatientsError) throw pendingPatientsError;

  const account = safeAccount(await getFinancialAccount(admin, userId));
  const neurofinanceItems = !account.has_account || !account.is_active ? [{
    kind: "neurofinance_attention",
    priority: "normal",
    title: "NeuroFinance ainda não está ativo",
    description: `Estado atual: ${account.state}`,
    account,
  }] : [];

  const items = [
    ...appointmentItems,
    ...(pendingPatients || []).map((patient: any) => ({
      kind: "patient_attention",
      priority: "normal",
      title: "Paciente pendente",
      description: patient.name,
      patient,
    })),
    ...neurofinanceItems,
  ].slice(0, limit);

  return { items, total: items.length };
}

function stageNewMutation(name: string, args: Record<string, any>): AgentToolResult {
  const now = new Date();
  const summaries: Record<string, string> = {
    create_neurofinance_charge: `Criar uma cobrança NeuroFinance de ${formatMoney(Number(args.amount || 0))} para ${clean(args.patient_name, 120)}, com vencimento em ${clean(args.due_date, 20)}.`,
    create_fiscal_invoice: `Solicitar uma NFS-e de ${formatMoney(Number(args.amount || 0))} para ${clean(args.patient_name, 120)}, referente a “${clean(args.description, 180)}”.`,
    send_appointment_reminder: `Enviar e-mail de ${args.action === "cancel" ? "cancelamento" : args.action === "reschedule" ? "reagendamento" : "lembrete"} da consulta de ${clean(args.patient_name, 120)}.`,
    send_patient_email: `Enviar para ${clean(args.patient_name, 120)} o e-mail “${clean(args.subject, 180)}”.`,
  };
  const pendingAction: PendingAction = {
    kind: "synapse_pending_action",
    actionId: crypto.randomUUID(),
    toolName: name,
    arguments: args,
    summary: summaries[name] || "Executar a ação solicitada.",
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
    structuredData: {
      type: "confirmation_required",
      data: { actionId: pendingAction.actionId, summary: pendingAction.summary },
    },
  };
}

async function executeNewReadTool(
  name: string,
  args: Record<string, any>,
  context: AgentToolContextV3,
): Promise<AgentToolResult | null> {
  const { admin, userId } = context;

  switch (name) {
    case "search_workspace": {
      if (!context.userClient) throw new Error("Cliente autenticado indisponível para a busca unificada.");
      const query = clean(args.query, 240);
      if (!query) throw new Error("Informe o termo que deseja pesquisar.");
      const entityTypes = Array.isArray(args.entity_types)
        ? args.entity_types.map((value: unknown) => clean(value, 40)).filter(Boolean).slice(0, 6)
        : null;
      const { data, error } = await context.userClient.rpc("search_synapse_workspace", {
        p_query: query,
        p_entity_types: entityTypes?.length ? entityTypes : null,
        p_limit: clamp(args.limit, 12, 1, 50),
      });
      if (error) throw error;
      const results = (data || []).map((item: any) => ({
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        patient_id: item.patient_id,
        title: clean(item.title, 180),
        subtitle: clean(item.subtitle, 180) || null,
        excerpt: clean(item.excerpt, 280) || null,
        occurred_at: item.occurred_at,
        score: Number(item.score || 0),
        match_reason: item.match_reason,
      }));
      return { ok: true, grounded: true, recordCount: results.length, data: { query, results }, structuredData: { type: "workspace_search", data: { results } } };
    }

    case "get_dashboard_schedule": {
      const today = new Date();
      const startDate = clean(args.start_date || dateOnly(today), 10);
      const endDate = clean(args.end_date || dateOnly(addDays(today, 7)), 10);
      const appointments = await queryDashboardAppointments(admin, userId, startDate, endDate, clamp(args.limit, 30, 1, 50));
      const data = { period: { start_date: startDate, end_date: endDate }, appointments };
      return { ok: true, grounded: true, recordCount: appointments.length, data, structuredData: { type: "dashboard_schedule", data } };
    }

    case "get_dashboard_next_appointment": {
      const appointment = await getNextAppointment(admin, userId);
      return { ok: true, grounded: true, recordCount: appointment ? 1 : 0, data: { appointment }, structuredData: { type: "dashboard_next_appointment", data: { appointment } } };
    }

    case "get_dashboard_financial_overview": {
      const overview = await getDashboardFinancialOverview(admin, userId);
      return { ok: true, grounded: true, recordCount: 1, data: overview, structuredData: { type: "dashboard_financial_overview", data: overview } };
    }

    case "get_dashboard_attention_queue": {
      const queue = await getDashboardAttentionQueue(admin, userId, clamp(args.limit, 20, 1, 30));
      return { ok: true, grounded: true, recordCount: queue.total, data: queue, structuredData: { type: "dashboard_attention_queue", data: queue } };
    }

    case "get_dashboard_daily_briefing": {
      const today = dateOnly(new Date());
      const [nextAppointment, todaySchedule, weekSchedule, financial, attention] = await Promise.all([
        getNextAppointment(admin, userId),
        queryDashboardAppointments(admin, userId, today, today, 50),
        queryDashboardAppointments(admin, userId, today, dateOnly(addDays(new Date(), 7)), 80),
        getDashboardFinancialOverview(admin, userId),
        getDashboardAttentionQueue(admin, userId, 20),
      ]);
      const data = {
        date: today,
        next_appointment: nextAppointment,
        today_appointments: todaySchedule,
        week_appointments: weekSchedule,
        attention_queue: attention.items,
        financial,
        summary: {
          today_count: todaySchedule.length,
          week_count: weekSchedule.length,
          attention_count: attention.total,
          management_result: financial.management.result,
          neurofinance_available_balance: financial.neurofinance?.overview?.available_balance ?? null,
        },
      };
      return { ok: true, grounded: true, recordCount: 1 + todaySchedule.length + attention.total, data, structuredData: { type: "dashboard_daily_briefing", data } };
    }

    case "get_neurofinance_status": {
      const account = await getFinancialAccount(admin, userId);
      const status = safeAccount(account);
      return {
        ok: true,
        grounded: true,
        recordCount: account ? 1 : 0,
        data: { account: status },
        structuredData: { type: "neurofinance_status", data: status },
      };
    }

    case "get_neurofinance_overview": {
      const data = await getNeurofinanceOverviewData(admin, userId);
      return {
        ok: true,
        grounded: true,
        recordCount: data.overview ? 1 : 0,
        data,
        structuredData: { type: data.overview ? "neurofinance_overview" : "neurofinance_status", data },
      };
    }

    case "list_neurofinance_charges": {
      const account = safeAccount(await getFinancialAccount(admin, userId));
      if (!account.has_account) {
        return { ok: true, grounded: true, recordCount: 0, data: { account, charges: [] }, structuredData: { type: "neurofinance_status", data: account } };
      }
      const charges = await queryCharges(admin, userId, args, false);
      return {
        ok: true,
        grounded: true,
        recordCount: charges.length,
        data: { account, charges },
        structuredData: { type: "neurofinance_charges", data: { charges } },
      };
    }

    case "get_neurofinance_charge": {
      const account = safeAccount(await getFinancialAccount(admin, userId));
      if (!account.has_account) {
        return { ok: true, grounded: true, recordCount: 0, data: { account, charge: null }, structuredData: { type: "neurofinance_status", data: account } };
      }
      const charges = await queryCharges(admin, userId, args, true);
      const charge = charges[0] || null;
      return {
        ok: true,
        grounded: true,
        recordCount: charge ? 1 : 0,
        data: { account, charge },
        structuredData: charge ? { type: "neurofinance_charge", data: charge } : undefined,
      };
    }

    case "get_patient_payment_status": {
      const account = safeAccount(await getFinancialAccount(admin, userId));
      const status = clean(args.status || "all", 30).toLowerCase();
      const limit = clamp(args.limit, 20, 1, 50);
      const charges = account.has_account
        ? await queryCharges(admin, userId, { ...args, status, limit }, false)
        : [];
      const manualResult = await executeBaseAgentTool("list_financial_entries", {
        patient_id: args.patient_id,
        entry_type: "income",
        status: status === "all" ? undefined : status,
        limit,
      }, context);
      const manualEntries = manualResult.ok ? listFrom(manualResult, "entries") : [];
      const partialFailures = manualResult.ok ? [] : [{ section: "manual_financial_entries", error: manualResult.error || "Falha ao consultar lancamentos." }];
      const totals = summarizePaymentTotals(charges, manualEntries);
      const data = {
        patient: { id: args.patient_id, name: args.patient_name || null },
        account,
        status_filter: status,
        neurofinance_charges: charges,
        manual_entries: manualEntries,
        totals,
        partial_failures: partialFailures,
      };
      return {
        ok: true,
        grounded: true,
        recordCount: charges.length + manualEntries.length,
        data,
        structuredData: { type: "patient_payment_status", data },
      };
    }

    case "get_patient_system_snapshot": {
      const partialFailures: Array<{ section: string; error: string }> = [];
      const capture = async (section: string, runner: () => Promise<any>) => {
        try {
          return await runner();
        } catch (error) {
          partialFailures.push({
            section,
            error: error instanceof Error ? error.message : "Falha ao consultar esta parte.",
          });
          return null;
        }
      };

      const historyLimit = clamp(args.history_limit, 5, 1, 10);
      const appointmentsLimit = clamp(args.appointments_limit, 12, 1, 30);
      const financialLimit = clamp(args.financial_limit, 20, 1, 30);
      const today = new Date();
      const todayDate = dateOnly(today);
      const pastStart = dateOnly(addDays(today, -180));
      const futureEnd = dateOnly(addDays(today, 90));

      const [details, clinical, pastAppointments, upcomingAppointments, payments, documents] = await Promise.all([
        capture("patient_details", () => executeBaseAgentTool("get_patient_details", { patient_id: args.patient_id }, context)),
        capture("clinical_history", () => executeBaseAgentTool("get_clinical_history", { patient_id: args.patient_id, limit: historyLimit }, context)),
        capture("past_appointments", () => executeBaseAgentTool("get_calendar", {
          patient_id: args.patient_id,
          start_date: pastStart,
          end_date: todayDate,
          limit: appointmentsLimit,
        }, context)),
        capture("upcoming_appointments", () => executeBaseAgentTool("get_calendar", {
          patient_id: args.patient_id,
          start_date: todayDate,
          end_date: futureEnd,
          limit: appointmentsLimit,
        }, context)),
        capture("payment_status", () => executeNewReadTool("get_patient_payment_status", {
          patient_id: args.patient_id,
          patient_name: args.patient_name,
          limit: financialLimit,
        }, context)),
        args.include_documents
          ? capture("documents", () => executeBaseAgentTool("list_documents", { patient_id: args.patient_id, limit: 10 }, context))
          : Promise.resolve(null),
      ]);

      for (const result of [details, clinical, pastAppointments, upcomingAppointments, payments, documents]) {
        if (result && result.ok === false) {
          partialFailures.push({ section: "tool_result", error: result.error || "Uma consulta retornou erro." });
        }
      }

      const patient = details?.data?.patient || { id: args.patient_id, name: args.patient_name || null };
      const data = {
        patient,
        clinical_notes: listFrom(clinical, "notes"),
        past_appointments: listFrom(pastAppointments, "appointments"),
        upcoming_appointments: listFrom(upcomingAppointments, "appointments"),
        payment_status: payments?.data || null,
        documents: args.include_documents ? listFrom(documents, "documents") : [],
        partial_failures: partialFailures,
      };
      const recordCount =
        (data.patient ? 1 : 0) +
        data.clinical_notes.length +
        data.past_appointments.length +
        data.upcoming_appointments.length +
        Number(payments?.recordCount || 0) +
        data.documents.length;
      return {
        ok: Boolean(patient),
        grounded: true,
        recordCount,
        data,
        structuredData: { type: "patient_system_snapshot", data },
      };
    }

    case "get_patient_timeline": {
      const partialFailures: Array<{ section: string; error: string }> = [];
      const capture = async (section: string, runner: () => Promise<any>) => {
        try {
          return await runner();
        } catch (error) {
          partialFailures.push({
            section,
            error: error instanceof Error ? error.message : "Falha ao consultar esta parte.",
          });
          return null;
        }
      };
      const limit = clamp(args.limit, 30, 1, 50);
      const today = new Date();
      const startDate = clean(args.start_date || dateOnly(addDays(today, -365)), 10);
      const endDate = clean(args.end_date || dateOnly(addDays(today, 90)), 10);
      const [clinical, appointments, payments, documents] = await Promise.all([
        capture("clinical_history", () => executeBaseAgentTool("get_clinical_history", { patient_id: args.patient_id, limit: 10 }, context)),
        capture("appointments", () => executeBaseAgentTool("get_calendar", {
          patient_id: args.patient_id,
          start_date: startDate,
          end_date: endDate,
          limit: 50,
        }, context)),
        capture("payment_status", () => executeNewReadTool("get_patient_payment_status", {
          patient_id: args.patient_id,
          patient_name: args.patient_name,
          limit: 50,
        }, context)),
        capture("documents", () => executeBaseAgentTool("list_documents", { patient_id: args.patient_id, limit: 20 }, context)),
      ]);

      const charges = Array.isArray(payments?.data?.neurofinance_charges) ? payments.data.neurofinance_charges : [];
      const manualEntries = Array.isArray(payments?.data?.manual_entries) ? payments.data.manual_entries : [];
      const timeline = [
        ...listFrom(clinical, "notes").map((note: any) => ({
          kind: "clinical_note",
          date: note.date,
          title: "Nota de prontuario",
          summary: note.summary,
          source_id: note.id,
        })),
        ...listFrom(appointments, "appointments").map((appointment: any) => ({
          kind: "appointment",
          date: appointment.start_time,
          title: appointment.patient_name || "Consulta",
          status: appointment.status,
          type: appointment.type,
          summary: appointment.notes || appointment.start_time_local,
          source_id: appointment.id,
        })),
        ...charges.map((charge: any) => ({
          kind: "neurofinance_charge",
          date: charge.paid_at || charge.due_date || charge.created_at,
          title: charge.description || "Cobranca NeuroFinance",
          amount: charge.amount,
          status: charge.status,
          source_id: charge.id,
        })),
        ...manualEntries.map((entry: any) => ({
          kind: "financial_entry",
          date: entry.paid_at || entry.due_date || entry.created_at,
          title: entry.title || entry.description || "Lancamento financeiro",
          amount: Math.abs(Number(entry.amount || 0)),
          status: entry.status,
          source_id: entry.id,
        })),
        ...listFrom(documents, "documents").map((document: any) => ({
          kind: "document",
          date: document.uploaded_at || document.created_at,
          title: document.original_name || "Documento",
          status: document.status,
          category: document.category,
          source_id: document.id,
        })),
      ]
        .filter((item) => getDateValue(item))
        .sort((a, b) => new Date(getDateValue(b) || 0).getTime() - new Date(getDateValue(a) || 0).getTime())
        .slice(0, limit);

      const data = {
        patient: { id: args.patient_id, name: args.patient_name || null },
        period: { start_date: startDate, end_date: endDate },
        timeline,
        partial_failures: partialFailures,
      };
      return {
        ok: true,
        grounded: true,
        recordCount: timeline.length,
        data,
        structuredData: { type: "patient_timeline", data },
      };
    }

    case "list_fiscal_invoices": {
      const payload = await invokeAuthenticatedFunction(context, "asaas-invoices", {
        action: "list",
        patient_id: args.patient_id || null,
        status: args.status || null,
        limit: clamp(args.limit, 50, 1, 100),
      });
      const invoices = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.invoices) ? payload.invoices : [];
      return {
        ok: true,
        grounded: true,
        recordCount: invoices.length,
        data: { invoices, total: payload?.totalCount ?? invoices.length },
        structuredData: { type: "fiscal_invoices", data: { invoices } },
      };
    }

    case "get_fiscal_invoice": {
      if (!args.invoice_id) {
        const listed = await executeNewReadTool("list_fiscal_invoices", { ...args, limit: 1 }, context);
        const invoice = listed?.data?.invoices?.[0] || null;
        return {
          ok: true,
          grounded: true,
          recordCount: invoice ? 1 : 0,
          data: { invoice },
          structuredData: invoice ? { type: "fiscal_invoice", data: invoice } : undefined,
        };
      }
      const payload = await invokeAuthenticatedFunction(context, "asaas-invoices", {
        action: "detail",
        id: args.invoice_id,
      });
      const invoice = payload?.invoice || payload?.data || null;
      return {
        ok: true,
        grounded: true,
        recordCount: invoice ? 1 : 0,
        data: { invoice },
        structuredData: invoice ? { type: "fiscal_invoice", data: invoice } : undefined,
      };
    }

    default:
      return null;
  }
}

export async function executeAgentToolV3(
  name: string,
  originalArgs: Record<string, any>,
  context: AgentToolContextV3,
  state: SynapseConversationState,
): Promise<AgentToolExecutionV3> {
  try {
    const enriched = await enrichToolArguments(context.admin, context.userId, name, originalArgs, state, context.userClient);
    const contextArgs = enriched.args;
    const args = { ...contextArgs };
    delete args._confirmed_patient_alias;
    let result: AgentToolResult;

    if (MUTATING_TOOLS_V3.has(name) && [
      "create_neurofinance_charge",
      "create_fiscal_invoice",
      "send_appointment_reminder",
      "send_patient_email",
    ].includes(name)) {
      result = stageNewMutation(name, args);
    } else {
      const newResult = await executeNewReadTool(name, args, context);
      result = newResult || await executeBaseAgentTool(name, args, context);
    }

    return {
      result,
      state: updateContextFromResult(state, name, contextArgs, result),
      resolvedArgs: args,
    };
  } catch (error) {
    if (error instanceof EntityResolutionError) {
      return {
        result: {
          ok: false,
          grounded: true,
          error: error.message,
          data: error.details,
          recordCount: 0,
          errorCode: error.code,
        },
        state,
        resolvedArgs: originalArgs,
      };
    }
    const normalized = normalizeSynapseError(error);
    console.warn("[synapse-tool] execution failed", JSON.stringify({ phase: "execute", tool: name, code: normalized.code }));
    return {
      result: {
        ok: false,
        grounded: true,
        error: normalized.message,
        errorCode: normalized.code,
        data: normalized.details,
      },
      state,
      resolvedArgs: originalArgs,
    };
  }
}

async function refreshGoogleAccessToken(admin: any, userId: string, tokenData: any) {
  if (!tokenData?.refresh_token) throw new Error("A conexão com o Google precisa ser refeita nas configurações.");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("A integração de e-mail não está configurada.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  const payload = await safeJson(response);
  const expiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
  await admin.from("user_google_tokens").update({
    access_token: payload.access_token,
    expires_at: expiresAt,
  }).eq("user_id", userId);
  return payload.access_token as string;
}

const base64Utf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const urlSafeBase64 = (value: string) => base64Utf8(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sendCustomPatientEmail(
  context: AgentToolContextV3,
  args: Record<string, any>,
) {
  const { data: patient, error: patientError } = await context.admin
    .from("patients")
    .select("name,email")
    .eq("id", args.patient_id)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (patientError) throw patientError;
  if (!patient?.email) throw new Error(`${patient?.name || "O paciente"} não possui e-mail cadastrado.`);

  const { data: tokens, error: tokenError } = await context.admin
    .from("user_google_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (tokenError) throw tokenError;
  if (!tokens?.access_token) throw new Error("Conecte sua conta Google nas configurações antes de enviar e-mails.");

  let accessToken = tokens.access_token;
  if (tokens.expires_at && new Date(tokens.expires_at).getTime() < Date.now() + 60_000) {
    accessToken = await refreshGoogleAccessToken(context.admin, context.userId, tokens);
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoResponse.ok) {
    accessToken = await refreshGoogleAccessToken(context.admin, context.userId, tokens);
  }
  const userInfo = await safeJson(await fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));

  const { data: profile } = await context.admin
    .from("profiles")
    .select("first_name,last_name,clinic_name")
    .eq("id", context.userId)
    .maybeSingle();
  const senderName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.clinic_name || "NeuroNex";
  const body = clean(args.body, 20000);
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const htmlBody = isHtml ? body : `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
  const raw = [
    `To: ${patient.email}`,
    `From: =?utf-8?B?${base64Utf8(senderName)}?= <${userInfo.email}>`,
    `Subject: =?utf-8?B?${base64Utf8(clean(args.subject, 300))}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(htmlBody),
  ].join("\r\n");

  const gmailResponse = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: urlSafeBase64(raw) }),
  });
  await safeJson(gmailResponse);
  return { patient_name: patient.name, email: patient.email, subject: clean(args.subject, 300) };
}

export async function executeConfirmedMutationV3(
  pending: PendingAction,
  context: AgentToolContextV3,
): Promise<AgentToolResult> {
  const args = pending.arguments as Record<string, any>;

  if (shouldBlockSynapseExternalAction({
    channel: context.channel,
    toolName: pending.toolName,
    allowWhatsappExternalActions: Deno.env.get("SYNAPSE_WHATSAPP_ALLOW_EXTERNAL_ACTIONS"),
  })) {
    return {
      ok: false,
      grounded: true,
      error: "Por segurança, esta ação externa precisa ser concluída no painel NeuroNex.",
      data: {
        blocked_channel: "whatsapp",
        requires_panel_confirmation: true,
      },
    };
  }

  try {
    switch (pending.toolName) {
      case "create_neurofinance_charge": {
        const payload = await invokeAuthenticatedFunction(context, "asaas-create-payment", {
          patient_id: args.patient_id,
          appointment_id: args.appointment_id || null,
          amount: Math.round(Number(args.amount) * 100),
          payment_method: args.payment_method,
          due_date: args.due_date,
          description: args.description || `Sessão - ${args.patient_name}`,
          idempotency_key: `synapse:${pending.actionId}`,
        });
        const charge = {
          id: payload.payment_id,
          patient_id: args.patient_id,
          patient_name: args.patient_name,
          amount: Number(payload.amount || Math.round(Number(args.amount) * 100)) / 100,
          status: payload.status || "pending",
          payment_method: payload.billing_type || args.payment_method,
          checkout_available: Boolean(payload.checkout_url),
          due_date: args.due_date,
        };
        return {
          ok: true,
          grounded: true,
          recordCount: 1,
          data: { charge },
          message: `Cobrança de ${formatMoney(charge.amount)} criada para ${args.patient_name}.`,
          structuredData: { type: "neurofinance_charge", data: charge },
          clientAction: { type: "interface_action", data: { action: "navigate", destination: "finance.gestao-cobrancas", reason: "Cobrança criada" } },
        };
      }

      case "create_fiscal_invoice": {
        let providerPaymentId = args.payment_id || null;
        if (!providerPaymentId && args.charge_id) {
          const { data: charge } = await context.admin
            .from("nb_payments")
            .select("provider_payment_id")
            .eq("id", args.charge_id)
            .eq("user_id", context.userId)
            .maybeSingle();
          providerPaymentId = charge?.provider_payment_id || null;
        }

        const payload = await invokeAuthenticatedFunction(context, "asaas-invoices", {
          action: "create",
          payment: providerPaymentId,
          patient_id: args.patient_id,
          serviceDescription: args.description,
          observations: args.observations || `Emissão solicitada pelo Synapse para ${args.patient_name}.`,
          value: Number(args.amount),
          effectiveDate: args.effective_date || new Date().toISOString().slice(0, 10),
          idempotencyKey: `synapse:${pending.actionId}`,
        });
        const invoice = payload.invoice || payload.data;
        return {
          ok: true,
          grounded: true,
          recordCount: invoice ? 1 : 0,
          data: { invoice, patient_name: args.patient_name },
          message: `A NFS-e de ${formatMoney(Number(args.amount))} foi solicitada para ${args.patient_name}. Vou acompanhar o status; a autorização final depende da prefeitura.`,
          structuredData: invoice ? { type: "fiscal_invoice", data: invoice } : undefined,
          clientAction: { type: "interface_action", data: { action: "navigate", destination: "finance.fiscal-lista", reason: "NFS-e solicitada" } },
        };
      }

      case "send_appointment_reminder": {
        const { data: appointment, error } = await context.admin
          .from("appointments")
          .select("id,user_id,start_time,end_time,type,location,google_meet_link,patient:patient_id(name,email)")
          .eq("id", args.appointment_id)
          .eq("user_id", context.userId)
          .maybeSingle();
        if (error) throw error;
        if (!appointment) throw new Error("Consulta não encontrada.");
        if (!appointment.patient?.email) throw new Error(`${appointment.patient?.name || "O paciente"} não possui e-mail cadastrado.`);

        const meetLink = appointment.type === "online"
          ? (await ensureTeleconsultationInvite(context.admin, appointment)).meetLink
          : null;

        await invokeAuthenticatedFunction(context, "send-reminder-email", {
          appointmentId: appointment.id,
          patientEmail: appointment.patient.email,
          patientName: appointment.patient.name,
          startTime: appointment.start_time,
          endTime: appointment.end_time,
          type: appointment.type,
          meetLink,
          location: appointment.location || null,
          origin: context.requestOrigin || "https://neuronex.site",
          action: args.action || "reminder",
          cancellationReason: args.cancellation_reason || null,
        });
        return {
          ok: true,
          grounded: true,
          recordCount: 1,
          data: { appointment_id: appointment.id, patient_name: appointment.patient.name, action: args.action || "reminder" },
          message: `E-mail enviado para ${appointment.patient.name}.`,
          structuredData: { type: "email_sent", data: { patientName: appointment.patient.name, kind: args.action || "reminder" } },
        };
      }

      case "send_patient_email": {
        const sent = await sendCustomPatientEmail(context, args);
        return {
          ok: true,
          grounded: true,
          recordCount: 1,
          data: sent,
          message: `E-mail “${sent.subject}” enviado para ${sent.patient_name}.`,
          structuredData: { type: "email_sent", data: { patientName: sent.patient_name, subject: sent.subject } },
        };
      }

      default:
        return executeBaseConfirmedMutation(pending, context);
    }
  } catch (error) {
    return {
      ok: false,
      grounded: true,
      error: error instanceof Error ? error.message : "Não foi possível executar a ação.",
    };
  }
}
