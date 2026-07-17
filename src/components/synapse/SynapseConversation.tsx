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
import { ArrowUp, Check, Copy, Loader2, Mic, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import { sanitizeSynapseMarkdown } from '@/lib/synapse-humanize';
import { parseSynapseWidgetsFromContent } from '@/lib/synapse-widget-parser';
import type { Message } from '@/types';

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

const messageTransition = {
    type: 'spring',
    stiffness: 420,
    damping: 34,
    mass: 0.72,
} as const;

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

const SynapseMessageMark = ({ className }: { className?: string }) => (
    <span
        className={cn('synapse-desktop-message-mark flex h-8 w-8 shrink-0 items-center justify-center', className)}
        aria-hidden="true"
    >
        <Sparkles className="relative z-10 h-3.5 w-3.5" />
    </span>
);

export const SynapseMarkdownContent = memo(function SynapseMarkdownContent({
    content,
    renderWidgets = true,
}: {
    content: string;
    renderWidgets?: boolean;
}) {
    const parsedMessage = parseSynapseWidgetsFromContent(content);
    const cleanContent = parsedMessage.cleanContent || (parsedMessage.widgetData.length > 0 ? '' : content);
    const displayContent = formatAssistantContent(cleanContent);

    return (
        <>
            {displayContent ? (
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
                    {displayContent}
                </ReactMarkdown>
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
        className="flex min-h-[330px] flex-1 flex-col items-center justify-center px-2 py-6 text-center"
    >
        <div
            className="synapse-desktop-empty-mark flex h-12 w-12 items-center justify-center"
            aria-hidden="true"
        >
            <Sparkles className="relative z-10 h-[18px] w-[18px]" />
        </div>

        <div className="mt-4 space-y-1.5">
            <h2 className="text-[16px] font-semibold leading-6 text-foreground">Como posso ajudar?</h2>
            <p className="mx-auto max-w-[292px] text-[12px] leading-5 text-muted-foreground">
                Converse naturalmente com o Synapse sobre sua rotina clínica.
            </p>
        </div>

        {quickActions.length > 0 ? (
            <div className="mt-5 grid w-full max-w-[360px] grid-cols-1 gap-2 min-[410px]:grid-cols-2">
                {quickActions.slice(0, 4).map((tool) => (
                    <button
                        key={tool.id}
                        type="button"
                        onClick={() => onQuickAction(tool.name)}
                        className="synapse-desktop-prompt flex min-h-11 items-center gap-2.5 px-3 text-left text-[11px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
                    >
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
}: {
    message: Message;
    isLatest: boolean;
    shouldReduceMotion: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const messageTime = formatMessageTime(message.created_at);
    const copyContent = isUser
        ? message.content
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
                'synapse-conversation-row group/message flex min-w-0 items-end gap-2.5',
                isUser ? 'justify-end' : 'justify-start',
                isLatest && !shouldReduceMotion && 'synapse-message-enter',
            )}
        >
            {!isUser ? <SynapseMessageMark className="mb-[18px]" /> : null}

            <div className={cn('flex min-w-0 max-w-[84%] flex-col', isUser ? 'items-end' : 'items-start')}>
                <div
                    className={cn(
                        'synapse-desktop-message group relative min-w-0 px-3.5 py-2.5',
                        isUser ? 'synapse-desktop-message-user' : 'synapse-desktop-message-assistant pr-11',
                    )}
                >
                    {!isUser ? (
                        <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-[12px] text-muted-foreground opacity-0 transition-[opacity,color,background-color,transform] hover:bg-background/45 hover:text-foreground active:translate-y-px group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            aria-label="Copiar mensagem"
                        >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    ) : null}

                    <div className={cn('synapse-desktop-prose break-words', isUser && 'synapse-desktop-prose-user')}>
                        {isUser ? message.content : <SynapseMarkdownContent content={message.content} />}
                    </div>
                </div>

                {messageTime ? (
                    <time
                        dateTime={message.created_at}
                        className="mt-1.5 px-1 text-[9px] font-medium text-muted-foreground/55 transition-opacity group-hover/message:text-muted-foreground"
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
    activityLabel = 'Processando solicitação',
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
                        />
                    ))}

                    <AnimatePresence initial={false}>
                            {processingActive ? (
                                <motion.div
                                    key="thinking"
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : messageTransition}
                                    className="flex items-end gap-2.5"
                                >
                                    <SynapseMessageMark />
                                    <div
                                        className="synapse-desktop-thinking flex min-h-[58px] max-w-[324px] items-center gap-3 px-3 py-2.5"
                                        data-activity={activityMode}
                                        data-reduced-motion={shouldReduceMotion ? 'true' : undefined}
                                    >
                                        <span className="synapse-thinking-signal flex h-9 w-9 shrink-0 items-center justify-center gap-[3px] rounded-full" aria-hidden="true">
                                            {[0, 1, 2].map((index) => (
                                                <span
                                                    key={index}
                                                    className="synapse-thinking-signal-bar block w-[2px] rounded-full"
                                                    style={{ animationDelay: `${index * -120}ms` }}
                                                />
                                            ))}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <span className="block truncate text-[11px] font-semibold leading-4 text-foreground/86">
                                                {activityLabel}
                                            </span>
                                            <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                                <span className="synapse-thinking-phase shrink-0 text-[9px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                                                    {activityMode === 'executing' ? 'Executando' : activityMode === 'responding' ? 'Digitando' : 'Analisando'}
                                                </span>
                                                <span className="synapse-thinking-separator h-0.5 w-0.5 shrink-0 rounded-full" aria-hidden="true" />
                                                <span className="min-w-0 truncate text-[10px] font-medium text-muted-foreground">
                                                    {activityDetail || 'Organizando a melhor resposta'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
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
