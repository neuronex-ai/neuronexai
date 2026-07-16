export type OutgoingKind = "pix_qr_payment" | "pix_transfer" | "payout_pix" | "payout_bank";

export const OUTGOING_CONSULTATION_TTL_MS = 10 * 60 * 1000;

export function cents(value: unknown) {
    return Math.max(0, Math.round(Number(value || 0) * 100));
}

export function isExpired(record: any) {
    return !record?.consultation_expires_at ||
        new Date(record.consultation_expires_at).getTime() <= Date.now();
}

export function providerReceiptUrl(payload: any) {
    return payload?.transactionReceiptUrl ||
        payload?.receiptUrl ||
        payload?.paymentReceiptUrl ||
        null;
}

export function normalizeTransferStatus(status?: string) {
    const value = String(status || "PENDING").toUpperCase();
    if (value === "DONE") return "paid";
    if (value === "FAILED") return "failed";
    if (value === "CANCELLED" || value === "CANCELED") return "canceled";
    if (value === "BANK_PROCESSING") return "in_transit";
    return "pending";
}

export function normalizePixTransactionStatus(status?: string) {
    const value = String(status || "REQUESTED").toUpperCase();
    if (value === "DONE") return "paid";
    if (value === "REFUSED" || value === "FAILED") return "failed";
    if (value === "CANCELLED" || value === "CANCELED") return "canceled";
    if (value === "SCHEDULED") return "pending";
    return "in_transit";
}

export function detectPixKeyType(rawValue: unknown): "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" {
    const value = String(rawValue || "").trim();
    const digits = value.replace(/\D/g, "");
    if (value.includes("@")) return "EMAIL";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        return "EVP";
    }
    if (digits.length === 11 && !value.startsWith("+")) return "CPF";
    if (digits.length === 14) return "CNPJ";
    return "PHONE";
}

export function normalizePixKeyForProvider(rawValue: unknown, type = detectPixKeyType(rawValue)) {
    const value = String(rawValue || "").trim();
    if (type === "CPF" || type === "CNPJ") return value.replace(/\D/g, "");
    if (type === "PHONE") {
        const digits = value.replace(/\D/g, "");
        return value.startsWith("+") ? `+${digits}` : digits.length >= 12 ? `+${digits}` : value;
    }
    return value;
}

export function normalizeExternalPixKeyLookup(raw: any) {
    const owner = raw?.owner || raw?.account?.owner || raw?.recipient || {};
    const institution = raw?.financialInstitution || raw?.institution || raw?.account?.financialInstitution || {};
    return {
        key: raw?.key || raw?.pixAddressKey || raw?.addressKey || null,
        type: raw?.type || raw?.keyType || null,
        holderName: owner?.name || owner?.fullName || raw?.ownerName || raw?.name || null,
        holderDocument: owner?.cpfCnpj || owner?.document || raw?.cpfCnpj || raw?.ownerDocument || null,
        bankCode: institution?.code || institution?.bank?.code || raw?.bankCode || null,
        bankName: institution?.name || raw?.ispbName || raw?.institutionName || null,
        raw,
    };
}

export function normalizePixQrConsultation(raw: any) {
    const receiver = raw?.receiver || raw?.recipient || {};
    const totalValue = Number(raw?.totalValue ?? raw?.value ?? 0);
    return {
        payload: String(raw?.payload || ""),
        type: String(raw?.type || ""),
        transactionOriginType: String(raw?.transactionOriginType || ""),
        pixKey: String(raw?.pixKey || ""),
        conciliationIdentifier: String(raw?.conciliationIdentifier || ""),
        dueDate: raw?.dueDate || null,
        expirationDate: raw?.expirationDate || null,
        description: raw?.description || null,
        value: Number.isFinite(totalValue) ? totalValue : 0,
        canBePaid: raw?.canBePaid === true,
        cannotBePaidReason: raw?.cannotBePaidReason || null,
        canBePaidWithDifferentValue: raw?.canBePaidWithDifferentValue === true,
        receiver: {
            name: receiver?.name || receiver?.tradingName || receiver?.holderName || null,
            tradingName: receiver?.tradingName || null,
            cpfCnpj: receiver?.cpfCnpj || receiver?.document || null,
            ispb: receiver?.ispb || null,
            ispbName: receiver?.ispbName || receiver?.institutionName || receiver?.financialInstitution?.name || null,
            accountType: receiver?.accountType || null,
        },
    };
}

export function validatePixQrConsultation(consultation: ReturnType<typeof normalizePixQrConsultation>) {
    const missing: string[] = [];
    if (!consultation.payload) missing.push("payload");
    if (!consultation.receiver.name) missing.push("receiver.name");
    if (!consultation.receiver.cpfCnpj) missing.push("receiver.cpfCnpj");
    if (!consultation.receiver.ispbName && !consultation.receiver.ispb) missing.push("receiver.institution");
    if (!consultation.canBePaidWithDifferentValue && consultation.value <= 0) missing.push("value");
    return missing;
}

function maskDocument(value: unknown) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    if (digits.length === 14) return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-${digits.slice(-2)}`;
    return "Não informado";
}

function publicDestination(value: unknown) {
    const destination = value && typeof value === "object"
        ? value as Record<string, unknown>
        : {};
    return {
        type: destination.type || null,
        bank_code: destination.bank_code || null,
        bank_name: destination.bank_name || null,
        agency: destination.agency || null,
        account_last4: String(destination.account || "").replace(/\D/g, "").slice(-4) || null,
        holder_name: destination.holder_name || null,
        holder_document: maskDocument(destination.holder_document),
        summary: destination.summary || null,
    };
}

export function outgoingResponse(record: any) {
    return {
        id: record.id,
        kind: record.kind,
        status: record.status,
        amount: Number(record.amount || 0) / 100,
        fee: Number(record.fee_amount || 0) / 100,
        availableBalance: record.available_balance_at_review == null
            ? null
            : Number(record.available_balance_at_review) / 100,
        destinationSummary: record.destination_summary,
        destination: publicDestination(record.destination_payload),
        expiresAt: record.consultation_expires_at,
        receiptUrl: record.receipt_url,
    };
}
