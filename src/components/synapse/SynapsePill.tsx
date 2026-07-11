import { motion, useReducedMotion } from "framer-motion";
import { AudioLines, Loader2, MessageCircle, Sparkles } from "lucide-react";

import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const controlClassName =
    "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

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
        isIntelligenceLoading,
    } = useSynapse();
    const { currentContext } = useAI();
    const { messages, isSending } = useSynapseChat();
    const shouldReduceMotion = Boolean(useReducedMotion());

    const isVoiceActive = voiceStatus === "connected";
    const isThinking = execState === "thinking" || execState === "executing" || isIntelligenceLoading || isSending;
    const contextLabel = CONTEXT_DISPLAY[currentContext] || "Synapse";
    const statusLabel = isVoiceActive
        ? isVoiceSpeaking
            ? "Respondendo"
            : "Ouvindo"
        : isThinking
            ? "Analisando"
            : contextLabel;

    if (shellState !== "pill") return null;

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
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
            className="relative"
            aria-label="Controles do Synapse"
        >
            <TooltipProvider delayDuration={300}>
                <div
                    className={cn(
                        "flex h-14 w-[204px] items-center gap-1 rounded-[18px] border border-border/70 bg-background/92 p-1.5",
                        "shadow-[0_18px_48px_-28px_hsl(var(--foreground)/0.38)] backdrop-blur-2xl",
                        "dark:border-white/[0.09] dark:bg-background/82 dark:shadow-[0_20px_54px_-28px_rgba(0,0,0,0.78)]",
                    )}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1.5" aria-live="polite">
                        <span
                            className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-background",
                                isVoiceActive && "bg-primary text-primary-foreground",
                            )}
                            aria-hidden="true"
                        >
                            {isThinking && !isVoiceActive ? (
                                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                        </span>
                        <span className="min-w-0 leading-none">
                            <span className="block truncate text-[13px] font-semibold text-foreground">Synapse</span>
                            <span className="mt-1 block max-w-[68px] truncate text-[10px] font-medium text-muted-foreground">
                                {statusLabel}
                            </span>
                        </span>
                    </div>

                    <span className="mx-0.5 h-6 w-px shrink-0 bg-border/70 dark:bg-white/[0.08]" aria-hidden="true" />

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <motion.button
                                type="button"
                                onClick={openVoice}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                                className={cn(
                                    controlClassName,
                                    isVoiceActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                                )}
                                aria-label={isVoiceActive ? "Abrir conversa por voz ativa" : "Iniciar conversa por voz"}
                                aria-pressed={isVoiceActive}
                            >
                                {isVoiceActive && !shouldReduceMotion ? (
                                    <span className="pointer-events-none absolute inset-0 opacity-45" aria-hidden="true">
                                        <VoiceSpiral
                                            totalDots={80}
                                            dotRadius={0.9}
                                            margin={0}
                                            isListening
                                            isProcessing={isVoiceSpeaking}
                                            getAudioVolume={getVoiceInputVolume}
                                            className="h-full w-full mix-blend-screen"
                                            minScale={0.8}
                                            maxScale={1.6}
                                        />
                                    </span>
                                ) : null}
                                <AudioLines className="relative z-10 h-[18px] w-[18px]" />
                            </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Voz</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <motion.button
                                type="button"
                                onClick={openChat}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                                className={controlClassName}
                                aria-label="Abrir conversa por texto"
                            >
                                <MessageCircle className="h-[18px] w-[18px]" />
                                {messages.length > 0 && execState === "idle" ? (
                                    <span
                                        className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--background))]"
                                        aria-hidden="true"
                                    />
                                ) : null}
                            </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Chat</TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </motion.div>
    );
};
