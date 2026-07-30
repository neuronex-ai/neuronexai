import { describe, expect, it } from "vitest";

import { getAppointmentPlanIssues } from "../appointment-action-plans";

describe("appointment action plan issues", () => {
  it("keeps the server reason code and points a past occurrence to start time", () => {
    expect(getAppointmentPlanIssues({
      summary: {
        agenda: {
          conflicts: [{
            reasonCode: "past_time",
            reason: "A data ou o horário já passou.",
            occurrenceNumber: 2,
          }],
        },
      },
    })).toEqual([{
      code: "past_time",
      message: "A data ou o horário já passou.",
      field: "startTime",
      occurrenceNumber: 2,
      source: "agenda",
    }]);
  });

  it("falls back to a safe review issue when the server has no structured conflict", () => {
    expect(getAppointmentPlanIssues({ summary: { requiresReview: true } })).toEqual([{
      code: "review_required",
      message: "Revise os dados destacados antes de continuar.",
      source: "unknown",
    }]);
  });
});
