import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VoiceSpiral } from '@/components/ai-chat/VoiceSpiral';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSynapse, type SynapseActiveTab } from '@/context/SynapseProvider';
import { useAI } from '@/context/AIContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { useChatSessionHistory, type ChatSession } from '@/hooks/use-ai-chat';
import { sanitizeSynapseDisplayText } from '@/lib/synapse-humanize';
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
    ChevronRight,
    AudioLines,
    PhoneOff,
    MessageSquare,
    Smartphone,
} from 'lucide-react';
import { SynapseAllActionsModal } from './SynapseAllActionsModal';
import { SynapseComposer, SynapseConversation } from './SynapseConversation';

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
    { id: 'voice', label: 'Voz', icon: AudioLines },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'timeline', label: 'Atividade', icon: Activity },
];

const TIMELINE_RENDER_LIMIT = 80;

type ActivityCopy = {
    label: string;
    detail?: string;
};

const normalizeIntent = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const extractNamedEntity = (prompt: string) => {
    const quoted = prompt.match(/["'“”‘’]([^"'“”‘’]{2,64})["'“”‘’]/u)?.[1];
    if (quoted) return quoted.trim();

    const patientMatch = prompt.match(/paciente\s+(?:chamado|chamada|de nome|com nome)?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,42})/i)?.[1];
    if (!patientMatch) return '';

    return patientMatch
        .split(/\b(?:no|na|do|da|dos|das|para|pra|em|com|que|e)\b/i)[0]
        .replace(/[?.!,;:]+$/g, '')
        .trim();
};

const inferChatActivity = (prompt: string, contextLabel: string): ActivityCopy => {
    const cleanPrompt = sanitizeSynapseDisplayText(prompt, '');
    const normalized = normalizeIntent(cleanPrompt);
    const entity = extractNamedEntity(cleanPrompt);
    const contextDetail = `Contexto atual: ${contextLabel}`;

    if (/\b(relatorio|resumo|analise)\b/.test(normalized) && /\bpacient/.test(normalized)) {
        return { label: 'Gerando relatório de pacientes', detail: 'Conferindo a base clínica' };
    }

    if (/\b(listar|liste|mostrar|mostre|ver)\b/.test(normalized) && /\bpacient/.test(normalized)) {
        return { label: 'Consultando pacientes cadastrados', detail: 'Lendo registros disponíveis' };
    }

    if (/\b(buscar|busque|procurar|procure|encontrar|encontre)\b/.test(normalized) && /\bpacient/.test(normalized)) {
        return {
            label: entity ? `Buscando paciente ${entity} no sistema` : 'Buscando paciente no sistema',
            detail: 'Consultando cadastro e contexto clínico',
        };
    }

    if (/\b(prontuario|detalhes|ficha|acompanhar|seguimento)\b/.test(normalized) && /\bpacient/.test(normalized)) {
        return {
            label: entity ? `Consultando prontuário de ${entity}` : 'Consultando prontuário do paciente',
            detail: 'Preparando dados clínicos relevantes',
        };
    }

    if (/\b(agenda|horario|consulta|atendimento)\b/.test(normalized)) {
        return { label: 'Consultando agenda clínica', detail: 'Verificando horários e atendimentos' };
    }

    if (/\b(financeiro|faturamento|cobranca|pagamento|saldo|extrato|transacao)\b/.test(normalized)) {
        return { label: 'Conferindo dados financeiros', detail: 'Verificando lançamentos e cobranças' };
    }

    if (/\b(nota|documento|laudo|atestado|parecer|email|e-mail)\b/.test(normalized)) {
        return { label: 'Preparando conteúdo solicitado', detail: 'Organizando informações do sistema' };
    }

    return { label: 'Processando solicitação', detail: contextDetail };
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
        execState,
        activeTab,
        setActiveTab,
        voiceStatus,
        isVoiceSpeaking,
        isVoiceToolActive,
        voiceActivityLabel,
        voiceActivityMessage,
        getVoiceInputVolume,
        toggleVoiceMode,
        setActiveSessionId,
    } = useSynapse();
    const { currentContext } = useAI();
    const { send, messages, isSending, progressEvent, sessionReady, clearSession } = useSynapseChat();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const [isListening, setIsListening] = useState(false);
    const [showAllActions, setShowAllActions] = useState(false);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [historyChannel, setHistoryChannel] = useState<'neuronex' | 'whatsapp'>('neuronex');
    const historyQuery = useChatSessionHistory(historyChannel, shellState === 'compact' && activeTab === 'history');
    const sessions = useMemo(() => {
        const uniqueSessions = new Map<string, ChatSession>();
        historyQuery.data?.pages.forEach((page) => {
            page.sessions.forEach((session) => uniqueSessions.set(session.id, session));
        });
        return Array.from(uniqueSessions.values());
    }, [historyQuery.data]);

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

    const visibleTimeline = useMemo(
        () => timeline.slice(-TIMELINE_RENDER_LIMIT).reverse(),
        [timeline],
    );

    const ctxInfo = CONTEXT_LABELS[currentContext] || { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Synapse' };
    const latestUserPrompt = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index].role === 'user') return messages[index].content;
        }
        return inputDraft;
    }, [inputDraft, messages]);
    const latestExecutionEntry = visibleTimeline.find((entry) => entry.state === execState);
    const inferredChatActivity = inferChatActivity(latestUserPrompt, ctxInfo.label);
    const chatActivity = execState === 'executing' && latestExecutionEntry
        ? {
            label: sanitizeSynapseDisplayText(latestExecutionEntry.label, 'Executando ação no painel'),
            detail: sanitizeSynapseDisplayText(latestExecutionEntry.detail, 'Atualizando a interface do Synapse.'),
        }
        : progressEvent?.label
            ? {
                label: sanitizeSynapseDisplayText(progressEvent.label, 'Processando solicitação'),
                detail: sanitizeSynapseDisplayText(progressEvent.detail, 'Acompanhando progresso em tempo real.'),
            }
        : inferredChatActivity;
    const isChatProcessing = activeTab === 'chat' && (isSending || execState === 'thinking' || execState === 'executing');
    const chatActivityMode = execState === 'executing'
        ? 'executing' as const
        : progressEvent?.label && progressEvent.stage !== 'received'
            ? 'responding' as const
            : 'thinking' as const;

    useEffect(() => {
        if (shellState === 'compact' && activeTab === 'chat') {
            const timeout = window.setTimeout(() => inputRef.current?.focus(), 200);
            return () => window.clearTimeout(timeout);
        }
    }, [activeTab, shellState]);

    useEffect(() => {
        if (activeTab !== 'chat' || !scrollRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            const viewport = scrollRef.current;
            if (!viewport) return;
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: 'auto',
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activeTab, messages]);

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
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.992 }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                    opacity: { duration: 0.16, ease: 'easeOut' },
                    y: { type: 'spring', stiffness: 440, damping: 42, mass: 0.78 },
                    scale: { type: 'spring', stiffness: 440, damping: 42, mass: 0.78 },
                }}
                className={cn(
                    'synapse-desktop-shell relative flex h-[min(642px,calc(100dvh-24px))] w-[min(464px,calc(100vw-24px))] flex-col overflow-hidden rounded-[34px] border',
                )}
                role="dialog"
                aria-label="Synapse AI"
                aria-modal="false"
            >
                <div className="relative z-10 flex h-full min-h-0 flex-col">
                    <TooltipProvider delayDuration={300}>
                        <header className="synapse-desktop-chrome shrink-0">
                            <div className="synapse-desktop-toolbar flex min-h-[58px] items-center gap-2 px-3">
                                <nav className="synapse-desktop-tabs flex min-w-0 flex-1 items-center gap-0.5 p-1" role="tablist" aria-label="Modos do Synapse">
                                    {PANEL_TABS.map((tab, index) => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                ref={(node) => { tabRefs.current[index] = node; }}
                                                id={`synapse-tab-${tab.id}`}
                                                type="button"
                                                role="tab"
                                                aria-selected={isActive}
                                                aria-controls="synapse-tabpanel"
                                                aria-label={tab.label}
                                                title={tab.label}
                                                tabIndex={isActive ? 0 : -1}
                                                onClick={() => handleTabChange(tab.id)}
                                                onKeyDown={(event) => handleTabKeyDown(event, index)}
                                                className={cn(
                                                    'relative flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-[13px] px-2.5 text-[10px] font-semibold transition-[color,transform] duration-150 active:translate-y-px',
                                                    'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    isActive ? 'text-foreground' : 'text-muted-foreground',
                                                )}
                                            >
                                                {isActive ? (
                                                    <motion.span
                                                        layoutId="synapse-active-tab"
                                                        className="synapse-desktop-tab-active absolute inset-0 rounded-[12px]"
                                                        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }}
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                                <span className="relative z-10 shrink-0">
                                                    <Icon className="h-3.5 w-3.5" />
                                                    {tab.id === 'voice' && voiceStatus === 'connected' ? (
                                                        <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                                    ) : null}
                                                </span>
                                                <AnimatePresence initial={false}>
                                                    {isActive ? (
                                                        <motion.span
                                                            key={`${tab.id}-label`}
                                                            initial={shouldReduceMotion ? false : { opacity: 0, width: 0, x: -3 }}
                                                            animate={{ opacity: 1, width: 'auto', x: 0 }}
                                                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, width: 0, x: -2 }}
                                                            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 42 }}
                                                            className="relative z-10 hidden whitespace-nowrap min-[390px]:inline-block"
                                                            aria-hidden="true"
                                                        >
                                                            {tab.label}
                                                        </motion.span>
                                                    ) : null}
                                                </AnimatePresence>
                                                <span className="sr-only">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </nav>

                                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                                    {messages.length > 0 ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmClearOpen(true)}
                                                    className="synapse-desktop-control flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    aria-label="Limpar conversa"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">Limpar conversa</TooltipContent>
                                        </Tooltip>
                                    ) : null}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => setShellState('pill')}
                                                className="synapse-desktop-control flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                aria-label="Recolher Synapse"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">Recolher</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        </header>
                    </TooltipProvider>

                    <div
                        ref={scrollRef}
                        id="synapse-tabpanel"
                        role="tabpanel"
                        aria-labelledby={`synapse-tab-${activeTab}`}
                        className={cn(
                            'synapse-desktop-viewport relative min-h-0 flex-1 overflow-y-auto px-4',
                            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/20 dark:scrollbar-thumb-white/15',
                        )}
                    >
                        <AnimatePresence initial={false} mode="sync">
                            {activeTab === 'history' ? (
                                <motion.div
                                    key="history"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="flex flex-col gap-3 py-4"
                                >
                                    <div className="flex min-h-11 items-center justify-between px-2">
                                        <h3 className="text-[12px] font-semibold text-foreground">Conversas recentes</h3>
                                        {historyQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" />}
                                    </div>

                                    <div className="synapse-history-segment grid grid-cols-2 p-1 text-[11px] font-medium text-muted-foreground">
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('neuronex')}
                                            className={cn(
                                                "relative isolate h-11 rounded-[10px] px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                historyChannel === 'neuronex'
                                                    ? "text-background"
                                                    : "hover:text-foreground"
                                            )}
                                        >
                                            {historyChannel === 'neuronex' ? (
                                                <motion.span
                                                    layoutId="synapse-history-channel"
                                                    className="synapse-history-segment-active absolute inset-0 -z-10 rounded-[10px]"
                                                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 42 }}
                                                    aria-hidden="true"
                                                />
                                            ) : null}
                                            <span className="relative z-10">NeuroNex</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHistoryChannel('whatsapp')}
                                            className={cn(
                                                "relative isolate h-11 rounded-[10px] px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                historyChannel === 'whatsapp'
                                                    ? "text-background"
                                                    : "hover:text-foreground"
                                            )}
                                        >
                                            {historyChannel === 'whatsapp' ? (
                                                <motion.span
                                                    layoutId="synapse-history-channel"
                                                    className="synapse-history-segment-active absolute inset-0 -z-10 rounded-[10px]"
                                                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 42 }}
                                                    aria-hidden="true"
                                                />
                                            ) : null}
                                            <span className="relative z-10">WhatsApp Business</span>
                                        </button>
                                    </div>

                                    {sessions.length === 0 && !historyQuery.isLoading ? (
                                        <div className="synapse-empty-state flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
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
                                                        className="synapse-history-row group relative flex min-h-[72px] w-full items-center justify-between gap-3 px-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className={cn(
                                                                "synapse-history-row-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]",
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

                                    {historyQuery.hasNextPage ? (
                                        <button
                                            type="button"
                                            onClick={() => void historyQuery.fetchNextPage()}
                                            disabled={historyQuery.isFetchingNextPage}
                                            className="synapse-load-more mt-3 flex min-h-11 w-full items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {historyQuery.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <ChevronRight className="h-3.5 w-3.5 rotate-90" />}
                                            {historyQuery.isFetchingNextPage ? 'Carregando' : 'Carregar mais'}
                                        </button>
                                    ) : null}
                                </motion.div>
                            ) : activeTab === 'timeline' ? (
                                <motion.div
                                    key="timeline"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="flex flex-col gap-4 py-4"
                                >
                                    {visibleTimeline.length === 0 ? (
                                        <div className="synapse-empty-state mt-10 text-center text-[11px] text-muted-foreground">Nenhuma atividade registrada.</div>
                                    ) : (
                                        visibleTimeline.map((entry, idx) => (
                                            <div key={entry.id} className="synapse-timeline-row flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/28 dark:bg-white/[0.18] mt-1" />
                                                    {idx !== visibleTimeline.length - 1 && <div className="w-[1px] h-full bg-border/60 dark:bg-white/[0.05] mt-1" />}
                                                </div>
                                                <div className="flex flex-col flex-1 pb-4">
                                                    <span className="text-[10px] font-mono text-muted-foreground mb-0.5">{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</span>
                                                    <span className="text-[13px] text-foreground font-medium">{entry.label}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {timeline.length > TIMELINE_RENDER_LIMIT ? (
                                        <p className="px-1 text-center text-[10px] text-muted-foreground">Exibindo as últimas {TIMELINE_RENDER_LIMIT} atividades.</p>
                                    ) : null}
                                </motion.div>
                            ) : activeTab === 'voice' ? (
                                <motion.div
                                    key="voice"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="synapse-voice-view flex h-full min-h-[430px] flex-col items-center justify-center py-8"
                                >
                                    <div className="flex w-full items-center justify-between px-2">
                                        <span className="text-[11px] font-semibold text-muted-foreground">Conversa por voz</span>
                                        <span className={cn(
                                            'synapse-status-badge px-2.5 py-1.5 text-[10px] font-semibold',
                                            voiceStatus === 'connected' ? 'text-foreground' : 'text-muted-foreground',
                                        )}>
                                            {voiceStatus === 'connected' ? 'Ativa' : 'Preparando'}
                                        </span>
                                    </div>

                                    <div className="synapse-voice-stage mt-6 flex w-full flex-1 flex-col items-center justify-center">
                                        <div className="synapse-voice-orbit relative flex h-56 w-56 items-center justify-center">
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

                                        <div className="mt-7 flex flex-col items-center gap-2 text-center">
                                            <span className={cn('text-[18px] font-semibold', voiceStatus === 'connected' || isVoiceToolActive ? 'text-foreground' : cn('text-muted-foreground', !shouldReduceMotion && 'animate-pulse'))}>
                                            {voiceModeLabel}
                                        </span>
                                        <p className="max-w-[300px] text-[12px] leading-5 text-muted-foreground">
                                            {voiceModeDescription}
                                        </p>
                                        </div>
                                    </div>

                                    {voiceStatus === 'connected' && (
                                        <button
                                            type="button"
                                            onClick={() => toggleVoiceMode()}
                                            className="synapse-voice-end-button mt-6 flex min-h-11 items-center gap-2 px-4 py-2 text-[12px] font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="Encerrar chamada de voz"
                                        >
                                            <PhoneOff className="w-4 h-4" />
                                            Encerrar Chamada
                                        </button>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="chat"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="synapse-chat-view min-h-full py-3"
                                >
                                    <div className="synapse-context-pill mx-1 flex w-fit items-center px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
                                        <span>{ctxInfo.label}</span>
                                    </div>
                                    <SynapseConversation
                                        messages={messages}
                                        isSending={isSending}
                                        isProcessing={isChatProcessing}
                                        activityLabel={chatActivity.label}
                                        activityDetail={chatActivity.detail}
                                        activityMode={chatActivityMode}
                                        quickActions={quickActions}
                                        shouldReduceMotion={Boolean(shouldReduceMotion)}
                                        onQuickAction={handleActionClick}
                                    />
                                </motion.div>
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

            <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
                <AlertDialogContent className="synapse-actions-modal w-[min(420px,calc(100vw-24px))] rounded-[24px] border-border/60 p-5 dark:border-white/[0.09]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[17px]">Excluir esta conversa?</AlertDialogTitle>
                        <AlertDialogDescription className="text-[12px] leading-5">
                            O histórico desta conversa será removido. Essa ação não altera prontuários ou dados clínicos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-2 gap-2 sm:space-x-0">
                        <AlertDialogCancel className="min-h-11 rounded-[14px]">Manter conversa</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={clearSession}
                            className="min-h-11 rounded-[14px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Excluir conversa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
