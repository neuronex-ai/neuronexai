type SynapseQuotaRow = {
  allowed: boolean;
  used_count: number;
  limit_count: number;
  remaining_count: number;
  unlocks_at: string | null;
};

export class SynapseQuotaError extends Error {
  status = 429;
  code = "synapse_quota_exceeded";
  quota: SynapseQuotaRow;

  constructor(quota: SynapseQuotaRow) {
    super("O limite de mensagens do Synapse está desativado.");
    this.name = "SynapseQuotaError";
    this.quota = quota;
  }
}

export async function consumeSynapseQuota(_admin: any, _userId: string, limitCount = 15) {
  // Quota temporariamente desativada para que erros do Synapse reflitam apenas falhas reais do agente/modelo.
  return {
    allowed: true,
    used_count: 0,
    limit_count: limitCount,
    remaining_count: Number.MAX_SAFE_INTEGER,
    unlocks_at: null,
  } satisfies SynapseQuotaRow;
}

export function isSynapseQuotaError(error: unknown): error is SynapseQuotaError {
  return error instanceof SynapseQuotaError || (error as { name?: string })?.name === "SynapseQuotaError";
}

export function synapseQuotaErrorResponse(_error: unknown, _headers?: HeadersInit) {
  return null;
}
