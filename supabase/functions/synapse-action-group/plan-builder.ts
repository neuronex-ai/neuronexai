import {
  actionGroupRow,
  prepareSynapseActionGroupPlan,
  type SynapseActionGroupPlan,
  type SynapseActionGroupStep,
  type SynapseEditableField,
} from "../_shared/synapse-action-group.ts";
import {
  normalizeActionGroupStepIdentity,
  type ActionGroupStepIdentitySource,
} from "../_shared/synapse-action-kind.ts";
import { loadAgendaActionContext } from "../_shared/agenda-action-context.ts";
import { resolveSpokenAppointmentDateTime } from "../_shared/appointment-datetime.ts";
import { validateVoiceToolCall } from "../_shared/synapse-voice-policy.ts";
import {
  EntityResolutionError,
  enrichToolArguments,
  loadConversationContext,
  saveConversationContext,
} from "../synapse-text-fallback/entity-context.ts";
import type { PendingAction } from "../synapse-text-fallback/executor.ts";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ActionGroupPreparationErrorCode =
  | "group_step_type_missing"
  | "group_tool_not_allowed"
  | "group_no_executable_steps"
  | "patient_required"
  | "patient_not_found"
  | "patient_ambiguous"
  | "amount_required"
  | "appointment_datetime_required"
  | "integration_required"
  | "preflight_blocked"
  | "plan_validation_failed"
  | "plan_persistence_failed";

export type ActionGroupStepClassification =
  | "executable"
  | "preflight_read"
  | "invalid"
  | "unsupported"
  | "blocked";

export interface ActionGroupBuildWarning {
  index: number;
  classification: Exclude<ActionGroupStepClassification, "executable">;
  errorCode: ActionGroupPreparationErrorCode;
  source: ActionGroupStepIdentitySource | null;
  actionKind: string | null;
  canonicalTool: string | null;
  argumentKeys: string[];
  message: string;
}

export class ActionGroupPreparationError extends Error {
  code: ActionGroupPreparationErrorCode;
  failedStepIndex: number | null;
  blockedSteps: ActionGroupBuildWarning[];
  needsClarification: boolean;
  retryable = false;

  constructor(
    code: ActionGroupPreparationErrorCode,
    message: string,
    options: {
      failedStepIndex?: number | null;
      blockedSteps?: ActionGroupBuildWarning[];
      needsClarification?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "ActionGroupPreparationError";
    this.code = code;
    this.failedStepIndex = options.failedStepIndex ?? null;
    this.blockedSteps = options.blockedSteps || [];
    this.needsClarification = options.needsClarification ?? [
      "group_step_type_missing",
      "patient_required",
      "patient_not_found",
      "patient_ambiguous",
      "amount_required",
      "appointment_datetime_required",
      "integration_required",
      "preflight_blocked",
    ].includes(code);
  }
}

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
  return parseNumberWords(tokens.slice(Math.max(0, realIndex - 8), realIndex));
}

async function recoverRecentExplicitAmount(admin: any, userId: string, conversationId: string) {
  const { data: rows, error } = await admin
    .from("messages")
    .select("content,created_at")
    .eq("user_id", userId)
    .eq("session_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("[synapse-action-group] recent user messages unavailable", error.message);
    return null;
  }
  for (const row of rows || []) {
    const amount = explicitAmountFromText(row?.content);
    if (amount !== null) return amount;
  }
  return null;
}

async function recoverRecentAppointmentDateTime(admin: any, userId: string, conversationId: string) {
  const { data: rows, error } = await admin
    .from("messages")
    .select("content,created_at")
    .eq("user_id", userId)
    .eq("session_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) {
    console.warn("[synapse-action-group] recent appointment datetime unavailable", error.message);
    return null;
  }
  const row = rows?.[0];
  if (!row) return null;
  const spokenAt = new Date(row.created_at || Date.now());
  return resolveSpokenAppointmentDateTime(
    row.content,
    Number.isNaN(spokenAt.getTime()) ? new Date() : spokenAt,
  );
}

async function normalizeCreateAppointmentDateTime(input: {
  admin: any;
  userId: string;
  conversationId: string;
  utterance?: string;
  args: Record<string, any>;
}) {
  const args = { ...input.args };
  const splitDateTime = [
    clean(args.appointment_date || args.date, 80),
    clean(args.appointment_time || args.time, 80),
  ].filter(Boolean).join(" às ");
  const candidate = clean(
    args.datetime || args.start_time || args.startTime || splitDateTime,
    240,
  );
  const resolved = resolveSpokenAppointmentDateTime(candidate)
    || resolveSpokenAppointmentDateTime(input.utterance)
    || await recoverRecentAppointmentDateTime(input.admin, input.userId, input.conversationId);

  delete args.start_time;
  delete args.startTime;
  if (resolved) args.datetime = resolved;
  else delete args.datetime;
  return args;
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
    throw new ActionGroupPreparationError("preflight_blocked", "O acesso atual não permite executar esta ação da Agenda.");
  }

  const mode = financialMode(args);
  if (mode === "manual") return;

  if (toolName === "create_neurofinance_charge" || mode === "neurofinance") {
    if (!agenda.neurofinance.availableByPlan) {
      throw new ActionGroupPreparationError("integration_required", "NeuroFinance não está disponível no plano atual. Use lançamento manual.");
    }
    if (!agenda.neurofinance.accountExists) {
      throw new ActionGroupPreparationError("integration_required", "A conta NeuroFinance ainda não foi configurada. Use lançamento manual ou conclua o cadastro.");
    }
    if (!agenda.neurofinance.allowed) {
      if (agenda.patient && agenda.patient.cpf !== "valid") {
        throw new ActionGroupPreparationError("preflight_blocked", "A cobrança NeuroFinance precisa de CPF válido do paciente. O lançamento manual continua disponível.");
      }
      throw new ActionGroupPreparationError("preflight_blocked", "A conta NeuroFinance não está operacional para cobranças agora. Use lançamento manual ou regularize a conta.");
    }
  }

  if (mode === "package" && !agenda.allowedFinancialModes.includes("package")) {
    throw new ActionGroupPreparationError("preflight_blocked", "Não há pacote ativo com sessão disponível para este paciente.");
  }

  if (toolName === "send_patient_email" && !agenda.google.gmail.scopePresent) {
    throw new ActionGroupPreparationError("integration_required", "O Gmail não está conectado com permissão de envio.");
  }
}

function validateRequiredActionArguments(toolName: string, args: Record<string, any>) {
  if (["create_financial_entry", "create_neurofinance_charge", "create_fiscal_invoice"].includes(toolName)) {
    const amount = Number(args.amount ?? args.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ActionGroupPreparationError("amount_required", "Não consegui preparar o lançamento porque faltou um valor financeiro válido.");
    }
  }
  if (toolName === "create_appointment") {
    const datetime = clean(args.datetime || args.start_time || args.startTime, 120);
    if (!datetime) {
      throw new ActionGroupPreparationError("appointment_datetime_required", "Não consegui preparar o agendamento porque faltou a data e o horário.");
    }
  }
  if (toolName === "create_session_note" && !clean(args.notes, 5000)) {
    throw new ActionGroupPreparationError("plan_validation_failed", "Não consegui preparar a anotação porque faltou o texto da anotação.");
  }
  if (toolName === "send_patient_email" && (!clean(args.subject, 500) || !clean(args.body, 10000))) {
    throw new ActionGroupPreparationError("plan_validation_failed", "Não consegui preparar o e-mail porque faltou o título ou o corpo da mensagem.");
  }
}

export function normalizeActionGroupStep(rawValue: unknown, rawIndex = 0) {
  const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
    ? rawValue as Record<string, any>
    : {};
  const identity = normalizeActionGroupStepIdentity(raw);
  const args = raw.arguments && typeof raw.arguments === "object" && !Array.isArray(raw.arguments)
    ? { ...(raw.arguments as Record<string, any>) }
    : {};
  return {
    index: rawIndex + 1,
    raw,
    kind: identity.kind,
    canonicalToolName: identity.canonicalToolName,
    source: identity.source,
    rawIdentity: identity.rawIdentity,
    hasIdentityField: identity.hasIdentityField,
    args,
    argumentKeys: Object.keys(args).sort().slice(0, 80),
  };
}

function preparationErrorCode(error: unknown): ActionGroupPreparationErrorCode {
  if (error instanceof ActionGroupPreparationError) return error.code;
  if (error instanceof EntityResolutionError) {
    if (error.code === "patient_name_required") return "patient_required";
    if (error.code === "patient_ambiguous") return "patient_ambiguous";
    return "patient_not_found";
  }
  const text = clean(error instanceof Error ? error.message : error, 1200).toLowerCase();
  if (/gmail|google|integra/.test(text)) return "integration_required";
  if (/valor|amount/.test(text)) return "amount_required";
  if (/data|hor[aá]rio|datetime/.test(text)) return "appointment_datetime_required";
  return "plan_validation_failed";
}

function warningFor(
  normalized: ReturnType<typeof normalizeActionGroupStep>,
  classification: Exclude<ActionGroupStepClassification, "executable">,
  errorCode: ActionGroupPreparationErrorCode,
  message: string,
): ActionGroupBuildWarning {
  return {
    index: normalized.index,
    classification,
    errorCode,
    source: normalized.source,
    actionKind: normalized.kind,
    canonicalTool: normalized.canonicalToolName,
    argumentKeys: normalized.argumentKeys,
    message: clean(message, 600),
  };
}

async function buildActionGroupStepSet(input: {
  admin: any;
  userId: string;
  conversationId: string;
  utterance?: string;
  rawSteps: unknown[];
}) {
  const context = await loadConversationContext(input.admin, input.userId, input.conversationId);
  const recentAmount = await recoverRecentExplicitAmount(input.admin, input.userId, input.conversationId);
  const fallbackPatientName = clean(context.state.activePatientName, 180);
  const steps: SynapseActionGroupStep[] = [];
  const warnings: ActionGroupBuildWarning[] = [];
  const preflights: ActionGroupBuildWarning[] = [];
  const stepIdByRawIndex = new Map<number, string>();
  let resolvedPatient: { id?: string; name?: string } | null = null;

  for (const [index, rawValue] of input.rawSteps.entries()) {
    const normalized = normalizeActionGroupStep(rawValue, index);
    const raw = normalized.raw;
    const toolName = clean(normalized.canonicalToolName, 120);

    if (!toolName) {
      const code: ActionGroupPreparationErrorCode = normalized.hasIdentityField
        ? "group_tool_not_allowed"
        : "group_step_type_missing";
      warnings.push(warningFor(
        normalized,
        normalized.hasIdentityField ? "unsupported" : "invalid",
        code,
        normalized.hasIdentityField
          ? `Etapa ${index + 1} usa um tipo de ação não permitido.`
          : `Etapa ${index + 1} veio sem tipo de ação.`,
      ));
      continue;
    }

    if (["prepare_action_group", "execute_action_group", "confirm_pending_action", "cancel_pending_action"].includes(toolName)) {
      warnings.push(warningFor(normalized, "unsupported", "group_tool_not_allowed", `Etapa ${index + 1} usa uma ação interna não permitida.`));
      continue;
    }

    let policy: ReturnType<typeof validateVoiceToolCall>;
    try {
      policy = validateVoiceToolCall(toolName);
    } catch (error) {
      warnings.push(warningFor(
        normalized,
        "unsupported",
        "group_tool_not_allowed",
        clean(error instanceof Error ? error.message : error, 600) || `Etapa ${index + 1} não é permitida por voz.`,
      ));
      continue;
    }

    if (policy.executor === "read") {
      preflights.push(warningFor(normalized, "preflight_read", "plan_validation_failed", `Etapa ${index + 1} classificada como consulta/preflight; não vira card.`));
      continue;
    }

    let rawArgs = { ...normalized.args };
    if (toolName === "create_appointment") {
      rawArgs = await normalizeCreateAppointmentDateTime({
        admin: input.admin,
        userId: input.userId,
        conversationId: input.conversationId,
        utterance: input.utterance,
        args: rawArgs,
      });
    }
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
      recentAmount
    ) {
      rawArgs.amount = recentAmount;
    }
    if (toolName === "create_financial_entry" && !clean(rawArgs.title, 180)) {
      rawArgs.title = clean(raw.title || raw.summary, 180) || "Lançamento manual";
    }

    let enriched: Awaited<ReturnType<typeof enrichToolArguments>>;
    try {
      enriched = await enrichToolArguments(
        input.admin,
        input.userId,
        toolName,
        rawArgs,
        context.state,
      );
      validateRequiredActionArguments(toolName, enriched.args);
      await assertAgendaPreflight(input.admin, input.userId, toolName, enriched.args);
    } catch (error) {
      const code = preparationErrorCode(error);
      const message = clean(error instanceof Error ? error.message : error, 1200) || "A etapa foi bloqueada durante a validação.";
      const blocked = warningFor(normalized, "blocked", code, message);
      throw new ActionGroupPreparationError(code, message, {
        failedStepIndex: index + 1,
        blockedSteps: [...warnings, blocked],
        needsClarification: error instanceof ActionGroupPreparationError
          ? error.needsClarification
          : true,
      });
    }

    if (enriched.patient?.id) {
      resolvedPatient = { id: enriched.patient.id, name: enriched.patient.name };
      context.state.activePatientId = enriched.patient.id;
      context.state.activePatientName = enriched.patient.name;
    }

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
      area: clean(raw.area, 120) || (toolName.includes("appointment") ? "Agenda" : toolName.includes("finance") || toolName.includes("charge") ? "Financeiro" : toolName === "request_interface_action" ? "Interface" : "Ação"),
      title: clean(raw.title, 180) || `Etapa ${order}`,
      spokenSummary: clean(raw.summary || raw.spoken_summary, 600) || `Preparar ${String(normalized.kind || toolName).replace(/_/g, " ")}.`,
      actionType: clean(normalized.kind || toolName, 120),
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

  if (resolvedPatient?.id) {
    await saveConversationContext(input.admin, input.userId, input.conversationId, context.state);
  }

  if (!steps.length) {
    const first = warnings[0];
    throw new ActionGroupPreparationError(
      first?.errorCode || "group_no_executable_steps",
      first?.message || "O pacote ficou sem ações executáveis depois dos preflights. Faça as consultas e prepare pelo menos uma ação para revisão.",
      {
        failedStepIndex: first?.index || null,
        blockedSteps: warnings,
        needsClarification: Boolean(first),
      },
    );
  }

  return { steps, warnings, preflights };
}

export async function buildActionGroupSteps(input: {
  admin: any;
  userId: string;
  conversationId: string;
  rawSteps: unknown[];
}) {
  return (await buildActionGroupStepSet(input)).steps;
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
      warnings: Array.isArray(review.warnings) ? review.warnings : [],
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
    if (existingError) throw new ActionGroupPreparationError("plan_persistence_failed", existingError.message);
    if (existing) return existing;
  }
  throw new ActionGroupPreparationError("plan_persistence_failed", clean(error.message, 1200) || "Não consegui persistir a revisão do plano.");
}

export async function prepareAndPersistActionGroup(input: {
  admin: any;
  userId: string;
  conversationId: string;
  voiceSessionId?: string | null;
  utterance?: string;
  title: string;
  intent: string;
  spokenSummary: string;
  rawSteps: unknown[];
  capabilityVersion?: number;
}) {
  const built = await buildActionGroupStepSet({
    admin: input.admin,
    userId: input.userId,
    conversationId: input.conversationId,
    utterance: input.utterance,
    rawSteps: input.rawSteps,
  });
  let plan: SynapseActionGroupPlan;
  try {
    plan = await prepareSynapseActionGroupPlan({
      professionalId: input.userId,
      conversationId: input.conversationId,
      voiceSessionId: input.voiceSessionId || null,
      title: clean(input.title, 180) || "Plano do Synapse",
      intent: clean(input.intent, 300) || "action_group",
      spokenSummary: clean(input.spokenSummary, 1200) || "Preparei as etapas solicitadas.",
      steps: built.steps,
      capabilityVersion: Number(input.capabilityVersion) || 1,
    });
  } catch (error) {
    throw new ActionGroupPreparationError(
      preparationErrorCode(error),
      clean(error instanceof Error ? error.message : error, 1200) || "A validação do plano falhou.",
    );
  }

  if (built.warnings.length) {
    (plan.reviewPublic as any).warnings = built.warnings;
  }
  if (built.preflights.length) {
    (plan.reviewPublic as any).preflights = built.preflights.map((item) => ({
      index: item.index,
      classification: item.classification,
      canonicalTool: item.canonicalTool,
      source: item.source,
    }));
  }

  const row = await persistActionGroupPlan(input.admin, plan);
  return { plan, row, warnings: built.warnings, preflights: built.preflights };
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
