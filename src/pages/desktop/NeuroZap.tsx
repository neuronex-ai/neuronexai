import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  LockKeyhole,
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
  UserRound,
  WifiOff,
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

const connectedStatus = (settings?: WhatsAppSettings | null) =>
  settings?.connection_state === "open" || Boolean(settings?.is_active);

const StatusPill = ({ settings, loading }: { settings?: WhatsAppSettings | null; loading?: boolean }) => {
  const connected = connectedStatus(settings);
  return (
    <div
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[16px] border px-3.5 text-xs font-black shadow-sm backdrop-blur-2xl",
        connected
          ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300"
          : "border-zinc-200/70 bg-white/70 text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-zinc-300",
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-500" : "bg-zinc-400")} />
      )}
      {connected ? "Conectado" : "Desconectado"}
    </div>
  );
};

const MessageStatus = ({ status, direction }: { status: string; direction: string }) => {
  if (direction === "inbound") return null;
  if (status === "read" || status === "delivered") return <CheckCheck className="h-3 w-3" />;
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

const infoCopy =
  "Conectar este WhatsApp Business permite que o Synapse responda pacientes, envie lembretes, apoie cobrancas e mantenha uma conversa operacional com voce. Recomendamos usar um chip exclusivo para o consultorio, nao o seu numero pessoal. Voce continua podendo intervir, assumir conversas e pausar o uso quando precisar.";

type ConnectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: WhatsAppSettings | null;
  loading: boolean;
  refreshStatus: ReturnType<typeof useWhatsAppAgent>["refreshStatus"];
  connect: ReturnType<typeof useWhatsAppAgent>["connect"];
  fullSync: ReturnType<typeof useWhatsAppAgent>["fullSync"];
};

function ConnectionDialog({
  open,
  onOpenChange,
  settings,
  loading,
  refreshStatus,
  connect,
  fullSync,
}: ConnectionDialogProps) {
  const connected = connectedStatus(settings);
  const connectPayload = connect.data as { connection?: Record<string, any> } | undefined;
  const connection = connectPayload?.connection;
  const qrValue =
    typeof connection?.base64 === "string"
      ? connection.base64
      : typeof connection?.qrcode?.base64 === "string"
        ? connection.qrcode.base64
        : typeof connection?.qrcode === "string"
          ? connection.qrcode
          : typeof connection?.code === "string"
            ? connection.code
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
      title="NeuroZap - Conectar WhatsApp Business"
      eyebrow="NeuroZap"
      description={
        <span className="inline-flex items-center justify-center gap-2">
          Ative o Synapse conectando seu WhatsApp Business.
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:text-white"
                  aria-label="Informacoes sobre o WhatsApp Business"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm text-left text-xs leading-relaxed">
                {infoCopy}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      }
      heroIcon={<ModalHeroIcon icon={MessageCircle} state={connected ? "success" : "neutral"} tone="status" ariaLabel="WhatsApp Business" />}
      footer={
        <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr]">
          <Button
            type="button"
            variant="outline"
            onClick={() => refreshStatus.mutate()}
            disabled={refreshStatus.isPending || loading}
            className="h-12 rounded-[18px] text-[10px] font-black uppercase tracking-[0.16em]"
          >
            {refreshStatus.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button
            type="button"
            onClick={() => (connected ? fullSync.mutate() : connect.mutate())}
            disabled={connect.isPending || fullSync.isPending}
            className="h-12 rounded-[18px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
          >
            {connect.isPending || fullSync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            {connected ? "Sincronizar conversas" : "Conectar"}
          </Button>
        </div>
      }
      size="lg"
      className="rounded-[34px] border-zinc-200/70 bg-white/95 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.6)] dark:border-white/[0.08] dark:bg-[#09090b]/95"
      bodyClassName="px-5 sm:px-8"
      footerClassName="px-5 sm:px-8"
    >
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[28px] border border-zinc-200/70 bg-zinc-50/70 p-5 shadow-sm backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.025]">
          <div className="pointer-events-none absolute inset-0 premium-noise opacity-[0.035]" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Canal dedicado</p>
              <h3 className="mt-1 text-xl font-black tracking-[-0.03em] text-zinc-950 dark:text-white">
                {connected ? "WhatsApp Business ativo" : "Aguardando conexao"}
              </h3>
            </div>
            <StatusPill settings={settings} loading={loading || refreshStatus.isPending} />
          </div>

          <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
            <InfoTile icon={ShieldCheck} label="Seguranca" value="Credenciais protegidas" />
            <InfoTile icon={LockKeyhole} label="Atendimento" value={settings?.psychologist_remote_jid ? "Numero identificado" : "Confirmacao pendente"} />
            <InfoTile icon={RefreshCw} label="Ultima sincronizacao" value={settings?.last_sync_at ? format(new Date(settings.last_sync_at), "dd/MM HH:mm") : "Ainda nao sincronizado"} />
            <InfoTile icon={Sparkles} label="Synapse" value={connected ? "Pronto para conversas" : "Conecte por QR Code"} />
          </div>

          {settings?.last_error ? (
            <div className="relative mt-4 rounded-[18px] border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
              {settings.last_error}
            </div>
          ) : null}
        </section>

        {qrValue && !connected ? (
          <section className="rounded-[28px] border border-zinc-200/70 bg-white/82 p-5 text-center shadow-sm backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.035]">
            {qrImageSrc ? (
              <img
                src={qrImageSrc}
                alt="QR Code de conexao do WhatsApp Business"
                className="mx-auto h-60 w-60 rounded-[24px] border border-zinc-200 bg-white p-4 shadow-xl"
              />
            ) : (
              <p className="break-all rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
                {qrValue}
              </p>
            )}
            <p className="mx-auto mt-4 max-w-md text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
              Abra o WhatsApp Business, acesse aparelhos conectados e leia este QR Code. Use preferencialmente um numero exclusivo do consultorio.
            </p>
          </section>
        ) : null}
      </div>
    </AppModalShell>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-zinc-200/70 bg-white/75 p-4 dark:border-white/[0.07] dark:bg-white/[0.035]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-black text-zinc-950 dark:text-white">{value}</span>
      </span>
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
  const patientCount = conversations.filter((conversation) => conversation.conversation_kind !== "psychologist").length;
  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);
  const connected = connectedStatus(settings);

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
    <div className="min-h-screen bg-[#f6f6f4] text-zinc-950 dark:bg-[#050507] dark:text-white">
      <ConnectionDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        loading={isLoadingSettings}
        refreshStatus={whatsapp.refreshStatus}
        connect={whatsapp.connect}
        fullSync={whatsapp.fullSync}
      />

      <main className="mx-auto flex min-h-screen w-full max-w-[1740px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[34px] border border-zinc-200/70 bg-white/76 px-5 py-5 shadow-[0_30px_100px_-72px_rgba(0,0,0,0.65)] backdrop-blur-3xl dark:border-white/[0.08] dark:bg-white/[0.025] sm:px-7">
          <div className="pointer-events-none absolute inset-0 premium-noise opacity-[0.035]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-[14px] border-zinc-300/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] dark:border-white/10">
                  Business
                </Badge>
                <StatusPill settings={settings} loading={isLoadingSettings || whatsapp.refreshStatus.isPending} />
              </div>
              <h1 className="mt-4 text-5xl font-black leading-[0.9] tracking-[-0.055em] sm:text-6xl">
                NeuroZap
              </h1>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
                Conversas do WhatsApp Business conectadas ao Synapse, com historico separado por profissional e pacientes.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[27rem]">
              <Button variant="outline" className="h-12 rounded-[18px] border-zinc-200 bg-white/70 text-[10px] font-black uppercase tracking-[0.16em] dark:border-white/10 dark:bg-white/[0.04]" onClick={() => whatsapp.fullSync.mutate()} disabled={!connected || whatsapp.fullSync.isPending}>
                {whatsapp.fullSync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sincronizar
              </Button>
              <Button className="h-12 rounded-[18px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Conectar WhatsApp Business
              </Button>
            </div>
          </div>
        </header>

        <section className="grid min-h-[calc(100dvh-12rem)] overflow-hidden rounded-[34px] border border-zinc-200/70 bg-white/76 shadow-[0_34px_110px_-78px_rgba(0,0,0,0.72)] backdrop-blur-3xl dark:border-white/[0.08] dark:bg-white/[0.02] lg:grid-cols-[24rem_minmax(0,1fr)]">
          <aside className={cn("min-h-0 border-r border-zinc-200/70 dark:border-white/[0.08]", showMobileChat ? "hidden lg:block" : "block")}>
            <div className="border-b border-zinc-200/70 p-4 dark:border-white/[0.08]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar conversa"
                  className="h-12 rounded-[20px] border-zinc-200/70 bg-zinc-50/70 pl-11 text-sm font-semibold shadow-inner dark:border-white/[0.08] dark:bg-white/[0.035]"
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-black text-zinc-500 dark:text-zinc-400">
                <MetricTile label="Conversas" value={conversations.length} />
                <MetricTile label="Pacientes" value={patientCount} />
                <MetricTile label="Nao lidas" value={unreadCount} />
              </div>
            </div>

            <ScrollArea className="h-[calc(100dvh-22rem)]">
              <div className="space-y-2 p-3">
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
                    icon={connected ? MessageCircle : WifiOff}
                    title={connected ? "Nenhuma conversa" : "WhatsApp Business desconectado"}
                    actionLabel={connected ? "Sincronizar" : "Conectar"}
                    onAction={() => (connected ? whatsapp.fullSync.mutate() : setSettingsOpen(true))}
                    loading={whatsapp.fullSync.isPending}
                  />
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className={cn("min-h-0", !selectedConversation && !showMobileChat ? "hidden lg:block" : "block")}>
            {selectedConversation ? (
              <div className="flex h-full min-h-[calc(100dvh-12rem)] flex-col">
                <ChatHeader
                  conversation={selectedConversation}
                  syncing={whatsapp.syncMessages.isPending}
                  onBack={() => {
                    setSelectedConversation(null);
                    setShowMobileChat(false);
                  }}
                  onSync={() => whatsapp.syncMessages.mutate({ remoteJid: selectedConversation.remote_jid })}
                />

                <ScrollArea className="min-h-0 flex-1 bg-zinc-50/55 px-3 py-5 dark:bg-black/10 sm:px-6">
                  <div className="mx-auto max-w-3xl space-y-3">
                    {isLoadingMessages ? (
                      <LoadingBlock label="Carregando mensagens" />
                    ) : Object.keys(groupedMessages).length ? (
                      Object.entries(groupedMessages).map(([date, dayMessages]) => (
                        <div key={date}>
                          <div className="my-5 flex justify-center">
                            <span className="rounded-[14px] border border-zinc-200/70 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-400">
                              {formatMessageDate(new Date(date))}
                            </span>
                          </div>
                          {dayMessages.map((message) => (
                            <MessageBubble key={message.id} message={message} />
                          ))}
                        </div>
                      ))
                    ) : (
                      <EmptyBlock
                        icon={MessageSquare}
                        title="Sem mensagens sincronizadas"
                        actionLabel="Atualizar"
                        onAction={() => whatsapp.syncMessages.mutate({ remoteJid: selectedConversation.remote_jid })}
                        loading={whatsapp.syncMessages.isPending}
                      />
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-zinc-200/70 bg-white/88 p-3 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#09090b]/92 sm:p-4">
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
                      className="min-h-[56px] resize-none rounded-[20px] border-zinc-200 bg-zinc-50/80 text-sm font-semibold shadow-inner dark:border-white/10 dark:bg-white/[0.04]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleSend}
                      disabled={!replyText.trim() || whatsapp.sendMessage.isPending}
                      className="h-[56px] w-[56px] shrink-0 rounded-[20px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      aria-label="Enviar mensagem"
                    >
                      {whatsapp.sendMessage.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[calc(100dvh-12rem)] items-center justify-center p-8">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] border border-zinc-200 bg-white text-zinc-950 shadow-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-white">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <h2 className="mt-6 text-3xl font-black tracking-[-0.05em]">Central NeuroZap</h2>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Selecione uma conversa para responder pelo WhatsApp Business ou conecte um numero dedicado ao Synapse.
                  </p>
                  <Button className="mt-6 h-12 rounded-[18px] bg-zinc-950 px-6 text-[10px] font-black uppercase tracking-[0.16em] text-white dark:bg-white dark:text-zinc-950" onClick={() => setSettingsOpen(true)}>
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

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <span className="block text-[9px] uppercase tracking-[0.18em]">{label}</span>
      <span className="mt-1 block text-lg text-zinc-950 dark:text-white">{value}</span>
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
  const isPsychologist = conversation.conversation_kind === "psychologist";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full gap-3 rounded-[24px] border p-3 text-left transition-all duration-200",
        selected
          ? "border-zinc-950 bg-zinc-950 text-white shadow-xl shadow-zinc-950/10 dark:border-white dark:bg-white dark:text-zinc-950"
          : "border-transparent bg-transparent hover:border-zinc-200/70 hover:bg-white/70 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.035]",
      )}
    >
      <Avatar className="h-12 w-12 rounded-[18px]">
        {conversation.profile_picture_url ? <AvatarImage src={conversation.profile_picture_url} /> : null}
        <AvatarFallback className="rounded-[18px] text-sm font-black">{isPsychologist ? <UserRound className="h-5 w-5" /> : getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-black">{name}</p>
          <span className={cn("shrink-0 text-[10px] font-bold", selected ? "text-current/60" : "text-zinc-400")}>
            {formatConversationTime(conversation.last_message_at)}
          </span>
        </div>
        <p className={cn("mt-1 truncate text-xs font-semibold", selected ? "text-current/65" : "text-zinc-500 dark:text-zinc-400")}>
          {conversation.last_message_preview || conversation.patient_phone}
        </p>
        <span className={cn("mt-2 inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]", selected ? "bg-white/10 text-current" : "bg-zinc-100 text-zinc-500 dark:bg-white/[0.05]")}>
          {isPsychologist ? "Voce e Synapse" : "Paciente"}
        </span>
      </div>
      {conversation.unread_count > 0 ? (
        <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black", selected ? "bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white" : "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950")}>
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
  const isPsychologist = conversation.conversation_kind === "psychologist";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/86 px-3 py-3 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#09090b]/88 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-11 w-11 rounded-[16px] lg:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-12 w-12 rounded-[18px]">
          {conversation.profile_picture_url ? <AvatarImage src={conversation.profile_picture_url} /> : null}
          <AvatarFallback className="rounded-[18px] text-sm font-black">{isPsychologist ? <UserRound className="h-5 w-5" /> : getInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-black sm:text-base">{name}</h2>
            <Badge variant="outline" className="hidden rounded-[12px] text-[9px] font-black uppercase tracking-[0.12em] sm:inline-flex">
              <Sparkles className="mr-1 h-3 w-3" />
              {isPsychologist ? "Profissional" : "Paciente"}
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <Phone className="h-3 w-3" />
            {conversation.patient_phone.replace("@s.whatsapp.net", "").replace(/@.*$/, "")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onSync} disabled={syncing} className="h-11 w-11 rounded-[16px]">
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar conversa</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-[16px]" aria-label="Mais opcoes">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: WAMessage }) {
  const outbound = message.direction === "outbound";
  const fromSynapse = message.sender_kind === "synapse" || message.is_from_ai;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mb-3 flex", outbound ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[82%] rounded-[26px] border px-4 py-3 text-sm shadow-sm sm:max-w-[68%]",
          outbound
            ? "rounded-br-[8px] border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
            : "rounded-bl-[8px] border-zinc-200/70 bg-white text-zinc-950 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white",
        )}
      >
        {fromSynapse ? (
          <span className={cn("mb-2 inline-flex text-[8px] font-black uppercase tracking-[0.16em]", outbound ? "text-current/55" : "text-zinc-400")}>
            Synapse
          </span>
        ) : null}
        <MediaMessage
          contentType={message.content_type}
          content={message.content}
          mediaBase64={message.media_base64}
          mediaMimetype={message.media_mimetype}
          mediaFilename={message.media_filename}
          direction={message.direction}
        />
        <div className={cn("mt-2 flex items-center gap-1.5 text-[10px] font-bold", outbound ? "justify-end text-current/60" : "text-zinc-400")}>
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
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
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
    <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-zinc-200/80 bg-zinc-50/55 p-6 text-center dark:border-white/[0.08] dark:bg-white/[0.025]">
      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
        <Icon className="h-5 w-5 text-zinc-500 dark:text-zinc-300" />
      </div>
      <h3 className="text-sm font-black">{title}</h3>
      <Button variant="outline" size="sm" className="h-10 rounded-[14px]" onClick={onAction} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {actionLabel}
      </Button>
    </div>
  );
}
