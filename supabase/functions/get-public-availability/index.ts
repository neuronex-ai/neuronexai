import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  AppointmentLifecycleError,
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentErrorResponse,
  appointmentJson,
  resolveAppointmentInvitation,
} from "../_shared/appointment-lifecycle.ts";

const TIME_ZONE_OFFSET = "-03:00";
const SLOT_INTERVAL_MINUTES = 30;
const MAX_MONTHS_AHEAD = 6;

type WorkingDay = {
  enabled?: boolean;
  start?: string;
  end?: string;
};

function parseDate(value: unknown) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppointmentLifecycleError("Selecione uma data valida.", 400, "INVALID_DATE");
  }

  const parsed = new Date(`${date}T12:00:00${TIME_ZONE_OFFSET}`);
  if (!Number.isFinite(parsed.getTime())) {
    throw new AppointmentLifecycleError("Selecione uma data valida.", 400, "INVALID_DATE");
  }
  return { date, parsed };
}

function saoPauloDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function minutesFromClock(value: unknown) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function clockFromMinutes(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function localDateTime(date: string, minuteOfDay: number) {
  return new Date(`${date}T${clockFromMinutes(minuteOfDay)}:00${TIME_ZONE_OFFSET}`);
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: appointmentCorsHeaders });
  if (request.method !== "POST") return appointmentJson({ error: "Metodo nao permitido." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const { date, parsed } = parseDate(body.date);
    const today = saoPauloDate();
    const limit = new Date(`${today}T12:00:00${TIME_ZONE_OFFSET}`);
    limit.setUTCMonth(limit.getUTCMonth() + MAX_MONTHS_AHEAD);

    if (date < today) {
      throw new AppointmentLifecycleError("Datas passadas nao estao disponiveis.", 400, "PAST_DATE");
    }
    if (parsed > limit) {
      throw new AppointmentLifecycleError(
        "Escolha uma data dentro dos proximos seis meses.",
        400,
        "DATE_OUT_OF_RANGE",
      );
    }

    const db = appointmentAdminClient();
    const context = await resolveAppointmentInvitation(db, token);
    const appointment = context.appointment;
    const lifecycleStatus = String(appointment.lifecycle_status || "created");
    if (["cancelled", "completed", "closed"].includes(lifecycleStatus)) {
      throw new AppointmentLifecycleError(
        "Este agendamento nao aceita mais reagendamento.",
        409,
        "RESCHEDULE_NOT_ALLOWED",
      );
    }

    const durationMinutes = Math.round(
      (new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60_000,
    );
    if (durationMinutes <= 0) {
      throw new AppointmentLifecycleError("Duracao do agendamento invalida.", 409, "INVALID_DURATION");
    }

    const workingHours = (context.professional?.working_hours || {}) as Record<string, WorkingDay>;
    const day = workingHours[String(parsed.getUTCDay())];
    const startMinute = minutesFromClock(day?.start);
    const endMinute = minutesFromClock(day?.end);

    if (!day?.enabled || startMinute === null || endMinute === null || endMinute <= startMinute) {
      return appointmentJson({
        date,
        durationMinutes,
        intervalMinutes: SLOT_INTERVAL_MINUTES,
        availableSlots: [],
        reason: Object.keys(workingHours).length === 0 ? "availability_not_configured" : "professional_unavailable",
      });
    }

    const dayStart = new Date(`${date}T00:00:00${TIME_ZONE_OFFSET}`);
    const dayEnd = new Date(`${date}T23:59:59.999${TIME_ZONE_OFFSET}`);
    const busyResult = await db
      .from("appointments")
      .select("id,start_time,end_time")
      .eq("user_id", appointment.user_id)
      .neq("id", appointment.id)
      .neq("lifecycle_status", "cancelled")
      .not("status", "in", "(cancelled_by_patient,cancelled_by_professional,cancelled,canceled)")
      .lt("start_time", dayEnd.toISOString())
      .gt("end_time", dayStart.toISOString());
    if (busyResult.error) throw busyResult.error;

    const busySlots = (busyResult.data || []).map((slot) => ({
      start: new Date(slot.start_time).getTime(),
      end: new Date(slot.end_time).getTime(),
    }));
    const now = Date.now();
    const originalStart = new Date(appointment.start_time).getTime();
    const originalEnd = new Date(appointment.end_time).getTime();
    const availableSlots = [];

    for (let minute = startMinute; minute + durationMinutes <= endMinute; minute += SLOT_INTERVAL_MINUTES) {
      const start = localDateTime(date, minute);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const isOriginalTime = start.getTime() === originalStart && end.getTime() === originalEnd;
      const isBusy = busySlots.some((slot) => start.getTime() < slot.end && end.getTime() > slot.start);
      if (start.getTime() > now && !isOriginalTime && !isBusy) {
        availableSlots.push({
          label: clockFromMinutes(minute),
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });
      }
    }

    return appointmentJson({
      date,
      durationMinutes,
      intervalMinutes: SLOT_INTERVAL_MINUTES,
      availableSlots,
      reason: availableSlots.length === 0 ? "no_available_slots" : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[get-public-availability]", error);
    return appointmentErrorResponse(error);
  }
});
