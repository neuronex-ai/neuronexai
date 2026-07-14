import {
    corsResponse,
    errorResponse,
    getAuthenticatedUser,
    jsonResponse,
    supabaseAdmin,
} from "../_shared/asaas-client.ts";
import {
    requireEntitlementForUser,
    subscriptionAccessErrorResponse,
} from "../_shared/subscription-access.ts";

import * as bcryptModule from "https://esm.sh/bcryptjs@2.4.3";

interface BcryptRuntime {
    compare(value: string, hash: string): Promise<boolean>;
    hash(value: string, saltRounds: number): Promise<string>;
}

const bcrypt = (bcryptModule as unknown as { default: BcryptRuntime }).default;

function isValidPin(pin?: string) {
    return typeof pin === "string" && /^\d{6}$/.test(pin);
}

function generateResetCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendResetEmail(email: string, code: string) {
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("FINANCIAL_PIN_EMAIL_FROM")?.trim() || "NeuroNex <no-reply@neuronex.app>";

    if (!resendKey) {
        console.warn("[financial-pin] RESEND_API_KEY not configured. Reset code generated but not delivered.");
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
        const body = await res.text().catch(() => "");
        console.error("[financial-pin] Failed to send reset email:", body);
        return false;
    }

    return true;
}

async function verifyAccountPassword(email: string, password?: string) {
    if (!password || password.length < 6) return false;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/+$/, "") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || Deno.env.get("SUPABASE_ANON_PUBLIC_KEY")?.trim() || "";

    if (!supabaseUrl || !anonKey) {
        console.warn("[financial-pin] Missing Supabase public key for password reauthentication.");
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

        const { data: settings, error: settingsError } = await supabaseAdmin
            .from("user_financial_settings")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (settingsError) throw settingsError;

        if (action === "verify") {
            if (!isValidPin(body.pin)) {
                return errorResponse("Digite o PIN de 6 dígitos.", 400, { code: "INVALID_PIN_FORMAT" });
            }

            if (!settings?.pin_hash) {
                return errorResponse("Você ainda não configurou um PIN financeiro.", 404, { code: "PIN_NOT_CONFIGURED" });
            }

            const isValid = await bcrypt.compare(body.pin, settings.pin_hash);
            if (isValid) {
                await supabaseAdmin
                    .from("user_financial_settings")
                    .update({ pin_last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq("user_id", user.id);
            }

            return jsonResponse({ success: true, isValid });
        }

        if (action === "set") {
            if (!isValidPin(body.pin)) {
                return errorResponse("Escolha um PIN com 6 números.", 400, { code: "INVALID_PIN_FORMAT" });
            }

            const hasExistingPin = Boolean(settings?.pin_hash);

            if (hasExistingPin) {
                const currentPin = String(body.current_pin || "");
                const resetCode = String(body.reset_code || "");
                let authorized = false;

                if (isValidPin(currentPin)) {
                    authorized = await bcrypt.compare(currentPin, settings.pin_hash);
                }

                if (!authorized && resetCode && settings?.reset_token_hash && settings?.reset_token_expires_at) {
                    const notExpired = new Date(settings.reset_token_expires_at).getTime() > Date.now();
                    authorized = notExpired && await bcrypt.compare(resetCode, settings.reset_token_hash);
                }

                if (!authorized && user.email && body.account_password) {
                    authorized = await verifyAccountPassword(user.email, String(body.account_password));
                }

                if (!authorized) {
                    return errorResponse("Confirme seu PIN atual ou use o código enviado para seu e-mail.", 403, { code: "PIN_AUTH_REQUIRED" });
                }
            }

            const pinHash = await bcrypt.hash(body.pin, 10);
            await supabaseAdmin
                .from("user_financial_settings")
                .upsert({
                    user_id: user.id,
                    pin_hash: pinHash,
                    reset_token_hash: null,
                    reset_token_expires_at: null,
                    reset_requested_at: null,
                    reset_attempts: 0,
                    pin_updated_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            return jsonResponse({ success: true });
        }

        if (action === "request_reset") {
            if (!user.email) {
                return errorResponse("Não encontramos um e-mail para enviar o código.", 400, { code: "EMAIL_UNAVAILABLE" });
            }

            const code = generateResetCode();
            const tokenHash = await bcrypt.hash(code, 10);

            await supabaseAdmin
                .from("user_financial_settings")
                .upsert({
                    user_id: user.id,
                    reset_token_hash: tokenHash,
                    reset_token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                    reset_requested_at: new Date().toISOString(),
                    reset_attempts: (settings?.reset_attempts || 0) + 1,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "user_id" });

            const delivered = await sendResetEmail(user.email, code);
            if (!delivered) {
                return errorResponse("Não conseguimos enviar o código agora. Tente novamente em alguns instantes.", 503, { code: "RESET_EMAIL_UNAVAILABLE" });
            }

            return jsonResponse({ success: true });
        }

        return errorResponse("Ação de PIN não suportada.", 400, { code: "UNSUPPORTED_ACTION" });
    } catch (error: any) {
        const accessResponse = subscriptionAccessErrorResponse(error);
        if (accessResponse) return accessResponse;
        console.error("[financial-pin] error:", error);
        return errorResponse("Não conseguimos validar sua assinatura digital agora.", error?.status || 500, { code: "PIN_OPERATION_FAILED" });
    }
});
