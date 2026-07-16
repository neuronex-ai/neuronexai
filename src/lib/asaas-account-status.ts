export type AsaasApprovalTone =
  | "approved"
  | "pending"
  | "review"
  | "rejected"
  | "missing"
  | "neutral";

export type AsaasFinancialUiStatus =
  | "not_started"
  | "pending"
  | "onboarding"
  | "pending_review"
  | "restricted"
  | "active"
  | "account_missing"
  | "disabled";

export interface AsaasApprovalStage {
  id: "general" | "commercial" | "bank" | "billing" | "documents";
  label: string;
  rawStatus: string;
  statusLabel: string;
  tone: AsaasApprovalTone;
  description: string;
  actionable: boolean;
}

export interface AsaasAccountState {
  uiStatus: AsaasFinancialUiStatus;
  isApproved: boolean;
  hasOpenStages: boolean;
  hasActionableStages: boolean;
  stages: AsaasApprovalStage[];
  openStages: AsaasApprovalStage[];
  actionableStages: AsaasApprovalStage[];
  requirementsSnapshot: Record<string, unknown>;
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Aprovado",
  PENDING: "Pendente",
  AWAITING_APPROVAL: "Aguardando aprovação",
  AWAITING_ACTION_AUTHORIZATION: "Aguardando ação",
  NOT_SENT: "Não enviado",
  REJECTED: "Reprovado",
  DENIED: "Reprovado",
  EXPIRED: "Expirado",
  EXPIRING_SOON: "Expira em breve",
  UNKNOWN: "Não informado",
};

const STATUS_DESCRIPTIONS: Record<AsaasApprovalTone, string> = {
  approved: "Etapa validada.",
  pending: "A etapa ainda precisa ser concluída ou processada.",
  review: "Aguardando análise cadastral.",
  rejected: "A etapa precisa de correção ou reenvio.",
  missing: "Informação ainda não enviada para análise.",
  neutral: "Status aguardando atualização.",
};

const STAGE_DEFINITIONS: Array<{
  id: AsaasApprovalStage["id"];
  label: string;
  keys: string[];
  approvedWhenGeneralApproved?: boolean;
}> = [
  {
    id: "general",
    label: "Aprovação geral do cadastro",
    keys: [
      "stages.general.provider_status",
      "stages.general.raw_status",
      "stages.general.rawStatus",
      "generalStatus",
      "general.status",
      "general",
      "general_status",
      "generalApprovalStatus",
      "general_approval",
      "generalApproval.status",
      "accountStatus.generalStatus",
      "accountStatus.general",
      "raw.generalStatus",
      "raw.general",
      "requirements.general",
    ],
  },
  {
    id: "commercial",
    label: "Dados comerciais",
    keys: [
      "stages.commercial.provider_status",
      "stages.commercial.raw_status",
      "stages.commercial.rawStatus",
      "commercialInfoStatus",
      "commercialInfo.status",
      "commercialInfo",
      "commercial_info.status",
      "commercial_info",
      "commercial_status",
      "commercial.status",
      "accountStatus.commercialInfoStatus",
      "accountStatus.commercialInfo",
      "raw.commercialInfoStatus",
      "raw.commercialInfo",
      "requirements.commercial_info",
    ],
  },
  {
    id: "bank",
    label: "Dados bancários",
    keys: [
      "stages.bank.provider_status",
      "stages.bank.raw_status",
      "stages.bank.rawStatus",
      "bankAccountInfoStatus",
      "bankAccountInfo.status",
      "bankAccountInfo",
      "bank_account_info.status",
      "bank_account_info",
      "bank_status",
      "bank.status",
      "accountStatus.bankAccountInfoStatus",
      "accountStatus.bankAccountInfo",
      "raw.bankAccountInfoStatus",
      "raw.bankAccountInfo",
      "requirements.bank_account_info",
    ],
  },
  {
    id: "billing",
    label: "Dados do boleto",
    approvedWhenGeneralApproved: true,
    keys: [
      "stages.billing.provider_status",
      "stages.billing.raw_status",
      "stages.billing.rawStatus",
      "bankSlipInfoStatus",
      "bankSlipInfo.status",
      "bankSlipInfo",
      "bank_slip_info.status",
      "bank_slip_info",
      "boletoInfoStatus",
      "boletoInfo.status",
      "boletoInfo",
      "boleto_info.status",
      "boleto_info",
      "billingInfoStatus",
      "billingInfo.status",
      "billingInfo",
      "billing_info.status",
      "billing_info",
      "paymentInfoStatus",
      "accountStatus.bankSlipInfoStatus",
      "accountStatus.bankSlipInfo",
      "accountStatus.billingInfoStatus",
      "raw.bankSlipInfoStatus",
      "raw.billingInfoStatus",
      "requirements.bank_slip_info",
      "requirements.boleto_info",
      "requirements.billing_info",
    ],
  },
  {
    id: "documents",
    label: "Documentos",
    approvedWhenGeneralApproved: true,
    keys: [
      "stages.documents.provider_status",
      "stages.documents.raw_status",
      "stages.documents.rawStatus",
      "documentStatus",
      "documentationStatus",
      "documentsStatus",
      "document.status",
      "documentation.status",
      "documents.status",
      "document",
      "documentation",
      "documents",
      "document_status",
      "documents_status",
      "kycDocumentStatus",
      "identityDocumentStatus",
      "accountStatus.documentStatus",
      "accountStatus.documentation",
      "raw.documentStatus",
      "raw.documentation",
      "requirements.document",
      "requirements.documentation",
      "requirements.documents",
      "requirements.document_status",
    ],
  },
];

const normalizeRawStatus = (value: unknown) =>
  String(value || "UNKNOWN")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const readNested = (source: any, key: string) =>
  key.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), source);

const readStatus = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = key.includes(".") ? readNested(source, key) : source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

export const getAsaasStatusLabel = (value: unknown) => {
  const normalized = normalizeRawStatus(value);
  return STATUS_LABELS[normalized] || "Em atualização";
};

export const getAsaasStatusTone = (value: unknown): AsaasApprovalTone => {
  const normalized = normalizeRawStatus(value);
  if (normalized === "APPROVED") return "approved";
  if (["REJECTED", "DENIED", "EXPIRED"].includes(normalized)) return "rejected";
  if (normalized === "AWAITING_APPROVAL") return "review";
  if (["PENDING", "EXPIRING_SOON", "AWAITING_ACTION_AUTHORIZATION"].includes(normalized)) return "pending";
  if (normalized === "NOT_SENT") return "missing";
  return "neutral";
};

export const isAsaasStageActionable = (stage: Pick<AsaasApprovalStage, "rawStatus" | "tone">) => {
  const raw = normalizeRawStatus(stage.rawStatus);
  return (
    stage.tone === "rejected" ||
    stage.tone === "missing" ||
    ["PENDING", "AWAITING_ACTION_AUTHORIZATION", "EXPIRING_SOON", "EXPIRED"].includes(raw)
  );
};

export const getAsaasAccountStatusSource = (account: any) => {
  const requirements = account?.requirements || {};
  const status = account?.account_status || account?.accountStatus || {};
  const metadata = account?.metadata || {};
  const raw = requirements?.raw || requirements?.accountStatus || status || {};

  return {
    ...metadata,
    ...raw,
    ...requirements,
    ...status,
    raw,
    accountStatus: status,
    requirements,
    metadata,
  };
};

export const buildAsaasApprovalStages = (account: any): AsaasApprovalStage[] => {
  const source = getAsaasAccountStatusSource(account);
  const generalRaw = normalizeRawStatus(
    readStatus(source, STAGE_DEFINITIONS[0].keys) ||
      readStatus(source, ["raw.general", "raw.generalStatus", "requirements.general"])
  );
  const generalApproved = generalRaw === "APPROVED";

  return STAGE_DEFINITIONS.map((stage) => {
    const fallback = stage.approvedWhenGeneralApproved && generalApproved ? "APPROVED" : undefined;
    const rawStatus = normalizeRawStatus(readStatus(source, stage.keys) || fallback);
    const tone = getAsaasStatusTone(rawStatus);

    const result: AsaasApprovalStage = {
      id: stage.id,
      label: stage.label,
      rawStatus,
      statusLabel: getAsaasStatusLabel(rawStatus),
      tone,
      description: STATUS_DESCRIPTIONS[tone],
      actionable: false,
    };

    return {
      ...result,
      actionable: isAsaasStageActionable(result),
    };
  });
};

export const getAsaasAccountState = (account: any): AsaasAccountState => {
  const hasAsaasAccount = !!account?.asaas_account_id;
  const storedStatus = String(account?.status || "");
  const stages = buildAsaasApprovalStages(account);
  const openStages = stages.filter((stage) => stage.tone !== "approved");
  const actionableStages = stages.filter((stage) => stage.actionable);
  const allStagesApproved = hasAsaasAccount && openStages.length === 0;
  const hasRejected = stages.some((stage) => stage.tone === "rejected");

  let uiStatus: AsaasFinancialUiStatus = "not_started";
  if (storedStatus === "account_missing") {
    uiStatus = "account_missing";
  } else if (!hasAsaasAccount) {
    uiStatus = "not_started";
  } else if (hasRejected || ["restricted", "disabled"].includes(storedStatus)) {
    uiStatus = "restricted";
  } else if (allStagesApproved) {
    uiStatus = "active";
  } else if (actionableStages.length > 0) {
    uiStatus = "onboarding";
  } else {
    uiStatus = "pending_review";
  }
  const isApproved = uiStatus === "active";

  const requirementsSnapshot = {
    overall_status: uiStatus,
    ui_status: uiStatus,
    is_approved: isApproved,
    source: "frontend",
    stages: Object.fromEntries(
      stages.map((stage) => [
        stage.id,
        {
          label: stage.label,
          provider_status: stage.rawStatus,
          status: stage.tone,
          status_label: stage.statusLabel,
          actionable: stage.actionable,
        },
      ])
    ),
  };

  return {
    uiStatus,
    isApproved,
    hasOpenStages: openStages.length > 0,
    hasActionableStages: actionableStages.length > 0,
    stages,
    openStages,
    actionableStages,
    requirementsSnapshot,
  };
};

export const hasOpenAsaasApprovalStage = (account: any) =>
  getAsaasAccountState(account).hasOpenStages;

export const isAsaasAccountApproved = (account: any) =>
  getAsaasAccountState(account).isApproved;

export const getAsaasAccountSituation = (account: any) => {
  const state = getAsaasAccountState(account);

  if (state.uiStatus === "account_missing") return "Conta desconectada";
  if (!account?.asaas_account_id) return "Conta não criada";
  if (state.isApproved) return "Conta aprovada";
  if (state.uiStatus === "restricted" || state.uiStatus === "disabled") return "Conta restrita";
  if (state.hasActionableStages) return "Ação necessária";
  return "Conta em análise";
};
