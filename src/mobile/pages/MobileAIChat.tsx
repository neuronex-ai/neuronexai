"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { useChatSessions, useCreateChatSession, useDeleteChatSession, useSendChatMessage, useSessionMessages } from "@/hooks/use-ai-chat";
import { useGeminiVoice } from "@/hooks/use-gemini-voice";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import { getR2DocumentDownloadUrl, uploadDocumentToR2 } from "@/lib/r2-documents-client";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  Calendar,
  DollarSign,
  History,
  MessageSquare,
  Mic,
  Plus,
  SquarePen,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MobileLayout } from "../components/MobileLayout";
import {
  MobileSynapseButton,
  MobileSynapseHero,
  MobileSynapseIconButton,
  MobileSynapseMessage,
  MobileSynapsePromptCard,
  MobileSynapseSessionRow,
  MobileSynapseSheet,
  MobileSynapseThinking,
  MobileSynapseVoicePanel,
} from "../components/synapse/MobileSynapsePrimitives";
import { MobileSynapseComposer } from "../components/synapse/MobileSynapseComposer";
import {
  MobileSynapseEmailDraftSheet,
  MobileSynapseInvoiceDraftSheet,
  type MobileEmailDraftData,
  type MobileInvoiceDraftData,
} from "../components/synapse/MobileSynapseDraftSheets";

const INITIAL_SUGGESTIONS = [
  { text: "Resumo da agenda", icon: Calendar },
  { text: "Financeiro hoje", icon: DollarSign },
  { text: "Pendências", icon: Users },
  { text: "Criar lembrete", icon: Bell },
] as const;

type SynapseMode = "chat" | "voice";
type UploadedFile = { name: string; url: string; documentId?: string; storageProvider?: "r2" };
type SynapseClientAction = {
  type: string;
  payload?: unknown;
  data?: unknown;
};
type SynapseResponse = {
  response?: string;
  clientAction?: SynapseClientAction;
};

const toSynapseResponse = (value: unknown): SynapseResponse => {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const response = typeof record.response === "string" ? record.response : undefined;
  const clientAction = record.clientAction && typeof record.clientAction === "object"
    ? record.clientAction as Record<string, unknown>
    : null;

  return {
    response,
    clientAction: clientAction && typeof clientAction.type === "string"
      ? {
        type: clientAction.type,
        payload: clientAction.payload,
        data: clientAction.data,
      }
      : undefined,
  };
};

export const MobileAIChat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<SynapseMode>("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmailSheetOpen, setIsEmailSheetOpen] = useState(false);
  const [emailDraftData, setEmailDraftData] = useState<MobileEmailDraftData | null>(null);
  const [isInvoiceSheetOpen, setIsInvoiceSheetOpen] = useState(false);
  const [invoiceDraftData, setInvoiceDraftData] = useState<MobileInvoiceDraftData | null>(null);
  const [richMessages, setRichMessages] = useState<Record<string, unknown>>({});

  const { data: sessions, isLoading: isLoadingSessions } = useChatSessions();
  const { data: messages } = useSessionMessages(sessionId);
  const { mutate: createSession } = useCreateChatSession();
  const { mutate: deleteSession } = useDeleteChatSession();
  const { mutate: sendMessage, isPending: isProcessing } = useSendChatMessage();

  const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const {
    token: voiceToken,
    model: voiceModel,
    voiceName,
    provider: voiceProvider,
    gatewayUrl: voiceGatewayUrl,
    sessionId: voiceAgentSessionId,
    conversationId: voiceConversationId,
    voiceSessionId,
    isLoading: isVoiceConfigLoading,
    error: voiceConfigError,
    refresh: refreshVoiceConfig,
  } = useVoiceConfig();
  const {
    isConnected: isVoiceConnected,
    isListening: isVoiceListening,
    isProcessing: isVoiceProcessing,
    isSpeaking: isVoiceSpeaking,
    isToolActive: isVoiceToolActive,
    activeToolLabel: voiceActiveToolLabel,
    activeToolMessage: voiceActiveToolMessage,
    lastResponse: voiceLastResponse,
    startSession: startVoiceSession,
    endSession: endVoiceSession,
    toggleListening: toggleVoiceListening,
    error: voiceRuntimeError,
  } = useGeminiVoice({
    token: voiceToken,
    model: voiceModel,
    voiceName,
    provider: voiceProvider,
    gatewayUrl: voiceGatewayUrl,
    sessionId: voiceAgentSessionId || sessionId,
    conversationId: voiceConversationId || sessionId,
    voiceSessionId,
    language: "pt-BR",
    systemInstruction: "Você é o Synapse AI mobile do NeuroNex. Converse por voz em português brasileiro com respostas curtas, naturais e úteis para a rotina clínica, agenda, pacientes e financeiro.",
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionList = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);
  const messageList = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);

  const createNewChat = useCallback(() => {
    createSession(undefined, {
      onSuccess: (data) => {
        setSessionId(data.id);
        setInputValue("");
        setRichMessages({});
        resetTranscript();
        setIsHistoryOpen(false);
      },
    });
  }, [createSession, resetTranscript]);

  useEffect(() => {
    if (sessionId || isLoadingSessions) return;
    if (sessionList.length > 0) {
      setSessionId(sessionList[0].id);
      return;
    }
    createNewChat();
  }, [createNewChat, isLoadingSessions, sessionId, sessionList]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messageList, isProcessing, richMessages]);

  useEffect(() => {
    if (transcript) setInputValue(transcript);
  }, [transcript]);

  const handleDeleteSession = (id: string) => {
    deleteSession(id);
    if (id === sessionId) createNewChat();
  };

  const handleSend = useCallback(async (text: string = inputValue, attachments: File[] = []) => {
    const messageText = text.trim();
    if (!messageText && attachments.length === 0) return;
    if (!sessionId) return;

    setInputValue("");
    resetTranscript();
    stopListening();

    const uploadedFiles: UploadedFile[] = [];

    if (attachments.length > 0) {
      setIsUploading(true);
      try {
        for (const file of attachments) {
          const document = await uploadDocumentToR2({
            file,
            category: "other",
            metadata: {
              source: "ai_chat",
              chatSessionId: sessionId,
              client: "mobile",
            },
          });
          const url = await getR2DocumentDownloadUrl({ documentId: document.id, disposition: "inline" });
          uploadedFiles.push({ name: file.name, url, documentId: document.id, storageProvider: "r2" });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Falha ao enviar anexo.";
        toast.error(`Erro no upload: ${message}`);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    sendMessage({ message: messageText || "Anexo enviado para analise.", sessionId, attachments: uploadedFiles }, {
      onSuccess: (payload: unknown) => {
        const data = toSynapseResponse(payload);

        if (!data?.clientAction) return;

        if (data.clientAction.type === "review_draft") {
          setEmailDraftData(data.clientAction.payload as MobileEmailDraftData);
          setIsEmailSheetOpen(true);
          return;
        }

        if (data.clientAction.type === "review_invoice_draft") {
          setInvoiceDraftData(data.clientAction.payload as MobileInvoiceDraftData);
          setIsInvoiceSheetOpen(true);
          return;
        }

        setRichMessages((previous) => ({ ...previous, latest: data.clientAction }));
      },
    });
  }, [inputValue, resetTranscript, sendMessage, sessionId, stopListening, user?.id]);

  const handleVoiceToggle = useCallback(async () => {
    if (isVoiceConnected) {
      toggleVoiceListening();
      return;
    }

    try {
      const config = await refreshVoiceConfig();
      await startVoiceSession({
        token: config.token,
        model: config.model,
        voiceName: config.voiceName,
        gatewayUrl: config.gatewayUrl,
        provider: config.provider,
        sessionId: config.sessionId || sessionId,
        conversationId: config.conversationId || sessionId,
        voiceSessionId: config.voiceSessionId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível iniciar o modo voz.";
      toast.error(message);
    }
  }, [isVoiceConnected, refreshVoiceConfig, sessionId, startVoiceSession, toggleVoiceListening]);

  const restartVoiceSession = useCallback(async () => {
    endVoiceSession();
    try {
      const config = await refreshVoiceConfig();
      await startVoiceSession({
        token: config.token,
        model: config.model,
        voiceName: config.voiceName,
        gatewayUrl: config.gatewayUrl,
        provider: config.provider,
        sessionId: config.sessionId || sessionId,
        conversationId: config.conversationId || sessionId,
        voiceSessionId: config.voiceSessionId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Nao foi possivel reiniciar o modo voz.";
      toast.error(message);
    }
  }, [endVoiceSession, refreshVoiceConfig, sessionId, startVoiceSession]);

  const toggleVoiceMode = () => {
    setMode((current) => {
      if (current === "chat") return "voice";
      stopListening();
      endVoiceSession();
      return "chat";
    });
  };

  useEffect(() => () => {
    endVoiceSession();
  }, [endVoiceSession]);

  const groupedSessionEntries = useMemo(() => {
    type ChatSession = (typeof sessionList)[number];
    const grouped = sessionList.reduce((acc, session) => {
      const date = new Date(session.created_at);
      let key = format(date, "yyyy-MM-dd");
      if (isToday(date)) key = "Hoje";
      else if (isYesterday(date)) key = "Ontem";
      else key = format(date, "dd/MM", { locale: ptBR });

      const group = acc[key] || [];
      group.push(session);
      acc[key] = group;
      return acc;
    }, {} as Record<string, ChatSession[]>);

    return Object.entries(grouped) as [string, ChatSession[]][];
  }, [sessionList]);

  const activeSession = sessionList.find((session) => session.id === sessionId);
  const hasMessages = messageList.length > 0;

  return (
    <MobileLayout
      showNav={false}
      showBottomNav={false}
      shellClassName="synapse-canvas"
      className="synapse-canvas min-h-0 overflow-hidden px-0 pb-0 pt-0"
    >
      <header className="pointer-events-none fixed left-0 right-0 top-0 z-[105] px-4 pt-[calc(0.55rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-2">
            <MobileSynapseIconButton icon={ArrowLeft} label="Voltar" onClick={() => navigate("/mobile")} />
            <MobileSynapseIconButton icon={History} label="Histórico" onClick={() => setIsHistoryOpen(true)} />
          </div>

          <div className="synapse-glass pointer-events-auto min-w-0 flex-1 rounded-full px-3 py-2 text-center">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.17em] synapse-tertiary-text">
              Synapse AI
            </p>
            <p className="mt-0.5 truncate text-[11px] font-black tracking-[-0.01em]" style={{ color: "var(--synapse-text-primary)" }}>
              {activeSession?.title || (mode === "voice" ? "Modo voz" : "Nova conversa")}
            </p>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <MobileSynapseIconButton icon={mode === "chat" ? Mic : MessageSquare} label={mode === "chat" ? "Modo voz" : "Modo texto"} onClick={toggleVoiceMode} />
            <MobileSynapseIconButton icon={SquarePen} label="Nova conversa" onClick={createNewChat} />
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {mode === "voice" ? (
          <motion.div
            key="voice"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="min-h-[100dvh]"
          >
            <MobileSynapseVoicePanel
              isConnected={isVoiceConnected}
              isListening={isVoiceListening}
              isProcessing={isVoiceProcessing || isVoiceConfigLoading}
              isSpeaking={isVoiceSpeaking}
              isToolActive={isVoiceToolActive}
              activeToolLabel={voiceActiveToolLabel}
              activeToolMessage={voiceActiveToolMessage}
              lastResponse={voiceLastResponse}
              error={voiceRuntimeError || voiceConfigError}
              onToggleRecording={() => void handleVoiceToggle()}
              onReset={() => void restartVoiceSession()}
            />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex h-full min-h-0 flex-col overflow-hidden"
          >
            <div ref={scrollRef} className="mobile-scroll-owner flex-1 overflow-y-auto px-4 pb-40 pt-[calc(6.15rem+env(safe-area-inset-top))]">
              {!hasMessages ? (
                <div className="flex min-h-full flex-col justify-end gap-4 pb-5">
                  <MobileSynapseHero
                    modeLabel="Synapse mobile"
                    title="O que vamos organizar?"
                    description="Pergunte sobre agenda, pacientes, financeiro ou próximos passos sem sair do fluxo do celular."
                    status="Texto e voz disponíveis"
                  />

                  <section className="grid grid-cols-2 gap-2.5">
                    {INITIAL_SUGGESTIONS.map((suggestion) => (
                      <MobileSynapsePromptCard
                        key={suggestion.text}
                        label={suggestion.text}
                        icon={suggestion.icon}
                        onClick={() => handleSend(suggestion.text)}
                      />
                    ))}
                  </section>
                </div>
              ) : (
                <div className="space-y-3 pb-5">
                  {messageList.map((message, index) => {
                    const isLastAssistant = index === messageList.length - 1 && message.role === "assistant";
                    const richData = isLastAssistant ? richMessages.latest : undefined;
                    return (
                      <MobileSynapseMessage
                        key={message.id}
                        message={message}
                        richData={richData}
                      />
                    );
                  })}
                  {isProcessing ? <MobileSynapseThinking /> : null}
                </div>
              )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[95] bg-gradient-to-t from-[var(--synapse-canvas)] via-[color-mix(in_srgb,var(--synapse-canvas)_94%,transparent)] to-transparent px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-12">
              <MobileSynapseComposer
                value={inputValue}
                onChange={setInputValue}
                onSend={() => void handleSend()}
                onVoiceMode={toggleVoiceMode}
                isListening={isListening}
                onStartListening={startListening}
                onStopListening={stopListening}
                isProcessing={isProcessing}
                isUploading={isUploading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileSynapseSheet
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        icon={History}
        eyebrow="Memória"
        title="Conversas"
        description="Retome uma conversa recente ou comece do zero."
        footer={(
          <MobileSynapseButton onClick={createNewChat} className="w-full">
            <Plus className="h-4 w-4" />
            Nova conversa
          </MobileSynapseButton>
        )}
      >
        <div className="space-y-7">
          {groupedSessionEntries.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-border/45 px-5 py-9 text-center dark:border-white/10">
              <p className="text-sm font-black tracking-[-0.02em] text-foreground">Sem histórico ainda</p>
              <p className="mx-auto mt-2 max-w-[17rem] text-xs font-medium leading-relaxed text-muted-foreground/68">
                A primeira conversa aparecerá aqui assim que o Synapse responder.
              </p>
            </div>
          ) : groupedSessionEntries.map(([label, list]) => (
            <section key={label} className="space-y-2.5">
              <p className="px-1 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/52">{label}</p>
              {list.map((session) => (
                <MobileSynapseSessionRow
                  key={session.id}
                  title={session.title || "Nova conversa"}
                  description={format(new Date(session.updated_at || session.created_at), "HH:mm", { locale: ptBR })}
                  active={session.id === sessionId}
                  onClick={() => {
                    setSessionId(session.id);
                    setIsHistoryOpen(false);
                  }}
                  onDelete={() => handleDeleteSession(session.id)}
                />
              ))}
            </section>
          ))}
        </div>
      </MobileSynapseSheet>

      <MobileSynapseEmailDraftSheet
        open={isEmailSheetOpen}
        onOpenChange={setIsEmailSheetOpen}
        initialData={emailDraftData}
        onSent={() => toast.info("E-mail enviado.")}
      />
      <MobileSynapseInvoiceDraftSheet
        open={isInvoiceSheetOpen}
        onOpenChange={setIsInvoiceSheetOpen}
        initialData={invoiceDraftData}
        onSent={() => toast.success("Cobrança criada com sucesso.")}
      />
    </MobileLayout>
  );
};
