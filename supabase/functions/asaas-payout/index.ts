import {
    asaasRequest,
    corsResponse,
    createAsaasTransfer,
    errorResponse,
    getAsaasBalance,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    normalizeAccountNumber,
    saveProviderPayout,
    sanitizeDigits,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    cents,
    detectPixKeyType,
    isExpired,
    normalizeExternalPixKeyLookup,
    normalizePixKeyForProvider,
    normalizeTransferStatus,
    outgoingResponse,
    OUTGOING_CONSULTATION_TTL_MS,
    providerReceiptUrl,
} from "../_shared/asaas-outgoing.ts";
import { verifyFinancialPin } from "../_shared/financial-pin.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { toNeurofinanceOperationError } from "../_shared/neurofinance-operation-error.ts";

type Destination = {
    type?: "saved_bank" | "saved_pix" | "pix_key";
    recipient_id?: string;
    pix_key?: string;
    pix_key_type?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
    bank_code?: string;
    bank_name?: string;
    agency?: string;
    account?: string;
    account_digit?: string;
    account_type?: "CONTA_CORRENTE" | "CONTA_POUPANCA";
    holder_name?: string;
    holder_document?: string;
    summary?: string;
    validation_source?: string;
    provider_lookup?: Record<string, unknown>;
};

async function pixKeyFingerprint(value: string) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value.trim().toLocaleLowerCase("pt-BR")),
    );
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function maskPixKey(value: unknown) {
    const key = String(value || "").trim();
    if (!key) return "";
    if (key.includes("@")) {
        const [name, domain] = key.split("@");
        return `${name.slice(0, 2)}***@${domain}`;
    }
    const digits = key.replace(/\D/g, "");
    if (digits.length >= 11) return `***${digits.slice(-4)}`;
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

async function findSavedPixRecipient(userId: string, recipientId: string, account: any) {
    if (recipientId === "legacy-pix") {
        const pix = account?.metadata?.destinations?.pix;
        if (!pix?.key) return null;
        return {
            id: recipientId,
            pix_key: pix.normalizedKey || pix.key,
            pix_key_type: pix.type || undefined,
            destination_summary: `Pix salvo · ${maskPixKey(pix.key)}`,
        };
    }

    const { data, error } = await supabaseAdmin
        .from("neurofinance_saved_pix_recipients")
        .select("*")
        .eq("id", recipientId)
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function listSavedDestinations(
    userId: string,
    account: any,
    purpose: "payout" | "transfer",
) {
    let savedRecipients: any[] = [];
    if (purpose === "transfer") {
        const { data, error } = await supabaseAdmin
            .from("neurofinance_saved_pix_recipients")
            .select("id,label,pix_key_type,destination_summary,holder_name,holder_document_masked,bank_name,updated_at")
            .eq("user_id", userId)
            .eq("active", true)
            .order("updated_at", { ascending: false })
            .limit(50);
        if (error) throw error;
        savedRecipients = data || [];
    }

    const bank = purpose === "payout" ? savedBankDestination(account) : null;
    const legacyPix = account?.metadata?.destinations?.pix;
    return {
        bank: bank
            ? {
                type: "saved_bank",
                label: "Conta bancária cadastrada",
                summary: bank.summary,
                holderName: bank.holder_name,
                bankName: bank.bank_name,
                agency: bank.agency,
                accountLast4: String(bank.account || "").replace(/\D/g, "").slice(-4),
            }
            : null,
        pix: [
            ...(purpose === "payout" && legacyPix?.key
                ? [{
                    id: "legacy-pix",
                    label: "Pix cadastrado para saque",
                    keyType: legacyPix.type || "Pix",
                    maskedKey: maskPixKey(legacyPix.key),
                    summary: `Pix cadastrado · ${maskPixKey(legacyPix.key)}`,
                    holderName: null,
                    bankName: null,
                }]
                : []),
            ...savedRecipients.map((item: any) => ({
                id: item.id,
                label: item.label,
                keyType: item.pix_key_type,
                maskedKey: item.destination_summary?.split(" · ").pop() || "Chave protegida",
                summary: item.destination_summary,
                holderName: item.holder_name,
                holderDocument: item.holder_document_masked,
                bankName: item.bank_name,
            })),
        ],
    };
}

async function saveRecipientFromRequest(userId: string, accountId: string, record: any) {
    if (record.kind !== "pix_transfer") return null;
    const destination = (record.destination_payload || {}) as Destination;
    if (!destination.pix_key || !destination.pix_key_type) return null;
    const fingerprint = await pixKeyFingerprint(destination.pix_key);
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
        .from("neurofinance_saved_pix_recipients")
        .upsert({
            user_id: userId,
            financial_account_id: accountId,
            label: destination.holder_name || "Destinatário Pix",
            pix_key: destination.pix_key,
            pix_key_type: destination.pix_key_type,
            key_fingerprint: fingerprint,
            destination_summary: `${destination.holder_name || "Destinatário"} · ${maskPixKey(destination.pix_key)}`,
            holder_name: destination.holder_name || null,
            holder_document_masked: destination.holder_document
                ? `***${sanitizeDigits(destination.holder_document).slice(-4)}`
                : null,
            bank_name: destination.bank_name || null,
            bank_code: destination.bank_code || null,
            active: true,
            last_used_at: now,
            updated_at: now,
        }, { onConflict: "user_id,key_fingerprint" })
        .select("id,label,destination_summary")
        .single();
    if (error) throw error;
    return data;
}

function savedBankDestination(account: any): Destination | null {
    if (!account?.bank_code || !account?.bank_agency || !account?.bank_account) return null;
    const holderName = account.bank_holder_name || account.holder_name || account.name || "Titular da conta";
    const holderDocument = account.bank_holder_cpf_cnpj || account.cpf_cnpj || account.document || "";
    return {
        type: "saved_bank",
        bank_code: account.bank_code,
        bank_name: account.bank_name || "Banco cadastrado",
        agency: account.bank_agency,
        account: account.bank_account,
        account_digit: account.bank_account_digit || "",
        account_type: String(account.bank_account_type || "").toUpperCase().includes("POUP")
            ? "CONTA_POUPANCA"
            : "CONTA_CORRENTE",
        holder_name: holderName,
        holder_document: holderDocument,
        summary: `${holderName} · Ag ${account.bank_agency} Conta ${account.bank_account}${account.bank_account_digit || ""}`,
        validation_source: "registered_bank_account",
    };
}

function payoutResponse(record: any) {
    return {
        ...outgoingResponse(record),
        destinationType: ["pix_transfer", "payout_pix"].includes(record.kind) ? "pix_key" : "saved_bank",
    };
}

function operationWords(record: any) {
    return record?.kind === "pix_transfer"
        ? {
            definite: "a transferência",
            demonstrative: "esta transferência",
            sent: "enviada",
            processing: "processada",
        }
        : {
            definite: "o saque",
            demonstrative: "este saque",
            sent: "enviado",
            processing: "processado",
        };
}

async function findRequest(userId: string, id: string) {
    const { data, error } = await supabaseAdmin
        .from("neurofinance_outgoing_requests")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .in("kind", ["pix_transfer", "payout_pix", "payout_bank"])
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function liveBalance(apiKey: string) {
    const balance = await getAsaasBalance(apiKey);
    return cents(balance.balance);
}

function transferParams(record: any) {
    const destination = (record.destination_payload || {}) as Destination;
    const params: any = {
        value: Number(record.amount) / 100,
        operationType: ["pix_transfer", "payout_pix"].includes(record.kind) ? "PIX" : "TED",
        description: record.kind === "pix_transfer"
            ? "Transferência via Pix"
            : record.kind === "payout_pix"
                ? "Saque por Pix"
                : "Saque para conta cadastrada",
        externalReference: record.external_reference,
    };

    if (["pix_transfer", "payout_pix"].includes(record.kind)) {
        params.pixAddressKey = destination.pix_key;
        params.pixAddressKeyType = destination.pix_key_type;
        return params;
    }

    const accountNumber = normalizeAccountNumber(destination.account, destination.account_digit);
    params.bankAccount = {
        bank: { code: sanitizeDigits(destination.bank_code) },
        accountName: destination.holder_name,
        ownerName: destination.holder_name,
        cpfCnpj: sanitizeDigits(destination.holder_document),
        agency: sanitizeDigits(destination.agency),
        account: accountNumber.account,
        accountDigit: accountNumber.accountDigit,
        bankAccountType: destination.account_type || "CONTA_CORRENTE",
    };
    return params;
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
            return errorResponse("Sua conta financeira ainda não está pronta para movimentações.", 403, { code: "ACCOUNT_NOT_READY" });
        }

        if (action === "list_destinations") {
            const purpose = String(body.purpose || "payout") === "transfer" ? "transfer" : "payout";
            return jsonResponse({
                success: true,
                destinations: await listSavedDestinations(user.id, account, purpose),
            });
        }

        if (action === "consult") {
            const amount = Math.round(Number(body.amount || 0));
            const purpose = String(body.purpose || "payout") === "transfer" ? "transfer" : "payout";
            if (!Number.isFinite(amount) || amount <= 0) {
                return errorResponse(
                    purpose === "transfer"
                        ? "Digite um valor válido para transferir."
                        : "Digite um valor válido para sacar.",
                    400,
                    { code: "INVALID_AMOUNT" },
                );
            }
            const balance = await liveBalance(apiKey);
            if (amount > balance) {
                return errorResponse(
                    purpose === "transfer"
                        ? "Saldo insuficiente para esta transferência."
                        : "Saldo insuficiente para este saque.",
                    422,
                    {
                    code: "INSUFFICIENT_BALANCE",
                    availableBalance: balance / 100,
                    },
                );
            }

            const requestedDestination = (body.destination || {}) as Destination;
            let destination: Destination | null = null;
            let kind: "pix_transfer" | "payout_pix" | "payout_bank";
            if (purpose === "payout" && requestedDestination.type === "pix_key") {
                return errorResponse(
                    "Para sua segurança, saques só podem usar a conta ou a chave Pix cadastrada no NeuroFinance.",
                    403,
                    { code: "PAYOUT_DESTINATION_NOT_REGISTERED" },
                );
            }

            if (["pix_key", "saved_pix"].includes(String(requestedDestination.type))) {
                if (
                    purpose === "transfer" &&
                    requestedDestination.type === "saved_pix" &&
                    requestedDestination.recipient_id === "legacy-pix"
                ) {
                    return errorResponse("Este destinatário não está salvo para transferências.", 404, {
                        code: "SAVED_RECIPIENT_NOT_FOUND",
                    });
                }
                if (
                    purpose === "payout" &&
                    !(requestedDestination.type === "saved_pix" && requestedDestination.recipient_id === "legacy-pix")
                ) {
                    return errorResponse(
                        "Este destino não está cadastrado para saques no NeuroFinance.",
                        403,
                        { code: "PAYOUT_DESTINATION_NOT_REGISTERED" },
                    );
                }
                const savedRecipient = requestedDestination.type === "saved_pix"
                    ? await findSavedPixRecipient(user.id, String(requestedDestination.recipient_id || ""), account)
                    : null;
                if (requestedDestination.type === "saved_pix" && !savedRecipient) {
                    return errorResponse("Este destinatário salvo não está mais disponível.", 404, {
                        code: "SAVED_RECIPIENT_NOT_FOUND",
                    });
                }
                const rawKey = savedRecipient?.pix_key || requestedDestination.pix_key;
                const keyType = detectPixKeyType(rawKey);
                const pixKey = normalizePixKeyForProvider(rawKey, keyType);
                if (!pixKey) return errorResponse("Informe a chave Pix de destino.", 400, { code: "PIX_KEY_REQUIRED" });
                const lookup = await asaasRequest<any>(
                    `/pix/addressKeys/external?type=${encodeURIComponent(keyType)}&key=${encodeURIComponent(pixKey)}`,
                    "GET",
                    undefined,
                    apiKey,
                );
                const normalizedLookup = normalizeExternalPixKeyLookup(lookup);
                if (!normalizedLookup.holderName || !normalizedLookup.holderDocument || !normalizedLookup.bankName) {
                    return errorResponse("A instituição não retornou dados suficientes para confirmar esta chave Pix.", 422, {
                        code: "INCOMPLETE_PIX_KEY_DATA",
                    });
                }
                destination = {
                    type: "pix_key",
                    pix_key: normalizedLookup.key || pixKey,
                    pix_key_type: normalizedLookup.type || keyType,
                    bank_code: normalizedLookup.bankCode,
                    bank_name: normalizedLookup.bankName,
                    holder_name: normalizedLookup.holderName,
                    holder_document: normalizedLookup.holderDocument,
                    summary: `${normalizedLookup.holderName} · ${normalizedLookup.bankName}`,
                    validation_source: "asaas_dict",
                    provider_lookup: lookup,
                };
                kind = purpose === "transfer" ? "pix_transfer" : "payout_pix";
            } else {
                if (purpose === "transfer") {
                    return errorResponse("Informe uma chave Pix para realizar a transferência.", 400, {
                        code: "PIX_KEY_REQUIRED",
                    });
                }
                destination = savedBankDestination(account);
                kind = "payout_bank";
                if (!destination || !sanitizeDigits(destination.holder_document)) {
                    return errorResponse("Os dados da conta bancária cadastrada estão incompletos.", 422, {
                        code: "BANK_DESTINATION_INCOMPLETE",
                    });
                }
            }

            const { data: record, error } = await supabaseAdmin.from("neurofinance_outgoing_requests").insert({
                user_id: user.id,
                financial_account_id: account.id,
                kind,
                status: "review_pending",
                external_reference: `neurofinance:${purpose}:${crypto.randomUUID()}`,
                amount,
                available_balance_at_review: balance,
                destination_summary: destination.summary,
                destination_payload: destination,
                provider_payload: {
                    consultation: destination.provider_lookup || {},
                    review: { balance, checkedAt: new Date().toISOString() },
                },
                consultation_expires_at: new Date(Date.now() + OUTGOING_CONSULTATION_TTL_MS).toISOString(),
                updated_at: new Date().toISOString(),
            }).select().single();
            if (error) throw error;
            return jsonResponse({ success: true, consultation: payoutResponse(record) });
        }

        if (action === "authorize") {
            const record = await findRequest(user.id, String(body.requestId || ""));
            if (!record) return errorResponse("Esta revisão de movimentação não foi encontrada.", 404, { code: "CONSULTATION_NOT_FOUND" });
            const words = operationWords(record);
            if (isExpired(record)) {
                await supabaseAdmin.from("neurofinance_outgoing_requests").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", record.id);
                return errorResponse(`A revisão expirou. Confira ${words.definite} novamente.`, 410, { code: "CONSULTATION_EXPIRED" });
            }
            if (!["review_pending", "authorized"].includes(record.status)) {
                return errorResponse(`${words.demonstrative[0].toUpperCase()}${words.demonstrative.slice(1)} não está disponível para autorização.`, 409, { code: "CONSULTATION_NOT_AUTHORIZABLE" });
            }
            const pinResult = await verifyFinancialPin(user.id, String(body.pin || ""));
            if (!pinResult.isValid) return errorResponse(pinResult.message || "PIN incorreto.", 403, { code: pinResult.code || "INVALID_PIN" });
            const balance = await liveBalance(apiKey);
            if (balance < Number(record.amount || 0)) {
                return errorResponse(`Seu saldo mudou e agora é insuficiente para ${words.demonstrative}.`, 422, { code: "INSUFFICIENT_BALANCE" });
            }
            const authorizedAt = new Date().toISOString();
            const shouldSaveRecipient = body.saveRecipient === true && record.kind === "pix_transfer";
            const { data: authorized, error } = await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                status: "authorized",
                available_balance_at_review: balance,
                authorized_at: authorizedAt,
                provider_payload: {
                    ...(record.provider_payload || {}),
                    review: {
                        ...(record.provider_payload?.review || {}),
                        saveRecipient: shouldSaveRecipient,
                    },
                },
                updated_at: authorizedAt,
            }).eq("id", record.id).eq("user_id", user.id).in("status", ["review_pending", "authorized"]).select().single();
            if (error) throw error;
            return jsonResponse({
                success: true,
                consultation: payoutResponse(authorized),
                recipientWillBeSaved: shouldSaveRecipient,
            });
        }

        if (action === "execute") {
            const record = await findRequest(user.id, String(body.requestId || ""));
            if (!record) return errorResponse("Esta revisão de movimentação não foi encontrada.", 404, { code: "CONSULTATION_NOT_FOUND" });
            const words = operationWords(record);
            if (record.provider_operation_id && ["pending", "in_transit", "paid"].includes(record.status)) {
                return jsonResponse({ success: true, request: payoutResponse(record), status: record.status, receiptUrl: record.receipt_url, idempotent: true });
            }
            if (["submitting", "submission_unknown"].includes(record.status)) {
                return errorResponse(`${words.demonstrative[0].toUpperCase()}${words.demonstrative.slice(1)} já foi ${words.sent} e aguarda confirmação bancária.`, 409, { code: "PAYOUT_ALREADY_SUBMITTED" });
            }
            if (record.status !== "authorized" || !record.authorized_at) {
                return errorResponse(`Confirme ${words.demonstrative} com seu PIN antes de continuar.`, 403, { code: "PIN_AUTH_REQUIRED" });
            }
            if (isExpired(record)) return errorResponse(`A autorização expirou. Confira ${words.definite} novamente.`, 410, { code: "CONSULTATION_EXPIRED" });
            if (await liveBalance(apiKey) < Number(record.amount || 0)) {
                return errorResponse(`Seu saldo mudou e agora é insuficiente para ${words.demonstrative}.`, 422, { code: "INSUFFICIENT_BALANCE" });
            }

            const submittedAt = new Date().toISOString();
            const { data: claimed, error: claimError } = await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                status: "submitting",
                submitted_at: submittedAt,
                updated_at: submittedAt,
            }).eq("id", record.id).eq("user_id", user.id).eq("status", "authorized").select().maybeSingle();
            if (claimError) throw claimError;
            if (!claimed) return errorResponse(`${words.demonstrative[0].toUpperCase()}${words.demonstrative.slice(1)} já está sendo ${words.processing}.`, 409, { code: "PAYOUT_ALREADY_SUBMITTED" });

            try {
                const transfer = await createAsaasTransfer(apiKey, transferParams(claimed));
                const status = normalizeTransferStatus(transfer.status);
                const receiptUrl = providerReceiptUrl(transfer);
                const transferFee = cents(transfer.transferFee);
                const payout = await saveProviderPayout({
                    user_id: user.id,
                    financial_account_id: account.id,
                    provider: "asaas",
                    provider_payout_id: transfer.id,
                    provider_status: String(transfer.status || "PENDING").toUpperCase(),
                    amount: Number(claimed.amount),
                    fee_amount: transferFee,
                    operation_type: claimed.kind === "pix_transfer" ? "pix_transfer" : claimed.kind === "payout_pix" ? "pix" : "ted",
                    currency: "brl",
                    status,
                    destination_type: ["pix_transfer", "payout_pix"].includes(claimed.kind) ? "pix_key" : "saved_bank",
                    destination_summary: claimed.destination_summary,
                    destination_payload: claimed.destination_payload || {},
                    pix_key: ["pix_transfer", "payout_pix"].includes(claimed.kind) ? claimed.destination_payload?.pix_key : null,
                    receipt_url: receiptUrl,
                    requested_at: new Date().toISOString(),
                    processed_at: status === "paid" ? new Date().toISOString() : null,
                    completed_at: status === "paid" ? new Date().toISOString() : null,
                    reconciliation_status: status === "paid" ? "reconciled" : "estimated",
                    provider_payload: transfer,
                    metadata: {
                        asaas_transfer_id: transfer.id,
                        transaction_receipt_url: receiptUrl,
                        external_reference: claimed.external_reference,
                        source: claimed.kind === "pix_transfer" ? "neurofinance_secure_pix_transfer" : "neurofinance_secure_payout",
                    },
                });

                const { data: updated, error } = await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                    payout_id: payout.id,
                    status,
                    fee_amount: transferFee,
                    provider_operation_id: transfer.id,
                    provider_status: String(transfer.status || "PENDING").toUpperCase(),
                    receipt_url: receiptUrl,
                    completed_at: status === "paid" ? new Date().toISOString() : null,
                    provider_payload: {
                        consultation: claimed.provider_payload?.consultation || {},
                        review: claimed.provider_payload?.review || {},
                        execution: transfer,
                    },
                    updated_at: new Date().toISOString(),
                }).eq("id", claimed.id).select().single();
                if (error) throw error;
                if (claimed.kind === "pix_transfer" && claimed.provider_payload?.review?.saveRecipient === true) {
                    try {
                        await saveRecipientFromRequest(user.id, account.id, claimed);
                    } catch (saveError) {
                        console.error("asaas-payout recipient save error:", saveError);
                    }
                }
                return jsonResponse({ success: true, request: payoutResponse(updated), status, receiptUrl });
            } catch (error: any) {
                const statusCode = Number(error?.status || 500);
                const operationError = toNeurofinanceOperationError(
                    error,
                    "Não foi possível concluir esta movimentação.",
                );
                await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                    status: statusCode >= 500 ? "submission_unknown" : "failed",
                    error_code: String(error?.code || "PAYOUT_SUBMISSION_FAILED"),
                    error_message: String(error?.message || "Falha ao enviar movimentação."),
                    updated_at: new Date().toISOString(),
                }).eq("id", claimed.id);
                return errorResponse(
                    statusCode >= 500
                        ? "A movimentação foi enviada, mas ainda não recebemos a confirmação bancária. Não tente novamente agora."
                        : operationError.message,
                    operationError.status,
                    { code: statusCode >= 500 ? "PAYOUT_SUBMISSION_UNKNOWN" : operationError.code },
                );
            }
        }

        if (action === "receipt") {
            const record = await findRequest(user.id, String(body.requestId || ""));
            if (!record?.provider_operation_id) return errorResponse("O comprovante desta movimentação ainda não está disponível.", 404, { code: "PAYOUT_RECEIPT_NOT_AVAILABLE" });
            const transfer = await asaasRequest<any>(`/transfers/${encodeURIComponent(record.provider_operation_id)}`, "GET", undefined, apiKey);
            const receiptUrl = providerReceiptUrl(transfer) || record.receipt_url;
            const status = normalizeTransferStatus(transfer?.status);
            const completedAt = status === "paid"
                ? transfer?.effectiveDate || transfer?.confirmedDate || record.completed_at || new Date().toISOString()
                : record.completed_at;
            await supabaseAdmin.from("neurofinance_outgoing_requests").update({
                status,
                provider_status: String(transfer?.status || record.provider_status || "").toUpperCase(),
                receipt_url: receiptUrl,
                completed_at: completedAt,
                provider_payload: {
                    consultation: record.provider_payload?.consultation || {},
                    review: record.provider_payload?.review || {},
                    execution: transfer,
                },
                updated_at: new Date().toISOString(),
            }).eq("id", record.id);
            if (record.payout_id) {
                await supabaseAdmin.from("nb_payouts").update({
                    status,
                    provider_status: String(transfer?.status || record.provider_status || "").toUpperCase(),
                    receipt_url: receiptUrl,
                    processed_at: status === "paid" ? new Date().toISOString() : null,
                    completed_at: completedAt,
                    reconciliation_status: status === "paid" ? "reconciled" : "estimated",
                    reconciled_at: status === "paid" ? new Date().toISOString() : null,
                    provider_payload: transfer,
                    updated_at: new Date().toISOString(),
                }).eq("id", record.payout_id);
            }
            if (!receiptUrl) return errorResponse("A confirmação bancária ainda não liberou o comprovante.", 404, { code: "PAYOUT_RECEIPT_NOT_AVAILABLE" });
            return jsonResponse({ success: true, receiptUrl, status });
        }

        return errorResponse("Consulte e confirme os dados da movimentação com seu PIN antes de enviar.", 400, {
            code: "PAYOUT_CONSULTATION_REQUIRED",
        });
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("asaas-payout error:", error);
        const operationError = toNeurofinanceOperationError(
            error,
            "Não foi possível processar esta movimentação agora.",
        );
        return errorResponse(operationError.message, operationError.status, {
            code: operationError.code,
        });
    }
});
