import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("contrato seguro das operações NeuroFinance", () => {
  it("não devolve payloads brutos do provedor após Pix, saque, transferência ou boleto", () => {
    const payout = sourceOf("supabase/functions/asaas-payout/index.ts");
    const pixPayment = sourceOf("supabase/functions/asaas-pix-payment/index.ts");
    const billPayment = sourceOf("supabase/functions/asaas-bill-payment/index.ts");
    const paymentActions = sourceOf("supabase/functions/asaas-payment-actions/index.ts");
    const pixKeys = sourceOf("supabase/functions/asaas-pix/index.ts");

    expect(payout).not.toContain("transfer: record.provider_payload?.execution");
    expect(payout).not.toContain("transfer, status, receiptUrl");
    expect(pixPayment).not.toContain("payment: record.provider_payload?.execution");
    expect(pixPayment).not.toContain("payment: result, status, receiptUrl");
    expect(billPayment).not.toContain("bill: result");
    expect(billPayment).not.toContain("{ code: \"BILL_REJECTED\", record:");
    expect(paymentActions).toContain("paymentActionResponse(updated)");
    expect(pixKeys).not.toContain("...raw");
    expect(pixKeys).not.toContain("provider_id:");
    expect(pixKeys).toContain("function safePixKey");
  });

  it("protege criação e remoção de chaves Pix com PIN, idempotência e reconciliação", () => {
    const pixKeys = sourceOf("supabase/functions/asaas-pix/index.ts");
    const migration = sourceOf("supabase/migrations/20260716054000_pix_key_operation_idempotency.sql");

    expect(pixKeys).toContain("verifyFinancialPin");
    expect(pixKeys).toContain("idempotencyKey");
    expect(pixKeys).toContain("submission_unknown");
    expect(migration).toContain("neurofinance_baas_operations");
    expect(migration).toContain("unique index");
    expect(migration).toContain("revoke all");
  });

  it("torna a exclusão bancária reexecutável sem duplicar a ação externa", () => {
    const paymentActions = sourceOf("supabase/functions/asaas-payment-actions/index.ts");
    const charges = sourceOf("src/components/financeiro/ChargesWorkspace.tsx");

    expect(paymentActions).toContain('const operationType = "payment_delete"');
    expect(paymentActions).toContain("idempotency_key");
    expect(paymentActions).toContain("submission_unknown");
    expect(charges).toContain('"neurofinance-charge-delete"');
  });

  it("mantém saques restritos a destinos cadastrados e favoritos somente para transferências", () => {
    const payout = sourceOf("supabase/functions/asaas-payout/index.ts");

    expect(payout).toContain('purpose === "payout" && requestedDestination.type === "pix_key"');
    expect(payout).toContain('requestedDestination.recipient_id === "legacy-pix"');
    expect(payout).toContain('record.kind === "pix_transfer"');
    expect(payout.indexOf("const transfer = await createAsaasTransfer")).toBeLessThan(
      payout.indexOf("saveRecipientFromRequest(user.id, account.id, claimed)"),
    );
  });

  it("protege duplo clique em cobranças gerenciais com chave determinística", () => {
    const charges = sourceOf("src/components/financeiro/ChargesWorkspace.tsx");

    expect(charges).toContain('["charge-settle", row.financialEntryId]');
    expect(charges).toContain('["charge-cancel", row.financialEntryId]');
    expect(charges).not.toContain('"charge-settle", row.financialEntryId, crypto.randomUUID()');
    expect(charges).not.toContain('"charge-cancel", row.financialEntryId, crypto.randomUUID()');
  });

  it("não apresenta status ou falhas técnicas sem humanização", () => {
    const scheduledBills = sourceOf("src/components/financeiro/pagamentos/ScheduledBillPayments.tsx");
    const paymentGroups = sourceOf("src/components/financeiro/pagamentos/PagamentosGrupos.tsx");

    expect(scheduledBills).toContain('return "Em acompanhamento"');
    expect(scheduledBills).toContain('getUserFacingErrorMessage(record.error_message, "payment")');
    expect(paymentGroups).toContain('getUserFacingErrorMessage(item.error_message, "payment")');
    expect(paymentGroups).not.toContain('label: "Erro Decode"');
  });

  it("direciona cada notificação bancária para a área exata do NeuroFinance", () => {
    const webhook = sourceOf("supabase/functions/_shared/asaas-webhook-handler.ts");
    const dashboardAlerts = sourceOf("src/hooks/use-dashboard-alerts.ts");

    expect(webhook).toContain("/financeiro?view=cobrancas-historia");
    expect(webhook).toContain("/financeiro?view=cobrancas-chargebacks");
    expect(webhook).toContain("/financeiro?view=pagamentos-agendados");
    expect(webhook).toContain("/financeiro?view=transferencias");
    expect(webhook).toContain("/financeiro?view=saude-conta");
    expect(webhook).toContain("/financeiro?view=conta-digital");
    expect(webhook).not.toContain("tab=neurofinance");
    expect(dashboardAlerts).toContain("/financeiro?view=extrato&subview=realizado");
    expect(dashboardAlerts).not.toContain('actionLink: "/financeiro"');
  });
});
