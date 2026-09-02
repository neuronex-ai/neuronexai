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
import {
  executionArgumentsForStep,
  hasIncompleteDependency,
  primaryRecordIdFromResult,
} from "./dependency-flow.ts";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETRYABLE_CHARGE_STATUSES = new Set(["failed", "canceled", "cancelled", "expired", "refunded"]);

function resultWarning(result: any) {
  const warnings = Array.isArray(result?.data?.warnings)
    ? result.data.warnings
    : Array.isArray(result?.warnings)
      ? result.warnings
      : [];
  return warnings.map((value: unknown) => clean(value, 500)).filter(Boolean).join("; ") || null;
}

function resultRecordIds(toolName: string, result: any): string[] {
  const data = result?.data && typeof result.data === "object" ? result.data : {};
  const nestedResult = data?.result && typeof data.result === "object" ? data.result : {};
  const candidates: unknown[] = [];
  if (toolName === "create_appointment") {
    if (Array.isArray(nestedResult.appointmentIds)) candidates.push(...nestedResult.appointmentIds);
    if (Array.isArray(data.appointmentIds)) candidates.push(...data.appointmentIds);
    candidates.push(nestedResult.appointmentId, data.appointmentId, data?.appointment?.id);
  } else {
    if (Array.isArray(data.charge_ids)) candidates.push(...data.charge_ids);
    candidates.push(data.id, data?.charge?.id, data?.invoice?.id, data?.appointment?.id);
  }
  const primary = primaryRecordIdFromResult(toolName, result);
  if (primary) candidates.unshift(primary);
  return Array.from(new Set<string>(
    candidates
      .map((value) => clean(value, 120))
      .filter((value) => UUID_PATTERN.test(value)),
  ));
}

function persistedRecordIds(result?: SynapseActionGroupStepResult | null): string[] {
  if (!result) return [];
  const values = Array.isArray((result as any).recordIds)
    ? (result as any).recordIds
    : result.recordId
      ? [result.recordId]
      : [];
  return Array.from(new Set<string>(
    values
      .map((value: unknown) => clean(value, 120))
      .filter((value: string) => UUID_PATTERN.test(value)),
  ));
}

function localDate(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data da ocorrência inválida para cobrança.");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
}

function dateSerial(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Data financeira inválida.");
  return Date.parse(`${value}T00:00:00Z`);
}

function dateDifferenceDays(left: string, right: string) {
  return Math.round((dateSerial(left) - dateSerial(right)) / 86_400_000);
}

function addDateDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function chargeMode(step: SynapseActionGroupStep, args: Record<string, any>) {
  return clean(args.charge_mode || (step.arguments as any)?.charge_mode || "per_occurrence", 40).toLowerCase();
}

function appointmentDependencyIds(
  step: SynapseActionGroupStep,
  steps: SynapseActionGroupStep[],
  results: Map<string, SynapseActionGroupStepResult>,
): string[] {
  for (const dependencyId of step.dependencies || []) {
    const dependency = steps.find((candidate) => candidate.stepId === dependencyId);
    if (dependency?.toolName !== "create_appointment") continue;
    const result = results.get(dependencyId);
    if (result?.status !== "completed") continue;
    const ids = persistedRecordIds(result);
    if (ids.length) return ids;
  }
  return [];
}

async function reusableChargeForAppointment(
  admin: any,
  userId: string,
  appointmentId: string,
) {
  const { data, error } = await admin
    .from("nb_payments")
    .select("id,status,normalized_status,created_at")
    .eq("user_id", userId)
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data || []).find((row: any) => {
    const status = clean(row.normalized_status || row.status, 40).toLowerCase();
    return !RETRYABLE_CHARGE_STATUSES.has(status);
  }) || null;
}

class PartialStepExecutionError extends Error {
  primaryCommitted: boolean;
  recordIds: string[];

  constructor(message: string, primaryCommitted: boolean, recordIds: string[]) {
    super(message);
    this.name = "PartialStepExecutionError";
    this.primaryCommitted = primaryCommitted;
    this.recordIds = recordIds;
  }
}

async function executePerOccurrenceNeurofinanceCharge(input: {
  admin: any;
  userId: string;
  row: any;
  step: SynapseActionGroupStep;
  executionArguments: Record<string, any>;
  appointmentIds: string[];
  toolContext: Record<string, any>;
}) {
  const { data: appointmentRows, error: appointmentError } = await input.admin
    .from("appointments")
    .select("id,start_time")
    .eq("user_id", input.userId)
    .in("id", input.appointmentIds);
  if (appointmentError) throw appointmentError;

  const byId = new Map((appointmentRows || []).map((row: any) => [row.id, row]));
  const appointments = input.appointmentIds.map((id) => byId.get(id)).filter(Boolean) as Array<{ id: string; start_time: string }>;
  if (appointments.length !== input.appointmentIds.length) {
    throw new Error("Não consegui relacionar todas as ocorrências criadas às cobranças.");
  }

  const firstAppointmentDate = localDate(appointments[0].start_time);
  const requestedDueDate = clean(input.executionArguments.due_date, 10);
  const explicitDueDays = Number(input.executionArguments.due_days_before);
  const hasExplicitDueDays = Number.isFinite(explicitDueDays) && explicitDueDays >= 0;
  const relativeDueOffset = requestedDueDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDueDate)
    ? dateDifferenceDays(requestedDueDate, firstAppointmentDate)
    : 0;
  const dueDaysBefore = hasExplicitDueDays ? Math.min(365, Math.floor(explicitDueDays)) : null;
  const today = localDate(new Date());

  const chargeIds: string[] = [];
  let createdCount = 0;
  let reusedCount = 0;
  let lastClientAction: Record<string, unknown> | null = null;

  for (const [index, appointment] of appointments.entries()) {
    const appointmentDate = localDate(appointment.start_time);
    const calculatedDueDate = dueDaysBefore !== null
      ? addDateDays(appointmentDate, -dueDaysBefore)
      : addDateDays(appointmentDate, relativeDueOffset);
    const dueDate = calculatedDueDate < today ? today : calculatedDueDate;

    const existing = await reusableChargeForAppointment(input.admin, input.userId, appointment.id);
    if (existing?.id) {
      chargeIds.push(existing.id);
      reusedCount += 1;
      continue;
    }

    const childArguments = {
      ...input.executionArguments,
      appointment_id: appointment.id,
      due_date: dueDate,
    };
    const pending: PendingAction = {
      kind: "synapse_pending_action",
      actionId: `${input.row.plan_id}:${input.row.plan_version}:${input.step.stepId}:${appointment.id}`,
      toolName: input.step.toolName,
      arguments: childArguments,
      summary: input.step.spokenSummary,
      status: "executing",
      createdAt: input.row.created_at,
      expiresAt: input.row.expires_at,
    };
    const childResult = await executeConfirmedMutationV3(pending, input.toolContext as any);
    if (!childResult?.ok) {
      throw new PartialStepExecutionError(
        `A cobrança ${index + 1} de ${appointments.length} não pôde ser concluída. ${clean(childResult?.error || childResult?.message, 500)}`.trim(),
        chargeIds.length > 0,
        chargeIds,
      );
    }

    const childIds = resultRecordIds(input.step.toolName, childResult);
    if (childIds.length) chargeIds.push(...childIds);
    createdCount += 1;
    if (childResult.clientAction && typeof childResult.clientAction === "object") {
      lastClientAction = childResult.clientAction as Record<string, unknown>;
    }
  }

  const uniqueChargeIds = Array.from(new Set(chargeIds));
  const warnings = reusedCount > 0
    ? [`${reusedCount} cobrança(s) já estavam vinculadas e foram preservadas sem duplicação.`]
    : [];
  return {
    ok: true,
    grounded: true,
    recordCount: appointments.length,
    data: {
      primary_committed: true,
      charge_ids: uniqueChargeIds,
      charge: uniqueChargeIds[0] ? { id: uniqueChargeIds[0] } : null,
      created_count: createdCount,
      reused_count: reusedCount,
      total_occurrences: appointments.length,
      warnings,
    },
    message: `${appointments.length} cobrança(s) NeuroFinance ficaram pareadas 1:1 com as ${appointments.length} sessões.`,
    ...(lastClientAction ? { clientAction: lastClientAction } : {}),
  };
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

    const dependencyFailed = hasIncompleteDependency(step, results);
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
      const executionArguments = executionArgumentsForStep(step, steps, results);
      const linkedAppointmentIds = appointmentDependencyIds(step, steps, results);

      let result: any;
      if (
        policy.executor === "mutation" &&
        step.toolName === "create_neurofinance_charge" &&
        linkedAppointmentIds.length > 1 &&
        chargeMode(step, executionArguments) === "per_occurrence"
      ) {
        result = await executePerOccurrenceNeurofinanceCharge({
          admin: input.admin,
          userId: input.userId,
          row,
          step,
          executionArguments,
          appointmentIds: linkedAppointmentIds,
          toolContext,
        });
      } else if (policy.executor === "mutation") {
        const pending: PendingAction = {
          kind: "synapse_pending_action",
          actionId: `${row.plan_id}:${step.stepId}`,
          toolName: step.toolName,
          arguments: executionArguments,
          summary: step.spokenSummary,
          status: "executing",
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        };
        result = await executeConfirmedMutationV3(pending, toolContext as any);
      } else {
        result = await executeAgentToolV3(step.toolName, executionArguments as Record<string, any>, toolContext as any, state);
      }

      if (!result?.ok) {
        throw new Error(clean(result?.error || result?.message, 800) || "Etapa falhou sem resultado confiável.");
      }

      state = updateContextFromResult(state, step.toolName, executionArguments, result);
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

      const completedResult: SynapseActionGroupStepResult = {
        stepId: step.stepId,
        status: "completed",
        message: clean(result.message || result.data?.spoken_summary || step.spokenSummary, 800) || step.spokenSummary,
        primaryCommitted: result?.data?.primary_committed !== false,
        recordId: primaryRecordIdFromResult(step.toolName, result),
        warning,
      };
      const recordIds = resultRecordIds(step.toolName, result);
      if (recordIds.length) (completedResult as any).recordIds = recordIds;
      results.set(step.stepId, completedResult);
    } catch (error) {
      const partial = error instanceof PartialStepExecutionError ? error : null;
      const failedResult: SynapseActionGroupStepResult = {
        stepId: step.stepId,
        status: "failed",
        message: clean(error instanceof Error ? error.message : error, 800) || "Etapa falhou.",
        primaryCommitted: partial?.primaryCommitted || false,
      };
      if (partial?.recordIds.length) {
        failedResult.recordId = partial.recordIds[0];
        (failedResult as any).recordIds = partial.recordIds;
      }
      results.set(step.stepId, failedResult);
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
