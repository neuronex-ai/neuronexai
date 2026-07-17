import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSynapse, type SynapseActiveTab } from '@/context/SynapseContext';
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
    MessageSquare,
    MoreHorizontal,
    Plus,
    Smartphone,
    Keyboard,
    Mic,
} from 'lucide-react';
import { SynapseComposer, SynapseConversation, SynapseMarkdownContent } from './SynapseConversation';
import { parseSynapseWidgetsFromContent } from '@/lib/synapse-widget-parser';

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
];

const HISTORY_CHANNELS = [
    { id: 'text' as const, label: 'Conversas por texto', icon: Keyboard },
    { id: 'voice' as const, label: 'Conversas por voz', icon: Mic },
    { id: 'whatsapp' as const, label: 'Conversas do WhatsApp', icon: Smartphone },
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
        inputDraft,
        setInputDraft,
        timeline,
        execState,
        activeTab,
        setActiveTab,
        setActiveSessionId,
    } = useSynapse();
    const { currentContext } = useAI();
    const {
        send,
        messages,
        isSending,
        progressEvent,
        sessionReady,
        clearSession,
        startNewSession,
        isStartingSession,
    } = useSynapseChat();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const [isListening, setIsListening] = useState(false);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [historyChannel, setHistoryChannel] = useState<'text' | 'voice' | 'whatsapp'>('text');
    const displayedTab: Exclude<SynapseActiveTab, 'voice'> = activeTab === 'voice' ? 'chat' : activeTab;
    const historyQuery = useChatSessionHistory(historyChannel, shellState === 'compact' && displayedTab === 'history');
    const sessions = useMemo(() => {
        const uniqueSessions = new Map<string, ChatSession>();
        historyQuery.data?.pages.forEach((page) => {
            page.sessions.forEach((session) => uniqueSessions.set(session.id, session));
        });
        return Array.from(uniqueSessions.values());
    }, [historyQuery.data]);

    useEffect(() => {
        if (shellState === 'compact' && activeTab === 'voice') setActiveTab('chat');
    }, [activeTab, setActiveTab, shellState]);

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

                return () => {
                    recognition.onresult = null;
                    recognition.onerror = null;
                    recognition.onend = null;
                    try {
                        recognition.stop();
                    } catch {
                        // Some engines throw when stop is called before recognition starts.
                    }
                    if (recognitionRef.current === recognition) recognitionRef.current = null;
                };
            }

            return undefined;
        }

        return undefined;
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
    const isChatProcessing = displayedTab === 'chat' && (isSending || execState === 'thinking' || execState === 'executing');
    const chatActivityMode = execState === 'executing'
        ? 'executing' as const
        : progressEvent?.label && progressEvent.stage !== 'received'
            ? 'responding' as const
            : 'thinking' as const;

    useEffect(() => {
        if (shellState === 'compact' && displayedTab === 'chat') {
            const timeout = window.setTimeout(() => inputRef.current?.focus(), 200);
            return () => window.clearTimeout(timeout);
        }
    }, [displayedTab, shellState]);

    useEffect(() => {
        if (displayedTab !== 'chat' || !scrollRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            const viewport = scrollRef.current;
            if (!viewport) return;
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior: 'auto',
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [displayedTab, messages]);

    if (shellState !== 'compact') return null;

    const handleSend = () => {
        if (!inputDraft.trim() || !sessionReady || isSending) return;
        send(inputDraft.trim());
        setInputDraft('');
    };

    const handleTabChange = (tab: SynapseActiveTab) => {
        setActiveTab(tab);
    };

    const handleNewConversation = async () => {
        const didStart = await startNewSession();
        if (!didStart) return;
        setInputDraft('');
        setActiveTab('chat');
        window.requestAnimationFrame(() => inputRef.current?.focus());
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

    return (
        <>
            <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.975 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                    opacity: { duration: 0.16, ease: 'easeOut' },
                    y: { type: 'spring', stiffness: 420, damping: 39, mass: 0.78 },
                    scale: { type: 'spring', stiffness: 420, damping: 39, mass: 0.78 },
                }}
                id="synapse-panel"
                className={cn(
                    'synapse-desktop-shell synapse-chat-panel flex min-h-0 w-[min(468px,calc(100vw-32px))] flex-col overflow-hidden rounded-[30px] border',
                )}
                role="complementary"
                aria-label="Assistente Synapse"
                data-synapse-shell="true"
                data-synapse-shell-placement="bottom-right"
            >
                <div className="relative z-10 flex h-full min-h-0 flex-col">
                    <TooltipProvider delayDuration={300}>
                        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center px-3">
                            <div
                                className="synapse-liquid-toolbar pointer-events-auto flex items-center gap-1 p-1"
                                role="toolbar"
                                aria-label="Navegação e ações do Synapse"
                            >
                                <nav className="flex items-center gap-0.5" role="tablist" aria-label="Modos do Synapse">
                                    {PANEL_TABS.map((tab, index) => {
                                        const Icon = tab.icon;
                                        const isActive = displayedTab === tab.id;
                                        return (
                                            <Tooltip key={tab.id}>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        ref={(node) => { tabRefs.current[index] = node; }}
                                                        id={`synapse-tab-${tab.id}`}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={isActive}
                                                        aria-controls="synapse-tabpanel"
                                                        aria-label={tab.label}
                                                        tabIndex={isActive ? 0 : -1}
                                                        onClick={() => handleTabChange(tab.id)}
                                                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                                                        className={cn(
                                                            'synapse-liquid-control relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition-[color,transform] duration-150',
                                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                                                        )}
                                                    >
                                                        {isActive ? (
                                                            <motion.span
                                                                layoutId="synapse-active-tab"
                                                                className="synapse-liquid-tab-active absolute inset-0 rounded-full"
                                                                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }}
                                                                aria-hidden="true"
                                                            />
                                                        ) : null}
                                                        <Icon className="relative z-10 h-[17px] w-[17px]" aria-hidden="true" />
                                                        <span className="sr-only">{tab.label}</span>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" sideOffset={8}>{tab.label}</TooltipContent>
                                            </Tooltip>
                                        );
                                    })}
                                </nav>

                                <span className="mx-0.5 h-5 w-px bg-border/70 dark:bg-white/10" aria-hidden="true" />

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => void handleNewConversation()}
                                            disabled={isStartingSession || isSending}
                                            className="synapse-liquid-control flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="Nova conversa"
                                        >
                                            {isStartingSession
                                                ? <Loader2 className="h-[17px] w-[17px] animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                                : <Plus className="h-[18px] w-[18px]" aria-hidden="true" />}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={8}>Nova conversa</TooltipContent>
                                </Tooltip>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="synapse-liquid-control flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="Mais opções"
                                            title="Mais opções"
                                        >
                                            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        side="bottom"
                                        sideOffset={10}
                                        className="synapse-liquid-menu min-w-52 rounded-[18px] p-1.5"
                                    >
                                        <DropdownMenuItem
                                            disabled={messages.length === 0}
                                            onSelect={() => setConfirmClearOpen(true)}
                                            className="synapse-liquid-menu-item min-h-11 cursor-pointer gap-3 rounded-[13px] px-3 text-[12px] font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                            Excluir conversa
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onClick={() => setShellState('pill')}
                                            className="synapse-liquid-control flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            aria-label="Recolher Synapse"
                                        >
                                            <X className="h-[17px] w-[17px]" aria-hidden="true" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" sideOffset={8}>Recolher</TooltipContent>
                                </Tooltip>
                            </div>

                            <AnimatePresence initial={false}>
                                {displayedTab === 'history' ? (
                                    <motion.div
                                        key="history-channel-dock"
                                        initial={shouldReduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.985 }}
                                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                        className="synapse-history-channel-dock pointer-events-auto -mt-0.5 grid grid-cols-3 p-0.5 text-muted-foreground"
                                        role="tablist"
                                        aria-label="Canal das conversas"
                                    >
                                        {HISTORY_CHANNELS.map((channel) => {
                                            const Icon = channel.icon;
                                            const isActive = historyChannel === channel.id;
                                            return (
                                                <Tooltip key={channel.id}>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="button"
                                                            role="tab"
                                                            aria-selected={isActive}
                                                            aria-label={channel.label}
                                                            onClick={() => setHistoryChannel(channel.id)}
                                                            className={cn(
                                                                'relative isolate flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                                isActive ? 'text-background' : 'hover:text-foreground',
                                                            )}
                                                        >
                                                            {isActive ? (
                                                                <motion.span
                                                                    layoutId="synapse-history-channel"
                                                                    className="synapse-history-segment-active absolute inset-1 -z-10 rounded-full"
                                                                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 42 }}
                                                                    aria-hidden="true"
                                                                />
                                                            ) : null}
                                                            <Icon className="relative z-10 h-[15px] w-[15px]" aria-hidden="true" />
                                                            <span className="sr-only">{channel.label}</span>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" sideOffset={8}>{channel.label}</TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>
                        </div>
                    </TooltipProvider>

                    <div
                        ref={scrollRef}
                        id="synapse-tabpanel"
                        role="tabpanel"
                        aria-labelledby={`synapse-tab-${displayedTab}`}
                        className={cn(
                            'synapse-desktop-viewport relative min-h-0 flex-1 overflow-y-auto px-4',
                            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/20 dark:scrollbar-thumb-white/15',
                        )}
                    >
                        <AnimatePresence initial={false} mode="sync">
                            {displayedTab === 'history' ? (
                                <motion.div
                                    key="history"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="flex flex-col gap-3 pb-4 pt-[124px]"
                                >
                                    <div className="flex min-h-11 items-center justify-between px-2">
                                        <h3 className="text-[12px] font-semibold text-foreground">Conversas recentes</h3>
                                        {historyQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" />}
                                    </div>

                                    {historyQuery.isError ? (
                                        <div className="synapse-empty-state flex flex-col items-center gap-3 py-16 text-center text-muted-foreground" role="alert">
                                            <History className="h-7 w-7 opacity-60" aria-hidden="true" />
                                            <p className="max-w-64 text-[12px] font-medium">Não foi possível carregar o histórico.</p>
                                            <button
                                                type="button"
                                                onClick={() => void historyQuery.refetch()}
                                                className="synapse-history-retry min-h-11 rounded-full px-4 text-[11px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                Tentar novamente
                                            </button>
                                        </div>
                                    ) : sessions.length === 0 && !historyQuery.isLoading ? (
                                        <div className="synapse-empty-state flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
                                            <MessageSquare className="h-7 w-7 opacity-60" />
                                            <p className="text-[12px] font-medium">
                                                {historyChannel === 'whatsapp'
                                                    ? 'Nenhuma conversa do WhatsApp'
                                                    : historyChannel === 'voice'
                                                        ? 'Nenhuma conversa por voz'
                                                        : 'Nenhuma conversa por texto'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/60 dark:divide-white/[0.07]">
                                            {sessions.map((session) => {
                                                const isWpp = session.origin_channel === 'whatsapp' || session.context_state?.source === 'whatsapp';
                                                const isVoice = session.origin_channel === 'voice';
                                                const isPsychologist = session.context_state?.conversation_kind === 'psychologist';
                                                const title = isWpp
                                                    ? isPsychologist
                                                        ? 'Você e Synapse'
                                                        : session.context_state?.pushName || session.title?.replace(/^WhatsApp Business\s*-\s*/i, '') || session.context_state?.phoneNumber || 'Paciente'
                                                    : session.title || (isVoice ? 'Conversa por voz' : 'Conversa com o Synapse');
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
                                                                {isWpp
                                                                    ? <Smartphone className="h-4 w-4" />
                                                                    : isVoice
                                                                        ? <Mic className="h-4 w-4" />
                                                                        : <Keyboard className="h-4 w-4" />}
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
                            ) : displayedTab === 'timeline' ? (
                                <motion.div
                                    key="timeline"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="flex flex-col gap-4 pb-4 pt-20"
                                >
                                    {visibleTimeline.length === 0 ? (
                                        <div className="synapse-empty-state mt-10 text-center text-[11px] text-muted-foreground">Nenhuma atividade registrada.</div>
                                    ) : (
                                        visibleTimeline.map((entry, idx) => {
                                            const label = parseSynapseWidgetsFromContent(entry.label).cleanContent || 'Atividade do Synapse';
                                            const detail = entry.detail
                                                ? parseSynapseWidgetsFromContent(entry.detail).cleanContent
                                                : '';
                                            return (
                                                <div key={entry.id} className="synapse-timeline-row flex min-w-0 gap-4">
                                                    <div className="flex flex-col items-center">
                                                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-muted-foreground/28 dark:bg-white/[0.18]" />
                                                        {idx !== visibleTimeline.length - 1 && <div className="mt-1 h-full w-px bg-border/60 dark:bg-white/[0.05]" />}
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 flex-col pb-4">
                                                        <span className="mb-1 text-[10px] font-mono text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</span>
                                                        <div className="synapse-desktop-prose synapse-timeline-prose min-w-0 text-[13px] font-medium text-foreground">
                                                            <SynapseMarkdownContent content={label} renderWidgets={false} />
                                                        </div>
                                                        {detail ? (
                                                            <div className="synapse-desktop-prose synapse-timeline-detail mt-1 min-w-0 text-[10px] text-muted-foreground">
                                                                <SynapseMarkdownContent content={detail} renderWidgets={false} />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    {timeline.length > TIMELINE_RENDER_LIMIT ? (
                                        <p className="px-1 text-center text-[10px] text-muted-foreground">Exibindo as últimas {TIMELINE_RENDER_LIMIT} atividades.</p>
                                    ) : null}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="chat"
                                    initial={shouldReduceMotion ? false : { opacity: 0, x: 3 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                                    className="synapse-chat-view flex min-h-full flex-col pb-3.5 pt-20"
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

                    {displayedTab === 'chat' ? (
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
