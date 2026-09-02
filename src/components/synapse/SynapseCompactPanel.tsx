import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSynapse } from '@/context/SynapseContext';
import { useAI } from '@/context/AIContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { useChatSessionHistory, type ChatSession } from '@/hooks/use-ai-chat';
import { sanitizeSynapseDisplayText } from '@/lib/synapse-humanize';
import {
    Activity,
    Calendar,
    ChevronRight,
    History,
    Keyboard,
    Loader2,
    MessageSquare,
    Mic,
    MoreHorizontal,
    Notebook,
    Plus,
    Smartphone,
    Sparkles,
    Stethoscope,
    Trash2,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { SynapseComposer, SynapseConversation, SynapseMarkdownContent } from './SynapseConversation';
import { parseSynapseWidgetsFromContent } from '@/lib/synapse-widget-parser';

const CONTEXT_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
    dashboard: { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Hoje · clínica' },
    'patient-profile': { icon: <Users className="h-3.5 w-3.5" />, label: 'Paciente em tela' },
    patients: { icon: <Users className="h-3.5 w-3.5" />, label: 'Pacientes' },
    calendar: { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Agenda' },
    finance: { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Gestão financeira' },
    session: { icon: <Stethoscope className="h-3.5 w-3.5" />, label: 'Teleconsulta' },
    notes: { icon: <Notebook className="h-3.5 w-3.5" />, label: 'Notas' },
    synapse: { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Synapse' },
};

const HISTORY_CHANNELS = [
    { id: 'text' as const, label: 'Texto', icon: Keyboard },
    { id: 'voice' as const, label: 'Voz', icon: Mic },
    { id: 'whatsapp' as const, label: 'WhatsApp', icon: Smartphone },
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

const inferChatActivity = (prompt: string, contextLabel: string): ActivityCopy => {
    const cleanPrompt = sanitizeSynapseDisplayText(prompt, '');
    const normalized = normalizeIntent(cleanPrompt);

    if (/\b(relatorio|resumo|analise)\b/.test(normalized) && /\bpacient/.test(normalized)) {
        return { label: 'Organizando contexto dos pacientes', detail: 'Conferindo informações autorizadas' };
    }
    if (/\b(listar|mostrar|buscar|procurar|encontrar)\b/.test(normalized) && /\bpacient/.test(normalized)) {
        return { label: 'Consultando pacientes', detail: 'Lendo registros disponíveis' };
    }
    if (/\b(agenda|horario|consulta|atendimento)\b/.test(normalized)) {
        return { label: 'Consultando agenda clínica', detail: 'Verificando horários e atendimentos' };
    }
    if (/\b(financeiro|faturamento|cobranca|pagamento|saldo|extrato|transacao)\b/.test(normalized)) {
        return { label: 'Conferindo dados financeiros', detail: 'Verificando gestão e movimentações' };
    }
    if (/\b(nota|documento|laudo|atestado|parecer|email|e-mail)\b/.test(normalized)) {
        return { label: 'Preparando conteúdo solicitado', detail: 'Organizando informações do sistema' };
    }

    return { label: 'Processando solicitação', detail: `Contexto atual: ${contextLabel}` };
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
        setIntentContextHint,
        toggleVoiceMode,
        voiceStatus,
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
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const [historyChannel, setHistoryChannel] = useState<'text' | 'voice' | 'whatsapp'>('text');
    const displayedTab: 'chat' | 'history' | 'timeline' = activeTab === 'voice' ? 'chat' : activeTab;
    const historyQuery = useChatSessionHistory(historyChannel, shellState === 'compact' && displayedTab === 'history');

    const sessions = useMemo(() => {
        const uniqueSessions = new Map<string, ChatSession>();
        historyQuery.data?.pages.forEach((page) => {
            page.sessions.forEach((session) => uniqueSessions.set(session.id, session));
        });
        return Array.from(uniqueSessions.values());
    }, [historyQuery.data]);

    const visibleTimeline = useMemo(
        () => timeline.slice(-TIMELINE_RENDER_LIMIT).reverse(),
        [timeline],
    );
    const ctxInfo = CONTEXT_LABELS[currentContext] || {
        icon: <Sparkles className="h-3.5 w-3.5" />,
        label: 'Contexto atual',
    };

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
            label: sanitizeSynapseDisplayText(latestExecutionEntry.label, 'Executando ação'),
            detail: sanitizeSynapseDisplayText(latestExecutionEntry.detail, 'Atualizando o sistema.'),
        }
        : progressEvent?.label
            ? {
                label: sanitizeSynapseDisplayText(progressEvent.label, 'Processando solicitação'),
                detail: sanitizeSynapseDisplayText(progressEvent.detail, 'Acompanhando progresso.'),
            }
            : inferredChatActivity;
    const isChatProcessing = displayedTab === 'chat' && (isSending || execState === 'thinking' || execState === 'executing');
    const chatActivityMode = execState === 'executing'
        ? 'executing' as const
        : progressEvent?.label && progressEvent.stage !== 'received'
            ? 'responding' as const
            : 'thinking' as const;
    const voiceActive = voiceStatus === 'connected' || voiceStatus === 'connecting';

    useEffect(() => {
        if (shellState === 'compact' && displayedTab === 'chat') {
            const timeout = window.setTimeout(() => inputRef.current?.focus(), 180);
            return () => window.clearTimeout(timeout);
        }
        return undefined;
    }, [displayedTab, shellState]);

    useEffect(() => {
        if (displayedTab !== 'chat' || !scrollRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            const viewport = scrollRef.current;
            if (!viewport) return;
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'auto' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [displayedTab, messages]);

    if (shellState !== 'compact') return null;

    const handleSend = () => {
        if (!inputDraft.trim() || !sessionReady || isSending) return;
        send(inputDraft.trim());
        setInputDraft('');
    };

    const handleActionClick = (toolName: string) => {
        setIntentContextHint('');
        send(toolName.replace(/_/g, ' '));
    };

    const handleNewConversation = async () => {
        const didStart = await startNewSession();
        if (!didStart) return;
        setInputDraft('');
        setActiveTab('chat');
        window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleVoice = () => {
        setIntentContextHint('');
        setActiveTab('voice');
        setShellState('pill');
        void toggleVoiceMode();
    };

    return (
        <>
            <motion.aside
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 10, scale: 0.985 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.99 }}
                transition={shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 410, damping: 40, mass: 0.78 }}
                id="synapse-panel"
                className="synapse-desktop-shell synapse-chat-panel flex min-h-0 w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border"
                role="complementary"
                aria-label="Workspace do Synapse"
                data-synapse-shell="true"
                data-synapse-shell-placement="bottom-right"
            >
                <header className="relative z-20 flex min-h-[64px] shrink-0 items-center justify-between gap-3 border-b border-foreground/[0.055] px-4 dark:border-white/[0.05]">
                    <button
                        type="button"
                        onClick={() => setActiveTab('chat')}
                        className="group flex min-w-0 items-center gap-2.5 rounded-[14px] px-1.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Voltar para a conversa"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-foreground/[0.045] text-foreground dark:bg-white/[0.055]">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-[12px] font-semibold text-foreground">Synapse</span>
                            <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-medium text-muted-foreground">
                                {ctxInfo.icon}
                                Contexto · {ctxInfo.label}
                            </span>
                        </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => setActiveTab(displayedTab === 'history' ? 'chat' : 'history')}
                            className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]',
                                displayedTab === 'history' && 'bg-foreground/[0.06] text-foreground dark:bg-white/[0.07]',
                            )}
                            aria-label={displayedTab === 'history' ? 'Voltar para conversa' : 'Abrir histórico'}
                            title="Histórico"
                        >
                            {displayedTab === 'history'
                                ? <MessageSquare className="h-4 w-4" aria-hidden="true" />
                                : <History className="h-4 w-4" aria-hidden="true" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleNewConversation()}
                            disabled={isStartingSession || isSending}
                            className="flex h-10 w-10 items-center justify-center rounded-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                            aria-label="Nova conversa"
                            title="Nova conversa"
                        >
                            {isStartingSession
                                ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                : <Plus className="h-4 w-4" aria-hidden="true" />}
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex h-10 w-10 items-center justify-center rounded-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                                    aria-label="Mais opções"
                                >
                                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={8} className="synapse-liquid-menu min-w-48 rounded-[16px] p-1.5">
                                <DropdownMenuItem
                                    onSelect={() => setActiveTab('timeline')}
                                    className="synapse-liquid-menu-item min-h-10 cursor-pointer gap-2.5 rounded-[12px] px-3 text-[11px] font-semibold"
                                >
                                    <Activity className="h-4 w-4" aria-hidden="true" />
                                    Atividade
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    disabled={messages.length === 0}
                                    onSelect={() => setConfirmClearOpen(true)}
                                    className="synapse-liquid-menu-item min-h-10 cursor-pointer gap-2.5 rounded-[12px] px-3 text-[11px] font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    Excluir conversa
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                            type="button"
                            onClick={() => setShellState('composer')}
                            className="flex h-10 w-10 items-center justify-center rounded-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                            aria-label="Recolher para o compositor rápido"
                            title="Recolher"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </header>

                <div
                    ref={scrollRef}
                    className="synapse-desktop-viewport relative min-h-0 flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/20 dark:scrollbar-thumb-white/15"
                >
                    <AnimatePresence initial={false} mode="sync">
                        {displayedTab === 'history' ? (
                            <motion.section
                                key="history"
                                initial={shouldReduceMotion ? false : { opacity: 0, x: 4 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -4 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                className="pb-5 pt-5"
                                aria-label="Histórico do Synapse"
                            >
                                <div className="mb-4 flex items-center justify-between gap-3 px-1">
                                    <div>
                                        <h3 className="text-[14px] font-semibold text-foreground">Conversas recentes</h3>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground">Continue de onde parou.</p>
                                    </div>
                                    {historyQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                                </div>

                                <div className="mb-3 grid grid-cols-3 rounded-[14px] bg-foreground/[0.035] p-1 dark:bg-white/[0.04]">
                                    {HISTORY_CHANNELS.map((channel) => {
                                        const Icon = channel.icon;
                                        const active = historyChannel === channel.id;
                                        return (
                                            <button
                                                key={channel.id}
                                                type="button"
                                                onClick={() => setHistoryChannel(channel.id)}
                                                className={cn(
                                                    'flex min-h-9 items-center justify-center gap-1.5 rounded-[11px] px-2 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    active
                                                        ? 'bg-background text-foreground shadow-sm dark:bg-white/[0.08]'
                                                        : 'text-muted-foreground hover:text-foreground',
                                                )}
                                                aria-pressed={active}
                                            >
                                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                                <span className="hidden min-[390px]:inline">{channel.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {historyQuery.isError ? (
                                    <div className="py-14 text-center text-[11px] text-muted-foreground" role="alert">
                                        Não foi possível carregar o histórico.
                                    </div>
                                ) : sessions.length === 0 && !historyQuery.isLoading ? (
                                    <div className="py-14 text-center text-[11px] text-muted-foreground">Nenhuma conversa neste canal.</div>
                                ) : (
                                    <div className="divide-y divide-border/55 dark:divide-white/[0.055]">
                                        {sessions.map((session) => {
                                            const isWpp = session.origin_channel === 'whatsapp' || session.context_state?.source === 'whatsapp';
                                            const isVoice = session.origin_channel === 'voice';
                                            const isPsychologist = session.context_state?.conversation_kind === 'psychologist';
                                            const title = isWpp
                                                ? isPsychologist
                                                    ? 'Você e Synapse'
                                                    : session.context_state?.pushName || session.title?.replace(/^WhatsApp Business\s*-\s*/i, '') || session.context_state?.phoneNumber || 'Paciente'
                                                : session.title || (isVoice ? 'Conversa por voz' : 'Conversa com o Synapse');
                                            const ChannelIcon = isWpp ? Smartphone : isVoice ? Mic : Keyboard;

                                            return (
                                                <button
                                                    key={session.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveSessionId(session.id);
                                                        setActiveTab('chat');
                                                    }}
                                                    className="group flex min-h-[68px] w-full items-center gap-3 px-1 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                                >
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-muted/55 text-muted-foreground">
                                                        <ChannelIcon className="h-4 w-4" aria-hidden="true" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-[12px] font-semibold text-foreground">{title}</span>
                                                        <span className="mt-1 block text-[9px] text-muted-foreground">
                                                            {session.updated_at ? new Date(session.updated_at).toLocaleDateString('pt-BR') : 'Sem data'}
                                                        </span>
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {historyQuery.hasNextPage ? (
                                    <button
                                        type="button"
                                        onClick={() => void historyQuery.fetchNextPage()}
                                        disabled={historyQuery.isFetchingNextPage}
                                        className="mt-3 flex min-h-10 w-full items-center justify-center text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                                    >
                                        {historyQuery.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
                                    </button>
                                ) : null}
                            </motion.section>
                        ) : displayedTab === 'timeline' ? (
                            <motion.section
                                key="timeline"
                                initial={shouldReduceMotion ? false : { opacity: 0, x: 4 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -4 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                className="pb-5 pt-5"
                                aria-label="Atividade do Synapse"
                            >
                                <div className="mb-5 flex items-center justify-between px-1">
                                    <div>
                                        <h3 className="text-[14px] font-semibold">Atividade</h3>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground">O que o Synapse fez nesta sessão.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('chat')}
                                        className="rounded-full border border-foreground/[0.06] px-3 py-1.5 text-[9px] font-semibold text-muted-foreground hover:text-foreground dark:border-white/[0.06]"
                                    >
                                        Conversa
                                    </button>
                                </div>
                                {visibleTimeline.length === 0 ? (
                                    <p className="py-14 text-center text-[11px] text-muted-foreground">Nenhuma atividade registrada.</p>
                                ) : (
                                    <div className="space-y-0">
                                        {visibleTimeline.map((entry, index) => {
                                            const label = parseSynapseWidgetsFromContent(entry.label).cleanContent || 'Atividade do Synapse';
                                            const detail = entry.detail ? parseSynapseWidgetsFromContent(entry.detail).cleanContent : '';
                                            return (
                                                <div key={entry.id} className="flex min-w-0 gap-3">
                                                    <div className="flex w-3 shrink-0 flex-col items-center">
                                                        <span className="mt-1.5 h-2 w-2 rounded-full bg-muted-foreground/35" />
                                                        {index !== visibleTimeline.length - 1 ? <span className="mt-1 min-h-8 flex-1 w-px bg-border/60 dark:bg-white/[0.055]" /> : null}
                                                    </div>
                                                    <div className="min-w-0 flex-1 pb-5">
                                                        <time className="text-[9px] font-medium text-muted-foreground">
                                                            {new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </time>
                                                        <div className="synapse-desktop-prose mt-1 text-[12px] font-medium text-foreground">
                                                            <SynapseMarkdownContent content={label} renderWidgets={false} />
                                                        </div>
                                                        {detail ? (
                                                            <div className="synapse-desktop-prose mt-1 text-[10px] text-muted-foreground">
                                                                <SynapseMarkdownContent content={detail} renderWidgets={false} />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.section>
                        ) : (
                            <motion.section
                                key="chat"
                                initial={shouldReduceMotion ? false : { opacity: 0, x: 4 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -4 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                className="flex min-h-full flex-col pb-2 pt-3"
                                aria-label="Conversa com o Synapse"
                            >
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
                            </motion.section>
                        )}
                    </AnimatePresence>
                </div>

                {displayedTab === 'chat' ? (
                    <SynapseComposer
                        ref={inputRef}
                        value={inputDraft}
                        isSending={isSending}
                        isListening={voiceActive}
                        sessionReady={sessionReady}
                        shouldReduceMotion={Boolean(shouldReduceMotion)}
                        onChange={(value) => {
                            setIntentContextHint('');
                            setInputDraft(value);
                        }}
                        onSend={handleSend}
                        onToggleListening={handleVoice}
                    />
                ) : null}
            </motion.aside>

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
