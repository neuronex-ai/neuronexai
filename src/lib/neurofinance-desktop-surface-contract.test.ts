import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("contrato visual desktop do NeuroFinance", () => {
  it("apresenta a revisão de Pix e boleto em português simples", () => {
    const pix = sourceOf("src/components/financeiro/pix/PixPagarCopiaCola.tsx");
    const bill = sourceOf("src/components/financeiro/pagamentos/BillPaymentReviewCard.tsx");

    expect(pix).toContain("Leitura do código");
    expect(pix).toContain("QR Code com cobrança");
    expect(pix).toContain("aria-label=\"Código Pix Copia e Cola\"");
    expect(pix).not.toContain("Decodificação Asaas");
    expect(pix).not.toContain("diretamente na Asaas");
    expect(bill).toContain("Depois do PIN, recebedor, valor e data não poderão ser alterados");
    expect(bill).toContain("aria-pressed={paymentMode === \"now\"}");
    expect(bill).not.toContain("diretamente na Asaas");
  });

  it("mantém PIN e processamento acessíveis, responsivos ao movimento reduzido", () => {
    const pin = sourceOf("src/components/financeiro/secure/SecureOperationPinDialog.tsx");
    const processing = sourceOf("src/components/financeiro/secure/SecureOperationProcessing.tsx");

    expect(pin).toContain("PIN de 6 dígitos");
    expect(pin).toContain("aria-invalid={Boolean(errorMessage)}");
    expect(processing).toContain("useReducedMotion");
    expect(processing).toContain("aria-live=\"polite\"");
    expect(processing).toContain("motion-reduce:animate-none");
    expect(processing).not.toContain("Conectando Synapses");
  });

  it("limita o formulário de QR Code aos detalhes do recebimento", () => {
    const qr = sourceOf("src/components/financeiro/pix/PixGerarQrCode.tsx");

    expect(qr).toContain("Informe somente os detalhes deste recebimento");
    expect(qr).toContain("useReducedMotion");
    expect(qr).toContain("aria-pressed={expiration === option.value}");
    expect(qr).not.toContain("Nome e CPF do pagador não são necessários");
  });

  it("oculta ambiente técnico e direciona limites e saúde ao suporte NeuroNex", () => {
    const limits = sourceOf("src/components/financeiro/pix/PixLimites.tsx");
    const health = sourceOf("src/components/financeiro/AsaasAccountStatusTimeline.tsx");

    expect(limits).toContain("Falar com o suporte NeuroNex");
    expect(limits).toContain("useReducedMotion");
    expect(limits).not.toContain("Produção");
    expect(limits).not.toContain("habilitação da Asaas");
    expect(health).toContain("Análise cadastral NeuroFinance");
    expect(health).toContain("Suporte NeuroNex");
    expect(health).not.toContain("{stage.rawStatus}");
    expect(health).not.toContain("API da Asaas");
  });

  it("humaniza chaves, remove a aba Pix recebidos e mantém antecipação indisponível", () => {
    const keys = sourceOf("src/components/financeiro/pix/PixChaves.tsx");
    const anticipation = sourceOf("src/components/financeiro/antecipacoes/AnticipationRequest.tsx");
    const desktopNavigation = sourceOf("src/pages/desktop/DesktopFinanceiro.tsx");

    expect(keys).toContain("humanizeKeyType");
    expect(keys).toContain("Chave aleatória");
    expect(anticipation).toContain("Em breve");
    expect(anticipation).toContain("Nenhuma ação é necessária agora");
    expect(anticipation).not.toContain("Anexo I");
    expect(desktopNavigation).not.toContain('{ id: "pix-receber", label: "Pix recebidos"');
    expect(desktopNavigation).toContain('{ id: "antecipacoes-solicitar", label: "Antecipação"');
  });

  it("mantém a gestão contextual, sem KPIs decorativos nem brilho claro nos blocos", () => {
    const management = sourceOf("src/components/financeiro/management/FinancialManagementDashboard.tsx");
    const specialized = sourceOf("src/components/financeiro/management/ManagementSpecializedViews.tsx");
    const styles = sourceOf("src/index.css");

    expect(management).toContain("MANAGEMENT_VIEW_CONTEXT");
    expect(management).toContain("key={view}");
    expect(management).toContain("motion-reduce:animate-none");
    expect(specialized).toContain("Somente lançamentos com vínculo estruturado a convênio");
    expect(specialized).not.toContain("Total em convênios");
    expect(styles).toContain("Financial surfaces use depth, never a pale glow");
    expect(styles).toContain("prefers-reduced-transparency: reduce");
  });
});
