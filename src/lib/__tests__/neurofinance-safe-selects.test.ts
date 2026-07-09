import { describe, expect, it } from "vitest";
import {
  FINANCIAL_ACCOUNT_SAFE_SELECT,
  FINANCIAL_ACCOUNTS_READ_TABLE,
  FORBIDDEN_FINANCIAL_ACCOUNT_FIELDS,
  FORBIDDEN_NB_PAYMENT_FIELDS,
  FORBIDDEN_NB_PAYOUT_FIELDS,
  NB_PAYMENTS_READ_TABLE,
  NB_PAYMENTS_SAFE_SELECT,
  NB_PAYOUTS_READ_TABLE,
  NB_PAYOUTS_SAFE_SELECT,
  normalizeFinancialAccountRow,
  normalizeNbPaymentRow,
  normalizeNbPayoutRow,
} from "../neurofinance-safe-selects";

function selectedFields(select: string) {
  return new Set(select.split(",").map((field) => field.trim()).filter(Boolean));
}

describe("NeuroFinance safe read contracts", () => {
  it("reads from browser-safe views instead of provider-backed base tables", () => {
    expect(FINANCIAL_ACCOUNTS_READ_TABLE).toBe("financial_accounts_safe_v");
    expect(NB_PAYMENTS_READ_TABLE).toBe("nb_payments_safe_v");
    expect(NB_PAYOUTS_READ_TABLE).toBe("nb_payouts_safe_v");
  });

  it("does not expose sensitive financial account fields", () => {
    const fields = selectedFields(FINANCIAL_ACCOUNT_SAFE_SELECT);
    for (const forbidden of FORBIDDEN_FINANCIAL_ACCOUNT_FIELDS) {
      expect(fields.has(forbidden)).toBe(false);
    }
  });

  it("does not expose provider payment internals", () => {
    const fields = selectedFields(NB_PAYMENTS_SAFE_SELECT);
    for (const forbidden of FORBIDDEN_NB_PAYMENT_FIELDS) {
      expect(fields.has(forbidden)).toBe(false);
    }
  });

  it("does not expose provider payout internals", () => {
    const fields = selectedFields(NB_PAYOUTS_SAFE_SELECT);
    for (const forbidden of FORBIDDEN_NB_PAYOUT_FIELDS) {
      expect(fields.has(forbidden)).toBe(false);
    }
  });

  it("selects canonical safe-view aliases without exposing provider payloads", () => {
    const financialFields = selectedFields(FINANCIAL_ACCOUNT_SAFE_SELECT);
    const paymentFields = selectedFields(NB_PAYMENTS_SAFE_SELECT);
    const payoutFields = selectedFields(NB_PAYOUTS_SAFE_SELECT);

    for (const field of [
      "ui_status",
      "account_status",
      "neuronex_terms_version",
      "asaas_terms_reference",
      "asaas_privacy_policy_reference",
    ]) {
      expect(financialFields.has(field)).toBe(true);
    }

    for (const field of ["invoice_url", "bank_slip_url", "receipt_url", "cancelable"]) {
      expect(paymentFields.has(field)).toBe(true);
    }

    for (const field of ["receipt_url", "error_code", "error_message"]) {
      expect(payoutFields.has(field)).toBe(true);
    }
  });

  it("normalizes frontend aliases without adding them to Supabase selects", () => {
    expect(normalizeFinancialAccountRow({ status: "pending", requirements: { step: "docs" } })).toMatchObject({
      ui_status: "pending",
      account_status: { step: "docs" },
    });

    expect(
      normalizeNbPaymentRow({
        status: "pending",
        checkout_url: "https://checkout.example",
        boleto_url: "https://boleto.example",
      }),
    ).toMatchObject({
      invoice_url: "https://checkout.example",
      bank_slip_url: "https://boleto.example",
      cancelable: true,
    });

    expect(normalizeNbPayoutRow({ status: "failed" })).toMatchObject({
      receipt_url: null,
      error_code: null,
      error_message: null,
    });
  });
});
