import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { consumeSynapseQuota, SynapseQuotaError } from "./synapse-quota.ts";

const adminWith = (result: { data?: unknown; error?: unknown }) => ({
  rpc: async () => ({ data: result.data ?? null, error: result.error ?? null }),
});

Deno.test("Synapse records one idempotent text action", async () => {
  const row = await consumeSynapseQuota(adminWith({
    data: [{
      allowed: true,
      used_count: 7,
      limit_count: 30,
      remaining_count: 23,
      period_start: "2026-07-01",
      period_end: "2026-08-01",
      duplicate: false,
    }],
  }), "11111111-1111-4111-8111-111111111111", "request-1");

  assertEquals(row.used_count, 7);
  assertEquals(row.remaining_count, 23);
});

Deno.test("Synapse rejects an exhausted text quota", async () => {
  await assertRejects(
    () => consumeSynapseQuota(adminWith({
      data: [{
        allowed: false,
        used_count: 30,
        limit_count: 30,
        remaining_count: 0,
        period_start: "2026-07-01",
        period_end: "2026-08-01",
      }],
    }), "11111111-1111-4111-8111-111111111111", "request-2"),
    SynapseQuotaError,
  );
});

Deno.test("Synapse remains available before the additive metering migration is applied", async () => {
  const row = await consumeSynapseQuota(adminWith({
    error: { code: "PGRST202", message: "record_subscription_usage not found" },
  }), "11111111-1111-4111-8111-111111111111", "request-3");

  assertEquals(row.allowed, true);
  assertEquals(row.compatibility_mode, true);
});
