import {
  actionGroupRow,
  prepareSynapseActionGroupPlan,
  type SynapseActionGroupPlan,
  type SynapseActionGroupStep,
  type SynapseEditableField,
} from "../_shared/synapse-action-group.ts";
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

  if (toolName === "create_appointment") {
    push("start_time", "horário", "time", args.start_time || args.startTime);
    push("duration_minutes", "duração", "number", args.duration_minutes || args.durationMinutes);
    push("price", "valor", "money", args.price);
    push("financial_mode", "financeiro", "select", args.financial_mode || args.financial?.mode, [
      { value: "manual", label: "Manual" },
      { value: "neurofinance", label: "NeuroFinance" },
      { value: "package", label: "Pacote" },
    ]);
  } else if (toolName === "reschedule_appointment") {
    push("new_start_time", "novo horário", "time", args.new_start_time || args.start_time);
    push("duration_minutes", "duração", "number", args.duration_minutes);
  } else if (toolName === "create_financial_entry") {
    push("amount", "valor", "money", args.amount || args.value);
    push("description", "descrição", "text", args.description);
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

function riskForTool(toolName: string, riskLevel: string) {
  if (/neurofinance/i.test(toolName)) return "neurofinance" as const;
  if (riskLevel === "high") return "critical" as const;
  return "normal" as const;
}

export async function buildActionGroupSteps(input: {
  admin: any;
  userId: string;
  conversationId: string;
  rawSteps: unknown[];
}) {
  const context = await loadConversationContext(input.admin, input.userId, input.conversationId);
  const steps: SynapseActionGroupStep[] = [];

  for (const [index, rawValue] of input.rawSteps.entries()) {
    const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? rawValue as Record<string, any>
      : {};
    const toolName = clean(raw.tool_name || raw.toolName, 120);
    if (!toolName || ["prepare_action_group", "execute_action_group", "confirm_pending_action", "cancel_pending_action"].includes(toolName)) {
      throw new Error(`Etapa ${index + 1} sem ferramenta executável válida.`);
    }
    const policy = validateVoiceToolCall(toolName);
    if (policy.executor === "read") {
      throw new Error(`A etapa ${index + 1} usa ${toolName}, que é consulta/preflight e não conta como etapa executável.`);
    }

    const rawArgs = raw.arguments && typeof raw.arguments === "object" && !Array.isArray(raw.arguments)
      ? raw.arguments as Record<string, any>
      : {};
    const enriched = await enrichToolArguments(
      input.admin,
      input.userId,
      toolName,
      rawArgs,
      context.state,
    );
    const stepId = safeStepId(raw.step_id || raw.stepId, `step-${index + 1}`);
    const dependencyIndexes = Array.isArray(raw.depends_on) ? raw.depends_on : [];
    const dependencies = dependencyIndexes
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= index)
      .map((value: number) => steps[value - 1]?.stepId)
      .filter(Boolean) as string[];

    steps.push({
      stepId,
      order: index + 1,
      area: clean(raw.area, 120) || (toolName.includes("appointment") ? "Agenda" : toolName.includes("finance") || toolName.includes("charge") ? "Financeiro" : "Ação"),
      title: clean(raw.title, 180) || `Etapa ${index + 1}`,
      spokenSummary: clean(raw.summary || raw.spoken_summary, 600) || `Executar ${toolName.replace(/_/g, " ")}.`,
      actionType: clean(raw.action_type || toolName, 120),
      risk: riskForTool(toolName, policy.riskLevel),
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
        segments: [{ type: "text", text: clean(card.summary, 600) }],
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
