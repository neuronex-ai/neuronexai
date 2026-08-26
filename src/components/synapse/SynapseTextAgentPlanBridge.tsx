"use client";

import { AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  SynapseAgentPlan,
  type SynapseAgentIntegration,
  type SynapseAgentPlanModel,
  type SynapseAgentPlanStep,
} from "@/components/synapse/SynapseAgentPlan";
import {
  SYNAPSE_TEXT_AGENT_PROGRESS_EVENT,
  type SynapseTextAgentProgressDetail,
  type SynapseTextAgentProgressEvent,
} from "@/lib/synapse-text-agent-progress";

type RuntimePlan = SynapseAgentPlanModel & {
  visible: boolean;
  awaitingConfirmation: boolean;
};

const EMPTY_PLAN: RuntimePlan = {
  title: "Plano do Synapse",
  steps: [],
  visible: false,
  awaitingConfirmation: false,
};

const normalizeToolName = (value?: string) => String(value || "").trim().toLowerCase();

const integrationForTool = (toolName: string): SynapseAgentIntegration | undefined => {
  const tool = normalizeToolName(toolName);

  if (
    tool === "send_patient_email" ||
    tool === "send_email" ||
    tool === "draft_email" ||
    tool.includes("gmail")
  ) {
    return "gmail";
  }

  // These canonical Agenda mutations feed the Google Calendar synchronization
  // outbox when the professional has the calendar integration configured.
  if (
    tool === "create_appointment" ||
    tool === "reschedule_appointment" ||
    tool === "cancel_appointment" ||
    tool.includes("google_calendar") ||
    tool.includes("calendar_event")
  ) {
    return "google_calendar";
  }

  return undefined;
};

const TOOL_LABELS: Record<string, string> = {
  search_workspace: "Pesquisar informações no NeuroNex",
  get_workspace_overview: "Consultar visão geral do consultório",
  get_dashboard_daily_briefing: "Consultar resumo do dia",
  get_dashboard_schedule: "Consultar agenda do painel",
  get_dashboard_next_appointment: "Consultar próximo atendimento",
  get_dashboard_attention_queue: "Verificar pendências importantes",
  get_dashboard_financial_overview: "Consultar resumo financeiro",
  list_patients: "Consultar pacientes",
  search_patients: "Buscar paciente",
  search_patient_directory: "Buscar paciente",
  get_patient_details: "Consultar cadastro do paciente",
  get_patient_card_summary: "Consultar resumo do paciente",
  get_clinical_history: "Consultar prontuário",
  get_patient_system_snapshot: "Consolidar contexto do paciente",
  get_patient_payment_status: "Consultar situação financeira do paciente",
  get_patient_timeline: "Montar linha do tempo do paciente",
  get_calendar: "Consultar agenda clínica",
  get_agenda_daily_overview: "Consultar agenda do dia",
  get_agenda_week_overview: "Consultar agenda da semana",
  get_appointment_details: "Consultar detalhes do atendimento",
  find_available_slots: "Verificar horários disponíveis",
  create_appointment: "Preparar novo agendamento",
  reschedule_appointment: "Preparar remarcação",
  cancel_appointment: "Preparar cancelamento",
  send_appointment_reminder: "Preparar comunicação do atendimento",
  send_patient_email: "Preparar e-mail pelo Gmail",
  create_patient: "Preparar cadastro de paciente",
  update_patient: "Preparar atualização do paciente",
  update_patient_basic_info: "Preparar atualização cadastral",
  inactivate_patient: "Preparar inativação do paciente",
  create_session_note: "Preparar registro de prontuário",
  create_personal_note: "Preparar nova nota",
  update_personal_note: "Preparar atualização da nota",
  append_to_personal_note: "Preparar complemento da nota",
  create_task: "Preparar nova tarefa",
  update_task: "Preparar atualização da tarefa",
  complete_task: "Preparar conclusão da tarefa",
  create_financial_entry: "Preparar lançamento financeiro",
  get_neurofinance_status: "Consultar status do NeuroFinance",
  get_neurofinance_overview: "Consultar NeuroFinance",
  list_neurofinance_charges: "Consultar cobranças",
  get_neurofinance_charge: "Consultar cobrança",
  create_neurofinance_charge: "Preparar cobrança pelo NeuroFinance",
  list_fiscal_invoices: "Consultar notas fiscais",
  get_fiscal_invoice: "Consultar nota fiscal",
  create_fiscal_invoice: "Preparar emissão de NFS-e",
  analyze_neuroview_patient_patterns: "Analisar padrões no NeuroView",
  create_neuroflow_from_patient_history: "Criar NeuroFlow",
  create_neuropulse_cause_effect_diagram: "Criar diagrama no NeuroPulse",
  request_interface_action: "Preparar ação na interface",
};

const humanizeTool = (toolName?: string) => {
  const normalized = normalizeToolName(toolName);
  if (!normalized) return "Executar ação do Synapse";
  if (TOOL_LABELS[normalized]) return TOOL_LABELS[normalized];

  return normalized
    .replace(/^get_/, "Consultar ")
    .replace(/^list_/, "Listar ")
    .replace(/^search_/, "Buscar ")
    .replace(/^create_/, "Criar ")
    .replace(/^update_/, "Atualizar ")
    .replace(/^send_/, "Enviar ")
    .replace(/^open_/, "Abrir ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/^Consultar /, "Consultar ")
    .replace(/^Listar /, "Listar ")
    .replace(/^Buscar /, "Buscar ")
    .replace(/^Criar /, "Criar ")
    .replace(/^Atualizar /, "Atualizar ")
    .replace(/^Enviar /, "Enviar ")
    .replace(/^Abrir /, "Abrir ");
};

const safeDetail = (event: SynapseTextAgentProgressEvent) => {
  const detail = String(event.detail || "").trim();
  if (!detail) return undefined;
  return detail.slice(0, 180);
};

const PREP_STEP_ID = "synapse-plan-preparation";
const FINAL_STEP_ID = "synapse-plan-finalization";
const CONFIRM_STEP_ID = "synapse-plan-confirmation";

const completedPrepStep = (): SynapseAgentPlanStep => ({
  id: PREP_STEP_ID,
  title: "Entender a solicitação",
  detail: "O Synapse conferiu o contexto necessário antes de usar as ferramentas.",
  status: "completed",
});

const toolStepId = (toolName: string, occurrence: number) =>
  `synapse-plan-tool-${toolName}-${occurrence}`;

const markLastMatchingTool = (
  steps: SynapseAgentPlanStep[],
  toolName: string,
  status: SynapseAgentPlanStep["status"],
  detail?: string,
) => {
  const normalized = normalizeToolName(toolName);
  let matchedIndex = -1;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (normalizeToolName(steps[index].toolName) === normalized && steps[index].status === "in-progress") {
      matchedIndex = index;
      break;
    }
  }

  if (matchedIndex < 0) return steps;
  return steps.map((step, index) =>
    index === matchedIndex
      ? { ...step, status, detail: detail || step.detail }
      : step,
  );
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
  const toolOccurrences = useRef<Record<string, number>>({});
  const hideTimer = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  useEffect(() => {
    setPlan(EMPTY_PLAN);
    toolOccurrences.current = {};
  }, [sessionId]);

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
      const toolName = normalizeToolName(event.toolName);
      const detailText = safeDetail(event);

      if (stage === "received") {
        clearHideTimer();
        return;
      }

      if (stage === "planning") {
        setPlan((current) => {
          if (current.awaitingConfirmation) return current;
          toolOccurrences.current = {};
          return {
            title: "Plano do Synapse",
            visible: false,
            awaitingConfirmation: false,
            steps: [{
              id: PREP_STEP_ID,
              title: "Entender a solicitação",
              detail: detailText || "Organizando o contexto necessário para executar o pedido.",
              status: "in-progress",
            }],
          };
        });
        return;
      }

      if (stage === "tool_started" && toolName) {
        setPlan((current) => {
          const occurrence = (toolOccurrences.current[toolName] || 0) + 1;
          toolOccurrences.current[toolName] = occurrence;
          const existing = current.steps.filter((step) => step.id !== PREP_STEP_ID);
          const steps: SynapseAgentPlanStep[] = [
            completedPrepStep(),
            ...existing.filter((step) => step.id !== FINAL_STEP_ID && step.id !== CONFIRM_STEP_ID),
            {
              id: toolStepId(toolName, occurrence),
              toolName,
              title: humanizeTool(toolName),
              detail: detailText,
              status: "in-progress",
              integration: integrationForTool(toolName),
            },
          ];

          return {
            title: "Plano do Synapse",
            steps,
            visible: true,
            awaitingConfirmation: false,
          };
        });
        return;
      }

      if (stage === "tool_finished" && toolName) {
        setPlan((current) => ({
          ...current,
          steps: markLastMatchingTool(current.steps, toolName, "completed", detailText),
        }));
        return;
      }

      if (stage === "confirmation_required") {
        setPlan((current) => {
          const baseSteps = current.steps.length
            ? current.steps.map((step) =>
                step.status === "in-progress" ? { ...step, status: "completed" as const } : step,
              )
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
        return;
      }

      if (stage === "pending_confirm") {
        setPlan((current) => ({
          title: "Plano do Synapse",
          visible: true,
          awaitingConfirmation: false,
          steps: current.steps.length
            ? current.steps.map((step) =>
                step.id === CONFIRM_STEP_ID
                  ? {
                      ...step,
                      title: "Executar ação confirmada",
                      detail: detailText || step.detail,
                      status: "in-progress" as const,
                    }
                  : step,
              )
            : [{
                id: CONFIRM_STEP_ID,
                title: "Executar ação confirmada",
                detail: detailText,
                status: "in-progress",
              }],
        }));
        return;
      }

      if (stage === "pending_cancel") {
        setPlan((current) => ({
          ...current,
          visible: current.visible || current.steps.length > 0,
          awaitingConfirmation: false,
          steps: current.steps.map((step) =>
            step.id === CONFIRM_STEP_ID
              ? { ...step, title: "Ação cancelada", status: "cancelled" as const }
              : step,
          ),
        }));
        hideTimer.current = window.setTimeout(() => setPlan(EMPTY_PLAN), 1200);
        return;
      }

      if (stage === "finalizing") {
        setPlan((current) => {
          if (!current.visible) return current;
          const steps = current.steps.map((step) =>
            step.status === "in-progress" ? { ...step, status: "completed" as const } : step,
          );
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
              },
            ],
          };
        });
        return;
      }

      if (stage === "responding") {
        setPlan((current) => {
          if (current.awaitingConfirmation) return current;
          return EMPTY_PLAN;
        });
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
              ? current.steps.map((step) =>
                  step.status === "in-progress"
                    ? { ...step, status: "failed" as const, detail: detailText || step.detail }
                    : step,
                )
              : [
                  ...current.steps,
                  {
                    id: `synapse-plan-error-${Date.now()}`,
                    title: "Não foi possível concluir",
                    detail: detailText,
                    status: "failed",
                  },
                ],
          };
        });
        hideTimer.current = window.setTimeout(() => setPlan(EMPTY_PLAN), 2200);
      }
    };

    window.addEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
    return () => {
      window.removeEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
      clearHideTimer();
    };
  }, [clearHideTimer, sessionId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (enabled && plan.visible) {
      document.documentElement.dataset.synapseTextAgentPlan = "active";
      return () => {
        delete document.documentElement.dataset.synapseTextAgentPlan;
      };
    }
    delete document.documentElement.dataset.synapseTextAgentPlan;
    return undefined;
  }, [enabled, plan.visible]);

  useEffect(() => {
    if (!target || !plan.visible) return;
    const viewport = document.getElementById("synapse-tabpanel");
    const frame = window.requestAnimationFrame(() => {
      viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [plan, target]);

  const visiblePlan = useMemo<SynapseAgentPlanModel>(
    () => ({ title: plan.title, steps: plan.steps }),
    [plan.steps, plan.title],
  );

  if (!enabled || !target) return null;

  return (
    <>
      <style>{`
        html[data-synapse-text-agent-plan="active"] .synapse-desktop-thinking {
          display: none !important;
        }
      `}</style>

      {createPortal(
        <AnimatePresence initial={false}>
          {plan.visible && plan.steps.length > 0 ? (
            <div
              key="synapse-text-agent-plan"
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
              <div className="min-w-0 max-w-[84%] flex-1">
                <SynapseAgentPlan plan={visiblePlan} />
              </div>
            </div>
          ) : null}
        </AnimatePresence>,
        target,
      )}
    </>
  );
};
