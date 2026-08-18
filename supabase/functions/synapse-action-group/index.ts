import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  actionGroupRow,
  nextGroupStatus,
  prepareSynapseActionGroupPlan,
  type ExecuteActionGroupResult,
  type SynapseActionGroupPlan,
  type SynapseActionGroupStep,
  type SynapseActionGroupStepResult,
  type SynapseEditableField,
} from "../_shared/synapse-action-group.ts";
import { validateVoiceToolCall } from "../_shared/synapse-voice-policy.ts";
import {
  enrichToolArguments,
  loadConversationContext,
  saveConversationContext,
  updateContextFromResult,
} from "../synapse-text-fallback/entity-context.ts";
import {
  executeAgentToolV3,
  executeConfirmedMutationV3,
} from "../synapse-text-fallback/executor-v3.ts";
import type { PendingAction } from "../synapse-text-fallback/executor.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-synapse-gateway-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (payload: Record<string, unknown>, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
});

function adminClient() {
  const url = clean(Deno.env.get("SUPABASE_URL"), 1000);
  const service = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), 8000);
  if (!url || !service) throw new Error("Supabase server-side não configurado.");
  return createClient(url, service, { auth: { persistSession: false } });
}

function expectedGatewaySecret() {
  return clean(Deno.env.get("SYNAPSE_VOICE_GATEWAY_SECRET"), 4000);
}

function assertGatewaySecret(req: Request) {
  const expected = expectedGatewaySecret();
  const supplied = clean(req.headers.get("x-synapse-gateway-secret"), 4000);
  if (!expected || !supplied || supplied !== expected) throw new Error("Gateway não autorizado.");
}

async function authenticatedUser(req: Request, admin: ReturnType<typeof adminClient>) {
  const auth = clean(req.headers.get("Authorization"), 8000);
  if (!auth.startsWith("Bearer ")) throw new Error("Sessão ausente.");
  const { data, error } = await admin.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new Error("Sessão inválida.");
  return data.user;
}

async function assertConversationOwnership(admin: any, userId: string, conversationId: string) {
  if (!UUID_PATTERN.test(conversationId)) throw new Error("Conversa inválida.");
  const { data, error } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Conversa não encontrada para este profissional.");
}

const safeStepId = (value: unknown, fallback: string) => {
  const id = clean(value, 120);
  if (id && /^[a-zA-Z0-9_-]{2,120}$/.test(id)) return id;
  return fallback;
};

function editableFieldsFor(toolName: string, args: Record<string, unknown>): SynapseEditableField[] {
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
    push("financial_mode", "financeiro", "select", args.financial_mode || (args.financial as any)?.mode, [
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

async function buildSteps(input: {
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
    if (!toolName || ["prepare_action_group", "confirm_pending_action", "cancel_pending_action"].includes(toolName)) {
      throw new Error(`Etapa ${index + 1} sem ferramenta executável válida.`);
    }
    const policy = validateVoiceToolCall(toolName);
    if (policy.executor === "read") {
      throw new Error(`A etapa ${index + 1} usa ${toolName}, que é consulta/preflight e não deve contar como etapa executável.`);
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

function toLegacyReviewAction(plan: SynapseActionGroupPlan) {
  return {
    type: "synapse_action_review",
    data: {
      reviewId: `${plan.planId}:${plan.planVersion}`,
      toolName: "execute_action_group",
      planId: plan.planId,
      planVersion: plan.planVersion,
      planHash: plan.planHash,
      confirmationPolicy: plan.confirmationPolicy,
      actions: plan.reviewPublic.cards.map((card) => ({
        id: card.id,
        area: card.area,
        segments: [
          { type: "text", text: card.summary },
        ],
      })),
    },
  };
}

function pendingActionFor(plan: SynapseActionGroupPlan): PendingAction {
  return {
    kind: "synapse_pending_action",
    actionId: plan.planId,
    toolName: "execute_action_group",
    arguments: {
      plan_id: plan.planId,
      plan_version: plan.planVersion,
      plan_hash: plan.planHash,
      confirmation_policy: plan.confirmationPolicy,
    },
    summary: plan.spokenSummary,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: plan.expiresAt,
  };
}

async function persistPlan(admin: any, plan: SynapseActionGroupPlan) {
  const row = actionGroupRow(plan);
  const { error } = await admin.from("synapse_composite_action_plans").insert(row);
  if (error) {
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
  return row;
}

async function loadPlan(admin: any, userId: string, planId: string, planVersion: number) {
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

async function editPlan(input: {
  admin: any;
  userId: string;
  planId: string;
  planVersion: number;
  planHash: string;
  edits: Array<{ step_id?: string; field_id?: string; value?: unknown }>;
}) {
  const current = await loadPlan(input.admin, input.userId, input.planId, input.planVersion);
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
  await persistPlan(input.admin, next);
  await supersedePlan(input.admin, input.userId, input.planId, input.planVersion);
  return next;
}

function resultWarning(result: any) {
  const warnings = Array.isArray(result?.data?.warnings)
    ? result.data.warnings
    : Array.isArray(result?.warnings)
      ? result.warnings
      : [];
  return warnings.map((value: unknown) => clean(value, 500)).filter(Boolean).join("; ") || null;
}

async function saveExecutionState(admin: any, row: any, resultInternal: Record<string, unknown>, status: string) {
  const { error } = await admin
    .from("synapse_composite_action_plans")
    .update({
      result_internal: resultInternal,
      status,
      updated_at: new Date().toISOString(),
      ...(status === "completed" || status === "completed_with_warnings" || status === "failed" || status === "partially_completed"
        ? { executed_at: new Date().toISOString() }
        : {}),
    })
    .eq("plan_id", row.plan_id)
    .eq("plan_version", row.plan_version)
    .eq("professional_id", row.professional_id);
  if (error) throw error;
}

async function executePlan(input: {
  admin: any;
  userId: string;
  row: any;
  confirmation: "direct" | "voice" | "opaque";
}) {
  const row = input.row;
  if (row.plan_hash !== clean(row.plan_hash, 64) || !/^[a-f0-9]{64}$/i.test(row.plan_hash)) throw new Error("Hash do plano inválido.");
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await saveExecutionState(input.admin, row, row.result_internal || {}, "expired");
    throw new Error("O plano expirou. Prepare uma revisão nova antes de executar.");
  }
  if (row.status === "completed" || row.status === "completed_with_warnings") return row.result_internal;
  if (!["awaiting_confirmation", "executing", "partially_completed"].includes(row.status)) {
    throw new Error(`Plano não executável no estado ${row.status}.`);
  }
  if (row.confirmation_policy === "voice" && input.confirmation !== "voice") throw new Error("Este plano exige confirmação explícita por voz.");
  if (row.confirmation_policy === "opaque" && input.confirmation !== "opaque") throw new Error("Este plano exige confirmação opaca concluída no navegador.");

  const steps = (row.steps_internal || []) as SynapseActionGroupStep[];
  const previous = row.result_internal && typeof row.result_internal === "object" ? row.result_internal : {};
  const persistedResults = Array.isArray(previous.stepResults) ? previous.stepResults as SynapseActionGroupStepResult[] : [];
  const results = new Map(persistedResults.map((result) => [result.stepId, result]));
  const visualActions: Record<string, unknown>[] = Array.isArray(previous.nextVisualActions) ? previous.nextVisualActions : [];
  const effects: ExecuteActionGroupResult["effects"] = Array.isArray(previous.effects) ? previous.effects : [];
  let state = (await loadConversationContext(input.admin, input.userId, row.conversation_id)).state;

  await saveExecutionState(input.admin, row, { ...previous, stepResults: [...results.values()], nextVisualActions: visualActions, effects }, "executing");

  for (const step of steps) {
    if (results.get(step.stepId)?.status === "completed") continue;
    const dependencyFailed = (step.dependencies || []).some((dependency) => results.get(dependency)?.status !== "completed");
    if (dependencyFailed) {
      results.set(step.stepId, {
        stepId: step.stepId,
        status: "skipped",
        message: "Etapa não executada porque uma dependência anterior não concluiu.",
      });
      continue;
    }

    try {
      const policy = validateVoiceToolCall(step.toolName);
      const toolContext = {
        admin: input.admin,
        userId: input.userId,
        sessionId: row.conversation_id,
        channel: "voice" as const,
        voiceSessionId: row.voice_session_id,
        toolCallId: `${row.plan_id}:${row.plan_version}:${step.stepId}`,
        correlationId: `${row.plan_id}:${row.plan_version}`,
        state,
      };
      let result: any;
      if (policy.executor === "mutation") {
        const pending: PendingAction = {
          kind: "synapse_pending_action",
          actionId: `${row.plan_id}:${step.stepId}`,
          toolName: step.toolName,
          arguments: step.arguments,
          summary: step.spokenSummary,
          status: "executing",
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        };
        result = await executeConfirmedMutationV3(pending, toolContext as any);
      } else {
        result = await executeAgentToolV3(step.toolName, step.arguments, toolContext as any);
      }

      if (!result?.ok) throw new Error(clean(result?.error || result?.message, 800) || "Etapa falhou sem resultado confiável.");
      state = updateContextFromResult(state, step.toolName, step.arguments, result);
      await saveConversationContext(input.admin, input.userId, row.conversation_id, state);
      if (result.clientAction && typeof result.clientAction === "object") visualActions.push(result.clientAction);
      const warning = resultWarning(result);
      const rawEffects = Array.isArray(result?.data?.effects) ? result.data.effects : [];
      for (const effect of rawEffects) {
        if (!effect || typeof effect !== "object") continue;
        effects.push({
          kind: clean((effect as any).kind || (effect as any).type, 120) || "external_effect",
          status: ["queued", "completed", "failed"].includes(clean((effect as any).status, 40))
            ? clean((effect as any).status, 40) as "queued" | "completed" | "failed"
            : "queued",
          message: clean((effect as any).message, 500) || "Efeito externo registrado.",
        });
      }
      results.set(step.stepId, {
        stepId: step.stepId,
        status: "completed",
        message: clean(result.message || result.data?.spoken_summary || step.spokenSummary, 800) || step.spokenSummary,
        primaryCommitted: result?.data?.primary_committed !== false,
        recordId: clean(result?.data?.id || result?.data?.appointment?.id || result?.data?.charge?.id || result?.data?.invoice?.id, 120) || null,
        warning,
      });
    } catch (error) {
      results.set(step.stepId, {
        stepId: step.stepId,
        status: "failed",
        message: clean(error instanceof Error ? error.message : error, 800) || "Etapa falhou.",
        primaryCommitted: false,
      });
    }

    await saveExecutionState(input.admin, row, {
      stepResults: [...results.values()],
      nextVisualActions: visualActions,
      effects,
    }, "executing");
  }

  const stepResults = [...results.values()].sort((left, right) => {
    const leftOrder = steps.find((step) => step.stepId === left.stepId)?.order || 999;
    const rightOrder = steps.find((step) => step.stepId === right.stepId)?.order || 999;
    return leftOrder - rightOrder;
  });
  const status = nextGroupStatus(stepResults);
  const completed = stepResults.filter((result) => result.status === "completed").length;
  const failed = stepResults.filter((result) => result.status === "failed").length;
  const queuedEffects = effects.filter((effect) => effect.status === "queued").length;
  const primaryCommitted = stepResults.some((result) => result.status === "completed" && result.primaryCommitted !== false);
  const spokenSummary = status === "completed"
    ? `Concluí as ${completed} etapas do plano.`
    : status === "completed_with_warnings"
      ? `Concluí ${completed} etapas. ${queuedEffects} efeito externo ficou pendente.`
      : status === "partially_completed"
        ? `Concluí ${completed} etapas e ${failed} falharam. O que foi concluído foi preservado.`
        : "Nenhuma etapa do plano foi concluída com segurança.";

  const finalResult: ExecuteActionGroupResult = {
    status,
    primaryCommitted,
    spokenSummary,
    steps: stepResults,
    effects,
    nextVisualAction: visualActions[visualActions.length - 1] || null,
  };
  await saveExecutionState(input.admin, row, {
    ...finalResult,
    stepResults,
    nextVisualActions: visualActions,
  }, status);
  return finalResult;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    assertGatewaySecret(req);
    const admin = adminClient();
    const user = await authenticatedUser(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action, 80);

    if (action === "prepare") {
      const conversationId = clean(body?.conversationId || body?.sessionId, 120);
      await assertConversationOwnership(admin, user.id, conversationId);
      const rawSteps = Array.isArray(body?.steps) ? body.steps.slice(0, 12) : [];
      const steps = await buildSteps({ admin, userId: user.id, conversationId, rawSteps });
      const plan = await prepareSynapseActionGroupPlan({
        professionalId: user.id,
        conversationId,
        voiceSessionId: clean(body?.voiceSessionId, 120) || null,
        title: clean(body?.title, 180) || "Plano do Synapse",
        intent: clean(body?.intent, 300) || "action_group",
        spokenSummary: clean(body?.spokenSummary || body?.summary, 1200) || "Preparei as etapas solicitadas para revisão.",
        steps,
        capabilityVersion: Number(body?.capabilityVersion) || 1,
      });
      const persisted = await persistPlan(admin, plan);
      return json({
        ok: true,
        plan: plan.reviewPublic,
        pendingAction: pendingActionFor(plan),
        clientAction: toLegacyReviewAction(plan),
        idempotent: persisted.plan_hash === plan.planHash,
      });
    }

    if (action === "edit") {
      const planId = clean(body?.planId || body?.plan_id, 120);
      const planVersion = Number(body?.planVersion || body?.plan_version);
      const planHash = clean(body?.planHash || body?.plan_hash, 64);
      const edits = Array.isArray(body?.edits) ? body.edits : [];
      const next = await editPlan({ admin, userId: user.id, planId, planVersion, planHash, edits });
      return json({ ok: true, plan: next.reviewPublic, pendingAction: pendingActionFor(next), clientAction: toLegacyReviewAction(next) });
    }

    if (action === "get") {
      const row = await loadPlan(admin, user.id, clean(body?.planId || body?.plan_id, 120), Number(body?.planVersion || body?.plan_version));
      return json({ ok: true, plan: row.review_public, status: row.status, result: row.result_internal });
    }

    if (action === "cancel") {
      const row = await loadPlan(admin, user.id, clean(body?.planId || body?.plan_id, 120), Number(body?.planVersion || body?.plan_version));
      const { error } = await admin.from("synapse_composite_action_plans").update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("plan_id", row.plan_id).eq("plan_version", row.plan_version).eq("professional_id", user.id);
      if (error) throw error;
      return json({ ok: true, status: "cancelled" });
    }

    if (action === "execute") {
      const planId = clean(body?.planId || body?.plan_id, 120);
      const planVersion = Number(body?.planVersion || body?.plan_version);
      const planHash = clean(body?.planHash || body?.plan_hash, 64);
      const row = await loadPlan(admin, user.id, planId, planVersion);
      if (row.plan_hash !== planHash) throw new Error("A versão/hash confirmados não correspondem ao plano atual.");
      const confirmation = clean(body?.confirmation, 20) as "direct" | "voice" | "opaque";
      const result = await executePlan({ admin, userId: user.id, row, confirmation });
      return json({ ok: result.status !== "failed", result });
    }

    return json({ error: "Ação de plano composto inválida." }, 400);
  } catch (error) {
    const message = clean(error instanceof Error ? error.message : error, 1200) || "Falha no plano composto.";
    const authError = /Sessão|Gateway não autorizado/i.test(message);
    console.error("[synapse-action-group]", message);
    return json({ error: message }, authError ? 401 : 400);
  }
});
