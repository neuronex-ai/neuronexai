import { describe, expect, it } from "vitest";

import type { Appointment } from "@/types";

import type { AttentionQueueItem } from "./dashboard-command-center-model";
import {
  buildDailyBriefingContext,
  getDailyBriefingCounts,
} from "./desktop-dashboard-morning-briefing-model";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "professional-1",
  patient_id: "patient-1",
  patient_name: "Carlos Almeida",
  start_time: "2026-08-25T09:00:00.000-03:00",
  end_time: "2026-08-25T09:50:00.000-03:00",
  type: "presencial",
  status: "confirmed",
  lifecycle_status: "confirmed",
  notes: null,
  location: "Consultório",
  created_at: "2026-08-20T12:00:00.000Z",
  metadata: { kind: "session", modality: "presencial" },
  ...overrides,
});

const attentionItem = (
  overrides: Partial<AttentionQueueItem> = {},
): AttentionQueueItem => ({
  id: "attention-1",
  label: "NeuroFinance",
  title: "Cobrança pendente",
  description: "Há uma cobrança para revisar.",
  actionUrl: "/financeiro",
  tone: "warning",
  source: "finance",
  category: "neurofinance",
  ...overrides,
});

describe("desktop dashboard morning briefing", () => {
  it("keeps total, pending and confirmed counts internally consistent", () => {
    const counts = getDailyBriefingCounts([
      appointment(),
      appointment({ id: "pending", status: "pending", lifecycle_status: "awaiting_confirmation" }),
      appointment({ id: "event", patient_id: null, metadata: { kind: "event" } }),
    ]);

    expect(counts).toEqual({ total: 2, pending: 1, confirmed: 1, online: 0 });
  });

  it("prioritizes an inactive NeuroFinance account", () => {
    const context = buildDailyBriefingContext({
      counts: { total: 3, pending: 1, confirmed: 2, online: 1 },
      attentionItems: [],
      financialConnected: false,
    });

    expect(context.actionLabel).toContain("NeuroFinance");
    expect(context.actionPath).toBe("/financeiro/neurofinance");
  });

  it("surfaces connected NeuroFinance pending work before generic attention", () => {
    const context = buildDailyBriefingContext({
      counts: { total: 3, pending: 0, confirmed: 3, online: 1 },
      attentionItems: [attentionItem(), attentionItem({ id: "attention-2" })],
      financialConnected: true,
    });

    expect(context.actionLabel).toBe("2 pendências no NeuroFinance");
    expect(context.actionPath).toContain("cobrancas-historia");
  });

  it("personalizes the next action when connected NeuroFinance has pending receivables", () => {
    const context = buildDailyBriefingContext({
      counts: { total: 3, pending: 1, confirmed: 2, online: 1 },
      attentionItems: [],
      financialConnected: true,
      neurofinancePendingAmount: 480,
    });

    expect(context.actionLabel).toContain("480,00");
    expect(context.actionLabel).toContain("NeuroFinance");
  });
});
