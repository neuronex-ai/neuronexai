import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";

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

interface MobileSynapseWidgetRendererProps {
  widgetData: SynapseWidgetData;
}

const formatCurrency = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const toBrazilTime = (iso?: unknown) => {
  if (typeof iso !== "string") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const actionLabel = (type: string) => {
  return humanizeSynapseActionType(type);
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

const getTargetPath = (type: string, data: unknown) => {
  const normalized = normalizeSynapseWidgetType(type);
  const id = getEntityId(data, type);

  if (normalized.includes("appointment") || normalized.includes("agenda") || normalized.includes("calendar")) {
    return id ? `/agenda?appointmentId=${encodeURIComponent(id)}` : "/agenda";
  }

  if (normalized.includes("patient") || normalized.includes("paciente")) {
    return id ? `/pacientes/${id}` : "/pacientes";
  }

  if (normalized.includes("invoice") || normalized.includes("payment") || normalized.includes("finance")) {
    return "/financeiro";
  }

  if (normalized.includes("document") || normalized.includes("history") || normalized.includes("prontuario")) {
    return "/notas";
  }

  return undefined;
};

const WidgetShell = ({
  icon,
  label,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  count?: number;
  children: ReactNode;
}) => (
  <section className="mt-3 bg-transparent">
    <div className="synapse-widget-surface overflow-hidden rounded-[21px]">
      <header className="flex items-center gap-3 border-b px-3.5 py-3" style={{ borderColor: "var(--synapse-border-subtle)" }}>
        <div className="synapse-control flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.16em] synapse-tertiary-text">{label}</p>
          <h4 className="mt-0.5 truncate text-[13px] font-black tracking-[-0.01em]" style={{ color: "var(--synapse-text-primary)" }}>
            {title}
          </h4>
        </div>
        {count && count > 1 ? (
          <span className="synapse-control rounded-full px-2 py-1 text-[8px] font-black">{count}</span>
        ) : null}
      </header>
      <div className="space-y-2.5 p-3">{children}</div>
    </div>
  </section>
);

const ActionRow = ({
  icon,
  title,
  detail,
  cancelled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail?: string;
  cancelled?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "synapse-control synapse-focusable flex min-h-[72px] w-full items-center gap-3 rounded-[17px] p-3 text-left",
      cancelled && "opacity-65",
    )}
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]" style={{ background: "var(--synapse-control-hover)" }}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-black tracking-[-0.015em]" style={{ color: "var(--synapse-text-primary)" }}>
        {title}
      </p>
      {detail ? <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-relaxed synapse-muted-text">{detail}</p> : null}
    </div>
    {onClick ? <ArrowRight className="h-4 w-4 shrink-0 synapse-tertiary-text" /> : null}
  </button>
);

export function MobileSynapseWidgetRenderer({ widgetData }: MobileSynapseWidgetRendererProps) {
  const navigate = useNavigate();
  const normalizedWidget = unwrapSynapseToolResponse(widgetData) || widgetData;
  const type = firstString(normalizedWidget.__actionType, normalizedWidget.type) || "synapse_action";
  const normalizedType = normalizeSynapseWidgetType(type);
  const rawData = normalizedWidget.data ?? normalizedWidget.payload ?? normalizedWidget;
  const dataArray = normalizeSynapseDataArray(rawData);
  const title = humanizeSynapseWidgetTitle(firstString(normalizedWidget.title), type);

  const openTarget = (data: unknown = rawData) => {
    const path = getTargetPath(type, data);
    if (path) navigate(path);
  };

  if (normalizedType.includes("patient") || normalizedType.includes("paciente") || normalizedType.includes("risk")) {
    return (
      <WidgetShell
        icon={normalizedType.includes("risk") ? <AlertTriangle className="h-4 w-4" /> : <User className="h-4 w-4" />}
        label={normalizedType.includes("risk") ? "Alerta clínico" : "Paciente"}
        title={title}
        count={dataArray.length}
      >
        {dataArray.map((item, index) => {
          const patient = isRecord(item) ? item : {};
          const patientId = firstString(patient.id, patient.patient_id);
          const patientName = sanitizeSynapseDisplayText(firstString(patient.name, patient.patient_name), "Paciente");
          const detail = sanitizeSynapseDisplayText(firstString(patient.email, patient.phone, patient.diagnosis), "Abrir detalhes");
          return (
            <ActionRow
              key={patientId || `patient-${index}`}
              icon={<User className="h-4 w-4" />}
              title={patientName}
              detail={detail}
              onClick={() => openTarget(patient)}
            />
          );
        })}
      </WidgetShell>
    );
  }

  if (normalizedType.includes("appointment") || normalizedType.includes("calendar") || normalizedType.includes("agenda")) {
    return (
      <WidgetShell icon={<Calendar className="h-4 w-4" />} label="Agenda" title={title} count={dataArray.length}>
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
          const patientName = sanitizeSynapseDisplayText(firstString(appointment.patient_name, patient.name, appointment.title), "Agendamento");
          const appointmentType = sanitizeSynapseDisplayText(firstString(appointment.type), "presencial");
          const status = firstString(appointment.status) || "confirmed";
          const meta = getAppointmentStatusMeta(status, firstString(appointment.notes));
          const Icon = appointmentType === "online" ? Stethoscope : Calendar;
          return (
            <ActionRow
              key={firstString(appointment.id, appointment.appointment_id) || `appointment-${index}`}
              icon={<Icon className="h-4 w-4" />}
              title={patientName}
              detail={[time, meta.label].filter(Boolean).join(" · ")}
              cancelled={isCancelledAppointmentStatus(status, firstString(appointment.notes))}
              onClick={() => openTarget(appointment)}
            />
          );
        })}
      </WidgetShell>
    );
  }

  if (normalizedType.includes("finance") || normalizedType.includes("summary") || normalizedType.includes("invoice") || normalizedType.includes("payment")) {
    const data = isRecord(dataArray[0]) ? dataArray[0] : {};
    const projected = data.projectedRevenue ?? data.revenue ?? data.amount ?? 0;
    const pending = data.pendingInvoices ?? data.pending ?? 0;
    return (
      <WidgetShell icon={<DollarSign className="h-4 w-4" />} label="Financeiro" title={title}>
        <button
          type="button"
          onClick={() => openTarget(data)}
          className="grid w-full grid-cols-2 gap-2 text-left"
        >
          {([
            ["Projetado", projected],
            ["Pendente", pending],
          ] as [string, unknown][]).map(([label, value]) => (
            <span key={label} className="synapse-control rounded-[17px] p-3">
              <span className="block text-[8px] font-black uppercase tracking-[0.14em] synapse-tertiary-text">{label}</span>
              <span className="mt-1 block truncate text-[14px] font-black" style={{ color: "var(--synapse-text-primary)" }}>
                {formatCurrency(value)}
              </span>
            </span>
          ))}
        </button>
      </WidgetShell>
    );
  }

  if (normalizedType.includes("document")) {
    return (
      <WidgetShell icon={<FileText className="h-4 w-4" />} label="Documento" title={title}>
        <ActionRow
          icon={<FileText className="h-4 w-4" />}
          title={title}
          detail="Documento preparado pelo Synapse."
          onClick={() => openTarget(rawData)}
        />
      </WidgetShell>
    );
  }

  return (
    <WidgetShell icon={<Sparkles className="h-4 w-4" />} label="Ação do Synapse" title={title}>
      <ActionRow
        icon={<CheckCircle2 className="h-4 w-4" />}
        title={actionLabel(type)}
        detail="Ação preparada ou executada no sistema."
        onClick={() => openTarget(dataArray[0] || rawData)}
      />
    </WidgetShell>
  );
}
