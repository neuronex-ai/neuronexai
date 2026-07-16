import {
  AppointmentLifecycleError,
  type ResolvedAppointmentInvitation,
} from "./appointment-lifecycle.ts";

const SLOT_INTERVAL_MINUTES = 30;
const MAX_MONTHS_AHEAD = 6;

type WorkingDay = { enabled?: boolean; start?: string; end?: string };
type PatientAppointmentContext = Omit<
  ResolvedAppointmentInvitation,
  "tokenHash" | "tokenRow"
>;
type AppointmentDatabaseClient = {
  from: (relation: string) => any;
};

function parseDate(value: unknown) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppointmentLifecycleError(
      "Selecione uma data válida.",
      400,
      "INVALID_DATE",
    );
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new AppointmentLifecycleError(
      "Selecione uma data válida.",
      400,
      "INVALID_DATE",
    );
  }
  return { date, parsed };
}

function dateInTimeZone(timeZone: string, value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function addCalendarMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day, 12)).toISOString()
    .slice(0, 10);
}

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days, 12)).toISOString()
    .slice(0, 10);
}

function timeZoneOffsetMilliseconds(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value || 0);
  return Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  ) - value.getTime();
}

function minutesFromClock(value: unknown) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function localDateTime(date: string, minuteOfDay: number, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const localAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
  );
  let candidate = new Date(localAsUtc);
  candidate = new Date(
    localAsUtc - timeZoneOffsetMilliseconds(candidate, timeZone),
  );
  return new Date(localAsUtc - timeZoneOffsetMilliseconds(candidate, timeZone));
}

export async function calculatePatientAppointmentAvailability(
  db: AppointmentDatabaseClient,
  context: PatientAppointmentContext,
  dateValue: unknown,
) {
  const { date, parsed } = parseDate(dateValue);
  const appointment = context.appointment;
  if (
    ["cancelled", "in_progress", "completed", "closed"].includes(
      String(appointment.lifecycle_status || "created"),
    )
  ) {
    throw new AppointmentLifecycleError(
      "Este agendamento não aceita mais reagendamento.",
      409,
      "RESCHEDULE_NOT_ALLOWED",
    );
  }

  const timeZone = String(
    context.policySnapshot?.timezone || "America/Sao_Paulo",
  );
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new AppointmentLifecycleError(
      "Fuso horário do agendamento inválido.",
      409,
      "INVALID_TIMEZONE",
    );
  }

  const today = dateInTimeZone(timeZone);
  if (date < today) {
    throw new AppointmentLifecycleError(
      "Datas passadas não estão disponíveis.",
      400,
      "PAST_DATE",
    );
  }
  if (date > addCalendarMonths(today, MAX_MONTHS_AHEAD)) {
    throw new AppointmentLifecycleError(
      "Escolha uma data dentro dos próximos seis meses.",
      400,
      "DATE_OUT_OF_RANGE",
    );
  }

  const durationMinutes = Math.round(
    (new Date(appointment.end_time).getTime() -
      new Date(appointment.start_time).getTime()) / 60_000,
  );
  if (durationMinutes <= 0) {
    throw new AppointmentLifecycleError(
      "Duração do agendamento inválida.",
      409,
      "INVALID_DURATION",
    );
  }

  const workingHours = (context.professional?.working_hours || {}) as Record<
    string,
    WorkingDay
  >;
  const day = workingHours[String(parsed.getUTCDay())];
  const startMinute = minutesFromClock(day?.start);
  const endMinute = minutesFromClock(day?.end);
  if (
    !day?.enabled || startMinute === null || endMinute === null ||
    endMinute <= startMinute
  ) {
    return {
      date,
      durationMinutes,
      intervalMinutes: SLOT_INTERVAL_MINUTES,
      availableSlots: [],
      reason: Object.keys(workingHours).length === 0
        ? "availability_not_configured"
        : "professional_unavailable",
    };
  }

  const dayStart = localDateTime(date, 0, timeZone);
  const dayEnd = localDateTime(addCalendarDays(date, 1), 0, timeZone);
  const [busyResult, rejectedResult] = await Promise.all([
    db.from("appointments")
      .select("id,start_time,end_time")
      .eq("user_id", appointment.user_id)
      .neq("id", appointment.id)
      .neq("lifecycle_status", "cancelled")
      .not(
        "status",
        "in",
        "(cancelled_by_patient,cancelled_by_professional,cancelled,canceled)",
      )
      .lt("start_time", dayEnd.toISOString())
      .gt("end_time", dayStart.toISOString()),
    db.from("appointment_reschedule_requests")
      .select("requested_start_time,requested_end_time")
      .eq("appointment_id", appointment.id)
      .eq("appointment_revision", appointment.confirmation_revision)
      .eq("status", "rejected"),
  ]);
  if (busyResult.error) throw busyResult.error;
  if (rejectedResult.error) throw rejectedResult.error;

  const busySlots: Array<{ start: number; end: number }> = (
    busyResult.data || []
  ).map((slot: Record<string, string>) => ({
    start: new Date(slot.start_time).getTime(),
    end: new Date(slot.end_time).getTime(),
  }));
  const rejectedSlots: Array<{ start: number; end: number }> = (
    rejectedResult.data || []
  ).map((slot: Record<string, string>) => ({
    start: new Date(slot.requested_start_time).getTime(),
    end: new Date(slot.requested_end_time).getTime(),
  }));
  const now = Date.now();
  const originalStart = new Date(appointment.start_time).getTime();
  const originalEnd = new Date(appointment.end_time).getTime();
  const availableSlots: Array<
    { label: string; startTime: string; endTime: string }
  > = [];

  for (
    let minute = startMinute;
    minute + durationMinutes <= endMinute;
    minute += SLOT_INTERVAL_MINUTES
  ) {
    const start = localDateTime(date, minute, timeZone);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const original = start.getTime() === originalStart &&
      end.getTime() === originalEnd;
    const busy = busySlots.some((slot) =>
      start.getTime() < slot.end && end.getTime() > slot.start
    );
    const rejected = rejectedSlots.some((slot) =>
      start.getTime() === slot.start && end.getTime() === slot.end
    );
    if (start.getTime() > now && !original && !busy && !rejected) {
      availableSlots.push({
        label: String(Math.floor(minute / 60)).padStart(2, "0") + ":" +
          String(minute % 60).padStart(2, "0"),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
    }
  }

  return {
    date,
    durationMinutes,
    intervalMinutes: SLOT_INTERVAL_MINUTES,
    availableSlots,
    reason: availableSlots.length === 0 ? "no_available_slots" : null,
    generatedAt: new Date().toISOString(),
  };
}
