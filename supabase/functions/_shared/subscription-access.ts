import {
  ASAAS_ENV,
  asaasRequest,
  errorResponse,
  getAuthenticatedUser,
  sanitizeDigits,
  supabaseAdmin,
} from "./asaas-client.ts";

export const TRIAL_DAYS = 7;
export const PROFESSIONAL_PLAN_CODE = "professional";
export const PROFESSIONAL_PLAN_NAME = "Professional";
export const PROFESSIONAL_AMOUNT_CENTS = 22_990;
export const CHECKOUT_EXPIRATION_MINUTES = 120;

export const PLAN_BY_CODE: Record<string, "Essential" | "Professional" | "Enterprise"> = {
  essential: "Essential",
  professional: "Professional",
  enterprise: "Enterprise",
};

export const PLAN_CODE_BY_NAME: Record<string, "essential" | "professional" | "enterprise"> = {
  essential: "essential",
  professional: "professional",
  profissional: "professional",
  enterprise: "enterprise",
};

const PAID_ACCESS_STATUSES = new Set(["active", "trialing", "admin_override"]);
const USABLE_ACCESS_STATES = new Set(["paid_access", "trial_access", "limited_access", "admin_override"]);
const PAYMENT_BACKED_STATUSES = new Set([
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
  "CHECKOUT_PAID",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
]);
const UPSELL_STATUSES = new Set([
  "trial_expired",
  "checkout_pending",
  "payment_pending",
  "past_due",
  "grace_period",
  "blocked",
  "canceled",
  "refunded",
  "chargeback",
  "internal_error",
]);

export const ESSENTIAL_FEATURES: Record<string, unknown> = {
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

export const ESSENTIAL_LIMITS: Record<string, unknown> = {
  patients: 5,
  patient_portal_active_links: 5,
  session_records_monthly: null,
  ai_monthly_actions: 30,
  neurodrive_documents: 100,
  neurodrive_storage_mb: 250,
  teleconsultations_monthly: 5,
  teleconsultation_minutes_monthly: 150,
  teleconsultation_distinct_patients_monthly: 5,
  teleconsultation_transcription_minutes: 0,
  synapse_text_messages: 30,
  synapse_voice_minutes: 5,
  whatsapp_business_numbers: 0,
  whatsapp_utility_messages: 0,
  integrations: 0,
  reports_monthly: 0,
};

export const ESSENTIAL_INTERNAL_FLAGS: Record<string, unknown> = {
  can_use_neurofinance: false,
  can_use_synapse: true,
  can_use_neurodrive: true,
  can_use_neurobox: false,
  can_use_whatsapp: false,
  public_visible: true,
  overage_policy: "block",
};

export const PROFESSIONAL_LIMITS: Record<string, unknown> = {
  patients: 250,
  patient_portal_active_links: 250,
  session_records_monthly: null,
  ai_monthly_actions: 500,
  neurodrive_documents: 2_000,
  neurodrive_storage_mb: 5_120,
  teleconsultations_monthly: 80,
  teleconsultation_minutes_monthly: null,
  teleconsultation_distinct_patients_monthly: 20,
  teleconsultation_transcription_minutes: 300,
  synapse_text_messages: 500,
  synapse_voice_minutes: 60,
  whatsapp_business_numbers: 1,
  whatsapp_utility_messages: 250,
  integrations: null,
  reports_monthly: null,
};

export const PROFESSIONAL_TRIAL_LIMITS: Record<string, unknown> = {
  ...PROFESSIONAL_LIMITS,
  ai_monthly_actions: 50,
  teleconsultations_monthly: 3,
  teleconsultation_distinct_patients_monthly: 3,
  teleconsultation_transcription_minutes: 60,
  synapse_text_messages: 50,
  synapse_voice_minutes: 15,
  whatsapp_business_numbers: 0,
  whatsapp_utility_messages: 0,
  integrations: 0,
};

type SupabaseUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export function normalizePlanCode(planId?: string | null) {
  const normalized = String(planId || PROFESSIONAL_PLAN_NAME)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return PLAN_CODE_BY_NAME[normalized] || null;
}

export function publicPlanName(planCode?: string | null) {
  return PLAN_BY_CODE[String(planCode || "essential").toLowerCase()] || "Essential";
}

export function isoNow() {
  return new Date().toISOString();
}

export function addDaysIso(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

type CheckoutAccessSnapshot = {
  plan: "Essential" | "Professional" | "Enterprise";
  plan_code: "essential" | "professional" | "enterprise";
  status: string;
  access_state: string;
};

/**
 * Checkout is a billing intent, not proof of payment. Keep any valid access the
 * user already has (especially an active trial) until Asaas confirms payment.
 */
export function checkoutAccessSnapshot(subscription?: any): CheckoutAccessSnapshot {
  const status = String(subscription?.status || "");
  const accessState = String(subscription?.access_state || "");
  const planCode = String(subscription?.plan_code || "").toLowerCase();
  const plan = publicPlanName(planCode);
  const trialEndsAt = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).getTime()
    : Number.NaN;
  const activeTrial = status === "trialing" &&
    accessState === "trial_access" &&
    Number.isFinite(trialEndsAt) &&
    trialEndsAt > Date.now();
  const currentlyUsable =
    activeTrial ||
    status === "admin_override" ||
    (status === "active" && ["limited_access", "paid_access"].includes(accessState));

  if (subscription && currentlyUsable && PLAN_BY_CODE[planCode]) {
    return {
      plan,
      plan_code: planCode as CheckoutAccessSnapshot["plan_code"],
      status,
      access_state: accessState,
    };
  }

  return {
    plan: "Essential",
    plan_code: "essential",
    status: "active",
    access_state: "limited_access",
  };
}

/** First paid due date starts after the remaining trial instead of consuming it. */
export function checkoutNextDueDate(subscription?: any, now = new Date()) {
  const trialEndsAt = subscription?.status === "trialing" && subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;

  if (trialEndsAt && Number.isFinite(trialEndsAt.getTime()) && trialEndsAt.getTime() > now.getTime()) {
    return trialEndsAt.toISOString().slice(0, 10);
  }

  return now.toISOString().slice(0, 10);
}

/** Keep every remaining trial day when an early payment is confirmed. */
export function paidPeriodEndPreservingTrial(
  providerPeriodEnd: Date,
  trialEndsAt?: string | null,
  now = new Date(),
) {
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  if (!trialEnd || !Number.isFinite(trialEnd.getTime()) || trialEnd.getTime() <= now.getTime()) {
    return providerPeriodEnd;
  }

  const trialBackedPeriodEnd = new Date(trialEnd.getTime());
  trialBackedPeriodEnd.setUTCMonth(trialBackedPeriodEnd.getUTCMonth() + 1);
  return trialBackedPeriodEnd.getTime() > providerPeriodEnd.getTime()
    ? trialBackedPeriodEnd
    : providerPeriodEnd;
}

export function isTrialExpired(subscription: any) {
  if (subscription?.status !== "trialing" || !subscription?.trial_ends_at) return false;
  const endsAt = new Date(subscription.trial_ends_at).getTime();
  return Number.isFinite(endsAt) && endsAt <= Date.now();
}

export function accessStateFor(status: string, planCode = PROFESSIONAL_PLAN_CODE) {
  if (status === "admin_override") return "admin_override";
  if (status === "trialing") return "trial_access";
  if (status === "active") return planCode === "essential" ? "limited_access" : "paid_access";
  return "blocked";
}

export function statusRequiresUpsell(status: string) {
  return UPSELL_STATUSES.has(status);
}

export function canUseCurrentAccess(status: string, accessState: string) {
  return PAID_ACCESS_STATUSES.has(status) && USABLE_ACCESS_STATES.has(accessState);
}

export function isPatientPortalAccount(user?: SupabaseUser | null) {
  return String(user?.app_metadata?.account_role || "").trim().toLowerCase() === "patient";
}

function hasPaymentBackedPaidAccess(row: any, status: string, accessState: string) {
  if (status === "admin_override" || accessState === "admin_override") return true;
  if (status !== "active" || accessState !== "paid_access") return false;

  const paymentStatus = String(row?.last_payment_status || "").trim().toUpperCase();
  return Boolean(
    row?.last_payment_id ||
    PAYMENT_BACKED_STATUSES.has(paymentStatus) ||
    (row?.asaas_subscription_id && row?.last_payment_event_at),
  );
}

function canUseEntitlementAccess(row: any, status: string, accessState: string) {
  if (!canUseCurrentAccess(status, accessState)) return false;
  if (status === "active" && accessState === "paid_access") {
    return hasPaymentBackedPaidAccess(row, status, accessState);
  }
  return true;
}

export function subscriptionMessage(status: string, plan: string) {
  switch (status) {
    case "trialing":
      return "Seu teste grátis está ativo.";
    case "trial_expired":
      return "Seu teste grátis terminou. Assine para continuar usando os recursos pagos.";
    case "checkout_pending":
      return "Seu checkout está em andamento. Conclua o pagamento para liberar o plano.";
    case "payment_pending":
      return "Estamos aguardando a confirmação do pagamento.";
    case "past_due":
    case "grace_period":
      return "Existe uma cobrança pendente. Regularize para manter o acesso.";
    case "blocked":
      return "Seu acesso aos recursos pagos está bloqueado.";
    case "canceled":
      return "Sua assinatura foi cancelada.";
    case "refunded":
      return "O pagamento da assinatura foi estornado.";
    case "chargeback":
      return "Há uma contestação de pagamento em aberto.";
    case "internal_error":
      return "Não conseguimos sincronizar sua assinatura agora.";
    case "admin_override":
      return "Seu acesso foi liberado manualmente pela equipe NeuroNex.";
    case "active":
      return plan === "Essential" ? "Você está no plano Essential." : "Sua assinatura está ativa.";
    default:
      return "Assinatura pendente de regularização.";
  }
}

export function reactFeatureShape(features: Record<string, unknown>, limits: Record<string, unknown>) {
  const patientLimit = limits?.patients;

  return {
    maxPatients:
      patientLimit === "unlimited" || patientLimit === null || typeof patientLimit === "undefined"
        ? "unlimited"
        : Number(patientLimit),
    hasAICopilot: Boolean(features?.ai_copilot),
    hasTelemedicine: Boolean(features?.telemedicine),
    hasAdvancedFinance: Boolean(features?.advanced_finance),
    hasPatientPortal: Boolean(features?.patient_portal),
    hasAdminDashboard: Boolean(features?.admin_dashboard),
    hasAPIAccess: Boolean(features?.api_access),
  };
}

export function buildEntitlementResponse(row: any, user?: SupabaseUser, checkout?: any) {
  const rawStatus = String(row?.effective_status || row?.status || "inactive");
  const rawAccessState = String(row?.effective_access_state || row?.access_state || "blocked");
  const rawPlanCode = String(row?.plan_code || "essential");
  const paymentBackedAccess = hasPaymentBackedPaidAccess(row, rawStatus, rawAccessState);
  const pendingCheckoutWithoutPayment = ["trial_expired", "checkout_pending", "payment_pending"].includes(rawStatus) && !paymentBackedAccess;
  const activeWithoutPaymentProof = rawStatus === "active" && rawAccessState === "paid_access" && !paymentBackedAccess;
  const shouldUseEssentialFallback = pendingCheckoutWithoutPayment || activeWithoutPaymentProof;
  const status = shouldUseEssentialFallback ? "active" : rawStatus;
  const accessState = shouldUseEssentialFallback ? "limited_access" : rawAccessState;
  const planCode = shouldUseEssentialFallback ? "essential" : rawPlanCode;
  const plan = publicPlanName(planCode);
  const configuredFeatures = (row?.features || {}) as Record<string, unknown>;
  const configuredLimits = (row?.limits || {}) as Record<string, unknown>;
  const configuredInternalFlags = (row?.internal_flags || {}) as Record<string, unknown>;
  const currentAccessAllowed = canUseEntitlementAccess(row, status, accessState);
  const exposedFeatures = shouldUseEssentialFallback ? ESSENTIAL_FEATURES : currentAccessAllowed ? configuredFeatures : ESSENTIAL_FEATURES;
  const exposedLimits = shouldUseEssentialFallback ? ESSENTIAL_LIMITS : currentAccessAllowed ? configuredLimits : ESSENTIAL_LIMITS;
  const exposedInternalFlags = shouldUseEssentialFallback ? ESSENTIAL_INTERNAL_FLAGS : currentAccessAllowed ? configuredInternalFlags : ESSENTIAL_INTERNAL_FLAGS;
  const trialEndsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : undefined;
  const currentPeriodEnd = row?.current_period_end ? new Date(row.current_period_end) : undefined;
  const isTrial = status === "trialing";
  const messageStatus = status;
  const daysUntilTrialEnds =
    isTrial && trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : undefined;

  return {
    plan,
    planCode,
    status,
    accessState,
    features: reactFeatureShape(exposedFeatures, exposedLimits),
    rawFeatures: exposedFeatures,
    limits: exposedLimits,
    internalFlags: exposedInternalFlags,
    isDevAccount: user?.email === "jotahub@gmail.com" || status === "admin_override",
    subscriptionId: row?.asaas_subscription_id || row?.subscription_record_id || undefined,
    checkoutSessionId: checkout?.external_reference || undefined,
    checkoutUrl: checkout?.checkout_url || undefined,
    currentPeriodEnd: currentPeriodEnd?.toISOString(),
    trialEndsAt: trialEndsAt?.toISOString(),
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    scheduledPlanCode: row?.scheduled_plan_code || undefined,
    scheduledChangeAt: row?.scheduled_change_at || undefined,
    accessEndsAt: row?.access_ends_at || undefined,
    transitionEndsAt: row?.transition_ends_at || undefined,
    dataCustodyState: row?.data_custody_state || "active",
    exportAvailableUntil: row?.export_available_until || undefined,
    isTrial,
    isTrialExpired: status === "trial_expired",
    daysUntilTrialEnds,
    hasPaidAccess: paymentBackedAccess,
    paymentBackedAccess,
    canUseCurrentAccess: currentAccessAllowed,
    requiresUpsell: shouldUseEssentialFallback ? false : Boolean(row?.requires_upsell) || statusRequiresUpsell(status),
    message: subscriptionMessage(messageStatus, plan),
  };
}

async function auditSubscription(values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("subscription_audit_logs").insert({
    actor_type: "edge_function",
    ...values,
  });
  if (error) console.warn("[subscription-access] audit insert failed:", error);
}

export async function getUserSubscription(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startTrialIfMissing(user: SupabaseUser) {
  if (isPatientPortalAccount(user)) return null;

  const existing = await getUserSubscription(user.id);
  if (existing) return existing;

  const now = new Date();
  const trialEndsAt = addDaysIso(now, TRIAL_DAYS);
  const payload = {
    user_id: user.id,
    plan: PROFESSIONAL_PLAN_NAME,
    plan_code: PROFESSIONAL_PLAN_CODE,
    status: "trialing",
    access_state: "trial_access",
    current_period_start: now.toISOString(),
    current_period_end: trialEndsAt,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEndsAt,
    metadata: {
      source: "get-current-entitlement",
      trial_days: TRIAL_DAYS,
    },
    updated_at: now.toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  await auditSubscription({
    user_id: user.id,
    subscription_record_id: data.id,
    action: "trial_started",
    to_status: "trialing",
    to_access_state: "trial_access",
    reason: "missing_subscription_record",
    metadata: { trial_days: TRIAL_DAYS },
  });

  return data;
}

async function resolveUserAppMetadata(user: SupabaseUser): Promise<SupabaseUser> {
  if (user.app_metadata) return user;

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(user.id);
  if (error || !data?.user) {
    if (error) console.warn("[subscription-access] auth user lookup failed:", error);
    return user;
  }

  return {
    ...user,
    email: user.email || data.user.email,
    app_metadata: data.user.app_metadata || {},
    user_metadata: user.user_metadata || data.user.user_metadata || {},
  };
}

export async function expireTrialIfNeeded(subscription: any) {
  if (!subscription || !isTrialExpired(subscription)) return subscription;

  const now = isoNow();
  const nextMetadata = {
    ...((subscription.metadata || {}) as Record<string, unknown>),
    trial_expired_at: now,
    trial_expired_by: "subscription-access",
  };

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({
      plan: "Essential",
      plan_code: "essential",
      status: "active",
      access_state: "limited_access",
      blocked_at: null,
      metadata: nextMetadata,
      status_version: Number(subscription.status_version || 0) + 1,
      updated_at: now,
    })
    .eq("user_id", subscription.user_id)
    .eq("status", "trialing")
    .select()
    .maybeSingle();

  if (error) throw error;

  await auditSubscription({
    user_id: subscription.user_id,
    subscription_record_id: subscription.id,
    action: "trial_expired_essential_started",
    from_status: "trialing",
    to_status: "active",
    from_access_state: subscription.access_state || "trial_access",
    to_access_state: "limited_access",
    reason: "trial_end_reached_essential_fallback",
    metadata: { trial_ends_at: subscription.trial_ends_at },
  });

  return data || { ...subscription, plan: "Essential", plan_code: "essential", status: "active", access_state: "limited_access" };
}

export async function getOpenCheckoutSession(userId: string, planCode = PROFESSIONAL_PLAN_CODE) {
  const { data, error } = await supabaseAdmin
    .from("subscription_checkout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_code", planCode)
    .in("status", ["pending", "created", "checkout_pending", "payment_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (data?.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin
      .from("subscription_checkout_sessions")
      .update({
        status: "expired",
        error_message: "Checkout expirado localmente.",
        updated_at: isoNow(),
      })
      .eq("id", data.id);
    return null;
  }

  return data;
}

export async function readCurrentEntitlement(user: SupabaseUser) {
  const resolvedUser = await resolveUserAppMetadata(user);
  if (isPatientPortalAccount(resolvedUser)) {
    return {
      ...buildEntitlementResponse(null, resolvedUser, null),
      status: "patient_portal",
      accessState: "patient_portal",
      isTrial: false,
      hasPaidAccess: false,
      paymentBackedAccess: false,
      canUseCurrentAccess: false,
      requiresUpsell: false,
      message: "Conta destinada ao Portal do Paciente.",
    };
  }

  let subscription = await startTrialIfMissing(resolvedUser);
  subscription = await expireTrialIfNeeded(subscription);

  const { data: row, error } = await supabaseAdmin
    .from("current_subscription_entitlements")
    .select("*")
    .eq("user_id", resolvedUser.id)
    .maybeSingle();
  if (error) throw error;

  const checkout =
    await getOpenCheckoutSession(resolvedUser.id, String(row?.plan_code || PROFESSIONAL_PLAN_CODE)) ||
    await getOpenCheckoutSession(resolvedUser.id, PROFESSIONAL_PLAN_CODE);
  return buildEntitlementResponse(row, resolvedUser, checkout);
}

export async function markProfilePlan(userId: string, plan: string) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ subscription_plan: plan, updated_at: isoNow() })
    .eq("id", userId);
  if (error) console.warn("[subscription-access] profile plan update failed:", error);
}

export async function findOrCreateAsaasCustomer(input: {
  userId: string;
  existingCustomerId?: string | null;
  name: string;
  email: string;
  cpfCnpj?: string | null;
  phone?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  province?: string | null;
  postalCode?: string | null;
}) {
  const existingCustomerId = String(input.existingCustomerId || "").trim();
  const cpfCnpj = sanitizeDigits(input.cpfCnpj);
  if (!cpfCnpj || /^0+$/.test(cpfCnpj) || ![11, 14].includes(cpfCnpj.length)) {
    return null;
  }
  const phone = sanitizeDigits(input.phone);
  const postalCode = sanitizeDigits(input.postalCode);
  const externalReference = `neuronex_user_${input.userId}`;
  const customerPayload = {
    name: input.name,
    cpfCnpj,
    email: input.email || undefined,
    phone: phone || undefined,
    mobilePhone: phone || undefined,
    address: input.address?.trim() || undefined,
    addressNumber: input.addressNumber?.trim() || undefined,
    complement: input.complement?.trim() || undefined,
    province: input.province?.trim() || undefined,
    postalCode: postalCode || undefined,
    externalReference,
    groupName: "NeuroNex SaaS",
    notificationDisabled: false,
  };

  if (existingCustomerId) {
    await asaasRequest<any>(`/customers/${encodeURIComponent(existingCustomerId)}`, "PUT", customerPayload);
    return existingCustomerId;
  }

  const listResult = await asaasRequest<any>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,
    "GET",
  );
  const found = Array.isArray(listResult?.data) ? listResult.data[0] : null;
  const customerId = String(found?.id || "");

  if (customerId) {
    await asaasRequest<any>(`/customers/${encodeURIComponent(customerId)}`, "PUT", customerPayload);
    return customerId;
  }

  const created = await asaasRequest<any>("/customers", "POST", customerPayload);

  return String(created?.id || "") || null;
}

export function asaasCheckoutUrl(checkoutId: string) {
  return `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
}

export function asaasBillingTypesForCheckout() {
  // Asaas Checkout RECURRENT currently allows only CREDIT_CARD.
  // Pix/boleto recurring must use a separate subscription/payment flow, not Checkout RECURRENT.
  return ["CREDIT_CARD"];
}

export function subscriptionMetadata(extra?: Record<string, unknown>) {
  return {
    source: "neuronex-saas-billing",
    asaas_environment: ASAAS_ENV,
    ...(extra || {}),
  };
}

export class SubscriptionAccessError extends Error {
  status = 402;
  code: string;
  entitlement: Record<string, unknown> | null;

  constructor(message: string, code: string, entitlement: Record<string, unknown> | null = null) {
    super(message);
    this.name = "SubscriptionAccessError";
    this.code = code;
    this.entitlement = entitlement;
  }
}

const INTERNAL_FLAG_BY_FEATURE: Record<string, string> = {
  neurodrive: "can_use_neurodrive",
  synapse: "can_use_synapse",
  neurofinance: "can_use_neurofinance",
  neurobox: "can_use_neurobox",
  synapse_whatsapp: "can_use_whatsapp",
  neurozap: "can_use_whatsapp",
};

const PAID_ONLY_FEATURES = new Set([
  "advanced_finance",
  "neurofinance",
  "fiscal",
  "synapse_whatsapp",
  "neurozap",
]);

export function hasEntitlementFeature(entitlement: any, featureKey: string) {
  if (!entitlement?.canUseCurrentAccess && !entitlement?.isDevAccount) return false;
  if (entitlement?.isDevAccount) return true;
  if (featureKey === "basic_access" || featureKey === "patients") return true;
  if (PAID_ONLY_FEATURES.has(featureKey)) {
    if (entitlement?.accessState !== "paid_access" && entitlement?.status !== "admin_override") {
      return false;
    }
  }
  if (featureKey === "unlimited_patients") {
    return entitlement?.features?.maxPatients === "unlimited";
  }

  const internalFlag = INTERNAL_FLAG_BY_FEATURE[featureKey];
  if (internalFlag && entitlement?.internalFlags?.[internalFlag] === true) return true;

  return Boolean(entitlement?.rawFeatures?.[featureKey]);
}

export async function requireEntitlementForUser(user: SupabaseUser, featureKey: string) {
  const entitlement = await readCurrentEntitlement(user);

  if (!entitlement.canUseCurrentAccess && !entitlement.isDevAccount) {
    throw new SubscriptionAccessError(
      entitlement.message || "Seu acesso está bloqueado. Regularize sua assinatura para continuar.",
      "subscription_access_blocked",
      entitlement,
    );
  }

  if (!hasEntitlementFeature(entitlement, featureKey)) {
    throw new SubscriptionAccessError(
      "Seu plano atual não inclui este recurso.",
      "feature_not_in_plan",
      entitlement,
    );
  }

  return entitlement;
}

export async function requireRequestEntitlement(req: Request, featureKey: string) {
  const user = await getAuthenticatedUser(req);
  const entitlement = await requireEntitlementForUser(
    {
      id: user.id,
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    },
    featureKey,
  );

  return { user, entitlement };
}

export function isSubscriptionAccessError(error: unknown): error is SubscriptionAccessError {
  return error instanceof SubscriptionAccessError || (error as { name?: string })?.name === "SubscriptionAccessError";
}

export function subscriptionAccessErrorResponse(error: unknown) {
  if (!isSubscriptionAccessError(error)) return null;

  return errorResponse(error.message, error.status, {
    code: error.code,
    requires_upsell: true,
    entitlement: error.entitlement,
  });
}
