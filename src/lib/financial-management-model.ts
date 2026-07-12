import type { Transaction } from "@/types";

export type FinancialBasis = "cash" | "competence";
export interface FinancialTrendPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  result: number;
}
export interface FinancialAttentionItem {
  id: string;
  kind: "overdue" | "upcoming" | "uncategorized";
  title: string;
  detail: string;
  amount: number;
  date: string | null;
  transaction: Transaction;
}
export interface FinancialManagementMetrics {
  received: number;
  paidExpenses: number;
  result: number;
  receivable: number;
  overdueAmount: number;
  overdueCount: number;
  upcomingAmount: number;
  currentMonthTransactions: Transaction[];
  openIncomeTransactions: Transaction[];
  trend: FinancialTrendPoint[];
  attention: FinancialAttentionItem[];
  recent: Transaction[];
}
interface ManagementSettlement {
  id?: string;
  amount: number;
  settled_at: string;
  status: "posted" | "reversed";
}
const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const amountOf = (t: Transaction) => Math.abs(Number(t.amount || 0));
const metadataOf = (t: Transaction) =>
  (t.metadata || {}) as Record<string, unknown>;
export const managementStatusOf = (t: Transaction) =>
  String(
    metadataOf(t).financial_entry_status || t.status || "pending",
  ).toLowerCase();
export function managementSettlementsOf(t: Transaction) {
  const v = metadataOf(t).settlements;
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is ManagementSettlement =>
    Boolean(
      x &&
        typeof x === "object" &&
        typeof (x as ManagementSettlement).amount === "number" &&
        typeof (x as ManagementSettlement).settled_at === "string",
    ),
  );
}
export const managementSettledAmountOf = (t: Transaction) =>
  managementSettlementsOf(t)
    .filter((s) => s.status === "posted")
    .reduce((a, s) => a + Math.abs(Number(s.amount || 0)), 0);
export function managementOutstandingAmountOf(t: Transaction) {
  if (managementStatusOf(t) === "paid" || t.status === "completed") return 0;
  return Math.max(0, amountOf(t) - managementSettledAmountOf(t));
}
export function managementDateKeyOf(
  t: Transaction,
  basis: FinancialBasis = "cash",
) {
  const m = metadataOf(t);
  const v =
    basis === "competence"
      ? m.competence_date || m.due_date || t.date
      : m.paid_at || t.date || m.due_date;
  return typeof v === "string" ? v.slice(0, 10) : "";
}
export const managementCategoryOf = (t: Transaction) =>
  t.category?.trim() || "Sem categoria";
export const managementOriginOf = (t: Transaction) => {
  const metadata = metadataOf(t);
  const raw = String(
    metadata.financial_entry_origin || metadata.source || t.origin || "manual",
  ).toLowerCase();

  if (
    raw === "neurofinance" ||
    raw === "gateway_auto" ||
    metadata.neurofinance_charge_id ||
    metadata.neurofinance_transaction_id
  ) return "Cobrança NeuroFinance";
  if (raw === "appointment") return "Agenda";
  if (raw === "package") return "Pacote";
  if (raw === "convenio" || raw === "insurance") return "Convênio";
  if (raw === "subscription" || raw === "recurring") return "Recorrência";
  if (raw === "manual") return "Lançamento manual";
  return "Gestão financeira";
};
export const managementAllowsManualSettlement = (t: Transaction) =>
  managementOriginOf(t) !== "Cobrança NeuroFinance";
export const monthKeyFromDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export function shiftMonthKey(key: string, amount: number) {
  const [y, m] = key.split("-").map(Number);
  return monthKeyFromDate(new Date(y, m - 1 + amount, 1, 12));
}
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[m - 1] || key} ${String(y).slice(-2)}`;
}
export function dedupeManagementTransactions(rows: Transaction[]) {
  const out = new Map<string, Transaction>();
  for (const row of rows) {
    const key = String(metadataOf(row).financial_entry_id || row.id);
    const current = out.get(key);
    if (!current) {
      out.set(key, row);
      continue;
    }
    const cp =
      managementStatusOf(current) === "paid" || current.status === "completed";
    const np = managementStatusOf(row) === "paid" || row.status === "completed";
    if ((!cp && np) || row.created_at > current.created_at) out.set(key, row);
  }
  return [...out.values()];
}
const isOpen = (t: Transaction) =>
  ["planned", "pending", "overdue", "scheduled"].includes(
    managementStatusOf(t),
  );
const isPaid = (t: Transaction) =>
  managementStatusOf(t) === "paid" || t.status === "completed";
const isCancelled = (t: Transaction) =>
  ["cancelled", "canceled"].includes(managementStatusOf(t));
function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const x = new Date(y, m - 1, d + n, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function buildFinancialManagementMetrics(
  rows: Transaction[],
  options: { monthKey: string; todayKey: string; basis?: FinancialBasis },
): FinancialManagementMetrics {
  const basis = options.basis || "cash";
  const active = dedupeManagementTransactions(rows).filter(
    (t) => !isCancelled(t),
  );
  const current = active.filter((t) =>
    managementDateKeyOf(t, basis).startsWith(options.monthKey),
  );
  const realized = (t: Transaction, month: string) => {
    const s = managementSettlementsOf(t).filter((x) => x.status === "posted");
    if (s.length) {
      if (basis === "cash")
        return s
          .filter((x) => x.settled_at.slice(0, 7) === month)
          .reduce((a, x) => a + Math.abs(Number(x.amount || 0)), 0);
      return managementDateKeyOf(t, "competence").startsWith(month)
        ? s.reduce((a, x) => a + Math.abs(Number(x.amount || 0)), 0)
        : 0;
    }
    return isPaid(t) && managementDateKeyOf(t, basis).startsWith(month)
      ? amountOf(t)
      : 0;
  };
  const received = active
    .filter((t) => t.type === "income")
    .reduce((a, t) => a + realized(t, options.monthKey), 0);
  const paidExpenses = active
    .filter((t) => t.type === "expense")
    .reduce((a, t) => a + realized(t, options.monthKey), 0);
  const open = active
    .filter((t) => t.type === "income" && isOpen(t))
    .sort((a, b) =>
      managementDateKeyOf(a, "competence").localeCompare(
        managementDateKeyOf(b, "competence"),
      ),
    );
  const due = (t: Transaction) =>
    String(metadataOf(t).due_date || t.date || "").slice(0, 10);
  const overdue = open.filter((t) =>
    Boolean(due(t) && due(t) < options.todayKey),
  );
  const end = addDays(options.todayKey, 7);
  const upcoming = open.filter((t) =>
    Boolean(due(t) && due(t) >= options.todayKey && due(t) <= end),
  );
  const trend = Array.from({ length: 6 }, (_, i) =>
    shiftMonthKey(options.monthKey, i - 5),
  ).map((month) => {
    const income = active
      .filter((t) => t.type === "income")
      .reduce((a, t) => a + realized(t, month), 0);
    const expenses = active
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + realized(t, month), 0);
    return {
      month,
      label: monthLabel(month),
      income,
      expenses,
      result: income - expenses,
    };
  });
  const attention: FinancialAttentionItem[] = [
    ...overdue
      .slice(0, 5)
      .map((t) => ({
        id: `overdue:${t.id}`,
        kind: "overdue" as const,
        title: t.patient_name || t.patients?.name || t.description,
        detail: `Venceu em ${due(t).split("-").reverse().join("/")}`,
        amount: managementOutstandingAmountOf(t),
        date: due(t),
        transaction: t,
      })),
    ...upcoming
      .slice(0, Math.max(0, 5 - overdue.length))
      .map((t) => ({
        id: `upcoming:${t.id}`,
        kind: "upcoming" as const,
        title: t.patient_name || t.patients?.name || t.description,
        detail: `Vence em ${due(t).split("-").reverse().join("/")}`,
        amount: managementOutstandingAmountOf(t),
        date: due(t),
        transaction: t,
      })),
  ];
  return {
    received,
    paidExpenses,
    result: received - paidExpenses,
    receivable: open.reduce((a, t) => a + managementOutstandingAmountOf(t), 0),
    overdueAmount: overdue.reduce(
      (a, t) => a + managementOutstandingAmountOf(t),
      0,
    ),
    overdueCount: overdue.length,
    upcomingAmount: upcoming.reduce(
      (a, t) => a + managementOutstandingAmountOf(t),
      0,
    ),
    currentMonthTransactions: current,
    openIncomeTransactions: open,
    trend,
    attention,
    recent: [...active]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 8),
  };
}
