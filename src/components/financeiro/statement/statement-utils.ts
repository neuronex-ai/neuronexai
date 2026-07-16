import { format, isSameDay, isValid, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { Patient, Transaction } from "@/types";

export type StatementSortOrder = "desc" | "asc";
export type StatementTypeFilter = "all" | "income" | "expense";
export type StatementOriginFilter = "neurofinance" | "manual" | "agenda";
export type StatementPaymentMethodFilter =
    | "pix"
    | "boleto"
    | "card"
    | "cash"
    | "convenio"
    | "external_transfer"
    | "manual"
    | "other";
export type StatementTransferMethodFilter = "pix";

export interface DetailedStatementFilters {
    startDate: string;
    endDate: string;
    type: StatementTypeFilter;
    paymentMethods: StatementPaymentMethodFilter[];
    origins: StatementOriginFilter[];
    patientIds: string[];
    recipientQuery: string;
    feesOnly: boolean;
    transferMethods: StatementTransferMethodFilter[];
}

export interface StatementDateGroup {
    key: string;
    label: string;
    transactions: Transaction[];
}

export const emptyDetailedStatementFilters = (): DetailedStatementFilters => ({
    startDate: "",
    endDate: "",
    type: "all",
    paymentMethods: [],
    origins: [],
    patientIds: [],
    recipientQuery: "",
    feesOnly: false,
    transferMethods: [],
});

export function isPixReceivedStatementPreset(filters: DetailedStatementFilters) {
    return filters.type === "income" &&
        filters.paymentMethods.length === 1 &&
        filters.paymentMethods[0] === "pix";
}

export function togglePixReceivedStatementPreset(filters: DetailedStatementFilters) {
    if (isPixReceivedStatementPreset(filters)) {
        return {
            ...filters,
            type: "all" as const,
            paymentMethods: [],
        };
    }

    return {
        ...filters,
        type: "income" as const,
        paymentMethods: ["pix" as const],
    };
}

export const normalizeStatementText = (value: unknown) =>
    String(value || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();

export function transactionTimestamp(transaction: Transaction) {
    const date = new Date(transaction.date);
    return isValid(date) ? date.getTime() : 0;
}

export function sortStatementTransactions(transactions: Transaction[], sortOrder: StatementSortOrder) {
    const direction = sortOrder === "desc" ? -1 : 1;
    return [...transactions].sort((left, right) => {
        const leftTime = transactionTimestamp(left);
        const rightTime = transactionTimestamp(right);
        if (leftTime === rightTime) return left.id.localeCompare(right.id) * direction;
        return (leftTime - rightTime) * direction;
    });
}

export function statementDateGroupLabel(date: Date, now = new Date()) {
    if (!isValid(date)) return "Data indisponível";
    if (isSameDay(date, now)) return "Hoje";
    if (isSameDay(date, subDays(now, 1))) return "Ontem";

    const pattern = date.getFullYear() === now.getFullYear()
        ? "dd 'de' MMMM"
        : "dd 'de' MMMM 'de' yyyy";

    return format(date, pattern, { locale: ptBR });
}

export function groupStatementTransactionsByDate(
    transactions: Transaction[],
    sortOrder: StatementSortOrder,
    now = new Date(),
): StatementDateGroup[] {
    const groups = new Map<string, StatementDateGroup>();

    for (const transaction of sortStatementTransactions(transactions, sortOrder)) {
        const date = new Date(transaction.date);
        const key = isValid(date) ? format(date, "yyyy-MM-dd") : "invalid";
        const label = isValid(date) ? statementDateGroupLabel(date, now) : "Data indisponível";

        if (!groups.has(key)) {
            groups.set(key, { key, label, transactions: [] });
        }

        groups.get(key)!.transactions.push(transaction);
    }

    return Array.from(groups.values());
}

export function transactionMetadata(transaction: Transaction) {
    return ((transaction.metadata || {}) as Record<string, unknown>) || {};
}

function metadataString(transaction: Transaction, keys: string[]) {
    const metadata = transactionMetadata(transaction);
    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === "string" && value.trim()) return value;
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return "";
}

export function hasNeuroFinanceReference(transaction: Transaction) {
    const metadata = transactionMetadata(transaction);
    const source = normalizeStatementText(metadata.source);
    return (
        transaction.origin === "gateway_auto" ||
        Boolean(metadata.asaas_payment_id) ||
        Boolean(metadata.asaas_transfer_id) ||
        Boolean(metadata.provider_type) ||
        source === "neurofinance" ||
        source === "provider_sync" ||
        source === "provider_statement" ||
        source === "webhook"
    );
}

export function getStatementOrigin(transaction: Transaction): StatementOriginFilter {
    const metadata = transactionMetadata(transaction);
    const financialOrigin = normalizeStatementText(metadata.financial_entry_origin);
    const isAppointmentOrigin = financialOrigin === "appointment" || Boolean(transaction.appointment_id);

    if (isAppointmentOrigin && !hasNeuroFinanceReference(transaction)) return "agenda";
    if (financialOrigin === "neurofinance" || hasNeuroFinanceReference(transaction)) return "neurofinance";
    return "manual";
}

export function shouldIncludeInDetailedStatement(transaction: Transaction) {
    const origin = getStatementOrigin(transaction);
    if (origin !== "agenda") return true;
    return transaction.status === "completed" || hasNeuroFinanceReference(transaction);
}

export function getStatementPatientName(transaction: Transaction) {
    return transaction.patient_name || transaction.patients?.name || "";
}

export function getStatementPaymentMethod(transaction: Transaction): StatementPaymentMethodFilter {
    const raw = normalizeStatementText(
        metadataString(transaction, [
            "financial_entry_payment_method",
            "payment_method",
            "billing_type",
            "asaas_billing_type",
        ]) || transaction.payment_method ||
        metadataString(transaction, ["provider_type"]) ||
        "other",
    );

    if (raw === "pix" || raw.includes("pix")) return "pix";
    if (raw === "boleto" || raw === "bank_slip") return "boleto";
    if (["card", "credit_card", "debit_card", "debit"].includes(raw)) return "card";
    if (["cash", "money"].includes(raw)) return "cash";
    if (raw === "convenio") return "convenio";
    if (raw === "external_transfer") return "external_transfer";
    if (raw === "manual") return "manual";
    return "other";
}

export function getStatementPaymentMethodLabel(transaction: Transaction) {
    const labels: Record<StatementPaymentMethodFilter, string> = {
        pix: "Pix",
        boleto: "Boleto",
        card: "Cartão",
        cash: "Dinheiro",
        convenio: "Convênio",
        external_transfer: "Transferência externa",
        manual: "Lançamento gerencial",
        other: "Não informado",
    };

    return labels[getStatementPaymentMethod(transaction)];
}

export type StatementStatusKind = "completed" | "pending" | "processing" | "cancelled" | "failed" | "overdue";

export function getStatementStatusPresentation(transaction: Transaction): {
    kind: StatementStatusKind;
    label: string;
} {
    const raw = normalizeStatementText(
        metadataString(transaction, ["financial_entry_status", "provider_status", "normalized_status"]) ||
        transaction.status ||
        "pending",
    );

    if (["paid", "completed", "settled", "posted", "received"].includes(raw)) {
        return { kind: "completed", label: "Confirmado" };
    }
    if (["cancelled", "canceled", "voided", "deleted"].includes(raw)) {
        return { kind: "cancelled", label: "Cancelado" };
    }
    if (["failed", "error", "rejected", "refused"].includes(raw)) {
        return { kind: "failed", label: "Não concluído" };
    }
    if (["processing", "in_process", "authorized", "confirmed"].includes(raw)) {
        return { kind: "processing", label: "Em processamento" };
    }
    if (["overdue", "expired"].includes(raw)) {
        return { kind: "overdue", label: "Vencido" };
    }
    return { kind: "pending", label: "Pendente" };
}

export function isStatementFeeTransaction(transaction: Transaction) {
    const category = normalizeStatementText(transaction.category);
    const itemType = normalizeStatementText(metadataString(transaction, ["item_type", "provider_type"]));
    const description = normalizeStatementText(transaction.description);
    return (
        category.includes("fee") ||
        category.includes("taxa") ||
        itemType.includes("fee") ||
        itemType.includes("taxa") ||
        description.includes("taxa") ||
        description.includes("tarifa")
    );
}

export function getStatementTransferMethod(transaction: Transaction): StatementTransferMethodFilter | null {
    const method = normalizeStatementText(
        metadataString(transaction, ["operation_type", "transfer_method", "provider_type"]) ||
        transaction.payment_method ||
        transaction.description,
    );

    if (method.includes("pix")) return "pix";
    return null;
}

export function getStatementRecipient(transaction: Transaction) {
    return metadataString(transaction, [
        "destination_summary",
        "recipient_name",
        "recipient",
        "pix_key",
        "pixAddressKey",
        "transfer_destination",
    ]) || (transaction.type === "expense" ? transaction.description : "");
}

export function countDetailedStatementFilters(filters: DetailedStatementFilters) {
    return Number(Boolean(filters.startDate)) +
        Number(Boolean(filters.endDate)) +
        Number(filters.type !== "all") +
        filters.paymentMethods.length +
        filters.origins.length +
        filters.patientIds.length +
        Number(Boolean(filters.recipientQuery.trim())) +
        Number(filters.feesOnly) +
        filters.transferMethods.length;
}

export function filterDetailedStatementTransactions(
    transactions: Transaction[],
    filters: DetailedStatementFilters,
    patients: Patient[] = [],
) {
    const startTime = filters.startDate ? new Date(`${filters.startDate}T00:00:00`).getTime() : null;
    const endTime = filters.endDate ? new Date(`${filters.endDate}T23:59:59`).getTime() : null;
    const selectedPatientNames = new Set(
        patients
            .filter((patient) => filters.patientIds.includes(patient.id))
            .map((patient) => normalizeStatementText(patient.name)),
    );
    const recipientQuery = normalizeStatementText(filters.recipientQuery);

    return transactions.filter((transaction) => {
        if (!shouldIncludeInDetailedStatement(transaction)) return false;

        const timestamp = transactionTimestamp(transaction);
        if (startTime !== null && timestamp < startTime) return false;
        if (endTime !== null && timestamp > endTime) return false;

        if (filters.type !== "all" && transaction.type !== filters.type) return false;

        if (filters.paymentMethods.length > 0 && !filters.paymentMethods.includes(getStatementPaymentMethod(transaction))) {
            return false;
        }

        if (filters.origins.length > 0 && !filters.origins.includes(getStatementOrigin(transaction))) {
            return false;
        }

        if (filters.patientIds.length > 0) {
            const patientName = normalizeStatementText(getStatementPatientName(transaction));
            const hasPatientId = Boolean(transaction.patient_id && filters.patientIds.includes(transaction.patient_id));
            const hasPatientName = Boolean(patientName && selectedPatientNames.has(patientName));
            if (!hasPatientId && !hasPatientName) return false;
        }

        if (recipientQuery) {
            const recipient = normalizeStatementText(getStatementRecipient(transaction));
            const description = normalizeStatementText(transaction.description);
            if (!recipient.includes(recipientQuery) && !description.includes(recipientQuery)) return false;
        }

        if (filters.feesOnly && !isStatementFeeTransaction(transaction)) return false;

        if (filters.transferMethods.length > 0) {
            const transferMethod = getStatementTransferMethod(transaction);
            if (!transferMethod || !filters.transferMethods.includes(transferMethod)) return false;
        }

        return true;
    });
}
