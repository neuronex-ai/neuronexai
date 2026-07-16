import type { Transaction } from "@/types";

import {
  dedupeManagementTransactions,
  managementOutstandingAmountOf,
  managementStatusOf,
} from "@/lib/financial-management-model";

export const FINANCIAL_MANAGEMENT_NAV_ITEMS = [
  {
    id: "gestao-visao-geral",
    label: "Visão Geral",
    icon: "overview",
    description: "Resultado, previsão, recebíveis e pendências do consultório",
  },
  {
    id: "gestao-cobrancas",
    label: "Cobranças Manuais",
    icon: "manualCharges",
    description: "Cobranças gerenciais criadas pelo profissional",
  },
  {
    id: "gestao-lancamentos",
    label: "Lançamentos",
    icon: "entries",
    description: "Receitas e despesas da gestão",
  },
  {
    id: "gestao-recebimentos",
    label: "Recebimentos",
    icon: "receipts",
    description: "Baixas e valores em aberto",
  },
  {
    id: "gestao-repasses-convenio",
    label: "Repasses e Convênio",
    icon: "agreements",
    description: "Coberturas, recebimentos e repasses de convênios",
  },
  {
    id: "gestao-recorrencia",
    label: "Recorrência",
    icon: "recurrence",
    description: "Entradas e saídas recorrentes da clínica e pessoais",
  },
  {
    id: "gestao-planejamento",
    label: "Planejamento",
    icon: "planning",
    description: "Metas e limites do período",
  },
] as const;

export type FinancialManagementNavItem = (typeof FINANCIAL_MANAGEMENT_NAV_ITEMS)[number];
export type FinancialManagementNavIcon = FinancialManagementNavItem["icon"];
export type RecurrenceScope = "clinic" | "personal";

const metadataOf = (transaction: Transaction) =>
  (transaction.metadata || {}) as Record<string, unknown>;

const normalizedOriginOf = (transaction: Transaction) => {
  const metadata = metadataOf(transaction);
  return String(
    metadata.financial_entry_origin ||
      metadata.origin ||
      metadata.source ||
      transaction.origin ||
      "manual",
  ).toLocaleLowerCase("pt-BR");
};

const normalizedTextOf = (transaction: Transaction) =>
  `${transaction.description || ""} ${transaction.category || ""}`.toLocaleLowerCase("pt-BR");

const isSettled = (transaction: Transaction) =>
  managementStatusOf(transaction) === "paid" || transaction.status === "completed";

const isCancelled = (transaction: Transaction) =>
  ["cancelled", "canceled"].includes(managementStatusOf(transaction));

export const isConventionTransaction = (transaction: Transaction) => {
  const metadata = metadataOf(transaction);
  const origin = normalizedOriginOf(transaction);
  const paymentMethod = String(
    metadata.financial_entry_payment_method || metadata.payment_method || "",
  ).toLocaleLowerCase("pt-BR");
  const hasAgreementConfiguration = Boolean(
    metadata.insurance_agreement_id ||
      metadata.insurance_plan_id ||
      metadata.payer_type === "insurer" ||
      metadata.payer_type === "insurance" ||
      metadata.financial_configuration_type === "insurance" ||
      metadata.financial_configuration_type === "convenio",
  );

  return (
    origin === "convenio" ||
    origin === "insurance" ||
    paymentMethod === "convenio" ||
    paymentMethod === "insurance" ||
    hasAgreementConfiguration
  );
};

export const isRecurringManagementTransaction = (transaction: Transaction) => {
  const metadata = metadataOf(transaction);
  const origin = normalizedOriginOf(transaction);
  const text = normalizedTextOf(transaction);

  return (
    origin === "recurring" ||
    origin === "subscription" ||
    Boolean(
      metadata.recurring_entry_id ||
        metadata.recurring_financial_entry_id ||
        metadata.recurrence_id ||
        metadata.subscription_id,
    ) ||
    text.includes("recorr") ||
    text.includes("mensalidade") ||
    text.includes("assinatura")
  );
};

export const recurrenceScopeOf = (transaction: Transaction): RecurrenceScope => {
  const metadata = metadataOf(transaction);
  const explicitScope = String(
    metadata.recurring_scope || metadata.financial_scope || metadata.scope || "",
  ).toLocaleLowerCase("pt-BR");

  if (["personal", "pessoal", "private", "particular"].includes(explicitScope)) {
    return "personal";
  }
  if (["clinic", "clinical", "consultorio", "consultório"].includes(explicitScope)) {
    return "clinic";
  }

  const text = normalizedTextOf(transaction);
  if (text.includes("pessoal") || text.includes("particular")) return "personal";
  if (transaction.patient_id || transaction.appointment_id || transaction.package_id) return "clinic";
  return "clinic";
};

export const recurrenceFrequencyLabelOf = (transaction: Transaction) => {
  const metadata = metadataOf(transaction);
  const frequency = String(
    metadata.recurrence_frequency || metadata.frequency || metadata.interval || "",
  ).toLocaleLowerCase("pt-BR");

  const labels: Record<string, string> = {
    daily: "Diária",
    weekly: "Semanal",
    biweekly: "Quinzenal",
    fortnightly: "Quinzenal",
    monthly: "Mensal",
    quarterly: "Trimestral",
    yearly: "Anual",
    annual: "Anual",
  };

  return labels[frequency] || (frequency ? "Frequência personalizada" : "Frequência não informada");
};

export const recurrenceReferenceDateOf = (transaction: Transaction) => {
  const metadata = metadataOf(transaction);
  const value =
    metadata.next_generation_date ||
    metadata.next_due_date ||
    metadata.due_date ||
    transaction.date;
  return typeof value === "string" ? value.slice(0, 10) : "";
};

export interface ConventionManagementSummary {
  rows: Transaction[];
  total: number;
  received: number;
  outstanding: number;
  receivedCount: number;
  outstandingCount: number;
}

export const buildConventionManagementSummary = (
  transactions: Transaction[],
): ConventionManagementSummary => {
  const rows = dedupeManagementTransactions(transactions).filter(isConventionTransaction);

  return rows.reduce<ConventionManagementSummary>(
    (summary, transaction) => {
      const transactionAmount = Math.abs(Number(transaction.amount || 0));
      summary.total += transactionAmount;
      if (isSettled(transaction)) {
        summary.received += transactionAmount;
        summary.receivedCount += 1;
      } else if (!isCancelled(transaction)) {
        summary.outstanding += managementOutstandingAmountOf(transaction);
        summary.outstandingCount += 1;
      }
      return summary;
    },
    { rows, total: 0, received: 0, outstanding: 0, receivedCount: 0, outstandingCount: 0 },
  );
};

export interface RecurrenceManagementSummary {
  rows: Transaction[];
  clinicRows: Transaction[];
  personalRows: Transaction[];
  income: number;
  expenses: number;
}

export const buildRecurrenceManagementSummary = (
  transactions: Transaction[],
): RecurrenceManagementSummary => {
  const rows = dedupeManagementTransactions(transactions).filter(isRecurringManagementTransaction);
  const clinicRows = rows.filter((transaction) => recurrenceScopeOf(transaction) === "clinic");
  const personalRows = rows.filter((transaction) => recurrenceScopeOf(transaction) === "personal");

  return {
    rows,
    clinicRows,
    personalRows,
    income: rows
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0),
    expenses: rows
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0),
  };
};
