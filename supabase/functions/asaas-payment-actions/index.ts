import {
    asaasRequest,
    corsResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { syncFinancialEntryForPayment } from "../_shared/financial-management.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

type AsaasPaymentResponse = Record<string, unknown> & {
    status?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    transactionReceiptUrl?: string;
    value?: number | string;
    netValue?: number | string;
    billingType?: string;
    paymentDate?: string;
    confirmedDate?: string;
    dueDate?: string;
};

function normalizeProviderPayment(value: unknown): AsaasPaymentResponse {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return value as AsaasPaymentResponse;
}

function cents(value: unknown) {
    return Math.round(Number(value || 0) * 100);
}

function normalizePaymentStatus(providerStatus?: string) {
    const status = String(providerStatus || "PENDING").toUpperCase();
    if (status === "RECEIVED") return { status: "paid", normalized_status: "paid", funds_status: "available" };
    if (status === "CONFIRMED") return { status: "processing", normalized_status: "confirmed", funds_status: "confirmed" };
    if (status === "OVERDUE") return { status: "expired", normalized_status: "overdue", funds_status: "overdue" };
    if (["DELETED", "CANCELLED", "CANCELED"].includes(status)) return { status: "canceled", normalized_status: "canceled", funds_status: "canceled" };
    if (status.includes("REFUND")) return { status: "refunded", normalized_status: "refunded", funds_status: "refunded" };
    if (status.includes("CHARGEBACK")) return { status: "failed", normalized_status: "chargeback", funds_status: "chargeback" };
    return { status: "pending", normalized_status: "pending", funds_status: "pending" };
}

async function findPayment(userId: string, id: string) {
    const { data, error } = await supabaseAdmin
        .from("nb_payments")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function updatePaymentFromProvider(localPayment: any, providerPayment: AsaasPaymentResponse) {
    const normalized = normalizePaymentStatus(providerPayment.status);
    const metadata = {
        ...(localPayment.metadata || {}),
        asaas_invoice_url: providerPayment.invoiceUrl || null,
        asaas_bank_slip_url: providerPayment.bankSlipUrl || null,
        asaas_transaction_receipt_url: providerPayment.transactionReceiptUrl || null,
        asaas_status: providerPayment.status || null,
        last_manual_sync_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
        .from("nb_payments")
        .update({
            provider_status: providerPayment.status || localPayment.provider_status,
            ...normalized,
            gross_amount: cents(providerPayment.value) || localPayment.gross_amount,
            net_amount: cents(providerPayment.netValue) || localPayment.net_amount,
            payment_method_type: String(providerPayment.billingType || localPayment.payment_method_type || "").toLowerCase().replace("credit_card", "card"),
            checkout_url: providerPayment.invoiceUrl || localPayment.checkout_url,
            invoice_url: providerPayment.invoiceUrl || localPayment.invoice_url,
            bank_slip_url: providerPayment.bankSlipUrl || localPayment.bank_slip_url,
            receipt_url: providerPayment.transactionReceiptUrl || localPayment.receipt_url,
            paid_at: providerPayment.paymentDate ? new Date(providerPayment.paymentDate).toISOString() : localPayment.paid_at,
            confirmed_at: providerPayment.confirmedDate ? new Date(providerPayment.confirmedDate).toISOString() : localPayment.confirmed_at,
            expires_at: providerPayment.dueDate ? new Date(`${providerPayment.dueDate}T23:59:59`).toISOString() : localPayment.expires_at,
            metadata,
            updated_at: new Date().toISOString(),
        })
        .eq("id", localPayment.id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            "neurofinance",
        );
        const body = await req.json().catch(() => ({}));
        const action = String(body.action || "sync");
        const paymentId = String(body.payment_id || body.id || "");

        if (!paymentId) return errorResponse("Não encontramos a cobrança para atualizar.", 400, { code: "PAYMENT_REQUIRED" });

        const localPayment = await findPayment(user.id, paymentId);
        if (!localPayment?.provider_payment_id) {
            return errorResponse("Esta cobrança não possui vínculo operacional para esta ação.", 404, { code: "PAYMENT_NOT_LINKED" });
        }

        const financialAccount = localPayment.financial_account_id
            ? await supabaseAdmin.from("financial_accounts").select("*").eq("id", localPayment.financial_account_id).eq("user_id", user.id).maybeSingle().then((r) => {
                if (r.error) throw r.error;
                return r.data;
            })
            : await getFinancialAccount(user.id);

        const apiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!apiKey) return errorResponse("Sua conta financeira ainda não está pronta para esta ação.", 403, { code: "ACCOUNT_NOT_READY" });

        if (action === "sync") {
            const providerPayment = normalizeProviderPayment(
                await asaasRequest(`/payments/${encodeURIComponent(localPayment.provider_payment_id)}`, "GET", undefined, apiKey),
            );
            const updated = await updatePaymentFromProvider(localPayment, providerPayment);
            await syncFinancialEntryForPayment(updated, {
                matchedBy: "automatic",
                notes: "Sincronizacao manual da cobranca",
            });
            return jsonResponse({ success: true, payment: updated });
        }

        if (action === "cancel") {
            const status = String(localPayment.normalized_status || localPayment.status || "").toLowerCase();
            if (!["pending", "processing", "overdue"].includes(status)) {
                return errorResponse("Só cobranças pendentes podem ser canceladas por aqui.", 400, { code: "PAYMENT_NOT_CANCELABLE" });
            }

            const providerPayment = normalizeProviderPayment(
                await asaasRequest(`/payments/${encodeURIComponent(localPayment.provider_payment_id)}`, "DELETE", undefined, apiKey),
            );
            const updated = await updatePaymentFromProvider(localPayment, {
                ...providerPayment,
                status: providerPayment?.status || "DELETED",
            });
            await syncFinancialEntryForPayment(updated, {
                matchedBy: "automatic",
                notes: "Cancelamento manual da cobranca",
            });
            return jsonResponse({ success: true, payment: updated });
        }

        return errorResponse("Esta ação ainda não está disponível para cobranças.", 400, { code: "UNSUPPORTED_PAYMENT_ACTION" });
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("asaas-payment-actions error:", error);
        return errorResponse(
            "Não conseguimos atualizar esta cobrança agora. Tente novamente em instantes.",
            error?.status || 500,
            { code: "PAYMENT_ACTION_FAILED" }
        );
    }
});
