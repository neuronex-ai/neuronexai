import {
  nextGroupStatus,
  type ExecuteActionGroupResult,
  type SynapseActionGroupStep,
  type SynapseActionGroupStepResult,
} from "../_shared/synapse-action-group.ts";
import { validateVoiceToolCall } from "../_shared/synapse-voice-policy.ts";
import {
  loadConversationContext,
  saveConversationContext,
  updateContextFromResult,
} from "../synapse-text-fallback/entity-context.ts";
import {
  executeAgentToolV3,
  executeConfirmedMutationV3,
} from "../synapse-text-fallback/executor-v3.ts";
import type { PendingAction } from "../synapse-text-fallback/executor.ts";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

function resultWarning(result: any) {
  const warnings = Array.isArray(result?.data?.warnings)
    ? result.data.warnings
    : Array.isArray(result?.warnings)
      ? result.warnings
      : [];
  return warnings.map((value: unknown) => clean(value, 500)).filter(Boolean).join("; ") || null;
}

async function saveExecutionState(admin: any, row: any, resultInternal: Record<string, unknown>, status: string) {
  const terminal = ["completed", "completed_with_warnings", "failed", "partially_completed"].includes(status);
  const { error } = await admin
    .from("synapse_composite_action_plans")
    .update({
      result_internal: resultInternal,
      status,
      updated_at: new Date().toISOString(),
      ...(terminal ? { executed_at: new Date().toISOString() } : {}),
    })
    .eq("plan_id", row.plan_id)
    .eq("plan_version", row.plan_version)
    .eq("professional_id", row.professional_id);
  if (error) throw error;
}

export async function executePersistedActionGroup(input: {
  admin: any;
  userId: string;
  row: any;
  confirmation: "direct" | "voice" | "opaque";
  authorization: string;
  requestOrigin?: string | null;
  userClient?: any;
}) {
  const row = input.row;
  if (!/^[a-f0-9]{64}$/i.test(clean(row.plan_hash, 64))) throw new Error("Hash do plano inválido.");
  if (!clean(input.authorization, 8000).startsWith("Bearer ")) throw new Error("Sessão ausente para executar o plano.");
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await saveExecutionState(input.admin, row, row.result_internal || {}, "expired");
    throw new Error("O plano expirou. Prepare uma revisão nova antes de executar.");
  }
  if (["completed", "completed_with_warnings"].includes(row.status)) return row.result_internal;
  if (!["awaiting_confirmation", "executing", "partially_completed"].includes(row.status)) {
    throw new Error(`Plano não executável no estado ${row.status}.`);
  }
  if (row.confirmation_policy === "voice" && input.confirmation !== "voice") {
    throw new Error("Este plano exige confirmação explícita por voz.");
  }
  if (row.confirmation_policy === "opaque" && input.confirmation !== "opaque") {
    throw new Error("Este plano exige confirmação opaca concluída no navegador.");
  }

  const steps = (row.steps_internal || []) as SynapseActionGroupStep[];
  const previous = row.result_internal && typeof row.result_internal === "object"
    ? row.result_internal as Record<string, any>
    : {};
  const persistedResults = Array.isArray(previous.stepResults)
    ? previous.stepResults as SynapseActionGroupStepResult[]
    : [];
  const results = new Map(persistedResults.map((result) => [result.stepId, result]));
  const visualActions: Record<string, unknown>[] = Array.isArray(previous.nextVisualActions)
    ? previous.nextVisualActions
    : [];
  const effects: ExecuteActionGroupResult["effects"] = Array.isArray(previous.effects)
    ? previous.effects
    : [];
  let state = (await loadConversationContext(input.admin, input.userId, row.conversation_id)).state;

  await saveExecutionState(input.admin, row, {
    ...previous,
    stepResults: [...results.values()],
    nextVisualActions: visualActions,
    effects,
  }, "executing");

  for (const step of steps) {
    if (results.get(step.stepId)?.status === "completed") continue;

    const dependencyFailed = (step.dependencies || []).some((dependency) =>
      results.get(dependency)?.status !== "completed"
    );
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
        authorization: input.authorization,
        requestOrigin: input.requestOrigin || null,
        userClient: input.userClient,
        channel: "voice" as const,
        voiceSessionId: row.voice_session_id,
        toolCallId: `${row.plan_id}:${row.plan_version}:${step.stepId}`,
        correlationId: `${row.plan_id}:${row.plan_version}`,
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
        result = await executeAgentToolV3(step.toolName, step.arguments as Record<string, any>, toolContext as any, state);
      }

      if (!result?.ok) {
        throw new Error(clean(result?.error || result?.message, 800) || "Etapa falhou sem resultado confiável.");
      }

      state = updateContextFromResult(state, step.toolName, step.arguments, result);
      await saveConversationContext(input.admin, input.userId, row.conversation_id, state);
      if (result.clientAction && typeof result.clientAction === "object") visualActions.push(result.clientAction);

      const warning = resultWarning(result);
      const rawEffects = Array.isArray(result?.data?.effects) ? result.data.effects : [];
      for (const effect of rawEffects) {
        if (!effect || typeof effect !== "object") continue;
        const rawStatus = clean((effect as any).status, 40);
        effects.push({
          kind: clean((effect as any).kind || (effect as any).type, 120) || "external_effect",
          status: ["queued", "completed", "failed"].includes(rawStatus)
            ? rawStatus as "queued" | "completed" | "failed"
            : "queued",
          message: clean((effect as any).message, 500) || "Efeito externo registrado.",
        });
      }

      results.set(step.stepId, {
        stepId: step.stepId,
        status: "completed",
        message: clean(result.message || result.data?.spoken_summary || step.spokenSummary, 800) || step.spokenSummary,
        primaryCommitted: result?.data?.primary_committed !== false,
        recordId: clean(
          result?.data?.id ||
          result?.data?.appointment?.id ||
          result?.data?.charge?.id ||
          result?.data?.invoice?.id,
          120,
        ) || null,
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
  const primaryCommitted = stepResults.some((result) =>
    result.status === "completed" && result.primaryCommitted !== false
  );
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
