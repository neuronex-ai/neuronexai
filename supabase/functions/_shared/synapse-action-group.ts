export type SynapseActionRisk = "normal" | "critical" | "neurofinance";
export type SynapseConfirmationPolicy = "direct" | "voice" | "opaque";
export type SynapseActionGroupStatus =
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "partially_completed"
  | "manual_review_required"
  | "cancelled"
  | "superseded"
  | "expired";

export type SynapseEditableFieldType = "text" | "money" | "date" | "time" | "select" | "number";

export interface SynapseEditableField {
  fieldId: string;
  label: string;
  type: SynapseEditableFieldType;
  value: unknown;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
}

export interface SynapseActionGroupStep {
  stepId: string;
  order: number;
  area: string;
  title: string;
  spokenSummary: string;
  actionType: string;
  risk: SynapseActionRisk;
  dependencies: string[];
  expectedEffect: string;
  editableFields: SynapseEditableField[];
  toolName: string;
  arguments: Record<string, unknown>;
  canonicalPlanRef?: {
    kind: "appointment" | "finance" | "document" | "communication" | "interface" | "other";
    id: string;
    version?: number;
    hash?: string;
  };
}

export interface SynapseActionGroupPlanDraft {
  planId?: string;
  planVersion?: number;
  professionalId: string;
  conversationId: string;
  voiceSessionId?: string | null;
  title: string;
  intent: string;
  spokenSummary: string;
  steps: SynapseActionGroupStep[];
  expiresAt?: string;
  capabilityVersion?: number;
}

export interface SynapseActionGroupReviewCard {
  id: string;
  order: number;
  area: string;
  title: string;
  summary: string;
  risk: SynapseActionRisk;
  editableFields: SynapseEditableField[];
}

export interface SynapseActionGroupReviewPublic {
  type: "synapse_action_group_review";
  planId: string;
  planVersion: number;
  planHash: string;
  title: string;
  spokenSummary: string;
  confirmationPolicy: SynapseConfirmationPolicy;
  riskLevel: SynapseActionRisk;
  stepCount: number;
  cards: SynapseActionGroupReviewCard[];
  expiresAt: string;
}

export interface SynapseActionGroupPlan {
  planId: string;
  planVersion: number;
  planHash: string;
  idempotencyKey: string;
  professionalId: string;
  conversationId: string;
  voiceSessionId: string | null;
  title: string;
  intent: string;
  spokenSummary: string;
  confirmationPolicy: SynapseConfirmationPolicy;
  riskLevel: SynapseActionRisk;
  status: SynapseActionGroupStatus;
  steps: SynapseActionGroupStep[];
  reviewPublic: SynapseActionGroupReviewPublic;
  expiresAt: string;
  capabilityVersion: number;
}

export interface SynapseActionGroupStepResult {
  stepId: string;
  status: "completed" | "failed" | "queued" | "skipped";
  message: string;
  primaryCommitted?: boolean;
  recordId?: string | null;
  warning?: string | null;
}

export interface ExecuteActionGroupResult {
  status: "completed" | "completed_with_warnings" | "failed" | "partially_completed";
  primaryCommitted: boolean;
  spokenSummary: string;
  steps: SynapseActionGroupStepResult[];
  effects: Array<{
    kind: string;
    status: "queued" | "completed" | "failed";
    message: string;
  }>;
  nextVisualAction?: Record<string, unknown> | null;
}

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeForHash = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, normalizeForHash(nested)]),
  );
};

export const stableJson = (value: unknown) => JSON.stringify(normalizeForHash(value));

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function resolveActionGroupRisk(steps: SynapseActionGroupStep[]): SynapseActionRisk {
  if (steps.some((step) => step.risk === "neurofinance")) return "neurofinance";
  if (steps.some((step) => step.risk === "critical")) return "critical";
  return "normal";
}

/**
 * Action groups are an explicit review surface. Small normal mutations that do
 * not need review stay on their individual tool path and never enter this
 * planner. Once prepare_action_group is chosen, the professional must always
 * see the versioned mini-card review before execution. Critical/NeuroFinance
 * groups additionally require the browser-only opaque challenge.
 */
export function resolveConfirmationPolicy(
  steps: SynapseActionGroupStep[],
): SynapseConfirmationPolicy {
  const risk = resolveActionGroupRisk(steps);
  if (risk === "critical" || risk === "neurofinance") return "opaque";
  return "voice";
}

export function validateActionGroupSteps(steps: SynapseActionGroupStep[]) {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 12) {
    throw new Error("O plano composto deve ter entre 1 e 12 etapas solicitadas pelo profissional.");
  }

  const ids = new Set<string>();
  for (const [index, step] of steps.entries()) {
    const id = clean(step.stepId, 120);
    if (!id || ids.has(id)) throw new Error("Cada etapa precisa de um identificador único.");
    ids.add(id);
    if (step.order !== index + 1) throw new Error("As etapas precisam estar ordenadas de forma contínua.");
    if (!clean(step.area, 120) || !clean(step.title, 180) || !clean(step.spokenSummary, 600)) {
      throw new Error("Cada etapa precisa de área, título e resumo falado.");
    }
    if (!clean(step.toolName, 120)) throw new Error("Cada etapa executável precisa de ferramenta canônica.");
  }

  for (const step of steps) {
    for (const dependency of step.dependencies || []) {
      if (!ids.has(dependency) || dependency === step.stepId) {
        throw new Error("Dependência de etapa inválida.");
      }
    }
  }
}

function sanitizeEditableField(field: SynapseEditableField): SynapseEditableField {
  const options = Array.isArray(field.options)
    ? field.options.slice(0, 30).map((option) => ({
        value: clean(option.value, 120),
        label: clean(option.label, 120),
      })).filter((option) => option.value && option.label)
    : undefined;
  return {
    fieldId: clean(field.fieldId, 120),
    label: clean(field.label, 120),
    type: field.type,
    value: typeof field.value === "string" ? clean(field.value, field.maxLength || 1000) : field.value,
    ...(options?.length ? { options } : {}),
    ...(Number.isFinite(Number(field.maxLength)) ? { maxLength: Math.max(1, Math.min(5000, Number(field.maxLength))) } : {}),
  };
}

export function publicReviewCards(steps: SynapseActionGroupStep[]): SynapseActionGroupReviewCard[] {
  return steps.map((step) => ({
    id: clean(step.stepId, 120),
    order: step.order,
    area: clean(step.area, 120),
    title: clean(step.title, 180),
    summary: clean(step.spokenSummary, 600),
    risk: step.risk,
    editableFields: (step.editableFields || []).map(sanitizeEditableField),
  }));
}

function executablePlanForHash(input: {
  planId: string;
  planVersion: number;
  professionalId: string;
  conversationId: string;
  title: string;
  intent: string;
  spokenSummary: string;
  steps: SynapseActionGroupStep[];
  expiresAt: string;
  capabilityVersion: number;
}) {
  return {
    planId: input.planId,
    planVersion: input.planVersion,
    professionalId: input.professionalId,
    conversationId: input.conversationId,
    title: input.title,
    intent: input.intent,
    spokenSummary: input.spokenSummary,
    expiresAt: input.expiresAt,
    capabilityVersion: input.capabilityVersion,
    steps: input.steps.map((step) => ({
      stepId: step.stepId,
      order: step.order,
      actionType: step.actionType,
      risk: step.risk,
      dependencies: step.dependencies || [],
      expectedEffect: step.expectedEffect,
      editableFields: step.editableFields || [],
      toolName: step.toolName,
      arguments: step.arguments,
      canonicalPlanRef: step.canonicalPlanRef || null,
    })),
  };
}

export async function prepareSynapseActionGroupPlan(
  draft: SynapseActionGroupPlanDraft,
): Promise<SynapseActionGroupPlan> {
  validateActionGroupSteps(draft.steps);
  const professionalId = clean(draft.professionalId, 120);
  const conversationId = clean(draft.conversationId, 120);
  if (!UUID_PATTERN.test(professionalId) || !UUID_PATTERN.test(conversationId)) {
    throw new Error("Plano composto sem identidade de profissional/conversa válida.");
  }

  const planId = clean(draft.planId, 120) || crypto.randomUUID();
  if (!UUID_PATTERN.test(planId)) throw new Error("planId inválido.");
  const planVersion = Math.max(1, Math.min(100, Number(draft.planVersion) || 1));
  const title = clean(draft.title, 180);
  const intent = clean(draft.intent, 300);
  const spokenSummary = clean(draft.spokenSummary, 1200);
  if (!title || !intent || !spokenSummary) throw new Error("Plano composto sem título, intenção ou resumo falado.");

  const expiresAt = draft.expiresAt || new Date(Date.now() + 20 * 60_000).toISOString();
  if (new Date(expiresAt).getTime() <= Date.now()) throw new Error("Plano composto expirado antes de ser preparado.");
  const capabilityVersion = Math.max(1, Math.min(100, Number(draft.capabilityVersion) || 1));
  const riskLevel = resolveActionGroupRisk(draft.steps);
  const confirmationPolicy = resolveConfirmationPolicy(draft.steps);

  const executable = executablePlanForHash({
    planId,
    planVersion,
    professionalId,
    conversationId,
    title,
    intent,
    spokenSummary,
    steps: draft.steps,
    expiresAt,
    capabilityVersion,
  });
  const planHash = await sha256Hex(stableJson(executable));
  const idempotencyKey = await sha256Hex(stableJson({
    professionalId,
    conversationId,
    intent,
    commandShape: draft.steps.map((step) => ({
      actionType: step.actionType,
      toolName: step.toolName,
      dependencies: step.dependencies || [],
      canonicalPlanRef: step.canonicalPlanRef || null,
    })),
  }));
  const reviewPublic: SynapseActionGroupReviewPublic = {
    type: "synapse_action_group_review",
    planId,
    planVersion,
    planHash,
    title,
    spokenSummary,
    confirmationPolicy,
    riskLevel,
    stepCount: draft.steps.length,
    cards: publicReviewCards(draft.steps),
    expiresAt,
  };

  return {
    planId,
    planVersion,
    planHash,
    idempotencyKey,
    professionalId,
    conversationId,
    voiceSessionId: clean(draft.voiceSessionId, 120) || null,
    title,
    intent,
    spokenSummary,
    confirmationPolicy,
    riskLevel,
    status: "awaiting_confirmation",
    steps: draft.steps,
    reviewPublic,
    expiresAt,
    capabilityVersion,
  };
}

export function actionGroupRow(plan: SynapseActionGroupPlan) {
  return {
    plan_id: plan.planId,
    plan_version: plan.planVersion,
    plan_hash: plan.planHash,
    idempotency_key: plan.idempotencyKey,
    professional_id: plan.professionalId,
    conversation_id: plan.conversationId,
    voice_session_id: plan.voiceSessionId,
    title: plan.title,
    intent: plan.intent,
    spoken_summary: plan.spokenSummary,
    status: plan.status,
    confirmation_policy: plan.confirmationPolicy,
    risk_level: plan.riskLevel,
    // capability_version is intentionally omitted from the PostgREST write payload.
    // The current schema defines DEFAULT 1, while the runtime keeps the version in
    // the signed/hashable plan. This avoids PGRST schema-cache failures after the
    // column is added but before the Data API cache has refreshed.
    step_count: plan.steps.length,
    steps_internal: plan.steps,
    review_public: plan.reviewPublic,
    expires_at: plan.expiresAt,
  };
}

export function nextGroupStatus(results: SynapseActionGroupStepResult[]): ExecuteActionGroupResult["status"] {
  const completed = results.filter((result) => result.status === "completed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const queued = results.filter((result) => result.status === "queued").length;
  if (failed === 0 && queued === 0 && completed === results.length) return "completed";
  if (failed === 0 && completed > 0 && queued > 0) return "completed_with_warnings";
  if (completed === 0) return "failed";
  return "partially_completed";
}
