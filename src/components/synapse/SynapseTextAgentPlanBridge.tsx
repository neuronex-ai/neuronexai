"use client";

import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  SynapseAgentPlan,
  type SynapseAgentPlanModel,
  type SynapseAgentPlanStep,
} from "@/components/synapse/SynapseAgentPlan";
import {
  SynapseOperationalReasoning,
  type SynapseReasoningState,
  type SynapseReasoningStep,
} from "@/components/synapse/SynapseOperationalReasoning";
import {
  humanizeSynapseTool,
  integrationForSynapseTool,
  normalizeSynapseToolName,
} from "@/lib/synapse-agent-presentation";
import {
  SYNAPSE_TEXT_AGENT_PROGRESS_EVENT,
  type SynapseTextAgentProgressDetail,
  type SynapseTextAgentProgressEvent,
} from "@/lib/synapse-text-agent-progress";

type RuntimePlan = SynapseAgentPlanModel & {
  visible: boolean;
  awaitingConfirmation: boolean;
};

type RuntimeReasoning = {
  visible: boolean;
  state: SynapseReasoningState;
  steps: SynapseReasoningStep[];
  startedAt?: number;
  finishedAt?: number;
};

const EMPTY_PLAN: RuntimePlan = {
  title: "Plano do Synapse",
  steps: [],
  visible: false,
  awaitingConfirmation: false,
};

const EMPTY_REASONING: RuntimeReasoning = {
  visible: false,
  state: "complete",
  steps: [],
};

const safeDetail = (event: SynapseTextAgentProgressEvent) => {
  const detail = String(event.detail || "").trim();
  if (!detail) return undefined;
  return detail.slice(0, 180);
};

const eventTime = (detail: SynapseTextAgentProgressDetail) => {
  const value = Date.parse(detail.emittedAt);
  return Number.isFinite(value) ? value : Date.now();
};

const PREP_STEP_ID = "synapse-plan-preparation";
const FINAL_STEP_ID = "synapse-plan-finalization";
const CONFIRM_STEP_ID = "synapse-plan-confirmation";
const REASON_PREP_ID = "synapse-reasoning-intent";
const REASON_CONFIRM_ID = "synapse-reasoning-confirmation";
const REASON_FINAL_ID = "synapse-reasoning-finalization";

const completedPrepStep = (durationMs?: number): SynapseAgentPlanStep => ({
  id: PREP_STEP_ID,
  title: "Entender a solicitação",
  detail: "O Synapse conferiu o contexto necessário antes de usar as ferramentas.",
  status: "completed",
  durationMs,
});

const toolStepId = (toolName: string, occurrence: number) =>
  `synapse-plan-tool-${toolName}-${occurrence}`;

const reasoningToolStepId = (toolName: string, occurrence: number) =>
  `synapse-reasoning-tool-${toolName}-${occurrence}`;

const finishActiveReasoningSteps = (
  steps: SynapseReasoningStep[],
  status: Extract<SynapseReasoningStep["status"], "complete" | "error"> = "complete",
) => steps.map((step) =>
  step.status === "active" ? { ...step, status } : step,
);

const markLastMatchingPlanTool = (
  steps: SynapseAgentPlanStep[],
  toolName: string,
  status: SynapseAgentPlanStep["status"],
  detail?: string,
  finishedAt?: number,
) => {
  const normalized = normalizeSynapseToolName(toolName);
  let matchedIndex = -1;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (normalizeSynapseToolName(steps[index].toolName) === normalized && steps[index].status === "in-progress") {
      matchedIndex = index;
      break;
    }
  }

  if (matchedIndex < 0) return steps;
  return steps.map((step, index) => {
    if (index !== matchedIndex) return step;
    const durationMs = step.startedAt && finishedAt ? Math.max(0, finishedAt - step.startedAt) : step.durationMs;
    return { ...step, status, detail: detail || step.detail, durationMs };
  });
};

export const SynapseTextAgentPlanBridge = ({
  sessionId,
  enabled,
}: {
  sessionId: string | null;
  enabled: boolean;
}) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [plan, setPlan] = useState<RuntimePlan>(EMPTY_PLAN);
  const [reasoning, setReasoning] = useState<RuntimeReasoning>(EMPTY_REASONING);
  const toolOccurrences = useRef<Record<string, number>>({});
  const reasoningToolOccurrences = useRef<Record<string, number>>({});
  const toolStartedAt = useRef<Record<string, number[]>>({});
  const prepStartedAt = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const resetRuntime = useCallback(() => {
    clearHideTimer();
    setPlan(EMPTY_PLAN);
    setReasoning(EMPTY_REASONING);
    toolOccurrences.current = {};
    reasoningToolOccurrences.current = {};
    toolStartedAt.current = {};
    prepStartedAt.current = undefined;
  }, [clearHideTimer]);

  useEffect(() => {
    resetRuntime();
  }, [resetRuntime, sessionId]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      setTarget(null);
      return;
    }

    const resolveTarget = () => {
      const next =
        document.querySelector<HTMLElement>(
          '#synapse-tabpanel [role="log"][aria-label="Conversa com o Synapse"]',
        ) ||
        document.querySelector<HTMLElement>("#synapse-tabpanel .synapse-chat-view");
      setTarget((current) => current === next ? current : next);
    };

    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    const handleProgress = (rawEvent: Event) => {
      const detail = (rawEvent as CustomEvent<SynapseTextAgentProgressDetail>).detail;
      if (!detail || !sessionId || detail.sessionId !== sessionId) return;

      const event = detail.event || {};
      const stage = String(event.stage || "").toLowerCase();
      const toolName = normalizeSynapseToolName(event.toolName);
      const detailText = safeDetail(event);
      const now = eventTime(detail);

      if (stage === "received") {
        clearHideTimer();
        setPlan(EMPTY_PLAN);
        setReasoning(EMPTY_REASONING);
        toolOccurrences.current = {};
        reasoningToolOccurrences.current = {};
        toolStartedAt.current = {};
        prepStartedAt.current = now;
        return;
      }

      if (stage === "planning") {
        prepStartedAt.current = prepStartedAt.current || now;
        setPlan({
          title: "Plano do Synapse",
          visible: false,
          awaitingConfirmation: false,
          steps: [{
            id: PREP_STEP_ID,
            title: "Entender a solicitação",
            detail: detailText || "Organizando o contexto necessário para executar o pedido.",
            status: "in-progress",
            startedAt: prepStartedAt.current,
          }],
        });
        setReasoning({
          visible: true,
          state: "running",
          startedAt: prepStartedAt.current,
          steps: [{
            id: REASON_PREP_ID,
            title: "Entender a intenção",
            detail: detailText || "Interpretando o pedido e verificando o contexto disponível.",
            status: "active",
          }],
        });
        return;
      }

      if (stage === "tool_started" && toolName) {
        const planOccurrence = (toolOccurrences.current[toolName] || 0) + 1;
        toolOccurrences.current[toolName] = planOccurrence;
        toolStartedAt.current[toolName] = [...(toolStartedAt.current[toolName] || []), now];

        const reasoningOccurrence = (reasoningToolOccurrences.current[toolName] || 0) + 1;
        reasoningToolOccurrences.current[toolName] = reasoningOccurrence;

        setPlan((current) => {
          const prepDuration = prepStartedAt.current ? Math.max(0, now - prepStartedAt.current) : undefined;
          const existing = current.steps.filter((step) => step.id !== PREP_STEP_ID);
          return {
            title: "Plano do Synapse",
            visible: true,
            awaitingConfirmation: false,
            steps: [
              completedPrepStep(prepDuration),
              ...existing.filter((step) => step.id !== FINAL_STEP_ID && step.id !== CONFIRM_STEP_ID),
              {
                id: toolStepId(toolName, planOccurrence),
                toolName,
                title: humanizeSynapseTool(toolName),
                detail: detailText,
                status: "in-progress",
                integration: integrationForSynapseTool(toolName),
                startedAt: now,
              },
            ],
          };
        });

        setReasoning((current) => {
          const baseSteps = current.steps.length
            ? finishActiveReasoningSteps(current.steps)
            : [{ id: REASON_PREP_ID, title: "Entender a intenção", status: "complete" as const }];
          return {
            visible: true,
            state: "running",
            startedAt: current.startedAt || prepStartedAt.current || now,
            steps: [
              ...baseSteps.filter((step) => step.id !== REASON_FINAL_ID && step.id !== REASON_CONFIRM_ID),
              {
                id: reasoningToolStepId(toolName, reasoningOccurrence),
                toolName,
                title: humanizeSynapseTool(toolName),
                detail: detailText,
                status: "active",
              },
            ],
          };
        });
        return;
      }

      if (stage === "tool_finished" && toolName) {
        const startedList = toolStartedAt.current[toolName] || [];
        const startedAt = startedList.shift();
        toolStartedAt.current[toolName] = startedList;
        const durationMs = startedAt ? Math.max(0, now - startedAt) : undefined;

        setPlan((current) => ({
          ...current,
          steps: markLastMatchingPlanTool(current.steps, toolName, "completed", detailText, now).map((step) =>
            normalizeSynapseToolName(step.toolName) === toolName && step.status === "completed" && !step.durationMs && durationMs
              ? { ...step, durationMs }
              : step,
          ),
        }));

        setReasoning((current) => {
          let matched = false;
          const steps = [...current.steps].reverse().map((step) => {
            if (!matched && step.status === "active" && normalizeSynapseToolName(step.toolName) === toolName) {
              matched = true;
              return { ...step, status: "complete" as const, detail: detailText || step.detail, durationMs };
            }
            return step;
          }).reverse();
          return { ...current, steps };
        });
        return;
      }

      if (stage === "confirmation_required") {
        setPlan((current) => {
          const baseSteps = current.steps.length
            ? current.steps.map((step) => step.status === "in-progress" ? { ...step, status: "completed" as const } : step)
            : [completedPrepStep()];
          return {
            title: "Plano do Synapse",
            visible: true,
            awaitingConfirmation: true,
            steps: [
              ...baseSteps.filter((step) => step.id !== FINAL_STEP_ID && step.id !== CONFIRM_STEP_ID),
              {
                id: CONFIRM_STEP_ID,
                title: "Aguardar sua confirmação",
                detail: detailText || "Nenhuma alteração será feita antes da sua confirmação.",
                status: "needs-confirmation",
              },
            ],
          };
        });
        setReasoning((current) => ({
          visible: true,
          state: "waiting",
          startedAt: current.startedAt || prepStartedAt.current || now,
          steps: [
            ...finishActiveReasoningSteps(current.steps).filter((step) => step.id !== REASON_CONFIRM_ID),
            {
              id: REASON_CONFIRM_ID,
              title: "Preparar revisão para confirmação",
              detail: detailText || "O Synapse pausou antes de executar qualquer alteração.",
              status: "waiting",
            },
          ],
        }));
        return;
      }

      if (stage === "pending_confirm") {
        setPlan((current) => ({
          title: "Plano do Synapse",
          visible: true,
          awaitingConfirmation: false,
          steps: current.steps.length
            ? current.steps.map((step) => step.id === CONFIRM_STEP_ID
              ? { ...step, title: "Executar ação confirmada", detail: detailText || step.detail, status: "in-progress" as const, startedAt: now }
              : step)
            : [{ id: CONFIRM_STEP_ID, title: "Executar ação confirmada", detail: detailText, status: "in-progress", startedAt: now }],
        }));
        setReasoning((current) => ({
          visible: true,
          state: "running",
          startedAt: current.startedAt || now,
          steps: [
            ...current.steps.filter((step) => step.id !== REASON_CONFIRM_ID),
            {
              id: REASON_CONFIRM_ID,
              title: "Aplicar confirmação do profissional",
              detail: detailText || "Retomando a execução com a confirmação recebida.",
              status: "active",
            },
          ],
        }));
        return;
      }

      if (stage === "pending_cancel") {
        setPlan((current) => ({
          ...current,
          visible: current.visible || current.steps.length > 0,
          awaitingConfirmation: false,
          steps: current.steps.map((step) => step.id === CONFIRM_STEP_ID
            ? { ...step, title: "Ação cancelada", status: "cancelled" as const }
            : step),
        }));
        setReasoning((current) => ({
          visible: true,
          state: "complete",
          startedAt: current.startedAt || now,
          finishedAt: now,
          steps: [
            ...finishActiveReasoningSteps(current.steps),
            {
              id: `synapse-reasoning-cancelled-${now}`,
              title: "Encerrar sem alterações",
              detail: detailText || "A execução foi cancelada antes de aplicar mudanças.",
              status: "complete",
            },
          ],
        }));
        hideTimer.current = window.setTimeout(() => setPlan(EMPTY_PLAN), 1200);
        return;
      }

      if (stage === "finalizing") {
        setPlan((current) => {
          if (!current.visible) return current;
          const steps = current.steps.map((step) => step.status === "in-progress" ? { ...step, status: "completed" as const } : step);
          return {
            ...current,
            awaitingConfirmation: false,
            steps: [
              ...steps.filter((step) => step.id !== FINAL_STEP_ID && step.id !== CONFIRM_STEP_ID),
              {
                id: FINAL_STEP_ID,
                title: "Preparar resposta",
                detail: detailText,
                status: "in-progress",
                startedAt: now,
              },
            ],
          };
        });
        setReasoning((current) => ({
          visible: true,
          state: "running",
          startedAt: current.startedAt || now,
          steps: [
            ...finishActiveReasoningSteps(current.steps).filter((step) => step.id !== REASON_FINAL_ID),
            {
              id: REASON_FINAL_ID,
              title: "Consolidar resultado",
              detail: detailText || "Organizando o que foi encontrado e executado antes de responder.",
              status: "active",
            },
          ],
        }));
        return;
      }

      if (stage === "responding") {
        setPlan((current) => current.awaitingConfirmation ? current : EMPTY_PLAN);
        setReasoning((current) => current.visible
          ? {
              ...current,
              state: "complete",
              finishedAt: now,
              steps: finishActiveReasoningSteps(current.steps),
            }
          : current);
        return;
      }

      if (stage === "error") {
        setPlan((current) => {
          if (!current.visible) return current;
          const hasInProgress = current.steps.some((step) => step.status === "in-progress");
          return {
            ...current,
            awaitingConfirmation: false,
            steps: hasInProgress
              ? current.steps.map((step) => step.status === "in-progress"
                ? { ...step, status: "failed" as const, detail: detailText || step.detail }
                : step)
              : [
                  ...current.steps,
                  { id: `synapse-plan-error-${now}`, title: "Não foi possível concluir", detail: detailText, status: "failed" },
                ],
          };
        });
        setReasoning((current) => ({
          visible: true,
          state: "error",
          startedAt: current.startedAt || now,
          finishedAt: now,
          steps: current.steps.length
            ? finishActiveReasoningSteps(current.steps, "error")
            : [{ id: `synapse-reasoning-error-${now}`, title: "Não foi possível concluir o processamento", detail: detailText, status: "error" }],
        }));
        hideTimer.current = window.setTimeout(() => setPlan(EMPTY_PLAN), 2200);
      }
    };

    window.addEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
    return () => {
      window.removeEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
      clearHideTimer();
    };
  }, [clearHideTimer, sessionId]);

  const runtimeVisible = enabled && (plan.visible || reasoning.visible);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (runtimeVisible) {
      document.documentElement.dataset.synapseTextAgentRuntime = "active";
      return () => {
        delete document.documentElement.dataset.synapseTextAgentRuntime;
      };
    }
    delete document.documentElement.dataset.synapseTextAgentRuntime;
    return undefined;
  }, [runtimeVisible]);

  useEffect(() => {
    if (!target || !runtimeVisible) return;
    const viewport = document.getElementById("synapse-tabpanel");
    const frame = window.requestAnimationFrame(() => {
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [plan, reasoning, runtimeVisible, target]);

  const visiblePlan = useMemo<SynapseAgentPlanModel>(
    () => ({ title: plan.title, steps: plan.steps }),
    [plan.steps, plan.title],
  );

  if (!enabled || !target) return null;

  return (
    <>
      <style>{`
        html[data-synapse-text-agent-runtime="active"] .synapse-desktop-thinking {
          display: none !important;
        }
      `}</style>

      {createPortal(
        <AnimatePresence initial={false}>
          {runtimeVisible ? (
            <div
              key="synapse-text-agent-runtime"
              className="flex min-w-0 items-start gap-2.5"
              role="status"
              aria-live="polite"
            >
              <span
                className="synapse-desktop-message-mark mt-1 flex h-8 w-8 shrink-0 items-center justify-center"
                aria-hidden="true"
              >
                <Sparkles className="relative z-10 h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 max-w-[84%] flex-1 space-y-2">
                {reasoning.visible && reasoning.steps.length ? (
                  <SynapseOperationalReasoning
                    steps={reasoning.steps}
                    state={reasoning.state}
                    startedAt={reasoning.startedAt}
                    finishedAt={reasoning.finishedAt}
                  />
                ) : null}
                {plan.visible && plan.steps.length > 0 ? <SynapseAgentPlan plan={visiblePlan} /> : null}
              </div>
            </div>
          ) : null}
        </AnimatePresence>,
        target,
      )}
    </>
  );
};
