import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useSynapse } from "@/context/SynapseContext";
import { SynapseLiquidOrb } from "./SynapseLiquidOrb";

type PresenceVisualState =
    | "idle"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "awaiting_confirmation"
    | "executing"
    | "focusing"
    | "completed"
    | "error";

const PRESENCE_COPY: Record<PresenceVisualState, string> = {
    idle: "Synapse disponível",
    connecting: "Preparando a conversa…",
    listening: "Ouvindo você",
    thinking: "Pensando…",
    speaking: "Respondendo…",
    awaiting_confirmation: "Diga “confirmar” ou “cancelar”",
    executing: "Realizando a ação…",
    focusing: "Conectando o resultado…",
    completed: "Concluído",
    error: "Não foi possível concluir",
};

export const SynapsePill = () => {
    const {
        actionExperience,
        execState,
        getVoiceInputSignal,
        getVoiceOutputSignal,
        isVoiceSpeaking,
        isVoiceToolActive,
        toggleVoiceMode,
        voiceActivityLabel,
        voicePhase,
        voiceStatus,
    } = useSynapse();
    const shouldReduceMotion = Boolean(useReducedMotion());

    const presenceState = useMemo<PresenceVisualState>(() => {
        if (voicePhase === "awaiting_confirmation") return "awaiting_confirmation";
        if (actionExperience?.phase === "error" || execState === "error" || voiceStatus === "error") return "error";
        if (isVoiceToolActive || execState === "executing") return "executing";
        if (actionExperience?.phase === "focusing") return "focusing";
        if (isVoiceSpeaking || voicePhase === "speaking") return "speaking";
        if (voiceStatus === "connecting" || voicePhase === "connecting" || voicePhase === "reconnecting") return "connecting";
        if (execState === "thinking" || voicePhase === "thinking" || actionExperience?.phase === "preparing" || actionExperience?.phase === "navigating") return "thinking";
        if (actionExperience?.phase === "completed" || execState === "success") return "completed";
        if (voiceStatus === "connected" || voicePhase === "listening") return "listening";
        return "idle";
    }, [actionExperience?.phase, execState, isVoiceSpeaking, isVoiceToolActive, voicePhase, voiceStatus]);

    const isVoiceSessionActive = voiceStatus === "connected" || voiceStatus === "connecting" || voiceStatus === "disconnecting";
    const showStatus = !["idle", "listening"].includes(presenceState);
    const statusText = actionExperience?.message || actionExperience?.label || voiceActivityLabel || PRESENCE_COPY[presenceState];

    return (
        <div className="relative flex w-full flex-col items-center gap-2.5" data-synapse-presence-state={presenceState}>
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {statusText}
            </span>

            <AnimatePresence initial={false}>
                {showStatus ? (
                    <motion.p
                        key={`${presenceState}-${actionExperience?.id || voiceActivityLabel || "presence"}`}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.99 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 38, mass: 0.72 }}
                        className="synapse-presence-status pointer-events-none max-w-[280px] truncate rounded-full border px-4 py-2 text-center text-[11px] font-medium text-foreground"
                    >
                        {statusText}
                    </motion.p>
                ) : null}
            </AnimatePresence>

            <motion.button
                type="button"
                onClick={() => void toggleVoiceMode()}
                disabled={voiceStatus === "disconnecting"}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 7, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.035 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.965 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32, mass: 0.72 }}
                className="synapse-presence-orb relative h-[61px] w-[61px] shrink-0 overflow-hidden rounded-full border-none outline-none focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
                aria-label={isVoiceSessionActive ? "Encerrar conversa por voz" : "Iniciar conversa por voz"}
                aria-keyshortcuts="Control+Shift+Space Meta+Shift+Space"
                aria-pressed={isVoiceSessionActive}
                title={isVoiceSessionActive ? "Encerrar conversa por voz" : "Conversar com o Synapse"}
            >
                <SynapseLiquidOrb
                    state={presenceState}
                    getInputSignal={getVoiceInputSignal}
                    getOutputSignal={getVoiceOutputSignal}
                    reducedMotion={shouldReduceMotion}
                />
            </motion.button>
        </div>
    );
};
