import { VoiceSpiral } from "@/components/ai-chat/VoiceSpiral";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  firstString,
  isRecord,
  normalizeSynapseDataArray,
  normalizeSynapseWidgetType,
  parseSynapseWidgetFromContent,
  unwrapSynapseToolResponse,
  type SynapseWidgetData,
} from "@/lib/synapse-widget-parser";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Calendar,
  Check,
  Copy,
  FileText,
  Loader2,
  Mic,
  MicOff,
  RefreshCcw,
  Sparkles,
  User,
  Volume2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";

export const mobileSynapseInputClassName =
  "mt-2 h-[52px] w-full rounded-[17px] border border-border/50 bg-card px-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground/42 focus:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/12 dark:border-white/10 dark:bg-white/[0.035]";

const mobileMaterialSurfaceClassName =
  "border border-border/45 bg-card/84 shadow-[0_18px_52px_-42px_hsl(var(--foreground)/0.55),inset_0_1px_0_hsl(var(--background)/0.62)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.04]";

const mobileInsetSurfaceClassName =
  "border border-border/42 bg-background/66 shadow-[inset_0_1px_0_hsl(var(--background)/0.58)] dark:border-white/10 dark:bg-white/[0.045]";

const mobileIconSurfaceClassName =
  "border border-border/42 bg-muted/56 text-muted-foreground shadow-inner dark:border-white/10 dark:bg-white/[0.06]";

export function MobileSynapseEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/58", className)}>
      {children}
    </p>
  );
}

export function MobileSynapseMark({
  className,
  active = false,
}: {
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[17px] border",
        mobileMaterialSurfaceClassName,
        "text-foreground",
        active && "border-foreground/20 bg-foreground text-background dark:border-white/20 dark:bg-white dark:text-zinc-950",
        className,
      )}
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-px bg-white/80 dark:bg-white/20" />
      <BrainCircuit className="relative h-[48%] w-[48%]" strokeWidth={1.8} />
    </div>
  );
}

export function MobileSynapseIconButton({
  icon: Icon,
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-95",
        mobileMaterialSurfaceClassName,
        className,
      )}
      {...props}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

export function MobileSynapseButton({
  children,
  className,
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "light" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[15px] px-4 text-[9px] font-black uppercase tracking-[0.14em] transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
        variant === "primary" && "bg-foreground text-background shadow-sm",
        variant === "secondary" && "border border-border/45 bg-card/78 text-foreground dark:border-white/10 dark:bg-white/[0.04]",
        variant === "ghost" && "bg-transparent text-muted-foreground active:bg-foreground/[0.045]",
        variant === "light" && "bg-background text-foreground hover:bg-background/90",
        variant === "danger" && "border border-rose-500/20 bg-rose-500/[0.07] text-rose-600 dark:text-rose-300",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function MobileSynapseHero({
  modeLabel,
  title,
  description,
  status,
}: {
  modeLabel: string;
  title: string;
  description: string;
  status: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[26px] p-5 text-foreground", mobileMaterialSurfaceClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <MobileSynapseEyebrow>{modeLabel}</MobileSynapseEyebrow>
          <h1 className="mt-2 text-[2.28rem] font-black leading-[0.9] tracking-[-0.065em] text-foreground">
            {title}
          </h1>
        </div>
        <MobileSynapseMark className="h-12 w-12" active />
      </div>
      <p className="mt-4 text-xs font-semibold leading-relaxed text-muted-foreground/78">
        {description}
      </p>
      <div className={cn("mt-5 inline-flex items-center gap-2 rounded-full px-3 py-2", mobileInsetSurfaceClassName)}>
        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
        <span className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">{status}</span>
      </div>
    </section>
  );
}

export function MobileSynapsePromptCard({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex min-h-[112px] flex-col items-start justify-between rounded-[22px] p-4 text-left transition active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100", mobileMaterialSurfaceClassName)}
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-[14px]", mobileIconSurfaceClassName)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="text-[13px] font-black leading-tight tracking-[-0.015em] text-foreground">{label}</p>
    </button>
  );
}

export function MobileSynapseSessionRow({
  title,
  description,
  active,
  onClick,
  onDelete,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[20px] border p-3.5",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/40 bg-card/72 text-foreground dark:border-white/10 dark:bg-white/[0.03]",
      )}
    >
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] font-black tracking-[-0.015em]">{title}</p>
        <p className={cn("mt-1 text-[9px] font-medium", active ? "text-background/58" : "text-muted-foreground/62")}>
          {description}
        </p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] transition active:scale-95",
          active ? "bg-background/10 text-background/72" : "bg-foreground/[0.045] text-muted-foreground",
        )}
        aria-label="Excluir conversa"
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
  );
}

type RichAction = {
  type: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" ? value as Record<string, unknown> : undefined;

const normalizeRichAction = (richData: unknown): RichAction | null => {
  if (!richData || typeof richData !== "object") return null;
  const candidate = richData as Record<string, unknown>;
  const type = typeof candidate.type === "string"
    ? candidate.type
    : typeof candidate.__actionType === "string"
      ? candidate.__actionType
      : null;
  if (typeof type !== "string" || !type) return null;
  return { type, data: toRecord(candidate.data), payload: toRecord(candidate.payload) };
};

const actionMeta = (type: string): { title: string; description: string; icon: LucideIcon; path?: string } => {
  const normalized = type.toLowerCase();
  if (normalized.includes("appointment") || normalized.includes("agenda")) {
    return { title: "Agenda", description: "Abrir compromissos relacionados.", icon: Calendar, path: "/agenda" };
  }
  if (normalized.includes("invoice") || normalized.includes("financial")) {
    return { title: "Financeiro", description: "Abrir informações financeiras.", icon: Wallet, path: "/financeiro" };
  }
  if (normalized.includes("document")) {
    return { title: "Documento", description: "Documento preparado pelo Synapse.", icon: FileText };
  }
  return { title: type.replace(/_/g, " "), description: "Ação preparada pelo Synapse.", icon: Sparkles };
};

export function MobileSynapseActionCard({ action }: { action: RichAction }) {
  const navigate = useNavigate();
  const payload = action.payload || action.data || {};
  const meta = actionMeta(action.type);
  const Icon = meta.icon;
  const rawEntityId = payload.id || payload.patient_id || payload.appointment_id;
  const entityId = typeof rawEntityId === "string" ? rawEntityId : undefined;
  const path = entityId && action.type.includes("patient")
    ? `/pacientes/${entityId}`
    : meta.path;

  return (
    <button
      type="button"
      onClick={() => path ? navigate(path) : undefined}
      className={cn("mt-3 flex w-full items-center gap-3 rounded-[19px] p-3.5 text-left transition active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100", mobileInsetSurfaceClassName)}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]", mobileIconSurfaceClassName)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-black capitalize tracking-[-0.01em] text-foreground">{meta.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-relaxed text-muted-foreground/66">{meta.description}</p>
      </div>
      {path ? <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/35" /> : null}
    </button>
  );
}

const formatMobileCurrency = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const toMobileTime = (value: unknown) => {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const mobileWidgetActionLabel = (type: string) => {
  const normalized = normalizeSynapseWidgetType(type);
  const labels: Record<string, string> = {
    create_appointment: "Agendamento criado",
    send_email: "E-mail enviado",
    create_invoice: "Cobrança gerada",
    update_patient: "Paciente atualizado",
    create_patient: "Paciente cadastrado",
    generate_document: "Documento gerado",
    clinical_history: "Prontuário atualizado",
  };
  return labels[normalized] || normalized.replace(/_/g, " ");
};

const getMobileWidgetTarget = (type: string, data: unknown) => {
  const normalized = normalizeSynapseWidgetType(type);
  const record = isRecord(data) ? data : {};
  const nestedAppointment = isRecord(record.appointment) ? record.appointment : undefined;
  const nestedPatient = isRecord(record.patient) ? record.patient : undefined;

  if (normalized.includes("appointment") || normalized.includes("agenda") || normalized.includes("calendar")) {
    const id = firstString(record.appointment_id, nestedAppointment?.id, record.id);
    return {
      path: id ? `/agenda?appointmentId=${encodeURIComponent(id)}` : "/agenda",
      state: id ? { openAppointmentId: id } : undefined,
    };
  }

  if (normalized.includes("patient") || normalized.includes("paciente") || normalized.includes("risk")) {
    const id = firstString(record.patient_id, nestedPatient?.id, record.id);
    return { path: id ? `/pacientes/${id}` : "/pacientes" };
  }

  if (normalized.includes("invoice") || normalized.includes("payment") || normalized.includes("finance")) {
    return { path: "/financeiro" };
  }

  if (normalized.includes("document") || normalized.includes("history") || normalized.includes("prontuario")) {
    return { path: "/notas" };
  }

  return { path: "/dashboard" };
};

const mobileWidgetMeta = (type: string): { title: string; icon: LucideIcon } => {
  const normalized = normalizeSynapseWidgetType(type);
  if (normalized.includes("patient") || normalized.includes("paciente") || normalized.includes("risk")) return { title: "Paciente", icon: User };
  if (normalized.includes("appointment") || normalized.includes("agenda") || normalized.includes("calendar")) return { title: "Agenda", icon: Calendar };
  if (normalized.includes("invoice") || normalized.includes("payment") || normalized.includes("finance")) return { title: "Financeiro", icon: Wallet };
  if (normalized.includes("document") || normalized.includes("history")) return { title: "Documento", icon: FileText };
  return { title: "Ação", icon: Sparkles };
};

export function MobileSynapseWidgetRenderer({ widgetData }: { widgetData: SynapseWidgetData }) {
  const navigate = useNavigate();
  const normalizedWidget = unwrapSynapseToolResponse(widgetData) || widgetData;
  const type = firstString(normalizedWidget.__actionType, normalizedWidget.type) || "synapse_action";
  const normalizedType = normalizeSynapseWidgetType(type);
  const rawData = normalizedWidget.data ?? normalizedWidget.payload ?? normalizedWidget;
  const dataArray = normalizeSynapseDataArray(rawData);
  const meta = mobileWidgetMeta(type);
  const Icon = meta.icon;

  const openTarget = (data: unknown = rawData) => {
    const target = getMobileWidgetTarget(type, data);
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };

  const renderRows = () => {
    if (normalizedType.includes("finance") || normalizedType.includes("summary") || normalizedType.includes("invoice")) {
      const data = isRecord(dataArray[0]) ? dataArray[0] : {};
      const metrics = [
        { label: "Projetado", value: data.projectedRevenue ?? data.revenue ?? data.amount ?? 0 },
        { label: "Pendente", value: data.pendingInvoices ?? data.pending ?? 0 },
      ];

      return (
        <button type="button" onClick={() => openTarget(data)} className="grid w-full grid-cols-2 gap-2 text-left active:scale-[0.99]">
          {metrics.map((metric) => (
          <span key={metric.label} className={cn("rounded-[17px] p-3", mobileInsetSurfaceClassName)}>
              <span className="block text-[8px] font-black uppercase tracking-[0.13em] text-muted-foreground">{metric.label}</span>
              <span className="mt-1 block truncate text-[13px] font-black tracking-[-0.02em] text-foreground">{formatMobileCurrency(metric.value)}</span>
            </span>
          ))}
        </button>
      );
    }

    return (
      <div className="space-y-2">
        {dataArray.slice(0, 4).map((item, index) => {
          const data = isRecord(item) ? item : {};
          const patient = isRecord(data.patient) ? data.patient : {};
          const isPatient = normalizedType.includes("patient") || normalizedType.includes("paciente") || normalizedType.includes("risk");
          const isAppointment = normalizedType.includes("appointment") || normalizedType.includes("agenda") || normalizedType.includes("calendar");
          const title = isPatient
            ? firstString(data.name, data.patient_name, patient.name) || "Paciente"
            : isAppointment
              ? firstString(data.patient_name, patient.name, data.title) || "Agendamento"
              : mobileWidgetActionLabel(type);
          const detail = isPatient
            ? firstString(data.email, data.phone, data.diagnosis) || "Abrir detalhes"
            : isAppointment
              ? firstString(data.horario, data.time, toMobileTime(data.start_time), data.date) || "Ver agenda"
              : firstString(normalizedWidget.title) || "Abrir no sistema";

          return (
            <button
              key={firstString(data.id, data.patient_id, data.appointment_id) || `${type}-${index}`}
              type="button"
              onClick={() => openTarget(data)}
              className={cn("flex min-h-12 w-full items-center gap-3 rounded-[18px] p-3 text-left transition active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100", mobileInsetSurfaceClassName)}
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]", mobileIconSurfaceClassName)}>
                <Icon className="h-[17px] w-[17px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-black tracking-[-0.01em] text-foreground">{title}</span>
                <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">{detail}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/42" />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <section className={cn("mt-3 overflow-hidden rounded-[22px]", mobileMaterialSurfaceClassName)}>
      <header className="flex items-center gap-2.5 border-b border-border/45 px-4 py-3 dark:border-white/[0.06]">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]", mobileIconSurfaceClassName)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">{meta.title}</span>
          <span className="mt-0.5 block truncate text-[12px] font-black tracking-[-0.01em] text-foreground">
            {firstString(normalizedWidget.title) || mobileWidgetActionLabel(type)}
          </span>
        </span>
        {dataArray.length > 1 ? (
          <span className={cn("ml-auto rounded-full px-2 py-1 text-[8px] font-black text-muted-foreground", mobileInsetSurfaceClassName)}>
            {dataArray.length}
          </span>
        ) : null}
      </header>
      <div className="p-3">{renderRows()}</div>
    </section>
  );
}

export function MobileSynapseMessage({
  message,
  richData,
}: {
  message: Message;
  richData?: unknown;
}) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";
  const action = useMemo(() => normalizeRichAction(richData), [richData]);
  const displayContent = typeof message.content === "string" ? message.content : String(message.content || "");
  const parsedContent = useMemo(() => parseSynapseWidgetFromContent(displayContent), [displayContent]);
  const widgetData = action
    ? { __actionType: action.type, data: action.payload || action.data }
    : parsedContent.widgetData;
  const cleanContent = parsedContent.cleanContent || (widgetData ? "" : displayContent);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article
      className={cn(
        "rounded-[24px] border p-4 shadow-[0_18px_48px_-42px_hsl(var(--foreground)/0.45)] backdrop-blur-xl",
        isAssistant
          ? "border-border/45 bg-card/84 text-foreground dark:border-white/10 dark:bg-white/[0.045]"
          : "border-foreground bg-foreground text-background dark:border-white/[0.09] dark:bg-white dark:text-zinc-950",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {isAssistant ? (
            <MobileSynapseMark className="h-9 w-9" active />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-background/12 text-background dark:bg-zinc-950/10 dark:text-zinc-950">
              <User className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className={cn("truncate text-[9px] font-black uppercase tracking-[0.16em]", isAssistant ? "text-muted-foreground" : "text-background/62 dark:text-zinc-950/62")}>
              {isAssistant ? "Synapse" : "Você"}
            </p>
            <p className={cn("mt-0.5 text-[8px] font-medium", isAssistant ? "text-muted-foreground/72" : "text-background/45 dark:text-zinc-950/45")}>
              {new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={copyMessage}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition active:scale-95",
            isAssistant ? "bg-muted/65 text-muted-foreground dark:bg-white/[0.06]" : "bg-background/10 text-background/72 dark:bg-zinc-950/10 dark:text-zinc-950/72",
          )}
          aria-label="Copiar mensagem"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {cleanContent ? (
        <div
          className={cn(
            "mt-3 max-w-none text-[14px] font-semibold leading-relaxed",
            isAssistant ? "text-foreground/86" : "text-background dark:text-zinc-950",
            "[&_a]:font-bold [&_a]:underline [&_a]:underline-offset-4",
            "[&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px]",
            isAssistant ? "[&_code]:bg-foreground/[0.06] dark:[&_code]:bg-white/[0.08]" : "[&_code]:bg-background/10 dark:[&_code]:bg-zinc-950/10",
            "[&_li]:my-1 [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-[16px] [&_pre]:border [&_pre]:p-3 [&_pre]:text-[12px] [&_table]:my-3 [&_table]:w-full [&_table]:text-left [&_td]:border-t [&_td]:border-border/60 dark:[&_td]:border-white/10 [&_td]:py-2 [&_td]:pr-3 [&_th]:py-2 [&_th]:pr-3 [&_ul]:pl-5",
            isAssistant ? "[&_pre]:border-border/70 [&_pre]:bg-background/60 dark:[&_pre]:border-white/10 dark:[&_pre]:bg-white/[0.045]" : "[&_pre]:border-background/10 [&_pre]:bg-background/10 dark:[&_pre]:border-zinc-950/10 dark:[&_pre]:bg-zinc-950/10",
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
        </div>
      ) : null}

      {widgetData ? <MobileSynapseWidgetRenderer widgetData={widgetData} /> : null}
    </article>
  );
}

export function MobileSynapseThinking() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 32 }}
      className="flex items-end gap-2.5"
    >
      <MobileSynapseMark className="h-8 w-8" />
      <motion.div
        animate={shouldReduceMotion ? undefined : {
          boxShadow: [
            "0 16px 42px -34px rgba(0,0,0,0.45)",
            "0 22px 58px -36px rgba(0,0,0,0.56)",
            "0 16px 42px -34px rgba(0,0,0,0.45)",
          ],
        }}
        transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        className="flex items-center gap-1.5 rounded-[20px] rounded-bl-[8px] border border-zinc-200/80 bg-white/82 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]"
      >
        {[0, 0.16, 0.32].map((delay) => (
          <motion.span
            key={delay}
            animate={shouldReduceMotion ? { opacity: 0.7 } : { y: [0, -3, 0], opacity: [0.35, 1, 0.35], scale: [1, 1.18, 1] }}
            transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 0.9, delay, ease: "easeInOut" }}
            className="h-1.5 w-1.5 rounded-full bg-zinc-950/60 dark:bg-white/70"
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

export function MobileSynapseVoicePanel({
  isConnected,
  isListening,
  isProcessing,
  isSpeaking,
  isToolActive = false,
  activeToolLabel = "",
  activeToolMessage = "",
  lastResponse,
  error,
  onToggleRecording,
  onReset,
}: {
  isConnected: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  isToolActive?: boolean;
  activeToolLabel?: string;
  activeToolMessage?: string;
  lastResponse: string;
  error?: string | null;
  onToggleRecording: () => void;
  onReset: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const statusLabel = error
    ? "Requer atenção"
    : isSpeaking
      ? "Respondendo"
      : isToolActive
        ? "Consultando"
        : isProcessing
          ? "Pensando"
          : isListening
          ? "Ouvindo"
          : isConnected
            ? "Pausado"
            : "Synapse voz";

  const description = error
    || (isToolActive ? activeToolMessage || (activeToolLabel ? `Consultando ${activeToolLabel}...` : "Consultando no sistema...") : "")
    || lastResponse
    || (isConnected
      ? "Fale naturalmente. O Synapse pausa a escuta enquanto responde."
      : "Toque no microfone para iniciar a conversa por voz.");

  return (
    <section className="relative flex h-full min-h-[100dvh] flex-col overflow-hidden bg-[#f8f8f7] px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-[calc(6.35rem+env(safe-area-inset-top))] text-zinc-950 dark:bg-[#020204] dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(99,102,241,0.13),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.78),rgba(248,248,247,0.92))] dark:bg-[radial-gradient(circle_at_50%_34%,rgba(99,102,241,0.16),transparent_42%),linear-gradient(180deg,rgba(10,10,12,0.98),rgba(0,0,0,1))]" />

      <div className="relative flex min-h-0 flex-1 translate-y-[clamp(0.35rem,2dvh,1.1rem)] flex-col items-center justify-center">
        <div
          className={cn(
            "pointer-events-none h-[min(78vw,41dvh,22rem)] w-[min(78vw,41dvh,22rem)] transition duration-300",
            error ? "opacity-45 grayscale" : "opacity-95",
          )}
          style={{
            filter: isSpeaking
              ? "hue-rotate(-16deg) brightness(1.18)"
              : isToolActive
                ? "hue-rotate(12deg) brightness(1.02)"
              : isListening
                ? "brightness(1.08)"
                : "brightness(0.84)",
          }}
        >
          {shouldReduceMotion ? (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-zinc-200/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.055]">
              <MobileSynapseMark className="h-[42%] w-[42%]" active={isListening || isSpeaking || isToolActive} />
            </div>
          ) : (
            <VoiceSpiral
              totalDots={620}
              dotRadius={2.35}
              duration={isSpeaking ? 1.45 : isToolActive ? 2.15 : isProcessing ? 2 : 3}
              minOpacity={0.12}
              maxOpacity={isListening || isSpeaking ? 1 : isToolActive ? 0.82 : 0.64}
              minScale={0.3}
              maxScale={isListening ? 2.2 : isSpeaking ? 1.85 : isToolActive ? 1.55 : 1.35}
              isListening={isListening}
              isProcessing={isProcessing || isSpeaking || isToolActive}
              useMultipleColors
              colors={isSpeaking ? ["#f8fafc", "#c4b5fd", "#8b5cf6"] : ["#e5e7eb", "#a5b4fc", "#6366f1"]}
            />
          )}
        </div>

        <div className="relative z-10 -mt-2 flex max-w-[22rem] flex-col items-center text-center">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.16em] backdrop-blur-2xl",
              error
                ? "border-rose-500/25 bg-rose-500/10 text-rose-500"
                : isToolActive
                  ? "border-foreground/20 bg-foreground/[0.07] text-foreground"
                : isListening
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                  : "border-border/45 bg-card/55 text-muted-foreground dark:border-white/10 dark:bg-white/[0.055]",
            )}
          >
            {isListening ? (
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0.18s] motion-reduce:animate-none" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0.32s] motion-reduce:animate-none" />
              </span>
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
            {statusLabel}
          </div>

          <p className={cn(
            "mt-3 line-clamp-4 text-xs font-semibold leading-relaxed",
            error ? "text-rose-500" : "text-muted-foreground/78 dark:text-white/68",
          )}>
            {description}
          </p>
        </div>
      </div>

      <div className="relative z-20 mt-auto flex shrink-0 items-center justify-center gap-4 pb-1 pt-5">
        <button
          type="button"
          onClick={onReset}
          disabled={isProcessing && !isToolActive}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200/75 bg-white/82 text-zinc-500 shadow-sm backdrop-blur-xl transition active:scale-95 disabled:opacity-45 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55"
          aria-label="Reiniciar conversa"
        >
          <RefreshCcw className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onToggleRecording}
          disabled={isProcessing && !isToolActive}
          className={cn(
            "flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-full border text-white shadow-[0_22px_62px_-28px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.2)] transition active:scale-95 disabled:opacity-60",
            error
              ? "border-rose-400/30 bg-rose-500"
              : "border-white/15 bg-zinc-950 dark:bg-white dark:text-black",
          )}
          aria-label={isListening ? "Pausar microfone" : "Ativar microfone"}
        >
          {isProcessing && !isToolActive ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : isListening ? (
            <MicOff className="h-7 w-7" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </button>

        <div className="h-12 w-12" aria-hidden="true" />
      </div>

      <p className="relative z-20 mt-3 text-center text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/45">
        Voz neural · baixa latência
      </p>
    </section>
  );
}

export function MobileSynapseSheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  footer,
  contentClassName,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "[&>div:first-child]:hidden z-[130] flex h-[min(92dvh,46rem)] max-h-[92dvh] overflow-hidden rounded-t-[30px] border-border/40 bg-background p-0 shadow-2xl dark:border-white/10",
          contentClassName,
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/14" />
        <header className="shrink-0 px-5 pb-4 pt-5">
          <div className="flex items-start gap-3">
            {Icon ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/40 bg-card/72 dark:border-white/10 dark:bg-white/[0.03]">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <MobileSynapseEyebrow>{eyebrow}</MobileSynapseEyebrow> : null}
              {title ? <h2 className="mt-1 text-2xl font-black leading-none tracking-[-0.05em] text-foreground">{title}</h2> : null}
              {description ? <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground/70">{description}</p> : null}
            </div>
          </div>
        </header>
        <div
          className={cn(
            "mobile-scroll-owner min-h-0 flex-1 overflow-y-auto overscroll-contain px-5",
            footer ? "pb-5" : "pb-[calc(24px+env(safe-area-inset-bottom))]",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-border/40 bg-background/94 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10">
            {footer}
          </footer>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function MobileSynapseField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/62">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-2 block text-[10px] font-medium leading-relaxed text-muted-foreground/62">{hint}</span> : null}
    </label>
  );
}
