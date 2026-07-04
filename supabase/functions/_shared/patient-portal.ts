import {
  errorResponse,
  getAuthenticatedUser,
  jsonResponse,
  supabaseAdmin,
} from "./asaas-client.ts";

export const PORTAL_INVITE_DAYS = 7;
export const PORTAL_MAX_ATTEMPTS = 5;

const encoder = new TextEncoder();

export function appBaseUrl() {
  const raw = (
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("FRONTEND_URL") ||
    "https://www.neuronexai.com.br"
  ).replace(/\/+$/, "");
  const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const isLocalSupabase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(supabaseUrl);

  if (isLocalUrl && !isLocalSupabase) return "https://www.neuronexai.com.br";
  if (raw === "https://neuronexai.com.br") return "https://www.neuronexai.com.br";
  return raw;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generatePortalToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function generateActivationCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

export async function hmacHex(value: string) {
  const secret =
    Deno.env.get("PATIENT_PORTAL_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "neuronex-patient-portal-local-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function maskEmail(email?: string | null) {
  const value = String(email || "");
  const [name, domain] = value.split("@");
  if (!name || !domain) return "";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

export function publicProfessionalName(profile: any) {
  return (
    profile?.full_name ||
    profile?.name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "Seu psicologo"
  );
}

export async function auditPortal(values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("patient_portal_audit_logs").insert({
    actor_type: "edge_function",
    ...values,
  });
  if (error) console.warn("[patient-portal] audit failed:", error);
}

type PortalEntitlementOptions = {
  allowLegacyFallback?: boolean;
};

function legacyPortalEntitlement() {
  return {
    status: "legacy_fallback",
    accessState: "continuity",
    planCode: "legacy",
    hasPortal: true,
    hasPaidAccess: true,
    canInvite: true,
  };
}

export async function readProfessionalPortalEntitlement(
  psychologistUserId: string,
  options: PortalEntitlementOptions = {},
) {
  const { data, error } = await supabaseAdmin
    .from("current_subscription_entitlements")
    .select("*")
    .eq("user_id", psychologistUserId)
    .maybeSingle();
  if (error) {
    console.warn("[patient-portal] entitlement lookup failed:", error);
    if (options.allowLegacyFallback) return legacyPortalEntitlement();
    throw error;
  }

  const status = String(data?.effective_status || data?.status || "inactive");
  const accessState = String(data?.effective_access_state || data?.access_state || "blocked");
  const planCode = String(data?.plan_code || "essential").toLowerCase();
  const features = (data?.features || {}) as Record<string, unknown>;
  const hasPortal = Boolean(features.patient_portal) || ["professional", "enterprise"].includes(planCode);
  const hasPaidAccess =
    status === "admin_override" ||
    Boolean(data?.has_paid_access) ||
    (status === "active" && accessState === "paid_access");

  return {
    status,
    accessState,
    planCode,
    hasPortal,
    hasPaidAccess,
    canInvite: hasPortal && hasPaidAccess,
  };
}

export async function requirePsychologistPortalAccess(req: Request) {
  const user = await getAuthenticatedUser(req);
  const entitlement = await readProfessionalPortalEntitlement(user.id);
  if (!entitlement.canInvite) {
    return {
      user,
      entitlement,
      response: errorResponse("Portal do Paciente esta disponivel apenas para Professional/Enterprise com assinatura ativa.", 402, {
        code: "patient_portal_not_available",
        entitlement,
      }),
    };
  }
  return { user, entitlement, response: null };
}

export async function getPatientPortalContext(patientUser: {
  id: string;
  email?: string | null;
}) {
  const { data: links, error: linksError } = await supabaseAdmin
    .from("patient_portal_links")
    .select("*")
    .eq("patient_user_id", patientUser.id)
    .order("created_at", { ascending: false });
  if (linksError) throw linksError;

  if (!links?.length) {
    return {
      status: "needs_activation",
      patient: null,
      professional: null,
      features: {},
      linkedProfiles: [],
      message: "Insira o codigo recebido por e-mail para ativar seu portal.",
    };
  }

  const preferred = links.find((link: any) => link.status === "active") || links[0];
  const [patientResult, profileResult, entitlement] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id,name,email,phone,status")
      .eq("id", preferred.patient_id)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name")
      .eq("id", preferred.psychologist_user_id)
      .maybeSingle(),
    readProfessionalPortalEntitlement(preferred.psychologist_user_id, { allowLegacyFallback: true }),
  ]);

  if (patientResult.error) throw patientResult.error;
  if (profileResult.error) throw profileResult.error;

  let status = String(preferred.status || "suspended");
  let message = "Portal ativo.";
  if (status !== "active") {
    message = status === "revoked" ? "Seu acesso ao portal foi revogado." : "Seu portal esta suspenso.";
  } else if (!entitlement.canInvite) {
    status = "suspended";
    message = "Portal temporariamente indisponivel.";
  }

  const linkedProfiles = await Promise.all(
    links.map(async (link: any) => {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name")
        .eq("id", link.psychologist_user_id)
        .maybeSingle();
      return {
        linkId: link.id,
        patientId: link.patient_id,
        status: link.status,
        professional: {
          id: profile?.id || link.psychologist_user_id,
          name: publicProfessionalName(profile),
          clinicName: null,
          avatarUrl: null,
        },
      };
    }),
  );

  await supabaseAdmin
    .from("patient_portal_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", preferred.id);

  return {
    status,
    linkId: preferred.id,
    patient: patientResult.data
      ? {
          id: patientResult.data.id,
          name: patientResult.data.name,
          email: patientResult.data.email,
          phone: patientResult.data.phone || null,
          avatarUrl: null,
          genderIdentity: null,
        }
      : null,
    professional: profileResult.data
      ? {
          id: profileResult.data.id,
          name: publicProfessionalName(profileResult.data),
          clinicName: null,
          avatarUrl: null,
        }
      : null,
    features: {
      appointments: true,
      mood: true,
      goals: true,
      progress: true,
      documents: true,
      billing: true,
      profile: true,
    },
    linkedProfiles,
    message,
  };
}

export async function requireActivePatientPortal(req: Request) {
  const user = await getAuthenticatedUser(req);
  const context = await getPatientPortalContext({
    id: user.id,
    email: user.email,
  });

  if (context.status !== "active" || !context.patient?.id || !context.professional?.id) {
    return {
      user,
      context,
      response: jsonResponse(context, context.status === "needs_activation" ? 403 : 402),
    };
  }

  return { user, context, response: null };
}
