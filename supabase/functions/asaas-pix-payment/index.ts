import {
    asaasRequest,
    corsResponse,
    errorResponse,
    getAsaasBalance,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    recordBaasOperation,
    saveProviderPayout,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    cents,
    isExpired,
    normalizePixQrConsultation,
    normalizePixTransactionStatus,
    outgoingResponse,
    OUTGOING_CONSULTATION_TTL_MS,
    providerReceiptUrl,
    validatePixQrConsultation,
} from "../_shared/asaas-outgoing.ts";
import { verifyFinancialPin } from "../_shared/financial-pin.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { toNeurofinanceOperationError } from "../_shared/neurofinance-operation-error.ts";

function consultationResponse(record: any) {
    const decoded = normalizePixQrConsultation(record?.provider_payload?.consultation || {});
    const balance = record.available_balance_at_review == null ? null : Number(record.available_balance_at_review);
    return {
        ...outgoingResponse(record),
        receiverName: decoded.receiver.name,
        receiverDocument: decoded.receiver.cpfCnpj,
        institutionName: decoded.receiver.ispbName,
        description: decoded.description,
        qrType: decoded.type,
        dueDate: decoded.dueDate,
        expirationDate: decoded.expirationDate,
        canChangeValue: decoded.canBePaidWithDifferentValue,
        canPayNow: balance != null && Number(record.amount || 0) > 0 && balance >= Number(record.amount || 0),
    };
}

async function findRequest(userId: string, id: string) {
    const { data, error } = await supabaseAdmin
        .from("neurofinance_outgoing_requests")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .eq("kind", "pix_qr_payment")
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function liveBalance(apiKey: string) {
    const balance = await getAsaasBalance(apiKey);
    return cents(balance.balance);
}

function providerExpirationExpired(value: unknown) {
    if (!value) return false;
    const timestamp = new Date(String(value)).getTime();
    return Number.isFinite(timestamp) && timestamp <= Date.now();
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
        const action = String(body.action || "");
        const account = await getFinancialAccount(user.id);
        const apiKey = await getFinancialAccountAsaasApiKey(account);

        if (!account || !apiKey) {
            return errorResponse("Sua conta financeira ainda não está pronta para pagar via Pix.", 403, {
                code: "ACCOUNT_NOT_READY",
            });
        }

        if (action === "consult") {
            const payload = String(body.payload || "").trim();
            if (!payload) return errorResponse("Cole o código Pix Copia e Cola para continuar.", 400, { code: "PIX_PAYLOAD_REQUIRED" });

            const result = await asaasRequest<any>("/pix/qrCodes/decode", "POST", { payload }, apiKey);
            const decoded = normalizePixQrConsultation(result);
            if (!decoded.canBePaid) {
                return errorResponse(decoded.cannotBePaidReason || "Este Pix não está disponível para pagamento.", 422, { code: "PIX_NOT_PAYABLE" });
            }
            if (providerExpirationExpired(decoded.expirationDate)) {
                return errorResponse("Este código Pix expirou. Solicite um novo código ao recebedor.", 422, { code: "PIX_EXPIRED" });
            }
            const missingFields = validatePixQrConsultation(decoded);
            if (missingFields.length > 0) {
                return errorResponse("A instituição não retornou todos os dados necessários para uma confirmação segura.", 422, {
                    code: "INCOMPLETE_PIX_DATA",
                    missingFields,
                });
            }

            const balance = await liveBalance(apiKey);
            const amount = decoded.canBePaidWithDifferentValue && decoded.value <= 0 ? 0 : cents(decoded.value);
            const destinationSummary = `${decoded.receiver.name} · ${decoded.receiver.ispbName || decoded.receiver.ispb}`;
            const { data: record, error } = await supabaseAdmin
                .from("neurofinance_outgoing_requests")
                .insert({
                    user_id: user.id,
                    financial_account_id: account.id,
                    kind: "pix_qr_payment",
                    status: "review_pending",
                    external_reference: `neurofinance:pix-qr:${crypto.randomUUID()}`,
                    amount,
                    available_balance_at_review: balance,
                    destination_summary: destinationSummary,
                    destination_payload: {
                        receiver: decoded.receiver,
                        pixKey: decoded.pixKey,
                        qrType: decoded.type,
                        description: decoded.description,
                        canChangeValue: decoded.canBePaidWithDifferentValue,
                    },
                    provider_payload: { consultation: result },
                    consultation_expires_at: new Date(Date.now() + OUTGOING_CONSULTATION_TTL_MS).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();
            if (error) throw error;
            return jsonResponse({ success: true, consultation: consultationResponse(record) });
        }

        if (action === "authorize") {
            const record = await findRequest(user.id, String(body.requestId || ""));
            if (!record) return errorResponse("Esta consulta Pix não foi encontrada.", 404, { code: "CONSULTATION_NOT_FOUND" });
            if (isExpired(record)) {
                await supabaseAdmin.from("neurofinance_outgoing_requests").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", record.id);
                return errorResponse("A consulta expirou. Consulte o Pix novamente.", 410, { code: "CONSULTATION_EXPIRED" });
            }
            if (!["review_pending", "authorized"].includes(record.status)) {
                return errorResponse("Este Pix não está disponível para autorização.", 409, { code: "CONSULTATION_NOT_AUTHORIZABLE" });
            }

            const pinResult = await verifyFinancialPin(user.id, String(body.pin || ""));
            if (!pinResult.isValid) {
                return errorResponse(pinResult.message || "PIN incorreto.", 403, { code: pinResult.code || "INVALID_PIN" });
            }

            const decoded = normalizePixQrConsultation(record.provider_payload?.consultation || {});
            const requestedAmount = cents(body.value);
            const amount = decoded.canBePaidWithDifferentValue ? requestedAmount || Number(record.amount || 0) : Number(record.amount || 0);
            if (amount <= 0) return errorResponse("Informe um valor válido para este Pix.", 400, { code: "PIX_VALUE_REQUIRED" });
            if (!decoded.canBePaidWithDifferentValue && requestedAmount > 0 && requestedAmount !== amount) {
                return errorResponse("O recebedor não permite alterar o valor deste Pix.", 422, { code: "PIX_VALUE_LOCKED" });
            }

            const balance = await liveBalance(apiKey);
            if (balance < amount) return errorResponse("Saldo insuficiente para concluir este pagamento Pix.", 422, { code: "INSUFFICIENT_BALANCE" });

            const authorizedAt = new Date().toISOString();
            const { data: authorized, error } = await supabaseAdmin
                .from("neurofinance_outgoing_requests")
                .update({ status: "authorized", amount, available_balance_at_review: balance, authorized_at: authorizedAt, updated_at: authorizedAt })
                .eq("id", record.id)
                .eq("user_id", user.id)
                .in("status", ["review_pending", "authorized"])
                .select()
                .single();
            if (error) throw error;
            return jsonResponse({ success: true, consultation: consultationResponse(authorized) });
        }

        if (action === "execute") {
            const record = await findRequest(user.id, String(body.requestId || ""));
            if (!record) return errorResponse("Esta consulta Pix não foi encontrada.", 404, { code: "CONSULTATION_NOT_FOUND" });
            if (record.provider_operation_id && ["pending", "in_transit", "paid"].includes(record.status)) {
                return jsonResponse({ success: true, request: consultationResponse(record), status: record.status, receiptUrl: record.receipt_url, idempotent: true });
            }
            if (["submitting", "submission_unknown"].includes(record.status)) {
                return errorResponse("Este Pix já foi enviado e aguarda confirmação bancária.", 409, { code: "PIX_ALREADY_SUBMITTED" });
            }
            if (record.status !== "authorized" || !record.authorized_at) {
                return errorResponse("Confirme este Pix com seu PIN antes de continuar.", 403, { code: "PIN_AUTH_REQUIRED" });
            }
            if (isExpired(record)) return errorResponse("A autorização expirou. Consulte o Pix novamente.", 410, { code: "CONSULTATION_EXPIRED" });
            if (await liveBalance(apiKey) < Number(record.amount || 0)) {
                return errorResponse("Seu saldo mudou e agora é insuficiente para este Pix.", 422, { code: "INSUFFICIENT_BALANCE" });
            }

            const submittedAt = new Date().toISOString();
            const { data: claimed, error: claimError } = await supabaseAdmin
                .from("neurofinance_outgoing_requests")
                .update({ status: "submitting", submitted_at: submittedAt, updated_at: submittedAt })
                .eq("id", record.id)
                .eq("user_id", user.id)
                .eq("status", "authorized")
                .select()
                .maybeSingle();
            if (claimError) throw claimError;
            if (!claimed) return errorResponse("Este Pix já está sendo processado.", 409, { code: "PIX_ALREADY_SUBMITTED" });

            try {
                const decoded = normalizePixQrConsultation(claimed.provider_payload?.consultation || {});
                const result = await asaasRequest<any>("/pix/qrCodes/pay", "POST", {
                    qrCode: { payload: decoded.payload },
                    value: Number(claimed.amount) / 100,
                    description: decoded.description || "Pagamento Pix pelo NeuroFinance",
                }, apiKey);
                const status = normalizePixTransactionStatus(result?.status);
                const receiptUrl = providerReceiptUrl(result);
                const payout = await saveProviderPayout({
                    user_id: user.id,
                    financial_account_id: account.id,
                    provider: "asaas",
                    provider_payout_id: result.id,
                    provider_status: String(result.status || "REQUESTED").toUpperCase(),
                    operation_type: "pix_qr_payment",
                    amount: Number(claimed.amount),
                    currency: "brl",
                    status,
                    destination_type: "pix_qr",
                    destination_summary: claimed.destination_summary,
                    destination_payload: claimed.destination_payload || {},
                    pix_key: claimed.destination_payload?.pixKey || null,
                    receipt_url: receiptUrl,
                    requested_at: new Date().toISOString(),
                    processed_at: status === "paid" ? new Date().toISOString() : null,
                    completed_at: status === "paid" ? result.effectiveDate || new Date().toISOString() : null,
                    reconciliation_status: status === "paid" ? "reconciled" : "estimated",
                    provider_payload: result,
                    metadata: {
                        asaas_pix_transaction_id: result.id,
                        end_to_end_identifier: result.endToEndIdentifier || null,
                        transaction_receipt_url: receiptUrl,
                        source: "neurofinance_pix_qr",
                    },
                });

                await recordBaasOperation(user.id, account.id, "pix_qr_payment", result, {
                    amount: Number(claimed.amount) / 100,
                    description: decoded.description || "Pagamento Pix pelo NeuroFinance",
                });
                const { data: updated, error } = await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                    payout_id: payout.id,
                    status,
                    provider_operation_id: result.id,
                    provider_status: String(result.status || "REQUESTED").toUpperCase(),
                    receipt_url: receiptUrl,
                    completed_at: status === "paid" ? result.effectiveDate || new Date().toISOString() : null,
                    provider_payload: { consultation: claimed.provider_payload?.consultation || {}, execution: result },
                    updated_at: new Date().toISOString(),
                }).eq("id", claimed.id).select().single();
                if (error) throw error;
                return jsonResponse({ success: true, request: consultationResponse(updated), status, receiptUrl });
            } catch (error: any) {
                const statusCode = Number(error?.status || 500);
                const operationError = toNeurofinanceOperationError(
                    error,
                    "Não foi possível concluir este Pix.",
                );
                await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                    status: statusCode >= 500 ? "submission_unknown" : "failed",
                    error_code: String(error?.code || "PIX_SUBMISSION_FAILED"),
                    error_message: String(error?.message || "Falha ao enviar Pix."),
                    updated_at: new Date().toISOString(),
                }).eq("id", claimed.id);
                return errorResponse(
                    statusCode >= 500
                        ? "O Pix foi enviado, mas ainda não recebemos a confirmação bancária. Não tente novamente agora."
                        : operationError.message,
                    operationError.status,
                    { code: statusCode >= 500 ? "PIX_SUBMISSION_UNKNOWN" : operationError.code },
                );
            }
        }

        if (action === "receipt") {
            const record = await findRequest(user.id, String(body.requestId || ""));
            if (!record?.provider_operation_id) return errorResponse("O comprovante deste Pix ainda não está disponível.", 404, { code: "PIX_RECEIPT_NOT_AVAILABLE" });
            const result = await asaasRequest<any>(`/pix/transactions/${encodeURIComponent(record.provider_operation_id)}`, "GET", undefined, apiKey);
            const receiptUrl = providerReceiptUrl(result) || record.receipt_url;
            const status = normalizePixTransactionStatus(result?.status);
            const completedAt = status === "paid"
                ? result?.effectiveDate || result?.confirmedDate || record.completed_at || new Date().toISOString()
                : record.completed_at;
            await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                status,
                provider_status: String(result?.status || record.provider_status || "").toUpperCase(),
                receipt_url: receiptUrl,
                completed_at: completedAt,
                provider_payload: { consultation: record.provider_payload?.consultation || {}, execution: result },
                updated_at: new Date().toISOString(),
            }).eq("id", record.id);
            if (record.payout_id) {
                await supabaseAdmin.from("nb_payouts").update({
                    status,
                    provider_status: String(result?.status || record.provider_status || "").toUpperCase(),
                    receipt_url: receiptUrl,
                    processed_at: status === "paid" ? new Date().toISOString() : null,
                    completed_at: completedAt,
                    reconciliation_status: status === "paid" ? "reconciled" : "estimated",
                    reconciled_at: status === "paid" ? new Date().toISOString() : null,
                    provider_payload: result,
                    updated_at: new Date().toISOString(),
                }).eq("id", record.payout_id);
            }
            if (!receiptUrl) return errorResponse("A confirmação bancária ainda não liberou o comprovante.", 404, { code: "PIX_RECEIPT_NOT_AVAILABLE" });
            return jsonResponse({ success: true, receiptUrl, status });
        }

        return errorResponse("Esta ação de pagamento Pix não está disponível.", 400, { code: "UNSUPPORTED_PIX_PAYMENT_ACTION" });
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("asaas-pix-payment error:", error);
        const operationError = toNeurofinanceOperationError(
            error,
            "Não foi possível processar este Pix agora.",
        );
        return errorResponse(operationError.message, operationError.status, {
            code: operationError.code,
        });
    }
});
