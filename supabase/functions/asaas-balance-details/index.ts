/**
 * Account balance/detail endpoint.
 * Uses the private Asaas credential to refresh the provider statement whenever
 * the local NeuroFinance snapshot is missing, stale, or explicitly forced.
 */

import {
    corsResponse,
    errorResponse,
    getAsaasBalance,
    getAsaasFinancialTransactions,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    refreshOverviewSnapshot,
    upsertAccountMovement,
} from "../_shared/neurofinance-financial.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

function dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return dateOnly(date);
}

async function collectPages(fetchPage: (offset: number, limit: number) => Promise<any>) {
    const rows: any[] = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
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

function shouldSyncSnapshot(snapshot: any, body: any) {
    if (body?.force === true) return true;
    if (!snapshot) return true;
    if (snapshot.is_stale || snapshot.last_sync_error) return true;
    const providerAsOf = snapshot.provider_as_of || snapshot.updated_at;
    const updatedAt = providerAsOf ? new Date(providerAsOf).getTime() : 0;
    return !updatedAt || Date.now() - updatedAt > 10 * 60 * 1000;
}

async function syncStatementForDetails(userId: string, body: any) {
    const financialAccount = await getFinancialAccount(userId);
    if (!financialAccount) {
        throw Object.assign(new Error("Sua conta NeuroFinance ainda não foi ativada."), { status: 404 });
    }

    const apiKey = await getFinancialAccountAsaasApiKey(financialAccount);
    if (!apiKey || financialAccount.status === "account_missing") {
        throw Object.assign(new Error("Credencial privada da subconta Asaas não configurada."), { status: 409 });
    }

    const startDate = body.start_date || daysAgo(45);
    const finishDate = body.finish_date || dateOnly(new Date());

    const [balance, statement] = await Promise.all([
        getAsaasBalance(apiKey),
        collectPages((offset, limit) => getAsaasFinancialTransactions(apiKey, {
            offset,
            limit,
            startDate,
            finishDate,
        })),
    ]);

    for (const transaction of statement) {
        const value = Number(transaction.value || 0);
        const direction = value >= 0 ? "credit" : "debit";

        await upsertAccountMovement({
            userId: financialAccount.user_id,
            financialAccountId: financialAccount.id,
            providerMovementId: transaction.id || null,
            movementType: movementType(transaction.type, direction),
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

    await refreshOverviewSnapshot(
        financialAccount.id,
        Math.round(Number(balance.balance || 0) * 100),
        "balance_details_statement_sync",
    );
}

function toTransaction(item: any) {
    return {
        id: item.id,
        description: item.patient_name
            ? `${item.patient_name} · ${item.description}`
            : item.description,
        amount: Number(item.amount || 0) / 100,
        type: item.overview_group === "outflow" ? "expense" : "income",
        category: item.item_type || item.overview_group,
        date: item.occurred_at,
        created_at: item.occurred_at,
        appointment_id: null,
        external_reference: item.reference_id,
        origin: "gateway_auto",
        status: item.status,
        payment_method: item.payment_method,
        metadata: item.metadata || {},
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

        const { data: initialSnapshot, error: snapshotError } = await supabaseAdmin
            .from("neurofinance_overview_snapshot_v")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
        let snapshot = initialSnapshot;
        if (snapshotError) throw snapshotError;

        if (shouldSyncSnapshot(snapshot, body)) {
            await syncStatementForDetails(user.id, body);
            const refreshed = await supabaseAdmin
                .from("neurofinance_overview_snapshot_v")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();
            if (refreshed.error) throw refreshed.error;
            snapshot = refreshed.data;
        }

        const requestedView = String(body.view || "all");
        const overviewGroup = requestedView === "total"
            ? "income"
            : requestedView === "andamento"
                ? "outflow"
                : requestedView === "futuro"
                    ? "receivable"
                    : null;

        let detailQuery = supabaseAdmin
            .from("neurofinance_overview_items_v")
            .select("*")
            .eq("user_id", user.id)
            .order("occurred_at", { ascending: false });

        if (overviewGroup) detailQuery = detailQuery.eq("overview_group", overviewGroup);
        if (body.start_date) detailQuery = detailQuery.gte("occurred_at", `${body.start_date}T00:00:00Z`);
        if (body.finish_date) detailQuery = detailQuery.lte("occurred_at", `${body.finish_date}T23:59:59Z`);

        const { data: items, error: itemError } = await detailQuery.limit(500);
        if (itemError) throw itemError;

        return jsonResponse({
            balance: {
                current: snapshot?.available_balance || 0,
                available: snapshot?.available_balance || 0,
                pending: snapshot?.pending_receivables || 0,
            },
            summary: {
                available_balance: snapshot?.available_balance || 0,
                pending_balance: snapshot?.pending_receivables || 0,
                gross_volume: snapshot?.gross_received || 0,
                fees_total: snapshot?.fees_total || 0,
                net_volume: snapshot?.calculated_available_balance || 0,
                paid_out_balance: snapshot?.total_outflow || 0,
            },
            transactions: (items || []).map(toTransaction),
            total_transactions: items?.length || 0,
            provider: "asaas",
            snapshot: snapshot || null,
        });
    } catch (error) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("[asaas-balance-details] Read failed:", error);
        return errorResponse(
            "Não conseguimos abrir os detalhes agora. Tente novamente em instantes.",
            Number((error as any)?.status || 500),
            { code: "FINANCIAL_DETAILS_UNAVAILABLE" }
        );
    }
});
