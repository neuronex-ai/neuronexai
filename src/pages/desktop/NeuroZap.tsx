import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaMessage } from "@/components/whatsapp/MediaMessage";
import { useWhatsAppAgent, WAConversation, WAMessage, WhatsAppSettings } from "@/hooks/use-whatsapp-agent";
import { cn } from "@/lib/utils";

const formatDisplayName = (patientName: string | null | undefined, patientPhone: string | null | undefined) => {
  if (
    patientName &&
    !patientName.includes("@lid") &&
    !patientName.includes("@s.whatsapp.net") &&
    !patientName.includes("@g.us") &&
    !/^\d+$/.test(patientName)
  ) {
    return patientName;
  }

  const cleanPhone = (patientPhone || patientName || "")
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@g.us", "")
    .replace(/@lid$/, "")
    .replace(/[^\d+]/g, "");

  const digits = cleanPhone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    if (number.length === 9) return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
    if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  if (digits.length >= 10) return digits.replace(/(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
  return cleanPhone || "Contato";
};

const getInitials = (name: string) => {
  if (!name || name.startsWith("(") || /^\d/.test(name)) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return parts[0]?.[0]?.toUpperCase() || "?";
};

const formatConversationTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM");
};

const formatMessageDate = (date: Date) => {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "d 'de' MMMM", { locale: ptBR });
};

const StatusPill = ({ settings, loading }: { settings?: WhatsAppSettings | null; loading?: boolean }) => {
  const connected = settings?.connection_state === "open" || settings?.is_active;
  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground">
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-muted-foreground")} />
      )}
      {connected ? "Conectado" : "Desconectado"}
    </div>
  );
};

const MessageStatus = ({ status, direction }: { status: string; direction: string }) => {
  if (direction === "inbound") return null;
  if (status === "read") return <CheckCheck className="h-3 w-3" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" />;
  if (status === "failed") return <AlertCircle className="h-3 w-3" />;
  return <Check className="h-3 w-3" />;
};

const groupMessages = (messages: WAMessage[] = []) =>
  messages.reduce<Record<string, WAMessage[]>>((groups, message) => {
    const key = format(new Date(message.created_at), "yyyy-MM-dd");
    groups[key] = groups[key] || [];
    groups[key].push(message);
    return groups;
  }, {});

type ConnectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: WhatsAppSettings | null;
  loading: boolean;
  refreshStatus: ReturnType<typeof useWhatsAppAgent>["refreshStatus"];
  connect: ReturnType<typeof useWhatsAppAgent>["connect"];
  reconfigureWebhook: ReturnType<typeof useWhatsAppAgent>["reconfigureWebhook"];
  fullSync: ReturnType<typeof useWhatsAppAgent>["fullSync"];
};

function ConnectionDialog({
  open,
  onOpenChange,
  settings,
  loading,
  refreshStatus,
  connect,
  reconfigureWebhook,
  fullSync,
}: ConnectionDialogProps) {
  const connected = settings?.connection_state === "open" || settings?.is_active;
  const connectPayload = connect.data as { connection?: Record<string, any> } | undefined;
  const qrValue =
    typeof connectPayload?.connection?.base64 === "string"
      ? connectPayload.connection.base64
      : typeof connectPayload?.connection?.qrcode === "string"
        ? connectPayload.connection.qrcode
        : typeof connectPayload?.connection?.code === "string"
          ? connectPayload.connection.code
          : null;
  const qrImageSrc = qrValue
    ? qrValue.startsWith("data:")
      ? qrValue
      : qrValue.length > 120 && !/^https?:\/\//.test(qrValue)
        ? `data:image/png;base64,${qrValue}`
        : null
    : null;

  return (
    <AppModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Conectar WhatsApp Business"
      eyebrow="NeuroZap"
      description="Conexão Evolution API gerenciada com credenciais protegidas."
      heroIcon={<ModalHeroIcon icon={MessageCircle} state={connected ? "success" : "neutral"} tone="status" ariaLabel="WhatsApp Business" />}
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => refreshStatus.mutate()}
            disabled={refreshStatus.isPending}
            className="h-11 rounded-lg"
          >
            {refreshStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar status
          </Button>
          <Button
            type="button"
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="h-11 rounded-lg"
          >
            {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            Conectar
          </Button>
        </div>
      }
      size="lg"
    >
      <div className="space-y-4">
        <section className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Instancia</p>
              <p className="mt-1 text-lg font-black">{settings?.instance_name || "neuronex-ai"}</p>
            </div>
            <StatusPill settings={settings} loading={loading || refreshStatus.isPending} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile label="Ambiente" value={settings?.environment === "production" ? "Produção" : "Sandbox"} />
            <InfoTile label="Webhook" value={settings?.webhook_enabled ? "Ativo" : "Pendente"} />
            <InfoTile label="Estado" value={settings?.connection_state || "desconhecido"} />
            <InfoTile label="Última sincronização" value={settings?.last_sync_at ? format(new Date(settings.last_sync_at), "dd/MM HH:mm") : "não sincronizado"} />
          </div>
          {settings?.webhook_url ? (
            <p className="mt-4 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
              {settings.webhook_url}
            </p>
          ) : null}
        </section>

        {qrValue && !connected ? (
          <section className="rounded-lg border border-border bg-background p-4 text-center">
            {qrImageSrc ? (
              <img
                src={qrImageSrc}
                alt="QR Code de conexão do WhatsApp Business"
                className="mx-auto h-56 w-56 rounded-lg border border-border bg-white p-3"
              />
            ) : (
              <p className="break-all rounded-lg border border-border bg-muted p-3 text-sm font-bold">
                {qrValue}
              </p>
            )}
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => reconfigureWebhook.mutate()}
            disabled={reconfigureWebhook.isPending}
            className="h-12 justify-start rounded-lg"
          >
            {reconfigureWebhook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
            Reconfigurar webhook
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fullSync.mutate()}
            disabled={fullSync.isPending}
            className="h-12 justify-start rounded-lg"
          >
            {fullSync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar conversas
          </Button>
        </section>
      </div>
    </AppModalShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function NeuroZap() {
  const [selectedConversation, setSelectedConversation] = useState<WAConversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const whatsapp = useWhatsAppAgent();
  const { data: settings, isLoading: isLoadingSettings } = whatsapp.useSettings();
  const { data: conversations = [], isLoading: isLoadingConversations } = whatsapp.useConversations();
  const { data: messages = [], isLoading: isLoadingMessages } = whatsapp.useMessages(selectedConversation?.id);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const name = formatDisplayName(conversation.patient_name, conversation.patient_phone).toLowerCase();
      return name.includes(query) || conversation.patient_phone.includes(query) || conversation.remote_jid.includes(query);
    });
  }, [conversations, searchQuery]);

  const unreadCount = conversations.reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0);
  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    whatsapp.refreshStatus.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConversation = (conversation: WAConversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
    if (conversation.unread_count > 0) whatsapp.markAsRead.mutate(conversation.id);
    whatsapp.syncMessages.mutate({ remoteJid: conversation.remote_jid });
  };

  const handleSend = () => {
    if (!replyText.trim() || !selectedConversation) return;
    whatsapp.sendMessage.mutate({
      conversationId: selectedConversation.id,
      remoteJid: selectedConversation.remote_jid,
      message: replyText.trim(),
    });
    setReplyText("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ConnectionDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        loading={isLoadingSettings}
        refreshStatus={whatsapp.refreshStatus}
        connect={whatsapp.connect}
        reconfigureWebhook={whatsapp.reconfigureWebhook}
        fullSync={whatsapp.fullSync}
      />

      <main className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4 shadow-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                Business
              </Badge>
              <StatusPill settings={settings} loading={isLoadingSettings || whatsapp.refreshStatus.isPending} />
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-normal sm:text-4xl">
              NeuroZap
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-lg" onClick={() => whatsapp.fullSync.mutate()} disabled={whatsapp.fullSync.isPending}>
              {whatsapp.fullSync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar
            </Button>
            <Button className="h-11 rounded-lg" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Conectar WhatsApp Business
            </Button>
          </div>
        </header>

        <section className="grid min-h-[calc(100dvh-9.5rem)] overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className={cn("min-h-0 border-r border-border", showMobileChat ? "hidden lg:block" : "block")}>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar conversa"
                  className="h-11 rounded-lg pl-9"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>{conversations.length} conversas</span>
                <span>{unreadCount} não lidas</span>
              </div>
            </div>

            <ScrollArea className="h-[calc(100dvh-16rem)]">
              <div className="space-y-1 p-2">
                {isLoadingConversations ? (
                  <LoadingBlock label="Carregando conversas" />
                ) : filteredConversations.length ? (
                  filteredConversations.map((conversation) => (
                    <ConversationRow
                      key={conversation.id}
                      conversation={conversation}
                      selected={selectedConversation?.id === conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                    />
                  ))
                ) : (
                  <EmptyBlock
                    icon={MessageCircle}
                    title={settings?.is_active ? "Nenhuma conversa" : "WhatsApp desconectado"}
                    actionLabel={settings?.is_active ? "Sincronizar" : "Conectar"}
                    onAction={() => (settings?.is_active ? whatsapp.fullSync.mutate() : setSettingsOpen(true))}
                    loading={whatsapp.fullSync.isPending}
                  />
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className={cn("min-h-0", !selectedConversation && !showMobileChat ? "hidden lg:block" : "block")}>
            {selectedConversation ? (
              <div className="flex h-full min-h-[calc(100dvh-9.5rem)] flex-col">
                <ChatHeader
                  conversation={selectedConversation}
                  syncing={whatsapp.syncMessages.isPending}
                  onBack={() => {
                    setSelectedConversation(null);
                    setShowMobileChat(false);
                  }}
                  onSync={() => whatsapp.syncMessages.mutate({ remoteJid: selectedConversation.remote_jid })}
                />

                <ScrollArea className="min-h-0 flex-1 bg-muted/20 px-3 py-4 sm:px-6">
                  <div className="mx-auto max-w-3xl space-y-3">
                    {isLoadingMessages ? (
                      <LoadingBlock label="Carregando mensagens" />
                    ) : Object.keys(groupedMessages).length ? (
                      Object.entries(groupedMessages).map(([date, dayMessages]) => (
                        <div key={date}>
                          <div className="my-5 flex justify-center">
                            <span className="rounded-lg border border-border bg-background px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                              {formatMessageDate(new Date(date))}
                            </span>
                          </div>
                          {dayMessages.map((message) => (
                            <MessageBubble key={message.id} message={message} />
                          ))}
                        </div>
                      ))
                    ) : (
                      <EmptyBlock icon={MessageSquare} title="Sem mensagens sincronizadas" actionLabel="Atualizar" onAction={() => whatsapp.syncMessages.mutate({ remoteJid: selectedConversation.remote_jid })} loading={whatsapp.syncMessages.isPending} />
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-border bg-card p-3 sm:p-4">
                  <div className="mx-auto flex max-w-3xl items-end gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Mensagem"
                      className="min-h-[52px] resize-none rounded-lg"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleSend}
                      disabled={!replyText.trim() || whatsapp.sendMessage.isPending}
                      className="h-[52px] w-[52px] shrink-0 rounded-lg"
                      aria-label="Enviar mensagem"
                    >
                      {whatsapp.sendMessage.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[calc(100dvh-9.5rem)] items-center justify-center p-8">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-muted">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-black">Central NeuroZap</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    Selecione uma conversa para responder pelo WhatsApp Business.
                  </p>
                  <Button className="mt-5 h-11 rounded-lg" onClick={() => setSettingsOpen(true)}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Conectar WhatsApp Business
                  </Button>
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onClick,
}: {
  conversation: WAConversation;
  selected: boolean;
  onClick: () => void;
}) {
  const name = formatDisplayName(conversation.patient_name, conversation.patient_phone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 rounded-lg border p-3 text-left transition-colors",
        selected ? "border-foreground/20 bg-foreground text-background" : "border-transparent hover:border-border hover:bg-muted",
      )}
    >
      <Avatar className="h-11 w-11 rounded-lg">
        {conversation.profile_picture_url ? <AvatarImage src={conversation.profile_picture_url} /> : null}
        <AvatarFallback className="rounded-lg text-sm font-black">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-black">{name}</p>
          <span className={cn("text-[10px] font-bold", selected ? "text-background/65" : "text-muted-foreground")}>
            {formatConversationTime(conversation.last_message_at)}
          </span>
        </div>
        <p className={cn("mt-1 truncate text-xs font-medium", selected ? "text-background/70" : "text-muted-foreground")}>
          {conversation.last_message_preview || conversation.patient_phone}
        </p>
      </div>
      {conversation.unread_count > 0 ? (
        <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black", selected ? "bg-background text-foreground" : "bg-foreground text-background")}>
          {conversation.unread_count}
        </span>
      ) : null}
    </button>
  );
}

function ChatHeader({
  conversation,
  syncing,
  onBack,
  onSync,
}: {
  conversation: WAConversation;
  syncing: boolean;
  onBack: () => void;
  onSync: () => void;
}) {
  const name = formatDisplayName(conversation.patient_name, conversation.patient_phone);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-lg lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-11 w-11 rounded-lg">
          {conversation.profile_picture_url ? <AvatarImage src={conversation.profile_picture_url} /> : null}
          <AvatarFallback className="rounded-lg text-sm font-black">{getInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-black sm:text-base">{name}</h2>
            <Badge variant="outline" className="hidden rounded-lg text-[10px] font-black sm:inline-flex">
              <Sparkles className="mr-1 h-3 w-3" />
              IA
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Phone className="h-3 w-3" />
            {conversation.patient_phone.replace("@s.whatsapp.net", "").replace(/@.*$/, "")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onSync} disabled={syncing} className="h-10 w-10 rounded-lg">
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar conversa</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg" aria-label="Mais opções">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: WAMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mb-3 flex", outbound ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[82%] rounded-lg border px-4 py-3 text-sm shadow-sm sm:max-w-[68%]",
          outbound ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
        )}
      >
        <MediaMessage
          contentType={message.content_type}
          content={message.content}
          mediaBase64={message.media_base64}
          mediaMimetype={message.media_mimetype}
          mediaFilename={message.media_filename}
          direction={message.direction}
        />
        <div className={cn("mt-2 flex items-center gap-1.5 text-[10px] font-bold", outbound ? "justify-end text-background/65" : "text-muted-foreground")}>
          <Clock className="h-3 w-3" />
          {format(new Date(message.created_at), "HH:mm")}
          <MessageStatus status={message.status} direction={message.direction} />
        </div>
      </div>
    </motion.div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  actionLabel,
  onAction,
  loading,
}: {
  icon: React.ElementType<{ className?: string }>;
  title: string;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-black">{title}</h3>
      <Button variant="outline" size="sm" className="rounded-lg" onClick={onAction} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {actionLabel}
      </Button>
    </div>
  );
}
