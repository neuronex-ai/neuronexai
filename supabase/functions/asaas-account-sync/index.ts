/**
 * asaas-account-sync
 *
 * Synchronizes a psychologist's Asaas sub-account status with the DB.
 * Retrieves account status + balance from Asaas API, updates financial_accounts.
 *
 * POST /asaas-account-sync
 */

import {
    supabaseAdmin,
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    getAsaasAccountStatus,
    deriveUiStatusFromAsaasAccount,
    buildAsaasRequirementSnapshot,
    syncFinancialAccountFromAsaas,
    getBalanceFromAsaas,
    getFinancialAccountAsaasApiKey,
    ensureAsaasOperationalWebhook,
    type AsaasAccountStatus,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

async function markConnectionUnavailable(financialAccount: any, err: any) {
    const now = new Date().toISOString();
    const message = 'Não foi possível validar a conexão com a conta Asaas.';
    const metadata = {
        ...(financialAccount?.metadata || {}),
        provider_connection: {
            status: 'account_missing',
            detected_at: now,
            connection_checked_at: now,
            error_code: err?.status || 'PROVIDER_CONNECTION_ERROR',
            error_message: err?.message || message,
            support_required: true,
        },
    };

    const { error } = await supabaseAdmin
        .from('financial_accounts')
        .update({
            status: 'account_missing',
            charges_enabled: false,
            payouts_enabled: false,
            last_sync_error: message,
            metadata,
            updated_at: now,
        })
        .eq('id', financialAccount.id);

    if (error) throw error;

    return {
        status: 'account_missing',
        financial_account_id: financialAccount.id,
        asaas_account_id: financialAccount.asaas_account_id,
        message,
        support_required: true,
        charges_enabled: false,
        payouts_enabled: false,
        metadata,
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            'neurofinance',
        );

        // 1. Get the local Asaas account record from DB.
        const financialAccount = await getFinancialAccount(user.id);

        if (!financialAccount) {
            return jsonResponse({
                status: 'not_started',
                message: 'Nenhuma conta financeira encontrada. Inicie o onboarding.',
                charges_enabled: false,
                payouts_enabled: false,
            });
        }

        const asaasApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!asaasApiKey) {
            return errorResponse('Credencial privada da subconta Asaas não configurada.', 409, {
                code: 'ASAAS_PRIVATE_CREDENTIAL_MISSING',
                financial_account_id: financialAccount.id,
            });
        }

        // 2. Fetch account status from Asaas
        let accountStatus: AsaasAccountStatus;
        try {
            accountStatus = await getAsaasAccountStatus(asaasApiKey);
        } catch (err: any) {
            console.error('[asaas-account-sync] Failed to fetch account status:', err);

            if ([401, 403, 404].includes(Number(err?.status))) {
                return jsonResponse(await markConnectionUnavailable(financialAccount, err));
            } else {
                throw err;
            }
        }

        // 3. Sync status to DB and ensure the Asaas webhook is active.
        const uiStatus = deriveUiStatusFromAsaasAccount(accountStatus);
        const requirementsSnapshot = buildAsaasRequirementSnapshot(accountStatus, 'sync');
        await syncFinancialAccountFromAsaas(financialAccount.id, accountStatus, 'sync');
        const webhook = await ensureAsaasOperationalWebhook(asaasApiKey);

        // 4. Fetch balance from Asaas API if account is active
        let balance = { available: 0, pending: 0 };
        if (uiStatus === 'active') {
            balance = await getBalanceFromAsaas(asaasApiKey);
        }

        // 5. Return unified response
        return jsonResponse({
            status: uiStatus,
            financial_account_id: financialAccount.id,
            asaas_account_id: financialAccount.asaas_account_id,
            charges_enabled: uiStatus === 'active',
            payouts_enabled: uiStatus === 'active',
            details_submitted: accountStatus.commercialInfoStatus !== 'NOT_SENT',
            // Keep `balances` (plural) for frontend compatibility.
            // Also include `balance` for backward compatibility if any caller expects it.
            balances: {
                available: balance.available,
                pending: balance.pending,
                currency: 'brl',
            },
            balance: {
                available: balance.available,
                pending: balance.pending,
                currency: 'brl',
            },
            account_status: accountStatus,
            requirements: requirementsSnapshot,
            metadata: {
                provider: 'asaas',
                wallet_id: financialAccount.asaas_wallet_id,
            },
            webhook,
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-account-sync error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
