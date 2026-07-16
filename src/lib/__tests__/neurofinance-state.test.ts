import { describe, expect, it } from "vitest";
import { getAsaasAccountState } from "../asaas-account-status";
import {
  buildNeuroFinanceSupportUrl,
  getNeuroFinanceSyncErrorMessage,
} from "../neurofinance-support";

const approvedRequirements = {
  stages: {
    general: { provider_status: "APPROVED" },
    commercial: { provider_status: "APPROVED" },
    bank: { provider_status: "APPROVED" },
    billing: { provider_status: "APPROVED" },
    documents: { provider_status: "APPROVED" },
  },
};

describe("NeuroFinance account state", () => {
  it("keeps a disconnected account non-operational even with an approved snapshot", () => {
    const state = getAsaasAccountState({
      status: "account_missing",
      asaas_account_id: "acc_deleted",
      requirements: approvedRequirements,
    });

    expect(state.uiStatus).toBe("account_missing");
    expect(state.isApproved).toBe(false);
  });

  it("treats all five approved stages as active over a legacy pending status", () => {
    const state = getAsaasAccountState({
      status: "pending_review",
      asaas_account_id: "acc_active",
      requirements: approvedRequirements,
    });

    expect(state.uiStatus).toBe("active");
    expect(state.isApproved).toBe(true);
  });
});

describe("NeuroFinance support messages", () => {
  it("normalizes legacy malformed characters", () => {
    expect(
      getNeuroFinanceSyncErrorMessage(
        "N?o foi poss?vel acessar a conta Asaas. Contate o suporte."
      )
    ).toBe("Não foi possível validar a conexão com o NeuroFinance.");
  });

  it("builds a contextual WhatsApp support link without credentials", () => {
    const url = buildNeuroFinanceSupportUrl({
      professionalName: "Maria Silva",
      professionalEmail: "maria@example.com",
      userId: "user-1",
      accountId: "acc-1",
      error: "Conta removida",
      occurredAt: "2026-06-06T12:00:00.000Z",
    });
    const message = decodeURIComponent(url.split("?text=")[1]);

    expect(url).toContain("https://wa.me/5547988730611");
    expect(message).toContain("Maria Silva");
    expect(message).toContain("Conta removida");
    expect(message).not.toContain("apiKey");
    expect(message).not.toContain("user-1");
    expect(message).not.toContain("acc-1");
  });
});
