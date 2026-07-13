import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  LogOut,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  SlidersHorizontal,
  UserRound,
  WifiOff,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AppModalShell } from "@/components/ui/app-modal-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaMessage } from "@/components/whatsapp/MediaMessage";
import { useWhatsAppAgent, WAConversation, WAMessage, WhatsAppConnectResponse, WhatsAppSettings } from "@/hooks/use-whatsapp-agent";
import { cn } from "@/lib/utils";
import {
  formatRemoteJid as formatRemoteJidShared,
  identitiesIntersect,
  isLikelyPhoneDigits,
  isStatusJid,
  phoneDigitsFrom,
} from "@/lib/whatsapp-identity";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { SYNAPSE_PAGE_ACTION_EVENT, type SynapseInterfaceAction } from "@/lib/synapse-interface-actions";

const WHATSAPP_BUSINESS_LOGO = "/whatsapp-business-logo-white.png";

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
  if (!isLikelyPhoneDigits(digits)) return "Contato";
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    if (number.length === 9) return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
    if (number.length === 8) return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }
  if (digits.length >= 10) return digits.replace(/(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
  return cleanPhone || "Contato";
};

const formatRemoteJid = (...values: Array<string | null | undefined>) => {
  return formatRemoteJidShared(...values);
  return "Número não informado";
};

const isGroupConversation = (conversation: WAConversation) =>
  Boolean(conversation.is_group || conversation.contact_type === "group" || conversation.remote_jid?.includes("@g.us"));

const isStatusConversation = (conversation: WAConversation) => {
  const remote = String(conversation.remote_jid || "").toLowerCase();
  const name = String(conversation.patient_name || "").toLowerCase();
  return isStatusJid(remote) || name === "status";
};

const isOwnConversation = (conversation: WAConversation, settings?: WhatsAppSettings | null) =>
  conversation.conversation_kind === "psychologist" ||
  identitiesIntersect(
    [
      conversation.remote_jid,
      conversation.canonical_remote_jid,
      conversation.patient_phone,
      conversation.remote_jid_aliases,
      conversation.identity_key,
      conversation.identity_variants,
    ],
    [
      settings?.psychologist_remote_jid,
      settings?.psychologist_phone,
    ],
  );

const getConversationContactLine = (conversation: WAConversation) =>
  isGroupConversation(conversation) ? "Grupo do WhatsApp" : formatRemoteJid(conversation.patient_phone, conversation.remote_jid);

const truncateConversationPreview = (value?: string | null) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Sem prévia sincronizada";
  const words = normalized.split(" ").filter(Boolean);
  const short = words.slice(0, 5).join(" ");
  const clipped = short.length > 34 ? `${short.slice(0, 34).trim()}...` : short;
  return words.length > 5 || normalized.length > clipped.length ? `${clipped.replace(/\.+$/, "")}...` : clipped;
};

const getWhatsAppWebUrl = (conversation: WAConversation) => {
  const digits = phoneDigitsFrom(conversation.patient_phone, conversation.remote_jid);
  if (!digits) return "";
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
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

const disconnectedStates = ["close", "closed", "disconnected", "logout", "logged_out", "removed", "not_found", "invalid", "deleted"];
const pendingStates = ["created", "connecting", "qr", "qrcode", "pairing", "pending", "connecting_qr"];

const connectedStatus = (settings?: WhatsAppSettings | null) => {
  const state = String(settings?.connection_state || "").toLowerCase();
  if (["open", "connected"].includes(state)) return true;
  if (disconnectedStates.includes(state)) return false;
  return Boolean(settings?.is_active && settings?.instance_name);
};

const connectionState = (settings?: WhatsAppSettings | null) => {
  if (!settings?.instance_name) return "idle";
  if (connectedStatus(settings)) return "connected";
  const state = settings.connection_state?.toLowerCase();
  if (state && (pendingStates.includes(state) || !disconnectedStates.includes(state))) return "pending";
  return "disconnected";
};

const statusLabel = (settings?: WhatsAppSettings | null) => {
  const state = connectionState(settings);
  if (state === "connected") return "Conectado";
  if (state === "pending") return "Sincronização pendente";
  if (state === "disconnected") return "Desconectado";
  return "Sem primeira conexão";
};

const ConnectionDot = ({ settings, loading, className }: { settings?: WhatsAppSettings | null; loading?: boolean; className?: string }) => {
  const state = connectionState(settings);
  return (
    <span
      className={cn(
        "inline-flex h-3 w-3 shrink-0 rounded-full border",
        loading
          ? "animate-pulse border-zinc-400/40 bg-zinc-400/35"
          : state === "connected"
            ? "border-emerald-400/40 bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.35)]"
            : state === "pending"
              ? "border-amber-300/45 bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.28)]"
              : state === "disconnected"
                ? "border-red-400/40 bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.24)]"
                : "border-zinc-400/25 bg-zinc-400/20",
        className,
      )}
      aria-label={statusLabel(settings)}
      role="img"
    />
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
  "Conectar este WhatsApp Business permite que o Synapse responda pacientes, envie lembretes, apoie cobranças e mantenha uma conversa operacional com você. Recomendamos usar um chip exclusivo para o consultório, não o seu número pessoal. Você continua podendo intervir, assumir conversas e pausar o uso quando precisar.";

type ConnectionStep = "intro" | "qr" | "connected";

const normalizeConnectionQr = (connection: WhatsAppConnectResponse["connection"] | undefined) => {
  const node = connection as Record<string, any> | undefined;
  const qr =
    typeof node?.qr === "string"
      ? node.qr
      : typeof node?.base64 === "string"
        ? node.base64
        : typeof node?.qrcode?.base64 === "string"
          ? node.qrcode.base64
          : typeof node?.qrcode === "string"
            ? node.qrcode
            : typeof node?.code === "string"
              ? node.code
              : typeof node?.pairingCode === "string"
                ? node.pairingCode
                : null;

  const qrImageSrc =
    typeof node?.qrImageSrc === "string"
      ? node.qrImageSrc
      : qr?.startsWith("data:")
        ? qr
        : qr && qr.length > 120 && !/^https?:\/\//i.test(qr)
          ? `data:image/png;base64,${qr}`
          : null;

  return { qr, qrImageSrc };
};

type ConnectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings?: WhatsAppSettings | null;
  loading: boolean;
  refreshStatus: ReturnType<typeof useWhatsAppAgent>["refreshStatus"];
  connect: ReturnType<typeof useWhatsAppAgent>["connect"];
  fullSync: ReturnType<typeof useWhatsAppAgent>["fullSync"];
};

export function LegacyConnectionDialog({
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
      dataSynapseTarget="neurozap-connection"
      open={open}
      onOpenChange={onOpenChange}
      title="Conectar WhatsApp business"
      eyebrow="WhatsApp Business"
      description={
        <span className="inline-flex items-center justify-center gap-2">
          Ative o Synapse conectando seu WhatsApp Business.
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:text-white"
                  aria-label="Informações sobre o WhatsApp Business"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="z-[220] max-w-sm text-left text-xs leading-relaxed">
                {infoCopy}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      }
      heroIcon={
        <div className="group flex h-16 w-16 items-center justify-center bg-transparent">
          <img src={WHATSAPP_BUSINESS_LOGO} alt="WhatsApp Business" className="h-14 w-14 object-contain transition-transform duration-300 group-hover:scale-105" />
        </div>
      }
      footer={
        <div className="grid gap-2 sm:grid-cols-[0.8fr_1fr]">
          <Button
            type="button"
            variant="outline"
            onClick={() => refreshStatus.mutate({})}
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
      className="notes-liquid-surface rounded-[34px] border"
      bodyClassName="px-5 sm:px-8"
      footerClassName="px-5 sm:px-8"
    >
      <div className="space-y-4">
        <section className="notes-liquid-surface relative overflow-hidden rounded-[28px] border p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.12] dark:opacity-[0.18]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <h3 className="text-2xl font-black tracking-tight text-zinc-100 [.light_&]:text-zinc-950">
                {connected ? "WhatsApp Business conectado" : "Aguardando conexão"}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-500">
                {connected
                  ? "Seu número já está vinculado ao Synapse. Use sincronizar para atualizar conversas, contatos e histórico."
                  : "Leia o QR Code com um número dedicado do consultório para ativar a conversa assistida pelo Synapse."}
              </p>
            </div>
            {settings?.last_sync_at ? (
              <p className="shrink-0 text-right text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Atualizado em<br />
                <span className="text-zinc-300 [.light_&]:text-zinc-700">{format(new Date(settings.last_sync_at), "dd/MM HH:mm")}</span>
              </p>
            ) : null}
          </div>

          {settings?.last_error ? (
            <div className="relative mt-4 rounded-[18px] border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
              {settings.last_error}
            </div>
          ) : null}
        </section>

        {qrValue && !connected ? (
          <section className="notes-liquid-surface rounded-[28px] border p-5 text-center">
            {qrImageSrc ? (
              <img
                src={qrImageSrc}
                alt="QR Code de conexão do WhatsApp Business"
                className="mx-auto h-60 w-60 rounded-[24px] border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10"
              />
            ) : (
              <p className="break-all rounded-[22px] border border-white/[0.055] bg-white/[0.035] p-4 text-sm font-bold text-zinc-700 dark:text-zinc-200 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/80">
                {qrValue}
              </p>
            )}
            <p className="mx-auto mt-4 max-w-md text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
              Abra o WhatsApp Business, acesse aparelhos conectados e leia este QR Code. Use preferencialmente um número exclusivo do consultório.
            </p>
          </section>
        ) : null}
      </div>
    </AppModalShell>
  );
}

function ConnectionDialog({
  open,
  onOpenChange,
  settings,
  loading,
  refreshStatus,
  connect,
  fullSync,
}: ConnectionDialogProps) {
  const shouldReduceMotion = useReducedMotion();
  const connected = connectedStatus(settings);
  const [step, setStep] = useState<ConnectionStep>("intro");
  const startedConnectionRef = useRef(false);
  const autoSyncedRef = useRef(false);
  const autoCloseTimerRef = useRef<number | null>(null);
  const connectPayload = connect.data as WhatsAppConnectResponse | undefined;
  const { qr, qrImageSrc } = normalizeConnectionQr(connectPayload?.connection);
  const connectError = connect.error instanceof Error ? connect.error.message : "";
  const responseState = String(connectPayload?.state || settings?.connection_state || "").toLowerCase();
  const isConnectedStep = connected || step === "connected";
  const isQrStep = step === "qr" && !connected;
  const visibleError = connectError || (!isConnectedStep ? settings?.last_error || "" : "");
  const pendingQr = connect.isPending || (isQrStep && !qr && !connect.error);
  const syncingAfterConnect = fullSync.isPending && isConnectedStep;

  const progress = connect.isPending
    ? 24
    : isQrStep
      ? qr
        ? 52
        : 40
      : syncingAfterConnect
        ? 86
        : isConnectedStep
          ? 100
          : 12;

  const progressLabel = connect.isPending
    ? "Criando canal exclusivo"
    : isQrStep
      ? "Aguardando leitura do QR Code"
      : syncingAfterConnect
        ? "Sincronizando conversas"
        : isConnectedStep
          ? "WhatsApp Business conectado"
          : "Pronto para iniciar";

  useEffect(() => {
    if (!open) return;
    if (connected) {
      setStep("connected");
      return;
    }
    setStep(qr ? "qr" : "intro");
  }, [connected, open, qr]);

  useEffect(() => {
    if (!open) {
      startedConnectionRef.current = false;
      autoSyncedRef.current = false;
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open || connected || step !== "qr") return;
    const interval = window.setInterval(() => {
      refreshStatus.mutate({ silent: true });
    }, 2500);
    return () => window.clearInterval(interval);
  }, [connected, open, refreshStatus, step]);

  useEffect(() => {
    if (!open || !connected || !startedConnectionRef.current || autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    const startSync = window.setTimeout(() => {
      fullSync.mutate(undefined, {
        onSettled: () => {
          autoCloseTimerRef.current = window.setTimeout(() => {
            onOpenChange(false);
          }, shouldReduceMotion ? 350 : 950);
        },
      });
    }, shouldReduceMotion ? 0 : 250);
    return () => window.clearTimeout(startSync);
  }, [connected, fullSync, onOpenChange, open, shouldReduceMotion]);

  const handleConnect = () => {
    startedConnectionRef.current = true;
    autoSyncedRef.current = false;
    connect.mutate(undefined, {
      onSuccess: (data) => {
        const state = String(data?.state || "").toLowerCase();
        setStep(data?.connected || ["open", "connected"].includes(state) ? "connected" : "qr");
      },
    });
  };

  const transition = shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };
  const slideVariants = {
    enter: { opacity: 0, x: shouldReduceMotion ? 0 : 28 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: shouldReduceMotion ? 0 : -28 },
  };

  const footer = isConnectedStep ? (
    <Button
      type="button"
      onClick={() => fullSync.mutate()}
      disabled={fullSync.isPending || loading}
      className="h-11 w-full rounded-[16px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
    >
      {fullSync.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      Sincronizar conversas
    </Button>
  ) : isQrStep ? (
    <div className="grid gap-2 sm:grid-cols-[0.72fr_1fr]">
      <Button
        type="button"
        variant="outline"
        onClick={() => setStep("intro")}
        className="h-11 rounded-[16px] text-[10px] font-black uppercase tracking-[0.16em]"
      >
        Voltar
      </Button>
      <Button
        type="button"
        onClick={handleConnect}
        disabled={connect.isPending}
        className="h-11 rounded-[16px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
      >
        {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
        Gerar novo QR
      </Button>
    </div>
  ) : (
    <Button
      type="button"
      onClick={handleConnect}
      disabled={connect.isPending || loading}
      className="h-11 w-full rounded-[16px] bg-zinc-950 text-[10px] font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
    >
      {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
      {settings?.instance_name ? "Reconectar" : "Conectar"}
    </Button>
  );

  return (
    <AppModalShell
      dataSynapseTarget="neurozap-connection"
      open={open}
      onOpenChange={onOpenChange}
      title="Conectar WhatsApp Business"
      eyebrow="WhatsApp Business"
      description={
        <span className="inline-flex items-center justify-center gap-2">
          Ative o Synapse conectando seu WhatsApp Business.
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:text-white"
                  aria-label="Informações sobre o WhatsApp Business"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="z-[320] max-w-sm text-left text-xs leading-relaxed">
                {infoCopy}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      }
      heroIcon={
        <div className="group flex h-12 w-12 items-center justify-center bg-transparent">
          <img
            src={WHATSAPP_BUSINESS_LOGO}
            alt="WhatsApp Business"
            className="h-11 w-11 object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      }
      footer={footer}
      size="md"
      className="notes-liquid-surface rounded-[28px] border"
      bodyClassName="px-4 py-2 sm:px-5"
      footerClassName="px-4 py-3 sm:px-5"
      headerClassName="pt-5 pb-2 sm:pt-6"
    >
      <div className="relative min-h-[13.5rem] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={isConnectedStep ? "connected" : step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            className="space-y-4"
          >
            {isConnectedStep ? (
              <div className="notes-liquid-surface relative overflow-hidden rounded-[22px] border p-5 text-center">
                <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.1] dark:opacity-[0.16]" />
                <div className="relative mx-auto max-w-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Conexão pronta</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-100 [.light_&]:text-zinc-950">WhatsApp Business conectado</h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-500">
                    Seu número já está vinculado ao Synapse. As conversas serão atualizadas automaticamente quando novos eventos chegarem.
                  </p>
                  {settings?.last_sync_at ? (
                    <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Última sincronização · <span className="text-zinc-300 [.light_&]:text-zinc-700">{format(new Date(settings.last_sync_at), "dd/MM HH:mm")}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : isQrStep ? (
              <div className="notes-liquid-surface relative overflow-hidden rounded-[22px] border p-4 text-center sm:p-5">
                <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.1] dark:opacity-[0.16]" />
                <div className="relative mx-auto max-w-md">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Leitura do QR Code</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-100 [.light_&]:text-zinc-950">Aponte a câmera do WhatsApp</h3>
                  <div className="mt-4 flex min-h-[14rem] items-center justify-center rounded-[22px] border border-zinc-200/70 bg-white/80 p-3 shadow-[0_24px_60px_-42px_rgba(0,0,0,0.5)] dark:border-white/[0.08] dark:bg-white/[0.035]">
                    {qrImageSrc ? (
                      <img
                        src={qrImageSrc}
                        alt="QR Code de conexão do WhatsApp Business"
                        className="h-56 w-56 rounded-[18px] bg-white p-3"
                      />
                    ) : qr ? (
                      <p className="max-h-64 overflow-y-auto break-all rounded-[22px] border border-white/[0.055] bg-white/[0.035] p-4 text-sm font-bold text-zinc-700 dark:text-zinc-200 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/80">
                        {qr}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-zinc-500">
                        <Loader2 className="h-7 w-7 animate-spin" />
                        <p className="text-sm font-bold">Gerando QR Code seguro...</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-xs font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    No WhatsApp Business, abra aparelhos conectados e leia este QR Code. Use preferencialmente um número exclusivo do consultório.
                  </p>
                  {pendingQr || responseState ? (
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      {pendingQr ? "Aguardando QR" : `Estado: ${responseState}`}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="notes-liquid-surface relative overflow-hidden rounded-[22px] border p-5 text-center">
                <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.1] dark:opacity-[0.16]" />
                <div className="relative mx-auto max-w-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Canal dedicado</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-100 [.light_&]:text-zinc-950">
                    Conecte o WhatsApp Business ao Synapse
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-zinc-500">
                    A próxima etapa gera um QR Code exclusivo para este profissional. Depois da leitura, o NeuroZap sincroniza contatos, conversas e histórico.
                  </p>
                </div>
              </div>
            )}

            {visibleError ? (
              <div className="rounded-[18px] border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
                {visibleError}
              </div>
            ) : null}
          </motion.section>
        </AnimatePresence>

        {(connect.isPending || isQrStep || isConnectedStep) ? (
          <div className="mt-4 rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-3 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/70">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/80 [.light_&]:bg-zinc-200">
              <motion.div
                className="h-full rounded-full bg-white [.light_&]:bg-zinc-950"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              {progressLabel}
            </p>
          </div>
        ) : null}
      </div>
    </AppModalShell>
  );
}

export default function NeuroZap() {
  const location = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<WAConversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSyncRequestsRef = useRef<Set<string>>(new Set());

  const whatsapp = useWhatsAppAgent();
  const { data: settings, isLoading: isLoadingSettings } = whatsapp.useSettings();
  const connected = connectedStatus(settings);
  const activeConversationId = connected ? selectedConversation?.id : undefined;
  const activeRemoteJid = connected ? selectedConversation?.remote_jid : undefined;
  const { data: conversations = [], isLoading: isLoadingConversations } = whatsapp.useConversations(connected);
  const { data: messages = [], isLoading: isLoadingMessages } = whatsapp.useMessages(activeConversationId, activeRemoteJid, connected);
  whatsapp.useRealtime(activeConversationId, connected);

  const visibleConversations = useMemo(() => {
    if (!connected) return [];
    return conversations
      .filter((conversation) => !isStatusConversation(conversation))
      .sort((a, b) => {
        const aOwn = isOwnConversation(a, settings);
        const bOwn = isOwnConversation(b, settings);
        if (aOwn !== bOwn) return aOwn ? -1 : 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });
  }, [connected, conversations, settings]);

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visibleConversations;
    return visibleConversations.filter((conversation) => {
      const name = formatDisplayName(conversation.patient_name, conversation.patient_phone).toLowerCase();
      const contactLine = getConversationContactLine(conversation).toLowerCase();
      return (
        name.includes(query) ||
        contactLine.includes(query) ||
        String(conversation.patient_phone || "").toLowerCase().includes(query) ||
        String(conversation.remote_jid || "").toLowerCase().includes(query)
      );
    });
  }, [visibleConversations, searchQuery]);

  const unreadCount = visibleConversations.reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0);
  const patientCount = visibleConversations.filter((conversation) => !isOwnConversation(conversation, settings) && !isGroupConversation(conversation)).length;
  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);
  const panelRefreshPending = whatsapp.syncPanel.isPending;

  const handlePanelRefresh = () => {
    if (!connected) {
      setSettingsOpen(true);
      return;
    }
    whatsapp.syncPanel.mutate({ remoteJid: selectedConversation?.remote_jid });
  };

  useEffect(() => {
    whatsapp.refreshStatus.mutate({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.state?.synapseDestination === "neurozap.connection") {
      setSettingsOpen(true);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.pathname, location.state]);

  useEffect(() => {
    const handleSynapseAction = (event: Event) => {
      const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
      if (action?.destination === "neurozap.connection") setSettingsOpen(true);
    };
    window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
  }, []);

  useEffect(() => {
    if (!connected && selectedConversation) {
      setSelectedConversation(null);
      setShowMobileChat(false);
    }
  }, [connected, selectedConversation]);

  useEffect(() => {
    if (!connected) return;
    if (!selectedConversation || isLoadingMessages || messages.length > 0 || whatsapp.syncMessages.isPending) return;
    if (!selectedConversation.last_message_preview) return;
    if (autoSyncRequestsRef.current.has(selectedConversation.id)) return;
    autoSyncRequestsRef.current.add(selectedConversation.id);
    whatsapp.syncMessages.mutate({ remoteJid: selectedConversation.remote_jid, silent: true });
  }, [
    isLoadingMessages,
    messages.length,
    connected,
    selectedConversation,
    whatsapp.syncMessages,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConversation = (conversation: WAConversation) => {
    if (!connected) {
      setSettingsOpen(true);
      return;
    }
    setSelectedConversation(conversation);
    setShowMobileChat(true);
    if (conversation.unread_count > 0) whatsapp.markAsRead.mutate(conversation.id);
    whatsapp.syncMessages.mutate({ remoteJid: conversation.remote_jid, silent: true });
  };

  const handleSend = () => {
    if (!replyText.trim() || !selectedConversation || !connected) {
      if (!connected) setSettingsOpen(true);
      return;
    }
    whatsapp.sendMessage.mutate({
      conversationId: selectedConversation.id,
      remoteJid: selectedConversation.remote_jid,
      message: replyText.trim(),
    });
    setReplyText("");
  };

  return (
    <div data-synapse-target="neurozap-overview" className="notes-lumen-canvas relative z-0 min-h-screen w-full bg-transparent font-sans text-foreground selection:bg-primary/20">
      <div className="notes-lumen-field pointer-events-none fixed inset-0 z-0" />
      <ConnectionDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        loading={isLoadingSettings}
        refreshStatus={whatsapp.refreshStatus}
        connect={whatsapp.connect}
        fullSync={whatsapp.fullSync}
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1740px] flex-col gap-5 px-4 pb-5 pt-28 sm:px-6 lg:px-8">
        <header className="notes-toolbar-surface relative overflow-hidden rounded-[28px] border px-4 py-3 sm:px-5">
          <div className="pointer-events-none absolute inset-0 notes-retina-texture opacity-[0.12] dark:opacity-[0.18]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="text-3xl font-black leading-none tracking-tight text-zinc-100 [.light_&]:text-zinc-950 sm:text-4xl">
                NeuroZap
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-[14px] border-zinc-300/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] dark:border-white/10">
                  Business
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.055] bg-white/[0.035] [.light_&]:border-zinc-200/70 [.light_&]:bg-white/75">
                        <ConnectionDot settings={settings} loading={isLoadingSettings || whatsapp.refreshStatus.isPending} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{statusLabel(settings)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-11 w-11 rounded-[16px] border-white/[0.06] bg-white/[0.035] text-zinc-300 hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200/70 [.light_&]:bg-white/75 [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950" onClick={handlePanelRefresh} disabled={!connected || panelRefreshPending} aria-label="Atualizar painel NeuroZap">
                      {panelRefreshPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atualizar painel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {!connected ? (
                <Button className="h-11 rounded-[16px] bg-white px-5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-950 shadow-[0_16px_36px_-24px_rgba(255,255,255,0.7)] hover:bg-zinc-200 [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_16px_36px_-24px_rgba(0,0,0,0.4)]" onClick={() => setSettingsOpen(true)}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Conectar
                </Button>
              ) : null}
              {connected ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-[16px] border-white/[0.06] bg-white/[0.035] text-zinc-300 hover:bg-white/[0.08] hover:text-white [.light_&]:border-zinc-200/70 [.light_&]:bg-white/75 [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-100 [.light_&]:hover:text-zinc-950"
                        onClick={() => whatsapp.disconnect.mutate()}
                        disabled={whatsapp.disconnect.isPending}
                        aria-label="Desconectar WhatsApp Business"
                      >
                        {whatsapp.disconnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Desconectar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          </div>
        </header>

        <section
          className={cn(
            "notes-liquid-surface grid h-[calc(100dvh-15rem)] min-h-[34rem] max-h-[calc(100dvh-10rem)] max-w-full overflow-hidden rounded-[34px] border transition-[grid-template-columns] duration-300",
            isListCollapsed ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]" : "lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]",
          )}
        >
          <aside className={cn("notes-retina-rail flex min-h-0 flex-col border-r", showMobileChat ? "hidden lg:flex" : "flex")}>
            <div className={cn("border-b border-white/[0.045] p-4 [.light_&]:border-zinc-200/60", isListCollapsed && "p-2")}>
              <div className={cn("mb-3 flex items-center justify-between gap-2", isListCollapsed && "mb-0 justify-center")}>
                {!isListCollapsed ? (
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.26em] text-zinc-500">Conversas</p>
                    <p className="mt-1 truncate text-lg font-black tracking-tight">WhatsApp Business</p>
                  </div>
                ) : null}
                <div className={cn("flex items-center gap-2", isListCollapsed && "flex-col")}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-[14px]"
                          onClick={() => setIsListCollapsed((current) => !current)}
                          aria-label={isListCollapsed ? "Expandir lista de conversas" : "Recolher lista de conversas"}
                        >
                          {isListCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isListCollapsed ? "Expandir" : "Recolher"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div className={cn("relative", isListCollapsed && "hidden")}>
                <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600 transition-colors [.light_&]:text-zinc-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar conversa"
                  className="h-11 rounded-xl border-white/[0.055] bg-white/[0.03] pl-10 text-xs font-semibold text-zinc-200 placeholder:text-zinc-600 focus-visible:border-white/15 focus-visible:ring-0 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/80 [.light_&]:text-zinc-900 [.light_&]:placeholder:text-zinc-400 [.light_&]:focus-visible:border-zinc-300"
                />
              </div>
              <div className={cn("mt-4 grid grid-cols-3 gap-2 text-xs font-black text-zinc-500 dark:text-zinc-400", isListCollapsed && "hidden")}>
                <MetricTile label="Conversas" value={visibleConversations.length} />
                <MetricTile label="Pacientes" value={patientCount} />
                <MetricTile label="Não lidas" value={unreadCount} />
              </div>
            </div>

            <ScrollArea className="notes-scroll-surface min-h-0 flex-1">
              <div className={cn("space-y-2 p-3", isListCollapsed && "px-2")}>
                {isLoadingConversations ? (
                  <LoadingBlock label="Carregando conversas" />
                ) : filteredConversations.length ? (
                  filteredConversations.map((conversation) => (
                    <ConversationRow
                      key={conversation.id}
                      conversation={conversation}
                      settings={settings}
                      selected={selectedConversation?.id === conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      compact={isListCollapsed}
                    />
                  ))
                ) : (
                  <EmptyBlock
                    icon={connected ? MessageCircle : WifiOff}
                    title={connected ? "Nenhuma conversa" : "WhatsApp Business desconectado"}
                    actionLabel={connected ? "Atualizar painel" : "Conectar"}
                    onAction={handlePanelRefresh}
                    loading={panelRefreshPending}
                  />
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className={cn("h-full min-h-0 min-w-0 overflow-hidden", !selectedConversation && !showMobileChat ? "hidden lg:block" : "block")}>
            {selectedConversation ? (
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <ChatHeader
                  conversation={selectedConversation}
                  settings={settings}
                  onBack={() => {
                    setSelectedConversation(null);
                    setShowMobileChat(false);
                  }}
                  onMarkAsRead={() => whatsapp.markAsRead.mutate(selectedConversation.id)}
                />

                <ScrollArea className="notes-scroll-surface h-full min-h-0 flex-1 bg-transparent px-3 py-5 sm:px-6">
                  <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end space-y-3">
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
                        actionLabel="Atualizar painel"
                        onAction={handlePanelRefresh}
                        loading={panelRefreshPending}
                      />
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="notes-retina-rail shrink-0 border-t p-3 sm:p-4">
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
                      className="min-h-[56px] resize-none rounded-[20px] border-white/[0.055] bg-white/[0.03] text-sm font-semibold text-zinc-200 placeholder:text-zinc-600 focus-visible:border-white/15 focus-visible:ring-0 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/80 [.light_&]:text-zinc-900 [.light_&]:placeholder:text-zinc-400"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleSend}
                      disabled={!replyText.trim() || whatsapp.sendMessage.isPending}
                      className="h-[56px] w-[56px] shrink-0 rounded-[20px] bg-white text-zinc-950 shadow-[0_16px_36px_-24px_rgba(255,255,255,0.7)] hover:bg-zinc-200 [.light_&]:bg-zinc-950 [.light_&]:text-white"
                      aria-label="Enviar mensagem"
                    >
                      {whatsapp.sendMessage.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 w-full items-center justify-center p-8">
                <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
                  <div className="group/gate relative flex w-full justify-center">
                    <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border border-white/[0.05] bg-black/20 shadow-[0_36px_90px_-48px_rgba(255,255,255,0.32)] backdrop-blur-3xl transition-transform duration-500 group-hover/gate:scale-[1.025] [.light_&]:border-zinc-200/50 [.light_&]:bg-zinc-950/[0.9] [.light_&]:shadow-[0_34px_70px_-46px_rgba(0,0,0,0.18)]">
                      <div className="absolute inset-0 notes-retina-texture opacity-[0.4] pointer-events-none [.light_&]:opacity-[0.2]" />
                      <img src={WHATSAPP_BUSINESS_LOGO} alt="" className="h-20 w-20 object-contain transition-all duration-700 group-hover/gate:scale-110" />
                    </div>
                  </div>
                  <h2 className="mt-8 text-4xl font-black tracking-[-0.05em]">Central NeuroZap</h2>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Selecione uma conversa para responder pelo WhatsApp Business ou conecte um número dedicado ao Synapse.
                  </p>
                  <Button className="mt-8 h-14 rounded-[22px] bg-white px-8 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-950 hover:bg-zinc-200 [.light_&]:bg-zinc-950 [.light_&]:text-white" onClick={handlePanelRefresh}>
                    {connected ? null : <SlidersHorizontal className="mr-2 h-4 w-4" />}
                    {connected ? "Atualizar painel" : "Conectar"}
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
    <div className="notes-liquid-surface rounded-[18px] border px-4 py-3">
      <span className="block text-[9px] uppercase tracking-[0.18em]">{label}</span>
      <span className="mt-1 block text-lg text-zinc-950 dark:text-white">{value}</span>
    </div>
  );
}

function ConversationRow({
  conversation,
  settings,
  selected,
  onClick,
  compact = false,
}: {
  conversation: WAConversation;
  settings?: WhatsAppSettings | null;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const isPsychologist = isOwnConversation(conversation, settings);
  const isGroup = isGroupConversation(conversation);
  const name = isPsychologist ? "Você e Synapse" : formatDisplayName(conversation.patient_name, conversation.patient_phone);
  const contactLine = getConversationContactLine(conversation);
  const preview = truncateConversationPreview(conversation.last_message_preview);
  const badge = isPsychologist ? "Você" : isGroup ? "Grupo" : "Paciente";
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClick}
              className={cn(
                "group relative flex h-14 w-full items-center justify-center rounded-[18px] border transition-colors duration-200",
                selected
                  ? "border-white bg-white text-zinc-950 [.light_&]:border-zinc-950 [.light_&]:bg-zinc-950 [.light_&]:text-white"
                  : "border-white/[0.045] bg-white/[0.018] text-zinc-300 hover:border-white/[0.09] hover:bg-white/[0.045] [.light_&]:border-zinc-200/60 [.light_&]:bg-white/55 [.light_&]:text-zinc-700 [.light_&]:hover:bg-white",
              )}
              aria-label={name}
            >
              <Avatar className="h-10 w-10 rounded-[16px]">
                {conversation.profile_picture_url ? <AvatarImage src={conversation.profile_picture_url} /> : null}
                <AvatarFallback className="rounded-[16px] text-xs font-black">
                  {isPsychologist ? <UserRound className="h-4 w-4" /> : getInitials(name)}
                </AvatarFallback>
              </Avatar>
              {conversation.unread_count > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-foreground" /> : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-64">
            <div className="space-y-1">
              <p className="font-bold">{name}</p>
              <p className="text-xs text-muted-foreground">{contactLine}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-w-0 max-w-full gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-colors duration-200",
        selected
          ? "border-white/10 bg-white text-zinc-950 shadow-[0_18px_42px_-26px_rgba(255,255,255,0.5)] [.light_&]:border-zinc-950 [.light_&]:bg-zinc-950 [.light_&]:text-white [.light_&]:shadow-[0_18px_42px_-26px_rgba(0,0,0,0.45)]"
          : "border-white/[0.045] bg-white/[0.018] text-zinc-300 hover:border-white/[0.09] hover:bg-white/[0.045] [.light_&]:border-zinc-200/60 [.light_&]:bg-white/55 [.light_&]:text-zinc-700 [.light_&]:hover:border-zinc-300 [.light_&]:hover:bg-white",
      )}
    >
      <Avatar className="h-12 w-12 shrink-0 rounded-[18px]">
        {conversation.profile_picture_url ? <AvatarImage src={conversation.profile_picture_url} /> : null}
        <AvatarFallback className="rounded-[18px] text-sm font-black">{isPsychologist ? <UserRound className="h-5 w-5" /> : getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-black">{name}</p>
          <span className={cn("shrink-0 text-[10px] font-bold", selected ? "text-current/60" : "text-zinc-400")}>
            {formatConversationTime(conversation.last_message_at)}
          </span>
        </div>
        <p className={cn("mt-1 flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-[11px] font-bold", selected ? "text-current/60" : "text-zinc-500 dark:text-zinc-400")}>
          <Phone className="h-3 w-3 shrink-0" />
          <span className="block min-w-0 truncate">{contactLine}</span>
        </p>
        <p className={cn("mt-1 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold", selected ? "text-current/65" : "text-zinc-500 dark:text-zinc-400")} title={conversation.last_message_preview || preview}>
          {preview}
        </p>
        <span className={cn("mt-2 inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]", selected ? "bg-white/10 text-current" : "bg-zinc-100 text-zinc-500 dark:bg-white/[0.05]")}>
          {badge}
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
  settings,
  onBack,
  onMarkAsRead,
}: {
  conversation: WAConversation;
  settings?: WhatsAppSettings | null;
  onBack: () => void;
  onMarkAsRead: () => void;
}) {
  const isPsychologist = isOwnConversation(conversation, settings);
  const isGroup = isGroupConversation(conversation);
  const name = isPsychologist ? "Você e Synapse" : formatDisplayName(conversation.patient_name, conversation.patient_phone);
  const badge = isPsychologist ? "Você" : isGroup ? "Grupo" : "Paciente";
  const contactLine = getConversationContactLine(conversation);
  const whatsappWebUrl = getWhatsAppWebUrl(conversation);
  const hasPhoneNumber = Boolean(phoneDigitsFrom(conversation.patient_phone, conversation.remote_jid));
  const copyText = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("N\u00e3o foi poss\u00edvel copiar.");
    }
  };

  return (
    <div className="notes-retina-rail flex items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
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
              {badge}
            </Badge>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <Phone className="h-3 w-3" />
            {contactLine}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-[16px]" aria-label="Mais opções">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 rounded-2xl border-white/[0.08] bg-zinc-950/95 p-2 text-zinc-100 shadow-2xl backdrop-blur-xl [.light_&]:border-zinc-200 [.light_&]:bg-white [.light_&]:text-zinc-950"
          >
            <DropdownMenuItem className="rounded-xl" onClick={onMarkAsRead}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Marcar como lida
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.08] [.light_&]:bg-zinc-200" />
            <DropdownMenuItem className="rounded-xl" disabled={!hasPhoneNumber} onClick={() => copyText(contactLine, "Número")}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar número
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-xl"
              disabled={!whatsappWebUrl}
              onClick={() => {
                if (!whatsappWebUrl) {
                  toast.error("Número indisponível para abrir no WhatsApp Web.");
                  return;
                }
                window.open(whatsappWebUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir no WhatsApp
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.08] [.light_&]:bg-zinc-200" />
            <DropdownMenuItem className="rounded-xl" onClick={() => copyText(conversation.remote_jid, "Identificador")}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar ID técnico
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            ? "rounded-br-[8px] border-white bg-white text-zinc-950 shadow-[0_18px_42px_-26px_rgba(255,255,255,0.5)] [.light_&]:border-zinc-950 [.light_&]:bg-zinc-950 [.light_&]:text-white"
            : "rounded-bl-[8px] border-white/[0.055] bg-white/[0.035] text-zinc-100 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/80 [.light_&]:text-zinc-950",
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
          mediaUrl={message.media_url}
          metadata={message.metadata}
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
    <div className="notes-liquid-surface flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/[0.055] bg-white/[0.035] shadow-sm [.light_&]:border-zinc-200/70 [.light_&]:bg-white">
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
