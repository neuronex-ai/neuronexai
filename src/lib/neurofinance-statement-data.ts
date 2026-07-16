import type { AccountMovement } from "@/lib/neurofinance-types";
import type { PaymentMethod, Transaction } from "@/types";

export type NeuroFinanceBalanceDetailView = "total" | "andamento" | "futuro" | "saldo";

export const neuroFinanceOverviewItemsQueryKey = (userId?: string) =>
  ["neurofinance-overview-items", userId] as const;

const VIEW_GROUP: Record<
  NeuroFinanceBalanceDetailView,
  AccountMovement["overview_group"] | null
> = {
  total: "income",
  andamento: "outflow",
  futuro: "receivable",
  saldo: null,
};

const OVERVIEW_GROUPS = new Set<AccountMovement["overview_group"]>([
  "income",
  "receivable",
  "outflow",
]);

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function parseAccountMovementRows(value: unknown): AccountMovement[] {
  if (!Array.isArray(value)) throw new Error("Resposta inválida do extrato NeuroFinance.");

  return value.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("Resposta inválida do extrato NeuroFinance.");
    }

    const row = raw as Record<string, unknown>;
    const overviewGroup = nullableString(row.overview_group);
    if (
      !overviewGroup ||
      !OVERVIEW_GROUPS.has(overviewGroup as AccountMovement["overview_group"]) ||
      typeof row.id !== "string" ||
      typeof row.item_type !== "string" ||
      typeof row.description !== "string" ||
      typeof row.amount !== "number" ||
      typeof row.currency !== "string" ||
      typeof row.status !== "string" ||
      typeof row.occurred_at !== "string"
    ) {
      throw new Error("Resposta inválida do extrato NeuroFinance.");
    }

    return {
      id: row.id,
      overview_group: overviewGroup as AccountMovement["overview_group"],
      item_type: row.item_type,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      payment_method: nullableString(row.payment_method),
      occurred_at: row.occurred_at,
      patient_name: nullableString(row.patient_name),
      receipt_url: nullableString(row.receipt_url),
      invoice_url: nullableString(row.invoice_url),
      bank_slip_url: nullableString(row.bank_slip_url),
    };
  });
}

function normalizePaymentMethod(method: string | null): PaymentMethod | undefined {
  if (!method) return undefined;
  if (method === "card") return "credit_card";
  if (method === "debit") return "debit_card";
  return method as PaymentMethod;
}

export function humanizeAccountMovementCategory(itemType: string) {
  const normalized = itemType.trim().toLowerCase();
  if (normalized.includes("chargeback") || normalized.includes("dispute")) {
    return "Contestação";
  }
  if (normalized.includes("refund") || normalized.includes("reversal")) {
    return "Estorno";
  }
  if (normalized.includes("fee")) return "Tarifa";
  if (normalized.includes("transfer")) return "Transferência";
  if (normalized.includes("pix") && normalized.includes("credit")) return "Pix recebido";
  if (normalized.includes("credit")) return "Entrada";
  if (normalized.includes("debit")) return "Saída";
  if (normalized === "payment") return "Cobrança";
  return "Movimentação";
}

function humanizeAccountMovementDescription(item: AccountMovement) {
  const description = String(item.description || "").trim();
  const looksInternal = !description ||
    description.toLowerCase() === item.item_type.toLowerCase() ||
    /^[A-Z][A-Z0-9_]+$/.test(description);
  return looksInternal
    ? humanizeAccountMovementCategory(item.item_type)
    : description;
}

export function mapAccountMovementToTransaction(
  item: AccountMovement,
  userId: string,
): Transaction {
  const metadata = {
    overview_group: item.overview_group,
    item_type: item.item_type,
    payment_method: item.payment_method,
    source: "neurofinance",
  };
  const receiptUrl = item.receipt_url || undefined;
  const invoiceUrl = item.invoice_url || undefined;
  const bankSlipUrl = item.bank_slip_url || undefined;
  const safeDescription = humanizeAccountMovementDescription(item);

  return {
    id: item.id,
    user_id: userId,
    description: item.patient_name
      ? `${item.patient_name} · ${safeDescription}`
      : safeDescription,
    amount: Number(item.amount || 0) / 100,
    type: item.overview_group === "outflow" ? "expense" : "income",
    category: humanizeAccountMovementCategory(item.item_type),
    date: item.occurred_at,
    appointment_id: null,
    created_at: item.occurred_at,
    payment_method: normalizePaymentMethod(item.payment_method),
    status:
      item.overview_group !== "receivable" &&
      ["paid", "posted", "completed"].includes(item.status)
        ? "completed"
        : "pending",
    attachment_url: receiptUrl || invoiceUrl || bankSlipUrl,
    origin: "gateway_auto",
    patient_name: item.patient_name || undefined,
    metadata,
    receipt_url: receiptUrl,
    invoice_url: invoiceUrl,
    bank_slip_url: bankSlipUrl,
    patients: item.patient_name
      ? { name: item.patient_name, email: null }
      : null,
  };
}

export function filterBalanceDetailsByView(
  items: AccountMovement[],
  view: NeuroFinanceBalanceDetailView,
) {
  const group = VIEW_GROUP[view];
  return group ? items.filter((item) => item.overview_group === group) : items;
}

export function filterAccountMovementsByDateRange(
  items: AccountMovement[],
  startIso: string,
  endIso: string,
) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  return items.filter((item) => {
    const timestamp = new Date(item.occurred_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
  });
}
