import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Sparkles, MessageCircle, AudioLines, Mic, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSynapse } from '@/context/SynapseProvider';
import { useAI } from '@/context/AIContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { VoiceSpiral } from '@/components/ai-chat/VoiceSpiral';
import { useState, useRef, useEffect } from 'react';

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

    const handleMouseMove = (e: React.MouseEvent) => {
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
            {/* SVG Filter for Gooey Effect (Tópico 3) */}
            <svg className="hidden">
                <defs>
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        <feBlend in="SourceGraphic" in2="goo" />
                    </filter>
                </defs>
            </svg>

            <motion.div
                ref={pillRef}
                layoutId="synapse-shell"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={() => setIsHovered(true)}
                style={{ x: magneticX, y: magneticY }}
                initial={{ scale: 0.2, opacity: 0, filter: 'blur(15px)' }}
                animate={{ 
                    scale: 1, 
                    opacity: 1, 
                    filter: 'blur(0px)',
                    width: isHovered ? 280 : (isVoiceActive ? 64 : 140),
                    backgroundColor: isIntelligenceLoading ? 'rgba(99, 102, 241, 0.08)' : undefined
                }}
                exit={{ 
                    scale: 0.8, // More subtle exit scale for better morphing
                    opacity: 0, 
                    filter: 'blur(15px)',
                    transition: { duration: 0.3 }
                }}
                transition={{ 
                    type: 'spring', 
                    stiffness: 450, // Slightly snappier
                    damping: 35, 
                    mass: 0.8,
                    width: { type: 'spring', stiffness: 300, damping: 30 }
                }}
                className={cn(
                    'group relative flex items-center p-1.5 gap-[3px]',
                    'h-14 rounded-full overflow-hidden',
                    'bg-white dark:bg-[#0a0a0c]',
                    'backdrop-blur-3xl saturate-150',
                    'border border-zinc-200 dark:border-white/[0.04]',
                    'shadow-[0_8px_32px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.04)]',
                    'transition-all duration-500',
                    isVoiceActive && 'h-16 w-16 !p-0 !bg-indigo-50/80 dark:!bg-indigo-400/10 border-indigo-200 dark:border-indigo-500/30'
                )}
                aria-label="Controles do Synapse"
            >
                {/* ── Intelligence Scanning Beam ────────────────────────── */}
                <AnimatePresence>
                    {isIntelligenceLoading && (
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: '200%' }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                            className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-indigo-500/15 to-transparent skew-x-12 pointer-events-none"
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
                                    "transition-colors duration-500",
                                    isIntelligenceLoading ? "text-indigo-500/40" : (execState === 'thinking' || isSending ? "text-purple-500/30" : "text-amber-500/30")
                                )}
                                animate={{ strokeDashoffset: [100, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        </motion.svg>
                    )}
                </AnimatePresence>

                {/* ── Contextual Aura ─────────────────────────────────── */}
                <AnimatePresence>
                    {(isHovered || isIntelligenceLoading) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ 
                                opacity: 1, 
                                scale: 1,
                                y: [0, -4, 0]
                            }}
                            exit={{ opacity: 0, scale: 0 }}
                            className={cn(
                                "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full z-20 shadow-[0_0_10px_rgba(99,102,241,0.5)]",
                                isIntelligenceLoading ? "bg-purple-500" : "bg-indigo-500"
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
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => {
                                setActiveTab('voice');
                                setShellState('compact');
                            }}
                            className="w-full h-full flex items-center justify-center relative overflow-hidden rounded-full"
                        >
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
                            <Mic className="w-5 h-5 text-indigo-500 dark:text-indigo-400 relative z-10" />
                        </motion.button>
                    ) : (
                        <motion.div
                            key="idle-mode"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center w-full h-full gap-1"
                            style={{ filter: isHovered ? 'url(#goo)' : 'none' }}
                        >
                            {/* Base Buttons */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setActiveTab('voice');
                                    setShellState('compact');
                                    setIsVoiceExpanded(true);
                                }}
                                className={cn(
                                    "flex-1 h-full rounded-l-full rounded-r-[16px] flex items-center justify-center gap-2",
                                    "bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.08]",
                                    "border border-black/[0.02] dark:border-white/[0.02]",
                                    "transition-all duration-300 group/voice ease-out active:scale-[0.96]"
                                )}
                            >
                                <AudioLines className="w-[18px] h-[18px] text-zinc-500 dark:text-zinc-400 group-hover/voice:text-indigo-500 dark:group-hover/voice:text-indigo-400 transition-colors" />
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    setActiveTab('chat');
                                    setShellState('compact');
                                }}
                                className={cn(
                                    "flex-1 h-full rounded-r-full rounded-l-[16px] flex items-center justify-center gap-2 relative",
                                    "bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.08]",
                                    "border border-black/[0.02] dark:border-white/[0.02]",
                                    "transition-all duration-300 group/text ease-out active:scale-[0.96]"
                                )}
                            >
                                <MessageCircle className="w-[18px] h-[18px] text-zinc-500 dark:text-zinc-400 group-hover/text:text-zinc-900 dark:group-hover/text:text-zinc-200 transition-colors" />
                                {messageCount > 0 && execState === 'idle' && (
                                    <div className="absolute top-2 right-2.5 w-[6px] h-[6px] rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-[0_0_0_2px_rgba(255,255,255,1)] dark:shadow-[0_0_0_2px_rgba(10,10,12,1)]" />
                                )}
                            </motion.button>

                            {/* Quick Actions Revealed on Hover */}
                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="flex items-center gap-1.5 ml-1 pr-2"
                                    >
                                        <div className="w-[1px] h-4 bg-black/10 dark:bg-white/10 mx-1" />
                                        {quickActions.slice(0, 2).map((action) => (
                                            <motion.button
                                                key={action.id}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => send(action.name)}
                                                className="w-8 h-8 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm hover:bg-white dark:hover:bg-white/20 transition-all"
                                                title={action.name}
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
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
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="absolute right-full mr-4 flex flex-col items-end gap-1 pointer-events-none"
                        >
                            {isIntelligenceLoading ? (
                                <div className="px-4 py-3 rounded-2xl bg-white/95 dark:bg-zinc-950/95 border border-black/10 dark:border-white/10 backdrop-blur-3xl shadow-2xl min-w-[180px]">
                                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-black/10 dark:border-white/10">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">Escaneamento Global</span>
                                        <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500 dark:text-indigo-400" />
                                    </div>
                                    <div className="space-y-1.5">
                                        {scanProgress.map((p) => (
                                            <div key={p.module} className="flex items-center justify-between gap-4">
                                                <span className="text-[10px] font-medium text-zinc-900/70 dark:text-white/70">{p.label}</span>
                                                {p.status === 'completed' ? (
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                ) : p.status === 'scanning' ? (
                                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                                ) : (
                                                    <Circle className="w-3 h-3 text-black/20 dark:text-white/20" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : execState === 'idle' && (
                                <div className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-black/5 dark:border-white/[0.08] backdrop-blur-3xl whitespace-nowrap shadow-xl flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/70 dark:bg-purple-400/70 animate-pulse" />
                                    <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 tracking-wide">
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
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute inset-0 flex items-center justify-center bg-zinc-50/80 dark:bg-[#0a0a0c]/80 backdrop-blur-md z-10"
                        >
                            <Sparkles
                                className={cn(
                                    'h-5 w-5 transition-colors duration-300',
                                    (execState === 'thinking' || isSending) && 'text-purple-500 animate-pulse',
                                    execState === 'executing' && 'text-amber-500 animate-spin-slow'
                                )}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
};