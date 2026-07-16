import * as bcryptModule from "https://esm.sh/bcryptjs@2.4.3";

interface BcryptRuntime {
    compare(value: string, hash: string): Promise<boolean>;
}

const bcrypt = (bcryptModule as unknown as { default: BcryptRuntime }).default;

export type FinancialPinAttemptScope =
    | "pin_verify"
    | "pin_change"
    | "reset_code"
    | "reset_request"
    | "password_reauth";

export interface FinancialPinAttemptContext {
    ipHash?: string | null;
    idempotencyHash?: string | null;
}

export interface FinancialPinAttemptGate {
    allowed: boolean;
    replayed: boolean;
    attemptId: string | null;
    replayOutcome: "pending" | "success" | "failure" | "blocked" | null;
    replayReason: string | null;
    lockedUntil: string | null;
}

interface FinancialPinVerificationResult {
    isValid: boolean;
    code: string | null;
    message: string | null;
}

const UINT32_RANGE = 0x1_0000_0000;
const RESET_CODE_RANGE = 900_000;
const RESET_CODE_UNBIASED_LIMIT = UINT32_RANGE - (UINT32_RANGE % RESET_CODE_RANGE);

async function getSupabaseAdmin() {
    const { supabaseAdmin } = await import("./asaas-client.ts");
    return supabaseAdmin;
}

function asGate(value: unknown): FinancialPinAttemptGate {
    const candidate = Array.isArray(value) ? value[0] : value;
    const row = candidate && typeof candidate === "object"
        ? candidate as Record<string, unknown>
        : {};

    return {
        allowed: row.allowed === true,
        replayed: row.replayed === true,
        attemptId: typeof row.attemptId === "string" ? row.attemptId : null,
        replayOutcome: ["pending", "success", "failure", "blocked"].includes(String(row.replayOutcome || ""))
            ? String(row.replayOutcome) as FinancialPinAttemptGate["replayOutcome"]
            : null,
        replayReason: typeof row.replayReason === "string" ? row.replayReason : null,
        lockedUntil: typeof row.lockedUntil === "string" ? row.lockedUntil : null,
    };
}

function bytesToHex(bytes: Uint8Array) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestContext(value: string, secret?: string | null) {
    const encoder = new TextEncoder();
    if (secret) {
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );
        const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
        return bytesToHex(new Uint8Array(signature));
    }

    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
    return bytesToHex(new Uint8Array(digest));
}

function getTrustedRequestIp(req: Request) {
    const candidate = (
        req.headers.get("cf-connecting-ip")
        || req.headers.get("x-forwarded-for")?.split(",")[0]
        || req.headers.get("x-real-ip")
        || ""
    ).trim();

    return /^[0-9a-f:.]{3,64}$/i.test(candidate) ? candidate.toLowerCase() : null;
}

export function isValidFinancialPinFormat(pin?: string) {
    return typeof pin === "string" && /^\d{6}$/.test(pin);
}

export function generateFinancialPinResetCode(
    randomUint32: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0],
) {
    let sample: number;
    do {
        sample = randomUint32();
        if (!Number.isInteger(sample) || sample < 0 || sample >= UINT32_RANGE) {
            throw new Error("Secure random source returned an invalid value.");
        }
    } while (sample >= RESET_CODE_UNBIASED_LIMIT);

    return String(100_000 + (sample % RESET_CODE_RANGE));
}

export async function hashFinancialPinRequestIp(
    req: Request,
    secret = Deno.env.get("FINANCIAL_PIN_IP_HASH_SECRET")?.trim() || "",
) {
    const ip = getTrustedRequestIp(req);
    // An unhashed IPv4 address is enumerable. Without an independent server
    // secret, keep the per-user bucket and omit the IP dimension entirely.
    if (!ip || secret.length < 32) return null;
    return digestContext(`financial-pin-ip:v1:${ip}`, secret);
}

export async function hashFinancialPinIdempotencyKey(
    userId: string,
    scope: FinancialPinAttemptScope,
    rawKey?: string | null,
    secretOverride?: string | null,
) {
    const normalized = rawKey?.trim() || "";
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(normalized)) return null;

    const secret = secretOverride === undefined
        ? Deno.env.get("FINANCIAL_PIN_IDEMPOTENCY_SECRET")?.trim()
            || Deno.env.get("FINANCIAL_PIN_IP_HASH_SECRET")?.trim()
            || null
        : secretOverride;
    return digestContext(`financial-pin-idempotency:v1:${userId}:${scope}:${normalized}`, secret);
}

export async function beginFinancialPinAttempt(
    userId: string,
    scope: FinancialPinAttemptScope,
    context: FinancialPinAttemptContext = {},
) {
    const supabaseAdmin = await getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc("begin_financial_pin_attempt", {
        p_user_id: userId,
        p_scope: scope,
        p_ip_hash: context.ipHash || null,
        p_idempotency_hash: context.idempotencyHash || null,
    });
    if (error) throw error;
    return asGate(data);
}

export async function completeFinancialPinAttempt(
    userId: string,
    attemptId: string,
    success: boolean,
    reasonCode: string,
) {
    const supabaseAdmin = await getSupabaseAdmin();
    const normalizedReason = reasonCode.trim().toUpperCase();
    if (!/^[A-Z0-9_]{1,64}$/.test(normalizedReason)) {
        throw new Error("Invalid financial PIN audit reason.");
    }

    const { error } = await supabaseAdmin.rpc("complete_financial_pin_attempt", {
        p_user_id: userId,
        p_attempt_id: attemptId,
        p_success: success,
        p_reason_code: normalizedReason,
    });
    if (error) throw error;
}

export function financialPinGateFailure(gate: FinancialPinAttemptGate): FinancialPinVerificationResult {
    if (gate.replayed) {
        return {
            isValid: gate.replayOutcome === "success",
            code: gate.replayOutcome === "success" ? null : "PIN_OPERATION_ALREADY_PROCESSED",
            message: gate.replayOutcome === "success"
                ? null
                : "Esta operação já está sendo processada. Aguarde um instante.",
        };
    }

    return {
        isValid: false,
        code: "PIN_TEMPORARILY_LOCKED",
        message: "Muitas tentativas foram realizadas. Aguarde alguns minutos para tentar novamente.",
    };
}

export async function verifyFinancialPin(
    userId: string,
    pin?: string,
    context: FinancialPinAttemptContext = {},
): Promise<FinancialPinVerificationResult> {
    // Credential verification is intentionally never replayed from an
    // idempotency receipt: a prior successful PIN must not authorize a later
    // request carrying a different PIN.
    const gate = await beginFinancialPinAttempt(userId, "pin_verify", {
        ipHash: context.ipHash,
    });
    if (!gate.allowed || !gate.attemptId) return financialPinGateFailure(gate);

    const complete = (success: boolean, reasonCode: string) =>
        completeFinancialPinAttempt(userId, gate.attemptId as string, success, reasonCode);

    try {
        if (!isValidFinancialPinFormat(pin)) {
            await complete(false, "INVALID_PIN_FORMAT");
            return {
                isValid: false,
                code: "INVALID_PIN_FORMAT",
                message: "Digite o PIN de 6 dígitos.",
            };
        }

        const supabaseAdmin = await getSupabaseAdmin();
        const { data: settings, error } = await supabaseAdmin
            .from("user_financial_settings")
            .select("pin_hash")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) throw error;
        if (!settings?.pin_hash) {
            await complete(false, "PIN_NOT_CONFIGURED");
            return {
                isValid: false,
                code: "PIN_NOT_CONFIGURED",
                message: "Você ainda não configurou um PIN financeiro.",
            };
        }

        const isValid = await bcrypt.compare(pin as string, settings.pin_hash);
        await complete(isValid, isValid ? "PIN_VERIFIED" : "INVALID_PIN");

        if (isValid) {
            const now = new Date().toISOString();
            const { error: timestampError } = await supabaseAdmin
                .from("user_financial_settings")
                .update({ pin_last_verified_at: now, updated_at: now })
                .eq("user_id", userId);
            if (timestampError) {
                console.warn("[financial-pin] Successful validation timestamp could not be stored.");
            }
        }

        return {
            isValid,
            code: isValid ? null : "INVALID_PIN",
            message: isValid ? null : "PIN incorreto. Confira os números e tente novamente.",
        };
    } catch (error) {
        await complete(false, "PIN_VERIFICATION_ERROR").catch(() => undefined);
        throw error;
    }
}
