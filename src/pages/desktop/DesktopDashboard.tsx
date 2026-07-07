"use client";

import { useEffect, useMemo } from "react";

import { DesktopDashboardCommandCenter } from "@/components/dashboard/desktop/DesktopDashboardCommandCenter";
import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const METRIC_SELECTORS = [
  {
    key: "balance",
    originalLabel: "Disponível para saque",
    label: "Saldo",
    getValue: (balance: ReturnType<typeof useNeuroFinanceBalance>["data"]) => balance.balance,
  },
  {
    key: "pending",
    originalLabel: "Vai cair",
    label: "Vai cair",
    getValue: (balance: ReturnType<typeof useNeuroFinanceBalance>["data"]) => balance.pending,
  },
  {
    key: "totalReceived",
    originalLabel: "Vai entrar",
    label: "Quanto entrou",
    getValue: (balance: ReturnType<typeof useNeuroFinanceBalance>["data"]) => balance.totalReceived,
  },
  {
    key: "paidOut",
    originalLabel: "Extrato",
    label: "Quanto saiu",
    getValue: (balance: ReturnType<typeof useNeuroFinanceBalance>["data"]) => balance.paidOut,
  },
] as const;

function patchNeuroFinanceDashboardCards(balance: ReturnType<typeof useNeuroFinanceBalance>["data"], isLoading: boolean) {
  const labelNodes = Array.from(document.querySelectorAll<HTMLParagraphElement>("button p"));

  METRIC_SELECTORS.forEach((metric) => {
    let card = document.querySelector<HTMLButtonElement>(`button[data-dashboard-neurofinance-metric="${metric.key}"]`);

    if (!card) {
      const labelNode = labelNodes.find((node) => node.textContent?.trim() === metric.originalLabel);
      card = labelNode?.closest("button") as HTMLButtonElement | null;
      if (card) card.dataset.dashboardNeurofinanceMetric = metric.key;
    }

    if (!card) return;

    const paragraphs = Array.from(card.querySelectorAll<HTMLParagraphElement>("p"));
    const label = paragraphs[0];
    const value = paragraphs[1];

    if (label) label.textContent = metric.label;
    if (value) value.textContent = isLoading ? "..." : formatCurrency(metric.getValue(balance) || 0);
  });
}

const DesktopDashboard = () => {
  const { data: neuroFinanceBalance, isLoading } = useNeuroFinanceBalance();

  const balanceSignature = useMemo(() => JSON.stringify({
    balance: neuroFinanceBalance.balance,
    pending: neuroFinanceBalance.pending,
    totalReceived: neuroFinanceBalance.totalReceived,
    paidOut: neuroFinanceBalance.paidOut,
    lastUpdatedAt: neuroFinanceBalance.lastUpdatedAt,
    isLoading,
  }), [
    isLoading,
    neuroFinanceBalance.balance,
    neuroFinanceBalance.lastUpdatedAt,
    neuroFinanceBalance.paidOut,
    neuroFinanceBalance.pending,
    neuroFinanceBalance.totalReceived,
  ]);

  useEffect(() => {
    const apply = () => patchNeuroFinanceDashboardCards(neuroFinanceBalance, isLoading);
    apply();

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [balanceSignature, isLoading, neuroFinanceBalance]);

  return <DesktopDashboardCommandCenter />;
};

export default DesktopDashboard;
