export const APPOINTMENT_POLICY_LIMITS = {
  freeCancellationHours: { min: 0, max: 8760 },
  freeRescheduleHours: { min: 0, max: 8760 },
  minimumPatientReactionHours: { min: 0, max: 720 },
  professionalResponseSlaHours: { min: 0.01, max: 720 },
} as const;

export type AppointmentConsequence =
  | "consume_credit"
  | "keep_charge"
  | "partial_fee"
  | "manual_review"
  | "waive";

export type PackageCreditPolicy =
  | "release_reserved_credit"
  | "keep_reserved_credit"
  | "manual_review";

export type ChargePolicy =
  | "cancel_pending_keep_paid_as_credit"
  | "keep_existing"
  | "refund_paid"
  | "manual_review";

export type FiscalPolicy =
  | "disable_unissued_review_issued"
  | "keep_existing"
  | "manual_review";

export interface AppointmentPolicyDraft {
  freeCancellationHours: string;
  freeRescheduleHours: string;
  minimumPatientReactionHours: string;
  professionalResponseSlaHours: string;
  lateCancellationConsequence: AppointmentConsequence;
  noShowConsequence: AppointmentConsequence;
  packageCreditPolicy: PackageCreditPolicy;
  chargePolicy: ChargePolicy;
  fiscalPolicy: FiscalPolicy;
  timezone: string;
}

export interface AppointmentPolicyValues {
  freeCancellationHours: number;
  freeRescheduleHours: number;
  minimumPatientReactionHours: number;
  professionalResponseSlaHours: number;
  lateCancellationConsequence: AppointmentConsequence;
  noShowConsequence: AppointmentConsequence;
  packageCreditPolicy: PackageCreditPolicy;
  chargePolicy: ChargePolicy;
  fiscalPolicy: FiscalPolicy;
  timezone: string;
}

export const DEFAULT_APPOINTMENT_POLICY: AppointmentPolicyDraft = {
  freeCancellationHours: "24",
  freeRescheduleHours: "24",
  minimumPatientReactionHours: "4",
  professionalResponseSlaHours: "8",
  lateCancellationConsequence: "manual_review",
  noShowConsequence: "manual_review",
  packageCreditPolicy: "release_reserved_credit",
  chargePolicy: "cancel_pending_keep_paid_as_credit",
  fiscalPolicy: "disable_unissued_review_issued",
  timezone: "America/Sao_Paulo",
};

const parseBoundedNumber = (
  value: string,
  fieldLabel: string,
  limits: { min: number; max: number },
): number => {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);

  if (normalized === "" || !Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} deve ser um número válido.`);
  }
  if (parsed < limits.min || parsed > limits.max) {
    throw new Error(`${fieldLabel} deve ficar entre ${limits.min} e ${limits.max} horas.`);
  }

  return parsed;
};

const normalizeTimezone = (timezone: string): string => {
  const normalized = timezone.trim();
  if (!normalized) throw new Error("Informe o fuso horário da política.");

  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: normalized }).format(new Date());
  } catch {
    throw new Error("Informe um fuso horário IANA válido, como America/Sao_Paulo.");
  }

  return normalized;
};

export const normalizeAppointmentPolicyDraft = (
  draft: AppointmentPolicyDraft,
): AppointmentPolicyValues => ({
  freeCancellationHours: parseBoundedNumber(
    draft.freeCancellationHours,
    "O prazo de cancelamento gratuito",
    APPOINTMENT_POLICY_LIMITS.freeCancellationHours,
  ),
  freeRescheduleHours: parseBoundedNumber(
    draft.freeRescheduleHours,
    "O prazo de reagendamento gratuito",
    APPOINTMENT_POLICY_LIMITS.freeRescheduleHours,
  ),
  minimumPatientReactionHours: parseBoundedNumber(
    draft.minimumPatientReactionHours,
    "O prazo mínimo de reação do paciente",
    APPOINTMENT_POLICY_LIMITS.minimumPatientReactionHours,
  ),
  professionalResponseSlaHours: parseBoundedNumber(
    draft.professionalResponseSlaHours,
    "O prazo de resposta do profissional",
    APPOINTMENT_POLICY_LIMITS.professionalResponseSlaHours,
  ),
  lateCancellationConsequence: draft.lateCancellationConsequence,
  noShowConsequence: draft.noShowConsequence,
  packageCreditPolicy: draft.packageCreditPolicy,
  chargePolicy: draft.chargePolicy,
  fiscalPolicy: draft.fiscalPolicy,
  timezone: normalizeTimezone(draft.timezone),
});

export const appointmentPolicyFingerprint = (draft: AppointmentPolicyDraft): string =>
  JSON.stringify(normalizeAppointmentPolicyDraft(draft));

