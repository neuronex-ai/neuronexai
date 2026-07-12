import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
    AudioLines,
    Check,
    Loader2,
    MessageCircle,
    ShieldCheck,
    TriangleAlert,
} from "lucide-react";

import { useSynapse } from "@/context/SynapseProvider";
import { cn } from "@/lib/utils";

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

const PRESENCE_COPY: Record<PresenceVisualState, { label: string; detail: string }> = {
    idle: { label: "Synapse", detail: "Pronto para conversar" },
    connecting: { label: "Preparando voz", detail: "Conectando ao canal seguro" },
    listening: { label: "Ouvindo", detail: "Fale naturalmente" },
    thinking: { label: "Pensando", detail: "Organizando a solicitação" },
    speaking: { label: "Respondendo", detail: "O Synapse está falando" },
    awaiting_confirmation: { label: "Aguardando confirmação", detail: "Confirme ou cancele explicitamente" },
    executing: { label: "Executando", detail: "Aplicando a solicitação no sistema" },
    focusing: { label: "Conectando resultado", detail: "Destacando a informação na tela" },
    completed: { label: "Concluído", detail: "Resultado conectado" },
    error: { label: "Não foi possível concluir", detail: "Revise a solicitação e tente novamente" },
};

const progressForPhase = (phase?: string) => {
    if (phase === "preparing") return 16;
    if (phase === "navigating") return 48;
    if (phase === "focusing") return 82;
    if (phase === "completed") return 100;
    return undefined;
};

export const SynapsePill = () => {
    const {
        actionExperience,
        activeTab,
        execState,
        getVoiceInputVolume,
        isVoiceSpeaking,
        isVoiceToolActive,
        setActiveTab,
        setShellState,
        shellState,
        toggleVoiceMode,
        voiceActivityLabel,
        voiceActivityMessage,
        voicePhase,
        voiceStatus,
    } = useSynapse();
    const shouldReduceMotion = Boolean(useReducedMotion());
    const audioSurfaceRef = useRef<HTMLSpanElement>(null);
    const chatButtonRef = useRef<HTMLButtonElement>(null);
    const previousShellStateRef = useRef(shellState);
    const volumeReaderRef = useRef(getVoiceInputVolume);
    volumeReaderRef.current = getVoiceInputVolume;

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
    const isPanelOpen = shellState === "compact";
    const isBusy = ["connecting", "thinking", "executing", "focusing"].includes(presenceState);
    const showStatusCard = !["idle", "listening", "speaking"].includes(presenceState);
    const statusTitle = actionExperience?.label || voiceActivityLabel || PRESENCE_COPY[presenceState].label;
    const statusDetail = actionExperience?.message || voiceActivityMessage || PRESENCE_COPY[presenceState].detail;
    const progress = progressForPhase(actionExperience?.phase);

    useEffect(() => {
        const wasOpen = previousShellStateRef.current === "compact";
        previousShellStateRef.current = shellState;
        if (!wasOpen || shellState !== "pill" || isVoiceSessionActive) return;
        const frame = window.requestAnimationFrame(() => chatButtonRef.current?.focus());
        return () => window.cancelAnimationFrame(frame);
    }, [isVoiceSessionActive, shellState]);

    useEffect(() => {
        const surface = audioSurfaceRef.current;
        if (!surface) return;

        const animatedState = presenceState === "listening" || presenceState === "speaking";
        if (shouldReduceMotion || !animatedState) {
            surface.style.transform = "scale(0.9)";
            surface.style.opacity = "0.72";
            return;
        }

        let frame = 0;
        const tick = (time: number) => {
            const rawLevel = presenceState === "listening"
                ? volumeReaderRef.current()
                : (Math.sin(time / 210) + 1) / 2;
            const level = Math.max(0, Math.min(1, Number(rawLevel) || 0));
            surface.style.transform = `scale(${(0.88 + level * 0.24).toFixed(3)})`;
            surface.style.opacity = (0.68 + level * 0.28).toFixed(3);
            frame = window.requestAnimationFrame(tick);
        };
        const start = () => {
            if (!frame && document.visibilityState !== "hidden") frame = window.requestAnimationFrame(tick);
        };
        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                window.cancelAnimationFrame(frame);
                frame = 0;
            } else {
                start();
            }
        };

        start();
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.cancelAnimationFrame(frame);
        };
    }, [presenceState, shouldReduceMotion]);

    const togglePanel = () => {
        if (isPanelOpen) {
            setShellState("pill");
            return;
        }
        setActiveTab("chat");
        setShellState("compact");
    };

    const toggleVoice = () => {
        void toggleVoiceMode();
    };

    const orbSize = isVoiceSessionActive ? 60 : presenceState === "idle" ? 48 : 52;
    const dockWidth = isVoiceSessionActive ? 68 : 112;
    const stateCopy = PRESENCE_COPY[presenceState];

    return (
        <div className="relative flex w-full flex-col items-center gap-2.5" data-synapse-presence-state={presenceState}>
            <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {statusTitle}. {statusDetail}
            </span>

            <AnimatePresence initial={false}>
                {showStatusCard ? (
                    <motion.aside
                        key={`${presenceState}-${actionExperience?.id || voiceActivityLabel || "presence"}`}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 7, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.99 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 38, mass: 0.74 }}
                        className="synapse-presence-status pointer-events-none w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[20px] border px-3.5 py-3 text-left"
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <span className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border",
                                presenceState === "error" && "text-destructive",
                            )}>
                                {presenceState === "error" ? <TriangleAlert className="h-4 w-4" />
                                    : presenceState === "completed" ? <Check className="h-4 w-4" />
                                        : presenceState === "awaiting_confirmation" ? <ShieldCheck className="h-4 w-4" />
                                            : <Loader2 className={cn("h-4 w-4", !shouldReduceMotion && "animate-spin")} />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-semibold text-foreground">{statusTitle}</p>
                                <p className="mt-1 line-clamp-2 text-[10px] leading-[1.45] text-muted-foreground">{statusDetail}</p>
                            </div>
                        </div>
                        {(isBusy || progress !== undefined) ? (
                            <div
                                className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/[0.075]"
                                role="progressbar"
                                aria-label="Progresso do Synapse"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={progress}
                            >
                                {progress === undefined ? (
                                    <motion.span
                                        className="block h-full w-1/3 rounded-full bg-foreground/70"
                                        animate={shouldReduceMotion ? undefined : { x: ["-110%", "310%"] }}
                                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                                    />
                                ) : (
                                    <motion.span
                                        className="block h-full rounded-full bg-foreground/70"
                                        initial={false}
                                        animate={{ width: `${Math.max(4, progress)}%` }}
                                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                    />
                                )}
                            </div>
                        ) : null}
                    </motion.aside>
                ) : null}
            </AnimatePresence>

            <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, width: dockWidth }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38, mass: 0.76 }}
                className="synapse-presence-dock relative flex h-[68px] items-center justify-center gap-1.5 overflow-hidden rounded-full border p-1"
                role="toolbar"
                aria-label="Presença Synapse"
            >
                <motion.button
                    type="button"
                    onClick={toggleVoice}
                    disabled={voiceStatus === "disconnecting"}
                    animate={{ width: orbSize, height: orbSize }}
                    transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 36, mass: 0.72 }}
                    className={cn(
                        "synapse-presence-orb relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-zinc-950",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "disabled:cursor-wait disabled:opacity-70",
                    )}
                    aria-label={isVoiceSessionActive ? "Encerrar conversa por voz" : "Iniciar conversa por voz"}
                    aria-keyshortcuts="Control+Shift+Space Meta+Shift+Space"
                    aria-pressed={isVoiceSessionActive}
                    title={`${stateCopy.label} — ${isVoiceSessionActive ? "encerrar voz" : "iniciar voz"}`}
                >
                    <span className="absolute inset-[5px] rounded-full border border-black/[0.10]" aria-hidden="true" />
                    <span
                        ref={audioSurfaceRef}
                        className="synapse-presence-orb-surface absolute inset-[9px] rounded-full"
                        aria-hidden="true"
                    />
                    {isBusy && !shouldReduceMotion ? (
                        <motion.span
                            className="absolute inset-[4px] rounded-full border border-zinc-950/35 border-r-transparent"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.25, repeat: Infinity, ease: "linear" }}
                            aria-hidden="true"
                        />
                    ) : null}
                    <span className="relative z-10 flex items-center justify-center" aria-hidden="true">
                        {presenceState === "error" ? <TriangleAlert className="h-[17px] w-[17px]" />
                            : presenceState === "completed" ? <Check className="h-[17px] w-[17px]" />
                                : presenceState === "awaiting_confirmation" ? <ShieldCheck className="h-[17px] w-[17px]" />
                                    : <AudioLines className="h-[17px] w-[17px]" />}
                    </span>
                </motion.button>

                <AnimatePresence initial={false}>
                    {!isVoiceSessionActive ? (
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 46 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 40 }}
                            className="flex items-center justify-center overflow-hidden"
                        >
                            <button
                                ref={chatButtonRef}
                                type="button"
                                onClick={togglePanel}
                                data-synapse-chat-toggle="true"
                                className={cn(
                                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
                                    "hover:bg-foreground/[0.065] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    isPanelOpen && activeTab !== "voice" && "bg-foreground text-background hover:bg-foreground hover:text-background",
                                )}
                                aria-label={isPanelOpen ? "Recolher conversa por texto" : "Abrir conversa por texto"}
                                aria-keyshortcuts="Control+J Meta+J"
                                aria-expanded={isPanelOpen}
                                aria-controls="synapse-panel"
                                title="Conversa por texto (Ctrl+J)"
                            >
                                <MessageCircle className="h-[18px] w-[18px]" />
                            </button>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
