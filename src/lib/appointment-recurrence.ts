export type AppointmentRecurrenceFrequency = "single" | "weekly" | "biweekly" | "monthly";

export interface AppointmentSeriesOccurrence {
  occurrenceNumber: number;
  startTime: string;
  endTime: string;
  status: "available" | "conflict";
  reasonCode: string | null;
  reason: string | null;
}

export interface AppointmentSeriesPreview {
  valid: boolean;
  frequency: AppointmentRecurrenceFrequency;
  totalOccurrences: number;
  durationMinutes: number;
  firstStartTime: string;
  lastStartTime: string;
  occurrences: AppointmentSeriesOccurrence[];
  conflicts: AppointmentSeriesOccurrence[];
}

export interface CreatedSeriesAppointment {
  appointmentId: string;
  seriesId: string | null;
  occurrenceNumber: number | null;
  occurrenceCount: number | null;
  startTime: string;
  endTime: string;
}

export interface AppointmentSeriesCreateResult {
  success: boolean;
  seriesId: string | null;
  frequency: AppointmentRecurrenceFrequency;
  totalOccurrences: number;
  appointments: CreatedSeriesAppointment[];
  conflicts: AppointmentSeriesOccurrence[];
  preview?: AppointmentSeriesPreview;
}

const FREQUENCIES = new Set<AppointmentRecurrenceFrequency>([
  "single",
  "weekly",
  "biweekly",
  "monthly",
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asNullableString = (value: unknown) =>
  typeof value === "string" && value.length ? value : null;
const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const asFrequency = (value: unknown): AppointmentRecurrenceFrequency =>
  FREQUENCIES.has(value as AppointmentRecurrenceFrequency)
    ? (value as AppointmentRecurrenceFrequency)
    : "single";

const normalizeOccurrence = (value: unknown): AppointmentSeriesOccurrence => {
  const record = asRecord(value);
  return {
    occurrenceNumber: asNumber(record.occurrenceNumber),
    startTime: asString(record.startTime),
    endTime: asString(record.endTime),
    status: record.status === "conflict" ? "conflict" : "available",
    reasonCode: asNullableString(record.reasonCode),
    reason: asNullableString(record.reason),
  };
};

export function normalizeAppointmentSeriesPreview(value: unknown): AppointmentSeriesPreview {
  const record = asRecord(value);
  const occurrences = Array.isArray(record.occurrences)
    ? record.occurrences.map(normalizeOccurrence)
    : [];
  const conflicts = Array.isArray(record.conflicts)
    ? record.conflicts.map(normalizeOccurrence)
    : occurrences.filter((occurrence) => occurrence.status === "conflict");

  return {
    valid: record.valid === true,
    frequency: asFrequency(record.frequency),
    totalOccurrences: asNumber(record.totalOccurrences),
    durationMinutes: asNumber(record.durationMinutes),
    firstStartTime: asString(record.firstStartTime),
    lastStartTime: asString(record.lastStartTime),
    occurrences,
    conflicts,
  };
}

export function normalizeAppointmentSeriesCreateResult(
  value: unknown,
): AppointmentSeriesCreateResult {
  const record = asRecord(value);
  if (record.success !== true) {
    const preview = normalizeAppointmentSeriesPreview(record);
    return {
      success: false,
      seriesId: null,
      frequency: preview.frequency,
      totalOccurrences: preview.totalOccurrences,
      appointments: [],
      conflicts: preview.conflicts,
      preview,
    };
  }

  const appointments = Array.isArray(record.appointments)
    ? record.appointments.map((value): CreatedSeriesAppointment => {
        const appointment = asRecord(value);
        return {
          appointmentId: asString(appointment.appointmentId),
          seriesId: asNullableString(appointment.seriesId),
          occurrenceNumber:
            appointment.occurrenceNumber == null ? null : asNumber(appointment.occurrenceNumber),
          occurrenceCount:
            appointment.occurrenceCount == null ? null : asNumber(appointment.occurrenceCount),
          startTime: asString(appointment.startTime),
          endTime: asString(appointment.endTime),
        };
      })
    : [];

  return {
    success: true,
    seriesId: asNullableString(record.seriesId),
    frequency: asFrequency(record.frequency),
    totalOccurrences: asNumber(record.totalOccurrences),
    appointments,
    conflicts: [],
  };
}

export const APPOINTMENT_RECURRENCE_LABELS: Record<AppointmentRecurrenceFrequency, string> = {
  single: "Sem recorrência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

export function appointmentSeriesSummary(
  frequency: AppointmentRecurrenceFrequency,
  count: number,
) {
  if (frequency === "single") return "1 agendamento";
  const noun = count === 1 ? "sessão" : "sessões";
  const adjective =
    frequency === "weekly"
      ? count === 1
        ? "semanal"
        : "semanais"
      : frequency === "biweekly"
        ? count === 1
          ? "quinzenal"
          : "quinzenais"
        : count === 1
          ? "mensal"
          : "mensais";
  return `${count} ${noun} ${adjective}`;
}
