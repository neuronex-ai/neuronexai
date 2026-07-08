import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { AudioLines, CheckCircle2, Circle, Loader2, MessageCircle, Mic, Sparkles } from "lucide-react";

import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { useAI } from "@/context/AIContext";
import { useSynapse } from "@/context/SynapseProvider";
import { useSynapseChat } from "@/hooks/use-synapse-chat";
import { cn } from "@/lib/utils";

const CONTEXT_DISPLAY: Record<string, string> = {
    dashboard: "Dashboard",
    "patient-profile": "Paciente",
    patients: "Pacientes",
    calendar: "Agenda",
    finance: "Financeiro",
    session: "Teleconsulta",
    notes: "Notas",
    synapse: "Synapse AI",
};

const PILL_SIZE = {
    collapsed: 140,
    expanded: 292,
    voice: 64,
    idleHeight: 56,
    voiceHeight: 64,
} as const;

const spring = {
    shell: { type: "spring", stiffness: 420, damping: 38, mass: 0.82 },
    width: { type: "spring", stiffness: 360, damping: 36, mass: 0.9 },
    content: { type: "spring", stiffness: 440, damping: 34, mass: 0.72 },
    magnetic: { damping: 32, stiffness: 260, mass: 0.55 },
} as const;

const buttonClassName =
    "relative flex h-11 w-[58px] shrink-0 items-center justify-center overflow-hidden border border-border/35 bg-muted/35 text-muted-foreground transition-[background-color,color,border-color] duration-200 hover:border-border/60 hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.055] dark:bg-white/[0.035] dark:hover:border-white/[0.11] dark:hover:bg-white/[0.075]";

const quickActionClassName =
    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[1.15rem] border border-border/35 bg-background/62 text-muted-foreground shadow-sm transition-[background-color,color,border-color] duration-200 hover:border-border/60 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.055] dark:bg-white/[0.045] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.08]";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const SynapsePill = () => {
    const {
        execState,
        setShellState,
        shellState,
        setActiveTab,
        voiceStatus,
        isVoiceSpeaking,
        getVoiceInputVolume,
        setIsVoiceExpanded,
        quickActions,
        isIntelligenceLoading,
        scanProgress,
    } = useSynapse();
    const { currentContext } = useAI();
    const { messages, send, isSending } = useSynapseChat();
    const shouldReduceMotion = Boolean(useReducedMotion());
    const messageCount = messages.length;
    const contextLabel = CONTEXT_DISPLAY[currentContext] || "Synapse";

    const [isExpanded, setIsExpanded] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);
    const wasSendingRef = useRef(isSending);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const magneticX = useSpring(mouseX, spring.magnetic);
    const magneticY = useSpring(mouseY, spring.magnetic);

    const isVoiceActive = voiceStatus === "connected";
    const isThinking = execState === "thinking" || execState === "executing" || isIntelligenceLoading || isSending;
    const targetWidth = isVoiceActive ? PILL_SIZE.voice : isExpanded ? PILL_SIZE.expanded : PILL_SIZE.collapsed;
    const targetHeight = isVoiceActive ? PILL_SIZE.voiceHeight : PILL_SIZE.idleHeight;
    const transition = shouldReduceMotion ? { duration: 0 } : spring.width;

    useEffect(() => {
        if (wasSendingRef.current && !isSending && shellState === "pill") {
            setActiveTab("chat");
            setShellState("compact");
        }
        wasSendingRef.current = isSending;
    }, [isSending, setActiveTab, setShellState, shellState]);

    useEffect(() => {
        if (isVoiceActive) {
            setIsExpanded(false);
        }
    }, [isVoiceActive]);

    const resetMagnetism = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
        if (!isVoiceActive && event.pointerType !== "touch") {
            setIsExpanded(true);
        }
    };

    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (shouldReduceMotion || event.pointerType === "touch" || !pillRef.current) return;

        const rect = pillRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const magneticLimit = isExpanded ? 8 : 5;

        mouseX.set(clamp((event.clientX - centerX) * 0.055, -magneticLimit, magneticLimit));
        mouseY.set(clamp((event.clientY - centerY) * 0.07, -magneticLimit, magneticLimit));
    };

    const handlePointerLeave = () => {
        resetMagnetism();
        setIsExpanded(false);
    };

    const handleFocusCapture = () => {
        if (!isVoiceActive) {
            setIsExpanded(true);
        }
    };

    const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
        const nextFocusedElement = event.relatedTarget as Node | null;
        if (!pillRef.current?.contains(nextFocusedElement)) {
            setIsExpanded(false);
            resetMagnetism();
        }
    };

    if (shellState !== "pill") return null;

    return (
        <motion.div
            ref={pillRef}
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onFocusCapture={handleFocusCapture}
            onBlurCapture={handleBlurCapture}
            style={{
                x: shouldReduceMotion ? 0 : magneticX,
                y: shouldReduceMotion ? 0 : magneticY,
                transformOrigin: "100% 50%",
                willChange: "transform",
            }}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
            transition={shouldReduceMotion ? { duration: 0 } : spring.shell}
            className="relative flex items-center justify-end"
            aria-label="Controles do Synapse"
            aria-expanded={!isVoiceActive && isExpanded}
        >
            <motion.div
                animate={{ width: targetWidth, height: targetHeight }}
                transition={transition}
                className={cn(
                    "notes-liquid-surface relative isolate flex items-center justify-start overflow-hidden rounded-full border p-1.5 backdrop-blur-3xl",
                    "shadow-[0_18px_58px_-38px_hsl(var(--foreground)/0.42)]",
                )}
                style={{
                    willChange: "width, height",
                    contain: "layout paint",
                    transformOrigin: "100% 50%",
                }}
            >
                <AnimatePresence initial={false}>
                    {isThinking ? (
                        <motion.svg
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 text-foreground/30"
                            aria-hidden="true"
                        >
                            <motion.circle
                                cx="50%"
                                cy="50%"
                                r="47%"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray="100 100"
                                animate={shouldReduceMotion ? undefined : { strokeDashoffset: [100, 0] }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        </motion.svg>
                    ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false} mode="wait">
                    {isVoiceActive ? (
                        <motion.button
                            key="voice-active"
                            type="button"
                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                            transition={shouldReduceMotion ? { duration: 0 } : spring.content}
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                            onClick={() => {
                                setActiveTab("voice");
                                setShellState("compact");
                            }}
                            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted/45 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.055]"
                            aria-label="Abrir modo voz do Synapse"
                        >
                            {shouldReduceMotion ? (
                                <span className="absolute inset-2 rounded-full border border-foreground/10 bg-foreground/[0.035]" />
                            ) : (
                                <span className="absolute inset-0 opacity-45">
                                    <VoiceSpiral
                                        totalDots={110}
                                        dotRadius={1}
                                        margin={0}
                                        isListening
                                        isProcessing={isVoiceSpeaking}
                                        getAudioVolume={getVoiceInputVolume}
                                        className="h-full w-full mix-blend-multiply dark:mix-blend-screen"
                                        minScale={0.8}
                                        maxScale={1.8}
                                    />
                                </span>
                            )}
                            <Mic className="relative z-10 h-5 w-5" />
                        </motion.button>
                    ) : (
                        <motion.div
                            key="idle-mode"
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14 }}
                            className="relative z-10 flex h-full w-max items-center gap-1"
                        >
                            <motion.button
                                type="button"
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                                onClick={() => {
                                    setActiveTab("voice");
                                    setShellState("compact");
                                    setIsVoiceExpanded(true);
                                }}
                                className={cn(buttonClassName, "rounded-l-full rounded-r-[1.35rem]")}
                                aria-label="Abrir voz do Synapse"
                            >
                                <AudioLines className="h-[18px] w-[18px]" />
                            </motion.button>

                            <motion.button
                                type="button"
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                                onClick={() => {
                                    setActiveTab("chat");
                                    setShellState("compact");
                                }}
                                className={cn(buttonClassName, "rounded-l-[1.35rem] rounded-r-full")}
                                aria-label="Abrir chat do Synapse"
                            >
                                <MessageCircle className="h-[18px] w-[18px]" />
                                {messageCount > 0 && execState === "idle" ? (
                                    <span className="absolute right-2.5 top-2 h-[6px] w-[6px] rounded-full bg-foreground/70 shadow-[0_0_0_2px_hsl(var(--background))]" />
                                ) : null}
                            </motion.button>

                            <motion.div
                                animate={isExpanded ? "expanded" : "collapsed"}
                                variants={{
                                    collapsed: { opacity: 0, x: 14, scale: 0.98 },
                                    expanded: { opacity: 1, x: 0, scale: 1 },
                                }}
                                transition={shouldReduceMotion ? { duration: 0 } : spring.content}
                                className={cn(
                                    "ml-1 flex h-11 shrink-0 items-center gap-1.5 pr-1",
                                    !isExpanded && "pointer-events-none",
                                )}
                                aria-hidden={!isExpanded}
                            >
                                <div className="mx-1 h-5 w-px shrink-0 bg-border/70 dark:bg-white/[0.08]" />
                                {quickActions.slice(0, 2).map((action) => (
                                    <motion.button
                                        key={action.id}
                                        type="button"
                                        tabIndex={isExpanded ? 0 : -1}
                                        whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                                        onClick={() => void send(action.name)}
                                        className={quickActionClassName}
                                        aria-label={`Executar ${action.name}`}
                                        title={action.name}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" />
                                    </motion.button>
                                ))}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                    {isThinking && !isIntelligenceLoading ? (
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                            className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-background/78 backdrop-blur-md dark:bg-background/68"
                        >
                            <Sparkles
                                className={cn(
                                    "h-5 w-5 text-muted-foreground",
                                    !shouldReduceMotion && execState === "executing" && "animate-spin-slow",
                                    !shouldReduceMotion && (execState === "thinking" || isSending) && "animate-pulse",
                                )}
                            />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>

            <AnimatePresence initial={false}>
                {!isExpanded && !isVoiceActive ? (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: 6, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 6, scale: 0.98 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
                        className="pointer-events-none absolute right-full mr-3 flex flex-col items-end gap-1"
                    >
                        {isIntelligenceLoading ? (
                            <div className="notes-liquid-surface min-w-[180px] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-2xl">
                                <div className="mb-2 flex items-center justify-between border-b border-border/35 pb-1.5 dark:border-white/[0.055]">
                                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Escaneamento global</span>
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground motion-reduce:animate-none" />
                                </div>
                                <div className="space-y-1.5">
                                    {scanProgress.map((item) => (
                                        <div key={item.module} className="flex items-center justify-between gap-4">
                                            <span className="text-[10px] font-medium text-foreground/70">{item.label}</span>
                                            {item.status === "completed" ? (
                                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            ) : item.status === "scanning" ? (
                                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground motion-reduce:animate-none" />
                                            ) : (
                                                <Circle className="h-3 w-3 text-muted-foreground/45" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : execState === "idle" ? (
                            <div className="notes-liquid-surface flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 shadow-xl backdrop-blur-2xl">
                                <span className="h-1.5 w-1.5 rounded-full bg-foreground/55" />
                                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">{contextLabel}</span>
                            </div>
                        ) : null}
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </motion.div>
    );
};