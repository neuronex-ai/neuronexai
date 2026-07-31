import { CheckCircle2, Circle, CircleAlert, XCircle, type LucideIcon } from "lucide-react";

export const APPOINTMENT_STATUS_VALUES = [
  "unscored",
  "attended",
  "absent",
  "cancelled_by_patient",
  "cancelled_by_professional",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS_VALUES)[number];
export type LegacyAppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
export type AppointmentStatusLike = AppointmentStatus | LegacyAppointmentStatus | string | null | undefined;

export interface AppointmentStatusMeta {
  value: AppointmentStatus;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  chartColor: string;
  icon: LucideIcon;
}

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, AppointmentStatusMeta> = {
  unscored: {
    value: "unscored",
    label: "Pendente",
    shortLabel: "Pendente",
    description: "Ainda sem pontuação de presença.",
    color: "zinc",
    dotClass: "bg-zinc-500 dark:bg-zinc-400",
    textClass: "text-zinc-500 dark:text-zinc-400",
    bgClass: "bg-zinc-500/10",
    borderClass: "border-zinc-500/20",
    chartColor: "#71717A",
    icon: Circle,
  },
  attended: {
    value: "attended",
    label: "Realizada",
    shortLabel: "Realizada",
    description: "Sessão realizada com presença.",
    color: "emerald",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
    chartColor: "#10B981",
    icon: CheckCircle2,
  },
  absent: {
    value: "absent",
    label: "Ausente",
    shortLabel: "Ausente",
    description: "Paciente ausente ou falta registrada.",
    color: "amber",
    dotClass: "bg-amber-500",
    textClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    chartColor: "#EAB308",
    icon: CircleAlert,
  },
  cancelled_by_patient: {
    value: "cancelled_by_patient",
    label: "Cancelada",
    shortLabel: "Cancelada",
    description: "Cancelamento solicitado pelo paciente.",
    color: "red",
    dotClass: "bg-red-500",
    textClass: "text-red-500",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
    chartColor: "#EF4444",
    icon: XCircle,
  },
  cancelled_by_professional: {
    value: "cancelled_by_professional",
    label: "Cancelada",
    shortLabel: "Cancelada",
    description: "Cancelamento realizado pelo profissional.",
    color: "red-dark",
    dotClass: "bg-red-800 dark:bg-red-700",
    textClass: "text-red-800 dark:text-red-400",
    bgClass: "bg-red-800/10",
    borderClass: "border-red-800/20 dark:border-red-700/20",
    chartColor: "#991B1B",
    icon: XCircle,
  },
};

const CANONICAL_SET = new Set<string>(APPOINTMENT_STATUS_VALUES);

export const normalizeAppointmentStatus = (
  status: AppointmentStatusLike,
  notes?: string | null
): AppointmentStatus => {
  if (status && CANONICAL_SET.has(status)) return status as AppointmentStatus;

  switch (status) {
    case "completed":
      return "attended";
    case "no_show":
      return "absent";
    case "cancelled": {
      const rawNotes = (notes || "").toLowerCase();
      if (
        rawNotes.includes("paciente") ||
        rawNotes.includes("cliente") ||
        rawNotes.includes("patient")
      ) {
        return "cancelled_by_patient";
      }
      return "cancelled_by_professional";
    }
    case "pending":
    case "confirmed":
    default:
      return "unscored";
  }
};

export const getAppointmentStatusMeta = (
  status: AppointmentStatusLike,
  notes?: string | null
) => {
  const meta = APPOINTMENT_STATUS_META[normalizeAppointmentStatus(status, notes)];
  return {
    ...meta,
    dotClassName: meta.dotClass,
    textClassName: meta.textClass,
    softClassName: `${meta.bgClass} ${meta.borderClass}`,
  };
};

export const isCancelledAppointmentStatus = (
  status: AppointmentStatusLike,
  notes?: string | null
) => {
  const normalized = normalizeAppointmentStatus(status, notes);
  return normalized === "cancelled_by_patient" || normalized === "cancelled_by_professional";
};

export const isAttendedAppointmentStatus = (
  status: AppointmentStatusLike,
  notes?: string | null
) => normalizeAppointmentStatus(status, notes) === "attended";

export const isAbsentAppointmentStatus = (
  status: AppointmentStatusLike,
  notes?: string | null
) => normalizeAppointmentStatus(status, notes) === "absent";

export const isBillableClinicalStatus = (
  status: AppointmentStatusLike,
  notes?: string | null
) => {
  const normalized = normalizeAppointmentStatus(status, notes);
  return normalized === "attended" || normalized === "unscored";
};

export const STATUS_CHART_KEYS = {
  unscored: "Pendente",
  attended: "Realizada",
  absent: "Ausente",
  cancelled_by_patient: "Cancelada",
  cancelled_by_professional: "Cancelada",
} satisfies Record<AppointmentStatus, string>;
