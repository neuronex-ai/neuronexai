import { describe, expect, it } from "vitest";

import {
  findProfessionalWaitlistSuggestion,
  toDateTimeLocalValue,
} from "@/lib/professional-waitlist-suggestion";
import type { Appointment } from "@/types";

const entry = {
  valid_from: "2026-07-01",
  valid_until: null,
  minimum_duration_minutes: 50,
  preferred_duration_minutes: 50,
  professional_waitlist_windows: [{
    weekday: 1,
    specific_date: null,
    start_time: "13:50:00",
    end_time: "16:20:00",
  }],
  professional_waitlist_offers: [],
};

const appointment = (
  id: string,
  start: string,
  end: string,
  status = "confirmed",
): Appointment => ({
  id,
  user_id: "professional",
  patient_id: "patient",
  start_time: start,
  end_time: end,
  status,
  type: "presencial",
  notes: null,
  location: null,
  metadata: {},
  created_at: start,
} as Appointment);

describe("findProfessionalWaitlistSuggestion", () => {
  it("prefers the exact future slot from an existing pending offer", () => {
    const suggestion = findProfessionalWaitlistSuggestion({
      ...entry,
      professional_waitlist_offers: [{
        status: "pending",
        offered_start_time: "2026-07-27T16:50:00.000Z",
        offered_end_time: "2026-07-27T17:40:00.000Z",
        expires_at: "2026-07-23T14:00:00.000Z",
      }],
    }, [], { now: new Date("2026-07-23T12:00:00.000Z") });

    expect(suggestion?.source).toBe("pending_offer");
    expect(suggestion?.durationMinutes).toBe(50);
    expect(suggestion?.startsAt.toISOString()).toBe("2026-07-27T16:50:00.000Z");
  });

  it("finds the earliest free five-minute interval in the configured window", () => {
    const busyStart = new Date(2026, 6, 27, 13, 50);
    const busyEnd = new Date(2026, 6, 27, 14, 40);
    const busy = appointment(
      "busy",
      busyStart.toISOString(),
      busyEnd.toISOString(),
    );
    const suggestion = findProfessionalWaitlistSuggestion(
      entry,
      [busy],
      { now: new Date(2026, 6, 23, 12) },
    );

    expect(suggestion?.source).toBe("calculated");
    expect(toDateTimeLocalValue(suggestion!.startsAt)).toBe("2026-07-27T14:40");
    expect(suggestion?.durationMinutes).toBe(50);
  });

  it("ignores cancelled appointments when calculating a vacancy", () => {
    const cancelledStart = new Date(2026, 6, 27, 13, 50);
    const cancelledEnd = new Date(2026, 6, 27, 14, 40);
    const cancelled = appointment(
      "cancelled",
      cancelledStart.toISOString(),
      cancelledEnd.toISOString(),
      "cancelled",
    );
    const suggestion = findProfessionalWaitlistSuggestion(
      entry,
      [cancelled],
      { now: new Date(2026, 6, 23, 12) },
    );

    expect(toDateTimeLocalValue(suggestion!.startsAt)).toBe("2026-07-27T13:50");
  });

  it("returns null when no configured window can fit the minimum duration", () => {
    const suggestion = findProfessionalWaitlistSuggestion({
      ...entry,
      minimum_duration_minutes: 60,
      preferred_duration_minutes: 60,
      professional_waitlist_windows: [{
        weekday: 1,
        specific_date: null,
        start_time: "13:50:00",
        end_time: "14:20:00",
      }],
    }, [], { now: new Date(2026, 6, 23, 12) });

    expect(suggestion).toBeNull();
  });

  it("treats pending offers from other waitlist entries as occupied", () => {
    const reservedStart = new Date(2026, 6, 27, 13, 50);
    const reservedEnd = new Date(2026, 6, 27, 14, 40);
    const suggestion = findProfessionalWaitlistSuggestion(entry, [], {
      now: new Date(2026, 6, 23, 12),
      reservedOffers: [{
        status: "pending",
        offered_start_time: reservedStart.toISOString(),
        offered_end_time: reservedEnd.toISOString(),
        expires_at: new Date(2026, 6, 23, 14).toISOString(),
      }],
    });

    expect(toDateTimeLocalValue(suggestion!.startsAt)).toBe("2026-07-27T14:40");
  });

  it("does not reserve intervals from completed waitlist offers", () => {
    const declinedStart = new Date(2026, 6, 27, 13, 50);
    const declinedEnd = new Date(2026, 6, 27, 14, 40);
    const suggestion = findProfessionalWaitlistSuggestion(entry, [], {
      now: new Date(2026, 6, 23, 12),
      reservedOffers: [{
        status: "declined",
        offered_start_time: declinedStart.toISOString(),
        offered_end_time: declinedEnd.toISOString(),
        expires_at: new Date(2026, 6, 23, 14).toISOString(),
      }],
    });

    expect(toDateTimeLocalValue(suggestion!.startsAt)).toBe("2026-07-27T13:50");
  });

  it("ignores a pending status after its reservation has expired", () => {
    const now = new Date(2026, 6, 23, 12);
    const offeredStart = new Date(2026, 6, 27, 15);
    const offeredEnd = new Date(2026, 6, 27, 15, 50);
    const suggestion = findProfessionalWaitlistSuggestion({
      ...entry,
      professional_waitlist_offers: [{
        status: "pending",
        offered_start_time: offeredStart.toISOString(),
        offered_end_time: offeredEnd.toISOString(),
        expires_at: new Date(2026, 6, 23, 11, 59).toISOString(),
      }],
    }, [], { now });

    expect(suggestion?.source).toBe("calculated");
    expect(toDateTimeLocalValue(suggestion!.startsAt)).toBe("2026-07-27T13:50");
  });
});
