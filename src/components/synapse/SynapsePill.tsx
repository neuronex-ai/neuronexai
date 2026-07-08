import { useEffect, useRef, useState, type MouseEvent } from "react";
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

const neutralButtonClassName =
    "flex h-full flex-1 items-center justify-center gap-2 border border-border/35 bg-muted/35 text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-white/[0.055] dark:bg-white/[0.035] dark:hover:bg-white/[0.07]";

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
    const shouldReduceMotion = useReducedMotion();
    const messageCount = messages.length;
    const contextLabel = CONTEXT_DISPLAY[currentContext] || "Synapse";

    const [isHovered, setIsHovered] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);
    const wasSendingRef = useRef(isSending);
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
    const magneticX = useSpring(mouseX, springConfig);
    const magneticY = useSpring(mouseY, springConfig);

    useEffect(() => {
        if (wasSendingRef.current && !isSending && shellState === "pill") {
            const timeout = window.setTimeout(() => {
                setShellState("compact");
                setActiveTab("chat");
            }, shouldReduceMotion ? 0 : 500);
            return () => window.clearTimeout(timeout);
        }
        wasSendingRef.current = isSending;
    }, [isSending, setActiveTab, setShellState, shellState, shouldReduceMotion]);

    const handleMouseMove = (event: MouseEvent) => {
        if (shouldReduceMotion || !pillRef.current) return;
        const rect = pillRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        mouseX.set((event.clientX - centerX) * 0.08);
        mouseY.set((event.clientY - centerY) * 0.08);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
        setIsHovered(false);
    };

    if (shellState !== "pill") return null;

    const isVoiceActive = voiceStatus === "connected";
    const isThinking = execState === "thinking" || execState === "executing" || isIntelligenceLoading || isSending;
    const width = isHovered ? 280 : isVoiceActive ? 64 : 140;

    return (
        <motion.div
            ref={pillRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={() => setIsHovered(true)}
            style={{ 
                x: shouldReduceMotion ? 0 : magneticX, 
                y: shouldReduceMotion ? 0 : magneticY,
                willChange: "transform, opacity, width"
            }}
            layout
            initial={shouldReduceMotion ? false : { scale: 0.9, opacity: 0, y: 14 }}
            animate={{ scale: 1, opacity: 1, y: 0, width }}
            exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.85, opacity: 0, y: 20 }}
            transition={shouldReduceMotion ? { duration: 0 } : { 
                type: "spring", 
                stiffness: 400, 
                damping: 34,
                mass: 0.8,
                width: { type: "spring", stiffness: 350, damping: 30, mass: 0.9 },
                layout: { type: "spring", stiffness: 400, damping: 34 }
            }}
            className={cn(
                "notes-liquid-surface group relative flex h-14 items-center gap-1 overflow-hidden rounded-full border p-1.5 backdrop-blur-3xl",
                "shadow-[0_18px_58px_-38px_hsl(var(--foreground)/0.42)]",
                isVoiceActive && "h-16 !p-0",
            )}
            aria-label="Controles do Synapse"
        >
            <AnimatePresence>
                {isThinking ? (
                    <motion.svg
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90 text-foreground/35"
                        aria-hidden="true"
                    >
                        <motion.circle
                            cx="50%"
                            cy="50%"
                            r="48%"
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

            <AnimatePresence mode="wait">
                {isVoiceActive ? (
                    <motion.button
                        key="voice-active"
                        type="button"
                        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
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
                        className="flex h-full w-full items-center gap-1"
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("voice");
                                setShellState("compact");
                                setIsVoiceExpanded(true);
                            }}
                            className={cn(neutralButtonClassName, "rounded-l-full rounded-r-2xl")}
                            aria-label="Abrir voz do Synapse"
                        >
                            <AudioLines className="h-[18px] w-[18px]" />
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("chat");
                                setShellState("compact");
                            }}
                            className={cn(neutralButtonClassName, "relative rounded-l-2xl rounded-r-full")}
                            aria-label="Abrir chat do Synapse"
                        >
                            <MessageCircle className="h-[18px] w-[18px]" />
                            {messageCount > 0 && execState === "idle" ? (
                                <span className="absolute right-2.5 top-2 h-[6px] w-[6px] rounded-full bg-foreground/70 shadow-[0_0_0_2px_hsl(var(--background))]" />
                            ) : null}
                        </button>

                        <AnimatePresence>
                            {isHovered ? (
                                <motion.div
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                    className="ml-1 flex items-center gap-1.5 pr-2"
                                >
                                    <div className="mx-1 h-4 w-px bg-border/70 dark:bg-white/[0.08]" />
                                    {quickActions.slice(0, 2).map((action) => (
                                        <button
                                            key={action.id}
                                            type="button"
                                            onClick={() => send(action.name)}
                                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/35 bg-background/68 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.055] dark:bg-white/[0.045]"
                                            aria-label={`Executar ${action.name}`}
                                            title={action.name}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </button>
                                    ))}
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!isHovered && !isVoiceActive ? (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                        className="pointer-events-none absolute right-full mr-4 flex flex-col items-end gap-1"
                    >
                        {isIntelligenceLoading ? (
                            <div className="notes-liquid-surface min-w-[180px] rounded-2xl border px-4 py-3 shadow-2xl">
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
                            <div className="notes-liquid-surface flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 shadow-xl">
                                <span className="h-1.5 w-1.5 rounded-full bg-foreground/55" />
                                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">{contextLabel}</span>
                            </div>
                        ) : null}
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <AnimatePresence>
                {isThinking && !isIntelligenceLoading ? (
                    <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                        className="absolute inset-0 z-10 flex items-center justify-center bg-background/78 backdrop-blur-md dark:bg-background/68"
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
    );
};
