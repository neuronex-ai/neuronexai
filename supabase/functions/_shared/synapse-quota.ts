type SynapseQuotaRow = {
  allowed: boolean;
  used_count: number;
  limit_count: number | null;
  remaining_count: number | null;
  period_start: string | null;
  period_end: string | null;
  duplicate?: boolean;
  compatibility_mode?: boolean;
};

export class SynapseQuotaError extends Error {
  status = 429;
  code = "synapse_quota_exceeded";
  quota: SynapseQuotaRow;

  constructor(quota: SynapseQuotaRow) {
    super("Você atingiu o limite mensal de ações de texto do Synapse no seu plano.");
    this.name = "SynapseQuotaError";
    this.quota = quota;
  }
}

const firstRow = (data: unknown) => Array.isArray(data) ? data[0] : data;

const isMissingUsageContract = (error: any) =>
  ["42883", "PGRST202", "PGRST204"].includes(String(error?.code || "")) ||
  /record_subscription_usage/i.test(String(error?.message || ""));

export async function consumeSynapseQuota(
  admin: any,
  userId: string,
  idempotencyKey: string,
) {
  const { data, error } = await admin.rpc("record_subscription_usage", {
    p_user_id: userId,
    p_feature_key: "synapse_text_messages",
    p_quantity: 1,
    p_unit: "action",
    p_idempotency_key: idempotencyKey,
    p_source: "synapse-text-fallback",
    p_metadata: { channel: "text" },
    p_occurred_at: new Date().toISOString(),
  });

  if (error) {
    // The deployment workflow can publish functions before an additive database
    // migration is intentionally approved/applied. Do not take Synapse offline.
    if (isMissingUsageContract(error)) {
      return {
        allowed: true,
        used_count: 0,
        limit_count: null,
        remaining_count: null,
        period_start: null,
        period_end: null,
        compatibility_mode: true,
      } satisfies SynapseQuotaRow;
    }
    throw error;
  }

  const row = firstRow(data) as SynapseQuotaRow | null;
  if (!row) throw new Error("Não foi possível verificar o limite do Synapse.");
  if (!row.allowed) throw new SynapseQuotaError(row);
  return row;
}

export function isSynapseQuotaError(error: unknown): error is SynapseQuotaError {
  return error instanceof SynapseQuotaError || (error as { name?: string })?.name === "SynapseQuotaError";
}

export function synapseQuotaErrorResponse(error: unknown, headers: HeadersInit = {}) {
  if (!isSynapseQuotaError(error)) return null;
  return new Response(JSON.stringify({
    error: error.message,
    code: error.code,
    quota: error.quota,
  }), {
    status: error.status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
