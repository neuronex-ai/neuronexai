import { describe, expect, it } from "vitest";

import type { Patient } from "@/types";
import {
  ATTENTION_WEIGHTS,
  buildAttentionReasons,
  buildEvidenceNodes,
  buildPatientAttentionSummary,
  DENSITY_WEIGHTS,
} from "./evidence-model";
import type { EvidenceIndexRow, EvidenceOverrideRow } from "./evidence-types";

const NOW = Date.UTC(2026, 7, 22, 12);
const DAY = 86_400_000;

const row = (
  id: string,
  overrides: Partial<EvidenceIndexRow> = {},
): EvidenceIndexRow => ({
  id,
  user_id: "user-a",
  patient_id: "patient-a",
  source_type: "personal_note",
  source_id: id,
  occurred_at: new Date(NOW).toISOString(),
  updated_at: new Date(NOW).toISOString(),
  title: id,
  tags: ["Ansiedade"],
  reviewed: true,
  is_actionable: false,
  action_due_at: null,
  action_completed: false,
  metadata: {},
  ...overrides,
});

const preference = (sourceId: string, priority: number): EvidenceOverrideRow => ({
  id: `override-${sourceId}`,
  user_id: "user-a",
  source_type: "personal_note",
  source_id: sourceId,
  priority,
  is_pinned: false,
  is_hidden: false,
  theme_override: null,
  updated_at: new Date(NOW).toISOString(),
});

describe("NeuroVision explainable attention", () => {
  it("uses a 30-day half-life and keeps attention distinct from density", () => {
    const item = buildEvidenceNodes([
      row("half-life", { occurred_at: new Date(NOW - 30 * 86_400_000).toISOString() }),
    ], [], NOW)[0];

    expect(item.gravity.recency).toBeCloseTo(0.5, 5);
    expect(item.gravity.recurrence).toBeCloseTo(0.2, 5);
    expect(item.gravity.sourceDiversity).toBeCloseTo(0.25, 5);
    expect(item.gravity.density).toBeCloseTo(
      0.2 * DENSITY_WEIGHTS.recurrence
      + 0.25 * DENSITY_WEIGHTS.sourceDiversity
      + 0.8 * DENSITY_WEIGHTS.relationSupport,
      5,
    );
    expect(item.gravity.score).toBeCloseTo(
      item.gravity.density * ATTENTION_WEIGHTS.density
      + item.gravity.tension * ATTENTION_WEIGHTS.tension
      + 0.5 * ATTENTION_WEIGHTS.recency,
      5,
    );
  });

  it("caps recurrence and source diversity and includes explicit clinical priority", () => {
    const rows = [
      row("one"),
      row("two", { source_type: "flow" }),
      row("three", { source_type: "session_note" }),
      row("four", { source_type: "mood" }),
      row("five", { source_type: "goal" }),
      row("six", { source_type: "appointment" }),
    ];
    const items = buildEvidenceNodes(rows, [preference("one", 100)], NOW);
    expect(items[0].gravity.recurrence).toBe(1);
    expect(items[0].gravity.sourceDiversity).toBe(1);
    expect(items[0].gravity.clinicianPriority).toBe(1);
    expect(items[0].gravity.density).toBeLessThanOrEqual(1);
  });

  it("keeps unreviewed AI-derived evidence outside gravity", () => {
    const item = buildEvidenceNodes([
      row("pending", { source_type: "session_note", reviewed: false, is_actionable: true }),
    ], [], NOW)[0];
    expect(item.gravity).toMatchObject({ eligible: false, score: 0, density: 0, tension: 0, recency: 0, actionability: 0 });
  });

  it("keeps recorded risk separate and reports objective attention reasons", () => {
    const patient = {
      id: "patient-a",
      user_id: "user-a",
      name: "Paciente A",
      risk_score: 4,
      risk_score_scale: 10,
    } as Patient;
    const evidence = buildEvidenceNodes([
      row("pending", { source_type: "session_note", reviewed: false }),
      row("overdue", {
        source_type: "goal",
        is_actionable: true,
        action_due_at: new Date(NOW - 86_400_000).toISOString(),
      }),
    ], [], NOW);
    const reasons = buildAttentionReasons(patient, evidence, NOW);
    expect(reasons.map((reason) => reason.type)).toEqual([
      "recorded-risk",
      "overdue-action",
      "pending-review",
    ]);
    expect(evidence.every((item) => item.gravity.score <= 1)).toBe(true);
  });

  it("treats missing objective change as unavailable instead of inventing a zero", () => {
    const item = buildEvidenceNodes([
      row("single-mood", { source_type: "mood", metadata: { moodScore: 6 } }),
    ], [], NOW)[0];
    expect(item.gravity.objectiveChange).toBeNull();
    expect(item.gravity.confidence).toBeGreaterThan(0);
    expect(item.gravity.confidence).toBeLessThan(1);
  });

  it("summarizes patient attention without adding registered risk to the score", () => {
    const evidence = buildEvidenceNodes([
      row("one"),
      row("two", { tags: ["Sono"], is_actionable: true, action_due_at: new Date(NOW - DAY).toISOString() }),
    ], [], NOW);
    const summary = buildPatientAttentionSummary("patient-a", evidence, NOW);
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.dominantTheme).toBeTruthy();
    expect(summary.evidenceCount).toBe(2);
  });
});
