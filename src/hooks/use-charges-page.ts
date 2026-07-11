import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialEntry, FinancialEntryStatus } from "@/hooks/use-financial-entries";
import { fetchInvoicesPage } from "@/hooks/use-invoices";
import type { Invoice } from "@/types";

export type ChargeScope = "neurofinance" | "management";
export type ChargeStatusFilter = "planned" | "pending" | "overdue" | "paid" | "cancelled";
export type ChargeTypeFilter =
  | "single"
  | "subscription"
  | "installment"
  | "manual"
  | "appointment"
  | "package"
  | "insurance";

export interface ChargeRow {
  id: string;
  scope: ChargeScope;
  source: string;
  patientId: string | null;
  patientName: string | null;
  amount: number;
  description: string;
  status: ChargeStatusFilter;
  dueDate: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  origin: string;
  editable: boolean;
  links: {
    paymentUrl?: string | null;
    pdfUrl?: string | null;
    statementRoute?: string | null;
    patientRoute?: string | null;
    appointmentRoute?: string | null;
  };
  financialEntryId: string | null;
  neurofinancePaymentId: string | null;
  raw?: Invoice | FinancialEntry;
}

export interface ChargesPageParams {
  scope: ChargeScope;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ChargeStatusFilter[];
  type?: ChargeTypeFilter[];
  dueStart?: string;
  dueEnd?: string;
  receivedStart?: string;
  receivedEnd?: string;
}

export interface ChargesPageResult {
  charges: ChargeRow[];
  total: number;
  page: number;
  pageSize: number;
}

const MANAGEMENT_ORIGINS = ["manual", "appointment", "package", "convenio","subscription","recurring"];
const OPEN_STATUSES: FinancialEntryStatus[] = ["planned", "pending", "overdue"];

const normalizeDateKey = (date?: string | null) => date?.slice(0, 10) || null;

const isPastDate = (date?: string | null) => {
  const dateKey = normalizeDateKey(date);
  if (!dateKey) return false;
  return dateKey < new Date().toISOString().slice(0, 10);
};

export function getEffectiveChargeStatus(entry: Pick<FinancialEntry, "status" | "due_date">): ChargeStatusFilter {
  if (entry.status === "paid" || entry.status === "cancelled") return entry.status;
  if (isPastDate(entry.due_date)) return "overdue";
  return entry.status === "planned" ? "planned" : "pending";
}

export function getManagementChargeType(entry: Pick<FinancialEntry, "origin" | "description" | "title">): ChargeTypeFilter {
  const origin = String(entry.origin || "").toLowerCase();
  if (origin === "appointment") return "appointment";
  if (origin === "package") return "package";
  if (origin === "convenio") return "insurance";
  if(origin==="subscription"||origin==="recurring")return "subscription";
  const text = `${entry.title || ""} ${entry.description || ""}`.toLowerCase();
  if (text.includes("mensal") || text.includes("recorr")) return "subscription";
  if (text.includes("parcela")) return "installment";
  return "manual";
}

export function getNeurofinanceChargeType(invoice: Invoice): ChargeTypeFilter {
  const text = `${invoice.description || ""} ${(invoice as any).type || ""} ${(invoice as any).category || ""}`.toLowerCase();
  if (text.includes("assinatura") || text.includes("recorr")) return "subscription";
  if (text.includes("parcela")) return "installment";
  return "single";
}

const normalizeInvoiceStatus = (status?: string | null): ChargeStatusFilter => {
  const value = String(status || "").toLowerCase();
  if (["paid", "received", "confirmed"].includes(value)) return "paid";
  if (["overdue", "expired"].includes(value)) return "overdue";
  if (["cancelled", "canceled", "deleted", "refunded"].includes(value)) return "cancelled";
  return "pending";
};

const invoicePaymentMethod = (invoice: Invoice) => {
  const raw = String(
    (invoice as any).payment_method_type ||
      (invoice as any).payment_method ||
      (invoice as any).billing_type ||
      "",
  ).toLowerCase();

  if (raw.includes("pix")) return "Pix";
  if (raw.includes("card") || raw.includes("cart")) return "Cartao";
  if (raw.includes("boleto")) return "Boleto";
  return invoice.payment_url ? "Link de pagamento" : "A combinar";
};

const invoiceLink = (invoice: Invoice) =>
  invoice.payment_url ||
  invoice.pdf_url ||
  (invoice as any).invoice_url ||
  (invoice as any).bank_slip_url ||
  (invoice as any).metadata?.asaas_invoice_url ||
  (invoice as any).metadata?.asaas_bank_slip_url ||
  null;

export function mapInvoiceToChargeRow(invoice: Invoice): ChargeRow {
  const paymentUrl = invoiceLink(invoice);
  const status = normalizeInvoiceStatus(invoice.status);

  return {
    id: `neurofinance:${invoice.id}`,
    scope: "neurofinance",
    source: "neurofinance",
    patientId: invoice.patient_id || null,
    patientName: null,
    amount: Number(invoice.amount || 0),
    description: invoice.description || `Cobranca ${invoice.invoice_number || invoice.id.slice(0, 8)}`,
    status,
    dueDate: normalizeDateKey(invoice.due_date),
    paidAt: normalizeDateKey((invoice as any).paid_at || (invoice as any).confirmed_at),
    paymentMethod: invoicePaymentMethod(invoice),
    origin: getNeurofinanceChargeType(invoice),
    editable: true,
    links: {
      paymentUrl,
      pdfUrl: invoice.pdf_url || (invoice as any).bank_slip_url || null,
      statementRoute: "extrato",
    },
    financialEntryId: null,
    neurofinancePaymentId: invoice.id,
    raw: invoice,
  };
}

export function mapFinancialEntryToChargeRow(entry: FinancialEntry): ChargeRow {
  const origin = String(entry.origin || "manual");
  const type = getManagementChargeType(entry);

  return {
    id: `management:${entry.id}`,
    scope: "management",
    source: origin,
    patientId: entry.patient_id || null,
    patientName: entry.patients?.name || null,
    amount: Number(entry.amount || 0),
    description: entry.description || entry.title || "Cobranca manual",
    status: getEffectiveChargeStatus(entry),
    dueDate: normalizeDateKey(entry.due_date),
    paidAt: normalizeDateKey(entry.paid_at),
    paymentMethod: entry.payment_method || "manual",
    origin: type,
    editable: true,
    links: {
      patientRoute: entry.patient_id ? `/patients/${entry.patient_id}` : null,
      appointmentRoute: entry.appointment_id ? `/agenda?appointment=${entry.appointment_id}` : null,
    },
    financialEntryId: entry.id,
    neurofinancePaymentId: null,
    raw: entry,
  };
}

export function filterChargeRows(rows: ChargeRow[], params: Omit<ChargesPageParams, "scope" | "page" | "pageSize">) {
  const search = params.search?.trim().toLowerCase();
  const statusFilter = new Set(params.status || []);
  const typeFilter = new Set(params.type || []);

  return rows.filter((row) => {
    const matchesSearch =
      !search ||
      row.description.toLowerCase().includes(search) ||
      row.patientName?.toLowerCase().includes(search) ||
      row.paymentMethod?.toLowerCase().includes(search);
    const matchesStatus = statusFilter.size === 0 || statusFilter.has(row.status);
    const matchesType = typeFilter.size === 0 || typeFilter.has(row.origin as ChargeTypeFilter);
    const matchesDueStart = !params.dueStart || Boolean(row.dueDate && row.dueDate >= params.dueStart);
    const matchesDueEnd = !params.dueEnd || Boolean(row.dueDate && row.dueDate <= params.dueEnd);
    const matchesReceivedStart = !params.receivedStart || Boolean(row.paidAt && row.paidAt >= params.receivedStart);
    const matchesReceivedEnd = !params.receivedEnd || Boolean(row.paidAt && row.paidAt <= params.receivedEnd);

    return matchesSearch && matchesStatus && matchesType && matchesDueStart && matchesDueEnd && matchesReceivedStart && matchesReceivedEnd;
  });
}

export function paginateChargeRows(rows: ChargeRow[], page = 1, pageSize = 25) {
  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.min(50, Math.max(5, pageSize));
  const start = (normalizedPage - 1) * normalizedPageSize;
  return rows.slice(start, start + normalizedPageSize);
}

async function fetchManagementChargesPage(userId: string, params: ChargesPageParams): Promise<ChargesPageResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize || 25));

  let query = supabase
    .from("financial_entries")
    .select("*, patients(name,email), financial_categories(name), financial_entry_settlements(id,amount,settled_at,payment_method,status)")
    .eq("professional_id", userId)
    .eq("type", "income")
    .in("origin", MANAGEMENT_ORIGINS)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (params.status?.some((status) => status !== "overdue")) {
    const requested = params.status.filter((status): status is FinancialEntryStatus => status !== "overdue");
    const expanded = params.status.includes("overdue")
      ? Array.from(new Set([...requested, ...OPEN_STATUSES]))
      : requested;
    if (expanded.length > 0) query = query.in("status", expanded);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data || []) as unknown as FinancialEntry[])
    .map(mapFinancialEntryToChargeRow)
    .sort((left, right) => {
      const leftDate = left.dueDate || "9999-12-31";
      const rightDate = right.dueDate || "9999-12-31";
      return leftDate.localeCompare(rightDate) || right.description.localeCompare(left.description);
    });

  const filtered = filterChargeRows(rows, params);

  return {
    charges: paginateChargeRows(filtered, page, pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

async function fetchNeurofinanceChargesPage(userId: string, params: ChargesPageParams): Promise<ChargesPageResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(5, params.pageSize || 25));
  const invoiceResult = await fetchInvoicesPage(userId, {
    page,
    pageSize,
    search: params.search,
    status: params.status?.filter((status) => status !== "planned"),
  });
  const rows = invoiceResult.invoices.map(mapInvoiceToChargeRow);
  const filtered = filterChargeRows(rows, params);

  return {
    charges: filtered,
    total: invoiceResult.total,
    page: invoiceResult.page,
    pageSize: invoiceResult.pageSize,
  };
}

export function useChargesPage(params: ChargesPageParams) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<ChargesPageResult, Error>({
    queryKey: ["charges-page", userId, params],
    enabled: Boolean(userId),
    placeholderData: (previous) => previous,
    queryFn: () => {
      if (!userId) throw new Error("Usuário não autenticado");
      return params.scope === "management"
        ? fetchManagementChargesPage(userId, params)
        : fetchNeurofinanceChargesPage(userId, params);
    },
  });
}
