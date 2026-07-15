export type PackageLifecycleOperation = "replace" | "end" | "release";
export type PackageLifecycleScope = "only_this" | "this_and_next" | "all_future";
export type PackageFinancialStrategy =
  | "keep_existing"
  | "cancel_and_recreate_per_session"
  | "cancel_and_create_single"
  | "cancel_without_replacement"
  | "manual_review";

export interface PackageLifecycleRequest {
  mode: "preview" | "execute";
  sourcePackageId: string;
  targetPackageId: string | null;
  operationType: PackageLifecycleOperation;
  scope: PackageLifecycleScope;
  anchorAppointmentId: string | null;
  financialStrategy: PackageFinancialStrategy;
  reason: string | null;
  idempotencyKey: string | null;
  expectedAppointmentIds: string[] | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function oneOf<T extends string>(value: unknown, values: readonly T[], label: string): T {
  const normalized = String(value || "").trim() as T;
  if (!values.includes(normalized)) throw new Error(`${label} inválido.`);
  return normalized;
}

function optionalUuid(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  if (!UUID.test(normalized)) throw new Error(`${label} inválido.`);
  return normalized;
}

export function parsePackageLifecycleRequest(value: unknown): PackageLifecycleRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Requisição inválida.");
  }
  const body = value as Record<string, unknown>;
  const mode = oneOf(body.mode || "preview", ["preview", "execute"] as const, "Modo");
  const sourcePackageId = optionalUuid(body.sourcePackageId, "Pacote de origem");
  if (!sourcePackageId) throw new Error("Pacote de origem obrigatório.");

  const operationType = oneOf(
    body.operationType || "replace",
    ["replace", "end", "release"] as const,
    "Operação",
  );
  const targetPackageId = optionalUuid(body.targetPackageId, "Novo pacote");
  if (operationType === "replace" && !targetPackageId) {
    throw new Error("Novo pacote obrigatório para substituição.");
  }
  if (targetPackageId === sourcePackageId) {
    throw new Error("O novo pacote deve ser diferente do pacote atual.");
  }

  const scope = oneOf(
    body.scope || "all_future",
    ["only_this", "this_and_next", "all_future"] as const,
    "Escopo",
  );
  const anchorAppointmentId = optionalUuid(body.anchorAppointmentId, "Ocorrência inicial");
  if (scope !== "all_future" && !anchorAppointmentId) {
    throw new Error("Selecione a ocorrência inicial para este escopo.");
  }
  if (operationType === "end" && scope !== "all_future") {
    throw new Error("Encerrar o pacote exige todas as ocorrências futuras.");
  }

  const financialStrategy = oneOf(
    body.financialStrategy || "keep_existing",
    [
      "keep_existing",
      "cancel_and_recreate_per_session",
      "cancel_and_create_single",
      "cancel_without_replacement",
      "manual_review",
    ] as const,
    "Estratégia financeira",
  );

  const reason = body.reason == null ? null : String(body.reason).trim();
  const idempotencyKey = body.idempotencyKey == null ? null : String(body.idempotencyKey).trim();
  const rawExpectedIds = body.expectedAppointmentIds;
  const expectedAppointmentIds = rawExpectedIds == null
    ? null
    : Array.isArray(rawExpectedIds)
    ? rawExpectedIds.map((id) => {
      const normalized = optionalUuid(id, "Agendamento esperado");
      if (!normalized) throw new Error("Agendamento esperado inválido.");
      return normalized;
    })
    : (() => {
      throw new Error("Lista de agendamentos inválida.");
    })();

  if (mode === "execute") {
    if (!reason || reason.length < 3) throw new Error("Informe o motivo da alteração.");
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new Error("Chave de idempotência obrigatória.");
    }
    if (expectedAppointmentIds == null) {
      throw new Error("Confirme a lista de ocorrências analisada.");
    }
  }

  return {
    mode,
    sourcePackageId,
    targetPackageId,
    operationType,
    scope,
    anchorAppointmentId,
    financialStrategy,
    reason,
    idempotencyKey,
    expectedAppointmentIds,
  };
}
