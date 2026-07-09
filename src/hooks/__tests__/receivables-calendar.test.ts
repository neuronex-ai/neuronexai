import { describe, expect, it } from "vitest";

import {
  mapFinancialEntryToReceivable,
  mapNeuroFinanceTransactionToReceivable,
  mergeReceivables,
  updateReceivableDateSelection,
} from "../use-receivables-calendar";
import type { FinancialEntry } from "../use-financial-entries";
import type { Transaction } from "@/types";

const baseEntry: FinancialEntry = {
  id: "entry-1",
  clinic_id: null,
  professional_id: "user-1",
  patient_id: "patient-1",
  appointment_id: null,
  type: "income",
  title: "Sessão",
  description: "Sessão clínica",
  category_id: null,
  amount: 250,
  due_date: "2026-06-12",
  competence_date: "2026-06-12",
  paid_at: null,
  status: "pending",
  payment_method: "manual",
  origin: "manual",
  neurofinance_transaction_id: null,
  neurofinance_charge_id: null,
  idempotency_key: null,
  reversal_of_entry_id: null,
  reversal_reason: null,
  cancelled_at: null,
  cancelled_reason: null,
  metadata: {},
  created_at: "2026-06-01T12:00:00Z",
  updated_at: "2026-06-01T12:00:00Z",
  patients: { name: "Ana", email: null },
};

describe("receivables calendar mapping", () => {
  it("keeps agenda entries editable and derives overdue status", () => {
    const item = mapFinancialEntryToReceivable(
      { ...baseEntry, origin: "appointment", appointment_id: "appointment-1" },
      "2026-06-15",
    );

    expect(item).toMatchObject({
      source: "agenda",
      editable: true,
      status: "overdue",
      patientName: "Ana",
    });
  });

  it("keeps only the NeuroFinance item when the managerial entry is linked", () => {
    const neuroFinanceTransaction: Transaction = {
      id: "payment-1",
      user_id: "user-1",
      description: "Ana · Cobrança NeuroFinance",
      amount: 250,
      type: "income",
      category: "payment",
      date: "2026-06-20T12:00:00Z",
      appointment_id: null,
      created_at: "2026-06-01T12:00:00Z",
      payment_method: "pix",
      status: "pending",
      origin: "gateway_auto",
      patients: { name: "Ana", email: null },
    };
    const neuroFinanceItem = mapNeuroFinanceTransactionToReceivable(
      neuroFinanceTransaction,
      "pending",
    );

    const items = mergeReceivables(
      [{ ...baseEntry, neurofinance_charge_id: "payment-1" }],
      neuroFinanceItem ? [neuroFinanceItem] : [],
      "2026-06-09",
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "neurofinance",
      editable: false,
      amount: 250,
    });
  });

  it("uses the normalized overview date and patient for NeuroFinance receivables", () => {
    const item = mapNeuroFinanceTransactionToReceivable({
      id: "payment-2",
      user_id: "user-1",
      description: "Carlos · Sessão de psicoterapia",
      amount: 200,
      type: "income",
      category: "payment",
      date: "2026-06-16T10:30:00Z",
      appointment_id: null,
      created_at: "2026-06-09T10:30:00Z",
      payment_method: "pix",
      status: "pending",
      origin: "gateway_auto",
      patients: { name: "Carlos", email: null },
    }, "pending");

    expect(item).toMatchObject({
      date: "2026-06-16",
      patientName: "Carlos",
      description: "Sessão de psicoterapia",
      editable: false,
    });
  });
});

describe("receivables calendar date selection", () => {
  const june10 = new Date("2026-06-10T12:00:00");
  const june12 = new Date("2026-06-12T12:00:00");
  const june15 = new Date("2026-06-15T12:00:00");

  it("selects one day and then creates an ordered interval", () => {
    expect(updateReceivableDateSelection([], june12)).toEqual([june12]);
    expect(updateReceivableDateSelection([june12], june10)).toEqual([june10, june12]);
  });

  it("deselects a selected day", () => {
    expect(updateReceivableDateSelection([june10, june12], june10)).toEqual([june12]);
  });

  it("starts a new selection when a third day is clicked", () => {
    expect(updateReceivableDateSelection([june10, june12], june15)).toEqual([june15]);
  });
});
