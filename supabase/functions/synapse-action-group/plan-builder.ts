import {
  actionGroupRow,
  prepareSynapseActionGroupPlan,
  type SynapseActionGroupPlan,
  type SynapseActionGroupStep,
  type SynapseEditableField,
} from "../_shared/synapse-action-group.ts";
import { loadAgendaActionContext } from "../_shared/agenda-action-context.ts";
import { validateVoiceToolCall } from "../_shared/synapse-voice-policy.ts";
import {
  enrichToolArguments,
  loadConversationContext,
} from "../synapse-text-fallback/entity-context.ts";
import type { PendingAction } from "../synapse-text-fallback/executor.ts";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeStepId = (value: unknown, fallback: string) => {
  const id = clean(value, 120);
  if (id && /^[a-zA-Z0-9_-]{2,120}$/.test(id)) return id;
  return fallback;
};

const normalizeLookup = (value: unknown) =>
  clean(value, 2000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsPhrase = (text: string, phrase: string) =>
  Boolean(phrase && ` ${text} `.includes(` ${phrase} `));

const PATIENT_SCOPED_GROUP_TOOLS = new Set([
  "update_patient",
  "update_patient_basic_info",
  "inactivate_patient",
  "create_session_note",
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "create_personal_note",
  "link_file_to_patient",
  "create_financial_entry",
  "create_neurofinance_charge",
  "create_fiscal_invoice",
  "send_appointment_reminder",
  "send_patient_email",
  "request_interface_action",
]);

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

function parseNumberWords(tokens: string[]) {
  let total = 0;
  let current = 0;
  let consumed = false;
  for (const token of tokens) {
    if (token === "e") continue;
    if (token === "mil") {
      total += (current || 1) * 1000;
      current = 0;
      consumed = true;
      continue;
    }
    const value = NUMBER_WORDS[token];
    if (value === undefined) continue;
    current += value;
    consumed = true;
  }
  const result = total + current;
  return consumed && Number.isFinite(result) && result > 0 ? result : null;
}

function explicitAmountFromText(value: unknown) {
  const raw = clean(value, 3000).toLowerCase();
  if (!raw) return null;
  const numeric = raw.match(/(?:r\$\s*)?(\d{1,9}(?:[.,]\d{1,2})?)\s*(?:reais?|real)\b/i);
  if (numeric) {
    const amount = Number(numeric[1].replace(".", "").replace(",", "."));
    if (Number.isFinite(amount) && amount > 0) return amount;
  }

  const normalized = normalizeLookup(raw);
  const tokens = normalized.split(" ").filter(Boolean);
  const realIndex = tokens.findIndex((token) => token === "real" || token === "reais");
  if (realIndex < 1) return null;
  const numberWindow = tokens.slice(Math.max(0, realIndex - 8), realIndex);
  return parseNumberWords(numberWindow);
}

async function recoverRecentConversationFacts(admin: any, userId: string, conversationId: string) {
  const { data: rows, error: rowsError } = await admin
    .from("messages")
    .select("content,created_at")
    .eq("user_id", userId)
    .eq("session_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(12);
  if (rowsError) {
    console.warn("[synapse-action-group] recent user messages unavailable", rowsError.message);
    return { patient: null as any, amount: null as number | null };
  }

  const recentRows = rows || [];
  let amount: number | null = null;
  for (const row of recentRows) {
    amount ??= explicitAmountFromText(row?.content);
    if (amount !== null) break;
  }

  const { data: patients, error: patientsError } = await admin
    .from("patients")
    .select("id,name,status")
    .eq("user_id", userId)
    .limit(300);
  if (patientsError) {
    console.warn("[synapse-action-group] patient fallback unavailable", patientsError.message);
    return { patient: null as any, amount };
  }

  const ownedPatients = (patients || [])
    .map((patient: any) => ({ ...patient, normalizedName: normalizeLookup(patient?.name) }))
    .filter((patient: any) => patient.normalizedName);
  const firstNameOwners = new Map<string, any[]>();
  for (const patient of ownedPatients) {
    const first = patient.normalizedName.split(" ")[0];
    if (!first || first.length < 3) continue;
    firstNameOwners.set(first, [...(firstNameOwners.get(first) || []), patient]);
  }

  for (const row of recentRows) {
    const text = normalizeLookup(row?.content);
    if (!text) continue;
    const fullMatches = ownedPatients.filter((patient: any) => containsPhrase(text, patient.normalizedName));
    if (fullMatches.length === 1) return { patient: fullMatches[0], amount };
    if (fullMatches.length > 1) continue;

    const firstMatches = Array.from(firstNameOwners.entries())
      .filter(([first, owners]) => owners.length === 1 && containsPhrase(text, first))
      .map(([, owners]) => owners[0]);
    const uniqueFirstMatches = Array.from(new Map(firstMatches.map((patient: any) => [patient.id, patient])).values());
    if (uniqueFirstMatches.length === 1) return { patient: uniqueFirstMatches[0], amount };
  }

  return { patient: null as any, amount };
}

function editableFieldsFor(toolName: string, args: Record<string, any>): SynapseEditableField[] {
  const fields: SynapseEditableField[] = [];
  const push = (
    fieldId: string,
    label: string,
    type: SynapseEditableField["type"],
    value: unknown,
    options?: Array<{ value: string; label: string }>,
  ) => {
    if (value === undefined || value === null || value === "") return;
    fields.push({ fieldId, label, type, value, ...(options?.length ? { options } : {}) });
  };

  if (toolName === "create_session_note") {
    push("notes", "anotação", "text", args.notes);
  } else if (toolName === "create_appointment") {
    push("datetime", "data e horário", "text", args.datetime || args.start_time || args.startTime);
    push("duration_minutes", "duração", "number", args.duration_minutes || args.durationMinutes);
    push("price", "valor", "money", args.price || args.value_per_session);
    push("financial_mode", "financeiro", "select", args.financial_mode || args.financial?.mode, [
      { value: "none", label: "Sem financeiro" },
      { value: "manual", label: "Manual" },
      { value: "neurofinance", label: "NeuroFinance" },
      { value: "package", label: "Pacote" },
    ]);
  } else if (toolName === "reschedule_appointment") {
    push("new_datetime", "nova data e horário", "text", args.new_datetime || args.new_start_time || args.start_time);
    push("new_duration_minutes", "duração", "number", args.new_duration_minutes || args.duration_minutes);
  } else if (toolName === "create_financial_entry") {
    push("amount", "valor", "money", args.amount || args.value);
    push("description", "descrição", "text", args.description || args.title);
  } else if (toolName === "create_neurofinance_charge") {
    push("amount", "valor", "money", args.amount);
    push("due_date", "vencimento", "date", args.due_date);
    push("payment_method", "meio de pagamento", "select", args.payment_method, [
      { value: "pix", label: "Pix" },
      { value: "boleto", label: "Boleto" },
      { value: "card", label: "Cartão" },
      { value: "undefined", label: "A definir" },
    ]);
  } else if (toolName === "create_fiscal_invoice") {
    push("amount", "valor", "money", args.amount);
    push("description", "descrição", "text", args.description);
  } else if (toolName === "send_patient_email") {
    push("subject", "título", "text", args.subject);
    push("body", "corpo do e-mail", "text", args.body);
  }

  return fields;
}

function financialMode(args: Record<string, any>) {
  return clean(args.financial_mode || args.financial?.mode || args.payment_config?.financial_mode, 40).toLowerCase();
}

function riskForTool(toolName: string, args: Record<string, any>) {
  const mode = financialMode(args);
  if (/neurofinance/i.test(toolName) || mode === "neurofinance") return "neurofinance" as const;
  if (toolName === "create_fiscal_invoice") return "critical" as const;
  if (toolName === "cancel_appointment") {
    const scope = clean(args.scope || args.cancel_scope || args.series_scope, 60).toLowerCase();
    if (["series", "whole_series", "all", "from_here", "future"].includes(scope)) return "critical" as const;
  }
  return "normal" as const;
}

const AGENDA_PREFLIGHT_TOOLS = new Set([
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "create_financial_entry",
  "create_neurofinance_charge",
  "create_fiscal_invoice",
  "send_appointment_reminder",
  "send_patient_email",
]);

async function assertAgendaPreflight(admin: any, userId: string, toolName: string, args: Record<string, any>) {
  if (!AGENDA_PREFLIGHT_TOOLS.has(toolName)) return;
  const patientId = clean(args.patient_id || args.patientId, 120) || null;
  const agenda = await loadAgendaActionContext({ admin, professionalId: userId, patientId });
  if (!agenda.entitlement.canUseCurrentAccess) {
    throw new Error("O acesso atual não permite executar esta ação da Agenda.");
  }

  const mode = financialMode(args);
  if (mode === "manual") return;

  if (toolName === "create_neurofinance_charge" || mode === "neurofinance") {
    if (!agenda.neurofinance.availableByPlan) throw new Error("NeuroFinance não está disponível no plano atual. Use lançamento manual.");
    if (!agenda.neurofinance.accountExists) throw new Error("A conta NeuroFinance ainda não foi configurada. Use lançamento manual ou conclua o cadastro.");
    if (!agenda.neurofinance.allowed) {
      if (agenda.patient && agenda.patient.cpf !== "valid") {
        throw new Error("A cobrança NeuroFinance precisa de CPF válido do paciente. O lançamento manual continua disponível.");
      }
      throw new Error("A conta NeuroFinance não está operacional para cobranças agora. Use lançamento manual ou regularize a conta.");
    }
  }

  if (mode === "package" && !agenda.allowedFinancialModes.includes("package")) {
    throw new Error("Não há pacote ativo com sessão disponível para este paciente.");
  }

  if (toolName === "send_patient_email" && !agenda.google.gmail.scopePresent) {
    throw new Error("O Gmail conectado não possui escopo de envio. Reconecte o Google antes de enviar este e-mail.");
  }
}

export async function buildActionGroupSteps(input: {
  admin: any;
  userId: string;
  conversationId: string;
  rawSteps: unknown[];
}) {
  const context = await loadConversationContext(input.admin, input.userId, input.conversationId);
  const recentFacts = await recoverRecentConversationFacts(input.admin, input.userId, input.conversationId);
  const fallbackPatientName = clean(context.state.activePatientName, 180) || clean(recentFacts.patient?.name, 180);
  const steps: SynapseActionGroupStep[] = [];
  const stepIdByRawIndex = new Map<number, string>();

  for (const [index, rawValue] of input.rawSteps.entries()) {
    const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? rawValue as Record<string, any>
      : {};
    const toolName = clean(raw.tool_name || raw.toolName, 120);
    if (!toolName || ["prepare_action_group", "execute_action_group", "confirm_pending_action", "cancel_pending_action"].includes(toolName)) {
      throw new Error(`Etapa ${index + 1} sem ferramenta executável válida.`);
    }
    const policy = validateVoiceToolCall(toolName);

    if (policy.executor === "read") continue;

    const rawArgs = raw.arguments && typeof raw.arguments === "object" && !Array.isArray(raw.arguments)
      ? { ...(raw.arguments as Record<string, any>) }
      : {};

    if (
      PATIENT_SCOPED_GROUP_TOOLS.has(toolName) &&
      !clean(rawArgs.patient_id || rawArgs.patientId, 120) &&
      !clean(rawArgs.patient_name || rawArgs.patientName, 180) &&
      fallbackPatientName
    ) {
      rawArgs.patient_name = fallbackPatientName;
    }

    if (
      ["create_financial_entry", "create_neurofinance_charge", "create_fiscal_invoice"].includes(toolName) &&
      !Number(rawArgs.amount || rawArgs.value) &&
      recentFacts.amount
    ) {
      rawArgs.amount = recentFacts.amount;
    }
    if (toolName === "create_financial_entry" && !clean(rawArgs.title, 180)) {
      rawArgs.title = clean(raw.title || raw.summary, 180) || "Lançamento manual";
    }

    const enriched = await enrichToolArguments(
      input.admin,
      input.userId,
      toolName,
      rawArgs,
      context.state,
    );
    await assertAgendaPreflight(input.admin, input.userId, toolName, enriched.args);

    const order = steps.length + 1;
    const stepId = safeStepId(raw.step_id || raw.stepId, `step-${order}`);
    stepIdByRawIndex.set(index + 1, stepId);
    const dependencyIndexes = Array.isArray(raw.depends_on) ? raw.depends_on : [];
    const dependencies = dependencyIndexes
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= index)
      .map((value: number) => stepIdByRawIndex.get(value))
      .filter(Boolean) as string[];

    steps.push({
      stepId,
      order,
      area: clean(raw.area, 120) || (toolName.includes("appointment") ? "Agenda" : toolName.includes("finance") || toolName.includes("charge") ? "Financeiro" : "Ação"),
      title: clean(raw.title, 180) || `Etapa ${order}`,
      spokenSummary: clean(raw.summary || raw.spoken_summary, 600) || `Executar ${toolName.replace(/_/g, " ")}.`,
      actionType: clean(raw.action_type || toolName, 120),
      risk: riskForTool(toolName, enriched.args),
      dependencies,
      expectedEffect: clean(raw.expected_effect, 160) || (policy.executor === "interface" ? "interface" : "persist_record"),
      editableFields: editableFieldsFor(toolName, enriched.args),
      toolName,
      arguments: enriched.args,
      canonicalPlanRef: raw.canonical_plan_ref && typeof raw.canonical_plan_ref === "object"
        ? raw.canonical_plan_ref
        : undefined,
    });
  }

  if (!steps.length) {
    throw new Error("O pacote ficou sem ações executáveis depois dos preflights. Faça as consultas e prepare pelo menos uma ação para revisão.");
  }
  return steps;
}

export function rowPendingAction(row: any): PendingAction {
  return {
    kind: "synapse_pending_action",
    actionId: clean(row.plan_id, 120),
    toolName: "execute_action_group",
    arguments: {
      plan_id: row.plan_id,
      plan_version: row.plan_version,
      plan_hash: row.plan_hash,
      confirmation_policy: row.confirmation_policy,
    },
    summary: clean(row.spoken_summary || row.title, 1200) || "Executar o plano revisado.",
    status: "pending",
    createdAt: row.created_at || new Date().toISOString(),
    expiresAt: row.expires_at,
  };
}

function reviewSegments(card: any) {
  const fields = Array.isArray(card.editableFields) ? card.editableFields : [];
  return [
    { type: "text", text: clean(card.summary, 600) },
    ...fields.map((field: any) => field.type === "select" && Array.isArray(field.options)
      ? {
          type: "select",
          fieldId: clean(field.fieldId, 120),
          label: clean(field.label, 120),
          value: String(field.value ?? ""),
          options: field.options.map((option: any) => ({
            value: clean(option.value, 120),
            label: clean(option.label, 120),
          })).filter((option: any) => option.value),
        }
      : {
          type: "editable",
          fieldId: clean(field.fieldId, 120),
          label: clean(field.label, 120),
          value: field.value,
          inputMode: ["number", "money"].includes(clean(field.type, 40)) ? "decimal" : undefined,
          maxLength: field.type === "text" ? 2000 : undefined,
        }),
  ];
}

export function rowReviewClientAction(row: any) {
  const review = row.review_public && typeof row.review_public === "object" ? row.review_public : {};
  const cards = Array.isArray(review.cards) ? review.cards : [];
  return {
    type: "synapse_action_review",
    data: {
      reviewId: `${row.plan_id}:${row.plan_version}`,
      toolName: "execute_action_group",
      planId: row.plan_id,
      planVersion: row.plan_version,
      planHash: row.plan_hash,
      confirmationPolicy: row.confirmation_policy,
      actions: cards.map((card: any) => ({
        id: clean(card.id, 120),
        area: clean(card.area, 120) || "Ação",
        segments: reviewSegments(card),
      })),
    },
  };
}

export async function persistActionGroupPlan(admin: any, plan: SynapseActionGroupPlan) {
  const row = actionGroupRow(plan);
  const { data, error } = await admin
    .from("synapse_composite_action_plans")
    .insert(row)
    .select("*")
    .single();
  if (!error) return data;

  if (error.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("synapse_composite_action_plans")
      .select("*")
      .eq("professional_id", plan.professionalId)
      .eq("idempotency_key", plan.idempotencyKey)
      .eq("plan_version", plan.planVersion)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;
  }
  throw error;
}

export async function prepareAndPersistActionGroup(input: {
  admin: any;
  userId: string;
  conversationId: string;
  voiceSessionId?: string | null;
  title: string;
  intent: string;
  spokenSummary: string;
  rawSteps: unknown[];
  capabilityVersion?: number;
}) {
  const steps = await buildActionGroupSteps({
    admin: input.admin,
    userId: input.userId,
    conversationId: input.conversationId,
    rawSteps: input.rawSteps,
  });
  const plan = await prepareSynapseActionGroupPlan({
    professionalId: input.userId,
    conversationId: input.conversationId,
    voiceSessionId: input.voiceSessionId || null,
    title: clean(input.title, 180) || "Plano do Synapse",
    intent: clean(input.intent, 300) || "action_group",
    spokenSummary: clean(input.spokenSummary, 1200) || "Preparei as etapas solicitadas.",
    steps,
    capabilityVersion: Number(input.capabilityVersion) || 1,
  });
  const row = await persistActionGroupPlan(input.admin, plan);
  return { plan, row };
}

export async function loadActionGroupRow(admin: any, userId: string, planId: string, planVersion: number) {
  if (!UUID_PATTERN.test(planId)) throw new Error("plan_id inválido.");
  const { data, error } = await admin
    .from("synapse_composite_action_plans")
    .select("*")
    .eq("plan_id", planId)
    .eq("plan_version", planVersion)
    .eq("professional_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Plano composto não encontrado.");
  return data;
}

async function supersedePlan(admin: any, userId: string, planId: string, planVersion: number) {
  const { error } = await admin
    .from("synapse_composite_action_plans")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("plan_id", planId)
    .eq("plan_version", planVersion)
    .eq("professional_id", userId)
    .eq("status", "awaiting_confirmation");
  if (error) throw error;
}

export async function editPersistedActionGroup(input: {
  admin: any;
  userId: string;
  planId: string;
  planVersion: number;
  planHash: string;
  edits: Array<{ step_id?: string; field_id?: string; value?: unknown }>;
}) {
  const current = await loadActionGroupRow(input.admin, input.userId, input.planId, input.planVersion);
  if (current.plan_hash !== input.planHash) throw new Error("A revisão mudou. Use a versão atualmente visível antes de editar.");
  if (current.status !== "awaiting_confirmation") throw new Error("Somente um plano aguardando confirmação pode ser editado.");
  if (new Date(current.expires_at).getTime() <= Date.now()) throw new Error("O plano expirou; prepare uma revisão nova.");

  const steps = structuredClone(current.steps_internal || []) as SynapseActionGroupStep[];
  for (const edit of input.edits.slice(0, 30)) {
    const stepId = clean(edit.step_id, 120);
    const fieldId = clean(edit.field_id, 120);
    const step = steps.find((candidate) => candidate.stepId === stepId);
    const field = step?.editableFields?.find((candidate) => candidate.fieldId === fieldId);
    if (!step || !field) throw new Error(`Campo editável não encontrado: ${stepId}/${fieldId}.`);
    if (field.options?.length && !field.options.some((option) => option.value === String(edit.value))) {
      throw new Error(`Valor não permitido para ${field.label}.`);
    }
    field.value = edit.value;
    step.arguments = { ...step.arguments, [field.fieldId]: edit.value };
  }

  const next = await prepareSynapseActionGroupPlan({
    planId: current.plan_id,
    planVersion: current.plan_version + 1,
    professionalId: current.professional_id,
    conversationId: current.conversation_id,
    voiceSessionId: current.voice_session_id,
    title: current.title,
    intent: current.intent || "action_group",
    spokenSummary: current.spoken_summary || current.title,
    steps,
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    capabilityVersion: current.capability_version || 1,
  });
  const row = await persistActionGroupPlan(input.admin, next);
  await supersedePlan(input.admin, input.userId, input.planId, input.planVersion);
  return { plan: next, row };
}

export async function cancelPersistedActionGroup(admin: any, userId: string, row: any) {
  const { error } = await admin
    .from("synapse_composite_action_plans")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("plan_id", row.plan_id)
    .eq("plan_version", row.plan_version)
    .eq("professional_id", userId);
  if (error) throw error;
}
