import { describe, expect, it } from "vitest";

import type { AccountMovement } from "@/lib/neurofinance-types";
import {
  filterAccountMovementsByDateRange,
  filterBalanceDetailsByView,
  humanizeAccountMovementCategory,
  mapAccountMovementToTransaction,
  parseAccountMovementRows,
} from "@/lib/neurofinance-statement-data";

const movement = (overrides: Partial<AccountMovement> = {}): AccountMovement => ({
  id: overrides.id || crypto.randomUUID(),
  overview_group: "income",
  item_type: "pix_credit",
  description: "Pix recebido",
  amount: 12_345,
  currency: "brl",
  status: "posted",
  payment_method: "pix",
  occurred_at: "2026-07-16T10:00:00-03:00",
  patient_name: null,
  receipt_url: null,
  invoice_url: null,
  bank_slip_url: null,
  ...overrides,
});

describe("neurofinance statement data", () => {
  it("separa entradas, saídas e valores a receber para os três indicadores", () => {
    const items = [
      movement({ id: "income", overview_group: "income" }),
      movement({ id: "outflow", overview_group: "outflow" }),
      movement({ id: "receivable", overview_group: "receivable" }),
    ];

    expect(filterBalanceDetailsByView(items, "total").map((item) => item.id))
      .toEqual(["income"]);
    expect(filterBalanceDetailsByView(items, "andamento").map((item) => item.id))
      .toEqual(["outflow"]);
    expect(filterBalanceDetailsByView(items, "futuro").map((item) => item.id))
      .toEqual(["receivable"]);
  });

  it("humaniza o movimento bancário sem perder método, valor e comprovante", () => {
    const result = mapAccountMovementToTransaction(movement({
      patient_name: "Ana Souza",
      receipt_url: "https://example.test/comprovante",
    }), "user-1");

    expect(result.description).toBe("Ana Souza · Pix recebido");
    expect(result.amount).toBe(123.45);
    expect(result.type).toBe("income");
    expect(result.category).toBe("Pix recebido");
    expect(result.status).toBe("completed");
    expect(result.payment_method).toBe("pix");
    expect(result.receipt_url).toBe("https://example.test/comprovante");
  });

  it("troca códigos internos por categorias simples em português", () => {
    expect(humanizeAccountMovementCategory("TRANSFER_FEE")).toBe("Tarifa");
    expect(humanizeAccountMovementCategory("CHARGEBACK_REVERSAL")).toBe("Contestação");

    const result = mapAccountMovementToTransaction(movement({
      item_type: "PIX_TRANSACTION_CREDIT",
      description: "PIX_TRANSACTION_CREDIT",
    }), "user-1");
    expect(result.description).toBe("Pix recebido");
  });

  it("mantém no período somente movimentos com data válida dentro dos limites", () => {
    const items = [
      movement({ id: "before", occurred_at: "2026-06-30T23:59:59-03:00" }),
      movement({ id: "inside", occurred_at: "2026-07-16T10:00:00-03:00" }),
      movement({ id: "after", occurred_at: "2026-08-01T00:00:01-03:00" }),
      movement({ id: "invalid", occurred_at: "data inválida" }),
    ];

    expect(filterAccountMovementsByDateRange(
      items,
      "2026-07-01T00:00:00-03:00",
      "2026-07-31T23:59:59-03:00",
    ).map((item) => item.id)).toEqual(["inside"]);
  });

  it("descarta campos técnicos mesmo quando uma resposta comprometida tenta incluí-los", () => {
    const parsed = parseAccountMovementRows([{
      ...movement({ id: "safe" }),
      provider_payment_id: "pay_internal",
      financial_account_id: "account_internal",
      metadata: { token: "secret", raw: { cpf: "00000000000" } },
      reference_id: "provider_reference",
    }]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).not.toHaveProperty("provider_payment_id");
    expect(parsed[0]).not.toHaveProperty("financial_account_id");
    expect(parsed[0]).not.toHaveProperty("metadata");
    expect(parsed[0]).not.toHaveProperty("reference_id");
  });
});
