import { supabaseAdmin } from "./asaas-client.ts";

type ManagerialPaymentMethod =
    | "manual"
    | "pix"
    | "boleto"
    | "card"
    | "cash"
    | "external_transfer"
    | "convenio"
    | "other";

type ManagerialStatus = "planned" | "pending" | "paid" | "overdue" | "cancelled";

export function normalizeManagerialPaymentMethod(method?: string | null): ManagerialPaymentMethod {
    const normalized = String(method || "").toLowerCase();

    if (normalized === "pix") return "pix";
    if (normalized === "boleto") return "boleto";
    if (["card", "credit_card", "debit", "debit_card", "credit"].includes(normalized)) return "card";
    if (["cash", "money"].includes(normalized)) return "cash";
    if (["external_transfer", "transfer", "bank_transfer", "ted", "doc"].includes(normalized)) return "external_transfer";
    if (["convenio", "insurance", "health_plan"].includes(normalized)) return "convenio";
    if (normalized === "manual") return "manual";

    return "other";
}

export function managerialStatusFromPayment(payment: any): ManagerialStatus {
    const normalizedStatus = String(payment?.normalized_status || payment?.status || payment?.provider_status || "").toLowerCase();
    const fundsStatus = String(payment?.funds_status || "").toLowerCase();

    if (["paid", "confirmed", "received"].includes(normalizedStatus)) return "paid";
    if (["available", "confirmed"].includes(fundsStatus)) return "paid";
    if (["refunded", "chargeback"].includes(normalizedStatus) || ["refunded", "chargeback"].includes(fundsStatus)) return "paid";
    if (["overdue", "expired"].includes(normalizedStatus)) return "overdue";
    if (["canceled", "cancelled", "deleted", "failed", "refused"].includes(normalizedStatus)) {
        return "cancelled";
    }

    return "pending";
}

function paymentPaidAt(payment: any, status: ManagerialStatus) {
    if (status !== "paid") return null;
    return payment?.paid_at || payment?.paymentDate || payment?.confirmed_at || payment?.confirmedDate || new Date().toISOString();
}

function dateOnly(value?: string | null) {
    if (!value) return null;
    return String(value).slice(0, 10);
}

function centsToReais(value?: number | string | null) {
    return Number(value || 0) / 100;
}

function isFinalReversalPayment(payment: any) {
    const normalizedStatus = String(payment?.normalized_status || payment?.status || payment?.provider_status || "").toLowerCase();
    const fundsStatus = String(payment?.funds_status || "").toLowerCase();
    const legacyStatus = String(payment?.status || "").toLowerCase();

    if (legacyStatus === "processing") return false;
    return ["refunded", "chargeback"].includes(normalizedStatus) || ["refunded", "chargeback"].includes(fundsStatus);
}

function reversalReasonFromPayment(payment: any) {
    const normalizedStatus = String(payment?.normalized_status || payment?.funds_status || "").toLowerCase();
    if (normalizedStatus === "chargeback" || String(payment?.funds_status || "").toLowerCase() === "chargeback") {
        return "chargeback";
    }
    return "refund";
}

function reversalAmountCents(payment: any) {
    const explicitRefund = Number(payment?.refund_amount || payment?.metadata?.refund_amount || 0);
    if (explicitRefund > 0) return explicitRefund;
    return Number(payment?.gross_amount || 0);
}

async function findPaymentMovementId(payment: any) {
    const referenceIds = [payment?.provider_payment_id, payment?.id].filter(Boolean);
    if (!payment?.financial_account_id || referenceIds.length === 0) return null;

    const { data, error } = await supabaseAdmin
        .from("neurofinance_account_movements")
        .select("id")
        .eq("financial_account_id", payment.financial_account_id)
        .eq("reference_type", "payment")
        .in("reference_id", referenceIds)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.warn("[financial-management] Could not resolve payment movement:", error);
        return null;
    }

    return data?.id || null;
}

export async function ensureFinancialEntryForCharge(input: {
    userId: string;
    financialEntryId?: string | null;
    operationId?:string|null;
    patientId?: string | null;
    appointmentId?: string | null;
    amount: number;
    description?: string | null;
    dueDate?: string | null;
    paymentMethod?: string | null;
    neurofinanceChargeId?: string | null;
}) {
    const paymentMethod = normalizeManagerialPaymentMethod(input.paymentMethod);
    const operationId=input.operationId?.trim()||null;const operationKey=operationId?`neurofinance:operation:${operationId}`:null;let existingEntry:any=null;

    if (input.financialEntryId) {
        const{data,error}=await supabaseAdmin.from("financial_entries").select("*").eq("id",input.financialEntryId).eq("professional_id",input.userId).maybeSingle();if(error)throw error;if(!data)throw new Error("Lançamento financeiro não encontrado para vincular a cobrança.");existingEntry=data;
    } else if(operationKey){const{data,error}=await supabaseAdmin.from("financial_entries").select("*").eq("professional_id",input.userId).eq("idempotency_key",operationKey).maybeSingle();if(error)throw error;existingEntry=data;}
    if(existingEntry){
        const existingPatch: Record<string, unknown> = {
            patient_id: input.patientId || null,
            appointment_id: input.appointmentId || null,
            amount: centsToReais(input.amount),
            due_date: input.dueDate || null,
            competence_date: input.dueDate || null,
            payment_method: paymentMethod,
            origin:input.neurofinanceChargeId?"neurofinance":existingEntry.origin||"manual",
            metadata:{...(existingEntry.metadata||{}),source:"asaas-create-payment",neurofinance_operation_id:operationId},
            updated_at: new Date().toISOString(),
        };

        if (input.neurofinanceChargeId) {
            existingPatch.neurofinance_charge_id = input.neurofinanceChargeId;
            existingPatch.idempotency_key = `neurofinance:charge:${input.neurofinanceChargeId}`;
        }

        const { data: entry, error } = await supabaseAdmin
            .from("financial_entries")
            .update(existingPatch)
            .eq("id", existingEntry.id)
            .eq("professional_id", input.userId)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!entry) throw new Error("Lançamento financeiro não encontrado para vincular a cobrança.");
        return entry;
    }

    const { data: entry, error } = await supabaseAdmin
        .from("financial_entries")
        .insert({
            professional_id: input.userId,
            patient_id: input.patientId || null,
            appointment_id: input.appointmentId || null,
            type: "income",
            title: input.description || "Cobranca NeuroFinance",
            description: input.description || "Cobranca NeuroFinance",
            amount: centsToReais(input.amount),
            due_date: input.dueDate || null,
            competence_date: input.dueDate || null,
            status: "pending",
            payment_method: paymentMethod,
            origin:input.neurofinanceChargeId?"neurofinance":"manual",
            neurofinance_charge_id: input.neurofinanceChargeId || null,
            idempotency_key: input.neurofinanceChargeId
                ? `neurofinance:charge:${input.neurofinanceChargeId}`
                : operationKey,
            metadata: {
                source: "asaas-create-payment",
                neurofinance_operation_id:operationId,
            },
        })
        .select()
        .single();

    if (error) throw error;
    return entry;
}

export async function syncFinancialEntryForPayment(payment: any, options?: {
    matchedBy?: "automatic" | "manual";
    notes?: string | null;
}) {
    if (!payment?.id) return null;

    const status = managerialStatusFromPayment(payment);
    const paidAt = paymentPaidAt(payment, status);
    const paymentMethod = normalizeManagerialPaymentMethod(payment.payment_method_type || payment.metadata?.billing_type);
    const movementId = await findPaymentMovementId(payment);
    const now = new Date().toISOString();
    const amount = centsToReais(payment.gross_amount);
    const dueDate = dateOnly(payment.expires_at || payment.provider_due_date);
    const competenceDate = dateOnly(paidAt || payment.created_at || dueDate);
    const entryId = payment.financial_entry_id || payment.metadata?.financial_entry_id || null;
    const chargeIdempotencyKey = `neurofinance:charge:${payment.id}`;
    const isReversal = isFinalReversalPayment(payment);

    let existingEntry: any = null;
    if (entryId) {
        const { data, error } = await supabaseAdmin
            .from("financial_entries")
            .select("*")
            .eq("id", entryId)
            .eq("professional_id", payment.user_id)
            .maybeSingle();
        if (error) throw error;
        existingEntry = data;
    }

    if (!existingEntry) {
        const { data, error } = await supabaseAdmin
            .from("financial_entries")
            .select("*")
            .eq("professional_id", payment.user_id)
            .eq("neurofinance_charge_id", payment.id)
            .maybeSingle();
        if (error) throw error;
        existingEntry = data;
    }

    const nextStatus = isReversal
        ? "paid"
        : existingEntry?.status === "paid" && status === "cancelled"
            ? "paid"
            : status;

    const patch = {
        patient_id: payment.patient_id || null,
        appointment_id: payment.appointment_id || null,
        type: "income",
        title: payment.description || "Cobranca NeuroFinance",
        description: payment.description || "Cobranca NeuroFinance",
        amount,
        due_date: dueDate,
        competence_date: competenceDate,
        paid_at: nextStatus === "paid" ? paidAt || existingEntry?.paid_at || now : null,
        status: nextStatus,
        payment_method: paymentMethod,
        origin: "neurofinance",
        neurofinance_transaction_id: movementId,
        neurofinance_charge_id: payment.id,
        idempotency_key: existingEntry?.idempotency_key || chargeIdempotencyKey,
        updated_at: now,
    };

    let entry: any = null;

    if (existingEntry?.id) {
        const { data, error } = await supabaseAdmin
            .from("financial_entries")
            .update(patch)
            .eq("id", existingEntry.id)
            .eq("professional_id", payment.user_id)
            .select()
            .maybeSingle();

        if (error) throw error;
        entry = data;
    }

    if (!entry) {
        const { data, error } = await supabaseAdmin
            .from("financial_entries")
            .insert({
                ...patch,
                professional_id: payment.user_id,
                idempotency_key: chargeIdempotencyKey,
                metadata: {
                    source: "neurofinance_payment_sync",
                    provider: payment.provider || "asaas",
                    provider_payment_id: payment.provider_payment_id || null,
                },
            })
            .select()
            .single();

        if (error) throw error;
        entry = data;
    }

    if (!payment.financial_entry_id || payment.financial_entry_id !== entry.id) {
        const { error } = await supabaseAdmin
            .from("nb_payments")
            .update({
                financial_entry_id: entry.id,
                metadata: {
                    ...(payment.metadata || {}),
                    financial_entry_id: entry.id,
                },
                updated_at: now,
            })
            .eq("id", payment.id);

        if (error) throw error;
    }

    if (isReversal) {
        await ensureFinancialEntryReversal({
            originalEntry: entry,
            payment,
            amountCents: reversalAmountCents(payment),
            paymentMethod,
            movementId,
            now,
            reason: reversalReasonFromPayment(payment),
            matchedBy: options?.matchedBy || "automatic",
            notes: options?.notes || null,
        });
    }

    const reconciliationPatch = {
        clinic_id: entry.clinic_id || null,
        professional_id: entry.professional_id,
        financial_entry_id: entry.id,
        neurofinance_transaction_id: movementId,
        neurofinance_charge_id: payment.id,
        matched_by: options?.matchedBy || "automatic",
        matched_at: now,
        confidence_score: 1,
        idempotency_key: `reconciliation:${entry.id}:${payment.id}`,
        notes: options?.notes || null,
        metadata: {
            provider: payment.provider || "asaas",
            provider_payment_id: payment.provider_payment_id || null,
            normalized_status: payment.normalized_status || payment.status || null,
        },
    };

    const { data: existingReconciliation, error: existingReconciliationError } = await supabaseAdmin
        .from("financial_reconciliations")
        .select("id")
        .eq("financial_entry_id", entry.id)
        .eq("neurofinance_charge_id", payment.id)
        .maybeSingle();

    if (existingReconciliationError) throw existingReconciliationError;

    const reconciliationQuery = existingReconciliation
        ? supabaseAdmin
            .from("financial_reconciliations")
            .update(reconciliationPatch)
            .eq("id", existingReconciliation.id)
        : supabaseAdmin
            .from("financial_reconciliations")
            .insert(reconciliationPatch);

    const { error: reconciliationError } = await reconciliationQuery;
    if (reconciliationError) throw reconciliationError;

    return entry;
}

async function ensureFinancialEntryReversal(input: {
    originalEntry: any;
    payment: any;
    amountCents: number;
    paymentMethod: ManagerialPaymentMethod;
    movementId: string | null;
    now: string;
    reason: string;
    matchedBy: "automatic" | "manual";
    notes?: string | null;
}) {
    const amount = centsToReais(input.amountCents);
    if (!input.originalEntry?.id || amount <= 0) return null;

    const idempotencyKey = `neurofinance:reversal:${input.payment.id}:${input.reason}:${input.amountCents}`;

    const reversalPatch = {
        clinic_id: input.originalEntry.clinic_id || null,
        professional_id: input.originalEntry.professional_id,
        patient_id: input.originalEntry.patient_id || input.payment.patient_id || null,
        appointment_id: input.originalEntry.appointment_id || input.payment.appointment_id || null,
        type: "expense",
        title: input.reason === "chargeback"
            ? `Chargeback - ${input.originalEntry.title || input.payment.description || "Cobranca NeuroFinance"}`
            : `Estorno - ${input.originalEntry.title || input.payment.description || "Cobranca NeuroFinance"}`,
        description: input.reason === "chargeback"
            ? `Reversão por chargeback da cobrança ${input.payment.provider_payment_id || input.payment.id}`
            : `Reversão por estorno da cobrança ${input.payment.provider_payment_id || input.payment.id}`,
        amount,
        due_date: input.now.slice(0, 10),
        competence_date: input.now.slice(0, 10),
        paid_at: input.now,
        status: "paid",
        payment_method: input.paymentMethod,
        origin: "reversal",
        neurofinance_transaction_id: input.movementId,
        neurofinance_charge_id: input.payment.id,
        reversal_of_entry_id: input.originalEntry.id,
        reversal_reason: input.reason,
        idempotency_key: idempotencyKey,
        metadata: {
            source: "neurofinance_reversal_sync",
            provider: input.payment.provider || "asaas",
            provider_payment_id: input.payment.provider_payment_id || null,
            original_financial_entry_id: input.originalEntry.id,
            original_status: input.originalEntry.status || null,
        },
        updated_at: input.now,
    };

    const { data: existing, error: existingError } = await supabaseAdmin
        .from("financial_entries")
        .select("*")
        .eq("professional_id", input.originalEntry.professional_id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
    if (existingError) throw existingError;

    const query = existing
        ? supabaseAdmin
            .from("financial_entries")
            .update(reversalPatch)
            .eq("id", existing.id)
            .select()
            .single()
        : supabaseAdmin
            .from("financial_entries")
            .insert({
                ...reversalPatch,
                created_at: input.now,
            })
            .select()
            .single();

    const { data: reversalEntry, error } = await query;
    if (error) throw error;

    const reconciliationPatch = {
        clinic_id: reversalEntry.clinic_id || null,
        professional_id: reversalEntry.professional_id,
        financial_entry_id: reversalEntry.id,
        neurofinance_transaction_id: input.movementId,
        neurofinance_charge_id: input.payment.id,
        matched_by: input.matchedBy,
        matched_at: input.now,
        confidence_score: 1,
        idempotency_key: `reconciliation:${reversalEntry.id}:${input.payment.id}`,
        notes: input.notes || null,
        metadata: {
            provider: input.payment.provider || "asaas",
            provider_payment_id: input.payment.provider_payment_id || null,
            reversal_of_entry_id: input.originalEntry.id,
            reversal_reason: input.reason,
        },
    };

    const { data: existingReconciliation, error: existingReconciliationError } = await supabaseAdmin
        .from("financial_reconciliations")
        .select("id")
        .eq("financial_entry_id", reversalEntry.id)
        .eq("neurofinance_charge_id", input.payment.id)
        .maybeSingle();

    if (existingReconciliationError) throw existingReconciliationError;

    const reconciliationQuery = existingReconciliation
        ? supabaseAdmin
            .from("financial_reconciliations")
            .update(reconciliationPatch)
            .eq("id", existingReconciliation.id)
        : supabaseAdmin
            .from("financial_reconciliations")
            .insert(reconciliationPatch);

    const { error: reconciliationError } = await reconciliationQuery;
    if (reconciliationError) throw reconciliationError;

    return reversalEntry;
}
