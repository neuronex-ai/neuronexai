import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { SynapseWidgetRenderer, parseSynapseWidgetFromContent } from './SynapseWidgetRenderer';
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
                    setInputDraft(current ? current + ' ' + transcript : transcript);
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
    }, [setInputDraft]);

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
                layout
                layoutId="synapse-shell"
                initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{
                    opacity: 0,
                    scale: 0.1,
                    y: 280,
                    x: 180,
                    filter: 'blur(15px)',
                    transition: {
                        duration: 0.5,
                        ease: [0.32, 0, 0.67, 0],
                        opacity: { duration: 0.25 }
                    }
                }}
                transition={{
                    type: 'spring',
                    stiffness: 450,
                    damping: 38,
                    mass: 1,
                    layout: { duration: 0.45, ease: [0.23, 1, 0.32, 1] }
                }}
                className={cn(
                    'w-[480px] h-[640px]',
                    'rounded-[36px]',
                    'relative overflow-hidden',
                    'flex flex-col',
                    'bg-zinc-50/90 dark:bg-[#0a0a0c]/90 backdrop-blur-3xl',
                    'border border-black/[0.04] dark:border-white/[0.06]',
                    'shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)]',
                )}
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-transparent transition-colors duration-500" />
                    <div className="block dark:hidden absolute inset-0 opacity-40">
                        <div className="absolute top-[80%] left-[10%] w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-[80px]" />
                        <div className="absolute top-[10%] right-[10%] w-[250px] h-[250px] bg-purple-500/20 rounded-full blur-[80px]" />
                    </div>
                    <div className="hidden dark:block absolute inset-0 opacity-40 mix-blend-screen">
                        <div className="absolute top-[80%] left-[10%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px]" />
                        <div className="absolute top-[10%] right-[10%] w-[250px] h-[250px] bg-purple-500/10 rounded-full blur-[80px]" />
                    </div>
                </div>

                <div className="relative z-10 flex flex-col h-full max-h-[620px]">
                    <div className="flex items-center justify-between px-7 pt-7 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[14px] font-black uppercase tracking-[0.24em] text-zinc-950 dark:text-white">
                                Synapse AI
                            </span>
                        </div>

                        <div className="flex items-center gap-2 p-1 bg-white/50 dark:bg-white/[0.04] rounded-full border border-black/[0.03] dark:border-white/[0.05] shadow-sm">
                            <button
                                onClick={() => setActiveTab(activeTab === 'history' ? 'chat' : 'history')}
                                className={cn("p-1.5 rounded-full transition-all duration-300 active:scale-95", activeTab === 'history' ? "bg-black/10 dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                                title="Histórico"
                            >
                                <History className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setActiveTab(activeTab === 'timeline' ? 'chat' : 'timeline')}
                                className={cn("p-1.5 rounded-full transition-all duration-300 active:scale-95", activeTab === 'timeline' ? "bg-black/10 dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                                title="Atividade"
                            >
                                <Activity className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setActiveTab(activeTab === 'agent' ? 'chat' : 'agent')}
                                className={cn("p-1.5 rounded-full transition-all duration-300 active:scale-95", activeTab === 'agent' ? "bg-black/10 dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                                title="Agente"
                            >
                                <MousePointer2 className="h-4 w-4" />
                            </button>
                            <div className="w-[1px] h-4 bg-black/10 dark:bg-white/[0.08] mx-0.5" />
                            <button
                                onClick={handleVoiceButtonClick}
                                className={cn(
                                    "p-1.5 rounded-full transition-all duration-300 relative overflow-hidden active:scale-95",
                                    voiceStatus === 'connected' ? "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400" : "hover:bg-black/5 dark:hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                                title="Voz"
                            >
                                {voiceStatus === 'connected' ? (
                                    <>
                                        <PhoneOff className="h-4 w-4 relative z-10" />
                                        <motion.div className="absolute inset-0 bg-indigo-500/10" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} />
                                    </>
                                ) : (
                                    <AudioLines className="h-4 w-4" />
                                )}
                            </button>
                            {messages.length > 0 && (
                                <button
                                    onClick={clearSession}
                                    className="p-1.5 rounded-full hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-all duration-300 active:scale-95"
                                    title="Limpar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                onClick={clearSession}
                                className="p-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border border-transparent dark:border-white shadow-md hover:scale-105 active:scale-95 transition-all duration-300 ml-1"
                                title="Nova Conversa"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setShellState('pill')}
                                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-all duration-300 active:scale-95"
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
                            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800/50',
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
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Conversas Recentes</h3>
                                        {isLoadingSessions && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
                                    </div>

                                    <div className="mx-2 mb-2 grid grid-cols-2 rounded-[18px] border border-black/[0.04] bg-white/65 p-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.035]">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('neuronex')}
                                            className={cn(
                                                "h-10 rounded-[14px] transition-all",
                                                historyChannel === 'neuronex'
                                                    ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                                                    : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
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
                                                    ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                                                    : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
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
                                                        className="group w-full flex items-center justify-between p-5 rounded-[28px] bg-white/50 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05] hover:bg-zinc-950 dark:hover:bg-white hover:text-white dark:hover:text-zinc-900 transition-all duration-300 text-left relative overflow-hidden"
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
                                                                isWpp ? "bg-emerald-100 dark:bg-emerald-500/10 group-hover:bg-emerald-500 text-emerald-600 group-hover:text-white dark:text-emerald-400" : "bg-zinc-100 dark:bg-white/5 group-hover:bg-white/10 text-zinc-400"
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
                                        <div className="text-center text-zinc-500 text-[11px] mt-10">Nenhuma atividade registrada.</div>
                                    ) : (
                                        timeline.map((entry, idx) => (
                                            <div key={entry.id} className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600 mt-1" />
                                                    {idx !== timeline.length - 1 && <div className="w-[1px] h-full bg-zinc-200 dark:bg-white/[0.06] mt-1" />}
                                                </div>
                                                <div className="flex flex-col flex-1 pb-4">
                                                    <span className="text-[10px] font-mono text-zinc-400 mb-0.5">{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</span>
                                                    <span className="text-[13px] text-zinc-800 dark:text-zinc-200 font-medium">{entry.label}</span>
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
                                    <div className="rounded-[28px] bg-white/65 dark:bg-white/[0.035] border border-black/[0.04] dark:border-white/[0.06] p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-400">Modo agente</span>
                                                <h3 className="text-[17px] font-black tracking-tight text-zinc-950 dark:text-white">Controle de tela</h3>
                                            </div>
                                            <span className={cn(
                                                "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                                                execState === 'error'
                                                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                                    : execState === 'success'
                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                        : agentBusy
                                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                                            : "bg-zinc-950/[0.06] text-zinc-500 dark:bg-white/[0.08] dark:text-zinc-400"
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
                                                        className="group flex min-h-[88px] flex-col items-start justify-between rounded-[22px] border border-black/[0.04] bg-zinc-50/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-zinc-950 hover:text-white disabled:pointer-events-none disabled:opacity-45 dark:border-white/[0.06] dark:bg-white/[0.035] dark:hover:bg-white dark:hover:text-zinc-950"
                                                    >
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <Icon className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-current" />
                                                            <ChevronRight className="h-3.5 w-3.5 opacity-30 transition-all group-hover:translate-x-0.5 group-hover:opacity-80" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="block text-[11px] font-black uppercase tracking-[0.12em] leading-tight">{item.label}</span>
                                                            <span className="line-clamp-2 text-[10px] leading-relaxed text-zinc-500 group-hover:text-current/70 dark:text-zinc-500">{item.description}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] bg-white/45 dark:bg-white/[0.025] border border-black/[0.035] dark:border-white/[0.055] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Inteligencia diaria</span>
                                                <p className="mt-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">{dailyActionCount} sugestoes ativas</p>
                                            </div>
                                            <button
                                                onClick={() => void handleDailySync()}
                                                disabled={isIntelligenceLoading}
                                                className="h-10 w-10 rounded-2xl bg-zinc-950 text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-zinc-950"
                                                title="Atualizar"
                                            >
                                                {isIntelligenceLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <RefreshCw className="mx-auto h-4 w-4" />}
                                            </button>
                                        </div>

                                        <div className="mt-4 grid gap-2">
                                            {scanProgress.map((item) => (
                                                <div key={item.module} className="flex items-center justify-between rounded-2xl bg-zinc-950/[0.035] px-3 py-2 dark:bg-white/[0.035]">
                                                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">{item.label}</span>
                                                    <span className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        item.status === 'completed'
                                                            ? "bg-emerald-500"
                                                            : item.status === 'scanning'
                                                                ? "bg-indigo-500 animate-pulse"
                                                                : "bg-zinc-300 dark:bg-zinc-700"
                                                    )} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-[26px] bg-white/35 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05] p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Atividade recente</span>
                                            <Activity className="h-3.5 w-3.5 text-zinc-400" />
                                        </div>
                                        {recentAgentTimeline.length === 0 ? (
                                            <p className="py-4 text-center text-[11px] font-semibold text-zinc-400">Nenhuma atividade registrada.</p>
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
                                                                    : "bg-indigo-500"
                                                        )} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{entry.label}</p>
                                                            {entry.detail && <p className="truncate text-[10px] text-zinc-400">{entry.detail}</p>}
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
                                    <div className="relative w-56 h-56 flex items-center justify-center bg-black/[0.03] dark:bg-white/[0.02] rounded-full shadow-inner border border-black/[0.05] dark:border-white/[0.05]">
                                        <VoiceSpiral
                                            getAudioVolume={getVoiceInputVolume}
                                            isListening={voiceStatus === 'connected' && !isVoiceSpeaking && !isVoiceToolActive}
                                            isProcessing={voiceStatus === 'connecting' || isVoiceToolActive}
                                            className="rounded-full overflow-hidden opacity-90 dark:opacity-100 mix-blend-multiply dark:mix-blend-screen"
                                        />
                                    </div>

                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <span className={cn("text-sm uppercase tracking-[0.2em] font-black", voiceStatus === 'connected' || isVoiceToolActive ? 'text-indigo-500' : 'text-zinc-400 animate-pulse')}>
                                            {voiceModeLabel}
                                        </span>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 max-w-[280px] leading-relaxed">
                                            {voiceModeDescription}
                                        </p>
                                    </div>

                                    {voiceStatus === 'connected' && (
                                        <button
                                            onClick={() => toggleVoiceMode()}
                                            className="mt-4 px-8 py-3 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 text-[12px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
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
                                    <div className="w-14 h-14 rounded-3xl bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/[0.06] flex items-center justify-center">
                                        <Sparkles className="h-6 w-6 text-zinc-400" />
                                    </div>
                                    <div className="text-center space-y-1.5">
                                        <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-200">Como posso ajudar?</h3>
                                        <p className="text-[12px] text-zinc-500 max-w-[240px]">Peça para resumir um paciente ou agendar uma sessão.</p>
                                    </div>

                                    {quickActions.length > 0 && (
                                        <div className="flex flex-wrap justify-center gap-2 max-w-[340px] mt-2">
                                            {quickActions.slice(0, 4).map((tool) => (
                                                <button
                                                    key={tool.id}
                                                    onClick={() => setInputDraft(tool.name)}
                                                    className="px-4 py-2 rounded-[14px] text-[11px] font-semibold bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 transition-all active:scale-95 shadow-sm"
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
                                                    ? 'rounded-[28px] rounded-br-[8px] px-6 py-4 bg-zinc-900 text-white dark:bg-white/[0.08] dark:text-zinc-200 shadow-xl'
                                                    : 'rounded-[28px] rounded-bl-[8px] px-6 py-4 bg-white border border-zinc-200/60 text-zinc-800 dark:bg-white/[0.04] dark:border-white/[0.04] dark:text-zinc-300 shadow-sm'
                                            )}>
                                                {msg.role === "assistant" && (
                                                    <button
                                                        onClick={() => handleCopy(msg.id, msg.content)}
                                                        className="absolute -right-9 top-1 opacity-0 group-hover:opacity-100 transition-all p-1.5 text-zinc-400 hover:text-zinc-900"
                                                    >
                                                        {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </button>
                                                )}

                                                <div className={cn(
                                                    'prose prose-sm max-w-none text-[13px] leading-relaxed break-words',
                                                    msg.role === 'user'
                                                        ? 'prose-invert'
                                                        : 'dark:prose-invert'
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
                                                animate={{
                                                    boxShadow: [
                                                        '0 16px 42px -34px rgba(0,0,0,0.45)',
                                                        '0 22px 58px -36px rgba(0,0,0,0.56)',
                                                        '0 16px 42px -34px rgba(0,0,0,0.45)',
                                                    ],
                                                }}
                                                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                                                className="flex items-center gap-1.5 px-5 py-3.5 rounded-[24px] rounded-bl-[8px] border border-zinc-200/70 bg-white/82 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.055]"
                                            >
                                                {[0, 0.16, 0.32].map((delay) => (
                                                    <motion.div
                                                        key={delay}
                                                        animate={{ y: [0, -3, 0], scale: [1, 1.18, 1], opacity: [0.35, 1, 0.35] }}
                                                        transition={{ repeat: Infinity, duration: 0.9, delay, ease: 'easeInOut' }}
                                                        className="w-1.5 h-1.5 rounded-full bg-zinc-950/60 dark:bg-white/70"
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
                            animate={{
                                y: isInputFocused ? -2 : 0,
                                scale: isInputFocused ? 1.008 : 1,
                                boxShadow: isInputFocused
                                    ? '0 24px 70px -42px rgba(0,0,0,0.45)'
                                    : '0 16px 48px -44px rgba(0,0,0,0.35)',
                            }}
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            className={cn(
                                'flex items-end gap-3 rounded-[26px]',
                                'bg-white/90 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/[0.08]',
                                'px-4 py-3 transition-colors duration-300 backdrop-blur-2xl'
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
                                className="min-h-9 flex-1 resize-none bg-transparent py-2 text-[13px] font-medium text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-white/35"
                            />
                            <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                                <motion.button
                                    onClick={toggleListening}
                                    whileTap={{ scale: 0.92 }}
                                    className={cn(
                                        'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300',
                                        isListening
                                            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                            : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:bg-white/[0.06] dark:text-white/48 dark:hover:text-white'
                                    )}
                                >
                                    <Mic className="h-4 w-4" />
                                </motion.button>
                                <motion.button
                                    onClick={handleSend}
                                    disabled={!inputDraft.trim() || isSending}
                                    whileTap={{ scale: 0.92 }}
                                    animate={{ rotate: inputDraft.trim() ? 0 : -4 }}
                                    transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                                    className={cn(
                                        'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 disabled:cursor-not-allowed',
                                        inputDraft.trim()
                                            ? 'bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900'
                                            : 'bg-zinc-100 text-zinc-400 dark:bg-white/[0.04] dark:text-white/32'
                                    )}
                                >
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
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
