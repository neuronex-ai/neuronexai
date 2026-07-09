/**
 * asaas-account-update
 *
 * Updates account information on the Asaas sub-account.
 *
 * POST /asaas-account-update
 * Body: {
 *   name?: string,
 *   email?: string,
 *   phone?: string,
 *   mobilePhone?: string,
 *   address?: string,
 *   addressNumber?: string,
 *   complement?: string,
 *   province?: string,
 *   postalCode?: string,
 *   // Bank account fields:
 *   bank_code?: string,
 *   agency?: string,
 *   account?: string,
 *   account_digit?: string,
 *   account_type?: 'CONTA_CORRENTE' | 'CONTA_POUPANCA',
 *   owner_name?: string,
 *   cpfCnpj?: string,
 * }
 */

import {
    supabaseAdmin,
    corsResponse,
    jsonResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    asaasRequest,
    sanitizeDigits,
    getFinancialAccountAsaasApiKey,
    normalizeAccountNumber,
    ASAAS_ENV,
    getAsaasAccountStatus,
    buildAsaasRequirementSnapshot,
    syncFinancialAccountFromAsaas,
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

        // 1. Get financial account
        const financialAccount = await getFinancialAccount(user.id);
        const subApiKey = await getFinancialAccountAsaasApiKey(financialAccount);
        if (!financialAccount || !subApiKey) {
            return errorResponse('Conta financeira não configurada.', 403);
        }
        const acceptance = !financialAccount.tos_accepted_at || body.tos?.accepted === true
            ? requireFinancialOnboardingAcceptance(body, 'neurofinance_account_update')
            : null;

        const profile = body.profile || {};
        const businessProfile = body.business_profile || {};
        const bankAccount = body.bank_account || {};
        const pixDestination = body.pix_destination || body.pix || null;
        const normalizedAccount = normalizeAccountNumber(
            bankAccount.account_number ?? body.account,
            bankAccount.account_digit ?? body.account_digit
        );
        const cpfCnpj = sanitizeDigits(body.cpfCnpj || body.cpf_cnpj || bankAccount.cpfCnpj || financialAccount.cpf_cnpj);
        const bankCode = sanitizeDigits(bankAccount.bank_code || body.bank_code);
        const agency = sanitizeDigits(bankAccount.agency || body.agency);
        const ownerName =
            body.owner_name ||
            bankAccount.account_holder_name ||
            body.name ||
            financialAccount.holder_name ||
            '';

        // 2. Build update payload (only include non-null fields)
        const updatePayload: Record<string, unknown> = {};

        const simpleFields = ['name', 'email', 'phone', 'mobilePhone', 'address', 'addressNumber', 'complement', 'province'];
        for (const field of simpleFields) {
            if (body[field] !== undefined && body[field] !== null) {
                updatePayload[field] = body[field];
            }
        }

        if (body.postalCode) {
            updatePayload.postalCode = sanitizeDigits(body.postalCode);
        }

        if (body.companyType) updatePayload.companyType = body.companyType;
        if (body.incomeValue) updatePayload.incomeValue = body.incomeValue;

        const fullName = body.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        const now = new Date().toISOString();
        const existingMetadata = (financialAccount.metadata || {}) as Record<string, any>;
        const metadataPatch = pixDestination?.key || body.payout_destination
            ? {
                ...existingMetadata,
                payout_destination: body.payout_destination || existingMetadata.payout_destination || null,
                destinations: {
                    ...(existingMetadata.destinations || {}),
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
            }
            : null;

        const snapshotPatch = {
            provider: 'asaas',
            asaas_environment: ASAAS_ENV,
            holder_name: fullName || null,
            cpf_cnpj: cpfCnpj || null,
            birth_date: body.birthDate || null,
            mobile_phone: sanitizeDigits(body.mobilePhone || body.phone) || null,
            pep_status: profile.political_exposure || null,
            address_street: body.address || null,
            address_number: body.addressNumber || null,
            address_complement: body.complement || null,
            address_neighborhood: body.province || null,
            address_city: profile.city || null,
            address_state: profile.state || null,
            address_postal_code: sanitizeDigits(body.postalCode) || null,
            company_type: body.companyType || null,
            income_value: body.incomeValue || null,
            business_url: body.site || null,
            business_description: businessProfile.product_description || null,
            business_mcc: businessProfile.mcc || null,
            bank_code: bankCode || null,
            bank_name: bankCode || financialAccount.bank_name || null,
            bank_agency: agency || null,
            bank_account: normalizedAccount.account || null,
            bank_account_digit: normalizedAccount.accountDigit || null,
            bank_account_type: body.account_type || bankAccount.account_type || 'CONTA_CORRENTE',
            bank_holder_name: ownerName || null,
            bank_holder_cpf_cnpj: cpfCnpj || null,
            bank_account_last4: normalizedAccount.accountDisplay.slice(-4) || null,
            document_front_id: body.documents?.front_file_id || null,
            document_back_id: body.documents?.back_file_id || null,
            tos_accepted_at: body.tos?.accepted ? (financialAccount.tos_accepted_at || now) : financialAccount.tos_accepted_at,
            onboarding_payload: body,
            ...(metadataPatch ? { metadata: metadataPatch } : {}),
            updated_at: now,
        };

        let commercialResult = null;
        let bankResult = null;

        if (Object.keys(updatePayload).length > 0) {
            commercialResult = await asaasRequest(
                '/myAccount/commercialInfo',
                'POST',
                updatePayload,
                subApiKey
            );
        }

        if (bankCode && agency && normalizedAccount.account) {
            bankResult = await asaasRequest(
                '/bankAccountInfo',
                'POST',
                {
                    bank: { code: bankCode },
                    accountName: ownerName,
                    ownerName,
                    cpfCnpj,
                    agency,
                    account: normalizedAccount.account,
                    accountDigit: normalizedAccount.accountDigit,
                    bankAccountType: body.account_type || bankAccount.account_type || 'CONTA_CORRENTE',
                },
                subApiKey
            );
        }

        const accountStatus = await getAsaasAccountStatus(subApiKey);
        const requirements = buildAsaasRequirementSnapshot(accountStatus, 'sync');

        const { error: snapshotError } = await supabaseAdmin
            .from('financial_accounts')
            .update(snapshotPatch)
            .eq('id', financialAccount.id);
        if (snapshotError) throw snapshotError;

        if (acceptance) {
            await recordFinancialOnboardingAcceptances({
                userId: user.id,
                financialAccountId: financialAccount.id,
                flowOrigin: acceptance.flowOrigin,
                metadata: {
                    endpoint: 'asaas-account-update',
                    reason: financialAccount.tos_accepted_at ? 'refresh' : 'missing_previous_acceptance',
                },
            });
        }
        await syncFinancialAccountFromAsaas(financialAccount.id, accountStatus, 'sync');

        return jsonResponse({
            success: true,
            sync_status: 'synced',
            commercial_info: commercialResult,
            bank_info: bankResult,
            account_status: accountStatus,
            requirements,
        });

    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error('asaas-account-update error:', error);
        return errorResponse(error.message || 'Internal error', 500);
    }
});
