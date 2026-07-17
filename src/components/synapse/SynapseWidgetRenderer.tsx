import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileText,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { getAppointmentStatusMeta, isCancelledAppointmentStatus } from "@/lib/appointment-status";
import {
  humanizeSynapseActionType,
  humanizeSynapseWidgetTitle,
  sanitizeSynapseDisplayText,
} from "@/lib/synapse-humanize";
import {
  firstString,
  isRecord,
  normalizeSynapseDataArray,
  normalizeSynapseWidgetType,
  type SynapseWidgetData,
  unwrapSynapseToolResponse,
} from "@/lib/synapse-widget-parser";
import { cn } from "@/lib/utils";

interface SynapseWidgetProps {
  widgetData: SynapseWidgetData;
  compact?: boolean;
}

const toBrazilTime = (iso?: unknown) => {
  if (typeof iso !== "string") return "";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return iso;
  }
};

const formatCurrency = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const getEntityId = (data: unknown, type: string) => {
  if (!isRecord(data)) return undefined;
  const nestedAppointment = isRecord(data.appointment) ? data.appointment : undefined;
  const nestedPatient = isRecord(data.patient) ? data.patient : undefined;
  const normalized = normalizeSynapseWidgetType(type);

  if (normalized.includes("appointment") || normalized.includes("agenda") || normalized.includes("calendar")) {
    return firstString(data.appointment_id, nestedAppointment?.id, data.id);
  }

  if (normalized.includes("patient") || normalized.includes("paciente")) {
    return firstString(data.patient_id, nestedPatient?.id, data.id);
  }

  return firstString(data.id);
};

const getTarget = (type: string, data: unknown) => {
  const normalized = normalizeSynapseWidgetType(type);
  const id = getEntityId(data, type);

  if (normalized.includes("appointment") || normalized.includes("agenda") || normalized.includes("calendar")) {
    return {
      path: id ? `/agenda?appointmentId=${encodeURIComponent(id)}` : "/agenda",
      state: id ? { openAppointmentId: id } : undefined,
      toast: id ? "Abrindo detalhes do agendamento..." : "Abrindo agenda...",
    };
  }

  if (normalized.includes("patient") || normalized.includes("paciente")) {
    return {
      path: id ? `/pacientes/${id}` : "/pacientes",
      state: id ? { openPatientId: id } : undefined,
      toast: id ? "Abrindo prontuario..." : "Abrindo pacientes...",
    };
  }

  if (normalized.includes("invoice") || normalized.includes("payment") || normalized.includes("finance")) {
    return { path: "/financeiro", toast: "Abrindo financeiro..." };
  }

  if (normalized.includes("document") || normalized.includes("history") || normalized.includes("prontuario")) {
    return { path: "/notas", toast: "Abrindo documento..." };
  }

  return { path: "/dashboard", toast: "Abrindo painel..." };
};

const StatusBadge = ({ status, notes }: { status?: string | null; notes?: string | null }) => {
  const meta = getAppointmentStatusMeta(status || "unscored", notes);
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider",
        meta.softClassName,
        meta.textClassName,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
};

const actionLabel = (type: string) => humanizeSynapseActionType(type);

const rowClassName =
  "group/item flex min-h-11 w-full items-center justify-between rounded-2xl border border-border/40 bg-background/70 p-3.5 text-left shadow-[inset_0_1px_0_hsl(var(--background)/0.78)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-foreground/12 hover:bg-muted/55 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-white/[0.04] dark:bg-white/[0.028] dark:hover:border-white/[0.06] dark:hover:bg-white/[0.045]";

const iconClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/70 text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.72)] transition-colors group-hover/item:text-foreground dark:border-white/[0.04] dark:bg-white/[0.032]";

export const SynapseWidgetRenderer = ({ widgetData, compact = false }: SynapseWidgetProps) => {
  const navigate = useNavigate();
  const normalizedWidget = unwrapSynapseToolResponse(widgetData) || widgetData;
  const type = firstString(normalizedWidget.__actionType, normalizedWidget.type) || "synapse_action";
  const normalizedType = normalizeSynapseWidgetType(type);
  const rawData = normalizedWidget.data ?? normalizedWidget.payload ?? normalizedWidget;
  const dataArray = normalizeSynapseDataArray(rawData);

  const openTarget = (data: unknown = rawData) => {
    const target = getTarget(type, data);
    toast.success(target.toast);
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };

  const renderPatientList = () => (
    <div className="space-y-2">
      {dataArray.map((item, index) => {
        const patient = isRecord(item) ? item : {};
        const patientId = firstString(patient.id, patient.patient_id);
        return (
          <button
            key={patientId || `patient-${index}`}
            type="button"
            onClick={() => openTarget(patient)}
            className={rowClassName}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("relative", iconClassName)}>
                <User className="h-4 w-4" />
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background",
                    patient.status === "inactive" ? "bg-amber-500" : "bg-emerald-500",
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black tracking-[-0.01em] text-foreground">
                  {sanitizeSynapseDisplayText(firstString(patient.name, patient.patient_name), "Paciente")}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
                  {sanitizeSynapseDisplayText(firstString(patient.email, patient.phone, patient.diagnosis), "Abrir detalhes")}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/item:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/item:translate-x-0" />
          </button>
        );
      })}
    </div>
  );

  const renderAppointmentList = () => (
    <div className="space-y-2">
      {dataArray.map((item, index) => {
        const appointment = isRecord(item) ? item : {};
        const patient = isRecord(appointment.patient) ? appointment.patient : {};
        const start = firstString(appointment.start_time, appointment.date);
        const end = firstString(appointment.end_time);
        const time = firstString(
          appointment.horario,
          appointment.time,
          start ? `${toBrazilTime(start)}${end ? ` as ${toBrazilTime(end)}` : ""}` : undefined,
        );
        const patientName = sanitizeSynapseDisplayText(firstString(appointment.patient_name, patient.name, appointment.title), "Agendamento");
        const appointmentType = firstString(appointment.type) || "presencial";
        const status = firstString(appointment.status) || "confirmed";
        const appointmentId = firstString(appointment.id, appointment.appointment_id);

        return (
          <button
            key={appointmentId || `appointment-${index}`}
            type="button"
            onClick={() => openTarget(appointment)}
            className={cn(rowClassName, isCancelledAppointmentStatus(status, firstString(appointment.notes)) && "opacity-65")}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={iconClassName}>
                {appointmentType === "online" ? <Stethoscope className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black tracking-[-0.01em] text-foreground">{patientName}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  {time ? (
                    <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      {time}
                    </span>
                  ) : null}
                  <StatusBadge status={status} notes={firstString(appointment.notes)} />
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/item:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/item:translate-x-0" />
          </button>
        );
      })}
    </div>
  );

  const renderFinancialSummary = () => {
    const data = isRecord(dataArray[0]) ? dataArray[0] : {};
    const metrics = [
      { label: "Projetado", value: data.projectedRevenue ?? data.revenue ?? data.amount ?? 0, color: "text-emerald-600 dark:text-emerald-300" },
      { label: "Pendente", value: data.pendingInvoices ?? data.pending ?? 0, color: "text-amber-600 dark:text-amber-300" },
    ];

    return (
      <button
        type="button"
        onClick={() => openTarget(data)}
        className="grid w-full grid-cols-1 gap-2 text-left transition-transform active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 sm:grid-cols-2"
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border/40 bg-background/70 p-3.5 dark:border-white/[0.04] dark:bg-white/[0.028]">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
            <p className={cn("mt-1 truncate text-[15px] font-black tracking-[-0.03em]", metric.color)}>{formatCurrency(metric.value)}</p>
          </div>
        ))}
      </button>
    );
  };

  const renderGenericAction = () => {
    const data = dataArray[0] || rawData;
    return (
      <button type="button" onClick={() => openTarget(data)} className={rowClassName}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={iconClassName}>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Executado</p>
            <p className="truncate text-[13px] font-black tracking-[-0.01em] text-foreground">{actionLabel(type)}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/item:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/item:translate-x-0" />
      </button>
    );
  };

  const renderContent = () => {
    if (normalizedType.includes("patient") || normalizedType.includes("paciente")) return renderPatientList();
    if (normalizedType.includes("appointment") || normalizedType.includes("calendar") || normalizedType.includes("agenda")) return renderAppointmentList();
    if (normalizedType.includes("risk")) return renderPatientList();
    if (normalizedType.includes("finance") || normalizedType.includes("summary") || normalizedType.includes("invoice")) return renderFinancialSummary();
    return renderGenericAction();
  };

  const icon = (() => {
    if (normalizedType.includes("patient") || normalizedType.includes("paciente")) return <User className="h-3.5 w-3.5" />;
    if (normalizedType.includes("appointment") || normalizedType.includes("calendar") || normalizedType.includes("agenda")) return <Calendar className="h-3.5 w-3.5" />;
    if (normalizedType.includes("risk")) return <AlertTriangle className="h-3.5 w-3.5" />;
    if (normalizedType.includes("finance") || normalizedType.includes("invoice")) return <DollarSign className="h-3.5 w-3.5" />;
    if (normalizedType.includes("document")) return <FileText className="h-3.5 w-3.5" />;
    return <Sparkles className="h-3.5 w-3.5" />;
  })();

  const headerLabel = (() => {
    if (normalizedType.includes("patient") || normalizedType.includes("paciente")) return "Paciente";
    if (normalizedType.includes("appointment") || normalizedType.includes("calendar") || normalizedType.includes("agenda")) return "Agenda";
    if (normalizedType.includes("risk")) return "Alerta clinico";
    if (normalizedType.includes("finance") || normalizedType.includes("invoice")) return "Financeiro";
    if (normalizedType.includes("document")) return "Documento";
    return "Acao do Synapse";
  })();

  return (
    <section className={cn("my-3 w-full min-w-0 bg-transparent", compact && "my-2")}>
      <div
        className={cn(
          "overflow-hidden rounded-[22px] border border-zinc-950/[0.085] bg-white/72 shadow-[0_18px_55px_-45px_rgba(24,24,27,0.58),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-2xl",
          "dark:border-white/[0.055] dark:bg-white/[0.032] dark:shadow-[0_22px_58px_-46px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.032)]",
          compact && "rounded-[18px]",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-950/[0.06] px-4 py-3 dark:border-white/[0.035]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-950/[0.08] bg-zinc-950/[0.045] text-muted-foreground dark:border-white/[0.045] dark:bg-white/[0.04]">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{headerLabel}</p>
            <p className="mt-0.5 truncate text-[12px] font-black tracking-[-0.01em] text-foreground">
              {humanizeSynapseWidgetTitle(firstString(normalizedWidget.title), type)}
            </p>
          </div>
          {dataArray.length > 1 ? (
            <span className="ml-auto rounded-full border border-zinc-950/[0.07] bg-zinc-950/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground dark:border-white/[0.045] dark:bg-white/[0.035]">
              {dataArray.length}
            </span>
          ) : null}
        </div>
        <div className="p-3">{renderContent()}</div>
      </div>
    </section>
  );
};
