import React, {
    forwardRef,
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
import { parseSynapseWidgetFromContent } from '@/lib/synapse-widget-parser';
import type { Message } from '@/types';

import { SynapseWidgetRenderer } from './SynapseWidgetRenderer';

type MarkdownPreProps = React.ComponentPropsWithoutRef<'pre'> & { node?: unknown };
type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> & {
    node?: unknown;
    inline?: boolean;
    className?: string;
};

type QuickAction = {
    id: string;
    name: string;
};

type SynapseConversationProps = {
    messages: Message[];
    isSending: boolean;
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

const SynapseMessageMark = ({ className }: { className?: string }) => (
    <span
        className={cn('synapse-desktop-message-mark flex h-8 w-8 shrink-0 items-center justify-center', className)}
        aria-hidden="true"
    >
        <Sparkles className="relative z-10 h-3.5 w-3.5" />
    </span>
);

const SynapseMarkdownMessage = ({ content }: { content: string }) => {
    const parsedMessage = parseSynapseWidgetFromContent(content);
    const cleanContent = parsedMessage.cleanContent || (parsedMessage.widgetData ? '' : content);

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
                            if (isWidget) return <div className="not-prose">{children}</div>;
                            return <pre {...props}>{children}</pre>;
                        },
                        code({ inline, className, children, ...props }: MarkdownCodeProps) {
                            const match = /language-(\w+)/.exec(className || '');
                            if (!inline && match?.[1] === 'json' && String(children).includes('__actionType')) {
                                try {
                                    const widgetData = JSON.parse(String(children));
                                    return <SynapseWidgetRenderer widgetData={widgetData} compact />;
                                } catch (error) {
                                    console.error('Widget render error:', error);
                                }
                            }
                            return <code className={className} {...props}>{children}</code>;
                        },
                    }}
                >
                    {cleanContent}
                </ReactMarkdown>
            ) : null}
            {parsedMessage.widgetData ? <SynapseWidgetRenderer widgetData={parsedMessage.widgetData} compact /> : null}
        </>
    );
};

const SynapseEmptyConversation = ({
    quickActions,
    shouldReduceMotion,
    onQuickAction,
}: Pick<SynapseConversationProps, 'quickActions' | 'shouldReduceMotion' | 'onQuickAction'>) => (
    <motion.div
        key="empty"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-full flex-col items-center justify-center px-2 py-12 text-center"
    >
        <motion.div
            animate={shouldReduceMotion ? undefined : { y: [0, -2, 0] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="synapse-desktop-empty-mark flex h-[68px] w-[68px] items-center justify-center"
            aria-hidden="true"
        >
            <Sparkles className="relative z-10 h-6 w-6" />
        </motion.div>

        <div className="mt-6 space-y-2">
            <h2 className="text-[18px] font-semibold leading-6 text-foreground">Como posso ajudar?</h2>
            <p className="mx-auto max-w-[300px] text-[13px] leading-5 text-muted-foreground">
                Converse naturalmente com o Synapse sobre sua rotina clínica.
            </p>
        </div>

        {quickActions.length > 0 ? (
            <div className="mt-7 grid w-full max-w-[360px] grid-cols-1 gap-2 min-[410px]:grid-cols-2">
                {quickActions.slice(0, 4).map((tool, index) => (
                    <motion.button
                        key={tool.id}
                        type="button"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.08 + index * 0.035, duration: 0.24 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.97, y: 1 }}
                        onClick={() => onQuickAction(tool.name)}
                        className="synapse-desktop-prompt flex min-h-11 items-center gap-2.5 px-3 text-left text-[12px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="line-clamp-2 leading-4">{tool.name}</span>
                    </motion.button>
                ))}
            </div>
        ) : null}
    </motion.div>
);

export const SynapseConversation = ({
    messages,
    isSending,
    quickActions,
    shouldReduceMotion,
    onQuickAction,
}: SynapseConversationProps) => {
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = async (id: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedId(id);
            window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1800);
        } catch (error) {
            console.error('Unable to copy Synapse message:', error);
        }
    };

    return (
        <div className="min-h-full" aria-busy={isSending}>
            <span className="sr-only" role="status" aria-live="polite">
                {isSending ? 'Synapse está pensando.' : ''}
            </span>

            <AnimatePresence initial={false} mode="wait">
                {messages.length === 0 ? (
                    <SynapseEmptyConversation
                        quickActions={quickActions}
                        shouldReduceMotion={shouldReduceMotion}
                        onQuickAction={onQuickAction}
                    />
                ) : (
                    <motion.div
                        key="conversation"
                        layout
                        role="log"
                        aria-label="Conversa com o Synapse"
                        aria-live="polite"
                        aria-relevant="additions text"
                        className="space-y-5 py-5"
                    >
                        {messages.map((message, index) => {
                            const isUser = message.role === 'user';
                            const messageTime = formatMessageTime(message.created_at);

                            return (
                                <motion.article
                                    key={message.id || index}
                                    layout="position"
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    transition={shouldReduceMotion ? { duration: 0 } : messageTransition}
                                    className={cn('group/message flex min-w-0 items-end gap-2.5', isUser ? 'justify-end' : 'justify-start')}
                                >
                                    {!isUser ? <SynapseMessageMark className="mb-[18px]" /> : null}

                                    <div className={cn('flex min-w-0 max-w-[84%] flex-col', isUser ? 'items-end' : 'items-start')}>
                                        <div
                                            className={cn(
                                                'synapse-desktop-message group relative min-w-0 px-4 py-3',
                                                isUser ? 'synapse-desktop-message-user' : 'synapse-desktop-message-assistant pr-11',
                                            )}
                                        >
                                            {!isUser ? (
                                                <motion.button
                                                    type="button"
                                                    whileTap={shouldReduceMotion ? undefined : { scale: 0.92, y: 1 }}
                                                    onClick={() => void handleCopy(message.id, message.content)}
                                                    className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-[12px] text-muted-foreground opacity-0 transition-[opacity,color,background-color] hover:bg-background/45 hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                                    aria-label="Copiar mensagem"
                                                >
                                                    <AnimatePresence initial={false} mode="wait">
                                                        {copiedId === message.id ? (
                                                            <motion.span key="copied" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                                                                <Check className="h-3.5 w-3.5" />
                                                            </motion.span>
                                                        ) : (
                                                            <motion.span key="copy" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                                                                <Copy className="h-3.5 w-3.5" />
                                                            </motion.span>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.button>
                                            ) : null}

                                            <div className={cn('synapse-desktop-prose break-words', isUser && 'synapse-desktop-prose-user')}>
                                                {isUser ? message.content : <SynapseMarkdownMessage content={message.content} />}
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
                                </motion.article>
                            );
                        })}

                        <AnimatePresence initial={false}>
                            {isSending ? (
                                <motion.div
                                    key="thinking"
                                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 3 }}
                                    transition={shouldReduceMotion ? { duration: 0 } : messageTransition}
                                    className="flex items-end gap-2.5"
                                >
                                    <SynapseMessageMark />
                                    <div className="synapse-desktop-thinking flex min-h-11 items-center gap-2.5 px-4">
                                        <span className="flex items-center gap-1.5" aria-hidden="true">
                                            {[0, 0.16, 0.32].map((delay) => (
                                                <motion.span
                                                    key={delay}
                                                    animate={shouldReduceMotion ? undefined : { y: [0, -3, 0], opacity: [0.32, 1, 0.32] }}
                                                    transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 0.9, delay, ease: 'easeInOut' }}
                                                    className="h-1.5 w-1.5 rounded-full bg-current"
                                                />
                                            ))}
                                        </span>
                                        <span className="text-[11px] font-medium text-muted-foreground">Pensando</span>
                                    </div>
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
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
        const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 116);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > 116 ? 'auto' : 'hidden';
    }, [value]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (canSend) onSend();
    };

    return (
        <div className="synapse-desktop-composer-dock shrink-0 px-3.5 pb-3.5 pt-2.5">
            <div className="synapse-desktop-composer flex min-h-[62px] items-end gap-2 p-2">
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
