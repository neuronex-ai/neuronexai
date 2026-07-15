/**
 * Plan names kept for compatibility with the current application and database.
 * Enterprise remains an internal, inactive plan until its product rules exist.
 */
export type SubscriptionPlan = "Essential" | "Professional" | "Enterprise";
export type SubscriptionPlanCode = "essential" | "professional" | "enterprise";

/** Payment/access states synchronized with the billing provider. */
export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "trial_expired"
  | "checkout_pending"
  | "payment_pending"
  | "active"
  | "past_due"
  | "grace_period"
  | "blocked"
  | "canceled"
  | "refunded"
  | "chargeback"
  | "admin_override"
  | "internal_error";

export type SubscriptionAccessState =
  | "trial_access"
  | "paid_access"
  | "limited_access"
  | "blocked"
  | "admin_override";

/** Keys already consumed by the application feature gates. */
export type FeatureKey =
  | "ai_copilot"
  | "telemedicine"
  | "advanced_finance"
  | "patient_portal"
  | "admin_dashboard"
  | "api_access"
  | "unlimited_patients";

/** Server-side capability keys stored in subscription_plan_catalog.features. */
export type EntitlementFeatureKey =
  | "ai_copilot"
  | "telemedicine"
  | "teleconsultation_transcription"
  | "manual_finance"
  | "advanced_finance"
  | "neurofinance"
  | "fiscal"
  | "patient_portal"
  | "neurodrive"
  | "neurobox"
  | "neuroview"
  | "neuroflow"
  | "neuropulse"
  | "neuroscan"
  | "synapse_whatsapp"
  | "neurozap"
  | "external_integrations"
  | "multiple_professionals"
  | "admin_dashboard"
  | "performance_reports"
  | "api_access";

export type MeteredFeatureKey =
  | "patients"
  | "patient_portal_active_links"
  | "synapse_text_messages"
  | "synapse_voice_minutes"
  | "teleconsultations_monthly"
  | "teleconsultation_minutes_monthly"
  | "teleconsultation_distinct_patients_monthly"
  | "teleconsultation_transcription_minutes"
  | "neurodrive_documents"
  | "neurodrive_storage_mb"
  | "whatsapp_business_numbers"
  | "whatsapp_utility_messages";

export type SubscriptionLimitValue = number | "unlimited" | null;

export type SubscriptionPlanLimits = Record<MeteredFeatureKey, SubscriptionLimitValue> & {
  session_records_monthly: SubscriptionLimitValue;
  ai_monthly_actions: SubscriptionLimitValue;
  integrations: SubscriptionLimitValue;
  reports_monthly: SubscriptionLimitValue;
};

export type SubscriptionEntitlementFeatures = Record<EntitlementFeatureKey, boolean>;

export interface SubscriptionInternalFlags {
  can_use_neurofinance: boolean;
  can_use_synapse: boolean;
  can_use_neurodrive: boolean;
  can_use_neurobox: boolean;
  can_use_whatsapp: boolean;
  public_visible: boolean;
  overage_policy: "block" | "contract";
}

export interface SubscriptionTrialDefinition {
  days: number;
  features: SubscriptionEntitlementFeatures;
  limits: SubscriptionPlanLimits;
  internalFlags: SubscriptionInternalFlags;
}

export interface SubscriptionPlanDefinition {
  name: SubscriptionPlan;
  code: SubscriptionPlanCode;
  priceCents: number | null;
  currency: "BRL";
  billingCycle: "FREE" | "MONTHLY" | "CUSTOM";
  active: boolean;
  publicVisible: boolean;
  features: SubscriptionEntitlementFeatures;
  limits: SubscriptionPlanLimits;
  internalFlags: SubscriptionInternalFlags;
  trial?: SubscriptionTrialDefinition;
}

/** Legacy UI shape returned by get-current-entitlement. */
export interface PlanFeatures {
  maxPatients: number | "unlimited";
  hasAICopilot: boolean;
  hasTelemedicine: boolean;
  hasAdvancedFinance: boolean;
  hasPatientPortal: boolean;
  hasAdminDashboard: boolean;
  hasAPIAccess: boolean;
}

/** Current subscription state for a professional. */
export interface UserSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  gatewaySubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  createdAt: Date;
}

export const PLAN_FEATURES: Record<SubscriptionPlan, PlanFeatures> = {
  Essential: {
    maxPatients: 5,
    hasAICopilot: true,
    hasTelemedicine: true,
    hasAdvancedFinance: false,
    hasPatientPortal: true,
    hasAdminDashboard: false,
    hasAPIAccess: false,
  },
  Professional: {
    maxPatients: 250,
    hasAICopilot: true,
    hasTelemedicine: true,
    hasAdvancedFinance: true,
    hasPatientPortal: true,
    hasAdminDashboard: false,
    hasAPIAccess: false,
  },
  Enterprise: {
    maxPatients: "unlimited",
    hasAICopilot: true,
    hasTelemedicine: true,
    hasAdvancedFinance: true,
    hasPatientPortal: true,
    hasAdminDashboard: true,
    hasAPIAccess: true,
  },
};

export const FEATURE_UPSELL_PLANS: Record<FeatureKey, SubscriptionPlan> = {
  ai_copilot: "Professional",
  telemedicine: "Professional",
  advanced_finance: "Professional",
  patient_portal: "Professional",
  unlimited_patients: "Enterprise",
  admin_dashboard: "Enterprise",
  api_access: "Enterprise",
};

export const FEATURE_NAMES: Record<FeatureKey, string> = {
  ai_copilot: "Synapse AI",
  telemedicine: "Teleconsulta HD",
  advanced_finance: "NeuroFinance",
  patient_portal: "Portal do Paciente",
  unlimited_patients: "Pacientes ilimitados",
  admin_dashboard: "Painel administrativo",
  api_access: "API e integrações",
};
