import {
    asaasRequest,
    corsResponse,
    errorResponse,
    getAuthenticatedUser,
    getFinancialAccount,
    getFinancialAccountAsaasApiKey,
    jsonResponse,
    recordPixRandomKeyConsent,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import { verifyFinancialPin } from "../_shared/financial-pin.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";
import { toNeurofinanceOperationError } from "../_shared/neurofinance-operation-error.ts";

type PixKeyDto = {
    id: string;
    key: string;
    type: string;
    status: string;
};

type ClaimedOperation = {
    id: string;
    status: string;
    request_fingerprint: string | null;
    provider_response: Record<string, unknown> | null;
};

function safePixKey(raw: unknown): PixKeyDto {
    const source = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};
    const id = String(source.id || source.key || source.pixAddressKey || source.addressKey || "");
    return {
        id,
        key: String(source.key || source.pixAddressKey || source.addressKey || id),
        type: String(source.type || source.keyType || "EVP"),
        status: String(source.status || (source.active === false ? "INACTIVE" : "ACTIVE")),
    };
}

async function sha256(value: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function idempotencyKeyOf(value: unknown) {
    const key = String(value || "").trim();
    return key.length >= 16 && key.length <= 160 ? key : null;
}

async function loadClaim(userId: string, operationType: string, idempotencyKey: string) {
    const { data, error } = await supabaseAdmin
        .from("neurofinance_baas_operations")
        .select("id,status,request_fingerprint,provider_response")
        .eq("user_id", userId)
        .eq("operation_type", operationType)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
    if (error) throw error;
    return data as ClaimedOperation | null;
}

async function claimOperation(params: {
    userId: string;
    accountId: string;
    operationType: string;
    idempotencyKey: string;
    fingerprint: string;
    payload?: Record<string, unknown>;
}) {
    const { data, error } = await supabaseAdmin
        .from("neurofinance_baas_operations")
        .insert({
            user_id: params.userId,
            financial_account_id: params.accountId,
            provider: "asaas",
            operation_type: params.operationType,
            idempotency_key: params.idempotencyKey,
            request_fingerprint: params.fingerprint,
            status: "submitting",
            payload: params.payload || {},
            provider_response: {},
            updated_at: new Date().toISOString(),
        })
        .select("id,status,request_fingerprint,provider_response")
        .single();

    if (!error) return { claim: data as ClaimedOperation, created: true };
    if (String(error.code || "") !== "23505") throw error;

    const existing = await loadClaim(params.userId, params.operationType, params.idempotencyKey);
    if (!existing) throw error;
    if (existing.request_fingerprint !== params.fingerprint) {
        return { conflict: "IDEMPOTENCY_KEY_REUSED" as const };
    }
    return { claim: existing, created: false };
}

async function completeClaim(id: string, status: string, providerResponse: unknown) {
    const safeResponse = providerResponse && typeof providerResponse === "object" && !Array.isArray(providerResponse)
        ? providerResponse as Record<string, unknown>
        : {};
    const { error } = await supabaseAdmin.from("neurofinance_baas_operations").update({
        status,
        provider_operation_id: String(safeResponse.id || "") || null,
        provider_response: safeResponse,
        updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) throw error;
}

async function failClaim(id: string, error: unknown) {
    const status = Number((error as { status?: unknown })?.status || 0);
    await supabaseAdmin.from("neurofinance_baas_operations").update({
        status: !status || status >= 500 ? "submission_unknown" : "failed",
        updated_at: new Date().toISOString(),
    }).eq("id", id);
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
        const action = String(body.action || "list_keys");
        const account = await getFinancialAccount(user.id);
        const apiKey = await getFinancialAccountAsaasApiKey(account);

        if (!account || !apiKey) {
            return errorResponse("Sua conta financeira ainda não está pronta para Pix.", 403, { code: "ACCOUNT_NOT_READY" });
        }

        if (action === "list_keys") {
            const result = await asaasRequest<Record<string, unknown>>("/pix/addressKeys?limit=100&offset=0", "GET", undefined, apiKey);
            const values = Array.isArray(result?.data) ? result.data : [];
            const keys = values.map(safePixKey).filter((key) => key.id && key.key);
            return jsonResponse({ success: true, keys, totalCount: keys.length });
        }

        if (action === "create_key" || action === "delete_key") {
            const idempotencyKey = idempotencyKeyOf(body.idempotencyKey || body.idempotency_key);
            if (!idempotencyKey) {
                return errorResponse("Não foi possível identificar esta tentativa com segurança. Tente novamente.", 400, {
                    code: "IDEMPOTENCY_KEY_REQUIRED",
                });
            }

            const pinResult = await verifyFinancialPin(user.id, String(body.pin || ""));
            if (!pinResult.isValid) {
                return errorResponse(pinResult.message || "PIN financeiro inválido.", 403, {
                    code: pinResult.code || "INVALID_PIN",
                });
            }

            const targetId = action === "delete_key"
                ? String(body.id || body.key || "").trim()
                : "EVP";
            if (action === "delete_key" && !targetId) {
                return errorResponse("Não encontramos a chave Pix para remover.", 400, { code: "PIX_KEY_REQUIRED" });
            }
            if (action === "create_key" && body.consent !== true) {
                return errorResponse("Confirme a criação da chave Pix antes de continuar.", 400, { code: "CONSENT_REQUIRED" });
            }

            const operationType = action === "create_key" ? "pix_key_create" : "pix_key_delete";
            const fingerprint = await sha256(`${operationType}:${targetId}`);
            const claimResult = await claimOperation({
                userId: user.id,
                accountId: account.id,
                operationType,
                idempotencyKey,
                fingerprint,
                payload: action === "delete_key" ? { target_hash: await sha256(targetId) } : { key_type: "EVP" },
            });

            if (claimResult.conflict) {
                return errorResponse("Esta confirmação já foi usada em outra operação.", 409, { code: claimResult.conflict });
            }
            const claim = claimResult.claim;
            if (!claim) throw new Error("PIX_OPERATION_CLAIM_FAILED");

            if (!claimResult.created && claim.status === "completed") {
                return action === "create_key"
                    ? jsonResponse({ success: true, replayed: true, key: safePixKey(claim.provider_response) })
                    : jsonResponse({ success: true, replayed: true, removed: true });
            }
            if (!claimResult.created && ["submitting", "submission_unknown"].includes(claim.status) && action === "create_key") {
                return errorResponse(
                    "A criação anterior ainda está em conferência. Aguarde a atualização antes de tentar outra chave.",
                    409,
                    { code: "PIX_KEY_RECONCILIATION_REQUIRED" },
                );
            }
            if (!claimResult.created && claim.status === "submitting") {
                return errorResponse("Esta operação já está sendo processada.", 409, { code: "OPERATION_IN_PROGRESS" });
            }
            if (!claimResult.created) {
                const { error } = await supabaseAdmin.from("neurofinance_baas_operations").update({
                    status: "submitting",
                    updated_at: new Date().toISOString(),
                }).eq("id", claim.id).in("status", ["failed", "submission_unknown"]);
                if (error) throw error;
            }

            try {
                if (action === "create_key") {
                    await recordPixRandomKeyConsent({
                        userId: user.id,
                        financialAccountId: account.id,
                        flowOrigin: "pix_random_key_create",
                        metadata: { endpoint: "asaas-pix", key_type: "EVP" },
                    });
                    const result = await asaasRequest<Record<string, unknown>>("/pix/addressKeys", "POST", { type: "EVP" }, apiKey);
                    await completeClaim(claim.id, "completed", result);
                    return jsonResponse({ success: true, key: safePixKey(result) });
                }

                let result: Record<string, unknown> = {};
                try {
                    result = await asaasRequest<Record<string, unknown>>(`/pix/addressKeys/${encodeURIComponent(targetId)}`, "DELETE", undefined, apiKey);
                } catch (error) {
                    if (Number((error as { status?: unknown })?.status || 0) !== 404 || claim.status !== "submission_unknown") throw error;
                    result = { id: targetId, status: "DELETED" };
                }
                await completeClaim(claim.id, "completed", result);
                return jsonResponse({ success: true, removed: true });
            } catch (error) {
                await failClaim(claim.id, error);
                throw error;
            }
        }

        if (action === "pay_qr_code") {
            return errorResponse("Consulte e confirme os dados do Pix com seu PIN antes de pagar.", 400, {
                code: "PIX_CONSULTATION_REQUIRED",
            });
        }

        return errorResponse("Esta ação Pix ainda não está disponível.", 400, { code: "UNSUPPORTED_PIX_ACTION" });
    } catch (error: unknown) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("asaas-pix error:", error);
        const operationError = toNeurofinanceOperationError(
            error,
            "Não conseguimos concluir a operação Pix agora. Tente novamente em instantes.",
        );
        return errorResponse(operationError.message, operationError.status, {
            code: operationError.code,
        });
    }
});
