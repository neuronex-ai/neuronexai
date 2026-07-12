import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import {
  buildFinancialManagementMetrics,
  managementAllowsManualSettlement,
  managementOriginOf,
} from "../financial-management-model";
const tx = (o: Partial<Transaction>): Transaction => ({
  id: "e1",
  user_id: "u1",
  description: "Sessão",
  amount: 100,
  type: "income",
  category: "Sessão",
  date: "2026-07-10",
  appointment_id: null,
  created_at: "2026-07-10T12:00:00Z",
  status: "pending",
  metadata: {
    financial_entry_status: "pending",
    due_date: "2026-07-10",
    competence_date: "2026-07-10",
  },
  ...o,
});
describe("financial management model", () => {
  it("excludes cancelled and duplicate entries", () => {
    const m = buildFinancialManagementMetrics(
      [
        tx({
          id: "paid",
          amount: 300,
          status: "completed",
          metadata: {
            financial_entry_status: "paid",
            paid_at: "2026-07-05T12:00:00Z",
          },
        }),
        tx({ id: "paid", amount: 300 }),
        tx({
          id: "cancel",
          amount: 900,
          metadata: { financial_entry_status: "cancelled" },
        }),
      ],
      { monthKey: "2026-07", todayKey: "2026-07-10" },
    );
    expect(m.received).toBe(300);
    expect(m.receivable).toBe(0);
  });
  it("keeps old overdue visible", () => {
    const m = buildFinancialManagementMetrics(
      [
        tx({
          id: "old",
          amount: 250,
          date: "2026-03-02",
          metadata: {
            financial_entry_status: "pending",
            due_date: "2026-03-02",
            competence_date: "2026-03-02",
          },
        }),
      ],
      { monthKey: "2026-07", todayKey: "2026-07-10" },
    );
    expect(m.overdueAmount).toBe(250);
  });
  it("separates cash and competence", () => {
    const row = tx({
      status: "completed",
      amount: 180,
      metadata: {
        financial_entry_status: "paid",
        paid_at: "2026-07-01T00:30:00Z",
        competence_date: "2026-06-30",
      },
    });
    expect(
      buildFinancialManagementMetrics([row], {
        monthKey: "2026-07",
        todayKey: "2026-07-10",
        basis: "cash",
      }).received,
    ).toBe(180);
    expect(
      buildFinancialManagementMetrics([row], {
        monthKey: "2026-07",
        todayKey: "2026-07-10",
        basis: "competence",
      }).received,
    ).toBe(0);
  });
  it("counts reversals as opposite flow", () => {
    const m = buildFinancialManagementMetrics(
      [
        tx({
          id: "i",
          amount: 300,
          status: "completed",
          metadata: { financial_entry_status: "paid", paid_at: "2026-07-04" },
        }),
        tx({
          id: "r",
          type: "expense",
          amount: 100,
          status: "completed",
          metadata: { financial_entry_status: "paid", paid_at: "2026-07-05" },
        }),
      ],
      { monthKey: "2026-07", todayKey: "2026-07-10" },
    );
    expect(m.result).toBe(200);
  });
  it("supports partial settlements", () => {
    const m = buildFinancialManagementMetrics(
      [
        tx({
          amount: 300,
          metadata: {
            financial_entry_status: "pending",
            due_date: "2026-07-20",
            competence_date: "2026-07-01",
            settlements: [
              {
                amount: 120,
                settled_at: "2026-07-08T12:00:00Z",
                status: "posted",
              },
            ],
          },
        }),
      ],
      { monthKey: "2026-07", todayKey: "2026-07-10" },
    );
    expect(m.received).toBe(120);
    expect(m.receivable).toBe(180);
  });

  it("distinguishes manual entries from NeuroFinance projections", () => {
    const manual = tx({ origin: "manual" });
    const neurofinance = tx({
      origin: "gateway_auto",
      metadata: {
        financial_entry_status: "pending",
        financial_entry_origin: "neurofinance",
        neurofinance_charge_id: "charge-1",
      },
    });

    expect(managementOriginOf(manual)).toBe("Lançamento manual");
    expect(managementAllowsManualSettlement(manual)).toBe(true);
    expect(managementOriginOf(neurofinance)).toBe("Cobrança NeuroFinance");
    expect(managementAllowsManualSettlement(neurofinance)).toBe(false);
  });
});
