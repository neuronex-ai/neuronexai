import React, {
  forwardRef,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, ChevronRight, Copy, Loader2, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useSynapseContextLabel } from '@/hooks/use-synapse-context-label';
import { cn } from '@/lib/utils';
import { sanitizeSynapseMarkdown } from '@/lib/synapse-humanize';
import { parseSynapseWidgetsFromContent } from '@/lib/synapse-widget-parser';
import type { Message } from '@/types';

import { SynapseProcessingState } from './SynapseProcessingState';
import { SynapseWidgetRenderer } from './SynapseWidgetRenderer';

type MarkdownPreProps = React.ComponentPropsWithoutRef<'pre'> & { node?: unknown };
type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> & {
    node?: unknown;
    inline?: boolean;
    className?: string;
};
type MarkdownAnchorProps = React.ComponentPropsWithoutRef<'a'> & { node?: unknown };
type MarkdownTableProps = React.ComponentPropsWithoutRef<'table'> & { node?: unknown };

type QuickAction = {
    id: string;
    name: string;
};

type SynapseChoicePrompt = {
    body: string;
    options: string[];
};

type SynapseConversationProps = {
    messages: Message[];
    isSending: boolean;
    isProcessing?: boolean;
    activityLabel?: string;
    activityDetail?: string;
    activityMode?: 'thinking' | 'responding' | 'executing';
    quickActions: QuickAction[];
    shouldReduceMotion: boolean;
    onQuickAction: (name: string) => void;
};

type SynapseComposerProps = {
    value: string;
    isSending: boolean;
    isListening: boolean;
    sessionReady: boolean;
    shouldReduceMotion: boolean;
    onChange: (value: string) => void;
    onSend: () => void;
    onToggleListening: () => void;
};

const CHOICE_TRIGGER_PATTERN = /\b(?:qual\s+(?:das|dos|dessas|desses|op[cç][oõ]es)|qual\s+(?:voc[eê]\s+)?prefere|o\s+que\s+(?:voc[eê]\s+)?prefere|escolha|selecione|indique\s+(?:a|o|uma|um)|por\s+favor,?\s*indique)\b/i;
const CHOICE_OPTION_PATTERN = /^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/;

const stripChoiceFormatting = (value: string) => value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

const parseSynapseChoicePrompt = (content: string): SynapseChoicePrompt | null => {
    const normalized = content.trim();
    if (!normalized || !CHOICE_TRIGGER_PATTERN.test(normalized)) return null;

    const lines = normalized.split(/\r?\n/);
    const optionIndexes = new Set<number>();
    const options: string[] = [];

    lines.forEach((line, index) => {
        const match = line.match(CHOICE_OPTION_PATTERN);
        if (!match?.[1]) return;
        optionIndexes.add(index);
        options.push(stripChoiceFormatting(match[1]));
    });

    if (options.length < 2 || options.length > 5) return null;

    const body = lines
        .filter((_, index) => !optionIndexes.has(index))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return { body, options };
};

const formatMessageTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

const formatAssistantContent = (content: string) =>
    sanitizeSynapseMarkdown(content);

const formatVisibleUserContent = (content: string) => {
    const clean = content.trim();
    if (/^(confirmar|confirmo|aceitar|aceito)$/i.test(clean)) return 'Aceitar';
    if (/^(recusar|recuso|cancelar)$/i.test(clean)) return 'Recusar';
    return content;
};

export const SynapseMarkdownContent = memo(function SynapseMarkdownContent({
    content,
    renderWidgets = true,
    onQuickAction,
}: {
    content: string;
    renderWidgets?: boolean;
    onQuickAction?: (prompt: string) => void;
}) {
    const parsedMessage = parseSynapseWidgetsFromContent(content);
    const cleanContent = parsedMessage.cleanContent || (parsedMessage.widgetData.length > 0 ? '' : content);
    const displayContent = formatAssistantContent(cleanContent);
    const choicePrompt = onQuickAction ? parseSynapseChoicePrompt(displayContent) : null;
    const markdownContent = choicePrompt?.body || displayContent;

    return (
        <>
            {markdownContent ? (
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        pre({ children, ...props }: MarkdownPreProps) {
                            return <pre {...props}>{children}</pre>;
                        },
                        code({ className, children, ...props }: MarkdownCodeProps) {
                            return <code className={className} {...props}>{children}</code>;
                        },
                        a({ href, children, ...props }: MarkdownAnchorProps) {
                            const isExternal = /^https?:\/\//i.test(href || '');
                            return (
                                <a
                                    href={href}
                                    target={isExternal ? '_blank' : undefined}
                                    rel={isExternal ? 'noreferrer noopener' : undefined}
                                    {...props}
                                >
                                    {children}
                                </a>
                            );
                        },
                        table({ children, ...props }: MarkdownTableProps) {
                            return (
                                <div className="synapse-markdown-table-scroll">
                                    <table {...props}>{children}</table>
                                </div>
                            );
                        },
                    }}
                >
                    {markdownContent}
                </ReactMarkdown>
            ) : null}

            {choicePrompt ? (
                <div className="mt-3 flex w-full flex-col gap-1.5" aria-label="Opções sugeridas pelo Synapse">
                    {choicePrompt.options.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onQuickAction?.(option)}
                            className="group/choice flex min-h-9 w-full items-center justify-between gap-3 rounded-[11px] border border-foreground/[0.07] bg-foreground/[0.018] px-3 py-2 text-left text-[11.5px] font-medium leading-4 text-foreground/72 transition-[background-color,border-color,color,transform] hover:-translate-y-px hover:border-foreground/[0.12] hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.075] dark:bg-white/[0.018] dark:text-white/72 dark:hover:border-white/[0.13] dark:hover:bg-white/[0.045] dark:hover:text-white"
                        >
                            <span className="min-w-0 flex-1">{option}</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/28 transition-transform group-hover/choice:translate-x-0.5 group-hover/choice:text-foreground/50 dark:text-white/28 dark:group-hover/choice:text-white/50" aria-hidden="true" />
                        </button>
                    ))}
                </div>
            ) : null}

            {renderWidgets ? parsedMessage.widgetData.map((widget, index) => (
                <SynapseWidgetRenderer
                    key={`${widget.__actionType || widget.type || 'synapse-widget'}-${index}`}
                    widgetData={widget}
                    compact
                />
            )) : null}
        </>
    );
});

const SynapseEmptyConversation = ({
    quickActions,
    onQuickAction,
}: Pick<SynapseConversationProps, 'quickActions' | 'shouldReduceMotion' | 'onQuickAction'>) => (
    <div
        key="empty"
        className="flex min-h-[310px] flex-1 flex-col items-start justify-end px-1 pb-6 pt-8"
    >
        <div className="space-y-1.5">
            <h2 className="text-[16px] font-semibold leading-6 text-foreground">Como posso ajudar?</h2>
            <p className="max-w-[300px] text-[12px] leading-5 text-muted-foreground">
                Converse naturalmente sobre o que você precisa resolver agora.
            </p>
        </div>

        {quickActions.length > 0 ? (
            <div className="mt-5 grid w-full grid-cols-1 gap-1.5 min-[410px]:grid-cols-2">
                {quickActions.slice(0, 4).map((tool) => (
                    <button
                        key={tool.id}
                        type="button"
                        onClick={() => onQuickAction(tool.name)}
                        className="min-h-10 rounded-[12px] px-2.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.045]"
                    >
                        <span className="line-clamp-2 leading-4">{tool.name}</span>
                    </button>
                ))}
            </div>
        ) : null}
    </div>
);

const SynapseMessageRow = memo(function SynapseMessageRow({
    message,
    isLatest,
    shouldReduceMotion,
    onQuickAction,
}: {
    message: Message;
    isLatest: boolean;
    shouldReduceMotion: boolean;
    onQuickAction?: (prompt: string) => void;
}) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const messageTime = formatMessageTime(message.created_at);
    const visibleUserContent = isUser ? formatVisibleUserContent(message.content) : '';
    const copyContent = isUser
        ? visibleUserContent
        : formatAssistantContent(parseSynapseWidgetsFromContent(message.content).cleanContent);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(copyContent);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch (error) {
            console.error('Unable to copy Synapse message:', error);
        }
    };

    return (
        <article
            className={cn(
                'synapse-conversation-row group/message flex min-w-0',
                isUser ? 'justify-end' : 'justify-start',
                isLatest && !shouldReduceMotion && 'synapse-message-enter',
            )}
        >
            <div className={cn('flex min-w-0 flex-col', isUser ? 'max-w-[84%] items-end' : 'w-full max-w-[96%] items-start')}>
                <div
                    className={cn(
                        'group relative min-w-0',
                        isUser
                            ? 'synapse-desktop-message synapse-desktop-message-user px-3.5 py-2.5'
                            : 'w-full py-1.5 pr-9',
                    )}
                >
                    {!isUser ? (
                        <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-[11px] text-muted-foreground opacity-0 transition-[opacity,color,background-color] hover:bg-foreground/[0.035] hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.045]"
                            aria-label="Copiar mensagem"
                        >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    ) : null}

                    <div className={cn('synapse-desktop-prose break-words', isUser && 'synapse-desktop-prose-user')}>
                        {isUser ? visibleUserContent : (
                            <SynapseMarkdownContent
                                content={message.content}
                                onQuickAction={onQuickAction}
                            />
                        )}
                    </div>
                </div>

                {messageTime ? (
                    <time
                        dateTime={message.created_at}
                        className="mt-1 px-1 text-[9px] font-medium text-muted-foreground/48 transition-opacity group-hover/message:text-muted-foreground"
                    >
                        {messageTime}
                    </time>
                ) : null}
            </div>
        </article>
    );
});

export const SynapseConversation = ({
    messages,
    isSending,
    isProcessing,
    activityLabel = 'Analisando solicitação',
    activityDetail,
    activityMode = 'thinking',
    quickActions,
    shouldReduceMotion,
    onQuickAction,
}: SynapseConversationProps) => {
    const processingActive = isProcessing ?? isSending;

    return (
        <div className="flex min-h-0 flex-1 flex-col" aria-busy={processingActive}>
            <span className="sr-only" role="status" aria-live="polite">
                {processingActive ? activityLabel : ''}
            </span>

            {messages.length === 0 ? (
                <SynapseEmptyConversation
                    quickActions={quickActions}
                    shouldReduceMotion={shouldReduceMotion}
                    onQuickAction={onQuickAction}
                />
            ) : (
                <div
                    role="log"
                    aria-label="Conversa com o Synapse"
                    aria-live="polite"
                    aria-relevant="additions text"
                    className="space-y-4 py-4"
                >
                    {messages.map((message, index) => (
                        <SynapseMessageRow
                            key={message.id}
                            message={message}
                            isLatest={index === messages.length - 1}
                            shouldReduceMotion={shouldReduceMotion}
                            onQuickAction={onQuickAction}
                        />
                    ))}

                    <AnimatePresence initial={false}>
                        {processingActive ? (
                            <motion.div
                                key="thinking"
                                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 2 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                                className="min-w-0"
                            >
                                <SynapseProcessingState
                                    label={activityLabel}
                                    detail={activityDetail}
                                    mode={activityMode}
                                    reducedMotion={shouldReduceMotion}
                                />
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export const SynapseComposer = forwardRef<HTMLTextAreaElement, SynapseComposerProps>(function SynapseComposer(
    {
        value,
        isSending,
        isListening,
        sessionReady,
        shouldReduceMotion,
        onChange,
        onSend,
        onToggleListening,
    },
    forwardedRef,
) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const contextLabel = useSynapseContextLabel();
    const canSend = Boolean(value.trim()) && sessionReady && !isSending;

    const setTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = '0px';
        const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 104);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > 104 ? 'auto' : 'hidden';
    }, [value]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (canSend) onSend();
    };

    return (
        <div className="synapse-desktop-composer-dock shrink-0 px-4 pb-4 pt-2.5">
            <div className="flex items-center gap-2 px-2 pb-1.5 text-[9px] font-semibold tracking-[-0.01em] text-foreground/46 dark:text-white/50" aria-label={`Contexto atual: ${contextLabel}`}>
                <span className="h-px w-5 shrink-0 bg-foreground/60 dark:bg-white/64" aria-hidden="true" />
                <span className="truncate">{contextLabel}</span>
            </div>
            <div className="synapse-desktop-composer flex min-h-[58px] items-end gap-2 p-2">
                <textarea
                    ref={setTextareaRef}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte ao Synapse..."
                    rows={1}
                    disabled={!sessionReady || isSending}
                    aria-label="Mensagem para o Synapse"
                    className="min-h-11 flex-1 resize-none border-0 bg-transparent px-2.5 py-3 text-[14px] font-medium leading-5 text-foreground outline-none placeholder:text-muted-foreground/55 focus:outline-none focus:ring-0 focus-visible:ring-0 disabled:opacity-50"
                />

                <div className="flex shrink-0 items-center gap-1">
                    <motion.button
                        type="button"
                        onClick={onToggleListening}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.92, y: 1 }}
                        className={cn(
                            'synapse-desktop-composer-control flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isListening && 'synapse-desktop-composer-control-active',
                        )}
                        aria-label={isListening ? 'Parar ditado' : 'Iniciar ditado'}
                        aria-pressed={isListening}
                    >
                        <Mic className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                        type="button"
                        onClick={onSend}
                        disabled={!canSend}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.92, y: 1 }}
                        className={cn(
                            'synapse-desktop-composer-control flex h-11 w-11 items-center justify-center disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            canSend && 'synapse-desktop-send-control-active',
                        )}
                        aria-label="Enviar mensagem"
                    >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ArrowUp className="h-4 w-4" />}
                    </motion.button>
                </div>
            </div>
        </div>
    );
});
