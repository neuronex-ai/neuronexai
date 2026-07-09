/**
 * asaas-account-sync
 *
 * Synchronizes a psychologist's Asaas sub-account status with the DB.
 * Retrieves account status + balance from Asaas API, updates financial_accounts.
 *
 * If no local record exists, it tries to discover an existing subconta
 * on Asaas by the user's email and auto-link it.
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
    upsertFinancialAccountRecord,
    findAsaasSubAccountByEmail,
    findAsaasSubAccountByCpfCnpj,
    getFinancialAccountAsaasApiKey,
    ensureAsaasOperationalWebhook,
    ASAAS_ENV,
    type AsaasAccountStatus,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

async function findExistingSubAccount(user: any, financialAccount?: any) {
    let existingSubAccount = user.email
        ? await findAsaasSubAccountByEmail(user.email)
        : null;

    if (!existingSubAccount && financialAccount?.cpf_cnpj) {
        existingSubAccount = await findAsaasSubAccountByCpfCnpj(financialAccount.cpf_cnpj);
    }

    return existingSubAccount;
}

async function markConnectionUnavailable(financialAccount: any, err: any) {
    const now = new Date().toISOString();
    const message = 'Não foi possível validar a conexão com a conta Asaas.';
    const metadata = {
        ...(financialAccount?.metadata || {}),
        provider_connection: {
            status: 'account_missing',
            detected_at: now,
            recovery_attempted_at: now,
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
        recovery_required: true,
        charges_enabled: false,
        payouts_enabled: false,
        metadata,
    };
}

async function recoverMissingPrivateCredential(user: any, financialAccount: any) {
    const existingSubAccount = await findExistingSubAccount(user, financialAccount);
    if (!existingSubAccount?.apiKey) return { financialAccount, apiKey: "" };

    const recoveredAt = new Date().toISOString();
    const updatedAccount = await upsertFinancialAccountRecord(user.id, {
        asaas_account_id: existingSubAccount.id,
        asaas_wallet_id: existingSubAccount.walletId,
        asaas_api_key: existingSubAccount.apiKey,
        asaas_environment: ASAAS_ENV,
        last_sync_error: null,
        metadata: {
            ...(financialAccount?.metadata || {}),
            provider_connection: {
                status: 'credential_recovered',
                recovered_at: recoveredAt,
                source: 'asaas_account_discovery',
                previous_account_id: financialAccount?.asaas_account_id || null,
            },
        },
    });

    return { financialAccount: updatedAccount, apiKey: existingSubAccount.apiKey };
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            'neurofinance',
        );

        // 1. Get financial account from DB
        let financialAccount = await getFinancialAccount(user.id);

        // 2. If no local record, try to discover an existing subconta on Asaas
        if (!financialAccount) {
            console.log(`[asaas-account-sync] No local record for user ${user.id}, searching Asaas...`);
            
            const existingSubAccount = await findExistingSubAccount(user);

            if (existingSubAccount) {
                console.log(`[asaas-account-sync] Found existing Asaas subconta: ${existingSubAccount.id}`);
                
                // Auto-create the local record
                financialAccount = await upsertFinancialAccountRecord(user.id, {
                    asaas_account_id: existingSubAccount.id,
                    asaas_wallet_id: existingSubAccount.walletId,
                    asaas_api_key: existingSubAccount.apiKey,
                    provider: 'asaas',
                    asaas_environment: ASAAS_ENV,
                    status: 'pending_review',
                    metadata: {
                        auto_linked: true,
                        linked_at: new Date().toISOString(),
                    },
                });
            } else {
                // No subconta found anywhere
                return jsonResponse({
                    status: 'not_started',
                    message: 'Nenhuma conta financeira encontrada. Inicie o onboarding.',
                    charges_enabled: false,
                    payouts_enabled: false,
                });
            }
        }

        let asaasApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!asaasApiKey) {
            const recovered = await recoverMissingPrivateCredential(user, financialAccount);
            financialAccount = recovered.financialAccount;
            asaasApiKey = recovered.apiKey;
        }

        if (!asaasApiKey) {
            return jsonResponse({
                status: financialAccount.status || 'not_started',
                financial_account_id: financialAccount.id,
                asaas_account_id: financialAccount.asaas_account_id,
                message: 'Conta sem API key Asaas configurada.',
                charges_enabled: false,
                payouts_enabled: false,
            });
        }

        // 3. Fetch account status from Asaas
        let accountStatus: AsaasAccountStatus;
        try {
            accountStatus = await getAsaasAccountStatus(asaasApiKey);
        } catch (err: any) {
            console.error('[asaas-account-sync] Failed to fetch account status:', err);

            if ([401, 403, 404].includes(Number(err?.status))) {
                const existingSubAccount = await findExistingSubAccount(user, financialAccount);
                const recoveredApiKey = existingSubAccount?.apiKey;

                if (existingSubAccount && recoveredApiKey) {
                    const recoveredAt = new Date().toISOString();
                    financialAccount = await upsertFinancialAccountRecord(user.id, {
                        asaas_account_id: existingSubAccount.id,
                        asaas_wallet_id: existingSubAccount.walletId,
                        asaas_api_key: recoveredApiKey,
                        asaas_environment: ASAAS_ENV,
                        last_sync_error: null,
                        metadata: {
                            ...(financialAccount.metadata || {}),
                            provider_connection: {
                                status: 'recovered',
                                recovered_at: recoveredAt,
                                previous_account_id: financialAccount.asaas_account_id,
                            },
                        },
                    });
                    accountStatus = await getAsaasAccountStatus(recoveredApiKey);
                } else {
                    return jsonResponse(await markConnectionUnavailable(financialAccount, err));
                }
            } else {
                throw err;
            }
        }

        // 4. Sync status to DB
        const activeApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        const uiStatus = deriveUiStatusFromAsaasAccount(accountStatus);
        const requirementsSnapshot = buildAsaasRequirementSnapshot(accountStatus, 'sync');
        await syncFinancialAccountFromAsaas(financialAccount.id, accountStatus, 'sync');
        const webhook = await ensureAsaasOperationalWebhook(activeApiKey || asaasApiKey).catch((webhookErr) => ({
            configured: false,
            reason: webhookErr?.message || 'webhook_sync_failed',
        }));

        // 5. Fetch balance from Asaas API if account is active
        let balance = { available: 0, pending: 0 };
        if (uiStatus === 'active') {
            try {
                balance = await getBalanceFromAsaas(activeApiKey || asaasApiKey);
            } catch (balErr) {
                console.error('[asaas-account-sync] Balance fetch error (non-fatal):', balErr);
            }
        }

        // 6. Return unified response
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
