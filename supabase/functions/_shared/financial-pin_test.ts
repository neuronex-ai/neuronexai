import {
    assertEquals,
    assertMatch,
    assertNotEquals,
} from "jsr:@std/assert@1";

import {
    financialPinGateFailure,
    generateFinancialPinResetCode,
    hashFinancialPinIdempotencyKey,
    hashFinancialPinRequestIp,
    isValidFinancialPinFormat,
} from "./financial-pin.ts";

Deno.test("financial PIN accepts exactly six decimal digits", () => {
    assertEquals(isValidFinancialPinFormat("123456"), true);
    assertEquals(isValidFinancialPinFormat("12345"), false);
    assertEquals(isValidFinancialPinFormat("1234567"), false);
    assertEquals(isValidFinancialPinFormat("12345a"), false);
});

Deno.test("reset code generation rejects modulo-biased samples", () => {
    const uint32Range = 0x1_0000_0000;
    const codeRange = 900_000;
    const unbiasedLimit = uint32Range - (uint32Range % codeRange);
    const samples = [unbiasedLimit, 0];
    let calls = 0;

    const code = generateFinancialPinResetCode(() => {
        calls += 1;
        return samples.shift() as number;
    });

    assertEquals(code, "100000");
    assertEquals(calls, 2);
    assertMatch(code, /^\d{6}$/);
});

Deno.test("request IP is pseudonymized only with an independent secret", async () => {
    const firstRequest = new Request("https://example.test", {
        headers: { "cf-connecting-ip": "203.0.113.10" },
    });
    const secondRequest = new Request("https://example.test", {
        headers: { "cf-connecting-ip": "203.0.113.11" },
    });
    const secret = "financial-pin-ip-test-secret-32-bytes-minimum";

    const firstHash = await hashFinancialPinRequestIp(firstRequest, secret);
    const repeatedHash = await hashFinancialPinRequestIp(firstRequest, secret);
    const secondHash = await hashFinancialPinRequestIp(secondRequest, secret);

    assertMatch(firstHash || "", /^[0-9a-f]{64}$/);
    assertEquals(firstHash, repeatedHash);
    assertNotEquals(firstHash, secondHash);
    assertEquals((firstHash || "").includes("203.0.113.10"), false);
    assertEquals(await hashFinancialPinRequestIp(firstRequest, ""), null);
});

Deno.test("idempotency keys are stored only as one-way digests", async () => {
    const rawKey = "reset-request:29346000";
    const digest = await hashFinancialPinIdempotencyKey(
        "19654c90-d631-4bd2-92bc-e8b970e0052f",
        "reset_request",
        rawKey,
        "financial-pin-idempotency-test-secret",
    );

    assertMatch(digest || "", /^[0-9a-f]{64}$/);
    assertEquals((digest || "").includes(rawKey), false);
    assertEquals(await hashFinancialPinIdempotencyKey(
        "19654c90-d631-4bd2-92bc-e8b970e0052f",
        "reset_request",
        "123456",
        "financial-pin-idempotency-test-secret",
    ), null);
});

Deno.test("locked and replayed attempts expose only safe user messages", () => {
    const locked = financialPinGateFailure({
        allowed: false,
        replayed: false,
        attemptId: "internal-attempt-id",
        replayOutcome: null,
        replayReason: null,
        lockedUntil: "2026-07-16T03:00:00.000Z",
    });
    const replayed = financialPinGateFailure({
        allowed: false,
        replayed: true,
        attemptId: "internal-attempt-id",
        replayOutcome: "pending",
        replayReason: "INTERNAL_REASON",
        lockedUntil: null,
    });

    assertEquals(locked.code, "PIN_TEMPORARILY_LOCKED");
    assertEquals(replayed.code, "PIN_OPERATION_ALREADY_PROCESSED");
    assertEquals(JSON.stringify({ locked, replayed }).includes("internal-attempt-id"), false);
    assertEquals(JSON.stringify({ locked, replayed }).includes("INTERNAL_REASON"), false);
});
