import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAI } from "@/context/AIContext";
import { useChatSessions, useCreateChatSession, useDeleteChatSession, useSendChatMessage, useSessionMessages } from "@/hooks/use-ai-chat";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import { getR2DocumentDownloadUrl, uploadDocumentToR2 } from "@/lib/r2-documents-client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { History, Phone, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

// Components
import { ChatInputArea } from "@/components/ai-chat/ChatInputArea";
import { ChatMessageItem } from "@/components/ai-chat/ChatMessageItem";
import { ChatSidebar } from "@/components/ai-chat/ChatSidebar";
import { DesktopVoiceOverlay } from "@/components/ai-chat/DesktopVoiceOverlay";
import { EmptyChatState } from "@/components/ai-chat/EmptyChatState";
import { ThinkingIndicator } from "@/components/ai-chat/ThinkingIndicator";

// Modals
import { EmailDraftModal } from "@/components/ai-chat/EmailDraftModal";
import { InvoiceDraftModal } from "@/components/ai-chat/InvoiceDraftModal";

export default function DesktopAIChat() {
    const navigate = useNavigate();
    const { activePatientId, currentContext } = useAI();
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoSentQueryRef = useRef<string | null>(null);
    const shouldReduceMotion = useReducedMotion();

    // Layout State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

    // Chat State
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [, setLastVoiceResponse] = useState("");
    const [richMessages, setRichMessages] = useState<Record<string, any>>({});

    // Modals State
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailDraftData, setEmailDraftData] = useState<any>(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [invoiceDraftData, setInvoiceDraftData] = useState<any>(null);

    // Hooks
    const { data: sessions } = useChatSessions();
    const { mutateAsync: createSessionAsync } = useCreateChatSession();
    const { mutate: deleteSession } = useDeleteChatSession();
    const { data: messages } = useSessionMessages(currentSessionId);
    const { mutate: sendMessage, isPending: isSending } = useSendChatMessage();
    const [searchParams, setSearchParams] = useSearchParams();

    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
    const { speak, stop: _stopSpeaking, isSpeaking: _isSpeaking } = useTextToSpeech();

    // Auto Scroll
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                const behavior = messages && messages.length < 2 ? 'instant' : 'smooth';
                scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: behavior as ScrollBehavior });
            }
        }
    }, [messages, isSending, currentSessionId, richMessages]);

    // Handlers
    const handleCreateNewChat = async () => {
        try {
            const data = await createSessionAsync(undefined);
            if (data) {
                setCurrentSessionId(data.id);
                resetTranscript();
                setIsSidebarOpen(false);
            }
        } catch (error) {
            toast.error("Erro ao criar nova conversa.");
        }
    };

    const handleClientAction = useCallback((action: any, sessionId: string) => {
        const payload = action.payload || action.data;
        if (action.type === 'review_draft') {
            setEmailDraftData(payload);
            setIsEmailModalOpen(true);
        } else if (action.type === 'review_invoice_draft') {
            setInvoiceDraftData(payload);
            setIsInvoiceModalOpen(true);
        } else if (action.type === 'navigation_action') {
            if (payload.path) {
                navigate(payload.path);
            }
        }
        setRichMessages(prev => ({ ...prev, [sessionId]: action }));
    }, [navigate]);

    const handleSend = useCallback(async (text: string, attachments: File[]) => {
        if ((!text && attachments.length === 0)) return;

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            try {
                const title = text.substring(0, 30) + "...";
                const newSession = await createSessionAsync(title);
                activeSessionId = newSession.id;
                setCurrentSessionId(newSession.id);
            } catch (e: unknown) {
                console.error("[DesktopAIChat] Falha ao iniciar conversa", e);
                toast.error(getUserFacingErrorMessage(e, "save"));
                return;
            }
        }

        if (isListening) stopListening();

        const outboundText = text.trim() || "Anexo enviado para analise.";
        const uploadedFiles: { name: string, url: string, documentId?: string, storageProvider?: "r2" }[] = [];
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
            } catch (e: unknown) {
                console.error("[DesktopAIChat] Falha no envio de anexo", e);
                toast.error(getUserFacingErrorMessage(e, "save"));
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        const contextData = { activePatientId, currentContext };

        if (!activeSessionId) return;

        sendMessage({ message: outboundText, sessionId: activeSessionId, attachments: uploadedFiles, context: contextData }, {
            onSuccess: (data: any) => {
                resetTranscript();
                if (isVoiceModeOpen && data.response) {
                    setLastVoiceResponse(data.response);
                    speak(data.response);
                }
                if (data.clientAction) {
                    handleClientAction(data.clientAction, activeSessionId!);
                }
            }
        });
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

    const handleDeleteChat = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteSession(id);
        if (currentSessionId === id) setCurrentSessionId(null);
    };

    return (
        <div className="desktop-apple-shell relative mx-3 flex h-[calc(100dvh-5.5rem)] min-h-[36rem] overflow-hidden rounded-[34px] font-sans text-foreground shadow-2xl selection:bg-primary/10 md:mx-4 md:rounded-[40px] perspective-1000">

            {/* Subtle Gradient Overlay for Depth */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-foreground/[0.018] to-transparent" />

            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-background">
                <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,hsl(var(--foreground)/0.045),transparent_66%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.048),transparent_66%)]" />
            </div>

            <DesktopVoiceOverlay
                isOpen={isVoiceModeOpen}
                onClose={() => setIsVoiceModeOpen(false)}
            />

            {/* Floating History Sidebar */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute inset-0 z-40 bg-black/46 backdrop-blur-[2px]"
                        />
                        <motion.div
                            initial={shouldReduceMotion ? false : { opacity: 0, x: "-100%" }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: "-100%" }}
                            transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 34 }}
                            className="desktop-apple-surface absolute left-0 top-0 z-50 h-full w-full overflow-hidden rounded-r-[30px] border-y-0 border-l-0 border-r border-border/40 shadow-2xl md:w-[350px]"
                        >
                            <ChatSidebar
                                sessions={sessions}
                                currentSessionId={currentSessionId}
                                onSelectSession={(id) => { setCurrentSessionId(id); setIsSidebarOpen(false); }}
                                onCreateSession={handleCreateNewChat}
                                onDeleteSession={handleDeleteChat}
                                onClose={() => setIsSidebarOpen(false)}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* --- MAIN CHAT AREA --- */}
            <div className="relative z-20 flex h-full flex-1 flex-col">

                {/* Header Section */}
                <header className="absolute left-0 right-0 top-0 z-30 flex h-[80px] items-center justify-between border-b border-border/35 bg-background/72 px-4 backdrop-blur-xl dark:border-white/[0.055] dark:bg-[#09090b]/62 sm:px-8">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(true)}
                            className="h-11 w-11 rounded-full text-muted-foreground ring-1 ring-transparent transition-all hover:bg-muted hover:text-foreground hover:ring-border/30"
                            aria-label="Abrir histórico de conversas"
                        >
                            <History className="h-5 w-5" />
                        </Button>

                        <div className="flex items-center gap-2.5 rounded-full border border-border/40 bg-muted/35 px-4 py-1.5 shadow-sm backdrop-blur-md dark:border-white/[0.075]">
                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">Synapse AI</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsVoiceModeOpen(true)}
                            className="h-9 rounded-full border-border/45 bg-background/70 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground shadow-sm transition-all hover:border-border/70 hover:bg-muted hover:text-foreground dark:border-white/[0.075] dark:bg-white/[0.045]"
                            aria-label="Abrir modo voz"
                        >
                            <Phone className="h-3 w-3 mr-2" /> Modo Voz
                        </Button>
                    </div>
                </header>

                {/* Content Area */}
                <main className="relative flex flex-1 flex-col overflow-hidden">
                    {!currentSessionId ? (
                        <div className="h-full w-full flex flex-col items-center justify-center p-8 relative">
                            <EmptyChatState onSuggestionClick={(text) => handleSend(text, [])} />
                        </div>
                    ) : (
                        <ScrollArea ref={scrollRef} className="flex-1 px-3 sm:px-4">
                            <div className="mx-auto max-w-4xl space-y-12 pb-12 pt-32">
                                {messages?.map((msg, idx) => {
                                    const isLast = idx === messages.length - 1;
                                    const richData = isLast && msg.role === 'assistant' ? richMessages[currentSessionId!] : undefined;
                                    return (
                                        <ChatMessageItem
                                            key={msg.id}
                                            message={msg}
                                            richData={richData}
                                            onAction={() => { }}
                                        />
                                    );
                                })}
                                {isSending && <ThinkingIndicator />}
                                <div className="h-24" />
                            </div>
                        </ScrollArea>
                    )}
                </main>

                {/* Bottom Input Area */}
                <div className="pointer-events-none absolute bottom-5 left-0 right-0 z-30 flex justify-center px-3 sm:bottom-8 sm:px-6">
                    <div className="w-full max-w-3xl pointer-events-auto">
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

            {/* Modals */}
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
                onSent={() => toast.success("Cobrança criada com sucesso!")}
            />
        </div>
    );
}
