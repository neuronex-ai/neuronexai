import { describe, expect, it } from "vitest";

import {
  appointmentSeriesSummary,
  normalizeAppointmentSeriesCreateResult,
  normalizeAppointmentSeriesPreview,
} from "@/lib/appointment-recurrence";

describe("appointment recurrence DTO", () => {
  it("keeps an exact six-session weekly preview, including the first date", () => {
    const occurrences = Array.from({ length: 6 }, (_, index) => ({
      occurrenceNumber: index + 1,
      startTime: new Date(Date.UTC(2026, 7, 3 + index * 7, 12, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 7, 3 + index * 7, 12, 50)).toISOString(),
      status: "available",
      reasonCode: null,
      reason: null,
    }));
    const preview = normalizeAppointmentSeriesPreview({
      valid: true,
      frequency: "weekly",
      totalOccurrences: 6,
      durationMinutes: 50,
      firstStartTime: occurrences[0].startTime,
      lastStartTime: occurrences[5].startTime,
      occurrences,
      conflicts: [],
    });

    expect(preview.occurrences).toHaveLength(6);
    expect(preview.occurrences.map((item) => item.occurrenceNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(preview.firstStartTime).toBe(occurrences[0].startTime);
    expect(preview.lastStartTime).toBe(occurrences[5].startTime);
    expect(appointmentSeriesSummary("weekly", 6)).toBe("6 sessões semanais");
  });

  it.each([
    ["biweekly", 4, "4 sessões quinzenais"],
    ["monthly", 3, "3 sessões mensais"],
  ] as const)("humanizes %s recurrence", (frequency, count, summary) => {
    expect(appointmentSeriesSummary(frequency, count)).toBe(summary);
  });

  it("normalizes six different appointment IDs linked to the same series", () => {
    const seriesId = "8a14728f-9658-46ea-891f-c157e74e5648";
    const appointments = Array.from({ length: 6 }, (_, index) => ({
      appointmentId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      seriesId,
      occurrenceNumber: index + 1,
      occurrenceCount: 6,
      startTime: new Date(Date.UTC(2026, 7, 3 + index * 7, 12, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 7, 3 + index * 7, 12, 50)).toISOString(),
    }));
    const result = normalizeAppointmentSeriesCreateResult({
      success: true,
      seriesId,
      frequency: "weekly",
      totalOccurrences: 6,
      appointments,
      conflicts: [],
    });

    expect(result.success).toBe(true);
    expect(new Set(result.appointments.map((item) => item.appointmentId)).size).toBe(6);
    expect(new Set(result.appointments.map((item) => item.seriesId))).toEqual(new Set([seriesId]));
    expect(result.appointments.map((item) => item.occurrenceNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.appointments.every((item) => item.occurrenceCount === 6)).toBe(true);
  });

  it("returns conflicts without partially created appointments", () => {
    const result = normalizeAppointmentSeriesCreateResult({
      success: false,
      valid: false,
      frequency: "monthly",
      totalOccurrences: 3,
      durationMinutes: 50,
      firstStartTime: "2026-08-03T12:00:00.000Z",
      lastStartTime: "2026-10-03T12:00:00.000Z",
      occurrences: [
        {
          occurrenceNumber: 2,
          startTime: "2026-09-03T12:00:00.000Z",
          endTime: "2026-09-03T12:50:00.000Z",
          status: "conflict",
          reasonCode: "appointment_conflict",
          reason: "Já existe um compromisso neste horário.",
        },
      ],
      conflicts: [
        {
          occurrenceNumber: 2,
          startTime: "2026-09-03T12:00:00.000Z",
          endTime: "2026-09-03T12:50:00.000Z",
          status: "conflict",
          reasonCode: "appointment_conflict",
          reason: "Já existe um compromisso neste horário.",
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.appointments).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.preview?.valid).toBe(false);
  });
});
