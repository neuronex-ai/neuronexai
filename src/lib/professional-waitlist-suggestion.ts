import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";

import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
import type { Appointment } from "@/types";

interface WaitlistWindowLike {
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
}

interface WaitlistOfferLike {
  status: string;
  offered_start_time: string;
  offered_end_time: string;
  expires_at: string;
}

interface WaitlistEntryLike {
  valid_from: string;
  valid_until: string | null;
  minimum_duration_minutes: number;
  preferred_duration_minutes: number;
  professional_waitlist_windows: WaitlistWindowLike[];
  professional_waitlist_offers: WaitlistOfferLike[];
}

export interface ProfessionalWaitlistSuggestion {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  source: "pending_offer" | "calculated";
}

interface ProfessionalWaitlistSuggestionOptions {
  now?: Date;
  searchDays?: number;
  reservedOffers?: WaitlistOfferLike[];
}

const localDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const atLocalTime = (day: Date, time: string) => {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const overlapsBusyAppointment = (
  startsAt: Date,
  endsAt: Date,
  appointments: Appointment[],
) => appointments.some((appointment) => {
  if (isCancelledAppointmentStatus(appointment.status, appointment.notes)) return false;
  const busyStart = new Date(appointment.start_time);
  const busyEnd = new Date(appointment.end_time);
  return startsAt < busyEnd && endsAt > busyStart;
});

const overlapsPendingOffer = (
  startsAt: Date,
  endsAt: Date,
  offers: WaitlistOfferLike[],
  now: Date,
) => offers.some((offer) => {
  if (offer.status !== "pending") return false;
  const busyStart = new Date(offer.offered_start_time);
  const busyEnd = new Date(offer.offered_end_time);
  const expiresAt = new Date(offer.expires_at);
  if (
    Number.isNaN(busyStart.getTime())
    || Number.isNaN(busyEnd.getTime())
    || Number.isNaN(expiresAt.getTime())
    || !isAfter(expiresAt, now)
    || !isAfter(busyEnd, busyStart)
  ) return false;
  return startsAt < busyEnd && endsAt > busyStart;
});

const nextFiveMinuteBoundary = (value: Date) => {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % 5;
  if (remainder) rounded.setMinutes(rounded.getMinutes() + (5 - remainder));
  return rounded;
};

/**
 * Resolves the exact vacancy shown in the professional confirmation UI.
 * Existing pending offers remain the source of truth; otherwise the earliest
 * free interval inside the patient's configured windows is selected.
 */
export const findProfessionalWaitlistSuggestion = (
  entry: WaitlistEntryLike,
  appointments: Appointment[],
  {
    now = new Date(),
    searchDays = 56,
    reservedOffers = [],
  }: ProfessionalWaitlistSuggestionOptions = {},
): ProfessionalWaitlistSuggestion | null => {
  const pendingOffer = entry.professional_waitlist_offers
    .filter((offer) => (
      offer.status === "pending"
      && isAfter(new Date(offer.expires_at), now)
    ))
    .map((offer) => ({
      startsAt: new Date(offer.offered_start_time),
      endsAt: new Date(offer.offered_end_time),
    }))
    .filter(({ startsAt, endsAt }) => isAfter(startsAt, now) && isAfter(endsAt, startsAt))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())[0];

  if (pendingOffer) {
    return {
      ...pendingOffer,
      durationMinutes: differenceInMinutes(pendingOffer.endsAt, pendingOffer.startsAt),
      source: "pending_offer",
    };
  }

  if (!entry.professional_waitlist_windows.length) return null;

  const validityStart = startOfDay(localDate(entry.valid_from));
  const firstDay = isAfter(validityStart, now) ? validityStart : startOfDay(now);
  const horizon = addDays(startOfDay(now), searchDays);
  const validityEnd = entry.valid_until ? localDate(entry.valid_until) : horizon;
  const lastDay = isBefore(validityEnd, horizon) ? validityEnd : horizon;
  const preferredDuration = Math.max(
    entry.minimum_duration_minutes,
    entry.preferred_duration_minutes,
  );

  for (let day = firstDay; !isAfter(day, lastDay); day = addDays(day, 1)) {
    const dayKey = format(day, "yyyy-MM-dd");
    const matchingWindows = entry.professional_waitlist_windows
      .filter((window) => window.specific_date
        ? window.specific_date === dayKey
        : window.weekday === day.getDay())
      .sort((left, right) => left.start_time.localeCompare(right.start_time));

    for (const window of matchingWindows) {
      const windowStart = atLocalTime(day, window.start_time);
      const windowEnd = atLocalTime(day, window.end_time);
      const duration = Math.min(
        preferredDuration,
        differenceInMinutes(windowEnd, windowStart),
      );
      if (duration < entry.minimum_duration_minutes) continue;

      let candidateStart = isAfter(now, windowStart)
        ? nextFiveMinuteBoundary(now)
        : windowStart;

      while (!isAfter(addMinutes(candidateStart, duration), windowEnd)) {
        const candidateEnd = addMinutes(candidateStart, duration);
        if (
          isAfter(candidateStart, now)
          && !overlapsBusyAppointment(candidateStart, candidateEnd, appointments)
          && !overlapsPendingOffer(candidateStart, candidateEnd, reservedOffers, now)
        ) {
          return {
            startsAt: candidateStart,
            endsAt: candidateEnd,
            durationMinutes: duration,
            source: "calculated",
          };
        }
        candidateStart = addMinutes(candidateStart, 5);
      }
    }
  }

  return null;
};

export const toDateTimeLocalValue = (value: Date) =>
  format(value, "yyyy-MM-dd'T'HH:mm");
