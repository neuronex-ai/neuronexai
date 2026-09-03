"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import { SynapseTextShimmer } from "@/components/synapse/SynapseProcessingState";
import { useSynapseChat } from "@/hooks/use-synapse-chat";
import { normalizeSynapseToolName } from "@/lib/synapse-agent-presentation";
import {
  SYNAPSE_TEXT_AGENT_PROGRESS_EVENT,
  type SynapseTextAgentProgressDetail,
} from "@/lib/synapse-text-agent-progress";

type RuntimeState = {
  visible: boolean;
  label: string;
  awaitingConfirmation: boolean;
};

const INITIAL_RUNTIME: RuntimeState = {
  visible: false,
  label: "Analisando solicitação",
  awaitingConfirmation: false,
};

const toolStatusLabel = (rawToolName?: string) => {
  const toolName = normalizeSynapseToolName(rawToolName || "").toLowerCase();

  if (/patient|pacient|record|prontuario|anamnes/.test(toolName)) return "Acessando Pacientes";
  if (/agenda|schedule|appointment|calendar|waitlist|slot/.test(toolName)) return "Acessando Agenda";
  if (/finance|financial|payment|charge|transaction|receivable|pix|billing/.test(toolName)) return "Acessando Financeiro";
  if (/note|document|file|drive|report/.test(toolName)) return "Acessando Notas";
  if (/teleconsult|meeting|video/.test(toolName)) return "Acessando Teleconsulta";
  if (/message|whatsapp|neurozap|email/.test(toolName)) return "Preparando mensagem";

  return "Executando ação";
};

export const SynapseTextAgentPlanBridge = ({
  sessionId,
  enabled,
}: {
  sessionId: string | null;
  enabled: boolean;
}) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>(INITIAL_RUNTIME);
  const hideTimer = useRef<number | null>(null);
  const { send, isSending } = useSynapseChat();

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hideSoon = useCallback((delay = 1500) => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setRuntime(INITIAL_RUNTIME);
      hideTimer.current = null;
    }, delay);
  }, [clearHideTimer]);

  useEffect(() => {
    clearHideTimer();
    setRuntime(INITIAL_RUNTIME);
  }, [clearHideTimer, sessionId]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      setTarget(null);
      return;
    }

    const resolveTarget = () => {
      const next =
        document.querySelector<HTMLElement>(
          '#synapse-panel [role="log"][aria-label="Conversa com o Synapse"]',
        ) ||
        document.querySelector<HTMLElement>(
          '#synapse-panel section[aria-label="Conversa com o Synapse"]',
        );
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

      clearHideTimer();

      if (stage === "received" || stage === "planning") {
        setRuntime({ visible: true, label: "Analisando solicitação", awaitingConfirmation: false });
        return;
      }

      if (stage === "tool_started") {
        setRuntime({ visible: true, label: toolStatusLabel(event.toolName), awaitingConfirmation: false });
        return;
      }

      if (stage === "confirmation_required") {
        setRuntime({ visible: true, label: "Aguardando sua decisão", awaitingConfirmation: true });
        return;
      }

      if (stage === "pending_confirm") {
        setRuntime({ visible: true, label: "Aplicando alteração", awaitingConfirmation: false });
        return;
      }

      if (stage === "pending_cancel") {
        setRuntime({ visible: true, label: "Ação recusada", awaitingConfirmation: false });
        hideSoon(1100);
        return;
      }

      if (stage === "finalizing") {
        setRuntime({ visible: true, label: "Preparando resposta", awaitingConfirmation: false });
        return;
      }

      if (stage === "responding") {
        setRuntime(INITIAL_RUNTIME);
        return;
      }

      if (stage === "error") {
        setRuntime({ visible: true, label: "Não foi possível concluir", awaitingConfirmation: false });
        hideSoon(1800);
      }
    };

    window.addEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
    return () => {
      window.removeEventListener(SYNAPSE_TEXT_AGENT_PROGRESS_EVENT, handleProgress);
      clearHideTimer();
    };
  }, [clearHideTimer, hideSoon, sessionId]);

  const handleDecision = (decision: "accept" | "reject") => {
    if (isSending) return;
    setRuntime({
      visible: true,
      label: decision === "accept" ? "Aplicando alteração" : "Cancelando ação",
      awaitingConfirmation: false,
    });
    // The text runtime currently consumes explicit confirmation vocabulary.
    // "confirmo" is the canonical affirmative token; the conversation renders it as "Aceitar".
    send(decision === "accept" ? "confirmo" : "recusar");
  };

  if (!enabled || !target) return null;

  return (
    <>
      <style>{`
        html[data-synapse-text-runtime="active"] .synapse-desktop-thinking {
          display: none !important;
        }
      `}</style>
      {runtime.visible ? (
        <RuntimeMarker active />
      ) : null}
      {createPortal(
        <AnimatePresence initial={false}>
          {runtime.visible ? (
            <motion.div
              key="synapse-text-runtime"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{ duration: 0.16 }}
              className="min-w-0 py-1.5"
              role="status"
              aria-live="polite"
            >
              <SynapseTextShimmer className="text-[11.5px] font-semibold leading-5 tracking-[-0.01em]">
                {runtime.label}
              </SynapseTextShimmer>

              {runtime.awaitingConfirmation ? (
                <div className="mt-2.5 flex items-center gap-2" aria-label="Confirmar ou recusar ação">
                  <button
                    type="button"
                    onClick={() => handleDecision("reject")}
                    disabled={isSending}
                    className="min-h-9 rounded-full border border-foreground/[0.08] bg-background/28 px-3.5 text-[10px] font-semibold text-foreground/68 backdrop-blur-xl transition-[background-color,border-color,color,transform] hover:-translate-y-px hover:border-foreground/[0.13] hover:bg-background/58 hover:text-foreground disabled:opacity-45 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white/68 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.065] dark:hover:text-white"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision("accept")}
                    disabled={isSending}
                    className="min-h-9 rounded-full border border-foreground/[0.12] bg-foreground/[0.065] px-3.5 text-[10px] font-semibold text-foreground backdrop-blur-xl transition-[background-color,border-color,transform] hover:-translate-y-px hover:border-foreground/[0.18] hover:bg-foreground/[0.1] disabled:opacity-45 dark:border-white/[0.14] dark:bg-white/[0.075] dark:text-white dark:hover:border-white/[0.2] dark:hover:bg-white/[0.11]"
                  >
                    Aceitar
                  </button>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        target,
      )}
    </>
  );
};

const RuntimeMarker = ({ active }: { active: boolean }) => {
  useEffect(() => {
    if (!active) return undefined;
    document.documentElement.dataset.synapseTextRuntime = "active";
    return () => {
      delete document.documentElement.dataset.synapseTextRuntime;
    };
  }, [active]);

  return null;
};
