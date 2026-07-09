import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VoiceSpiral } from '@/components/ai-chat/VoiceSpiral';
import { useSynapse } from '@/context/SynapseProvider';
import { useAI } from '@/context/AIContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import {
    X,
    ArrowUp,
    Loader2,
    Sparkles,
    Calendar,
    Users,
    TrendingUp,
    Stethoscope,
    Notebook,
    Copy,
    Check,
    History,
    Activity,
    Trash2,
    Plus,
    Mic,
    ChevronRight,
    AudioLines,
    PhoneOff,
    MessageSquare,
    Smartphone,
    MousePointer2,
    RefreshCw,
    Target,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseSynapseWidgetFromContent } from '@/lib/synapse-widget-parser';
import { SynapseWidgetRenderer } from './SynapseWidgetRenderer';
import { SynapseAllActionsModal } from './SynapseAllActionsModal';
import { supabase } from '@/integrations/supabase/client';
import { SynapseOrbAvatar } from './SynapseOrbAvatar';
import {
    executeSynapseInterfaceAction,
    type SynapseInterfaceAction,
} from '@/lib/synapse-interface-actions';

const CONTEXT_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
    dashboard: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Dashboard' },
    'patient-profile': { icon: <Users className="h-3.5 w-3.5" />, label: 'Paciente' },
    patients: { icon: <Users className="h-3.5 w-3.5" />, label: 'Pacientes' },
    calendar: { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Agenda' },
    finance: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Financeiro' },
    session: { icon: <Stethoscope className="h-3.5 w-3.5" />, label: 'Teleconsulta' },
    notes: { icon: <Notebook className="h-3.5 w-3.5" />, label: 'Notas' },
    synapse: { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Synapse AI' },
};

type AgentActionItem = {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType<{ className?: string }>;
    action: SynapseInterfaceAction;
};

type ChatSessionRow = {
    id: string;
    title?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
    context_state?: {
        source?: string | null;
        remoteJid?: string | null;
        pushName?: string | null;
        phoneNumber?: string | null;
        conversation_kind?: 'patient' | 'psychologist' | null;
    } | null;
};

type SpeechRecognitionEventLike = {
    results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type MarkdownPreProps = React.ComponentPropsWithoutRef<'pre'> & { node?: unknown };
type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> & {
    node?: unknown;
    inline?: boolean;
    className?: string;
};

const AGENT_ACTIONS: AgentActionItem[] = [
    {
        id: 'open-daily-schedule',
        label: 'Agenda do dia',
        description: 'Abre a agenda diaria e destaca a grade.',
        icon: Calendar,
        action: { action: 'open_daily_schedule', reason: 'Abrindo agenda diaria' },
    },
    {
        id: 'new-appointment',
        label: 'Novo agendamento',
        description: 'Abre o modal completo de agendamento.',
        icon: Plus,
        action: { action: 'open_modal', modal: 'new_appointment', reason: 'Abrindo novo agendamento' },
    },
    {
        id: 'new-patient',
        label: 'Novo paciente',
        description: 'Abre o cadastro de prontuario.',
        icon: Users,
        action: { action: 'open_modal', modal: 'new_patient', reason: 'Abrindo cadastro de paciente' },
    },
    {
        id: 'new-transaction',
        label: 'Novo lancamento',
        description: 'Abre o registro financeiro manual.',
        icon: TrendingUp,
        action: { action: 'open_modal', modal: 'new_transaction', reason: 'Abrindo lancamento financeiro' },
    },
    {
        id: 'go-patients',
        label: 'Ir a pacientes',
        description: 'Navega para a lista de pacientes.',
        icon: Users,
        action: { action: 'navigate', target: 'patients', reason: 'Abrindo pacientes' },
    },
    {
        id: 'go-finance',
        label: 'Ir ao financeiro',
        description: 'Navega para a gestao financeira.',
        icon: TrendingUp,
        action: { action: 'navigate', target: 'finance', reason: 'Abrindo financeiro' },
    },
    {
        id: 'highlight-schedule',
        label: 'Destacar agenda',
        description: 'Realca a area principal da agenda.',
        icon: Target,
        action: { action: 'highlight_element', element: 'daily_schedule', reason: 'Destacando agenda' },
    },
];

const EXEC_STATE_LABELS = {
    idle: 'Pronto',
    listening: 'Ouvindo',
    thinking: 'Analisando',
    executing: 'Executando',
    success: 'Concluido',
    error: 'Atencao',
} as const;

export const SynapseCompactPanel = () => {
    const shouldReduceMotion = useReducedMotion();
    const {
        shellState,
        setShellState,
        quickActions,
        availableTools,
        inputDraft,
        setInputDraft,
        timeline,
        addTimelineEntry,
        activeTab,
        setActiveTab,
        execState,
        setExecState,
        voiceStatus,
        isVoiceSpeaking,
        isVoiceToolActive,
        voiceActivityLabel,
        voiceActivityMessage,
        getVoiceInputVolume,
        toggleVoiceMode,
        setActiveSessionId,
        dailyActions,
        isIntelligenceLoading,
        scanProgress,
        syncDailyIntelligence,
    } = useSynapse();
    const { currentContext } = useAI();
    const { send, messages, isSending, sessionReady, clearSession } = useSynapseChat();
    const navigate = useNavigate();

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [showAllActions, setShowAllActions] = useState(false);
    const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [historyChannel, setHistoryChannel] = useState<'neuronex' | 'whatsapp'>('neuronex');

    useEffect(() => {
        if (activeTab === 'history') {
            const fetchSessions = async () => {
                setIsLoadingSessions(true);
                try {
                    const { data, error } = await supabase
                        .from('chat_sessions')
                        .select('id,title,updated_at,created_at,context_state')
                        .order('updated_at', { ascending: false })
                        .limit(40);

                    if (error) {
                        console.error("Error fetching sessions:", error);
                    } else if (data) {
                        const filtered = (data as ChatSessionRow[]).filter((session) => {
                            if (session.title?.startsWith('NeuroPulse Analysis')) return false;
                            const isWhatsApp = session.context_state?.source === 'whatsapp';
                            return historyChannel === 'whatsapp' ? isWhatsApp : !isWhatsApp;
                        });
                        setSessions(filtered);
                    }
                } catch (err) {
                    console.error("Error fetching sessions:", err);
                } finally {
                    setIsLoadingSessions(false);
                }
            };
            fetchSessions();
        }
    }, [activeTab, historyChannel]);

    useEffect(() => {
        if (shellState === 'compact' && activeTab === 'voice' && voiceStatus === 'disconnected') {
            const timeout = setTimeout(() => toggleVoiceMode(), 300);
            return () => clearTimeout(timeout);
        }
    }, [shellState, activeTab, voiceStatus, toggleVoiceMode]);

    // Handle updates safely
    const stableSetInputDraft = useRef(setInputDraft);
    useEffect(() => { stableSetInputDraft.current = setInputDraft; }, [setInputDraft]);

    const inputDraftRef = useRef(inputDraft);
    useEffect(() => { inputDraftRef.current = inputDraft; }, [inputDraft]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const speechWindow = window as WindowWithSpeechRecognition;
            const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.lang = 'pt-BR';

                recognition.onresult = (event: SpeechRecognitionEventLike) => {
                    const transcript = event.results[event.results.length - 1][0].transcript;
                    const current = inputDraftRef.current;
                    stableSetInputDraft.current(current ? current + ' ' + transcript : transcript);
                };

                recognition.onerror = (event: { error: string }) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleCopy = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleActionClick = (toolName: string) => {
        const formattedName = toolName.replace(/_/g, ' ');
        send(formattedName);
        setShowAllActions(false);
    };

    const dailyActionCount = Object.values(dailyActions).reduce((total, actions) => total + actions.length, 0);
    const recentAgentTimeline = timeline.slice(-4).reverse();
    const agentBusy = execState === 'thinking' || execState === 'executing' || isIntelligenceLoading;

    const runAgentAction = async (item: AgentActionItem) => {
        setActiveTab('agent');
        setExecState('executing');
        addTimelineEntry({
            label: `Agente: ${item.label}`,
            state: 'executing',
            detail: item.description,
        });

        const result = await executeSynapseInterfaceAction(item.action, { navigate, channel: 'text' });
        addTimelineEntry({
            label: result.success ? `${item.label} concluido` : `${item.label} falhou`,
            state: result.success ? 'success' : 'error',
            detail: result.message,
        });
        setExecState(result.success ? 'success' : 'error');
        window.setTimeout(() => setExecState('idle'), 1400);
    };

    const handleDailySync = async () => {
        setActiveTab('agent');
        addTimelineEntry({
            label: 'Agente: varredura diaria',
            state: 'thinking',
            detail: 'Atualizando contexto por modulo',
        });
        await syncDailyIntelligence();
    };

    const ctxInfo = CONTEXT_LABELS[currentContext] || { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Synapse' };

    useEffect(() => {
        if (shellState === 'compact') {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [shellState]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (shellState !== 'compact') return null;

    const handleSend = () => {
        if (!inputDraft.trim() || !sessionReady) return;
        send(inputDraft.trim());
        setInputDraft('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isSending) handleSend();
        }
    };

    const handleVoiceButtonClick = () => {
        if (activeTab === 'voice') {
            setActiveTab('chat');
            if (voiceStatus !== 'disconnected') {
                toggleVoiceMode();
            }
        } else {
            setActiveTab('voice');
        }
    };

    const voiceModeLabel = isVoiceToolActive
        ? 'Consultando no sistema'
        : isVoiceSpeaking
            ? 'Respondendo'
            : voiceStatus === 'connected'
                ? 'Modo de Voz Ativo'
                : 'Conectando...';
    const voiceModeDescription = isVoiceToolActive
        ? voiceActivityMessage || (voiceActivityLabel ? `Executando ${voiceActivityLabel}. Voce ainda pode interromper ou complementar por voz.` : 'Executando a solicitacao no sistema. Voce ainda pode interromper ou complementar por voz.')
        : voiceStatus === 'connected'
            ? 'O Synapse esta ouvindo em tempo real. Fale naturalmente para realizar acoes ou tirar duvidas.'
            : 'Preparando conexao de voz em tempo real.';

    return (
        <>
            <motion.div
                style={{ willChange: "transform, opacity, filter" }}
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={shouldReduceMotion ? { opacity: 0 } : {
                    opacity: 0,
                    scale: 0.92,
                    y: 12,
                    filter: 'blur(8px)',
                    transition: {
                        duration: 0.22,
                        ease: [0.32, 0, 0.67, 0],
                    }
                }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                    type: 'spring',
                    stiffness: 400,
                    damping: 34,
                    mass: 1,
                }}
                className={cn(
                    'w-[480px] h-[640px]',
                    'rounded-[36px]',
                    'relative overflow-hidden',
                    'flex flex-col',
                    'notes-liquid-surface border backdrop-blur-3xl',
                    'shadow-[0_40px_100px_-42px_hsl(var(--foreground)/0.42)] dark:shadow-[0_40px_100px_-34px_rgba(0,0,0,0.72)]',
                )}
            >
                <div className="notes-lumen-field pointer-events-none absolute inset-0 opacity-55" />
                <div className="notes-retina-texture pointer-events-none absolute inset-0 opacity-45" />

                <div className="relative z-10 flex flex-col h-full max-h-[620px]">
                    <div className="flex items-center justify-between px-7 pt-7 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[14px] font-black uppercase tracking-[0.24em] text-foreground">
                                Synapse AI
                            </span>
                        </div>

                        <div className="flex items-center gap-2 p-1 bg-white/50 dark:bg-white/[0.04] rounded-full border border-black/[0.03] dark:border-white/[0.05] shadow-sm">
                            <button
                                onClick={() => setActiveTab(activeTab === 'history' ? 'chat' : 'history')}
                                className={cn("p-1.5 rounded-full transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeTab === 'history' ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/55 hover:text-foreground")}
                                title="Histórico"
                                aria-label="Abrir histórico"
                            >
                                <History className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setActiveTab(activeTab === 'timeline' ? 'chat' : 'timeline')}
                                className={cn("p-1.5 rounded-full transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeTab === 'timeline' ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/55 hover:text-foreground")}
                                title="Atividade"
                                aria-label="Abrir atividade"
                            >
                                <Activity className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setActiveTab(activeTab === 'agent' ? 'chat' : 'agent')}
                                className={cn("p-1.5 rounded-full transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeTab === 'agent' ? "bg-foreground/10 text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/55 hover:text-foreground")}
                                title="Agente"
                                aria-label="Abrir modo agente"
                            >
                                <MousePointer2 className="h-4 w-4" />
                            </button>
                            <div className="w-[1px] h-4 bg-border/70 dark:bg-white/[0.08] mx-0.5" />
                            <button
                                onClick={handleVoiceButtonClick}
                                className={cn(
                                    "p-1.5 rounded-full transition-all duration-300 relative overflow-hidden active:scale-95",
                                    voiceStatus === 'connected' ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted/55 hover:text-foreground"
                                )}
                                title="Voz"
                                aria-label={activeTab === 'voice' ? "Fechar modo de voz" : "Abrir modo de voz"}
                            >
                                {voiceStatus === 'connected' ? (
                                    <>
                                        <PhoneOff className="h-4 w-4 relative z-10" />
                                        {!shouldReduceMotion && (
                                            <motion.div className="absolute inset-0 bg-foreground/10" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                                        )}
                                    </>
                                ) : (
                                    <AudioLines className="h-4 w-4" />
                                )}
                            </button>
                            {messages.length > 0 && (
                                <button
                                    onClick={clearSession}
                                    className="p-1.5 rounded-full text-muted-foreground transition-all duration-300 hover:bg-red-500/10 hover:text-red-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-red-400"
                                    title="Limpar"
                                    aria-label="Limpar conversa"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={clearSession}
                                className="p-1.5 rounded-full bg-primary text-primary-foreground border border-transparent shadow-md hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-300 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Nova Conversa"
                                aria-label="Criar nova conversa"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setShellState('pill')}
                                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted/55 hover:text-foreground transition-all duration-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="Fechar"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        className={cn(
                            'flex-1 min-h-0 overflow-y-auto px-5 relative',
                            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/20 dark:scrollbar-thumb-white/15',
                        )}
                    >
                        <AnimatePresence initial={false} mode="wait">
                            {activeTab === 'history' ? (
                                <motion.div
                                    key="history"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col py-6 gap-4"
                                >
                                    <div className="flex items-center justify-between px-2 mb-2">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Conversas Recentes</h3>
                                        {isLoadingSessions && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                    </div>

                                    <div className="mx-2 mb-2 grid grid-cols-2 rounded-[18px] border border-black/[0.04] bg-white/65 p-1 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm dark:border-white/[0.045] dark:bg-white/[0.03]">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('neuronex')}
                                            className={cn(
                                                "h-10 rounded-[14px] transition-all",
                                                historyChannel === 'neuronex'
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "hover:bg-muted/55"
                                            )}
                                        >
                                            NeuroNex
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('whatsapp')}
                                            className={cn(
                                                "h-10 rounded-[14px] transition-all",
                                                historyChannel === 'whatsapp'
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "hover:bg-muted/55"
                                            )}
                                        >
                                            WhatsApp Business
                                        </button>
                                    </div>

                                    {sessions.length === 0 && !isLoadingSessions ? (
                                        <div className="text-center py-20 opacity-40 flex flex-col items-center gap-4">
                                            <MessageSquare className="w-8 h-8" />
                                            <p className="text-[11px] font-bold uppercase tracking-widest">
                                                {historyChannel === 'whatsapp' ? 'Nenhuma conversa WhatsApp' : 'Nenhuma conversa salva'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {sessions.map((session) => {
                                                const isWpp = session.context_state?.source === 'whatsapp';
                                                const isPsychologist = session.context_state?.conversation_kind === 'psychologist';
                                                const title = isWpp
                                                    ? isPsychologist
                                                        ? 'Voce e Synapse'
                                                        : session.context_state?.pushName || session.title?.replace(/^WhatsApp Business\s*-\s*/i, '') || session.context_state?.phoneNumber || 'Paciente'
                                                    : session.title || 'Conversa sem titulo';
                                                return (
                                                    <button
                                                        key={session.id}
                                                        onClick={() => {
                                                            setActiveSessionId(session.id);
                                                            setActiveTab('chat');
                                                        }}
                                                        className="group relative flex w-full items-center justify-between overflow-hidden rounded-[28px] border border-border/35 bg-background/58 p-5 text-left transition-all duration-300 hover:bg-muted/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.055] dark:bg-white/[0.025]"
                                                    >
                                                        {isWpp && (
                                                            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-bl-[14px]">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                                                    {isPsychologist ? 'Profissional' : 'Paciente'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                                                                isWpp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted/65 text-muted-foreground"
                                                            )}>
                                                                {isWpp ? <Smartphone className="w-5 h-5" /> : <MessageSquare className="w-4 h-4" />}
                                                            </div>
                                                            <div className="flex flex-col mt-1">
                                                                <span className="text-[13px] font-bold tracking-tight">{title}</span>
                                                                <span className="text-[9px] font-mono opacity-40 uppercase tracking-widest">
                                                                    {session.updated_at ? new Date(session.updated_at).toLocaleDateString('pt-BR') : 'Sem data'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-100 transition-all ml-2" />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                            ) : activeTab === 'timeline' ? (
                                <motion.div
                                    key="timeline"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col py-4 gap-4"
                                >
                                    {timeline.length === 0 ? (
                                        <div className="text-center text-muted-foreground text-[11px] mt-10">Nenhuma atividade registrada.</div>
                                    ) : (
                                        timeline.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/28 dark:bg-white/[0.18] mt-1" />
                                                    {idx !== timeline.length - 1 && <div className="w-[1px] h-full bg-border/60 dark:bg-white/[0.05] mt-1" />}
                                                </div>
                                                <div className="flex flex-col flex-1 pb-4">
                                                    <span className="text-[10px] font-mono text-muted-foreground mb-0.5">{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</span>
                                                    <span className="text-[13px] text-foreground font-medium">{entry.label}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </motion.div>
                            ) : activeTab === 'agent' ? (
                                <motion.div
                                    key="agent"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex flex-col py-5 gap-4"
                                >
                                    <div className="rounded-[28px] bg-white/65 dark:bg-white/[0.032] border border-black/[0.04] dark:border-white/[0.045] p-5 shadow-sm dark:shadow-[0_20px_56px_-46px_rgba(0,0,0,0.8)]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-muted-foreground">Modo agente</span>
                                                <h3 className="text-[17px] font-black tracking-tight text-foreground">Controle de tela</h3>
                                            </div>
                                            <span className={cn(
                                                "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                                                execState === 'error'
                                                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                                    : execState === 'success'
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                        : agentBusy
                                                            ? "bg-foreground/10 text-foreground"
                                                            : "bg-foreground/[0.06] text-muted-foreground dark:bg-white/[0.055]"
                                            )}>
                                                {EXEC_STATE_LABELS[execState]}
                                            </span>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-2.5">
                                            {AGENT_ACTIONS.map((item) => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => void runAgentAction(item)}
                                                        disabled={agentBusy}
                                                        className="group flex min-h-[88px] flex-col items-start justify-between rounded-[22px] border border-border/35 bg-background/62 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-muted/55 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0 dark:border-white/[0.045] dark:bg-white/[0.03]"
                                                    >
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-current" />
                                                            <ChevronRight className="h-3.5 w-3.5 opacity-30 transition-all group-hover:translate-x-0.5 group-hover:opacity-80" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="block text-[11px] font-black uppercase tracking-[0.12em] leading-tight">{item.label}</span>
                                                            <span className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground group-hover:text-current/70">{item.description}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] bg-white/45 dark:bg-white/[0.024] border border-black/[0.035] dark:border-white/[0.04] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inteligencia diaria</span>
                                                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{dailyActionCount} sugestoes ativas</p>
                                            </div>
                                            <button
                                                onClick={() => void handleDailySync()}
                                                disabled={isIntelligenceLoading}
                                                className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                                                title="Atualizar"
                                                aria-label="Atualizar inteligencia diaria"
                                            >
                                                {isIntelligenceLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <RefreshCw className="mx-auto h-4 w-4" />}
                                            </button>
                                        </div>

                                        <div className="mt-4 grid gap-2">
                                            {scanProgress.map((item) => (
                                                <div key={item.module} className="flex items-center justify-between rounded-2xl bg-foreground/[0.035] px-3 py-2 dark:bg-white/[0.03]">
                                                    <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
                                                    <span className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        item.status === 'completed'
                                                            ? "bg-emerald-500"
                                                            : item.status === 'scanning'
                                                                ? cn("bg-foreground", !shouldReduceMotion && "animate-pulse")
                                                                : "bg-muted-foreground/25 dark:bg-white/[0.18]"
                                                    )} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] bg-white/35 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04] p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Atividade recente</span>
                                            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        {recentAgentTimeline.length === 0 ? (
                                            <p className="py-4 text-center text-[11px] font-semibold text-muted-foreground">Nenhuma atividade registrada.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {recentAgentTimeline.map((entry) => (
                                                    <div key={entry.id} className="flex items-start gap-3">
                                                        <span className={cn(
                                                            "mt-1.5 h-2 w-2 rounded-full",
                                                            entry.state === 'success'
                                                                ? "bg-emerald-500"
                                                                : entry.state === 'error'
                                                                    ? "bg-red-500"
                                                                    : "bg-foreground"
                                                        )} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-[11px] font-bold text-foreground">{entry.label}</p>
                                                            {entry.detail && <p className="truncate text-[10px] text-muted-foreground">{entry.detail}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ) : activeTab === 'voice' ? (
                                <motion.div
                                    key="voice"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center justify-center h-full py-12 gap-8 min-h-[400px]"
                                >
                                    <div className="relative flex h-56 w-56 items-center justify-center rounded-full border border-border/35 bg-muted/35 shadow-inner dark:border-white/[0.055] dark:bg-white/[0.025]">
                                        {shouldReduceMotion ? (
                                            <div className="h-44 w-44 rounded-full border border-foreground/10 bg-foreground/[0.035]" />
                                        ) : (
                                            <VoiceSpiral
                                                getAudioVolume={getVoiceInputVolume}
                                                isListening={voiceStatus === 'connected' && !isVoiceSpeaking && !isVoiceToolActive}
                                                isProcessing={voiceStatus === 'connecting' || isVoiceToolActive}
                                                className="overflow-hidden rounded-full opacity-80 mix-blend-multiply dark:opacity-90 dark:mix-blend-screen"
                                            />
                                        )}
                                    </div>

                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <span className={cn("text-sm uppercase tracking-[0.2em] font-black", voiceStatus === 'connected' || isVoiceToolActive ? 'text-foreground' : cn('text-muted-foreground', !shouldReduceMotion && 'animate-pulse'))}>
                                            {voiceModeLabel}
                                        </span>
                                        <p className="text-[11px] text-muted-foreground max-w-[280px] leading-relaxed">
                                            {voiceModeDescription}
                                        </p>
                                    </div>

                                    {voiceStatus === 'connected' && (
                                        <button
                                            onClick={() => toggleVoiceMode()}
                                            className="mt-4 px-8 py-3 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="Encerrar chamada de voz"
                                        >
                                            <PhoneOff className="w-4 h-4" />
                                            Encerrar Chamada
                                        </button>
                                    )}
                                </motion.div>
                            ) : messages.length === 0 ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center justify-center h-full py-10 gap-5"
                                >
                                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-border/35 bg-muted/45 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]">
                                        <Sparkles className="h-6 w-6" />
                                    </div>
                                    <div className="text-center space-y-1.5">
                                        <h3 className="text-[14px] font-semibold text-foreground">Como posso ajudar?</h3>
                                        <p className="text-[12px] text-muted-foreground max-w-[240px]">Peça para resumir um paciente ou agendar uma sessão.</p>
                                    </div>

                                    {quickActions.length > 0 && (
                                        <div className="flex flex-wrap justify-center gap-2 max-w-[340px] mt-2">
                                            {quickActions.slice(0, 4).map((tool) => (
                                                <button
                                                    key={tool.id}
                                                    onClick={() => setInputDraft(tool.name)}
                                                    className="rounded-[14px] border border-border/35 bg-muted/35 px-4 py-2 text-[11px] font-semibold text-muted-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:active:scale-100 dark:border-white/[0.06] dark:bg-white/[0.04]"
                                                >
                                                    {tool.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div key="chat" layout className="space-y-4 py-4">
                                    {messages.map((msg, idx) => (
                                        <motion.div
                                            key={msg.id || idx}
                                            layout
                                            initial={{ opacity: 0, y: 12, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                                        >
                                            {msg.role === 'assistant' && (
                                                <SynapseOrbAvatar className="mt-0.5 h-8 w-8" />
                                            )}

                                            <div className={cn(
                                                'relative group max-w-[85%]',
                                                msg.role === 'user'
                                                    ? 'rounded-[28px] rounded-br-[8px] bg-primary px-6 py-4 text-[#1a1a1a] shadow-xl'
                                                    : 'rounded-[28px] rounded-bl-[8px] border border-border/45 bg-background/72 px-6 py-4 text-foreground dark:text-white shadow-sm dark:border-white/[0.04] dark:bg-white/[0.035]'
                                            )}>
                                                {msg.role === "assistant" && (
                                                    <button
                                                        onClick={() => handleCopy(msg.id, msg.content)}
                                                        className="absolute -right-9 top-1 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                        aria-label="Copiar mensagem"
                                                    >
                                                        {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </button>
                                                )}

                                                <div className={cn(
                                                    'prose prose-sm max-w-none break-words text-[13px] leading-relaxed',
                                                    'prose-p:text-current prose-strong:text-current prose-li:text-current prose-code:text-current',
                                                    msg.role === 'user'
                                                        ? 'text-[#1a1a1a] [&_*]:!text-[#1a1a1a] prose-headings:!text-[#1a1a1a]'
                                                        : 'text-foreground dark:text-white dark:prose-invert [&_p]:text-current [&_strong]:text-current [&_li]:text-current [&_code]:text-current [&_ol]:text-current [&_ul]:text-current'
                                                )}>
                                                    {(() => {
                                                        const parsedMessage = msg.role === "assistant"
                                                            ? parseSynapseWidgetFromContent(msg.content)
                                                            : { cleanContent: msg.content, widgetData: null };
                                                        const cleanContent = parsedMessage.cleanContent || (parsedMessage.widgetData ? "" : msg.content);

                                                        return (
                                                            <>
                                                                {cleanContent ? (
                                                                    <ReactMarkdown
                                                                        remarkPlugins={[remarkGfm]}
                                                                        components={{
                                                                            pre({ children, ...props }: MarkdownPreProps) {
                                                                                const childArray = React.Children.toArray(children);
                                                                                const isWidget = childArray.some((child) => {
                                                                                    if (!React.isValidElement<{ className?: string; children?: React.ReactNode }>(child)) return false;
                                                                                    return child.props.className?.includes('language-json') && String(child.props.children).includes('__actionType');
                                                                                });
                                                                                if (isWidget) {
                                                                                    return <div className="not-prose">{children}</div>;
                                                                                }
                                                                                return <pre {...props}>{children}</pre>;
                                                                            },
                                                                            code({ inline, className, children, ...props }: MarkdownCodeProps) {
                                                                                const match = /language-(\w+)/.exec(className || '');
                                                                                if (!inline && match && match[1] === 'json' && String(children).includes('__actionType')) {
                                                                                    try {
                                                                                        const parsedData = JSON.parse(String(children));
                                                                                        return <SynapseWidgetRenderer widgetData={parsedData} compact />;
                                                                                    } catch (e) {
                                                                                        console.error("Widget render error:", e);
                                                                                    }
                                                                                }
                                                                                return <code className={className} {...props}>{children}</code>;
                                                                            }
                                                                        }}
                                                                    >
                                                                        {cleanContent}
                                                                    </ReactMarkdown>
                                                                ) : null}
                                                                {parsedMessage.widgetData ? <SynapseWidgetRenderer widgetData={parsedMessage.widgetData} compact /> : null}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {isSending && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                            transition={{ type: 'spring', stiffness: 430, damping: 32 }}
                                            className="flex items-end gap-3"
                                        >
                                            <SynapseOrbAvatar className="mb-0.5 h-8 w-8" />
                                            <motion.div
                                                animate={shouldReduceMotion ? undefined : {
                                                    boxShadow: [
                                                        '0 16px 42px -34px rgba(0,0,0,0.45)',
                                                        '0 22px 58px -36px rgba(0,0,0,0.56)',
                                                        '0 16px 42px -34px rgba(0,0,0,0.45)',
                                                    ],
                                                }}
                                                transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                                                className="flex items-center gap-1.5 rounded-[24px] rounded-bl-[8px] border border-border/45 bg-background/72 px-5 py-3.5 shadow-sm backdrop-blur-xl dark:border-white/[0.045] dark:bg-white/[0.04]"
                                            >
                                                {[0, 0.16, 0.32].map((delay) => (
                                                    <motion.div
                                                        key={delay}
                                                        animate={shouldReduceMotion ? undefined : { y: [0, -3, 0], scale: [1, 1.18, 1], opacity: [0.35, 1, 0.35] }}
                                                        transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 0.9, delay, ease: 'easeInOut' }}
                                                        className="h-1.5 w-1.5 rounded-full bg-foreground/65"
                                                    />
                                                ))}
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="px-6 pb-6 pt-2">
                        <motion.div
                            animate={shouldReduceMotion ? undefined : {
                                y: isInputFocused ? -2 : 0,
                                scale: isInputFocused ? 1.008 : 1,
                                boxShadow: isInputFocused
                                    ? '0 24px 70px -42px rgba(0,0,0,0.55)'
                                    : '0 16px 48px -44px rgba(0,0,0,0.35)',
                            }}
                            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                            className={cn(
                                'flex items-end gap-3 rounded-[26px]',
                                'notes-liquid-surface border',
                                'px-4 py-3 transition-[border-color,box-shadow] duration-300 backdrop-blur-2xl',
                                isInputFocused
                                    ? 'border-foreground/25 dark:border-white/[0.15]'
                                    : 'border-border/45 dark:border-white/[0.05]'
                            )}
                        >
                            <textarea
                                ref={inputRef}
                                value={inputDraft}
                                onChange={(e) => setInputDraft(e.target.value)}
                                onFocus={() => setIsInputFocused(true)}
                                onBlur={() => setIsInputFocused(false)}
                                onKeyDown={handleKeyDown}
                                placeholder="Pergunte ao Synapse..."
                                rows={1}
                                disabled={!sessionReady || isSending}
                                className="min-h-9 flex-1 resize-none bg-transparent py-2 text-[13px] font-medium text-foreground border-0 focus:ring-0 focus-visible:ring-0 focus:outline-none outline-none placeholder:text-muted-foreground/55 disabled:opacity-50"
                            />
                            <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                                <motion.button
                                    onClick={toggleListening}
                                    whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                                    className={cn(
                                        'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        isListening
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted/65 text-muted-foreground hover:text-foreground dark:bg-white/[0.06]'
                                    )}
                                    aria-label={isListening ? "Parar ditado" : "Iniciar ditado"}
                                >
                                    <Mic className="h-4 w-4" />
                                </motion.button>
                                <motion.button
                                    onClick={handleSend}
                                    disabled={!inputDraft.trim() || isSending}
                                    whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                                    animate={shouldReduceMotion ? undefined : { rotate: inputDraft.trim() ? 0 : -4 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 30 }}
                                    className={cn(
                                        'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        inputDraft.trim()
                                            ? 'bg-primary text-primary-foreground shadow-md'
                                            : 'bg-muted/45 text-muted-foreground/60 dark:bg-white/[0.04]'
                                    )}
                                    aria-label="Enviar mensagem"
                                >
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ArrowUp className="h-4 w-4" />}
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            <SynapseAllActionsModal
                open={showAllActions}
                onOpenChange={setShowAllActions}
                availableTools={availableTools}
                handleActionClick={handleActionClick}
                ctxInfo={ctxInfo}
            />
        </>
    );
};