import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAI } from "@/context/AIContext";
import { useChatSessions, useCreateChatSession, useDeleteChatSession, useSendChatMessage, useSessionMessages } from "@/hooks/use-ai-chat";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import { getR2DocumentDownloadUrl, uploadDocumentToR2 } from "@/lib/r2-documents-client";
import { AnimatePresence, motion } from "framer-motion";
import { History, Phone, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

    // Auto-send from URL Query
    useEffect(() => {
        const query = searchParams.get('q');
        if (query) {
            const initAndSend = async () => {
                await handleSend(query, []);
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('q');
                setSearchParams(newParams);
            };
            initAndSend();
        }
    }, [searchParams]);

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

    const handleSend = async (text: string, attachments: File[]) => {
        if ((!text && attachments.length === 0)) return;

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            try {
                const title = text.substring(0, 30) + "...";
                const newSession = await createSessionAsync(title);
                activeSessionId = newSession.id;
                setCurrentSessionId(newSession.id);
            } catch (e: any) {
                console.error("[DesktopAIChat] Falha ao iniciar conversa", e);
                toast.error(getUserFacingErrorMessage(e, "save"));
                return;
            }
        }

        if (isListening) stopListening();

        const outboundText = text.trim() || "Anexo enviado para analise.";
        let uploadedFiles: { name: string, url: string, documentId?: string, storageProvider?: "r2" }[] = [];
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
            } catch (e: any) {
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
    };

    const handleClientAction = (action: any, sessionId: string) => {
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
    };

    const handleDeleteChat = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deleteSession(id);
        if (currentSessionId === id) setCurrentSessionId(null);
    };

    return (
        <div className="h-[calc(100vh-theme(spacing.28))] flex bg-background text-foreground font-sans overflow-hidden relative selection:bg-primary/10 rounded-t-[44px] shadow-2xl mx-4 ring-1 ring-border/10 perspective-1000">

            {/* Subtle Gradient Overlay for Depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent pointer-events-none z-10" />

            {/* Immersive Space Background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-background">
                <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/[0.03] blur-[200px] rounded-full pointer-events-none" />
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
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-40"
                        />
                        <motion.div
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="absolute top-0 left-0 h-full w-full md:w-[350px] z-50 bg-card/95 backdrop-blur-3xl border-r border-border/10 shadow-2xl"
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
            <div className="flex-1 flex flex-col h-full relative z-20">

                {/* Header Section */}
                {/* Header Section */}
                <header className="absolute top-0 left-0 right-0 h-[80px] px-8 flex items-center justify-between border-b border-border/5 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-md z-30">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(true)}
                            className="h-11 w-11 rounded-full hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-all ring-1 ring-transparent hover:ring-border/10"
                        >
                            <History className="h-5 w-5" />
                        </Button>

                        <div className="flex items-center gap-2.5 px-4 py-1.5 bg-secondary/10 border border-border/10 rounded-full backdrop-blur-md shadow-sm">
                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">Synapse AI</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsVoiceModeOpen(true)}
                            className="h-8 px-4 rounded-full border-border/10 bg-secondary/10 hover:bg-secondary/20 hover:border-border/20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all shadow-sm"
                        >
                            <Phone className="h-3 w-3 mr-2" /> Modo Voz
                        </Button>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-hidden relative flex flex-col">
                    {!currentSessionId ? (
                        <div className="h-full w-full flex flex-col items-center justify-center p-8 relative">
                            <EmptyChatState onSuggestionClick={(text) => handleSend(text, [])} />
                        </div>
                    ) : (
                        <ScrollArea ref={scrollRef} className="flex-1 px-4">
                            <div className="max-w-4xl mx-auto pt-32 pb-12 space-y-12">
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
                                <div className="h-24" /> {/* Spacer */}
                            </div>
                        </ScrollArea>
                    )}
                </main>

                {/* Bottom Input Area */}
                <div className="absolute bottom-10 left-0 right-0 px-6 flex justify-center pointer-events-none z-30">
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
