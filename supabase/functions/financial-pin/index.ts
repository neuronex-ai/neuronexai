import {
    corsResponse,
    errorResponse,
    getAuthenticatedUser,
    jsonResponse,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    beginFinancialPinAttempt,
    completeFinancialPinAttempt,
    financialPinGateFailure,
    generateFinancialPinResetCode,
    hashFinancialPinIdempotencyKey,
    hashFinancialPinRequestIp,
    isValidFinancialPinFormat,
    verifyFinancialPin,
    type FinancialPinAttemptGate,
    type FinancialPinAttemptScope,
} from "../_shared/financial-pin.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

import * as bcryptModule from "https://esm.sh/bcryptjs@2.4.3";

interface BcryptRuntime {
    compare(value: string, hash: string): Promise<boolean>;
    hash(value: string, saltRounds: number): Promise<string>;
}

interface FinancialSettings {
    pin_hash?: string | null;
    reset_token_hash?: string | null;
    reset_token_expires_at?: string | null;
    reset_attempts?: number | null;
}

const bcrypt = (bcryptModule as unknown as { default: BcryptRuntime }).default;

function lockedResponse(gate: FinancialPinAttemptGate) {
    const failure = financialPinGateFailure(gate);
    return errorResponse(
        failure.message || "Aguarde alguns minutos para tentar novamente.",
        gate.replayed ? 409 : 429,
        { code: failure.code || "PIN_TEMPORARILY_LOCKED" },
    );
}

async function beginScopedAttempt(
    userId: string,
    scope: FinancialPinAttemptScope,
    ipHash: string | null,
    rawIdempotencyKey?: string | null,
) {
    const idempotencyHash = await hashFinancialPinIdempotencyKey(
        userId,
        scope,
        rawIdempotencyKey,
    );
    return beginFinancialPinAttempt(userId, scope, { ipHash, idempotencyHash });
}

async function sendResetEmail(email: string, code: string) {
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("FINANCIAL_PIN_EMAIL_FROM")?.trim()
        || "NeuroNex <no-reply@neuronex.app>";

    if (!resendKey) {
        console.warn("[financial-pin] Reset email service is not configured.");
        return false;
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: email,
            subject: "Código para redefinir seu PIN financeiro",
            html: `
                <div style="font-family:Inter,Arial,sans-serif;color:#18181b;line-height:1.5">
                    <p>Use o código abaixo para redefinir seu PIN financeiro:</p>
                    <p style="font-size:28px;font-weight:800;letter-spacing:8px">${code}</p>
                    <p>Ele expira em 10 minutos. Se você não pediu isso, ignore este e-mail.</p>
                </div>
            `,
        }),
    });

    if (!res.ok) {
        console.error("[financial-pin] Reset email delivery failed.");
        return false;
    }

    return true;
}

async function verifyAccountPassword(email: string, password?: string) {
    if (!password || password.length < 6) return false;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/+$/, "") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim()
        || Deno.env.get("SUPABASE_ANON_PUBLIC_KEY")?.trim()
        || "";

    if (!supabaseUrl || !anonKey) {
        console.warn("[financial-pin] Password reauthentication is unavailable.");
        return false;
    }

    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
            apikey: anonKey,
        },
        body: JSON.stringify({ email, password }),
    });

    return res.ok;
}

async function verifyResetCode(
    userId: string,
    resetCode: string,
    settings: FinancialSettings,
    ipHash: string | null,
) {
    const gate = await beginScopedAttempt(userId, "reset_code", ipHash);
    if (!gate.allowed || !gate.attemptId) {
        return { authorized: false, expectedHash: null, gate };
    }

    const finish = (success: boolean, reason: string) =>
        completeFinancialPinAttempt(userId, gate.attemptId as string, success, reason);

    try {
        if (!isValidFinancialPinFormat(resetCode)) {
            await finish(false, "INVALID_RESET_CODE_FORMAT");
            return { authorized: false, expectedHash: null, gate: null };
        }

        if (!settings.reset_token_hash || !settings.reset_token_expires_at) {
            await finish(false, "RESET_CODE_UNAVAILABLE");
            return { authorized: false, expectedHash: null, gate: null };
        }

        if (new Date(settings.reset_token_expires_at).getTime() <= Date.now()) {
            await finish(false, "RESET_CODE_EXPIRED");
            return { authorized: false, expectedHash: null, gate: null };
        }

        const authorized = await bcrypt.compare(resetCode, settings.reset_token_hash);
        await finish(authorized, authorized ? "RESET_CODE_VERIFIED" : "INVALID_RESET_CODE");
        return {
            authorized,
            expectedHash: authorized ? settings.reset_token_hash : null,
            gate: null,
        };
    } catch (error) {
        await finish(false, "RESET_CODE_VERIFICATION_ERROR").catch(() => undefined);
        throw error;
    }
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
        const action = String(body.action || "verify");
        const ipHash = await hashFinancialPinRequestIp(req);

        const { data: settings, error: settingsError } = await supabaseAdmin
            .from("user_financial_settings")
            .select("pin_hash, reset_token_hash, reset_token_expires_at, reset_attempts")
            .eq("user_id", user.id)
            .maybeSingle();

        if (settingsError) throw settingsError;

        if (action === "verify") {
            const result = await verifyFinancialPin(user.id, body.pin, { ipHash });

            if (result.code === "INVALID_PIN_FORMAT") {
                return errorResponse(result.message || "Digite o PIN de 6 dígitos.", 400, {
                    code: result.code,
                });
            }
            if (["PIN_TEMPORARILY_LOCKED", "PIN_OPERATION_ALREADY_PROCESSED"].includes(String(result.code))) {
                return errorResponse(result.message || "Aguarde para tentar novamente.", 429, {
                    code: result.code,
                });
            }

            return jsonResponse({ success: true, isValid: result.isValid });
        }

        if (action === "set") {
            const gate = await beginScopedAttempt(
                user.id,
                "pin_change",
                ipHash,
            );
            if (!gate.allowed || !gate.attemptId) {
                if (gate.replayed && ["pending", "success"].includes(String(gate.replayOutcome))) {
                    return jsonResponse({ success: true, replayed: true });
                }
                return lockedResponse(gate);
            }

            let completed = false;
            const finish = async (success: boolean, reason: string) => {
                if (completed) return;
                await completeFinancialPinAttempt(user.id, gate.attemptId as string, success, reason);
                completed = true;
            };

            try {
                if (!isValidFinancialPinFormat(body.pin)) {
                    await finish(false, "INVALID_NEW_PIN_FORMAT");
                    return errorResponse("Escolha um PIN com 6 números.", 400, {
                        code: "INVALID_PIN_FORMAT",
                    });
                }

                const hasExistingPin = Boolean(settings?.pin_hash);
                let authorized = !hasExistingPin;
                let expectedResetTokenHash: string | null = null;
                let authWasRateLimited = false;

                const currentPin = String(body.current_pin || "");
                if (!authorized && currentPin) {
                    const currentPinResult = await verifyFinancialPin(user.id, currentPin, { ipHash });
                    authorized = currentPinResult.isValid;
                    authWasRateLimited = currentPinResult.code === "PIN_TEMPORARILY_LOCKED";
                }

                const resetCode = String(body.reset_code || "");
                if (!authorized && resetCode) {
                    const resetResult = await verifyResetCode(
                        user.id,
                        resetCode,
                        settings || {},
                        ipHash,
                    );
                    authorized = resetResult.authorized;
                    expectedResetTokenHash = resetResult.expectedHash;
                    authWasRateLimited = authWasRateLimited
                        || Boolean(resetResult.gate && !resetResult.gate.allowed);
                }

                if (!authorized && user.email && body.account_password) {
                    const passwordGate = await beginScopedAttempt(user.id, "password_reauth", ipHash);
                    if (!passwordGate.allowed || !passwordGate.attemptId) {
                        authWasRateLimited = true;
                    } else {
                        try {
                            const passwordAuthorized = await verifyAccountPassword(
                                user.email,
                                String(body.account_password),
                            );
                            await completeFinancialPinAttempt(
                                user.id,
                                passwordGate.attemptId,
                                passwordAuthorized,
                                passwordAuthorized ? "PASSWORD_REAUTHENTICATED" : "INVALID_ACCOUNT_PASSWORD",
                            );
                            authorized = passwordAuthorized;
                        } catch (error) {
                            await completeFinancialPinAttempt(
                                user.id,
                                passwordGate.attemptId,
                                false,
                                "PASSWORD_REAUTH_ERROR",
                            ).catch(() => undefined);
                            throw error;
                        }
                    }
                }

                if (!authorized) {
                    await finish(false, authWasRateLimited ? "AUTH_RATE_LIMITED" : "PIN_AUTH_REQUIRED");
                    if (authWasRateLimited) {
                        return errorResponse(
                            "Muitas tentativas foram realizadas. Aguarde alguns minutos para tentar novamente.",
                            429,
                            { code: "PIN_TEMPORARILY_LOCKED" },
                        );
                    }
                    return errorResponse(
                        "Confirme seu PIN atual ou use o código enviado para seu e-mail.",
                        403,
                        { code: "PIN_AUTH_REQUIRED" },
                    );
                }

                const pinHash = await bcrypt.hash(body.pin, 10);
                const { data: committed, error: commitError } = await supabaseAdmin.rpc(
                    "commit_financial_pin_change",
                    {
                        p_user_id: user.id,
                        p_pin_hash: pinHash,
                        p_expected_reset_token_hash: expectedResetTokenHash,
                    },
                );
                if (commitError) throw commitError;

                if (committed !== true) {
                    await finish(false, "RESET_CODE_ALREADY_USED");
                    return errorResponse(
                        "Este código já foi utilizado. Solicite um novo código para continuar.",
                        409,
                        { code: "RESET_CODE_ALREADY_USED" },
                    );
                }

                await finish(true, hasExistingPin ? "PIN_CHANGED" : "PIN_CREATED");
                return jsonResponse({ success: true });
            } catch (error) {
                await finish(false, "PIN_CHANGE_ERROR").catch(() => undefined);
                throw error;
            }
        }

        if (action === "request_reset") {
            if (!user.email) {
                return errorResponse("Não encontramos um e-mail para enviar o código.", 400, {
                    code: "EMAIL_UNAVAILABLE",
                });
            }

            const minuteBucket = Math.floor(Date.now() / 60_000);
            const rawIdempotencyKey = String(
                body.idempotency_key || `reset-request:${minuteBucket}`,
            );
            const gate = await beginScopedAttempt(
                user.id,
                "reset_request",
                ipHash,
                rawIdempotencyKey,
            );

            if (!gate.allowed || !gate.attemptId) {
                if (gate.replayed && ["pending", "success"].includes(String(gate.replayOutcome))) {
                    return jsonResponse({ success: true, replayed: true });
                }
                return lockedResponse(gate);
            }

            let completed = false;
            const finish = async (success: boolean, reason: string) => {
                if (completed) return;
                await completeFinancialPinAttempt(user.id, gate.attemptId as string, success, reason);
                completed = true;
            };

            try {
                const code = generateFinancialPinResetCode();
                const tokenHash = await bcrypt.hash(code, 10);
                const now = new Date();

                const { error: resetError } = await supabaseAdmin
                    .from("user_financial_settings")
                    .upsert({
                        user_id: user.id,
                        reset_token_hash: tokenHash,
                        reset_token_expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
                        reset_requested_at: now.toISOString(),
                        reset_attempts: Number(settings?.reset_attempts || 0) + 1,
                        updated_at: now.toISOString(),
                    }, { onConflict: "user_id" });
                if (resetError) throw resetError;

                const delivered = await sendResetEmail(user.email, code);
                if (!delivered) {
                    const { error: clearError } = await supabaseAdmin
                        .from("user_financial_settings")
                        .update({
                            reset_token_hash: null,
                            reset_token_expires_at: null,
                            reset_requested_at: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", user.id)
                        .eq("reset_token_hash", tokenHash);
                    if (clearError) {
                        console.warn("[financial-pin] Undelivered reset credential could not be cleared.");
                    }

                    await finish(false, "RESET_EMAIL_UNAVAILABLE");
                    return errorResponse(
                        "Não conseguimos enviar o código agora. Tente novamente em alguns instantes.",
                        503,
                        { code: "RESET_EMAIL_UNAVAILABLE" },
                    );
                }

                await finish(true, "RESET_CODE_SENT");
                return jsonResponse({ success: true });
            } catch (error) {
                await finish(false, "RESET_REQUEST_ERROR").catch(() => undefined);
                throw error;
            }
        }

        return errorResponse("Ação de PIN não suportada.", 400, {
            code: "UNSUPPORTED_ACTION",
        });
    } catch (error: unknown) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error(
            "[financial-pin] Operation failed:",
            error instanceof Error ? error.name : "UnknownError",
        );
        const status = typeof error === "object" && error && "status" in error
            ? Number((error as { status?: unknown }).status) || 500
            : 500;
        return errorResponse(
            "Não conseguimos validar sua assinatura digital agora.",
            status,
            { code: "PIN_OPERATION_FAILED" },
        );
    }
});
