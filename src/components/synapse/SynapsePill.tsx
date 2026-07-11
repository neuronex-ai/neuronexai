import { useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { AudioLines, Loader2, MessageCircle, Sparkles } from "lucide-react";

import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSynapse } from "@/context/SynapseProvider";
import { useSynapseChat } from "@/hooks/use-synapse-chat";
import { cn } from "@/lib/utils";

const PILL_SIZE = {
    collapsed: 140,
    expanded: 248,
    voice: 64,
    idleHeight: 56,
    voiceHeight: 64,
} as const;

const spring = {
    shell: { type: "spring", stiffness: 430, damping: 38, mass: 0.78 },
    width: { type: "spring", stiffness: 390, damping: 36, mass: 0.82 },
    content: { type: "spring", stiffness: 470, damping: 36, mass: 0.66 },
    magnetic: { stiffness: 300, damping: 34, mass: 0.5 },
} as const;

const primaryControlClassName =
    "relative flex h-11 w-[58px] shrink-0 items-center justify-center overflow-hidden border border-border/45 bg-background/42 text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.045)] transition-[background-color,color,border-color,box-shadow] duration-150 hover:border-border/75 hover:bg-muted/75 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.07] dark:bg-black/20 dark:hover:border-white/[0.13] dark:hover:bg-white/[0.075]";

const quickControlClassName =
    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/52 text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)] transition-[background-color,color,border-color,box-shadow] duration-150 hover:border-border/80 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.075] dark:bg-white/[0.035] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.085]";

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
    } = useSynapse();
    const { messages, send, isSending } = useSynapseChat();
    const shouldReduceMotion = Boolean(useReducedMotion());
    const [isExpanded, setIsExpanded] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);
    const wasSendingRef = useRef(isSending);

    const rawX = useMotionValue(0);
    const rawY = useMotionValue(0);
    const magneticX = useSpring(rawX, spring.magnetic);
    const magneticY = useSpring(rawY, spring.magnetic);

    const isVoiceActive = voiceStatus === "connected";
    const isThinking = execState === "thinking" || execState === "executing" || isIntelligenceLoading || isSending;
    const targetWidth = isVoiceActive ? PILL_SIZE.voice : isExpanded ? PILL_SIZE.expanded : PILL_SIZE.collapsed;
    const targetHeight = isVoiceActive ? PILL_SIZE.voiceHeight : PILL_SIZE.idleHeight;

    useEffect(() => {
        if (wasSendingRef.current && !isSending && shellState === "pill") {
            setActiveTab("chat");
            setShellState("compact");
        }
        wasSendingRef.current = isSending;
    }, [isSending, setActiveTab, setShellState, shellState]);

    useEffect(() => {
        if (isVoiceActive) setIsExpanded(false);
    }, [isVoiceActive]);

    if (shellState !== "pill") return null;

    const resetMagnetism = () => {
        rawX.set(0);
        rawY.set(0);
    };

    const handleMouseEnter = () => {
        if (!isVoiceActive) setIsExpanded(true);
    };

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        if (shouldReduceMotion || !pillRef.current) return;
        const rect = pillRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        rawX.set(clamp((event.clientX - centerX) * 0.035, -5, 5));
        rawY.set(clamp((event.clientY - centerY) * 0.045, -4, 4));
    };

    const handleMouseLeave = () => {
        resetMagnetism();
        setIsExpanded(false);
    };

    const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
        const nextFocusedElement = event.relatedTarget as Node | null;
        if (!pillRef.current?.contains(nextFocusedElement)) {
            resetMagnetism();
            setIsExpanded(false);
        }
    };

    const openVoice = () => {
        setActiveTab("voice");
        setShellState("compact");
        setIsVoiceExpanded(true);
    };

    const openChat = () => {
        setActiveTab("chat");
        setShellState("compact");
    };

    return (
        <TooltipProvider delayDuration={260}>
            <motion.div
                ref={pillRef}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onFocusCapture={() => !isVoiceActive && setIsExpanded(true)}
                onBlurCapture={handleBlurCapture}
                style={{
                    x: shouldReduceMotion ? 0 : magneticX,
                    y: shouldReduceMotion ? 0 : magneticY,
                    transformOrigin: "100% 50%",
                    willChange: "transform",
                }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
                transition={shouldReduceMotion ? { duration: 0 } : spring.shell}
                className="group relative flex items-center justify-end"
                aria-label="Controles do Synapse"
                aria-expanded={!isVoiceActive && isExpanded}
            >
                <motion.div
                    animate={{ width: targetWidth, height: targetHeight }}
                    transition={shouldReduceMotion ? { duration: 0 } : spring.width}
                    className={cn(
                        "notes-liquid-surface synapse-glass-texture relative isolate flex items-center justify-start overflow-hidden rounded-full border p-1.5 backdrop-blur-3xl",
                        !isVoiceActive && "transition-[width] duration-300 ease-out group-hover:!w-[248px] group-focus-within:!w-[248px] motion-reduce:duration-0",
                        "shadow-[0_20px_56px_-30px_hsl(var(--foreground)/0.52),inset_0_1px_0_hsl(var(--background)/0.62)]",
                        "dark:shadow-[0_24px_66px_-28px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.075)]",
                    )}
                    style={{ contain: "layout paint", transformOrigin: "100% 50%", willChange: "width, height" }}
                >
                    <AnimatePresence initial={false} mode="wait">
                        {isVoiceActive ? (
                            <motion.button
                                key="voice-active"
                                type="button"
                                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                                transition={shouldReduceMotion ? { duration: 0 } : spring.content}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.95, y: 1 }}
                                onClick={openVoice}
                                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-foreground/[0.07] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.055]"
                                aria-label="Abrir conversa por voz ativa"
                            >
                                {!shouldReduceMotion ? (
                                    <span className="absolute inset-0 opacity-55" aria-hidden="true">
                                        <VoiceSpiral
                                            totalDots={100}
                                            dotRadius={0.95}
                                            margin={0}
                                            isListening
                                            isProcessing={isVoiceSpeaking}
                                            getAudioVolume={getVoiceInputVolume}
                                            className="h-full w-full mix-blend-multiply dark:mix-blend-screen"
                                            minScale={0.8}
                                            maxScale={1.72}
                                        />
                                    </span>
                                ) : null}
                                <AudioLines className="relative z-10 h-[18px] w-[18px]" />
                            </motion.button>
                        ) : (
                            <motion.div
                                key="idle"
                                initial={shouldReduceMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14 }}
                                className="relative z-10 flex h-full w-max items-center gap-1"
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <motion.button
                                            type="button"
                                            onClick={openVoice}
                                            whileTap={shouldReduceMotion ? undefined : { scale: 0.95, y: 1 }}
                                            className={cn(primaryControlClassName, "rounded-l-full rounded-r-[14px]")}
                                            aria-label="Iniciar conversa por voz"
                                        >
                                            <AudioLines className="h-[18px] w-[18px]" />
                                        </motion.button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Voz</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <motion.button
                                            type="button"
                                            onClick={openChat}
                                            whileTap={shouldReduceMotion ? undefined : { scale: 0.95, y: 1 }}
                                            className={cn(primaryControlClassName, "rounded-l-[14px] rounded-r-full")}
                                            aria-label="Abrir conversa por texto"
                                        >
                                            <MessageCircle className="h-[18px] w-[18px]" />
                                            {messages.length > 0 && execState === "idle" ? (
                                                <span className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full bg-foreground/75 shadow-[0_0_0_2px_hsl(var(--background))]" aria-hidden="true" />
                                            ) : null}
                                        </motion.button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Chat</TooltipContent>
                                </Tooltip>

                                <motion.div
                                    animate={isExpanded ? "expanded" : "collapsed"}
                                    variants={{
                                        collapsed: { opacity: 0, x: 10, scale: 0.98 },
                                        expanded: { opacity: 1, x: 0, scale: 1 },
                                    }}
                                    transition={shouldReduceMotion ? { duration: 0 } : spring.content}
                                    className={cn(
                                        "ml-1 flex h-11 shrink-0 items-center gap-1.5 pr-0.5 transition-[opacity] duration-150",
                                        !isExpanded && "pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto group-hover:!opacity-100 group-focus-within:!opacity-100",
                                    )}
                                >
                                    <span className="mx-0.5 h-5 w-px shrink-0 bg-border/70 dark:bg-white/[0.09]" aria-hidden="true" />
                                    {quickActions.slice(0, 2).map((action) => (
                                        <Tooltip key={action.id}>
                                            <TooltipTrigger asChild>
                                                <motion.button
                                                    type="button"
                                                    tabIndex={0}
                                                    onClick={() => void send(action.name)}
                                                    whileTap={shouldReduceMotion ? undefined : { scale: 0.93, y: 1 }}
                                                    className={quickControlClassName}
                                                    aria-label={`Executar ${action.name}`}
                                                >
                                                    {isSending ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                                                    ) : (
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                    )}
                                                </motion.button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">{action.name}</TooltipContent>
                                        </Tooltip>
                                    ))}
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                        {isThinking && !isVoiceActive ? (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="pointer-events-none absolute inset-x-4 bottom-0 h-px overflow-hidden bg-foreground/10"
                                aria-hidden="true"
                            >
                                <motion.span
                                    className="block h-full w-1/3 bg-foreground/65"
                                    animate={shouldReduceMotion ? undefined : { x: ["-100%", "400%"] }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
                                />
                            </motion.span>
                        ) : null}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </TooltipProvider>
    );
};
