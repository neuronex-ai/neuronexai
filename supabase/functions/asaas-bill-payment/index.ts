import {
    asaasRequest,
    corsHeaders,
    corsResponse,
    errorResponse,
    ensureAsaasOperationalWebhook,
    getAsaasBalance,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    recordBaasOperation,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    normalizeAsaasBillSimulation,
    validateNormalizedBillSimulation,
} from "../_shared/asaas-bill.ts";
import {
    dateInTimeZone,
    evaluateBillScheduling,
    normalizeBillPaymentStatus,
    type BillPaymentMode,
    validateBillPaymentDecision,
} from "../_shared/asaas-bill-scheduling.ts";
import { verifyFinancialPin } from "../_shared/financial-pin.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { toNeurofinanceOperationError } from "../_shared/neurofinance-operation-error.ts";

const CONSULTATION_TTL_MS = 10 * 60 * 1000;
const webhookCheckedAccounts = new Set<string>();

function cents(value: unknown) {
    return Math.round(Number(value || 0) * 100);
}

function digits(value: unknown) {
    return String(value || "").replace(/\D/g, "");
}

function billInput(body: Record<string, any>) {
    return {
        identificationField: digits(body.identificationField),
        barCode: digits(body.barCode || body.barcode),
    };
}

function providerReceiptUrl(payload: any) {
    return payload?.transactionReceiptUrl ||
        payload?.receiptUrl ||
        payload?.paymentReceiptUrl ||
        null;
}

function simulationPayload(record: any) {
    return record?.provider_payload?.consultation || record?.provider_payload || {};
}

function consultationPayload(record: any) {
    const simulation = normalizeAsaasBillSimulation(simulationPayload(record));
    const availableBalanceCents = record.available_balance_at_review == null
        ? null
        : Number(record.available_balance_at_review);
    const totalCents = Number(record.amount || 0) + Number(record.fee_amount || 0);
    const today = dateInTimeZone();
    const scheduling = evaluateBillScheduling({
        availableBalanceCents,
        totalCents,
        minimumScheduleDate: simulation.minimumScheduleDate,
        dueDate: record.due_date,
        today,
    });

    return {
        id: record.id,
        status: record.status,
        value: Number(record.amount || 0) / 100,
        fee: Number(record.fee_amount || 0) / 100,
        dueDate: record.due_date,
        scheduleDate: record.scheduled_date,
        beneficiaryName: record.beneficiary_name,
        beneficiaryDocument: record.beneficiary_document,
        bankCode: record.bank_code,
        bankName: record.bank_name,
        expiresAt: record.consultation_expires_at,
        minimumScheduleDate: simulation.minimumScheduleDate,
        availableBalance: availableBalanceCents == null ? null : availableBalanceCents / 100,
        requiredBalance: totalCents / 100,
        balanceShortfall: scheduling.balanceShortfallCents / 100,
        canPayNow: scheduling.canPayNow,
        canSchedule: scheduling.canSchedule,
        recommendedMode: scheduling.recommendedMode,
        defaultScheduleDate: scheduling.defaultScheduleDate,
        paymentMode: record.payment_mode,
    };
}

function billExecutionRecordPayload(record: any) {
    return {
        id: record.id,
        status: record.status,
        amount: Number(record.amount || 0),
        payment_mode: record.payment_mode,
        scheduled_date: record.scheduled_date,
        receipt_url: record.receipt_url,
    };
}

async function availableBalanceForReview(financialAccountId: string, apiKey: string) {
    try {
        const balance = await getAsaasBalance(apiKey);
        return {
            cents: Math.max(0, cents(balance.balance)),
            source: "asaas_live",
        };
    } catch (error) {
        console.warn("[asaas-bill-payment] Live balance unavailable, using snapshot:", error);
        const { data, error: snapshotError } = await supabaseAdmin
            .from("neurofinance_overview_snapshots")
            .select("available_balance")
            .eq("financial_account_id", financialAccountId)
            .maybeSingle();
        if (snapshotError) throw snapshotError;
        return {
            cents: data?.available_balance == null ? null : Number(data.available_balance),
            source: data?.available_balance == null ? "unavailable" : "snapshot",
        };
    }
}

async function ensureBillWebhook(financialAccountId: string, apiKey: string) {
    if (webhookCheckedAccounts.has(financialAccountId)) return;
    try {
        await ensureAsaasOperationalWebhook(apiKey);
        webhookCheckedAccounts.add(financialAccountId);
    } catch (error) {
        console.warn("[asaas-bill-payment] Could not reconcile operational webhook:", error);
    }
}

async function findConsultation(userId: string, consultationId: string) {
    const { data, error } = await supabaseAdmin
        .from("neurofinance_bill_payments")
        .select("*")
        .eq("id", consultationId)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

function isExpired(record: any) {
    return !record?.consultation_expires_at ||
        new Date(record.consultation_expires_at).getTime() <= Date.now();
}

function validateScheduleDate(value: unknown) {
    if (!value) return null;
    const scheduleDate = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
        throw Object.assign(new Error("Informe uma data de pagamento válida."), { status: 400 });
    }
    return scheduleDate;
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
            return errorResponse("Sua conta ainda não está pronta para pagar contas.", 403, { code: "ACCOUNT_NOT_READY" });
        }

        if (action === "receipt") {
            const consultationId = String(body.consultationId || "");
            const record = consultationId ? await findConsultation(user.id, consultationId) : null;
            if (!record?.receipt_url) {
                return errorResponse("O comprovante deste boleto ainda não está disponível.", 404, {
                    code: "BILL_RECEIPT_NOT_AVAILABLE",
                });
            }

            const receiptResponse = await fetch(record.receipt_url, { redirect: "follow" });
            if (!receiptResponse.ok) {
                return errorResponse("Não foi possível baixar o comprovante agora.", 502, {
                    code: "BILL_RECEIPT_DOWNLOAD_FAILED",
                });
            }
            const contentType = receiptResponse.headers.get("content-type") || "application/pdf";
            const extension = contentType.includes("pdf") ? "pdf" : "html";
            return new Response(await receiptResponse.arrayBuffer(), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    "Content-Type": contentType,
                    "Content-Disposition": `attachment; filename="comprovante-boleto-${record.id}.${extension}"`,
                    "Cache-Control": "private, no-store",
                },
            });
        }

        if (action === "consult" || action === "simulate") {
            await ensureBillWebhook(account.id, apiKey);
            const input = billInput(body);
            if (!input.identificationField && !input.barCode) {
                return errorResponse("Informe a linha digitável ou o código de barras do boleto.", 400, {
                    code: "BILL_INPUT_REQUIRED",
                });
            }

            const result = await asaasRequest(
                "/bill/simulate",
                "POST",
                input.identificationField
                    ? { identificationField: input.identificationField }
                    : { barCode: input.barCode },
                apiKey,
            );

            const normalizedBill = normalizeAsaasBillSimulation(
                (result || {}) as Record<string, unknown>,
            );
            const resolvedIdentificationField = normalizedBill.identificationField ||
                input.identificationField;
            if (!resolvedIdentificationField) {
                return errorResponse(
                    "O boleto foi localizado, mas a linha digitável não foi retornada. Digite a linha para continuar.",
                    400,
                    { code: "IDENTIFICATION_FIELD_REQUIRED" },
                );
            }

            normalizedBill.identificationField = resolvedIdentificationField;
            const missingFields = validateNormalizedBillSimulation(normalizedBill);
            if (missingFields.length > 0) {
                console.error("[asaas-bill-payment] Incomplete bill simulation:", {
                    missingFields,
                    providerKeys: Object.keys((result || {}) as Record<string, unknown>),
                });
                return errorResponse(
                    "A instituição não retornou todos os dados necessários para uma confirmação segura. Tente novamente mais tarde.",
                    422,
                    { code: "INCOMPLETE_BILL_DATA", missingFields },
                );
            }

            const today = dateInTimeZone();
            if (normalizedBill.dueDate && normalizedBill.dueDate < today) {
                return errorResponse(
                    "Este boleto está vencido e não pode ser agendado pelo NeuroFinance.",
                    422,
                    { code: "BILL_OVERDUE" },
                );
            }
            const balance = await availableBalanceForReview(account.id, apiKey);
            const expiresAt = new Date(Date.now() + CONSULTATION_TTL_MS).toISOString();
            const externalReference = `neurofinance:bill:${crypto.randomUUID()}`;

            const { data: record, error } = await supabaseAdmin
                .from("neurofinance_bill_payments")
                .insert({
                    user_id: user.id,
                    financial_account_id: account.id,
                    identification_field: resolvedIdentificationField,
                    barcode: input.barCode || null,
                    external_reference: externalReference,
                    status: "review_pending",
                    amount: cents(normalizedBill.value),
                    fee_amount: cents(normalizedBill.fee),
                    due_date: normalizedBill.dueDate,
                    scheduled_date: null,
                    payment_mode: null,
                    available_balance_at_review: balance.cents,
                    balance_source: balance.source,
                    beneficiary_name: normalizedBill.beneficiaryName,
                    beneficiary_document: normalizedBill.beneficiaryDocument,
                    bank_code: normalizedBill.bankCode,
                    bank_name: normalizedBill.bankName,
                    description: "Pagamento de boleto pelo NeuroFinance",
                    consultation_expires_at: expiresAt,
                    provider_payload: {
                        consultation: result || {},
                        review: {
                            availableBalance: balance.cents == null ? null : balance.cents / 100,
                            balanceSource: balance.source,
                            checkedAt: new Date().toISOString(),
                        },
                    },
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) throw error;

            return jsonResponse({
                success: true,
                consultation: consultationPayload(record),
                bill: normalizedBill,
            });
        }

        if (action === "authorize") {
            const consultationId = String(body.consultationId || "");
            const record = consultationId ? await findConsultation(user.id, consultationId) : null;
            if (!record) {
                return errorResponse("Esta consulta de boleto não foi encontrada.", 404, { code: "CONSULTATION_NOT_FOUND" });
            }
            if (isExpired(record)) {
                await supabaseAdmin
                    .from("neurofinance_bill_payments")
                    .update({ status: "expired", updated_at: new Date().toISOString() })
                    .eq("id", record.id)
                    .eq("user_id", user.id);
                return errorResponse("A consulta expirou. Consulte o boleto novamente.", 410, { code: "CONSULTATION_EXPIRED" });
            }
            if (!["review_pending", "authorized"].includes(record.status)) {
                return errorResponse("Este boleto não está disponível para autorização.", 409, {
                    code: "CONSULTATION_NOT_AUTHORIZABLE",
                });
            }

            const paymentMode = String(body.paymentMode || "") as BillPaymentMode;
            if (!["now", "scheduled"].includes(paymentMode)) {
                return errorResponse("Escolha pagar agora ou agendar o boleto.", 400, {
                    code: "PAYMENT_MODE_REQUIRED",
                });
            }

            const pinResult = await verifyFinancialPin(user.id, String(body.pin || ""));
            if (!pinResult.isValid) {
                return errorResponse(pinResult.message || "PIN incorreto.", 403, {
                    code: pinResult.code || "INVALID_PIN",
                });
            }

            const simulation = normalizeAsaasBillSimulation(simulationPayload(record));
            const balance = await availableBalanceForReview(account.id, apiKey);
            const totalCents = Number(record.amount || 0) + Number(record.fee_amount || 0);
            const today = dateInTimeZone();
            const scheduleDate = validateBillPaymentDecision(
                paymentMode,
                validateScheduleDate(body.scheduleDate),
                {
                    availableBalanceCents: balance.cents,
                    totalCents,
                    minimumScheduleDate: simulation.minimumScheduleDate,
                    dueDate: record.due_date,
                    today,
                },
            );
            const authorizedAt = new Date().toISOString();
            const { data: authorized, error } = await supabaseAdmin
                .from("neurofinance_bill_payments")
                .update({
                    status: "authorized",
                    payment_mode: paymentMode,
                    scheduled_date: scheduleDate,
                    available_balance_at_review: balance.cents,
                    balance_source: balance.source,
                    authorized_at: authorizedAt,
                    updated_at: authorizedAt,
                })
                .eq("id", record.id)
                .eq("user_id", user.id)
                .in("status", ["review_pending", "authorized"])
                .select()
                .single();

            if (error) throw error;
            return jsonResponse({ success: true, consultation: consultationPayload(authorized) });
        }

        if (action === "execute") {
            const consultationId = String(body.consultationId || "");
            const record = consultationId ? await findConsultation(user.id, consultationId) : null;
            if (!record) {
                return errorResponse("Esta consulta de boleto não foi encontrada.", 404, { code: "CONSULTATION_NOT_FOUND" });
            }

            if (["scheduled", "processing", "paid"].includes(record.status) && record.provider_bill_id) {
                return jsonResponse({
                    success: true,
                    record: billExecutionRecordPayload(record),
                    status: record.status,
                    receiptUrl: record.receipt_url,
                    idempotent: true,
                });
            }
            if (["failed", "cancelled", "refunded"].includes(record.status) && record.provider_bill_id) {
                return errorResponse(
                    "Este pagamento não pode ser reenviado. Faça uma nova consulta para tentar novamente.",
                    409,
                    { code: "BILL_NOT_RETRYABLE" },
                );
            }
            if (record.status === "submitting" || record.status === "submission_unknown") {
                return errorResponse(
                    "Este pagamento já foi enviado e aguarda confirmação bancária.",
                    409,
                    { code: "BILL_ALREADY_SUBMITTED" },
                );
            }
            if (record.status !== "authorized" || !record.authorized_at) {
                return errorResponse("Confirme este pagamento com seu PIN antes de continuar.", 403, {
                    code: "PIN_AUTH_REQUIRED",
                });
            }
            if (isExpired(record)) {
                return errorResponse("A autorização expirou. Consulte o boleto novamente.", 410, {
                    code: "CONSULTATION_EXPIRED",
                });
            }

            if (record.payment_mode === "now") {
                const balance = await availableBalanceForReview(account.id, apiKey);
                const totalCents = Number(record.amount || 0) + Number(record.fee_amount || 0);
                if (balance.cents == null || balance.cents < totalCents) {
                    const { error: reviewError } = await supabaseAdmin
                        .from("neurofinance_bill_payments")
                        .update({
                            status: "consulted",
                            payment_mode: null,
                            scheduled_date: null,
                            authorized_at: null,
                            available_balance_at_review: balance.cents,
                            balance_source: balance.source,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", record.id)
                        .eq("user_id", user.id)
                        .eq("status", "authorized")
                        .eq("authorized_at", record.authorized_at);
                    if (reviewError) throw reviewError;

                    return errorResponse(
                        "O saldo disponível mudou depois da confirmação. Revise novamente quando pagar e confirme com um novo PIN.",
                        409,
                        { code: "BILL_REVIEW_REQUIRED" },
                    );
                }
            }

            const submittedAt = new Date().toISOString();
            const { data: claimed, error: claimError } = await supabaseAdmin
                .from("neurofinance_bill_payments")
                .update({
                    status: "submitting",
                    submitted_at: submittedAt,
                    updated_at: submittedAt,
                })
                .eq("id", record.id)
                .eq("user_id", user.id)
                .eq("status", "authorized")
                .select()
                .maybeSingle();

            if (claimError) throw claimError;
            if (!claimed) {
                return errorResponse("Este pagamento já está sendo processado.", 409, {
                    code: "BILL_ALREADY_SUBMITTED",
                });
            }

            const payload: Record<string, unknown> = {
                identificationField: claimed.identification_field,
                description: claimed.description || "Pagamento de boleto pelo NeuroFinance",
                externalReference: claimed.external_reference,
            };
            if (claimed.scheduled_date) payload.scheduleDate = claimed.scheduled_date;
            if (Number(claimed.amount) > 0) payload.value = Number(claimed.amount) / 100;
            if (claimed.due_date) payload.dueDate = claimed.due_date;

            try {
                const result = await asaasRequest("/bill", "POST", payload, apiKey);
                const providerStatus = String((result as any)?.status || "PENDING").toUpperCase();
                const status = normalizeBillPaymentStatus(
                    providerStatus,
                    (result as any)?.scheduleDate || claimed.scheduled_date,
                );
                const receiptUrl = providerReceiptUrl(result);
                const providerPayload = {
                    consultation: simulationPayload(claimed),
                    review: claimed.provider_payload?.review || {},
                    execution: result || {},
                };

                await recordBaasOperation(user.id, account.id, "bill_payment", result as Record<string, unknown>, {
                    amount: Number(claimed.amount || 0) / 100,
                    description: String(payload.description),
                    payload,
                });

                const { data: updated, error } = await supabaseAdmin
                    .from("neurofinance_bill_payments")
                    .update({
                        provider_bill_id: (result as any)?.id || null,
                        provider_status: providerStatus,
                        status,
                        amount: cents((result as any)?.value || Number(claimed.amount) / 100),
                        fee_amount: cents((result as any)?.fee || Number(claimed.fee_amount) / 100),
                        due_date: (result as any)?.dueDate || claimed.due_date,
                        scheduled_date: (result as any)?.scheduleDate || claimed.scheduled_date,
                        payment_date: (result as any)?.paymentDate || null,
                        can_be_cancelled: Boolean((result as any)?.canBeCancelled),
                        receipt_url: receiptUrl,
                        paid_at: status === "paid" ? new Date().toISOString() : null,
                        provider_payload: providerPayload,
                        error_code: null,
                        error_message: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", claimed.id)
                    .eq("user_id", user.id)
                    .select()
                    .single();

                if (error) throw error;
                if (["failed", "cancelled", "refunded"].includes(status)) {
                    return errorResponse(
                        "A instituição bancária não confirmou o pagamento. Nenhum débito foi confirmado.",
                        422,
                        { code: "BILL_REJECTED" },
                    );
                }

                return jsonResponse({
                    success: true,
                    record: billExecutionRecordPayload(updated),
                    status,
                    receiptUrl,
            });
            } catch (error: any) {
                const statusCode = Number(error?.status || 500);
                const operationError = toNeurofinanceOperationError(
                    error,
                    "Não conseguimos processar este boleto.",
                );
                const failedStatus = statusCode >= 500 ? "submission_unknown" : "failed";
                await supabaseAdmin
                    .from("neurofinance_bill_payments")
                    .update({
                        status: failedStatus,
                        error_code: String(error?.code || "BILL_SUBMISSION_FAILED"),
                        error_message: String(error?.message || "Falha ao enviar pagamento."),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", claimed.id)
                    .eq("user_id", user.id);

                return errorResponse(
                    statusCode >= 500
                        ? "O pagamento foi enviado, mas ainda não recebemos a confirmação bancária. Não tente novamente agora."
                        : operationError.message,
                    operationError.status,
                    { code: statusCode >= 500 ? "BILL_SUBMISSION_UNKNOWN" : operationError.code },
                );
            }
        }

        if (action === "create") {
            return errorResponse("Consulte e autorize o boleto antes de efetuar o pagamento.", 400, {
                code: "CONSULTATION_REQUIRED",
            });
        }

        return errorResponse("Esta ação de pagamento não está disponível.", 400, { code: "UNSUPPORTED_ACTION" });
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("asaas-bill-payment error:", error);
        const operationError = toNeurofinanceOperationError(
            error,
            "Não conseguimos processar este boleto agora.",
        );
        return errorResponse(operationError.message, operationError.status, {
            code: operationError.code,
        });
    }
});
