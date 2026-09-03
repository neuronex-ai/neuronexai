import { FormEvent, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    ArrowUp,
    ArrowUpRight,
    ChevronDown,
    Loader2,
    Maximize2,
    Mic,
    Sparkles,
} from 'lucide-react';

import { useSynapse } from '@/context/SynapseContext';
import { useSynapseChat } from '@/hooks/use-synapse-chat';
import { useSynapseContextLabel } from '@/hooks/use-synapse-context-label';
import { sanitizeSynapseDisplayText } from '@/lib/synapse-humanize';
import { cn } from '@/lib/utils';
import { SynapseMarkdownContent } from './SynapseConversation';

const cleanSuggestedDraft = (value: string) =>
    value
        .replace(/\bcontexto clínico autorizado\b/gi, 'contexto clínico')
        .replace(/\bcontexto autorizado\b/gi, 'contexto')
        .replace(/\bacesso clínico seguro\b/gi, 'acesso clínico')
        .replace(/\s{2,}/g, ' ')
        .trim();

export const SynapseQuickComposer = () => {
    const shouldReduceMotion = useReducedMotion();
    const inputRef = useRef<HTMLInputElement>(null);
    const contextLabel = useSynapseContextLabel();
    const {
        inputDraft,
        inlineTurn,
        intentContextHint,
        quickActions,
        setActiveTab,
        setInlineTurn,
        setInputDraft,
        setIntentContextHint,
        setShellState,
        toggleVoiceMode,
        voiceStatus,
    } = useSynapse();
    const {
        send,
        messages,
        isSending,
        progressEvent,
        sessionReady,
    } = useSynapseChat();

    const contextualDraft = cleanSuggestedDraft(intentContextHint.trim());
    const visibleDraft = contextualDraft || inputDraft;
    const canSend = Boolean(visibleDraft.trim()) && sessionReady && !isSending;
    const voiceBusy = voiceStatus === 'connecting' || voiceStatus === 'disconnecting';

    const inlineAssistantMessage = useMemo(() => {
        if (!inlineTurn) return null;
        return messages
            .slice(inlineTurn.baselineMessageCount)
            .find((message) => message.role === 'assistant') || null;
    }, [inlineTurn, messages]);

    const inlinePrompt = sanitizeSynapseDisplayText(inlineTurn?.prompt, '');
    const hasInlineResponse = Boolean(inlineAssistantMessage?.content);
    const activityLabel = sanitizeSynapseDisplayText(
        progressEvent?.label,
        isSending ? 'Organizando o próximo passo…' : 'Preparando resposta…',
    );

    useEffect(() => {
        const timeout = window.setTimeout(() => inputRef.current?.focus(), 90);
        return () => window.clearTimeout(timeout);
    }, []);

    useEffect(() => {
        if (!contextualDraft) return;
        setInputDraft(contextualDraft);
        setIntentContextHint('');
    }, [contextualDraft, setInputDraft, setIntentContextHint]);

    const handleChange = (value: string) => {
        setInputDraft(value);
        if (intentContextHint) setIntentContextHint('');
    };

    const promoteContextualDraft = () => {
        if (!contextualDraft) return;
        setInputDraft(contextualDraft);
        setIntentContextHint('');
    };

    const openFullChat = () => {
        promoteContextualDraft();
        setInlineTurn(null);
        setActiveTab('chat');
        setShellState('compact');
    };

    const sendFromExpandedChat = (message: string) => {
        setInlineTurn(null);
        setActiveTab('chat');
        setShellState('compact');
        send(message);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSend) return;

        const message = visibleDraft.trim();
        setIntentContextHint('');
        setInputDraft('');
        setActiveTab('chat');

        if (inlineTurn) {
            sendFromExpandedChat(message);
            return;
        }

        setInlineTurn({
            prompt: message,
            baselineMessageCount: messages.length,
            startedAt: Date.now(),
        });
        send(message);
    };

    const handleSuggestion = (suggestion: string) => {
        if (inlineTurn) {
            sendFromExpandedChat(suggestion);
            return;
        }
        setInputDraft(suggestion);
        window.requestAnimationFrame(() => inputRef.current?.focus());
    };

    const handleInlineChoice = (choice: string) => {
        setInputDraft('');
        sendFromExpandedChat(choice);
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
            className="synapse-quick-composer w-[min(760px,calc(100vw-24px))] overflow-hidden rounded-[30px] border p-3 shadow-[0_30px_90px_-42px_rgba(0,0,0,0.52)] backdrop-blur-3xl dark:shadow-[0_34px_100px_-44px_rgba(0,0,0,0.96)]"
            aria-label="Compositor rápido do Synapse"
            data-synapse-shell="true"
            data-synapse-shell-placement="bottom-center"
        >
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
                <div className="flex min-w-0 items-center gap-2.5 text-[10px] font-semibold tracking-[-0.01em] text-muted-foreground/70">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                        {inlinePrompt ? `Synapse · ${inlinePrompt}` : contextLabel}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={openFullChat}
                        className="flex h-8 w-8 items-center justify-center rounded-[11px] text-muted-foreground/65 transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                        aria-label="Abrir conversa completa"
                        title="Abrir conversa"
                    >
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setShellState('pill')}
                        className="flex h-8 w-8 items-center justify-center rounded-[11px] text-muted-foreground/65 transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                        aria-label="Minimizar Synapse"
                        title="Minimizar"
                    >
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {inlineTurn ? (
                    <motion.section
                        key="inline-turn"
                        initial={shouldReduceMotion ? false : { opacity: 0, height: 0, y: 4 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -2 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                        className="mb-3 overflow-hidden rounded-[22px] border border-foreground/[0.065] bg-background/52 dark:border-white/[0.07] dark:bg-black/24"
                        aria-label="Primeira resposta do Synapse"
                    >
                        <div className="max-h-[250px] overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
                            {hasInlineResponse ? (
                                <div className="synapse-markdown min-w-0 text-[12.5px] leading-[1.68] text-foreground/82 dark:text-white/82">
                                    <SynapseMarkdownContent
                                        content={inlineAssistantMessage?.content || ''}
                                        onQuickAction={handleInlineChoice}
                                    />
                                </div>
                            ) : (
                                <div className="flex min-h-16 items-center gap-2.5 text-[11.5px] font-medium text-muted-foreground/75">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                    <span>{activityLabel}</span>
                                </div>
                            )}

                            <div
                                data-synapse-inline-response-target="true"
                                className="min-w-0"
                                aria-live="polite"
                            />
                        </div>

                        {hasInlineResponse ? (
                            <div className="flex justify-end border-t border-foreground/[0.055] px-3 py-2.5 dark:border-white/[0.055]">
                                <button
                                    type="button"
                                    onClick={openFullChat}
                                    className="group flex min-h-8 items-center gap-1.5 rounded-full border border-foreground/[0.075] bg-foreground/[0.025] px-3 text-[10px] font-semibold text-foreground/72 transition-[background-color,border-color,color,transform] hover:-translate-y-px hover:border-foreground/[0.13] hover:bg-foreground/[0.055] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white/72 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.06] dark:hover:text-white"
                                >
                                    Continuar no chat
                                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                                </button>
                            </div>
                        ) : null}
                    </motion.section>
                ) : null}
            </AnimatePresence>

            {quickActions.length > 0 ? (
                <div className="mb-2.5 flex flex-wrap gap-1.5 px-0.5" aria-label="Sugestões do Synapse">
                    {quickActions.slice(0, 4).map((tool) => (
                        <button
                            key={tool.id}
                            type="button"
                            onClick={() => handleSuggestion(tool.name)}
                            disabled={isSending}
                            className="min-h-8 rounded-full border border-foreground/[0.075] bg-foreground/[0.018] px-3 text-[10.5px] font-semibold text-foreground/72 transition-[background-color,border-color,color,transform] hover:-translate-y-px hover:border-foreground/[0.13] hover:bg-foreground/[0.045] hover:text-foreground disabled:pointer-events-none disabled:opacity-45 dark:border-white/[0.08] dark:bg-white/[0.018] dark:text-white/72 dark:hover:border-white/[0.14] dark:hover:bg-white/[0.05] dark:hover:text-white"
                        >
                            {tool.name}
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="flex min-h-[62px] items-center gap-2 rounded-[22px] border border-zinc-200/70 bg-white/58 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition-[border-color,background-color,box-shadow] focus-within:border-zinc-300/80 focus-within:bg-white/76 dark:border-white/[0.075] dark:bg-black/28 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] dark:focus-within:border-white/[0.12] dark:focus-within:bg-black/36">
                <Sparkles className="ml-1 h-4 w-4 shrink-0 text-muted-foreground/58" aria-hidden="true" />
                <input
                    ref={inputRef}
                    value={visibleDraft}
                    onChange={(event) => handleChange(event.target.value)}
                    placeholder={inlineTurn ? 'Continue a conversa…' : 'Pergunte ao Synapse…'}
                    disabled={!sessionReady || isSending}
                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent px-1 py-2 text-[14px] font-medium text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground/46 focus:border-transparent focus:outline-none focus:ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
                    aria-label="Mensagem para o Synapse"
                />
                <motion.button
                    type="button"
                    onClick={() => void handleVoice()}
                    disabled={voiceBusy}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground/65 transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.055]"
                    aria-label="Conversar por voz com o Synapse"
                >
                    <Mic className="h-[16px] w-[16px]" aria-hidden="true" />
                </motion.button>
                <motion.button
                    type="submit"
                    disabled={!canSend}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                    className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,opacity,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        canSend
                            ? 'bg-foreground text-background hover:scale-[1.03]'
                            : 'bg-foreground/[0.07] text-muted-foreground/45 dark:bg-white/[0.07]',
                    )}
                    aria-label={inlineTurn ? 'Enviar e continuar no chat' : 'Enviar ao Synapse'}
                >
                    <ArrowUp className="h-[17px] w-[17px]" aria-hidden="true" />
                </motion.button>
            </div>

            <p className="px-2 pt-2 text-center text-[9.5px] font-medium tracking-[-0.01em] text-muted-foreground/48">
                Synapse prepara. Você confirma.
            </p>
        </motion.form>
    );
};
