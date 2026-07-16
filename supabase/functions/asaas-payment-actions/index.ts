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
import { toNeurofinanceOperationError } from "../_shared/neurofinance-operation-error.ts";

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

async function sha256(value: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validIdempotencyKey(value: unknown) {
    const key = String(value || "").trim();
    return key.length >= 16 && key.length <= 160 ? key : null;
}

async function claimPaymentDeletion(params: {
    userId: string;
    financialAccountId: string | null;
    paymentId: string;
    providerPaymentId: string;
    idempotencyKey: string;
}) {
    const operationType = "payment_delete";
    const fingerprint = await sha256(`${params.paymentId}:${params.providerPaymentId}`);
    const insert = await supabaseAdmin.from("neurofinance_baas_operations").insert({
        user_id: params.userId,
        financial_account_id: params.financialAccountId,
        provider: "asaas",
        operation_type: operationType,
        idempotency_key: params.idempotencyKey,
        request_fingerprint: fingerprint,
        status: "submitting",
        payload: { payment_id: params.paymentId },
        provider_response: {},
        updated_at: new Date().toISOString(),
    }).select("id,status,request_fingerprint,provider_response").single();

    if (!insert.error) return { operation: insert.data, created: true };
    if (String(insert.error.code || "") !== "23505") throw insert.error;

    const { data: existing, error } = await supabaseAdmin.from("neurofinance_baas_operations")
        .select("id,status,request_fingerprint,provider_response")
        .eq("user_id", params.userId)
        .eq("operation_type", operationType)
        .eq("idempotency_key", params.idempotencyKey)
        .maybeSingle();
    if (error) throw error;
    if (!existing) throw insert.error;
    if (existing.request_fingerprint !== fingerprint) return { conflict: true as const };
    return { operation: existing, created: false };
}

async function setDeletionOperation(id: string, status: string, providerResponse: unknown = {}) {
    const response = providerResponse && typeof providerResponse === "object" && !Array.isArray(providerResponse)
        ? providerResponse as Record<string, unknown>
        : {};
    const { error } = await supabaseAdmin.from("neurofinance_baas_operations").update({
        status,
        provider_operation_id: String(response.id || "") || null,
        provider_response: response,
        updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
}

function normalizePaymentStatus(providerStatus?: string) {
    const status = String(providerStatus || "PENDING").toUpperCase();
    if (status === "RECEIVED") return { status: "paid", normalized_status: "paid", funds_status: "available" };
    if (status === "CONFIRMED") return { status: "processing", normalized_status: "confirmed", funds_status: "confirmed" };
    if (status === "OVERDUE") return { status: "expired", normalized_status: "overdue", funds_status: "overdue" };
    if (status === "DELETED") return { status: "canceled", normalized_status: "deleted", funds_status: "canceled" };
    if (["CANCELLED", "CANCELED"].includes(status)) return { status: "canceled", normalized_status: "canceled", funds_status: "canceled" };
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
    const providerDeleted = String(providerPayment.status || "").toUpperCase() === "DELETED";
    const metadata = {
        ...(localPayment.metadata || {}),
        asaas_invoice_url: providerPayment.invoiceUrl || null,
        asaas_bank_slip_url: providerPayment.bankSlipUrl || null,
        asaas_transaction_receipt_url: providerPayment.transactionReceiptUrl || null,
        asaas_status: providerPayment.status || null,
        last_manual_sync_at: new Date().toISOString(),
        ...(providerDeleted
            ? { provider_deleted: true, provider_deleted_at: new Date().toISOString() }
            : {}),
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

function paymentActionResponse(payment: any) {
    return {
        id: payment.id,
        status: payment.status,
        normalizedStatus: payment.normalized_status,
        updatedAt: payment.updated_at,
    };
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
            return jsonResponse({ success: true, payment: paymentActionResponse(updated) });
        }

        if (action === "delete" || action === "cancel") {
            const status = String(localPayment.normalized_status || localPayment.status || "").toLowerCase();
            const idempotencyKey = validIdempotencyKey(body.idempotencyKey || body.idempotency_key);
            if (!idempotencyKey) {
                return errorResponse("Não foi possível identificar esta exclusão com segurança. Tente novamente.", 400, {
                    code: "IDEMPOTENCY_KEY_REQUIRED",
                });
            }
            if (!["pending", "overdue"].includes(status)) {
                if (["canceled", "cancelled", "deleted"].includes(status)) {
                    const fingerprint = await sha256(`${localPayment.id}:${localPayment.provider_payment_id}`);
                    const { data: completedReplay, error: replayError } = await supabaseAdmin
                        .from("neurofinance_baas_operations")
                        .select("id,request_fingerprint,status")
                        .eq("user_id", user.id)
                        .eq("operation_type", "payment_delete")
                        .eq("idempotency_key", idempotencyKey)
                        .maybeSingle();
                    if (replayError) throw replayError;
                    if (completedReplay?.status === "completed" && completedReplay.request_fingerprint === fingerprint) {
                        return jsonResponse({
                            success: true,
                            deleted: true,
                            replayed: true,
                            payment: paymentActionResponse(localPayment),
                        });
                    }
                }
                return errorResponse(
                    "Somente cobranças pendentes ou vencidas podem ser excluídas. Cobranças em processamento exigem revisão.",
                    409,
                    { code: "PAYMENT_NOT_DELETABLE" },
                );
            }

            const claim = await claimPaymentDeletion({
                userId: user.id,
                financialAccountId: localPayment.financial_account_id || financialAccount?.id || null,
                paymentId: localPayment.id,
                providerPaymentId: localPayment.provider_payment_id,
                idempotencyKey,
            });
            if (claim.conflict) {
                return errorResponse("Esta confirmação já foi usada em outra cobrança.", 409, {
                    code: "IDEMPOTENCY_KEY_REUSED",
                });
            }
            if (!claim.operation) throw new Error("PAYMENT_DELETE_CLAIM_FAILED");
            if (!claim.created && claim.operation.status === "submitting") {
                return errorResponse("A exclusão desta cobrança já está sendo processada.", 409, {
                    code: "OPERATION_IN_PROGRESS",
                });
            }

            let providerPayment = normalizeProviderPayment(claim.operation.provider_response);
            if (claim.operation.status !== "completed") {
                if (!claim.created) {
                    const { error } = await supabaseAdmin.from("neurofinance_baas_operations").update({
                        status: "submitting",
                        updated_at: new Date().toISOString(),
                    }).eq("id", claim.operation.id).in("status", ["failed", "submission_unknown"]);
                    if (error) throw error;
                }
                try {
                    providerPayment = normalizeProviderPayment(
                        await asaasRequest(`/payments/${encodeURIComponent(localPayment.provider_payment_id)}`, "DELETE", undefined, apiKey),
                    );
                    await setDeletionOperation(claim.operation.id, "completed", providerPayment);
                } catch (providerError) {
                    if (Number((providerError as { status?: unknown })?.status || 0) === 404) {
                        providerPayment = { id: localPayment.provider_payment_id, status: "DELETED" };
                        await setDeletionOperation(claim.operation.id, "completed", providerPayment);
                    } else {
                        const providerStatus = Number((providerError as { status?: unknown })?.status || 0);
                        await setDeletionOperation(
                            claim.operation.id,
                            !providerStatus || providerStatus >= 500 ? "submission_unknown" : "failed",
                        );
                        throw providerError;
                    }
                }
            }
            const updated = await updatePaymentFromProvider(localPayment, {
                ...providerPayment,
                status: providerPayment.status || "DELETED",
            });
            await syncFinancialEntryForPayment(updated, {
                matchedBy: "automatic",
                notes: "Exclusão da cobrança bancária solicitada pelo profissional",
            });
            return jsonResponse({ success: true, deleted: true, replayed: !claim.created, payment: paymentActionResponse(updated) });
        }

        return errorResponse("Esta ação ainda não está disponível para cobranças.", 400, { code: "UNSUPPORTED_PAYMENT_ACTION" });
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("asaas-payment-actions error:", error);
        const operationError = toNeurofinanceOperationError(
            error,
            "Não conseguimos atualizar esta cobrança agora. Tente novamente em instantes.",
        );
        return errorResponse(operationError.message, operationError.status, {
            code: operationError.code,
        });
    }
});
