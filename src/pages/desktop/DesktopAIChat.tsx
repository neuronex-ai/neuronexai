import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { History, PanelLeftClose, Phone, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ChatInputArea } from "@/components/ai-chat/ChatInputArea";
import { ChatMessageItem } from "@/components/ai-chat/ChatMessageItem";
import { ChatSidebar } from "@/components/ai-chat/ChatSidebar";
import { DesktopVoiceOverlay } from "@/components/ai-chat/DesktopVoiceOverlay";
import { EmptyChatState } from "@/components/ai-chat/EmptyChatState";
import { ThinkingIndicator } from "@/components/ai-chat/ThinkingIndicator";
import { EmailDraftModal, type EmailDraftData } from "@/components/ai-chat/EmailDraftModal";
import { InvoiceDraftModal, type InvoiceDraftData } from "@/components/ai-chat/InvoiceDraftModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAI } from "@/context/AIContext";
import { useChatSessions, useCreateChatSession, useDeleteChatSession, useSendChatMessage, useSessionMessages } from "@/hooks/use-ai-chat";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import { getR2DocumentDownloadUrl, uploadDocumentToR2 } from "@/lib/r2-documents-client";
import { SynapseClientAction, isRecord } from "@/lib/synapse-widget-parser";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

type UploadedSynapseFile = {
    name: string;
    url: string;
    documentId?: string;
    storageProvider?: "r2";
};

type SynapseSendResponse = {
    response?: string;
    clientAction?: SynapseClientAction;
};

const isEmailDraftData = (value: unknown): value is EmailDraftData =>
    isRecord(value) &&
    typeof value.to === "string" &&
    typeof value.subject === "string" &&
    typeof value.body === "string";

const isInvoiceDraftData = (value: unknown): value is InvoiceDraftData =>
    isRecord(value) &&
    typeof value.amount === "number" &&
    typeof value.description === "string";

const toSynapseSendResponse = (value: unknown): SynapseSendResponse => {
    if (!isRecord(value)) return {};
    return {
        response: typeof value.response === "string" ? value.response : undefined,
        clientAction: isRecord(value.clientAction) && typeof value.clientAction.type === "string"
            ? value.clientAction as SynapseClientAction
            : undefined,
    };
};

const getNavigationPath = (payload: unknown) => {
    if (!isRecord(payload) || typeof payload.path !== "string") return null;
    return payload.path;
};

export default function DesktopAIChat() {
    const navigate = useNavigate();
    const { activePatientId, currentContext } = useAI();
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoSentQueryRef = useRef<string | null>(null);
    const shouldReduceMotion = useReducedMotion();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [, setLastVoiceResponse] = useState("");
    const [richMessages, setRichMessages] = useState<Record<string, SynapseClientAction>>({});
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailDraftData, setEmailDraftData] = useState<EmailDraftData | null>(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [invoiceDraftData, setInvoiceDraftData] = useState<InvoiceDraftData | null>(null);

    const { data: sessions } = useChatSessions();
    const { mutateAsync: createSessionAsync } = useCreateChatSession();
    const { mutate: deleteSession } = useDeleteChatSession();
    const { data: messages } = useSessionMessages(currentSessionId);
    const { mutate: sendMessage, isPending: isSending } = useSendChatMessage();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
    const { speak } = useTextToSpeech();

    useEffect(() => {
        if (!scrollRef.current) return;
        const scrollElement = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
        if (!scrollElement) return;

        const behavior: ScrollBehavior = shouldReduceMotion || (messages && messages.length < 2) ? "auto" : "smooth";
        scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior });
    }, [messages, isSending, currentSessionId, richMessages, shouldReduceMotion]);

    const handleCreateNewChat = async () => {
        try {
            const data = await createSessionAsync(undefined);
            if (data) {
                setCurrentSessionId(data.id);
                resetTranscript();
                setIsSidebarOpen(false);
            }
        } catch {
            toast.error("Erro ao criar nova conversa.");
        }
    };

    const handleClientAction = useCallback((action: SynapseClientAction, sessionId: string) => {
        const payload = action.payload ?? action.data;

        if (action.type === "review_draft") {
            if (isEmailDraftData(payload)) {
                setEmailDraftData(payload);
                setIsEmailModalOpen(true);
            } else {
                toast.error("Rascunho de e-mail incompleto.");
            }
        } else if (action.type === "review_invoice_draft") {
            if (isInvoiceDraftData(payload)) {
                setInvoiceDraftData(payload);
                setIsInvoiceModalOpen(true);
            } else {
                toast.error("Rascunho de cobranca incompleto.");
            }
        } else if (action.type === "navigation_action") {
            const path = getNavigationPath(payload);
            if (path) navigate(path);
        }

        setRichMessages((prev) => ({ ...prev, [sessionId]: action }));
    }, [navigate]);

    const handleSend = useCallback(async (text: string, attachments: File[]) => {
        if (!text && attachments.length === 0) return;

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            try {
                const title = `${text.substring(0, 30)}...`;
                const newSession = await createSessionAsync(title);
                activeSessionId = newSession.id;
                setCurrentSessionId(newSession.id);
            } catch (error: unknown) {
                console.error("[DesktopAIChat] Falha ao iniciar conversa", error);
                toast.error(getUserFacingErrorMessage(error, "save"));
                return;
            }
        }

        if (isListening) stopListening();

        const outboundText = text.trim() || "Anexo enviado para analise.";
        const uploadedFiles: UploadedSynapseFile[] = [];

        if (attachments.length > 0) {
            setIsUploading(true);
            try {
                for (const file of attachments) {
                    const document = await uploadDocumentToR2({
                        file,
                        category: "other",
                        metadata: {
                            source: "ai_chat",
                            chatSessionId: activeSessionId,
                            context: currentContext ?? null,
                            patientId: activePatientId ?? null,
                        },
                    });
                    const url = await getR2DocumentDownloadUrl({ documentId: document.id, disposition: "inline" });
                    uploadedFiles.push({ name: file.name, url, documentId: document.id, storageProvider: "r2" });
                }
            } catch (error: unknown) {
                console.error("[DesktopAIChat] Falha no envio de anexo", error);
                toast.error(getUserFacingErrorMessage(error, "save"));
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        if (!activeSessionId) return;

        sendMessage(
            {
                message: outboundText,
                sessionId: activeSessionId,
                attachments: uploadedFiles,
                context: { activePatientId, currentContext },
            },
            {
                onSuccess: (rawData: unknown) => {
                    const data = toSynapseSendResponse(rawData);
                    resetTranscript();
                    if (isVoiceModeOpen && data.response) {
                        setLastVoiceResponse(data.response);
                        speak(data.response);
                    }
                    if (data.clientAction) {
                        handleClientAction(data.clientAction, activeSessionId);
                    }
                },
            },
        );
    }, [
        activePatientId,
        createSessionAsync,
        currentContext,
        currentSessionId,
        handleClientAction,
        isListening,
        isVoiceModeOpen,
        resetTranscript,
        sendMessage,
        speak,
        stopListening,
    ]);

    useEffect(() => {
        const query = searchParams.get("q");
        if (!query) {
            autoSentQueryRef.current = null;
            return;
        }
        if (autoSentQueryRef.current === query) return;

        autoSentQueryRef.current = query;
        void (async () => {
            await handleSend(query, []);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete("q");
            setSearchParams(newParams, { replace: true });
        })();
    }, [handleSend, searchParams, setSearchParams]);

    const handleDeleteChat = (event: MouseEvent, id: string) => {
        event.stopPropagation();
        deleteSession(id);
        if (currentSessionId === id) setCurrentSessionId(null);
    };

    const sidebar = (
        <ChatSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={(id) => {
                setCurrentSessionId(id);
                setIsSidebarOpen(false);
            }}
            onCreateSession={handleCreateNewChat}
            onDeleteSession={handleDeleteChat}
            onClose={() => setIsSidebarOpen(false)}
        />
    );

    return (
        <div className="notes-lumen-canvas relative mx-3 flex h-[calc(100dvh-5.5rem)] min-h-[36rem] overflow-hidden rounded-[32px] border border-border/45 bg-background font-sans text-foreground shadow-[0_34px_110px_-62px_hsl(var(--foreground)/0.8)] selection:bg-primary/10 md:mx-4 md:rounded-[38px] dark:border-white/[0.075] dark:shadow-[0_34px_120px_-56px_rgba(0,0,0,0.96)]">
            <div className="notes-lumen-field pointer-events-none absolute inset-0 z-0" />
            <div className="notes-retina-texture pointer-events-none absolute inset-0 z-[1] opacity-70" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-px bg-background/80 dark:bg-white/[0.08]" />

            <DesktopVoiceOverlay isOpen={isVoiceModeOpen} onClose={() => setIsVoiceModeOpen(false)} />

            <AnimatePresence>
                {isSidebarOpen ? (
                    <>
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute inset-0 z-40 bg-background/58 backdrop-blur-sm lg:hidden"
                        />
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, x: "-100%" }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: "-100%" }}
                            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34 }}
                            className="notes-retina-rail absolute left-0 top-0 z-50 h-full w-full overflow-hidden border-r shadow-2xl sm:w-[350px] lg:hidden"
                        >
                            {sidebar}
                        </motion.div>
                    </>
                ) : null}
            </AnimatePresence>

            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 340 : 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
                className="notes-retina-rail relative z-20 hidden h-full shrink-0 overflow-hidden border-r lg:block"
                aria-hidden={!isSidebarOpen}
            >
                <div className="h-full w-[340px]">{sidebar}</div>
            </motion.aside>

            <div className="relative z-20 flex min-w-0 flex-1 flex-col">
                <header className="notes-retina-rail absolute left-0 right-0 top-0 z-30 flex h-[78px] items-center justify-between border-b px-4 backdrop-blur-2xl sm:px-7">
                    <div className="flex min-w-0 items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen((current) => !current)}
                            className="h-11 w-11 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={isSidebarOpen ? "Fechar historico de conversas" : "Abrir historico de conversas"}
                            aria-pressed={isSidebarOpen}
                        >
                            {isSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <History className="h-5 w-5" />}
                        </Button>

                        <div className="flex min-w-0 items-center gap-2.5 rounded-full border border-border/40 bg-background/58 px-4 py-1.5 shadow-sm backdrop-blur-xl dark:border-white/[0.075] dark:bg-white/[0.04]">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Synapse AI</span>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsVoiceModeOpen(true)}
                            className="h-11 rounded-full border-border/45 bg-background/68 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-sm transition-colors hover:border-foreground/16 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-white/[0.075] dark:bg-white/[0.04]"
                            aria-label="Abrir modo voz"
                        >
                            <Phone className="mr-2 h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Modo voz</span>
                        </Button>
                    </div>
                </header>

                <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    {!currentSessionId ? (
                        <div className="relative flex h-full w-full flex-col items-center justify-center px-4 pb-[10rem] pt-28 sm:px-8">
                            <EmptyChatState onSuggestionClick={(text) => handleSend(text, [])} />
                        </div>
                    ) : (
                        <ScrollArea ref={scrollRef} className="min-h-0 flex-1 px-2 sm:px-4">
                            <div className={cn(
                                "mx-auto w-full max-w-[min(58rem,calc(100vw-2rem))] space-y-10 px-1 pb-[13rem] pt-28 sm:px-4 md:space-y-11",
                                isSidebarOpen && "lg:max-w-[min(58rem,calc(100vw-24rem))]",
                            )}>
                                {messages?.map((msg, index) => {
                                    const isLast = index === messages.length - 1;
                                    const richData = isLast && msg.role === "assistant" && currentSessionId ? richMessages[currentSessionId] : undefined;
                                    return (
                                        <ChatMessageItem
                                            key={msg.id}
                                            message={msg}
                                            richData={richData}
                                        />
                                    );
                                })}
                                {isSending ? <ThinkingIndicator /> : null}
                            </div>
                        </ScrollArea>
                    )}
                </main>

                <div className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 z-30 flex justify-center px-3 sm:bottom-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-6">
                    <div className="pointer-events-auto w-full max-w-[min(48rem,calc(100vw-2rem))]">
                        <ChatInputArea
                            onSend={handleSend}
                            isListening={isListening}
                            isSending={isSending}
                            isUploading={isUploading}
                            onStartListening={startListening}
                            onStopListening={stopListening}
                            transcript={transcript}
                        />
                    </div>
                </div>
            </div>

            <EmailDraftModal
                open={isEmailModalOpen}
                onOpenChange={setIsEmailModalOpen}
                initialData={emailDraftData}
                onSent={() => toast.success("Email enviado com sucesso!")}
            />
            <InvoiceDraftModal
                open={isInvoiceModalOpen}
                onOpenChange={setIsInvoiceModalOpen}
                initialData={invoiceDraftData}
                onSent={() => toast.success("Cobranca criada com sucesso!")}
            />
        </div>
    );
}
