import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import {
    AnimatePresence,
    motion,
    useMotionValue,
    useSpring,
} from "framer-motion";
import { AudioLines, MessageCircle } from "lucide-react";

import { useSynapse } from "@/context/SynapseContext";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";
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

type SynapsePillProps = {
    mode?: "launcher" | "voice-presence";
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const launcherMagneticSpring = {
    stiffness: 300,
    damping: 34,
    mass: 0.5,
} as const;

export const SynapsePill = ({ mode = "launcher" }: SynapsePillProps) => {
    const {
        actionExperience,
        execState,
        getVoiceInputSignal,
        getVoiceOutputSignal,
        isVoiceSpeaking,
        isVoiceToolActive,
        setActiveTab,
        setShellState,
        toggleVoiceMode,
        voiceActivityLabel,
        voicePhase,
        voiceStatus,
    } = useSynapse();
    const shouldReduceMotion = useReducedMotionPreference();
    const launcherRef = useRef<HTMLDivElement>(null);
    const launcherX = useMotionValue(0);
    const launcherY = useMotionValue(0);
    const magneticX = useSpring(launcherX, launcherMagneticSpring);
    const magneticY = useSpring(launcherY, launcherMagneticSpring);

    useEffect(() => {
        if (!shouldReduceMotion) return;
        launcherX.set(0);
        launcherY.set(0);
    }, [launcherX, launcherY, shouldReduceMotion]);

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

    if (mode === "launcher") {
        const resetMagnetism = () => {
            launcherX.set(0);
            launcherY.set(0);
        };

        const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
            if (shouldReduceMotion || event.pointerType === "touch" || !launcherRef.current) return;

            const rect = launcherRef.current.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            launcherX.set(clamp((event.clientX - centerX) * 0.035, -5, 5));
            launcherY.set(clamp((event.clientY - centerY) * 0.045, -4, 4));
        };

        const openTextConversation = () => {
            setActiveTab("chat");
            setShellState("compact");
        };

        const openVoiceConversation = () => {
            setShellState("pill");
            void toggleVoiceMode();
        };

        return (
            <motion.div
                ref={launcherRef}
                className="synapse-launcher relative flex h-[56px] w-[128px] items-center rounded-full border p-[5px]"
                role="toolbar"
                aria-label="Conversar com o Synapse"
                data-synapse-launcher="true"
                data-theme-adaptive="true"
                data-magnetic-motion={shouldReduceMotion ? "reduced" : "enabled"}
                onPointerMove={handlePointerMove}
                onPointerLeave={resetMagnetism}
                onPointerCancel={resetMagnetism}
                style={{
                    x: shouldReduceMotion ? 0 : magneticX,
                    y: shouldReduceMotion ? 0 : magneticY,
                    willChange: shouldReduceMotion ? "auto" : "transform",
                }}
            >
                    <motion.button
                        type="button"
                        onClick={openVoiceConversation}
                        disabled={voiceStatus === "disconnecting"}
                        whileHover={shouldReduceMotion ? undefined : { y: -0.5, scale: 1.012 }}
                        whileTap={shouldReduceMotion ? undefined : { y: 0.5, scale: 0.982 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36, mass: 0.6 }}
                        className="synapse-launcher-action flex h-[46px] flex-1 items-center justify-center rounded-l-full rounded-r-[18px] outline-none disabled:cursor-wait disabled:opacity-60"
                        aria-label="Iniciar conversa por voz com o Synapse"
                        aria-keyshortcuts="Control+Shift+Space Meta+Shift+Space"
                        aria-pressed={isVoiceSessionActive}
                        data-synapse-action="voice"
                        title="Conversar por voz"
                    >
                        <AudioLines className="h-[19px] w-[19px]" strokeWidth={1.75} aria-hidden="true" />
                    </motion.button>
                    <span className="synapse-launcher-divider h-8 w-px shrink-0" aria-hidden="true" />
                    <motion.button
                        type="button"
                        onClick={openTextConversation}
                        whileHover={shouldReduceMotion ? undefined : { y: -0.5, scale: 1.012 }}
                        whileTap={shouldReduceMotion ? undefined : { y: 0.5, scale: 0.982 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36, mass: 0.6 }}
                        className="synapse-launcher-action flex h-[46px] flex-1 items-center justify-center rounded-l-[18px] rounded-r-full outline-none"
                        aria-label="Abrir conversa por texto com o Synapse"
                        aria-controls="synapse-panel"
                        data-synapse-action="text"
                        title="Conversar por texto"
                    >
                        <MessageCircle className="h-[19px] w-[19px]" strokeWidth={1.75} aria-hidden="true" />
                    </motion.button>
            </motion.div>
        );
    }

    return (
        <div className="relative flex w-full items-center justify-center" data-synapse-presence-state={presenceState}>
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {statusText}
            </span>

            <div className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 flex h-9 w-[min(320px,calc(100vw-32px))] -translate-x-1/2 items-center justify-center">
                <AnimatePresence initial={false}>
                    {showStatus ? (
                        <motion.p
                            key="synapse-presence-status"
                            initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.985 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.99 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 38, mass: 0.72 }}
                            className="synapse-presence-status max-w-[320px] truncate rounded-full border px-4 py-2 text-center text-[11px] font-medium text-foreground"
                        >
                            <AnimatePresence initial={false} mode="wait">
                                <motion.span
                                    key={statusText}
                                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, filter: "blur(3px)" }}
                                    animate={{ opacity: 1, filter: "blur(0px)" }}
                                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="block truncate"
                                >
                                    {statusText}
                                </motion.span>
                            </AnimatePresence>
                        </motion.p>
                    ) : null}
                </AnimatePresence>
            </div>

            <motion.button
                type="button"
                onClick={() => void toggleVoiceMode()}
                disabled={voiceStatus === "disconnecting"}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 7, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.025 }}
                whileTap={shouldReduceMotion ? undefined : { y: 1, scale: 0.972 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32, mass: 0.72 }}
                className="synapse-presence-orb relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-full border-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-70"
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
