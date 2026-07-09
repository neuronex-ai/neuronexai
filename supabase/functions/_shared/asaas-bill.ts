export interface NormalizedBillSimulation {
    identificationField: string | null;
    value: number;
    fee: number;
    dueDate: string | null;
    minimumScheduleDate: string | null;
    beneficiaryName: string | null;
    beneficiaryDocument: string | null;
    bankCode: string | null;
    bankName: string | null;
}

function text(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
}

function digits(value: unknown) {
    return String(value || "").replace(/\D/g, "") || null;
}

function money(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeAsaasBillSimulation(payload: Record<string, unknown>): NormalizedBillSimulation {
    const bankSlipInfo = payload.bankSlipInfo && typeof payload.bankSlipInfo === "object"
        ? payload.bankSlipInfo as Record<string, unknown>
        : {};
    const beneficiary = payload.beneficiary && typeof payload.beneficiary === "object"
        ? payload.beneficiary as Record<string, unknown>
        : {};
    const bank = bankSlipInfo.bank && typeof bankSlipInfo.bank === "object"
        ? bankSlipInfo.bank as Record<string, unknown>
        : payload.bank && typeof payload.bank === "object"
            ? payload.bank as Record<string, unknown>
            : {};

    return {
        identificationField: digits(
            bankSlipInfo.identificationField
            || payload.identificationField
            || payload.identification_field,
        ),
        value: money(bankSlipInfo.value ?? bankSlipInfo.originalValue ?? payload.value ?? payload.amount),
        fee: money(payload.fee ?? bankSlipInfo.fee),
        dueDate: text(bankSlipInfo.dueDate ?? payload.dueDate ?? payload.due_date),
        minimumScheduleDate: text(payload.minimumScheduleDate ?? bankSlipInfo.minimumScheduleDate),
        beneficiaryName: text(
            bankSlipInfo.beneficiaryName
            ?? payload.beneficiaryName
            ?? beneficiary.name,
        ),
        beneficiaryDocument: digits(
            bankSlipInfo.beneficiaryCpfCnpj
            ?? payload.beneficiaryDocument
            ?? beneficiary.cpfCnpj,
        ),
        bankCode: digits(
            typeof bankSlipInfo.bank === "string"
                ? bankSlipInfo.bank
                : bank.code ?? payload.bankCode,
        ),
        bankName: text(
            bankSlipInfo.bankName
            ?? payload.bankName
            ?? bank.name,
        ),
    };
}

export function validateNormalizedBillSimulation(bill: NormalizedBillSimulation) {
    const missing: string[] = [];
    if (!bill.identificationField) missing.push("linha digitavel");
    if (!(bill.value > 0)) missing.push("valor");
    if (!bill.dueDate) missing.push("vencimento");
    if (!bill.beneficiaryName) missing.push("beneficiario");
    if (!bill.beneficiaryDocument) missing.push("documento do beneficiario");
    if (!bill.bankCode && !bill.bankName) missing.push("instituição bancária");
    return missing;
}
