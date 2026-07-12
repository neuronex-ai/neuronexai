/**
 * asaas-connect-onboarding
 *
 * Creates a white-label sub-account (subconta) for a psychologist via Asaas API.
 * Stores the sub-account walletId in `financial_accounts` and the apiKey in
 * the private credential vault.
 * Returns onboarding URL if additional documents are needed.
 *
 * POST /asaas-connect-onboarding
 * Body: {
 *   name: string,
 *   email: string,
 *   cpfCnpj: string,
 *   phone?: string,
 *   mobilePhone?: string,
 *   birthDate?: string,      // YYYY-MM-DD
 *   address?: string,
 *   addressNumber?: string,
 *   complement?: string,
 *   province?: string,
 *   postalCode?: string,
 *   incomeValue?: number,
 *   companyType?: string,
 * }
 */

import {
    supabaseAdmin,
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    createAsaasSubAccount,
    getAsaasAccountStatus,
    deriveUiStatusFromAsaasAccount,
    buildAsaasRequirementSnapshot,
    syncFinancialAccountFromAsaas,
    upsertFinancialAccountRecord,
    sanitizeDigits,
    asaasRequest,
    getFinancialAccountAsaasApiKey,
    normalizeAccountNumber,
    ensureAsaasOperationalWebhook,
    ASAAS_ENV,
    recordFinancialOnboardingAcceptances,
    requireFinancialOnboardingAcceptance,
} from '../_shared/asaas-client.ts';
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from '../_shared/subscription-access.ts';

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse();

    try {
        const user = await getAuthenticatedUser(req);
        await requireEntitlementForUser(
            { id: user.id, email: user.email, user_metadata: user.user_metadata },
            'neurofinance',
        );
        const body = await req.json();
        const acceptance = requireFinancialOnboardingAcceptance(body, 'neurofinance_onboarding');

        const {
            name,
            email,
            cpfCnpj,
            phone,
            mobilePhone,
            birthDate,
            address,
            addressNumber,
            complement,
            province,
            postalCode,
            incomeValue,
            companyType,
        } = body;

        const resolvedEmail = (email || user.email || '').trim();
        const profile = body.profile || {};
        const businessProfile = body.business_profile || {};
        const bankAccount = body.bank_account || {};
        const pixDestination = body.pix_destination || body.pix || null;
        const normalizedAccount = normalizeAccountNumber(bankAccount.account_number, bankAccount.account_digit);
        const cpfCnpjDigits = sanitizeDigits(cpfCnpj);
        const bankCode = sanitizeDigits(bankAccount.bank_code);
        const agency = sanitizeDigits(bankAccount.agency);
        const ownerName = bankAccount.account_holder_name || name;
        const now = new Date().toISOString();

        if (!name || !resolvedEmail || !cpfCnpj) {
            return errorResponse('name, email e cpfCnpj são obrigatórios', 400);
        }

        // 1. Check if user already has a financial account with Asaas
        const { data: existingAccount } = await supabaseAdmin
            .from('financial_accounts')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (existingAccount?.asaas_account_id) {
            // Already has an Asaas subconta — try to sync status
            try {
                await recordFinancialOnboardingAcceptances({
                    userId: user.id,
                    financialAccountId: existingAccount.id,
                    flowOrigin: acceptance.flowOrigin,
                    metadata: {
                        endpoint: 'asaas-connect-onboarding',
                        already_exists: true,
                    },
                });
                const existingApiKey = await getFinancialAccountAsaasApiKey(existingAccount);
                if (!existingApiKey) {
                    return errorResponse('Subconta Asaas existente sem credencial privada configurada.', 409, {
                        code: 'ASAAS_PRIVATE_CREDENTIAL_MISSING',
                    });
                }
                const status = await getAsaasAccountStatus(existingApiKey);
                const uiStatus = deriveUiStatusFromAsaasAccount(status);
                const requirements = buildAsaasRequirementSnapshot(status, 'sync');
                await syncFinancialAccountFromAsaas(existingAccount.id, status, 'sync');
                const webhook = await ensureAsaasOperationalWebhook(existingApiKey);

                return jsonResponse({
                    success: true,
                    already_exists: true,
                    financial_account_id: existingAccount.id,
                    asaas_account_id: existingAccount.asaas_account_id,
                    status: uiStatus,
                    onboarding_url: existingAccount.asaas_onboarding_url,
                    account_status: status,
                    requirements,
                    webhook,
                });
            } catch (err) {
                console.error('Error syncing existing account:', err);
                return errorResponse((err as any)?.message || 'Não foi possível sincronizar a subconta Asaas existente.', 502, {
                    code: 'ASAAS_EXISTING_ACCOUNT_SYNC_FAILED',
                    already_exists: true,
                    financial_account_id: existingAccount.id,
                    asaas_account_id: existingAccount.asaas_account_id,
                    status: existingAccount.status || 'pending_review',
                    onboarding_url: existingAccount.asaas_onboarding_url,
                });
            }
        }

        // 2. Create sub-account in Asaas
        console.log(`[asaas-connect-onboarding] Creating subconta for user ${user.id}`);

        const subAccount = await createAsaasSubAccount({
            name,
            email: resolvedEmail,
            cpfCnpj: cpfCnpjDigits,
            phone: sanitizeDigits(phone),
            mobilePhone: sanitizeDigits(mobilePhone),
            birthDate,
            address,
            addressNumber,
            complement,
            province,
            postalCode: sanitizeDigits(postalCode),
            incomeValue,
            companyType,
        });

        console.log(`[asaas-connect-onboarding] Subconta created: ${subAccount.id}, walletId: ${subAccount.walletId}`);

        let bankUpdateResult = null;
        if (bankCode && agency && normalizedAccount.account) {
            bankUpdateResult = await asaasRequest(
                '/bankAccountInfo',
                'POST',
                {
                    bank: { code: bankCode },
                    accountName: ownerName,
                    ownerName,
                    cpfCnpj: cpfCnpjDigits,
                    agency,
                    account: normalizedAccount.account,
                    accountDigit: normalizedAccount.accountDigit,
                    bankAccountType: bankAccount.account_type || 'CONTA_CORRENTE',
                },
                subAccount.apiKey
            );
        }

        // 3. Persist in financial_accounts
        const financialAccount = await upsertFinancialAccountRecord(user.id, {
            provider: 'asaas',
            asaas_account_id: subAccount.id,
            asaas_wallet_id: subAccount.walletId,
            asaas_onboarding_url: subAccount.onboardingUrl || null,
            asaas_environment: ASAAS_ENV,
            status: 'onboarding',
            onboarding_started_at: new Date().toISOString(),
            charges_enabled: false,
            payouts_enabled: false,
            details_submitted: false,
            asaasPrivateApiKey: subAccount.apiKey,
            holder_name: name,
            cpf_cnpj: cpfCnpjDigits,
            birth_date: birthDate || null,
            mobile_phone: sanitizeDigits(mobilePhone || phone) || null,
            pep_status: profile.political_exposure || null,
            address_street: address || null,
            address_number: addressNumber || null,
            address_complement: complement || null,
            address_neighborhood: province || null,
            address_city: profile.city || null,
            address_state: profile.state || null,
            address_postal_code: sanitizeDigits(postalCode) || null,
            company_type: companyType || null,
            income_value: incomeValue || null,
            business_url: body.site || null,
            business_description: businessProfile.product_description || null,
            business_mcc: businessProfile.mcc || null,
            bank_code: bankCode || null,
            bank_name: bankCode || null,
            bank_agency: agency || null,
            bank_account: normalizedAccount.account || null,
            bank_account_digit: normalizedAccount.accountDigit || null,
            bank_account_type: bankAccount.account_type || 'CONTA_CORRENTE',
            bank_holder_name: ownerName || null,
            bank_holder_cpf_cnpj: cpfCnpjDigits || null,
            bank_account_last4: normalizedAccount.accountDisplay.slice(-4) || null,
            document_front_id: body.documents?.front_file_id || null,
            document_back_id: body.documents?.back_file_id || null,
            tos_accepted_at: body.tos?.accepted ? now : null,
            onboarding_payload: body,
            metadata: {
                asaas_wallet_id: subAccount.walletId,
                asaas_account_id: subAccount.id,
                asaas_account_number: subAccount.accountNumber || null,
                bank_account_info_submitted: Boolean(bankUpdateResult),
                payout_destination: body.payout_destination || null,
                destinations: {
                    ...(pixDestination?.key ? {
                        pix: {
                            type: pixDestination.type || 'manual',
                            key: pixDestination.key,
                            normalized_key: pixDestination.normalized_key || pixDestination.normalizedKey || pixDestination.key,
                            updated_at: now,
                        },
                    } : {}),
                    updated_at: now,
                },
            },
        });

        await recordFinancialOnboardingAcceptances({
            userId: user.id,
            financialAccountId: financialAccount.id,
            flowOrigin: acceptance.flowOrigin,
            metadata: {
                endpoint: 'asaas-connect-onboarding',
                asaas_account_id: subAccount.id,
            },
        });

        const webhook = await ensureAsaasOperationalWebhook(subAccount.apiKey);
        const accountStatus = await getAsaasAccountStatus(subAccount.apiKey);
        const status = deriveUiStatusFromAsaasAccount(accountStatus);
        const requirements = buildAsaasRequirementSnapshot(accountStatus, 'onboarding');
        await syncFinancialAccountFromAsaas(financialAccount.id, accountStatus, 'onboarding');

        // 4. Create onboarding session record
        await supabaseAdmin
            .from('financial_onboarding_sessions')
            .insert({
                user_id: user.id,
                financial_account_id: financialAccount.id,
                provider: 'asaas',
                provider_account_id: subAccount.id,
                status: 'in_progress',
                onboarding_url: subAccount.onboardingUrl || null,
                started_at: new Date().toISOString(),
            });

        return jsonResponse({
            success: true,
            financial_account_id: financialAccount.id,
            asaas_account_id: subAccount.id,
            wallet_id: subAccount.walletId,
            onboarding_url: subAccount.onboardingUrl,
            status,
            account_status: accountStatus,
            requirements,
            webhook,
            account_number: subAccount.accountNumber || null,
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-connect-onboarding error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
