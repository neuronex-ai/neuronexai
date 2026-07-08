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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getAppointmentStatusMeta, isCancelledAppointmentStatus } from "@/lib/appointment-status";

type SynapseWidgetData = {
  __actionType?: string;
  type?: string;
  data?: unknown;
  payload?: unknown;
  title?: string;
};

interface SynapseWidgetProps {
  widgetData: SynapseWidgetData;
  compact?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.trim().length > 0);

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

const normalizeType = (type?: string) =>
  (type || "synapse_action")
    .replace(/_widget$/i, "")
    .replace(/_response$/i, "")
    .toLowerCase();

const unwrapToolResponse = (value: unknown): SynapseWidgetData | null => {
  if (!isRecord(value)) return null;
  const directType = firstString(value.__actionType, value.type);
  if (directType) return value as SynapseWidgetData;

  const responseEntry = Object.entries(value).find(([key]) => key.endsWith("_response"));
  if (!responseEntry) return null;

  const [responseKey, responseValue] = responseEntry;
  const response = isRecord(responseValue) ? responseValue : {};
  const content = isRecord(response.content) ? response.content : response;
  const data =
    (isRecord(content.appointment) && content.appointment) ||
    (isRecord(content.patient) && content.patient) ||
    (isRecord(content.invoice) && content.invoice) ||
    content;

  return {
    __actionType: responseKey.replace(/_response$/i, ""),
    data,
    title: firstString(content.message, response.message),
  };
};

export const parseSynapseWidgetFromContent = (content: string): {
  cleanContent: string;
  widgetData: SynapseWidgetData | null;
} => {
  const trimmed = content.trim();

  const fromRawJson = (() => {
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
    try {
      return unwrapToolResponse(JSON.parse(trimmed));
    } catch {
      return null;
    }
  })();

  if (fromRawJson) return { cleanContent: "", widgetData: fromRawJson };

  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let widgetData: SynapseWidgetData | null = null;
  const cleanContent = content.replace(fencePattern, (fullMatch, jsonCandidate) => {
    if (widgetData) return fullMatch;
    try {
      widgetData = unwrapToolResponse(JSON.parse(String(jsonCandidate).trim()));
      return widgetData ? "" : fullMatch;
    } catch {
      return fullMatch;
    }
  }).trim();

  return { cleanContent, widgetData };
};

const normalizeDataArray = (rawData: unknown): unknown[] => {
  if (Array.isArray(rawData)) return rawData;
  if (!isRecord(rawData)) return rawData ? [rawData] : [];
  if (Array.isArray(rawData.items)) return rawData.items;
  if (Array.isArray(rawData.results)) return rawData.results;
  if (Array.isArray(rawData.data)) return rawData.data;
  if (Array.isArray(rawData.patients)) return rawData.patients;
  if (Array.isArray(rawData.appointments)) return rawData.appointments;
  return [rawData];
};

const getEntityId = (data: unknown, type: string) => {
  if (!isRecord(data)) return undefined;
  const nestedAppointment = isRecord(data.appointment) ? data.appointment : undefined;
  const nestedPatient = isRecord(data.patient) ? data.patient : undefined;
  const normalized = normalizeType(type);

  if (normalized.includes("appointment") || normalized.includes("agenda") || normalized.includes("calendar")) {
    return firstString(data.appointment_id, nestedAppointment?.id, data.id);
  }

  if (normalized.includes("patient") || normalized.includes("paciente")) {
    return firstString(data.patient_id, nestedPatient?.id, data.id);
  }

  return firstString(data.id);
};

const getTarget = (type: string, data: unknown) => {
  const normalized = normalizeType(type);
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
      toast: id ? "Abrindo prontuário..." : "Abrindo pacientes...",
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider", meta.softClassName, meta.textClassName)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
};

const actionLabel = (type: string) => {
  const normalized = normalizeType(type);
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

export const SynapseWidgetRenderer = ({ widgetData, compact = false }: SynapseWidgetProps) => {
  const navigate = useNavigate();
  const normalizedWidget = unwrapToolResponse(widgetData) || widgetData;
  const type = firstString(normalizedWidget.__actionType, normalizedWidget.type) || "synapse_action";
  const normalizedType = normalizeType(type);
  const rawData = normalizedWidget.data ?? normalizedWidget.payload ?? normalizedWidget;
  const dataArray = normalizeDataArray(rawData);

  const openTarget = (data: unknown = rawData) => {
    const target = getTarget(type, data);
    toast.success(target.toast);
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };

  const renderPatientList = () => (
    <div className="space-y-2">
      {dataArray.map((item, index) => {
        const patient = isRecord(item) ? item : {};
        return (
          <button
            key={firstString(patient.id, patient.patient_id) || index}
            onClick={() => openTarget(patient)}
            className="group/item flex w-full min-h-11 items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3.5 text-left transition active:scale-[0.985] hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-white/[0.035] dark:hover:bg-white/[0.065]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                <User className="h-4 w-4" />
                <span className={cn("absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-zinc-50 dark:border-[#0a0a0c]", patient.status === "inactive" ? "bg-amber-500" : "bg-emerald-500")} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black tracking-[-0.01em] text-zinc-950 dark:text-zinc-100">
                  {firstString(patient.name, patient.patient_name) || "Paciente"}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                  {firstString(patient.email, patient.phone, patient.diagnosis) || "Abrir detalhes"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover/item:translate-x-0.5 dark:text-zinc-500" />
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
          start ? `${toBrazilTime(start)}${end ? ` às ${toBrazilTime(end)}` : ""}` : undefined,
        );
        const patientName = firstString(appointment.patient_name, patient.name, appointment.title) || "Agendamento";
        const appointmentType = firstString(appointment.type) || "presencial";
        const status = firstString(appointment.status) || "confirmed";

        return (
          <button
            key={firstString(appointment.id, appointment.appointment_id) || index}
            onClick={() => openTarget(appointment)}
            className={cn(
              "group/item flex w-full min-h-11 items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3.5 text-left transition active:scale-[0.985] hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-white/[0.035] dark:hover:bg-white/[0.065]",
              isCancelledAppointmentStatus(status, firstString(appointment.notes)) && "opacity-60",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                {appointmentType === "online" ? <Stethoscope className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black tracking-[-0.01em] text-zinc-950 dark:text-zinc-100">
                  {patientName}
                </p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  {time ? <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">{time}</span> : null}
                  <StatusBadge status={status} notes={firstString(appointment.notes)} />
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover/item:translate-x-0.5 dark:text-zinc-500" />
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
      <button onClick={() => openTarget(data)} className="grid w-full grid-cols-2 gap-2 text-left transition active:scale-[0.985]">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.035]">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{metric.label}</p>
            <p className={cn("mt-1 truncate text-[15px] font-black tracking-[-0.03em]", metric.color)}>{formatCurrency(metric.value)}</p>
          </div>
        ))}
      </button>
    );
  };

  const renderGenericAction = () => {
    const data = dataArray[0] || rawData;
    return (
      <button
        onClick={() => openTarget(data)}
        className="group/item flex w-full min-h-11 items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50 p-3.5 text-left transition active:scale-[0.985] hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-white/[0.035] dark:hover:bg-white/[0.065]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">Executado</p>
            <p className="truncate text-[13px] font-black tracking-[-0.01em] text-zinc-950 dark:text-zinc-100">
              {actionLabel(type)}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover/item:translate-x-0.5 dark:text-zinc-500" />
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
    if (normalizedType.includes("risk")) return "Alerta clínico";
    if (normalizedType.includes("finance") || normalizedType.includes("invoice")) return "Financeiro";
    if (normalizedType.includes("document")) return "Documento";
    return "Ação do Synapse";
  })();

  return (
    <div className={cn(
      "my-3 overflow-hidden rounded-[22px] border border-zinc-200/70 bg-white shadow-[0_18px_55px_-45px_rgba(0,0,0,0.75)] dark:border-white/[0.08] dark:bg-[#0a0a0c]",
      compact && "rounded-[18px]",
    )}>
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3 dark:border-white/[0.05]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{headerLabel}</p>
          <p className="mt-0.5 truncate text-[12px] font-black tracking-[-0.01em] text-zinc-950 dark:text-zinc-100">
            {firstString(normalizedWidget.title) || actionLabel(type)}
          </p>
        </div>
        {dataArray.length > 1 ? (
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:bg-white/[0.07] dark:text-zinc-400">
            {dataArray.length}
          </span>
        ) : null}
      </div>
      <div className="p-3">{renderContent()}</div>
    </div>
  );
};
