import { describe, expect, it } from "vitest";

import {
  FINANCIAL_MANAGEMENT_NAV_ITEMS,
  buildConventionManagementSummary,
  buildRecurrenceManagementSummary,
  isConventionTransaction,
  recurrenceFrequencyLabelOf,
  recurrenceScopeOf,
} from "@/lib/finance-management-sections";
import type { Transaction } from "@/types";
import {
  isManagementFinanceView,
  isNeuroFinanceView,
} from "@/components/financeiro/finance-view-classification";

const transaction = (
  id: string,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id,
  user_id: "professional-1",
  description: `Lançamento ${id}`,
  amount: 100,
  type: "income",
  category: "Geral",
  date: "2026-07-16",
  appointment_id: null,
  created_at: `2026-07-16T12:00:0${id.length}.000Z`,
  status: "pending",
  metadata: {},
  ...overrides,
});

describe("financial management desktop navigation", () => {
  it("keeps the requested sequence and preserves planning as a separate final view", () => {
    expect(FINANCIAL_MANAGEMENT_NAV_ITEMS.map((item) => item.id)).toEqual([
      "gestao-visao-geral",
      "gestao-cobrancas",
      "gestao-lancamentos",
      "gestao-recebimentos",
      "gestao-repasses-convenio",
      "gestao-recorrencia",
      "gestao-planejamento",
    ]);
    expect(FINANCIAL_MANAGEMENT_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Visão Geral",
      "Cobranças Manuais",
      "Lançamentos",
      "Recebimentos",
      "Repasses e Convênio",
      "Recorrência",
      "Planejamento",
    ]);
  });

  it("uses the directional icon semantics requested for entries and receipts", () => {
    expect(FINANCIAL_MANAGEMENT_NAV_ITEMS.find((item) => item.id === "gestao-lancamentos")?.icon).toBe("entries");
    expect(FINANCIAL_MANAGEMENT_NAV_ITEMS.find((item) => item.id === "gestao-recebimentos")?.icon).toBe("receipts");
  });

  it("keeps the new views in management instead of applying the NeuroFinance access gate", () => {
    expect(isManagementFinanceView("gestao-repasses-convenio")).toBe(true);
    expect(isManagementFinanceView("gestao-recorrencia")).toBe(true);
    expect(isNeuroFinanceView("gestao-repasses-convenio")).toBe(false);
    expect(isNeuroFinanceView("gestao-recorrencia")).toBe(false);
  });
});

describe("convention management summary", () => {
  it("includes only convention-linked movements and keeps received and open amounts separate", () => {
    const summary = buildConventionManagementSummary([
      transaction("paid", {
        amount: 200,
        status: "completed",
        metadata: { financial_entry_origin: "convenio", financial_entry_status: "paid" },
      }),
      transaction("open", {
        amount: 150,
        metadata: { financial_entry_payment_method: "convenio", financial_entry_status: "pending" },
      }),
      transaction("manual", { amount: 999, metadata: { financial_entry_origin: "manual" } }),
      transaction("cancelled", {
        amount: 50,
        status: "cancelled",
        metadata: { financial_entry_origin: "convenio", financial_entry_status: "cancelled" },
      }),
    ]);

    expect(summary.rows.map((row) => row.id)).toEqual(["paid", "open", "cancelled"]);
    expect(summary.total).toBe(400);
    expect(summary.received).toBe(200);
    expect(summary.outstanding).toBe(150);
    expect(summary.receivedCount).toBe(1);
    expect(summary.outstandingCount).toBe(1);
  });

  it("requires a structured convention link instead of guessing from visible text", () => {
    const textOnly = transaction("text-only", {
      description: "Cobrança de convênio sem vínculo",
      metadata: { financial_entry_origin: "manual" },
    });
    const linked = transaction("linked", {
      description: "Atendimento",
      metadata: { insurance_agreement_id: "agreement-1" },
    });

    expect(isConventionTransaction(textOnly)).toBe(false);
    expect(isConventionTransaction(linked)).toBe(true);
  });
});

describe("management recurrence summary", () => {
  it("separates clinic and personal occurrences without treating ordinary entries as recurrence", () => {
    const clinic = transaction("clinic", {
      patient_id: "patient-1",
      amount: 300,
      metadata: { financial_entry_origin: "recurring", frequency: "monthly" },
    });
    const personal = transaction("personal", {
      type: "expense",
      amount: 80,
      category: "Despesa pessoal",
      metadata: { financial_entry_origin: "subscription", recurring_scope: "personal", frequency: "weekly" },
    });
    const ordinary = transaction("ordinary", { amount: 900, metadata: { financial_entry_origin: "manual" } });

    const summary = buildRecurrenceManagementSummary([clinic, personal, ordinary]);

    expect(summary.rows.map((row) => row.id)).toEqual(["clinic", "personal"]);
    expect(summary.clinicRows.map((row) => row.id)).toEqual(["clinic"]);
    expect(summary.personalRows.map((row) => row.id)).toEqual(["personal"]);
    expect(summary.income).toBe(300);
    expect(summary.expenses).toBe(80);
    expect(recurrenceScopeOf(personal)).toBe("personal");
    expect(recurrenceFrequencyLabelOf(clinic)).toBe("Mensal");
    expect(recurrenceFrequencyLabelOf(personal)).toBe("Semanal");
  });
});
