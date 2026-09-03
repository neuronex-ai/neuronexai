import { FormEvent, useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Command, Maximize2, Mic, Sparkles, X } from 'lucide-react';

import { useAI } from '@/context/AIContext';
import { useSynapse } from '@/context/SynapseContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { cn } from '@/lib/utils';

const CONTEXT_LABELS: Record<string, string> = {
    dashboard: 'Hoje · clínica',
    'patient-profile': 'Paciente em tela',
    patients: 'Pacientes',
    calendar: 'Agenda',
    finance: 'Gestão financeira',
    session: 'Teleconsulta',
    notes: 'Notas',
    synapse: 'Synapse',
};

export const SynapseQuickComposer = () => {
    const shouldReduceMotion = useReducedMotion();
    const inputRef = useRef<HTMLInputElement>(null);
    const { currentContext } = useAI();
    const {
        inputDraft,
        intentContextHint,
        setActiveTab,
        setInputDraft,
        setIntentContextHint,
        setShellState,
        toggleVoiceMode,
        voiceStatus,
    } = useSynapse();
    const { send, isSending, sessionReady } = useSynapseChat();

    const contextLabel = useMemo(
        () => CONTEXT_LABELS[currentContext] || 'Contexto atual',
        [currentContext],
    );
    const visibleDraft = intentContextHint.trim() || inputDraft;
    const canSend = Boolean(visibleDraft.trim()) && sessionReady && !isSending;
    const voiceBusy = voiceStatus === 'connecting' || voiceStatus === 'disconnecting';

    useEffect(() => {
        const timeout = window.setTimeout(() => inputRef.current?.focus(), 90);
        return () => window.clearTimeout(timeout);
    }, []);

    // Home suggestions use intentContextHint as a transport so the compact
    // launcher can reveal the complete, contextualized question. Promote it
    // immediately into the real draft: from this point on the professional can
    // edit exactly what will be sent, both minimized and expanded.
    useEffect(() => {
        const contextualDraft = intentContextHint.trim();
        if (!contextualDraft) return;
        setInputDraft(contextualDraft);
        setIntentContextHint('');
    }, [intentContextHint, setInputDraft, setIntentContextHint]);

    const handleChange = (value: string) => {
        setInputDraft(value);
        if (intentContextHint) setIntentContextHint('');
    };

    const promoteContextualDraft = () => {
        const contextualDraft = intentContextHint.trim();
        if (!contextualDraft) return;
        setInputDraft(contextualDraft);
        setIntentContextHint('');
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSend) return;
        const message = visibleDraft.trim();
        setIntentContextHint('');
        send(message);
        setInputDraft('');
        setActiveTab('chat');
        setShellState('compact');
    };

    const handleExpand = () => {
        promoteContextualDraft();
        setActiveTab('chat');
        setShellState('compact');
    };

    const handleVoice = async () => {
        setIntentContextHint('');
        setShellState('pill');
        await toggleVoiceMode();
    };

    return (
        <motion.form
            id="synapse-quick-composer"
            onSubmit={handleSubmit}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 7, scale: 0.985 }}
            transition={shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 410, damping: 38, mass: 0.76 }}
            className="synapse-quick-composer w-[min(680px,calc(100vw-24px))] rounded-[26px] border p-2 shadow-[0_26px_80px_-38px_rgba(0,0,0,0.45)] backdrop-blur-3xl dark:shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]"
            role="search"
            aria-label="Compositor rápido do Synapse"
            aria-keyshortcuts="Control+K Meta+K"
            data-synapse-shell="true"
            data-synapse-shell-placement="bottom-center"
        >
            <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">Contexto · {contextLabel}</span>
                </div>
                <div className="hidden items-center gap-1 rounded-full border border-foreground/[0.06] px-2 py-1 text-[9px] font-semibold text-muted-foreground/65 dark:border-white/[0.06] sm:flex">
                    <Command className="h-3 w-3" aria-hidden="true" />K
                </div>
                <button
                    type="button"
                    onClick={handleExpand}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                    aria-label="Abrir workspace do Synapse"
                    title="Abrir conversa"
                >
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => setShellState('pill')}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                    aria-label="Recolher Synapse"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            <div className="flex min-h-[58px] items-center gap-2 rounded-[20px] border border-zinc-200/70 bg-white/58 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition-[border-color,background-color,box-shadow] focus-within:border-zinc-300/80 focus-within:bg-white/76 dark:border-white/[0.075] dark:bg-white/[0.045] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] dark:focus-within:border-white/[0.12] dark:focus-within:bg-white/[0.06]">
                <Sparkles className="ml-1 h-4.5 w-4.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                <input
                    ref={inputRef}
                    value={visibleDraft}
                    onChange={(event) => handleChange(event.target.value)}
                    placeholder="Pergunte ou peça algo ao Synapse"
                    disabled={!sessionReady || isSending}
                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent px-1 py-2 text-[14px] font-medium text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/48 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
                    aria-label="Mensagem rápida para o Synapse"
                />
                <motion.button
                    type="button"
                    onClick={() => void handleVoice()}
                    disabled={voiceBusy}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                    aria-label="Conversar por voz com o Synapse"
                >
                    <Mic className="h-[17px] w-[17px]" aria-hidden="true" />
                </motion.button>
                <motion.button
                    type="submit"
                    disabled={!canSend}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                    className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-[background-color,color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        canSend
                            ? 'bg-foreground text-background'
                            : 'bg-foreground/[0.07] text-muted-foreground/45 dark:bg-white/[0.07]',
                    )}
                    aria-label="Enviar ao Synapse"
                >
                    <ArrowUp className="h-[17px] w-[17px]" aria-hidden="true" />
                </motion.button>
            </div>
        </motion.form>
    );
};
