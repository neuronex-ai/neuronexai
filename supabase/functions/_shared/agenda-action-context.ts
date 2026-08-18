export type AgendaIntegrationHealth =
  | "not_connected"
  | "scope_missing"
  | "token_expired"
  | "configured"
  | "reconnect_required";

export type PatientCpfStatus = "valid" | "missing" | "invalid" | "not_loaded";

export interface AgendaActionContext {
  professionalId: string;
  generatedAt: string;
  entitlement: {
    planCode: string;
    status: string;
    accessState: string;
    canUseCurrentAccess: boolean;
    manualFinance: boolean;
    neurofinance: boolean;
  };
  google: {
    calendar: { configured: boolean; scopePresent: boolean; health: AgendaIntegrationHealth };
    gmail: { configured: boolean; scopePresent: boolean; health: AgendaIntegrationHealth };
    tokenExpiresAt: string | null;
    tokenUpdatedAt: string | null;
  };
  neurofinance: {
    availableByPlan: boolean;
    accountExists: boolean;
    status: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    pixEnabled: boolean;
    cardEnabled: boolean;
    syncHealthy: boolean;
    allowed: boolean;
  };
  patient: null | {
    patientId: string;
    cpf: PatientCpfStatus;
    hasAsaasCustomer: boolean;
    financialDefaults: null | {
      planType: string | null;
      sessionValueCents: number | null;
      monthlyValueCents: number | null;
      billingDay: number | null;
    };
    activePackages: Array<{
      packageId: string;
      totalSessions: number;
      usedSessions: number;
      reservedSessions: number;
      availableSessions: number;
      validUntil: string | null;
      billingStatus: string | null;
      defaultPaymentMethod: string | null;
    }>;
    lastAppointment: null | {
      appointmentId: string;
      startTime: string;
      endTime: string;
      type: string | null;
      status: string | null;
      price: number | null;
      financialMode: string | null;
    };
  };
  availability: null | {
    versionId: string;
    versionNumber: number;
    timezone: string;
    effectiveFrom: string;
    status: string;
  };
  allowedFinancialModes: Array<"manual" | "neurofinance" | "package">;
}

type SupabaseLike = {
  from: (table: string) => any;
};

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const digits = (value: unknown) => clean(value, 40).replace(/\D/g, "");

export function isValidBrazilianCpf(value: unknown) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const numbers = cpf.split("").map(Number);
  const digit = (length: number) => {
    const sum = numbers.slice(0, length).reduce((total, number, index) => total + number * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === numbers[9] && digit(10) === numbers[10];
}

export function cpfStatus(value: unknown): PatientCpfStatus {
  const cpf = digits(value);
  if (!cpf) return "missing";
  return isValidBrazilianCpf(cpf) ? "valid" : "invalid";
}

const scopeTokens = (value: unknown) => new Set(
  clean(value, 6000).split(/\s+/).map((scope) => scope.trim()).filter(Boolean),
);

const hasAnyScope = (scopes: Set<string>, candidates: string[]) =>
  candidates.some((scope) => scopes.has(scope));

export function googleCapabilitySnapshot(token: {
  expires_at?: string | null;
  scope?: string | null;
  updated_at?: string | null;
} | null, now = new Date()) {
  if (!token) {
    return {
      calendar: { configured: false, scopePresent: false, health: "not_connected" as const },
      gmail: { configured: false, scopePresent: false, health: "not_connected" as const },
      tokenExpiresAt: null,
      tokenUpdatedAt: null,
    };
  }
  const scopes = scopeTokens(token.scope);
  const calendarScope = hasAnyScope(scopes, [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  const gmailScope = hasAnyScope(scopes, [
    "https://www.googleapis.com/auth/gmail.send",
    "https://mail.google.com/",
  ]);
  const expiry = token.expires_at ? new Date(token.expires_at) : null;
  const expired = Boolean(expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() <= now.getTime());
  const health = (scopePresent: boolean): AgendaIntegrationHealth => {
    if (!scopePresent) return "scope_missing";
    if (expired) return "token_expired";
    return "configured";
  };
  return {
    calendar: { configured: calendarScope, scopePresent: calendarScope, health: health(calendarScope) },
    gmail: { configured: gmailScope, scopePresent: gmailScope, health: health(gmailScope) },
    tokenExpiresAt: token.expires_at || null,
    tokenUpdatedAt: token.updated_at || null,
  };
}

const singleOrNull = <T>(value: T[] | T | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] || null) : (value || null);

export async function loadAgendaActionContext(input: {
  admin: SupabaseLike;
  professionalId: string;
  patientId?: string | null;
  now?: Date;
}): Promise<AgendaActionContext> {
  const { admin } = input;
  const professionalId = clean(input.professionalId, 120);
  const patientId = clean(input.patientId, 120);
  const now = input.now || new Date();

  const [entitlementResult, googleResult, financeAccountResult, availabilityResult] = await Promise.all([
    admin.from("current_subscription_entitlements")
      .select("plan_code,effective_status,effective_access_state,features,internal_flags,has_current_access")
      .eq("user_id", professionalId)
      .limit(1),
    admin.from("user_google_tokens")
      .select("expires_at,scope,updated_at")
      .eq("user_id", professionalId)
      .limit(1),
    admin.from("financial_accounts")
      .select("status,charges_enabled,payouts_enabled,details_submitted,pix_enabled,card_enabled,last_sync_error,updated_at")
      .eq("user_id", professionalId)
      .limit(1),
    admin.from("professional_availability_versions")
      .select("id,version_number,timezone,effective_from,status")
      .eq("professional_id", professionalId)
      .eq("status", "active")
      .order("version_number", { ascending: false })
      .limit(1),
  ]);

  if (entitlementResult.error) throw new Error(`Falha ao carregar entitlement da Agenda: ${entitlementResult.error.message}`);
  if (googleResult.error) throw new Error(`Falha ao carregar integração Google: ${googleResult.error.message}`);
  if (financeAccountResult.error) throw new Error(`Falha ao carregar NeuroFinance: ${financeAccountResult.error.message}`);
  if (availabilityResult.error) throw new Error(`Falha ao carregar disponibilidade: ${availabilityResult.error.message}`);

  const entitlement: any = singleOrNull(entitlementResult.data);
  const googleToken: any = singleOrNull(googleResult.data);
  const financeAccount: any = singleOrNull(financeAccountResult.data);
  const availability: any = singleOrNull(availabilityResult.data);
  const rawFeatures = entitlement?.features || {};
  const internalFlags = entitlement?.internal_flags || {};
  const manualFinance = true;
  const neurofinanceByPlan = Boolean(rawFeatures.neurofinance ?? internalFlags.can_use_neurofinance);
  const hasAccess = Boolean(entitlement?.has_current_access);
  const google = googleCapabilitySnapshot(googleToken, now);

  let patient: AgendaActionContext["patient"] = null;
  if (patientId) {
    const [patientResult, financialSettingsResult, packagesResult, appointmentResult] = await Promise.all([
      admin.from("patients")
        .select("id,cpf,payer_cpf,asaas_customer_id")
        .eq("id", patientId)
        .eq("user_id", professionalId)
        .limit(1),
      admin.from("patient_financial_settings")
        .select("plan_type,session_value_cents,monthly_value_cents,billing_day,updated_at")
        .eq("patient_id", patientId)
        .eq("user_id", professionalId)
        .limit(1),
      admin.from("patient_packages")
        .select("id,total_sessions,sessions_used,sessions_reserved,end_date,active,package_status,billing_status,default_payment_method")
        .eq("patient_id", patientId)
        .eq("user_id", professionalId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("appointments")
        .select("id,start_time,end_time,type,status,price,payment_config")
        .eq("patient_id", patientId)
        .eq("user_id", professionalId)
        .order("start_time", { ascending: false })
        .limit(1),
    ]);

    if (patientResult.error) throw new Error(`Falha ao carregar paciente para preflight: ${patientResult.error.message}`);
    if (financialSettingsResult.error) throw new Error(`Falha ao carregar defaults financeiros: ${financialSettingsResult.error.message}`);
    if (packagesResult.error) throw new Error(`Falha ao carregar pacotes: ${packagesResult.error.message}`);
    if (appointmentResult.error) throw new Error(`Falha ao carregar último agendamento: ${appointmentResult.error.message}`);

    const row: any = singleOrNull(patientResult.data);
    if (row) {
      const settings: any = singleOrNull(financialSettingsResult.data);
      const lastAppointment: any = singleOrNull(appointmentResult.data);
      const packages = (packagesResult.data || [])
        .filter((pkg: any) => {
          const status = clean(pkg.package_status || pkg.active, 40).toLowerCase();
          const endDate = pkg.end_date ? new Date(`${pkg.end_date}T23:59:59Z`) : null;
          return !["ended", "cancelled", "expired", "inactive", "false"].includes(status) &&
            (!endDate || endDate.getTime() >= now.getTime());
        })
        .map((pkg: any) => {
          const totalSessions = Math.max(0, Number(pkg.total_sessions) || 0);
          const usedSessions = Math.max(0, Number(pkg.sessions_used) || 0);
          const reservedSessions = Math.max(0, Number(pkg.sessions_reserved) || 0);
          return {
            packageId: clean(pkg.id, 120),
            totalSessions,
            usedSessions,
            reservedSessions,
            availableSessions: Math.max(0, totalSessions - usedSessions - reservedSessions),
            validUntil: pkg.end_date || null,
            billingStatus: clean(pkg.billing_status, 60) || null,
            defaultPaymentMethod: clean(pkg.default_payment_method, 60) || null,
          };
        });
      const paymentConfig = lastAppointment?.payment_config && typeof lastAppointment.payment_config === "object"
        ? lastAppointment.payment_config
        : {};
      patient = {
        patientId: clean(row.id, 120),
        cpf: cpfStatus(row.cpf || row.payer_cpf),
        hasAsaasCustomer: Boolean(clean(row.asaas_customer_id, 180)),
        financialDefaults: settings ? {
          planType: clean(settings.plan_type, 60) || null,
          sessionValueCents: Number.isFinite(Number(settings.session_value_cents)) ? Number(settings.session_value_cents) : null,
          monthlyValueCents: Number.isFinite(Number(settings.monthly_value_cents)) ? Number(settings.monthly_value_cents) : null,
          billingDay: Number.isFinite(Number(settings.billing_day)) ? Number(settings.billing_day) : null,
        } : null,
        activePackages: packages,
        lastAppointment: lastAppointment ? {
          appointmentId: clean(lastAppointment.id, 120),
          startTime: String(lastAppointment.start_time || ""),
          endTime: String(lastAppointment.end_time || ""),
          type: clean(lastAppointment.type, 80) || null,
          status: clean(lastAppointment.status, 80) || null,
          price: Number.isFinite(Number(lastAppointment.price)) ? Number(lastAppointment.price) : null,
          financialMode: clean(paymentConfig.financial_mode || paymentConfig.mode, 80) || null,
        } : null,
      };
    }
  }

  const chargesEnabled = Boolean(financeAccount?.charges_enabled);
  const detailsSubmitted = Boolean(financeAccount?.details_submitted);
  const accountOperational = Boolean(financeAccount) &&
    !["restricted", "blocked", "rejected", "pending"].includes(clean(financeAccount?.status, 40).toLowerCase()) &&
    chargesEnabled && detailsSubmitted;
  const patientCpfAllowsCharge = !patient || patient.cpf === "valid";
  const neurofinanceAllowed = hasAccess && neurofinanceByPlan && accountOperational && patientCpfAllowsCharge;

  const modes: AgendaActionContext["allowedFinancialModes"] = [];
  if (manualFinance) modes.push("manual");
  if (neurofinanceAllowed) modes.push("neurofinance");
  if (patient?.activePackages.some((pkg) => pkg.availableSessions > 0)) modes.push("package");

  return {
    professionalId,
    generatedAt: now.toISOString(),
    entitlement: {
      planCode: clean(entitlement?.plan_code, 40) || "essential",
      status: clean(entitlement?.effective_status, 60) || "inactive",
      accessState: clean(entitlement?.effective_access_state, 60) || "blocked",
      canUseCurrentAccess: hasAccess,
      manualFinance,
      neurofinance: neurofinanceByPlan,
    },
    google,
    neurofinance: {
      availableByPlan: neurofinanceByPlan,
      accountExists: Boolean(financeAccount),
      status: clean(financeAccount?.status, 60) || "not_configured",
      chargesEnabled,
      payoutsEnabled: Boolean(financeAccount?.payouts_enabled),
      detailsSubmitted,
      pixEnabled: Boolean(financeAccount?.pix_enabled),
      cardEnabled: Boolean(financeAccount?.card_enabled),
      syncHealthy: !clean(financeAccount?.last_sync_error, 500),
      allowed: neurofinanceAllowed,
    },
    patient,
    availability: availability ? {
      versionId: clean(availability.id, 120),
      versionNumber: Number(availability.version_number) || 0,
      timezone: clean(availability.timezone, 80) || "America/Sao_Paulo",
      effectiveFrom: String(availability.effective_from || ""),
      status: clean(availability.status, 40) || "active",
    } : null,
    allowedFinancialModes: modes,
  };
}
