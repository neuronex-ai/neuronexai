import { describe, expect, it } from "vitest";

import {
  filterChargeRows,
  getEffectiveChargeStatus,
  mapFinancialEntryToChargeRow,
  paginateChargeRows,
  type ChargeRow,
} from "../use-charges-page";
import type { FinancialEntry } from "../use-financial-entries";

const entry = (overrides: Partial<FinancialEntry>): FinancialEntry => ({
  id: "entry-1",
  clinic_id: null,
  professional_id: "user-1",
  patient_id: "patient-1",
  appointment_id: null,
  type: "income",
  title: "Sessao",
  description: "Sessao clinica",
  category_id: null,
  amount: 250,
  due_date: "2099-06-10",
  competence_date: "2099-06-10",
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
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-06-01T12:00:00.000Z",
  patients: { name: "Ana", email: null },
  ...overrides,
});

const row = (overrides: Partial<ChargeRow>): ChargeRow => ({
  id: "management:1",
  scope: "management",
  source: "manual",
  patientId: "patient-1",
  patientName: "Ana",
  amount: 250,
  description: "Sessao clinica",
  status: "pending",
  dueDate: "2099-06-10",
  paidAt: null,
  paymentMethod: "manual",
  origin: "manual",
  editable: true,
  links: {},
  financialEntryId: "entry-1",
  neurofinancePaymentId: null,
  ...overrides,
});

describe("charges page normalization", () => {
  it("derives overdue status for open managerial charges", () => {
    expect(getEffectiveChargeStatus(entry({ due_date: "2020-01-01", status: "pending" }))).toBe("overdue");
    expect(getEffectiveChargeStatus(entry({ due_date: "2099-01-01", status: "planned" }))).toBe("planned");
    expect(getEffectiveChargeStatus(entry({ due_date: "2020-01-01", status: "paid" }))).toBe("paid");
  });

  it("maps financial entries into editable management charge rows", () => {
    expect(mapFinancialEntryToChargeRow(entry({ origin: "appointment", appointment_id: "appointment-1" }))).toMatchObject({
      scope: "management",
      source: "appointment",
      patientName: "Ana",
      amount: 250,
      editable: true,
      financialEntryId: "entry-1",
      neurofinancePaymentId: null,
      origin: "appointment",
    });
  });

  it("filters by overdue preset, search and type", () => {
    const rows = [
      row({ id: "management:1", status: "overdue", origin: "manual", description: "Sessao Ana", patientName: "Ana" }),
      row({ id: "management:2", status: "pending", origin: "appointment", description: "Sessao Bruno", patientName: "Bruno" }),
    ];

    expect(filterChargeRows(rows, { status: ["overdue"], search: "ana", type: ["manual"] }).map((item) => item.id)).toEqual(["management:1"]);
  });

  it("paginates normalized rows with safe bounds", () => {
    const rows = Array.from({ length: 12 }, (_, index) => row({ id: `management:${index + 1}` }));
    expect(paginateChargeRows(rows, 2, 5).map((item) => item.id)).toEqual([
      "management:6",
      "management:7",
      "management:8",
      "management:9",
      "management:10",
    ]);
  });
});
