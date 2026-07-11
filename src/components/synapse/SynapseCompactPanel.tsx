import React, { useRef, useEffect, useState } from 'react';
import {
    motion,
    AnimatePresence,
    useMotionValue,
    useMotionValueEvent,
    useReducedMotion,
    useSpring,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { VoiceSpiral } from '@/components/ai-chat/VoiceSpiral';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSynapse, type SynapseActiveTab } from '@/context/SynapseProvider';
import { useAI } from '@/context/AIContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import {
    X,
    Loader2,
    Sparkles,
    Calendar,
    Users,
    TrendingUp,
    Stethoscope,
    Notebook,
    History,
    Activity,
    Trash2,
    Plus,
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
import { SynapseAllActionsModal } from './SynapseAllActionsModal';
import { SynapseComposer, SynapseConversation } from './SynapseConversation';
import { supabase } from '@/integrations/supabase/client';
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

const PANEL_TABS: Array<{ id: SynapseActiveTab; label: string; icon: React.ElementType<{ className?: string }> }> = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'timeline', label: 'Atividade', icon: Activity },
    { id: 'agent', label: 'Agente', icon: MousePointer2 },
    { id: 'voice', label: 'Voz', icon: AudioLines },
];

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

const AGENT_ACTIONS: AgentActionItem[] = [
    {
        id: 'open-daily-schedule',
        label: 'Agenda do dia',
        description: 'Abre a agenda diária e destaca a grade.',
        icon: Calendar,
        action: { action: 'open_daily_schedule', reason: 'Abrindo agenda diária' },
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
        description: 'Abre o cadastro de prontuário.',
        icon: Users,
        action: { action: 'open_modal', modal: 'new_patient', reason: 'Abrindo cadastro de paciente' },
    },
    {
        id: 'new-transaction',
        label: 'Novo lançamento',
        description: 'Abre o registro financeiro manual.',
        icon: TrendingUp,
        action: { action: 'open_modal', modal: 'new_transaction', reason: 'Abrindo lançamento financeiro' },
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
        description: 'Navega para a gestão financeira.',
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
    success: 'Concluído',
    error: 'Atenção',
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
    const panelRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const rawLightX = useMotionValue(50);
    const rawLightY = useMotionValue(8);
    const lightX = useSpring(rawLightX, { stiffness: 190, damping: 30, mass: 0.55 });
    const lightY = useSpring(rawLightY, { stiffness: 190, damping: 30, mass: 0.55 });

    const [isListening, setIsListening] = useState(false);
    const [showAllActions, setShowAllActions] = useState(false);
    const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const [historyChannel, setHistoryChannel] = useState<'neuronex' | 'whatsapp'>('neuronex');

    useMotionValueEvent(lightX, 'change', (latest) => {
        panelRef.current?.style.setProperty('--synapse-light-x', `${latest}%`);
    });

    useMotionValueEvent(lightY, 'change', (latest) => {
        panelRef.current?.style.setProperty('--synapse-light-y', `${latest}%`);
    });

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
            label: result.success ? `${item.label} concluído` : `${item.label} falhou`,
            state: result.success ? 'success' : 'error',
            detail: result.message,
        });
        setExecState(result.success ? 'success' : 'error');
        window.setTimeout(() => setExecState('idle'), 1400);
    };

    const handleDailySync = async () => {
        setActiveTab('agent');
        addTimelineEntry({
            label: 'Agente: varredura diária',
            state: 'thinking',
            detail: 'Atualizando contexto por modulo',
        });
        await syncDailyIntelligence();
    };

    const ctxInfo = CONTEXT_LABELS[currentContext] || { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Synapse' };

    useEffect(() => {
        if (shellState === 'compact' && activeTab === 'chat') {
            const timeout = window.setTimeout(() => inputRef.current?.focus(), 200);
            return () => window.clearTimeout(timeout);
        }
    }, [activeTab, shellState]);

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

    const handleTabChange = (tab: SynapseActiveTab) => {
        if (activeTab === 'voice' && tab !== 'voice' && voiceStatus !== 'disconnected') {
            toggleVoiceMode();
        }
        setActiveTab(tab);
    };

    const handlePanelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldReduceMotion || event.pointerType !== 'mouse' || !panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        const nextX = Math.min(96, Math.max(4, ((event.clientX - rect.left) / rect.width) * 100));
        const nextY = Math.min(96, Math.max(4, ((event.clientY - rect.top) / rect.height) * 100));
        rawLightX.set(nextX);
        rawLightY.set(nextY);
    };

    const resetPanelLight = () => {
        rawLightX.set(50);
        rawLightY.set(8);
    };

    const focusTabAt = (index: number) => {
        const normalizedIndex = (index + PANEL_TABS.length) % PANEL_TABS.length;
        const nextTab = PANEL_TABS[normalizedIndex];
        tabRefs.current[normalizedIndex]?.focus();
        handleTabChange(nextTab.id);
    };

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusTabAt(index + 1);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusTabAt(index - 1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusTabAt(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            focusTabAt(PANEL_TABS.length - 1);
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
        ? voiceActivityMessage || (voiceActivityLabel ? `Executando ${voiceActivityLabel}. Você ainda pode interromper ou complementar por voz.` : 'Executando a solicitação no sistema. Você ainda pode interromper ou complementar por voz.')
        : voiceStatus === 'connected'
            ? 'O Synapse está ouvindo em tempo real. Fale naturalmente para realizar ações ou tirar dúvidas.'
            : 'Preparando conexão de voz em tempo real.';

    return (
        <>
            <motion.div
                ref={panelRef}
                layoutId="synapse-optical-surface"
                onPointerMove={handlePanelPointerMove}
                onPointerLeave={resetPanelLight}
                style={{ willChange: "transform, opacity" }}
                initial={shouldReduceMotion ? false : { opacity: 0.72, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0.72, y: 5 }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                    layout: { type: 'spring', stiffness: 420, damping: 38, mass: 0.82 },
                    opacity: { duration: 0.18 },
                    y: { type: 'spring', stiffness: 420, damping: 38, mass: 0.82 },
                }}
                className={cn(
                    'synapse-optical-shell relative flex h-[min(720px,calc(100vh-24px))] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border',
                )}
                role="dialog"
                aria-label="Synapse AI"
                aria-modal="false"
            >
                <div className="relative z-10 flex h-full min-h-0 flex-col">
                    <TooltipProvider delayDuration={300}>
                        <header className="synapse-optical-chrome shrink-0">
                            <div className="flex min-h-16 items-center justify-between gap-3 px-3.5">
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <span className="synapse-header-mark flex h-10 w-10 shrink-0 items-center justify-center text-foreground" aria-hidden="true">
                                        <Sparkles className="relative z-10 h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 leading-none">
                                        <span className="block truncate text-[15px] font-semibold text-foreground">Synapse</span>
                                        <span className="mt-1.5 flex items-center gap-1.5 truncate text-[10px] font-medium text-muted-foreground">
                                            <span className={cn('h-1.5 w-1.5 rounded-full', sessionReady ? 'bg-foreground/75' : 'bg-muted-foreground/40')} aria-hidden="true" />
                                            {ctxInfo.icon}
                                            <span className="truncate">{ctxInfo.label}</span>
                                        </span>
                                    </span>
                                </div>

                                <div className="flex shrink-0 items-center gap-0.5">
                                    {messages.length > 0 ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    onClick={clearSession}
                                                    className="synapse-header-control flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    aria-label="Limpar conversa"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">Limpar conversa</TooltipContent>
                                        </Tooltip>
                                    ) : null}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={clearSession}
                                                className="synapse-header-control flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                aria-label="Criar nova conversa"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Nova conversa</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => setShellState('pill')}
                                                className="synapse-header-control flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                aria-label="Recolher Synapse"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Recolher</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>

                            <nav className="synapse-mode-switcher mx-2.5 mb-2.5 grid grid-cols-5 gap-1 p-1" role="tablist" aria-label="Modos do Synapse">
                                {PANEL_TABS.map((tab, index) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <motion.button
                                            key={tab.id}
                                            ref={(node) => { tabRefs.current[index] = node; }}
                                            id={`synapse-tab-${tab.id}`}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls="synapse-tabpanel"
                                            tabIndex={isActive ? 0 : -1}
                                            onClick={() => handleTabChange(tab.id)}
                                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                                            whileTap={shouldReduceMotion ? undefined : { scale: 0.97, y: 1 }}
                                            className={cn(
                                                "relative flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[11px] px-1 text-[10px] font-semibold text-muted-foreground transition-colors",
                                                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                isActive && "text-foreground",
                                            )}
                                        >
                                            {isActive ? (
                                                <motion.span
                                                    layoutId="synapse-active-tab"
                                                    className="synapse-mode-active absolute inset-0 rounded-[11px]"
                                                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }}
                                                    aria-hidden="true"
                                                />
                                            ) : null}
                                            <span className="relative z-10 shrink-0">
                                                <Icon className="h-4 w-4" />
                                                {tab.id === 'voice' && voiceStatus === 'connected' ? (
                                                    <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                                ) : null}
                                            </span>
                                            <span className="relative z-10 hidden truncate min-[380px]:inline">{tab.label}</span>
                                        </motion.button>
                                    );
                                })}
                            </nav>
                        </header>
                    </TooltipProvider>

                    <div
                        ref={scrollRef}
                        id="synapse-tabpanel"
                        role="tabpanel"
                        aria-labelledby={`synapse-tab-${activeTab}`}
                        className={cn(
                            'synapse-thread-viewport relative min-h-0 flex-1 overflow-y-auto px-4',
                            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/20 dark:scrollbar-thumb-white/15',
                        )}
                    >
                        <AnimatePresence initial={false} mode="wait">
                            {activeTab === 'history' ? (
                                <motion.div
                                    key="history"
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="flex flex-col gap-3 py-4"
                                >
                                    <div className="flex min-h-11 items-center justify-between px-2">
                                        <h3 className="text-[12px] font-semibold text-foreground">Conversas recentes</h3>
                                        {isLoadingSessions && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" />}
                                    </div>

                                    <div className="synapse-chat-glass grid grid-cols-2 rounded-lg border p-1 text-[11px] font-medium text-muted-foreground">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('neuronex')}
                                            className={cn(
                                                "h-11 rounded-md px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                historyChannel === 'neuronex'
                                                    ? "bg-background text-foreground shadow-sm dark:bg-white/[0.08]"
                                                    : "hover:bg-muted/60 hover:text-foreground"
                                            )}
                                        >
                                            NeuroNex
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('whatsapp')}
                                            className={cn(
                                                "h-11 rounded-md px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                historyChannel === 'whatsapp'
                                                    ? "bg-background text-foreground shadow-sm dark:bg-white/[0.08]"
                                                    : "hover:bg-muted/60 hover:text-foreground"
                                            )}
                                        >
                                            WhatsApp Business
                                        </button>
                                    </div>

                                    {sessions.length === 0 && !isLoadingSessions ? (
                                        <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
                                            <MessageSquare className="h-7 w-7 opacity-60" />
                                            <p className="text-[12px] font-medium">
                                                {historyChannel === 'whatsapp' ? 'Nenhuma conversa WhatsApp' : 'Nenhuma conversa salva'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/60 dark:divide-white/[0.07]">
                                            {sessions.map((session) => {
                                                const isWpp = session.context_state?.source === 'whatsapp';
                                                const isPsychologist = session.context_state?.conversation_kind === 'psychologist';
                                                const title = isWpp
                                                    ? isPsychologist
                                                        ? 'Você e Synapse'
                                                        : session.context_state?.pushName || session.title?.replace(/^WhatsApp Business\s*-\s*/i, '') || session.context_state?.phoneNumber || 'Paciente'
                                                    : session.title || 'Conversa sem título';
                                                return (
                                                    <button
                                                        key={session.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveSessionId(session.id);
                                                            setActiveTab('chat');
                                                        }}
                                                        className="group relative flex min-h-[72px] w-full items-center justify-between gap-3 px-2 py-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className={cn(
                                                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                                                isWpp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted/65 text-muted-foreground"
                                                            )}>
                                                                {isWpp ? <Smartphone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <span className="truncate text-[13px] font-semibold text-foreground">{title}</span>
                                                                    {isWpp ? (
                                                                        <span className="shrink-0 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                            {isPsychologist ? 'Profissional' : 'Paciente'}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                                                    {session.updated_at ? new Date(session.updated_at).toLocaleDateString('pt-BR') : 'Sem data'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                            ) : activeTab === 'timeline' ? (
                                <motion.div
                                    key="timeline"
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="flex flex-col gap-4 py-4"
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
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="flex flex-col"
                                >
                                    <section className="border-b border-border/60 py-5 dark:border-white/[0.07]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[11px] font-medium text-muted-foreground">Modo agente</span>
                                                <h3 className="text-[16px] font-semibold text-foreground">Controle de tela</h3>
                                            </div>
                                            <span className={cn(
                                                "rounded-md px-2.5 py-1.5 text-[10px] font-semibold",
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
                                                        type="button"
                                                        onClick={() => void runAgentAction(item)}
                                                        disabled={agentBusy}
                                                        className="group flex min-h-[88px] flex-col items-start justify-between rounded-lg border border-border/60 bg-muted/20 p-3.5 text-left transition-colors hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.07] dark:bg-white/[0.025]"
                                                    >
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-current" />
                                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="block text-[11px] font-semibold leading-tight">{item.label}</span>
                                                            <span className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{item.description}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    <section className="border-b border-border/60 py-5 dark:border-white/[0.07]">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <span className="text-[12px] font-semibold text-foreground">Inteligência diária</span>
                                                <p className="mt-1 text-[11px] text-muted-foreground">{dailyActionCount} sugestões ativas</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void handleDailySync()}
                                                disabled={isIntelligenceLoading}
                                                className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                title="Atualizar"
                                                aria-label="Atualizar inteligência diária"
                                            >
                                                {isIntelligenceLoading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw className="h-4 w-4" />}
                                            </button>
                                        </div>

                                        <div className="mt-4 divide-y divide-border/55 dark:divide-white/[0.06]">
                                            {scanProgress.map((item) => (
                                                <div key={item.module} className="flex min-h-10 items-center justify-between px-1">
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
                                    </section>

                                    <section className="py-5">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-[12px] font-semibold text-foreground">Atividade recente</span>
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
                                    </section>
                                </motion.div>
                            ) : activeTab === 'voice' ? (
                                <motion.div
                                    key="voice"
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="flex h-full min-h-[400px] flex-col items-center justify-center gap-8 py-12"
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
                                        <span className={cn("text-[14px] font-semibold", voiceStatus === 'connected' || isVoiceToolActive ? 'text-foreground' : cn('text-muted-foreground', !shouldReduceMotion && 'animate-pulse'))}>
                                            {voiceModeLabel}
                                        </span>
                                        <p className="text-[11px] text-muted-foreground max-w-[280px] leading-relaxed">
                                            {voiceModeDescription}
                                        </p>
                                    </div>

                                    {voiceStatus === 'connected' && (
                                        <button
                                            type="button"
                                            onClick={() => toggleVoiceMode()}
                                            className="mt-4 flex min-h-11 items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="Encerrar chamada de voz"
                                        >
                                            <PhoneOff className="w-4 h-4" />
                                            Encerrar Chamada
                                        </button>
                                    )}
                                </motion.div>
                            ) : (
                                <SynapseConversation
                                    messages={messages}
                                    isSending={isSending}
                                    quickActions={quickActions}
                                    shouldReduceMotion={Boolean(shouldReduceMotion)}
                                    onQuickAction={setInputDraft}
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    {activeTab === 'chat' ? (
                        <SynapseComposer
                            ref={inputRef}
                            value={inputDraft}
                            isSending={isSending}
                            isListening={isListening}
                            sessionReady={sessionReady}
                            shouldReduceMotion={Boolean(shouldReduceMotion)}
                            onChange={setInputDraft}
                            onSend={handleSend}
                            onToggleListening={toggleListening}
                        />
                    ) : null}
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
