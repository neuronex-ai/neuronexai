/**
 * Shared Asaas client for NeuroFinance Edge Functions
 *
 * Centraliza:
 * - Asaas REST API v3 (BaaS) client
 * - Supabase admin client
 * - CORS
 * - Auth
 * - Helpers de onboarding/status
 * - Helpers de webhook
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─────────────────────────────────────────────────────────────
// Asaas config
// ─────────────────────────────────────────────────────────────

export type AsaasEnvironment = "production" | "sandbox";

function normalizeAsaasEnvironment(value?: string | null): AsaasEnvironment {
    const normalized = (value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    if (["production", "prod", "producao", "live"].includes(normalized)) {
        return "production";
    }

    return "sandbox";
}

export const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")?.trim() || "";
export const ASAAS_WEBHOOK_TOKEN =
    Deno.env.get("ASAAS_WEBHOOK_TOKEN")?.trim() || "";

// Accept the misspelled secret currently configured in production and the canonical spelling.
export const ASAAS_ENV = normalizeAsaasEnvironment(
    Deno.env.get("ASAAS_ENVIROMENT") ||
    Deno.env.get("ASAAS_ENVIRONMENT") ||
    Deno.env.get("ASAAS_ENV") ||
    "sandbox"
);

const configuredAsaasBaseUrl = Deno.env.get("ASAAS_API_URL")?.trim().replace(/\/+$/, "") || "";
const defaultAsaasBaseUrl =
    ASAAS_ENV === "production"
        ? "https://api.asaas.com/v3"
        : "https://api-sandbox.asaas.com/v3";

export const ASAAS_BASE_URL =
    ASAAS_ENV === "production" && configuredAsaasBaseUrl.includes("api-sandbox.")
        ? defaultAsaasBaseUrl
        : ASAAS_ENV === "sandbox" && configuredAsaasBaseUrl.includes("api.asaas.com")
            ? defaultAsaasBaseUrl
            : configuredAsaasBaseUrl || defaultAsaasBaseUrl;

export const ASAAS_USER_AGENT =
    Deno.env.get("ASAAS_USER_AGENT")?.trim() || "NeuroNex/1.0";

if (!ASAAS_API_KEY) {
    console.error("[_shared/asaas-client] Missing ASAAS_API_KEY");
}

if (ASAAS_ENV === "production" && ASAAS_API_KEY.startsWith("$aact_hmlg_")) {
    console.error("[_shared/asaas-client] Sandbox API key detected while ASAAS environment is production");
}

if (ASAAS_ENV === "sandbox" && ASAAS_API_KEY.startsWith("$aact_prod_")) {
    console.error("[_shared/asaas-client] Production API key detected while ASAAS environment is sandbox");
}

if (configuredAsaasBaseUrl && configuredAsaasBaseUrl !== ASAAS_BASE_URL) {
    console.warn(
        `[_shared/asaas-client] Ignoring ASAAS_API_URL=${configuredAsaasBaseUrl} because it conflicts with ASAAS_ENV=${ASAAS_ENV}`
    );
}

// ─────────────────────────────────────────────────────────────
// Supabase admin
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim() || "";
const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";

export const ASAAS_WEBHOOK_URL =
    Deno.env.get("ASAAS_WEBHOOK_URL")?.trim() ||
    (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/asaas-webhook` : "");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [];
    if (!SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    console.error(
        `[_shared/asaas-client] Missing env vars: ${missing.join(", ")}`
    );
}

export const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

export async function saveProviderPayout(values: Record<string, unknown>) {
    const provider = String(values.provider || "asaas");
    const providerPayoutId = String(values.provider_payout_id || "");
    if (!providerPayoutId) throw new Error("Provider payout ID is required.");

    const findExisting = () => supabaseAdmin
        .from("nb_payouts")
        .select("id")
        .eq("provider", provider)
        .eq("provider_payout_id", providerPayoutId)
        .maybeSingle();

    const { data: existing, error: findError } = await findExisting();
    if (findError) throw findError;

    if (existing?.id) {
        const { data, error } = await supabaseAdmin
            .from("nb_payouts")
            .update(values)
            .eq("id", existing.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabaseAdmin
        .from("nb_payouts")
        .insert(values)
        .select()
        .single();
    if (!error) return data;
    if (String(error.code || "") !== "23505") throw error;

    const { data: raced, error: racedError } = await findExisting();
    if (racedError) throw racedError;
    if (!raced?.id) throw error;

    const { data: updated, error: updateError } = await supabaseAdmin
        .from("nb_payouts")
        .update(values)
        .eq("id", raced.id)
        .select()
        .single();
    if (updateError) throw updateError;
    return updated;
}

// ─────────────────────────────────────────────────────────────
// CORS + responses
// ─────────────────────────────────────────────────────────────

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, asaas-access-token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function corsResponse() {
    return new Response("ok", { headers: corsHeaders });
}

export function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

export function errorResponse(
    message: string,
    status = 400,
    extra?: Record<string, unknown>
) {
    return jsonResponse({ error: message, ...(extra || {}) }, status);
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export async function getAuthenticatedUser(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
        data: { user },
        error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) throw new Error("Invalid or expired token");
    return user;
}

// ─────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────

export function sanitizeDigits(value?: string | null) {
    return (value || "").replace(/\D/g, "");
}

export function toNullableString(value?: string | null) {
    const v = value?.trim();
    return v ? v : undefined;
}

export async function storeAsaasAccountApiKey(
    financialAccount: any,
    apiKey?: string | null,
    source = "edge_function",
) {
    const trimmedApiKey = apiKey?.trim();
    if (!trimmedApiKey) return;
    if (!financialAccount?.id || !financialAccount?.user_id) {
        throw new Error("Financial account id and user id are required to store Asaas credentials.");
    }

    const { error } = await supabaseAdmin
        .rpc("store_asaas_account_api_key_for_edge", {
            p_financial_account_id: financialAccount.id,
            p_user_id: financialAccount.user_id,
            p_asaas_account_id: financialAccount.asaas_account_id || null,
            p_api_key: trimmedApiKey,
            p_source: source,
        });

    if (error) throw error;
}

export async function getFinancialAccountAsaasApiKey(financialAccount: any): Promise<string> {
    const financialAccountId = financialAccount?.id;
    if (!financialAccountId) return "";

    const { data, error } = await supabaseAdmin
        .rpc("get_asaas_account_api_key_for_edge", {
            p_financial_account_id: financialAccountId,
        });

    if (error) throw error;
    return String(data || "").trim();
}

export async function recordBaasOperation(
    userId: string,
    financialAccountId: string | null | undefined,
    operationType: string,
    providerResponse: Record<string, unknown>,
    details?: { amount?: number; description?: string; payload?: Record<string, unknown> }
) {
    const { error } = await supabaseAdmin.from("neurofinance_baas_operations").insert({
        user_id: userId,
        financial_account_id: financialAccountId || null,
        provider: "asaas",
        operation_type: operationType,
        provider_operation_id: String((providerResponse as any)?.id || (providerResponse as any)?.payment?.id || ""),
        status: String((providerResponse as any)?.status || (providerResponse as any)?.payment?.status || "submitted"),
        amount: details?.amount || null,
        description: details?.description || null,
        payload: details?.payload || {},
        provider_response: providerResponse,
        updated_at: new Date().toISOString(),
    });
    if (error) console.warn("[asaas-client] Failed to record BaaS operation:", error);
}

export const NEUROFINANCE_TERMS_VERSION =
    Deno.env.get("NEUROFINANCE_TERMS_VERSION")?.trim() ||
    "neurofinance-terms-2026-06-30";

export const NEUROFINANCE_TERMS_HASH =
    Deno.env.get("NEUROFINANCE_TERMS_HASH")?.trim() ||
    "neurofinance-terms-2026-06-30";

export const ASAAS_TERMS_REFERENCE =
    Deno.env.get("ASAAS_TERMS_REFERENCE")?.trim() ||
    "asaas-terms-reference-managed-by-compliance";

export const ASAAS_TERMS_HASH =
    Deno.env.get("ASAAS_TERMS_HASH")?.trim() ||
    "asaas-terms-reference-managed-by-compliance";

export const ASAAS_PRIVACY_POLICY_REFERENCE =
    Deno.env.get("ASAAS_PRIVACY_POLICY_REFERENCE")?.trim() ||
    "asaas-privacy-policy-reference-managed-by-compliance";

export const ASAAS_PRIVACY_POLICY_HASH =
    Deno.env.get("ASAAS_PRIVACY_POLICY_HASH")?.trim() ||
    "asaas-privacy-policy-reference-managed-by-compliance";

type FinancialAcceptanceType =
    | "neuronex_terms"
    | "asaas_terms"
    | "asaas_privacy_policy"
    | "financial_onboarding_bundle"
    | "pix_random_key_consent";

export function requireFinancialOnboardingAcceptance(
    body: any,
    flowOrigin = "neurofinance_onboarding",
) {
    if (body?.tos?.accepted !== true) {
        throw new Error("Aceite dos termos NeuroNex e Asaas e obrigatorio para continuar.");
    }

    return {
        flowOrigin,
        acceptedAt: new Date().toISOString(),
        neuronexTermsVersion: NEUROFINANCE_TERMS_VERSION,
        neuronexTermsHash: NEUROFINANCE_TERMS_HASH,
        asaasTermsReference: ASAAS_TERMS_REFERENCE,
        asaasTermsHash: ASAAS_TERMS_HASH,
        asaasPrivacyPolicyReference: ASAAS_PRIVACY_POLICY_REFERENCE,
        asaasPrivacyPolicyHash: ASAAS_PRIVACY_POLICY_HASH,
    };
}

async function insertFinancialAcceptance(values: {
    userId: string;
    financialAccountId?: string | null;
    acceptanceType: FinancialAcceptanceType;
    flowOrigin: string;
    contentVersion: string;
    contentReference: string;
    contentHash: string;
    metadata?: Record<string, unknown>;
}) {
    const { error } = await supabaseAdmin
        .from("neurofinance_contract_acceptances")
        .insert({
            user_id: values.userId,
            actor_user_id: values.userId,
            financial_account_id: values.financialAccountId || null,
            provider: "asaas",
            acceptance_type: values.acceptanceType,
            accepted_at: new Date().toISOString(),
            flow_origin: values.flowOrigin,
            content_version: values.contentVersion,
            content_reference: values.contentReference,
            content_hash: values.contentHash,
            metadata: values.metadata || {},
        });

    if (error) throw error;
}

export async function recordFinancialOnboardingAcceptances(values: {
    userId: string;
    financialAccountId: string;
    flowOrigin?: string;
    metadata?: Record<string, unknown>;
}) {
    const flowOrigin = values.flowOrigin || "neurofinance_onboarding";
    const metadata = {
        source: "server_side_acceptance",
        ...values.metadata,
    };

    await Promise.all([
        insertFinancialAcceptance({
            userId: values.userId,
            financialAccountId: values.financialAccountId,
            acceptanceType: "neuronex_terms",
            flowOrigin,
            contentVersion: NEUROFINANCE_TERMS_VERSION,
            contentReference: NEUROFINANCE_TERMS_VERSION,
            contentHash: NEUROFINANCE_TERMS_HASH,
            metadata,
        }),
        insertFinancialAcceptance({
            userId: values.userId,
            financialAccountId: values.financialAccountId,
            acceptanceType: "asaas_terms",
            flowOrigin,
            contentVersion: ASAAS_TERMS_REFERENCE,
            contentReference: ASAAS_TERMS_REFERENCE,
            contentHash: ASAAS_TERMS_HASH,
            metadata,
        }),
        insertFinancialAcceptance({
            userId: values.userId,
            financialAccountId: values.financialAccountId,
            acceptanceType: "asaas_privacy_policy",
            flowOrigin,
            contentVersion: ASAAS_PRIVACY_POLICY_REFERENCE,
            contentReference: ASAAS_PRIVACY_POLICY_REFERENCE,
            contentHash: ASAAS_PRIVACY_POLICY_HASH,
            metadata,
        }),
        insertFinancialAcceptance({
            userId: values.userId,
            financialAccountId: values.financialAccountId,
            acceptanceType: "financial_onboarding_bundle",
            flowOrigin,
            contentVersion: NEUROFINANCE_TERMS_VERSION,
            contentReference: `${NEUROFINANCE_TERMS_VERSION}|${ASAAS_TERMS_REFERENCE}|${ASAAS_PRIVACY_POLICY_REFERENCE}`,
            contentHash: `${NEUROFINANCE_TERMS_HASH}|${ASAAS_TERMS_HASH}|${ASAAS_PRIVACY_POLICY_HASH}`,
            metadata,
        }),
    ]);

    const { error: updateError } = await supabaseAdmin
        .from("financial_accounts")
        .update({
            tos_accepted_at: new Date().toISOString(),
            neuronex_terms_version: NEUROFINANCE_TERMS_VERSION,
            asaas_terms_reference: ASAAS_TERMS_REFERENCE,
            asaas_privacy_policy_reference: ASAAS_PRIVACY_POLICY_REFERENCE,
            updated_at: new Date().toISOString(),
        })
        .eq("id", values.financialAccountId);
    if (updateError) throw updateError;
}

export async function recordPixRandomKeyConsent(values: {
    userId: string;
    financialAccountId: string;
    flowOrigin?: string;
    metadata?: Record<string, unknown>;
}) {
    await insertFinancialAcceptance({
        userId: values.userId,
        financialAccountId: values.financialAccountId,
        acceptanceType: "pix_random_key_consent",
        flowOrigin: values.flowOrigin || "pix_random_key_create",
        contentVersion: "pix-random-key-consent-2026-06-30",
        contentReference: "pix-random-key-consent-2026-06-30",
        contentHash: "pix-random-key-consent-2026-06-30",
        metadata: {
            source: "server_side_pix_consent",
            ...values.metadata,
        },
    });

    const { error: updateError } = await supabaseAdmin
        .from("financial_accounts")
        .update({
            pix_key_consent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("id", values.financialAccountId);
    if (updateError) throw updateError;
}

export function normalizeAccountNumber(account?: string | null, digit?: string | null) {
    const rawAccount = sanitizeDigits(account);
    const explicitDigit = sanitizeDigits(digit).slice(0, 1);

    if (explicitDigit) {
        return {
            account: rawAccount,
            accountDigit: explicitDigit,
            accountDisplay: `${rawAccount}${explicitDigit}`,
        };
    }

    if (rawAccount.length <= 1) {
        return {
            account: rawAccount,
            accountDigit: "",
            accountDisplay: rawAccount,
        };
    }

    return {
        account: rawAccount.slice(0, -1),
        accountDigit: rawAccount.slice(-1),
        accountDisplay: rawAccount,
    };
}

// ─────────────────────────────────────────────────────────────
// Asaas REST API v3 HTTP Client
// ─────────────────────────────────────────────────────────────

/**
 * Generic HTTP request to Asaas API v3.
 * Uses the MAIN account API key by default.
 * Pass `apiKey` to use a subconta's key.
 */
export async function asaasRequest<T = unknown>(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: Record<string, unknown> | FormData,
    apiKey?: string
): Promise<T> {
    const key = apiKey || ASAAS_API_KEY;
    const headers: Record<string, string> = {
        access_token: key,
        "User-Agent": ASAAS_USER_AGENT,
    };

    let fetchBody: string | FormData | undefined;

    if (body instanceof FormData) {
        fetchBody = body;
        // Let fetch set Content-Type with boundary for FormData
    } else if (body) {
        headers["Content-Type"] = "application/json";
        fetchBody = JSON.stringify(body);
    }

    const url = `${ASAAS_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    console.log(`[asaas-client] ${method} ${url}`);

    const res = await fetch(url, {
        method,
        headers,
        body: fetchBody,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const errors = data?.errors;
        const msg =
            errors?.[0]?.description ||
            data?.message ||
            `Asaas API error (${res.status})`;
        console.error(`[asaas-client] Error: ${msg}`, data);
        const err: any = new Error(msg);
        err.raw = data;
        err.status = res.status;
        throw err;
    }

    return data as T;
}

// ─────────────────────────────────────────────────────────────
// Asaas Subconta (White-Label accounts)
// ─────────────────────────────────────────────────────────────

export interface AsaasSubAccount {
    id: string;
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    postalCode?: string;
    city?: number;
    state?: string;
    country?: string;
    apiKey: string;
    walletId: string;
    accountNumber?: {
        agency: string;
        account: string;
        accountDigit: string;
    };
    onboardingUrl?: string;
}

export interface AsaasAccountStatus {
    id: string;
    commercialInfoStatus: string;   // APPROVED, PENDING, REJECTED, etc.
    bankAccountInfoStatus: string;
    documentStatus: string;
    billingInfoStatus?: string;
    generalStatus: string;          // APPROVED, PENDING, REJECTED, etc.
    raw?: Record<string, unknown>;
}

export const ASAAS_ACCOUNT_STATUS_EVENTS = [
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
    "ACCOUNT_STATUS_DOCUMENT_APPROVED",
    "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_DOCUMENT_PENDING",
    "ACCOUNT_STATUS_DOCUMENT_REJECTED",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED",
];

export const ASAAS_OPERATIONAL_WEBHOOK_EVENTS = [
    "PAYMENT_AUTHORIZED",
    "PAYMENT_AWAITING_RISK_ANALYSIS",
    "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
    "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
    "PAYMENT_CREATED",
    "PAYMENT_UPDATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_ANTICIPATED",
    "PAYMENT_OVERDUE",
    "PAYMENT_DELETED",
    "PAYMENT_RESTORED",
    "PAYMENT_REFUNDED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_REFUND_DENIED",
    "PAYMENT_RECEIVED_IN_CASH_UNDONE",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
    "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
    "PAYMENT_DUNNING_REQUESTED",
    "PAYMENT_DUNNING_RECEIVED",
    "PAYMENT_BANK_SLIP_CANCELLED",
    "PAYMENT_BANK_SLIP_VIEWED",
    "PAYMENT_CHECKOUT_VIEWED",
    "PAYMENT_SPLIT_CANCELLED",
    "PAYMENT_SPLIT_DIVERGENCE_BLOCK",
    "PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED",
    "INVOICE_CREATED",
    "INVOICE_UPDATED",
    "INVOICE_SYNCHRONIZED",
    "INVOICE_AUTHORIZED",
    "INVOICE_PROCESSING_CANCELLATION",
    "INVOICE_CANCELED",
    "INVOICE_CANCELLATION_DENIED",
    "INVOICE_ERROR",
    "TRANSFER_CREATED",
    "TRANSFER_PENDING",
    "TRANSFER_IN_BANK_PROCESSING",
    "TRANSFER_BLOCKED",
    "TRANSFER_DONE",
    "TRANSFER_FAILED",
    "TRANSFER_CANCELLED",
    "BILL_CREATED",
    "BILL_PENDING",
    "BILL_BANK_PROCESSING",
    "BILL_PAID",
    "BILL_CANCELLED",
    "BILL_FAILED",
    "BILL_REFUNDED",
    "RECEIVABLE_ANTICIPATION_PENDING",
    "RECEIVABLE_ANTICIPATION_SCHEDULED",
    "RECEIVABLE_ANTICIPATION_CREDITED",
    "RECEIVABLE_ANTICIPATION_DEBITED",
    "RECEIVABLE_ANTICIPATION_DENIED",
    "RECEIVABLE_ANTICIPATION_CANCELLED",
    "RECEIVABLE_ANTICIPATION_OVERDUE",
    "MOBILE_PHONE_RECHARGE_PENDING",
    "MOBILE_PHONE_RECHARGE_CANCELLED",
    "MOBILE_PHONE_RECHARGE_CONFIRMED",
    "MOBILE_PHONE_RECHARGE_REFUNDED",
    ...ASAAS_ACCOUNT_STATUS_EVENTS,
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED",
    "SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK",
    "SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED",
    "SUBSCRIPTION_SPLIT_DISABLED",
    "CHECKOUT_CREATED",
    "CHECKOUT_CANCELED",
    "CHECKOUT_EXPIRED",
    "CHECKOUT_PAID",
    "BALANCE_VALUE_BLOCKED",
    "BALANCE_VALUE_UNBLOCKED",
    "INTERNAL_TRANSFER_CREDIT",
    "INTERNAL_TRANSFER_DEBIT",
    "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED",
    "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED",
    "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED",
    "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED",
    "PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED",
    "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED",
    "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED",
    "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED",
    "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED",
    "PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED",
];

function buildDefaultWebhookConfig() {
    if (!ASAAS_WEBHOOK_URL) return undefined;

    return {
        name: `NeuroNex ${ASAAS_ENV === "production" ? "Produção" : "Sandbox"}`,
        url: ASAAS_WEBHOOK_URL,
        email: Deno.env.get("ASAAS_WEBHOOK_EMAIL")?.trim() || "webhooks@neuronex.app",
        sendType: "SEQUENTIALLY",
        interrupted: false,
        enabled: true,
        apiVersion: 3,
        ...(ASAAS_WEBHOOK_TOKEN ? { authToken: ASAAS_WEBHOOK_TOKEN } : {}),
        events: ASAAS_OPERATIONAL_WEBHOOK_EVENTS,
    };
}

export async function ensureAsaasOperationalWebhook(apiKey: string) {
    const config = buildDefaultWebhookConfig();
    if (!config) return { configured: false, reason: "missing_webhook_url" };

    const result = await asaasRequest<{ data?: Array<Record<string, any>> }>(
        "/webhooks?limit=100&offset=0",
        "GET",
        undefined,
        apiKey,
    );
    const existing = (result.data || []).find((webhook) => webhook.url === config.url);
    const missingEvents = existing
        ? config.events.filter((event) => !Array.isArray(existing.events) || !existing.events.includes(event))
        : config.events;

    if (existing && missingEvents.length === 0 && existing.enabled !== false && existing.interrupted !== true) {
        return { configured: true, updated: false, backoffRemoved: false, webhookId: existing.id };
    }

    const payload = existing
        ? {
            name: config.name,
            url: config.url,
            sendType: config.sendType,
            enabled: true,
            interrupted: false,
            ...(ASAAS_WEBHOOK_TOKEN ? { authToken: ASAAS_WEBHOOK_TOKEN } : {}),
            events: config.events,
        }
        : config;
    const webhook = await asaasRequest<Record<string, unknown>>(
        existing ? `/webhooks/${existing.id}` : "/webhooks",
        existing ? "PUT" : "POST",
        payload,
        apiKey,
    );

    if (existing?.id && existing.interrupted === true) {
        await asaasRequest<Record<string, unknown>>(
            `/webhooks/${existing.id}/removeBackoff`,
            "POST",
            {},
            apiKey,
        );
    }

    return {
        configured: true,
        updated: Boolean(existing),
        backoffRemoved: existing?.interrupted === true,
        webhookId: (webhook as any)?.id || existing?.id || null,
    };
}

/**
 * Create a new subconta (white-label) for a psychologist.
 */
export async function createAsaasSubAccount(params: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    postalCode?: string;
    city?: number;
    state?: string;
    birthDate?: string; // YYYY-MM-DD
    companyType?: string;
    incomeValue?: number;
}): Promise<AsaasSubAccount> {
    const webhook = buildDefaultWebhookConfig();
    return asaasRequest<AsaasSubAccount>("/accounts", "POST", {
        ...params,
        ...(webhook ? { webhooks: [webhook] } : {}),
    } as any);
}

/**
 * Search for an existing subconta by email using the MAIN account API key.
 * This allows discovering subaccounts created outside the app.
 */
export async function findAsaasSubAccountByEmail(
    email: string
): Promise<AsaasSubAccount | null> {
    try {
        const result = await asaasRequest<{ data: AsaasSubAccount[] }>(
            `/accounts?email=${encodeURIComponent(email)}`,
            "GET"
        );
        if (result.data && result.data.length > 0) {
            return result.data[0];
        }
        return null;
    } catch (err) {
        console.warn("[asaas-client] findAsaasSubAccountByEmail error:", err);
        return null;
    }
}

/**
 * Search for an existing subconta by CPF/CNPJ using the MAIN account API key.
 */
export async function findAsaasSubAccountByCpfCnpj(
    cpfCnpj: string
): Promise<AsaasSubAccount | null> {
    try {
        const digits = sanitizeDigits(cpfCnpj);
        if (!digits) return null;
        const result = await asaasRequest<{ data: AsaasSubAccount[] }>(
            `/accounts?cpfCnpj=${digits}`,
            "GET"
        );
        if (result.data && result.data.length > 0) {
            return result.data[0];
        }
        return null;
    } catch (err) {
        console.warn("[asaas-client] findAsaasSubAccountByCpfCnpj error:", err);
        return null;
    }
}

/**
 * Retrieve subconta status for onboarding/KYC.
 * Uses the subconta's own API key.
 */
export async function getAsaasAccountStatus(
    subAccountApiKey: string
): Promise<AsaasAccountStatus> {
    const rawStatus = await asaasRequest<Record<string, unknown>>(
        "/myAccount/status",
        "GET",
        undefined,
        subAccountApiKey
    );
    return normalizeAsaasAccountStatusPayload(rawStatus);
}

/**
 * Get pending documents for subconta onboarding.
 */
export async function getAsaasPendingDocuments(
    subAccountApiKey: string
): Promise<any> {
    return asaasRequest(
        "/myAccount/documents?status=NOT_SENT&status=PENDING",
        "GET",
        undefined,
        subAccountApiKey
    );
}

/**
 * Get subconta balance.
 */
export interface AsaasBalance {
    balance: number;  // in R$ (not centavos!)
}

export async function getAsaasBalance(
    subAccountApiKey: string
): Promise<AsaasBalance> {
    return asaasRequest<AsaasBalance>(
        "/finance/balance",
        "GET",
        undefined,
        subAccountApiKey
    );
}

/**
 * Get financial transactions (statement).
 */
export async function getAsaasFinancialTransactions(
    subAccountApiKey: string,
    params?: {
        startDate?: string;
        finishDate?: string;
        offset?: number;
        limit?: number;
    }
): Promise<any> {
    const query = new URLSearchParams();
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.finishDate) query.set("finishDate", params.finishDate);
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();

    return asaasRequest(
        `/financialTransactions${qs ? `?${qs}` : ""}`,
        "GET",
        undefined,
        subAccountApiKey
    );
}

/**
 * List charges from a subaccount. Webhooks remain the source for continuous
 * updates; this endpoint is used for reconciliation and dashboard snapshots.
 */
export async function getAsaasPayments(
    subAccountApiKey: string,
    params?: {
        offset?: number;
        limit?: number;
        status?: string;
        dateCreatedFrom?: string;
        dateCreatedTo?: string;
        paymentDateFrom?: string;
        paymentDateTo?: string;
    }
): Promise<any> {
    const query = new URLSearchParams();
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    if (params?.dateCreatedFrom) query.set("dateCreated[ge]", params.dateCreatedFrom);
    if (params?.dateCreatedTo) query.set("dateCreated[le]", params.dateCreatedTo);
    if (params?.paymentDateFrom) query.set("paymentDate[ge]", params.paymentDateFrom);
    if (params?.paymentDateTo) query.set("paymentDate[le]", params.paymentDateTo);

    return asaasRequest(
        `/payments?${query.toString()}`,
        "GET",
        undefined,
        subAccountApiKey
    );
}

export async function getAsaasTransfers(
    subAccountApiKey: string,
    params?: {
        offset?: number;
        limit?: number;
        dateCreatedFrom?: string;
        dateCreatedTo?: string;
    }
): Promise<any> {
    const query = new URLSearchParams();
    if (params?.offset !== undefined) query.set("offset", String(params.offset));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.dateCreatedFrom) query.set("dateCreated[ge]", params.dateCreatedFrom);
    if (params?.dateCreatedTo) query.set("dateCreated[le]", params.dateCreatedTo);

    return asaasRequest(
        `/transfers?${query.toString()}`,
        "GET",
        undefined,
        subAccountApiKey
    );
}

// ─────────────────────────────────────────────────────────────
// Asaas Payments (Cobranças)
// ─────────────────────────────────────────────────────────────

export type AsaasBillingType =
    | "BOLETO"
    | "CREDIT_CARD"
    | "PIX"
    | "UNDEFINED"; // customer chooses

export interface AsaasPaymentCreate {
    customer: string; // Asaas customer ID
    billingType: AsaasBillingType;
    value: number; // in R$ (e.g. 150.00)
    dueDate: string; // YYYY-MM-DD
    description?: string;
    externalReference?: string;
    installmentCount?: number;
    installmentValue?: number;
    discount?: {
        value: number;
        dueDateLimitDays: number;
        type: "FIXED" | "PERCENTAGE";
    };
    interest?: { value: number };
    fine?: { value: number; type: "FIXED" | "PERCENTAGE" };
    postalService?: boolean;
    split?: Array<{
        walletId: string;
        fixedValue?: number;
        percentualValue?: number;
    }>;
}

export interface AsaasPaymentResponse {
    id: string;
    customer: string;
    billingType: string;
    value: number;
    netValue: number;
    status: string; // PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc.
    description?: string;
    externalReference?: string;
    invoiceUrl: string;
    bankSlipUrl?: string;
    transactionReceiptUrl?: string;
    dueDate: string;
    paymentDate?: string;
    confirmedDate?: string;
    originalDueDate?: string;
    pixTransaction?: {
        qrCode?: {
            encodedImage: string;
            payload: string;
            expirationDate: string;
        };
    };
    nossoNumero?: string;
    deleted: boolean;
    dateCreated: string;
}

/**
 * Create a payment (cobrança) on a subconta.
 * First ensures the customer exists in Asaas (creates if needed).
 */
export async function createAsaasPayment(
    subAccountApiKey: string,
    params: AsaasPaymentCreate
): Promise<AsaasPaymentResponse> {
    return asaasRequest<AsaasPaymentResponse>(
        "/payments",
        "POST",
        params as any,
        subAccountApiKey
    );
}

/**
 * Get QR Code for a Pix payment.
 */
export async function getAsaasPixQrCode(
    subAccountApiKey: string,
    paymentId: string
): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
    return asaasRequest(
        `/payments/${paymentId}/pixQrCode`,
        "GET",
        undefined,
        subAccountApiKey
    );
}

/**
 * Refund a payment.
 */
export async function refundAsaasPayment(
    subAccountApiKey: string,
    paymentId: string,
    value?: number
): Promise<any> {
    const body: Record<string, unknown> = {};
    if (value !== undefined) body.value = value;
    return asaasRequest(
        `/payments/${paymentId}/refund`,
        "POST",
        Object.keys(body).length > 0 ? body : undefined,
        subAccountApiKey
    );
}

// ─────────────────────────────────────────────────────────────
// Asaas Customers (Clientes da subconta)
// ─────────────────────────────────────────────────────────────

export interface AsaasCustomer {
    id: string;
    name: string;
    email?: string;
    cpfCnpj: string;
    phone?: string;
    mobilePhone?: string;
    externalReference?: string;
}

export async function findOrCreateAsaasCustomer(
    subAccountApiKey: string,
    params: {
        name: string;
        cpfCnpj: string;
        email?: string;
        phone?: string;
        externalReference?: string;
    }
): Promise<AsaasCustomer> {
    // Try to find by cpfCnpj first
    const cpf = sanitizeDigits(params.cpfCnpj);
    if (cpf) {
        const existing = await asaasRequest<{ data: AsaasCustomer[] }>(
            `/customers?cpfCnpj=${cpf}`,
            "GET",
            undefined,
            subAccountApiKey
        );
        if (existing.data && existing.data.length > 0) {
            return existing.data[0];
        }
    }

    // Try by external reference
    if (params.externalReference) {
        const existing = await asaasRequest<{ data: AsaasCustomer[] }>(
            `/customers?externalReference=${params.externalReference}`,
            "GET",
            undefined,
            subAccountApiKey
        );
        if (existing.data && existing.data.length > 0) {
            return existing.data[0];
        }
    }

    const createPayload: Record<string, unknown> = {
        name: params.name,
        email: params.email,
        phone: params.phone,
        externalReference: params.externalReference,
    };

    if (cpf) {
        createPayload.cpfCnpj = cpf;
    } else if (ASAAS_ENV === "sandbox") {
        createPayload.cpfCnpj = "00000000000";
    }

    // Create new customer
    return asaasRequest<AsaasCustomer>(
        "/customers",
        "POST",
        createPayload,
        subAccountApiKey
    );
}

// ─────────────────────────────────────────────────────────────
// Asaas Transfers (Saques / Payouts)
// ─────────────────────────────────────────────────────────────

export interface AsaasTransferResponse {
    id: string;
    value: number;
    status: string; // PENDING, BANK_PROCESSING, DONE, FAILED, CANCELLED
    transferFee: number;
    dateCreated: string;
    scheduleDate?: string;
    transactionReceiptUrl?: string;
}

/**
 * Transfer to bank account (payout).
 */
export async function createAsaasTransfer(
    subAccountApiKey: string,
    params: {
        value: number; // R$
        bankAccount?: {
            bank: { code: string };
            accountName: string;
            ownerName: string;
            cpfCnpj: string;
            agency: string;
            account: string;
            accountDigit: string;
            bankAccountType: "CONTA_CORRENTE" | "CONTA_POUPANCA";
        };
        operationType: "PIX" | "TED" | "INTERNAL";
        pixAddressKey?: string;
        pixAddressKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
        description?: string;
        externalReference?: string;
    }
): Promise<AsaasTransferResponse> {
    return asaasRequest<AsaasTransferResponse>(
        "/transfers",
        "POST",
        params as any,
        subAccountApiKey
    );
}

// ─────────────────────────────────────────────────────────────
// Asaas Payment Links
// ─────────────────────────────────────────────────────────────

export async function createAsaasPaymentLink(
    subAccountApiKey: string,
    params: {
        name: string;
        description?: string;
        value: number;
        billingType: AsaasBillingType;
        chargeType: "DETACHED" | "RECURRENT" | "INSTALLMENT";
        dueDateLimitDays?: number;
        maxInstallmentCount?: number;
    }
): Promise<any> {
    return asaasRequest(
        "/paymentLinks",
        "POST",
        params as any,
        subAccountApiKey
    );
}

// ─────────────────────────────────────────────────────────────
// Financial account state (DB helpers)
// ─────────────────────────────────────────────────────────────

export type FinancialUiStatus =
    | "not_started"
    | "onboarding"
    | "pending_review"
    | "restricted"
    | "active"
    | "account_missing"
    | "disabled";

/**
 * Normalize the account status payload returned by Asaas.
 * Asaas currently documents commercialInfo, bankAccountInfo, documentation and general.
 * The boleto/billing stage is kept as a NeuroNex UI stage and marked approved when
 * the general approval is approved, because the public status endpoint may not expose it.
 */
function normalizeProviderStatus(value: unknown, fallback = "PENDING") {
    const normalized = String(value || fallback)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    return normalized || fallback;
}

function getStatusTone(status: string) {
    if (status === "APPROVED") return "approved";
    if (["REJECTED", "DENIED", "EXPIRED"].includes(status)) return "rejected";
    if (status === "AWAITING_APPROVAL") return "review";
    if (["PENDING", "EXPIRING_SOON", "AWAITING_ACTION_AUTHORIZATION"].includes(status)) return "pending";
    if (status === "NOT_SENT") return "missing";
    return "neutral";
}

function isActionableStatus(status: string, tone: string) {
    return (
        tone === "rejected" ||
        tone === "missing" ||
        ["PENDING", "AWAITING_ACTION_AUTHORIZATION", "EXPIRING_SOON", "EXPIRED"].includes(status)
    );
}

export function normalizeAsaasAccountStatusPayload(accountStatus: any): AsaasAccountStatus {
    const generalStatus = normalizeProviderStatus(
        accountStatus?.generalStatus ||
        accountStatus?.general ||
        accountStatus?.generalApprovalStatus
    );

    const billingStatus = accountStatus?.billingInfoStatus ||
        accountStatus?.billingInfo ||
        accountStatus?.bankSlipInfoStatus ||
        accountStatus?.bankSlipInfo ||
        accountStatus?.boletoInfoStatus ||
        accountStatus?.boletoInfo ||
        (generalStatus === "APPROVED" ? "APPROVED" : "UNKNOWN");

    const documentStatus = accountStatus?.documentStatus ||
        accountStatus?.documentationStatus ||
        accountStatus?.documentation ||
        accountStatus?.document ||
        accountStatus?.documents ||
        (generalStatus === "APPROVED" ? "APPROVED" : "PENDING");

    return {
        id: String(accountStatus?.id || ""),
        commercialInfoStatus: normalizeProviderStatus(
            accountStatus?.commercialInfoStatus ||
            accountStatus?.commercialInfo ||
            accountStatus?.commercial_info
        ),
        bankAccountInfoStatus: normalizeProviderStatus(
            accountStatus?.bankAccountInfoStatus ||
            accountStatus?.bankAccountInfo ||
            accountStatus?.bank_account_info
        ),
        documentStatus: normalizeProviderStatus(documentStatus),
        billingInfoStatus: normalizeProviderStatus(billingStatus, generalStatus === "APPROVED" ? "APPROVED" : "UNKNOWN"),
        generalStatus,
        raw: accountStatus || {},
    };
}

export function buildAsaasRequirementSnapshot(
    accountStatusInput: AsaasAccountStatus,
    source: "sync" | "webhook" | "onboarding" = "sync"
) {
    const accountStatus = normalizeAsaasAccountStatusPayload(accountStatusInput);
    const stageInputs = [
        ["general", "Aprovação geral do cadastro", accountStatus.generalStatus],
        ["commercial", "Dados comerciais", accountStatus.commercialInfoStatus],
        ["bank", "Dados bancários", accountStatus.bankAccountInfoStatus],
        ["billing", "Dados do boleto", accountStatus.billingInfoStatus],
        ["documents", "Documentos", accountStatus.documentStatus],
    ] as const;

    const stages = Object.fromEntries(stageInputs.map(([id, label, raw]) => {
        const providerStatus = normalizeProviderStatus(raw, id === "billing" ? "UNKNOWN" : "PENDING");
        const tone = getStatusTone(providerStatus);
        return [id, {
            label,
            provider_status: providerStatus,
            status: tone,
            status_label: providerStatus,
            actionable: isActionableStatus(providerStatus, tone),
        }];
    }));

    const values = Object.values(stages) as Array<{ provider_status: string; status: string; actionable: boolean }>;
    const allApproved = values.every((stage) => stage.status === "approved");
    const hasRejected = values.some((stage) => stage.status === "rejected");
    const hasActionable = values.some((stage) => stage.actionable);

    let uiStatus: FinancialUiStatus = "pending_review";
    if (allApproved) uiStatus = "active";
    else if (hasRejected) uiStatus = "restricted";
    else if (hasActionable) uiStatus = "onboarding";

    return {
        overall_status: uiStatus,
        ui_status: uiStatus,
        is_approved: allApproved,
        has_open_stages: !allApproved,
        has_actionable_stages: hasActionable,
        stages,
        raw: accountStatus.raw || accountStatusInput,
        source,
        synced_at: new Date().toISOString(),
    };
}

/**
 * Derive UI status from Asaas account status response.
 */
export function deriveUiStatusFromAsaasAccount(
    accountStatus: AsaasAccountStatus
): FinancialUiStatus {
    return buildAsaasRequirementSnapshot(accountStatus).ui_status as FinancialUiStatus;
}

export async function getFinancialAccount(userId: string) {
    const { data, error } = await supabaseAdmin
        .from("financial_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function getFinancialAccountByAsaasId(asaasAccountId: string) {
    const { data, error } = await supabaseAdmin
        .from("financial_accounts")
        .select("*")
        .eq("asaas_account_id", asaasAccountId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function upsertFinancialAccountRecord(
    userId: string,
    patch: Record<string, unknown>
) {
    const existing = await getFinancialAccount(userId);
    const pendingAsaasPrivateApiKey =
        typeof patch.asaasPrivateApiKey === "string" ? patch.asaasPrivateApiKey.trim() : "";
    const safePatch = { ...patch };
    delete safePatch.asaasPrivateApiKey;

    if (existing) {
        const { data, error } = await supabaseAdmin
            .from("financial_accounts")
            .update({
                ...safePatch,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select()
            .single();

        if (error) throw error;
        await storeAsaasAccountApiKey(data, pendingAsaasPrivateApiKey, "financial_account_upsert");
        return data;
    }

    const { data, error } = await supabaseAdmin
        .from("financial_accounts")
        .insert({
            user_id: userId,
            provider: "asaas",
            ...safePatch,
        })
        .select()
        .single();

    if (error) throw error;
    await storeAsaasAccountApiKey(data, pendingAsaasPrivateApiKey, "financial_account_upsert");
    return data;
}

export async function markFinancialAccountMissing(financialAccountId: string) {
    const { error } = await supabaseAdmin
        .from("financial_accounts")
        .update({
            status: "account_missing",
            charges_enabled: false,
            payouts_enabled: false,
            details_submitted: false,
            updated_at: new Date().toISOString(),
        })
        .eq("id", financialAccountId);

    if (error) throw error;
}

export async function syncFinancialAccountFromAsaas(
    financialAccountId: string,
    accountStatus: AsaasAccountStatus,
    source: "sync" | "webhook" | "onboarding" = "sync"
) {
    const requirementsSnapshot = buildAsaasRequirementSnapshot(accountStatus, source);
    const uiStatus = requirementsSnapshot.ui_status as FinancialUiStatus;
    const isActive = uiStatus === "active";
    const commercialStage = (requirementsSnapshot.stages as any)?.commercial;

    const payload: Record<string, unknown> = {
        status: uiStatus,
        asaas_environment: ASAAS_ENV,
        charges_enabled: isActive,
        payouts_enabled: isActive,
        details_submitted:
            commercialStage?.status !== "missing",
        requirements: requirementsSnapshot,
        last_balance_sync_at: new Date().toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
    };

    if (isActive) {
        payload.onboarding_completed_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
        .from("financial_accounts")
        .update(payload)
        .eq("id", financialAccountId);

    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Balance (from Asaas API — no local ledger)
// ─────────────────────────────────────────────────────────────

export async function getBalanceFromAsaas(
    subAccountApiKey: string
) {
    const balanceData = await getAsaasBalance(subAccountApiKey);

    // Asaas returns balance in R$ (reais), convert to centavos
    const availableCentavos = Math.round((balanceData.balance || 0) * 100);

    return { available: availableCentavos, pending: 0 };
}

// ─────────────────────────────────────────────────────────────
// Fees
// ─────────────────────────────────────────────────────────────

export function calculateFees(
    grossAmountCentavos: number,
    feePercent = 4.9,
    feeFixedCentavos = 50
) {
    const percentFee = Math.round((grossAmountCentavos * feePercent) / 100);
    const totalFee = percentFee + feeFixedCentavos;
    const netAmount = grossAmountCentavos - totalFee;

    return { totalFee, netAmount, percentFee, feeFixedCentavos };
}

// ─────────────────────────────────────────────────────────────
// Webhook auth validation
// ─────────────────────────────────────────────────────────────

export function validateAsaasWebhookToken(req: Request): boolean {
    if (!ASAAS_WEBHOOK_TOKEN) {
        console.error("[asaas-client] Missing ASAAS_WEBHOOK_TOKEN");
        return false;
    }
    const token = req.headers.get("asaas-access-token");
    return token === ASAAS_WEBHOOK_TOKEN;
}

// ─────────────────────────────────────────────────────────────
// Webhook idempotency (asaas_webhook_events)
// ─────────────────────────────────────────────────────────────

export async function isAsaasEventProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
        .from("asaas_webhook_events")
        .select("id,status")
        .eq("event_id", eventId)
        .maybeSingle();

    if (error) throw error;
    return data?.status === "processed";
}

export async function persistAsaasEvent(
    eventType: string,
    eventId: string,
    payload: unknown,
    details?: {
        asaasAccountId?: string | null;
        providerObjectId?: string | null;
        providerObjectType?: string | null;
    }
) {
    const { error } = await supabaseAdmin.from("asaas_webhook_events").insert({
        event_type: eventType,
        event_id: eventId,
        asaas_account_id: details?.asaasAccountId || null,
        provider_object_id: details?.providerObjectId || null,
        provider_object_type: details?.providerObjectType || null,
        payload: payload as any,
        status: "pending",
        event_received_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    });

    // Ignore unique violation (duplicate insert) — dedup handled by caller
    if (error && (error as any).code !== "23505") {
        throw error;
    }
}

export async function markAsaasEventProcessed(eventId: string) {
    const { error } = await supabaseAdmin
        .from("asaas_webhook_events")
        .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);
    if (error) throw error;
}

export async function markAsaasEventFailed(eventId: string, errorMessage?: string) {
    const { error } = await supabaseAdmin
        .from("asaas_webhook_events")
        .update({
            status: "failed",
            error_message: errorMessage || null,
            updated_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);
    if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Ledger helpers (internal accounting)
// ─────────────────────────────────────────────────────────────
