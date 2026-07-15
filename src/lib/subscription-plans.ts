import type {
  SubscriptionEntitlementFeatures,
  SubscriptionInternalFlags,
  SubscriptionPlan,
  SubscriptionPlanCode,
  SubscriptionPlanDefinition,
  SubscriptionPlanLimits,
} from "@/types/subscription";

export const PROFESSIONAL_TRIAL_DAYS = 7;
export const PROFESSIONAL_PLAN_PRICE_CENTS = 22_990;
export const PROFESSIONAL_PLAN_PRICE = "R$ 229,90";
export const PROFESSIONAL_PLAN_PERIOD = "/mês";
export const PROFESSIONAL_PLAN_PRICE_LABEL = `${PROFESSIONAL_PLAN_PRICE}${PROFESSIONAL_PLAN_PERIOD}`;
export const PROFESSIONAL_ANNUAL_INSTALLMENT_CENTS = 18_990;
export const PROFESSIONAL_ANNUAL_INSTALLMENT_PRICE = "R$ 189,90";

const baseFeatures: SubscriptionEntitlementFeatures = {
  ai_copilot: true,
  telemedicine: true,
  teleconsultation_transcription: false,
  manual_finance: true,
  advanced_finance: false,
  neurofinance: false,
  fiscal: false,
  patient_portal: true,
  neurodrive: true,
  neurobox: false,
  neuroview: false,
  neuroflow: false,
  neuropulse: false,
  neuroscan: false,
  synapse_whatsapp: false,
  neurozap: false,
  external_integrations: false,
  multiple_professionals: false,
  admin_dashboard: false,
  performance_reports: false,
  api_access: false,
};

export const ESSENTIAL_PLAN_FEATURES: SubscriptionEntitlementFeatures = {
  ...baseFeatures,
};

export const PROFESSIONAL_PLAN_FEATURES: SubscriptionEntitlementFeatures = {
  ...baseFeatures,
  teleconsultation_transcription: true,
  advanced_finance: true,
  neurofinance: true,
  fiscal: true,
  neurobox: true,
  neuroview: true,
  neuroflow: true,
  neuropulse: true,
  neuroscan: true,
  synapse_whatsapp: true,
  neurozap: true,
  external_integrations: true,
};

export const PROFESSIONAL_TRIAL_FEATURES: SubscriptionEntitlementFeatures = {
  ...PROFESSIONAL_PLAN_FEATURES,
  advanced_finance: false,
  neurofinance: false,
  fiscal: false,
  synapse_whatsapp: false,
  neurozap: false,
  external_integrations: false,
};

export const ENTERPRISE_INTERNAL_FEATURES: SubscriptionEntitlementFeatures = {
  ...PROFESSIONAL_PLAN_FEATURES,
  multiple_professionals: true,
  admin_dashboard: true,
  performance_reports: true,
  api_access: true,
};

export const ESSENTIAL_PLAN_LIMITS: SubscriptionPlanLimits = {
  patients: 5,
  patient_portal_active_links: 5,
  session_records_monthly: null,
  ai_monthly_actions: 30,
  synapse_text_messages: 30,
  synapse_voice_minutes: 5,
  teleconsultations_monthly: 5,
  teleconsultation_minutes_monthly: 150,
  teleconsultation_distinct_patients_monthly: 5,
  teleconsultation_transcription_minutes: 0,
  neurodrive_documents: 100,
  neurodrive_storage_mb: 250,
  whatsapp_business_numbers: 0,
  whatsapp_utility_messages: 0,
  integrations: 0,
  reports_monthly: 0,
};

export const PROFESSIONAL_PLAN_LIMITS: SubscriptionPlanLimits = {
  patients: 250,
  patient_portal_active_links: 250,
  session_records_monthly: null,
  ai_monthly_actions: 500,
  synapse_text_messages: 500,
  synapse_voice_minutes: 60,
  teleconsultations_monthly: 80,
  teleconsultation_minutes_monthly: null,
  teleconsultation_distinct_patients_monthly: 20,
  teleconsultation_transcription_minutes: 300,
  neurodrive_documents: 2_000,
  neurodrive_storage_mb: 5_120,
  whatsapp_business_numbers: 1,
  whatsapp_utility_messages: 250,
  integrations: null,
  reports_monthly: null,
};

export const PROFESSIONAL_TRIAL_LIMITS: SubscriptionPlanLimits = {
  ...PROFESSIONAL_PLAN_LIMITS,
  ai_monthly_actions: 50,
  synapse_text_messages: 50,
  synapse_voice_minutes: 15,
  teleconsultations_monthly: 3,
  teleconsultation_distinct_patients_monthly: 3,
  teleconsultation_transcription_minutes: 60,
  whatsapp_business_numbers: 0,
  whatsapp_utility_messages: 0,
  integrations: 0,
};

export const ENTERPRISE_INTERNAL_LIMITS: SubscriptionPlanLimits = {
  patients: "unlimited",
  patient_portal_active_links: "unlimited",
  session_records_monthly: null,
  ai_monthly_actions: null,
  synapse_text_messages: null,
  synapse_voice_minutes: null,
  teleconsultations_monthly: null,
  teleconsultation_minutes_monthly: null,
  teleconsultation_distinct_patients_monthly: null,
  teleconsultation_transcription_minutes: null,
  neurodrive_documents: null,
  neurodrive_storage_mb: null,
  whatsapp_business_numbers: null,
  whatsapp_utility_messages: null,
  integrations: null,
  reports_monthly: null,
};

const essentialFlags: SubscriptionInternalFlags = {
  can_use_neurofinance: false,
  can_use_synapse: true,
  can_use_neurodrive: true,
  can_use_neurobox: false,
  can_use_whatsapp: false,
  public_visible: true,
  overage_policy: "block",
};

const professionalFlags: SubscriptionInternalFlags = {
  can_use_neurofinance: true,
  can_use_synapse: true,
  can_use_neurodrive: true,
  can_use_neurobox: true,
  can_use_whatsapp: true,
  public_visible: true,
  overage_policy: "block",
};

const professionalTrialFlags: SubscriptionInternalFlags = {
  ...professionalFlags,
  can_use_neurofinance: false,
  can_use_whatsapp: false,
};

export const SUBSCRIPTION_PLAN_DEFINITIONS: Record<SubscriptionPlan, SubscriptionPlanDefinition> = {
  Essential: {
    name: "Essential",
    code: "essential",
    priceCents: 0,
    currency: "BRL",
    billingCycle: "FREE",
    active: true,
    publicVisible: true,
    features: ESSENTIAL_PLAN_FEATURES,
    limits: ESSENTIAL_PLAN_LIMITS,
    internalFlags: essentialFlags,
  },
  Professional: {
    name: "Professional",
    code: "professional",
    priceCents: PROFESSIONAL_PLAN_PRICE_CENTS,
    currency: "BRL",
    billingCycle: "MONTHLY",
    active: true,
    publicVisible: true,
    features: PROFESSIONAL_PLAN_FEATURES,
    limits: PROFESSIONAL_PLAN_LIMITS,
    internalFlags: professionalFlags,
    trial: {
      days: PROFESSIONAL_TRIAL_DAYS,
      features: PROFESSIONAL_TRIAL_FEATURES,
      limits: PROFESSIONAL_TRIAL_LIMITS,
      internalFlags: professionalTrialFlags,
    },
  },
  Enterprise: {
    name: "Enterprise",
    code: "enterprise",
    priceCents: null,
    currency: "BRL",
    billingCycle: "CUSTOM",
    active: false,
    publicVisible: false,
    features: ENTERPRISE_INTERNAL_FEATURES,
    limits: ENTERPRISE_INTERNAL_LIMITS,
    internalFlags: {
      ...professionalFlags,
      public_visible: false,
      overage_policy: "contract",
    },
  },
};

export const SUBSCRIPTION_PLAN_BY_CODE: Record<SubscriptionPlanCode, SubscriptionPlanDefinition> = {
  essential: SUBSCRIPTION_PLAN_DEFINITIONS.Essential,
  professional: SUBSCRIPTION_PLAN_DEFINITIONS.Professional,
  enterprise: SUBSCRIPTION_PLAN_DEFINITIONS.Enterprise,
};

export const PLAN_PRICE_LABELS: Record<SubscriptionPlan, string> = {
  Essential: "Gratuito",
  Professional: PROFESSIONAL_PLAN_PRICE_LABEL,
  Enterprise: "Indisponível",
};
