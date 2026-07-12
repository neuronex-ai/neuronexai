import { describe, expect, it } from "vitest";

import {
  asPatientRecordSummary,
  emptyPatientRecordSummary,
} from "./use-patient-record-summary";

describe("patient record summary normalization", () => {
  it("normalizes a complete RPC payload", () => {
    expect(asPatientRecordSummary({
      completedSessions: "4",
      pendingReviews: 1,
      documents: 3,
      activeGoals: 2,
      openBalance: "250.50",
      riskScore: 5,
      nextSession: { id: "next", start_time: "2026-07-13T12:00:00Z", type: "online" },
    })).toMatchObject({
      completedSessions: 4,
      pendingReviews: 1,
      documents: 3,
      activeGoals: 2,
      openBalance: 250.5,
      riskScore: 5,
      nextSession: { id: "next" },
    });
  });

  it("returns a stable empty state for an empty or malformed payload", () => {
    expect(asPatientRecordSummary(null)).toEqual(emptyPatientRecordSummary);
    expect(asPatientRecordSummary([])).toEqual(emptyPatientRecordSummary);
  });
});
