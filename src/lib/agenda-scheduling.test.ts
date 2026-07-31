import { describe, expect, it } from "vitest";

import {
  generateAgendaOccurrences,
  rankSmartFitCandidates,
} from "@/lib/agenda-scheduling";

const localDate = (value: string) => new Date(`${value}T09:00:00`);

describe("agenda scheduling", () => {
  it("generates more than one monthly day and preserves the base time", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-10"),
      durationMinutes: 50,
      rule: {
        kind: "monthly",
        monthDays: [10, 20],
        termination: { kind: "count", count: 4 },
        missingMonthDay: "last_business_day",
      },
    });

    expect(occurrences).toHaveLength(4);
    expect(occurrences.map((item) => new Date(item.startTime).getDate())).toEqual([10, 20, 10, 20]);
    expect(occurrences.every((item) => new Date(item.startTime).getHours() === 9)).toBe(true);
  });

  it("adjusts day 31 to the last allowed business day", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-01-31"),
      durationMinutes: 50,
      rule: {
        kind: "monthly",
        monthDays: [31],
        termination: { kind: "count", count: 2 },
        missingMonthDay: "last_business_day",
      },
      workingWeekDays: [1, 2, 3, 4, 5],
    });

    expect(occurrences[0].status).toBe("adjusted");
    expect(new Date(occurrences[0].startTime).getMonth()).toBe(1);
    expect(new Date(occurrences[0].startTime).getDay()).not.toBe(0);
    expect(new Date(occurrences[0].startTime).getDay()).not.toBe(6);
  });

  it("applies a partial override to one occurrence only", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "weekly",
        weekDays: [1],
        termination: { kind: "count", count: 4 },
      },
      overrides: [{ occurrenceNumber: 3, startTime: "08:00", reason: "Horário do paciente" }],
    });

    expect(new Date(occurrences[0].startTime).getHours()).toBe(9);
    expect(new Date(occurrences[2].startTime).getHours()).toBe(8);
    expect(occurrences[2].status).toBe("customized");
    expect(occurrences[3].status).toBe("standard");
  });

  it("caps an open recurrence at the 90-day materialization horizon", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "weekly",
        weekDays: [1],
        termination: { kind: "open", horizonDays: 180 },
      },
      now: localDate("2026-07-20"),
    });

    const last = new Date(occurrences.at(-1)!.startTime);
    expect(last.getTime() - localDate("2026-07-20").getTime()).toBeLessThanOrEqual(90 * 86_400_000);
  });

  it("ranks full-duration candidates before a closer shortened slot", () => {
    const original = { startTime: localDate("2026-07-20").toISOString(), durationMinutes: 50 };
    const shortened = { startTime: localDate("2026-07-20").toISOString(), durationMinutes: 30 };
    const full = { startTime: localDate("2026-07-21").toISOString(), durationMinutes: 50 };

    expect(rankSmartFitCandidates(original, [shortened, full])[0]).toEqual(full);
  });

  it("supports several weekdays without losing the first-session pattern", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "weekly",
        weekDays: [1, 3],
        termination: { kind: "count", count: 5 },
      },
    });

    expect(occurrences.map((item) => new Date(item.startTime).getDay())).toEqual([1, 3, 1, 3, 1]);
    expect(occurrences.every((item) => new Date(item.startTime).getHours() === 9)).toBe(true);
  });

  it("deduplicates and orders explicit dates inside the configured limit", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "custom_dates",
        customDates: ["2026-08-03", "2026-07-27", "2026-07-27", "2026-07-19"],
        termination: { kind: "count", count: 4 },
      },
    });

    expect(occurrences.map((item) => item.startTime.slice(0, 10))).toEqual([
      "2026-07-27",
      "2026-08-03",
    ]);
  });

  it("distributes a fixed session count across the complete date range", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "range_distribution",
        customDates: ["2026-08-10"],
        termination: { kind: "count", count: 4 },
      },
    });

    expect(occurrences.map((item) => item.startTime.slice(0, 10))).toEqual([
      "2026-07-20",
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
    ]);
    expect(occurrences[1].status).toBe("adjusted");
  });

  it("rejects a final date before the first session", () => {
    expect(() => generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "weekly",
        weekDays: [1],
        termination: { kind: "until", untilDate: "2026-07-19" },
      },
    })).toThrow("A data final precisa ser igual ou posterior");
  });

  it("marks modality and location as personalized without changing the base time", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "weekly",
        weekDays: [1],
        termination: { kind: "count", count: 2 },
      },
      overrides: [{
        occurrenceNumber: 2,
        modality: "online",
        location: null,
        reason: "Exceção de modalidade",
      }],
    });

    expect(occurrences[1]).toMatchObject({
      status: "customized",
      changedFields: ["modality", "location"],
      overrideReason: "Exceção de modalidade",
    });
    expect(new Date(occurrences[1].startTime).getHours()).toBe(9);
  });

  it("removes an occurrence from the canonical result and renumbers the remainder", () => {
    const occurrences = generateAgendaOccurrences({
      firstStartTime: localDate("2026-07-20"),
      durationMinutes: 50,
      rule: {
        kind: "weekly",
        weekDays: [1],
        termination: { kind: "count", count: 4 },
      },
      overrides: [{
        occurrenceNumber: 3,
        startTime: "08:00",
        reason: "Exceção preservada depois da remoção",
      }],
      excludedOccurrenceNumbers: [2],
    });

    expect(occurrences).toHaveLength(3);
    expect(occurrences.map((item) => item.occurrenceNumber)).toEqual([1, 2, 3]);
    expect(occurrences.map((item) => item.originalOccurrenceNumber)).toEqual([1, 3, 4]);
    expect(new Date(occurrences[1].startTime).getHours()).toBe(8);
    expect(occurrences[1].overrideReason).toContain("preservada");
  });
});
