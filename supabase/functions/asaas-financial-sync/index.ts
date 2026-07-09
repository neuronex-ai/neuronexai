import {
    corsResponse,
    errorResponse,
    getAsaasBalance,
    getAsaasFinancialTransactions,
    getAsaasPayments,
    getAsaasTransfers,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    refreshOverviewSnapshot,
    upsertAccountMovement,
    upsertPaymentFromProvider,
} from "../_shared/neurofinance-financial.ts";
import { syncFinancialEntryForPayment } from "../_shared/financial-management.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

const PAGE_SIZE = 100;
const MAX_INCREMENTAL_PAGES = 20;
const MAX_FULL_PAGES = 100;

function dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return dateOnly(date);
}

async function collectPages(
    fetchPage: (offset: number, limit: number) => Promise<any>,
    maxPages: number
) {
    const rows: any[] = [];
    for (let page = 0; page < maxPages; page += 1) {
        const result = await fetchPage(page * PAGE_SIZE, PAGE_SIZE);
        const batch = Array.isArray(result?.data) ? result.data : [];
        rows.push(...batch);
        if (!result?.hasMore || batch.length < PAGE_SIZE) break;
    }
    return rows;
}

function movementType(providerType?: string, direction?: "credit" | "debit") {
    const type = String(providerType || "ADJUSTMENT").toUpperCase();
    if (type === "TRANSFER_FEE") return "transfer_fee";
    if (type.includes("FEE")) return type.includes("PAYMENT") ? "payment_fee" : "service_fee";
    if (type === "TRANSFER") return "transfer";
    if (type.includes("CHARGEBACK")) return "chargeback";
    if (type.includes("REFUND") || type.includes("REVERSAL")) return "refund";
    if (direction === "credit" && type.includes("PAYMENT")) return "payment_credit";
    return direction === "credit" ? "credit_adjustment" : "debit_adjustment";
}

function isProviderAccountUnavailable(error: any) {
    const status = Number(error?.status || 0);
    const message = String(error?.message || "").toLowerCase();
    return (
        [401, 403, 404].includes(status) ||
        message.includes("chave api") ||
        message.includes("access token") ||
        message.includes("não pertence a este ambiente") ||
        message.includes("does not belong to this environment")
    );
}

async function recordSyncFailure(financialAccount: any, error: any) {
    const accountUnavailable = isProviderAccountUnavailable(error);
    const occurredAt = new Date().toISOString();
    const friendlyMessage = accountUnavailable
        ? "Não conseguimos acessar sua conta financeira. Reconecte a conta ou fale com o suporte."
        : "Não conseguimos atualizar os dados financeiros agora.";

    const metadata = {
        ...(financialAccount.metadata || {}),
        provider_connection: {
            ...((financialAccount.metadata || {}).provider_connection || {}),
            status: accountUnavailable ? "account_missing" : "sync_failed",
            detected_at: occurredAt,
            error_code: accountUnavailable
                ? "PROVIDER_ACCOUNT_UNAVAILABLE"
                : "FINANCIAL_SYNC_UNAVAILABLE",
            support_required: accountUnavailable,
        },
    };

    await Promise.all([
        supabaseAdmin
            .from("financial_accounts")
            .update({
                ...(accountUnavailable
                    ? {
                        status: "account_missing",
                        charges_enabled: false,
                        payouts_enabled: false,
                    }
                    : {}),
                last_sync_error: friendlyMessage,
                metadata,
                updated_at: occurredAt,
            })
            .eq("id", financialAccount.id),
        supabaseAdmin
            .from("neurofinance_overview_snapshots")
            .update({
                is_stale: true,
                last_sync_error: friendlyMessage,
                updated_at: occurredAt,
            })
            .eq("financial_account_id", financialAccount.id),
    ]);

    return accountUnavailable ? "account_unavailable" : "sync_failed";
}

async function reconcilePaymentsMissingFromProvider(
    financialAccountId: string,
    providerPayments: any[]
) {
    const providerIds = new Set(
        providerPayments.map((payment) => String(payment?.id || "")).filter(Boolean)
    );
    const { data: localPayments, error } = await supabaseAdmin
        .from("nb_payments")
        .select("id, provider_payment_id")
        .eq("financial_account_id", financialAccountId)
        .eq("provider", "asaas")
        .in("normalized_status", ["pending", "processing", "confirmed"]);
    if (error) throw error;

    const missingIds = (localPayments || [])
        .filter((payment) =>
            payment.provider_payment_id &&
            !providerIds.has(payment.provider_payment_id)
        )
        .map((payment) => payment.id);

    for (let offset = 0; offset < missingIds.length; offset += 100) {
        const batch = missingIds.slice(offset, offset + 100);
        const { error: updateError } = await supabaseAdmin
            .from("nb_payments")
            .update({
                status: "canceled",
                provider_status: "NOT_RETURNED_BY_RECONCILIATION",
                normalized_status: "deleted",
                funds_status: "canceled",
                reconciliation_status: "not_found",
                reconciled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .in("id", batch);
        if (updateError) throw updateError;
    }

    return missingIds.length;
}

async function syncAccount(financialAccount: any, mode: "incremental" | "full") {
    const apiKey = await getFinancialAccountAsaasApiKey(financialAccount);
    if (!apiKey || financialAccount.status === "account_missing") {
        throw new Error("A conta precisa ser reconectada antes da sincronização.");
    }

    const dateFrom = mode === "incremental" ? daysAgo(45) : undefined;
    const maxPages = mode === "full" ? MAX_FULL_PAGES : MAX_INCREMENTAL_PAGES;

    const balance = await getAsaasBalance(apiKey);

    const [payments, transfers, statement] = await Promise.all([
        collectPages(
            (offset, limit) => getAsaasPayments(apiKey, {
                offset,
                limit,
                dateCreatedFrom: dateFrom,
            }),
            maxPages
        ),
        collectPages(
            (offset, limit) => getAsaasTransfers(apiKey, {
                offset,
                limit,
                dateCreatedFrom: dateFrom,
            }),
            maxPages
        ),
        collectPages(
            (offset, limit) => getAsaasFinancialTransactions(apiKey, {
                offset,
                limit,
                startDate: dateFrom,
                finishDate: dateOnly(new Date()),
            }),
            maxPages
        ),
    ]);

    const syncedPayments: any[] = [];

    for (const payment of payments) {
        const nbPayment = await upsertPaymentFromProvider(financialAccount, payment, "RECONCILIATION");
        if (nbPayment) syncedPayments.push(nbPayment);
    }

    const missingPayments = mode === "full" && payments.length < MAX_FULL_PAGES * PAGE_SIZE
        ? await reconcilePaymentsMissingFromProvider(financialAccount.id, payments)
        : 0;

    for (const transfer of transfers) {
        const status = String(transfer.status || "PENDING").toUpperCase();
        const localStatus = status === "DONE"
            ? "paid"
            : status === "CANCELLED"
                ? "canceled"
                : "pending";
        const feeAmount = Math.round(Number(transfer.transferFee || 0) * 100);

        const payoutRow = {
            user_id: financialAccount.user_id,
            financial_account_id: financialAccount.id,
            provider: "asaas",
            provider_payout_id: transfer.id,
            provider_status: status,
            amount: Math.round(Number(transfer.value || transfer.netValue || 0) * 100),
            fee_amount: feeAmount,
            operation_type: String(transfer.type || "transfer").toLowerCase(),
            currency: "brl",
            status: localStatus,
            destination_type: transfer.type === "PIX" ? "pix" : "bank_account",
            destination_summary:
                transfer.bankAccount?.bank?.name ||
                transfer.bankAccount?.accountName ||
                transfer.pixAddressKey ||
                "Conta de destino",
            requested_at: transfer.dateCreated || new Date().toISOString(),
            processed_at: transfer.effectiveDate || transfer.confirmedDate || null,
            completed_at: status === "DONE"
                ? transfer.effectiveDate || transfer.confirmedDate || new Date().toISOString()
                : null,
            reconciliation_status: "reconciled",
            reconciled_at: new Date().toISOString(),
            metadata: {
                asaas_transfer_id: transfer.id,
                transfer_fee: transfer.transferFee || 0,
                schedule_date: transfer.scheduleDate || null,
                source: "provider_sync",
            },
            updated_at: new Date().toISOString(),
        };

        const { data: existing } = await supabaseAdmin
            .from("nb_payouts")
            .select("id")
            .eq("provider", "asaas")
            .eq("provider_payout_id", transfer.id)
            .maybeSingle();

        const query = existing
            ? supabaseAdmin.from("nb_payouts").update(payoutRow).eq("id", existing.id)
            : supabaseAdmin.from("nb_payouts").insert(payoutRow);
        const { error } = await query;
        if (error) throw error;
    }

    for (const transaction of statement) {
        const value = Number(transaction.value || 0);
        const direction = value >= 0 ? "credit" : "debit";
        const type = movementType(transaction.type, direction);

        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            providerMovementId: transaction.id || null,
            movementType: type,
            direction,
            amount: Math.abs(Math.round(value * 100)),
            description: transaction.description || transaction.type || "Movimentação da conta",
            referenceType: transaction.paymentId
                ? "payment"
                : transaction.transferId
                    ? "payout"
                    : "provider_transaction",
            referenceId: transaction.paymentId || transaction.transferId || transaction.id || null,
            occurredAt: transaction.date || new Date().toISOString(),
            metadata: {
                provider_type: transaction.type || null,
                source: "provider_statement",
            },
        });
    }

    for (const nbPayment of syncedPayments) {
        await syncFinancialEntryForPayment(nbPayment, {
            matchedBy: "automatic",
            notes: "Conciliacao Asaas",
        });
    }

    const availableBalance = Math.round(Number(balance.balance || 0) * 100);
    await refreshOverviewSnapshot(
        financialAccount.id,
        availableBalance,
        mode === "full" ? "full_reconciliation" : "incremental_reconciliation"
    );

    const currentMetadata = financialAccount.metadata || {};
    const recoveredAt = new Date().toISOString();
    await supabaseAdmin
        .from("financial_accounts")
        .update({
            last_balance_sync_at: recoveredAt,
            last_sync_error: null,
            metadata: {
                ...currentMetadata,
                provider_connection: {
                    ...(currentMetadata.provider_connection || {}),
                    status: "connected",
                    recovered_at: recoveredAt,
                    error_code: null,
                    error_message: null,
                    support_required: false,
                },
                balance_sync: {
                    status: "ok",
                    recovered_at: recoveredAt,
                },
            },
            updated_at: recoveredAt,
        })
        .eq("id", financialAccount.id);

    return {
        account_id: financialAccount.id,
        payments: payments.length,
        payments_marked_missing: missingPayments,
        transfers: transfers.length,
        movements: statement.length,
        available_balance: availableBalance,
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return corsResponse();

    try {
        const body = await req.json().catch(() => ({}));
        const mode = body?.mode === "full" ? "full" : "incremental";
        const cronSecret = Deno.env.get("NEUROFINANCE_CRON_SECRET")?.trim();
        const isCron = Boolean(
            cronSecret &&
            req.headers.get("x-neurofinance-cron-secret") === cronSecret
        );

        if (isCron) {
            const { data: accounts, error } = await supabaseAdmin
                .from("financial_accounts")
                .select("*")
                .eq("provider", "asaas")
                .not("asaas_account_id", "is", null)
                .neq("status", "account_missing");
            if (error) throw error;

            const results = [];
            for (const account of accounts || []) {
                try {
                    results.push({ success: true, ...(await syncAccount(account, mode)) });
                } catch (error: any) {
                    console.error("[asaas-financial-sync] Account sync failed:", account.id, error);
                    const reason = await recordSyncFailure(account, error);
                    results.push({
                        success: false,
                        account_id: account.id,
                        reason,
                        error: error?.message || "sync_failed",
                    });
                }
            }

            return jsonResponse({ success: true, mode, results });
        }

        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            "neurofinance",
        );
        const financialAccount = await getFinancialAccount(user.id);
        if (!financialAccount) {
            return errorResponse("Sua conta NeuroFinance ainda não foi ativada.", 404, {
                code: "ACCOUNT_NOT_FOUND",
            });
        }

        const lastSyncAt = financialAccount.last_balance_sync_at
            ? new Date(financialAccount.last_balance_sync_at).getTime()
            : 0;
        if (Date.now() - lastSyncAt < 30_000 && body?.force !== true) {
            return jsonResponse({
                success: true,
                skipped: true,
                reason: "recent_sync",
                retry_after_seconds: Math.ceil((30_000 - (Date.now() - lastSyncAt)) / 1000),
            });
        }

        try {
            return jsonResponse({
                success: true,
                mode,
                result: await syncAccount(financialAccount, mode),
            });
        } catch (error: any) {
            await recordSyncFailure(financialAccount, error);
            throw error;
        }
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("[asaas-financial-sync] Fatal error:", error);
        return errorResponse(
            "Não conseguimos atualizar os dados financeiros agora. A sincronização não foi concluída.",
            Number(error?.status || 500),
            { code: "FINANCIAL_SYNC_UNAVAILABLE" }
        );
    }
});
