import type { OccurrenceOverride } from "@/lib/agenda-scheduling";

export type AppointmentEventType = "session" | "event";

export const APPOINTMENT_FORM_ID = "new-appointment-form";

const SESSION_FIELD_ORDER = [
  "eventType",
  "patientId",
  "date",
  "startTime",
  "endTime",
  "recurrence",
  "recurrenceFrequency",
  "recurrenceCount",
  "type",
  "modality",
  "sessionLocation",
  "duration",
  "notes",
  "usePackage",
  "packageId",
  "shouldCreateTransaction",
  "shouldGenerateNeurofinanceCharge",
  "transactionAmount",
  "installments",
  "transactionMethod",
] as const;

const EVENT_FIELD_ORDER = [
  "eventType",
  "eventTitle",
  "eventCategory",
  "date",
  "startTime",
  "endTime",
  "recurrence",
  "recurrenceFrequency",
  "recurrenceCount",
  "eventLocation",
  "notes",
] as const;

const RECURRENCE_DETAIL_FIELDS = new Set<string>([
  "recurrenceFrequency",
  "recurrenceCount",
]);

const SESSION_ATTENDANCE_FIELDS = new Set<string>([
  "eventType",
  "patientId",
  "date",
  "startTime",
  "endTime",
  "recurrence",
  "recurrenceFrequency",
  "recurrenceCount",
]);
const EVENT_ATTENDANCE_FIELDS = new Set<string>([
  "eventType",
  "eventTitle",
  "eventCategory",
  "date",
  "startTime",
  "endTime",
  "recurrence",
  "recurrenceFrequency",
  "recurrenceCount",
]);
const FINANCIAL_FIELDS = new Set<string>([
  "usePackage",
  "packageId",
  "shouldCreateTransaction",
  "shouldGenerateNeurofinanceCharge",
  "transactionAmount",
  "installments",
  "transactionMethod",
]);

export function getAppointmentStepLabels(
  eventType: AppointmentEventType,
  _recurrenceEnabled: boolean,
) {
  if (eventType === "event") {
    return ["Compromisso", "Detalhes", "Revisão"];
  }

  return ["Atendimento", "Sessão", "Financeiro", "Revisão"];
}

export function getAppointmentFieldOrder(
  eventType: AppointmentEventType,
  recurrenceEnabled: boolean,
) {
  const order = eventType === "event" ? EVENT_FIELD_ORDER : SESSION_FIELD_ORDER;
  return order.filter((fieldName) => (
    recurrenceEnabled || !RECURRENCE_DETAIL_FIELDS.has(fieldName)
  ));
}

export function getAppointmentFieldStep(
  fieldName: string,
  eventType: AppointmentEventType,
  recurrenceEnabled: boolean,
) {
  const attendanceFields = eventType === "event"
    ? EVENT_ATTENDANCE_FIELDS
    : SESSION_ATTENDANCE_FIELDS;

  if (attendanceFields.has(fieldName)) return 1;
  if (FINANCIAL_FIELDS.has(fieldName)) return eventType === "session" ? 3 : 2;
  if (eventType === "event") return 2;
  if (recurrenceEnabled && fieldName.startsWith("recurrence")) return 1;
  return 2;
}

export function getAppointmentFieldsForStep(
  eventType: AppointmentEventType,
  recurrenceEnabled: boolean,
  step: number,
) {
  return getAppointmentFieldOrder(eventType, recurrenceEnabled).filter(
    (fieldName) => getAppointmentFieldStep(fieldName, eventType, recurrenceEnabled) === step,
  );
}

export function findFirstInvalidAppointmentField(
  errors: Record<string, unknown>,
  eventType: AppointmentEventType,
  recurrenceEnabled: boolean,
) {
  const orderedField = getAppointmentFieldOrder(eventType, recurrenceEnabled)
    .find((fieldName) => Boolean(errors[fieldName]));
  return orderedField || Object.keys(errors)[0] || null;
}

export function getAppointmentErrorMessage(
  errors: Record<string, unknown>,
  fieldName: string,
) {
  const error = errors[fieldName];
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

const validClockTime = (value?: string | null) => (
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
);

export function localDateAtTime(date: Date, time: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !validClockTime(time)) {
    return null;
  }
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function dateAtTimeInZone(
  date: Date,
  time: string,
  timeZone = "America/Sao_Paulo",
) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !validClockTime(time)) {
    return null;
  }
  const [hour, minute] = time.split(":").map(Number);
  const desired = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour,
    minute,
  };
  let timestamp = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const desiredAsUtc = Date.UTC(
      desired.year,
      desired.month - 1,
      desired.day,
      desired.hour,
      desired.minute,
    );
    const correction = desiredAsUtc - representedAsUtc;
    timestamp += correction;
    if (correction === 0) break;
  }
  return new Date(timestamp);
}

export interface AppointmentTimingIssue {
  field: "startTime" | "endTime";
  message: string;
}

export function validateAppointmentTiming({
  date,
  startTime,
  endTime,
  timeZone,
  now = new Date(),
}: {
  date: Date;
  startTime: string;
  endTime?: string | null;
  timeZone?: string;
  now?: Date;
}): AppointmentTimingIssue[] {
  const start = timeZone
    ? dateAtTimeInZone(date, startTime, timeZone)
    : localDateAtTime(date, startTime);
  if (!start) return [];

  const issues: AppointmentTimingIssue[] = [];
  if (start.getTime() <= now.getTime()) {
    issues.push({
      field: "startTime",
      message: "Escolha um horário futuro para continuar",
    });
  }

  if (!endTime || !validClockTime(endTime)) return issues;
  const end = timeZone
    ? dateAtTimeInZone(date, endTime, timeZone)
    : localDateAtTime(date, endTime);
  if (!end) return issues;
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (durationMinutes <= 0) {
    issues.push({
      field: "endTime",
      message: "O horário final deve ser posterior ao início no mesmo dia",
    });
  } else if (durationMinutes < 15) {
    issues.push({ field: "endTime", message: "A duração mínima é de 15 minutos" });
  } else if (durationMinutes > 1_440) {
    issues.push({ field: "endTime", message: "A duração máxima é de 24 horas" });
  }
  return issues;
}

const sameLocalDay = (left: Date, right: Date) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

const startOfLocalDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

export function getInitialAppointmentSlot({
  effectiveDate,
  selectedTime,
  now = new Date(),
  intervalMinutes = 15,
  durationMinutes = 50,
  workingHours,
}: {
  effectiveDate?: Date | null;
  selectedTime?: string | null;
  now?: Date;
  intervalMinutes?: number;
  durationMinutes?: number;
  workingHours?: unknown;
}) {
  const requestedDate = effectiveDate && !Number.isNaN(effectiveDate.getTime())
    ? new Date(effectiveDate)
    : new Date(now);

  if (selectedTime && validClockTime(selectedTime)) {
    return { date: requestedDate, startTime: selectedTime };
  }

  const today = startOfLocalDay(now);
  let date = startOfLocalDay(requestedDate);
  if (date < today) date = today;

  const safeInterval = Math.max(5, Math.min(60, Math.round(intervalMinutes)));
  const nextMinutes = sameLocalDay(date, now)
    ? (Math.floor((now.getHours() * 60 + now.getMinutes()) / safeInterval) + 1) * safeInterval
    : 9 * 60;
  if (nextMinutes >= 24 * 60) {
    date.setDate(date.getDate() + 1);
  }

  const formatMinutes = (value: number) => {
    const hours = String(Math.floor(value / 60)).padStart(2, "0");
    const minutes = String(value % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  const rawSlot = { date, startTime: formatMinutes(nextMinutes >= 24 * 60 ? 9 * 60 : nextMinutes) };
  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) {
    return rawSlot;
  }

  const schedule = workingHours as Record<string, unknown>;
  const safeDuration = Math.max(15, Math.min(1_440, Math.round(durationMinutes)));
  const firstCandidateDate = new Date(date);
  for (let offset = 0; offset <= 14; offset += 1) {
    const candidateDate = new Date(firstCandidateDate);
    candidateDate.setDate(candidateDate.getDate() + offset);
    const rawWindow = schedule[String(candidateDate.getDay())];
    if (!rawWindow || typeof rawWindow !== "object" || Array.isArray(rawWindow)) continue;
    const window = rawWindow as { enabled?: unknown; start?: unknown; end?: unknown };
    if (window.enabled !== true || !validClockTime(String(window.start || "")) || !validClockTime(String(window.end || ""))) {
      continue;
    }
    const [startHour, startMinute] = String(window.start).split(":").map(Number);
    const [endHour, endMinute] = String(window.end).split(":").map(Number);
    const windowStart = startHour * 60 + startMinute;
    const windowEnd = endHour * 60 + endMinute;
    let candidateMinutes = offset === 0 && sameLocalDay(candidateDate, now)
      ? Number(rawSlot.startTime.slice(0, 2)) * 60 + Number(rawSlot.startTime.slice(3, 5))
      : windowStart;
    candidateMinutes = Math.max(windowStart, candidateMinutes);
    candidateMinutes = Math.ceil(candidateMinutes / safeInterval) * safeInterval;
    if (candidateMinutes + safeDuration <= windowEnd) {
      return { date: candidateDate, startTime: formatMinutes(candidateMinutes) };
    }
  }

  return rawSlot;
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function appointmentPayloadFingerprint(value: unknown) {
  const serialized = JSON.stringify(canonicalize(value));
  let hash = 2_166_136_261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export type AppointmentFinancialMode =
  | "none"
  | "package"
  | "insurance"
  | "manual"
  | "neurofinance";

export function resolveAppointmentFinancialMode({
  eventType,
  usePackage,
  packageId,
  shouldCreateTransaction,
  shouldGenerateNeurofinanceCharge,
  canUseNeurofinance,
  insuranceConfigured = false,
}: {
  eventType: AppointmentEventType;
  usePackage: boolean;
  packageId?: string | null;
  shouldCreateTransaction: boolean;
  shouldGenerateNeurofinanceCharge: boolean;
  canUseNeurofinance: boolean;
  insuranceConfigured?: boolean;
}): AppointmentFinancialMode {
  if (eventType === "event") return "none";
  if (usePackage && packageId) return "package";
  if (!shouldCreateTransaction) return insuranceConfigured ? "insurance" : "none";
  if (shouldGenerateNeurofinanceCharge && canUseNeurofinance) return "neurofinance";
  return "manual";
}

export function normalizeOccurrenceOverride(
  override: OccurrenceOverride,
): OccurrenceOverride | null {
  const normalized: OccurrenceOverride = {
    occurrenceNumber: override.occurrenceNumber,
  };
  if (override.date?.trim()) normalized.date = override.date.trim();
  if (override.startTime?.trim()) normalized.startTime = override.startTime.trim();
  if (Number.isFinite(override.durationMinutes) && Number(override.durationMinutes) > 0) {
    normalized.durationMinutes = Number(override.durationMinutes);
  }
  if (override.modality) normalized.modality = override.modality;
  if (Object.prototype.hasOwnProperty.call(override, "location") && override.location !== undefined) {
    normalized.location = typeof override.location === "string"
      ? override.location.trim()
      : override.location;
  }

  const hasCustomization = Object.keys(normalized).some((key) => key !== "occurrenceNumber");
  if (!hasCustomization) return null;
  normalized.reason = override.reason?.trim() || "Ajuste individual definido na criação da série.";
  normalized.source = override.source || "professional";
  return normalized;
}

export function getOccurrenceOverrideIssue(overrides: OccurrenceOverride[]) {
  for (const override of overrides) {
    if (
      override.durationMinutes !== undefined
      && (override.durationMinutes < 15 || override.durationMinutes > 1_440)
    ) {
      return {
        occurrenceNumber: override.occurrenceNumber,
        field: "durationMinutes" as const,
        message: "A duração personalizada deve ficar entre 15 minutos e 24 horas",
      };
    }
    if (override.startTime && !validClockTime(override.startTime)) {
      return {
        occurrenceNumber: override.occurrenceNumber,
        field: "startTime" as const,
        message: "Informe um horário válido para a ocorrência personalizada",
      };
    }
    if (override.date && !/^\d{4}-\d{2}-\d{2}$/.test(override.date)) {
      return {
        occurrenceNumber: override.occurrenceNumber,
        field: "date" as const,
        message: "Informe uma data válida para a ocorrência personalizada",
      };
    }
  }
  return null;
}

export function revealAppointmentField(
  scrollContainer: HTMLElement,
  fieldName: string,
  reducedMotion = false,
) {
  const field = scrollContainer.querySelector<HTMLElement>(
    `[data-appointment-field="${fieldName}"]`,
  );
  if (!field) return false;

  const containerRect = scrollContainer.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const nextTop = Math.max(
    0,
    scrollContainer.scrollTop
      + fieldRect.top
      - containerRect.top
      - (scrollContainer.clientHeight - fieldRect.height) / 2,
  );
  if (typeof scrollContainer.scrollTo === "function") {
    scrollContainer.scrollTo({
      top: nextTop,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  } else {
    scrollContainer.scrollTop = nextTop;
  }

  const focusTarget = field.querySelector<HTMLElement>(
    '[data-appointment-focus][data-state="checked"], [data-appointment-focus], input:not([type="hidden"]), textarea, button[role="combobox"], button, [tabindex]:not([tabindex="-1"])',
  );
  focusTarget?.focus({ preventScroll: true });
  return true;
}
