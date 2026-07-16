import type { FinanceView } from "./FinancialDashboard";

export const MANAGEMENT_FINANCE_VIEWS: FinanceView[] = [
  "gestao-visao-geral",
  "gestao-lancamentos",
  "gestao-cobrancas",
  "gestao-recebimentos",
  "gestao-repasses-convenio",
  "gestao-recorrencia",
  "gestao-planejamento",
];

export const LEGACY_MANAGEMENT_VIEW_REDIRECTS: Partial<Record<FinanceView, FinanceView>> = {
  "gestao-fluxo-caixa":"gestao-visao-geral","gestao-receitas":"gestao-lancamentos","gestao-despesas":"gestao-lancamentos","gestao-inadimplencia":"gestao-recebimentos","gestao-relatorios":"gestao-lancamentos",
  "fluxo-caixa":"gestao-visao-geral",receitas:"gestao-lancamentos",despesas:"gestao-lancamentos",
};

export const isManagementFinanceView = (view: FinanceView) => MANAGEMENT_FINANCE_VIEWS.includes(view);

export const isNeuroFinanceView = (view: FinanceView) => !isManagementFinanceView(view) && !LEGACY_MANAGEMENT_VIEW_REDIRECTS[view];
