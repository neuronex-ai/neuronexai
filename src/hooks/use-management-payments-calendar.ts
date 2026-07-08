import { useMemo } from "react";
import { format } from "date-fns";

import type { BillPaymentCalendarItem } from "@/hooks/use-bill-payments-calendar";
import { useBillPaymentsCalendar } from "@/hooks/use-bill-payments-calendar";
import type { FinancialEntry } from "@/hooks/use-financial-entries";
import { useFinancialEntries } from "@/hooks/use-financial-entries";

export type FinancialPaymentSource = "management" | "neurofinance";
export type FinancialPaymentStatus = "planned" | "pending" | "paid" | "overdue" | "cancelled" | "processing";

export interface FinancialPaymentCalendarItem {
  id: string;
  date: string;
  amount: number;
  status: FinancialPaymentStatus;
  source: FinancialPaymentSource;
  beneficiaryName: string | null;
  description: string;
  dueDate: string | null;
  paymentMethod: string | null;
  editable: boolean;
  financialEntryId: string | null;
  neurofinancePaymentId: string | null;
  raw?: FinancialEntry | BillPaymentCalendarItem;
}

const normalizeDateKey = (value?: string | null) => value?.slice(0, 10) || null;

const isPastDate = (value?: string | null) => {
  const key = normalizeDateKey(value);
  if (!key) return false;
  return key < new Date().toISOString().slice(0, 10);
};

export function getEffectivePaymentStatus(entry: Pick<FinancialEntry, "status" | "due_date">): FinancialPaymentStatus {
  if (entry.status === "paid" || entry.status === "cancelled") return entry.status;
  if (isPastDate(entry.due_date)) return "overdue";
  return entry.status === "planned" ? "planned" : "pending";
}

export function mapExpenseEntryToPaymentCalendarItem(entry: FinancialEntry): FinancialPaymentCalendarItem {
  const date = normalizeDateKey(entry.status === "paid" ? entry.paid_at : entry.due_date || entry.competence_date) ||
    normalizeDateKey(entry.created_at) ||
    format(new Date(), "yyyy-MM-dd");

  return {
    id: `management:${entry.id}`,
    date,
    amount: Number(entry.amount || 0),
    status: getEffectivePaymentStatus(entry),
    source: "management",
    beneficiaryName: entry.patients?.name || null,
    description: entry.description || entry.title || "Despesa gerencial",
    dueDate: normalizeDateKey(entry.due_date),
    paymentMethod: entry.payment_method || null,
    editable: true,
    financialEntryId: entry.id,
    neurofinancePaymentId: null,
    raw: entry,
  };
}

export function mapBillPaymentToFinancialPaymentItem(item: BillPaymentCalendarItem): FinancialPaymentCalendarItem {
  return {
    id: `neurofinance:${item.id}`,
    date: item.date,
    amount: Number(item.amount || 0),
    status: String(item.status || "").toLowerCase().includes("cancel") ? "cancelled" : "processing",
    source: "neurofinance",
    beneficiaryName: item.beneficiaryName,
    description: item.beneficiaryName || item.bankName || "Pagamento bancario agendado",
    dueDate: item.dueDate || item.date,
    paymentMethod: "boleto",
    editable: false,
    financialEntryId: null,
    neurofinancePaymentId: item.id,
    raw: item,
  };
}

export function useManagementPaymentsCalendar(startDate: Date, endDate: Date, includeBankPayments = true) {
  const managementEntries = useFinancialEntries({
    startDate,
    endDate,
    type: "expense",
    limit: 1000,
  });
  const bankPayments = useBillPaymentsCalendar(startDate, endDate);

  const data = useMemo(() => {
    const managementItems = (managementEntries.data || [])
      .filter((entry) => entry.status !== "cancelled" || entry.cancelled_at)
      .map(mapExpenseEntryToPaymentCalendarItem);
    const bankItems = includeBankPayments ? (bankPayments.data || []).map(mapBillPaymentToFinancialPaymentItem) : [];
    return [...managementItems, ...bankItems].sort((left, right) => left.date.localeCompare(right.date));
  }, [bankPayments.data, includeBankPayments, managementEntries.data]);

  return {
    data,
    isLoading: managementEntries.isLoading || (includeBankPayments && bankPayments.isLoading),
    isFetching: managementEntries.isFetching || (includeBankPayments && bankPayments.isFetching),
    error: managementEntries.error || bankPayments.error,
  };
}
