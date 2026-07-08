import { motion, AnimatePresence, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { Sparkles, MessageCircle, AudioLines, Mic, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSynapse } from '@/context/SynapseProvider';
import { useAI } from '@/context/AIContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { VoiceSpiral } from '@/components/ai-chat/VoiceSpiral';
import { useState, useRef, useEffect, type MouseEvent } from 'react';

// ─── Context Display Names ────────────────────────────────────────────

const CONTEXT_DISPLAY: Record<string, string> = {
    dashboard: 'Dashboard',
    'patient-profile': 'Paciente',
    patients: 'Pacientes',
    calendar: 'Agenda',
    finance: 'Financeiro',
    session: 'Teleconsulta',
    notes: 'Notas',
    synapse: 'Synapse AI',
};

// ─── Component ────────────────────────────────────────────────────────

export const SynapsePill = () => {
    const {
        execState, setShellState, shellState, setActiveTab,
        voiceStatus, isVoiceSpeaking, getVoiceInputVolume, setIsVoiceExpanded,
        quickActions, isIntelligenceLoading, scanProgress
    } = useSynapse();
    const { currentContext } = useAI();
    const { messages, send, isSending } = useSynapseChat();
    const messageCount = messages.length;
    const contextLabel = CONTEXT_DISPLAY[currentContext] || 'Synapse';

    const [isHovered, setIsHovered] = useState(false);
    const pillRef = useRef<HTMLDivElement>(null);
    const wasSendingRef = useRef(isSending);
    const shouldReduceMotion = useReducedMotion();

    // ─── Proactive Expansion (Tópico: Expandir após resposta) ───────────
    useEffect(() => {
        // If we were sending and now we aren't, and we are in pill mode, expand.
        if (wasSendingRef.current && !isSending && shellState === 'pill') {
            const timeout = setTimeout(() => {
                setShellState('compact');
                setActiveTab('chat');
            }, 600); // Small delay to appreciate the pill's success state
            return () => clearTimeout(timeout);
        }
        wasSendingRef.current = isSending;
    }, [isSending, shellState, setShellState, setActiveTab]);

    // ─── Magnetic Effect (Tópico 1) ────────────────────────────────────
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 200, mass: 0.5 };
    const magneticX = useSpring(mouseX, springConfig);
    const magneticY = useSpring(mouseY, springConfig);

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (shouldReduceMotion) return;
        if (!pillRef.current) return;
        const rect = pillRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Displacement
        mouseX.set((e.clientX - centerX) * 0.15);
        mouseY.set((e.clientY - centerY) * 0.15);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
        setIsHovered(false);
    };

    if (shellState !== 'pill') return null;

    // ─── States ────────────────────────────────────────────────────────
    const isVoiceActive = voiceStatus === 'connected';
    const isThinking = execState === 'thinking' || execState === 'executing' || isIntelligenceLoading || isSending;

    return (
        <>
            <motion.div
                ref={pillRef}
                layoutId="synapse-shell"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={() => setIsHovered(true)}
                style={{ x: shouldReduceMotion ? 0 : magneticX, y: shouldReduceMotion ? 0 : magneticY }}
                initial={shouldReduceMotion ? false : { scale: 0.92, opacity: 0, filter: 'blur(8px)' }}
                animate={{
                    scale: 1,
                    opacity: 1,
                    filter: 'blur(0px)',
                    width: isHovered ? 280 : (isVoiceActive ? 64 : 140)
                }}
                exit={{
                    scale: shouldReduceMotion ? 1 : 0.96,
                    opacity: 0,
                    filter: shouldReduceMotion ? 'blur(0px)' : 'blur(8px)',
                    transition: { duration: shouldReduceMotion ? 0 : 0.22 }
                }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                    type: 'spring',
                    stiffness: 420,
                    damping: 35,
                    mass: 0.8,
                    width: { type: 'spring', stiffness: 300, damping: 30 }
                }}
                className={cn(
                    'notes-liquid-surface group relative flex h-14 items-center gap-[3px] overflow-hidden rounded-full border p-1.5 text-foreground',
                    'border-foreground/[0.105] bg-background/84 shadow-[0_18px_54px_-38px_hsl(var(--foreground)/0.42)] backdrop-blur-3xl saturate-150',
                    'dark:border-white/[0.075] dark:bg-[#09090b]/88 dark:shadow-[0_18px_58px_-38px_rgba(0,0,0,0.92)]',
                    'transition-all duration-300 motion-reduce:transition-none',
                    isVoiceActive && 'h-16 w-16 !p-0 border-foreground/[0.12] !bg-background/88 dark:border-white/[0.1] dark:!bg-white/[0.065]'
                )}
                aria-label="Controles do Synapse"
            >
                {/* ── Intelligence Scanning Beam ────────────────────────── */}
                <AnimatePresence>
                    {isIntelligenceLoading && !shouldReduceMotion && (
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: '200%' }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                            className="pointer-events-none absolute inset-0 w-1/2 skew-x-12 bg-gradient-to-r from-transparent via-foreground/[0.105] to-transparent"
                        />
                    )}
                </AnimatePresence>

                {/* ── Progress Ring ───────────────────────────────────── */}
                <AnimatePresence>
                    {isThinking && (
                        <motion.svg
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                        >
                            <motion.circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray="100 100"
                                className={cn(
                                    "transition-colors duration-500 motion-reduce:transition-none",
                                    isIntelligenceLoading ? "text-foreground/28" : (execState === 'thinking' || isSending ? "text-foreground/22" : "text-amber-500/34")
                                )}
                                animate={{ strokeDashoffset: shouldReduceMotion ? 28 : [100, 0] }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        </motion.svg>
                    )}
                </AnimatePresence>

                {/* ── Contextual Aura ─────────────────────────────────── */}
                <AnimatePresence>
                    {!shouldReduceMotion && (isHovered || isIntelligenceLoading) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                y: [0, -4, 0]
                            }}
                            exit={{ opacity: 0, scale: 0 }}
                            className={cn(
                                "absolute -right-1 -top-1 z-20 h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_hsl(var(--background)/0.72)]",
                                isIntelligenceLoading ? "bg-foreground" : "bg-muted-foreground"
                            )}
                            transition={{
                                y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                                opacity: { duration: 0.2 },
                                scale: { duration: 0.2 }
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* ── Voice Holographic Mode ──────────────────────────── */}
                <AnimatePresence mode="wait">
                    {isVoiceActive ? (
                        <motion.button
                            key="voice-active"
                            type="button"
                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                            onClick={() => {
                                setActiveTab('voice');
                                setShellState('compact');
                            }}
                            className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label="Abrir conversa por voz do Synapse"
                        >
                            {shouldReduceMotion ? (
                                <div className="absolute inset-1 rounded-full border border-foreground/[0.12] bg-muted/45 dark:border-white/[0.1] dark:bg-white/[0.055]" />
                            ) : (
                                <div className="absolute inset-0 opacity-40">
                                    <VoiceSpiral
                                        totalDots={150}
                                        dotRadius={1}
                                        margin={0}
                                        isListening={true}
                                        isProcessing={isVoiceSpeaking}
                                        getAudioVolume={getVoiceInputVolume}
                                        className="w-full h-full mix-blend-screen"
                                        minScale={0.8}
                                        maxScale={2}
                                    />
                                </div>
                            )}
                            <Mic className="relative z-10 h-5 w-5 text-foreground" />
                        </motion.button>
                    ) : (
                        <motion.div
                            key="idle-mode"
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center w-full h-full gap-1"
                            style={{ filter: 'none' }}
                        >
                            {/* Base Buttons */}
                            <motion.button
                                type="button"
                                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                                onClick={() => {
                                    setActiveTab('voice');
                                    setShellState('compact');
                                    setIsVoiceExpanded(true);
                                }}
                                className={cn(
                                    "flex-1 h-full rounded-l-full rounded-r-[16px] flex items-center justify-center gap-2",
                                    "border border-foreground/[0.085] bg-background/62 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.075] dark:bg-white/[0.045]",
                                    "transition-all duration-300 group/voice ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:active:scale-100"
                                )}
                                aria-label="Abrir voz do Synapse"
                            >
                                <AudioLines className="h-[18px] w-[18px] transition-colors" />
                            </motion.button>

                            <motion.button
                                type="button"
                                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
                                onClick={() => {
                                    setActiveTab('chat');
                                    setShellState('compact');
                                }}
                                className={cn(
                                    "flex-1 h-full rounded-r-full rounded-l-[16px] flex items-center justify-center gap-2 relative",
                                    "border border-foreground/[0.085] bg-background/62 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/[0.075] dark:bg-white/[0.045]",
                                    "transition-all duration-300 group/text ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:active:scale-100"
                                )}
                                aria-label="Abrir chat do Synapse"
                            >
                                <MessageCircle className="h-[18px] w-[18px] transition-colors" />
                                {messageCount > 0 && execState === 'idle' && (
                                    <div className="absolute right-2.5 top-2 h-[6px] w-[6px] rounded-full bg-foreground shadow-[0_0_0_2px_hsl(var(--background))]" />
                                )}
                            </motion.button>

                            {/* Quick Actions Revealed on Hover */}
                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                                        className="flex items-center gap-1.5 ml-1 pr-2"
                                    >
                                        <div className="w-[1px] h-4 bg-black/10 dark:bg-white/10 mx-1" />
                                        {quickActions.slice(0, 2).map((action) => (
                                            <motion.button
                                                key={action.id}
                                                type="button"
                                                whileHover={shouldReduceMotion ? undefined : { scale: 1.08 }}
                                                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                                                onClick={() => send(action.name)}
                                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-foreground/[0.085] bg-background/78 text-muted-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/[0.075] dark:bg-white/[0.055] motion-reduce:transition-none"
                                                title={action.name}
                                                aria-label={`Executar ação rápida: ${action.name}`}
                                            >
                                                <Sparkles className="h-3.5 w-3.5" />
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Context Label / Scan Tooltip (Only when idle or scanning) ── */}
                <AnimatePresence>
                    {!isHovered && !isVoiceActive && (
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                            className="absolute right-full mr-4 flex flex-col items-end gap-1 pointer-events-none"
                        >
                            {isIntelligenceLoading ? (
                                <div className="min-w-[180px] rounded-2xl border border-foreground/[0.085] bg-background/92 px-4 py-3 shadow-2xl backdrop-blur-3xl dark:border-white/[0.075] dark:bg-[#09090b]/94">
                                    <div className="mb-2 flex items-center justify-between border-b border-foreground/[0.08] pb-1.5 dark:border-white/[0.06]">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Escaneamento Global</span>
                                        <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground motion-reduce:animate-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        {scanProgress.map((p) => (
                                            <div key={p.module} className="flex items-center justify-between gap-4">
                                                <span className="text-[10px] font-medium text-foreground/72">{p.label}</span>
                                                {p.status === 'completed' ? (
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                ) : p.status === 'scanning' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground motion-reduce:animate-none" />
                                                ) : (
                                                    <Circle className="h-3 w-3 text-muted-foreground/34" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : execState === 'idle' && (
                                <div className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-foreground/[0.075] bg-background/90 px-3 py-1.5 shadow-xl backdrop-blur-3xl dark:border-white/[0.07] dark:bg-[#09090b]/92">
                                    <div className="h-1.5 w-1.5 rounded-full bg-foreground/70 motion-safe:animate-pulse" />
                                    <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                                        {contextLabel}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Executing State Overlays ───────────────────────────── */}
                <AnimatePresence>
                    {(isThinking && !isIntelligenceLoading) && (
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 z-10 flex items-center justify-center bg-background/84 backdrop-blur-md dark:bg-[#0a0a0c]/84"
                        >
                            <Sparkles
                                className={cn(
                                    'h-5 w-5 text-foreground transition-colors duration-300 motion-reduce:transition-none',
                                    (execState === 'thinking' || isSending) && 'motion-safe:animate-pulse',
                                    execState === 'executing' && 'text-amber-500 motion-safe:animate-spin-slow'
                                )}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
};
