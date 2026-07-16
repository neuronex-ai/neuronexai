import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export const appointmentCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export class AppointmentLifecycleError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 400,
    code = "APPOINTMENT_LIFECYCLE_ERROR",
  ) {
    super(message);
    this.name = "AppointmentLifecycleError";
    this.status = status;
    this.code = code;
  }
}

export function appointmentJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...appointmentCorsHeaders, "Content-Type": "application/json" },
  });
}

export function appointmentErrorResponse(error: unknown) {
  const status = error instanceof AppointmentLifecycleError
    ? error.status
    : 500;
  const code = error instanceof AppointmentLifecycleError
    ? error.code
    : "INTERNAL_ERROR";
  const message = error instanceof AppointmentLifecycleError
    ? error.message
    : "N\u00e3o foi poss\u00edvel processar o agendamento agora.";
  return appointmentJson({ error: message, code }, status);
}

export function appointmentAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/g,
    "",
  );
}

export function generateAppointmentToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function appointmentTokenHash(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function publicRequestMetadata(request: Request) {
  const forwardedFor =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  return {
    ipAddress: forwardedFor,
    userAgent: request.headers.get("user-agent") || null,
    requestedAt: new Date().toISOString(),
  };
}

export async function requireProfessional(
  request: Request,
  db: ReturnType<typeof appointmentAdminClient>,
) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    throw new AppointmentLifecycleError(
      "Autenticação necessária.",
      401,
      "AUTH_REQUIRED",
    );
  }

  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    throw new AppointmentLifecycleError(
      "Sessão inválida ou expirada.",
      401,
      "INVALID_SESSION",
    );
  }
  return data.user;
}

export type ResolvedAppointmentInvitation = {
  tokenHash: string;
  tokenRow: Record<string, any>;
  appointment: Record<string, any>;
  patient: Record<string, any> | null;
  professional: Record<string, any> | null;
  pendingRequest: Record<string, any> | null;
  policySnapshot: Record<string, any> | null;
};

export type AppointmentContextScope = {
  patientId?: string;
  professionalId?: string;
};

type AppointmentDatabaseClient = {
  from: (relation: string) => any;
};

/** Shared context resolver for every patient-facing appointment surface. */
export async function resolveAppointmentContextById(
  db: AppointmentDatabaseClient,
  appointmentId: string,
  scope: AppointmentContextScope = {},
): Promise<Omit<ResolvedAppointmentInvitation, "tokenHash" | "tokenRow">> {
  let appointmentQuery = db
    .from("appointments")
    .select(
      "id,user_id,patient_id,start_time,end_time,type,status,lifecycle_status,location,google_meet_link,created_at,updated_at,payment_status,invitation_sent_at,invitation_opened_at,confirmed_at,confirmation_revision,confirmed_revision,cancelled_at,cancellation_reason,reschedule_requested_at,reschedule_approved_at,reschedule_rejected_at,policy_snapshot_id,patient_right_status,patient_action_due_at,professional_response_due_at,financial_outcome,financial_protection_reason,outcome_review_required",
    )
    .eq("id", appointmentId);
  if (scope.patientId) {
    appointmentQuery = appointmentQuery.eq("patient_id", scope.patientId);
  }
  if (scope.professionalId) {
    appointmentQuery = appointmentQuery.eq("user_id", scope.professionalId);
  }

  const appointmentResult = await appointmentQuery.maybeSingle();
  if (appointmentResult.error) throw appointmentResult.error;
  if (!appointmentResult.data) {
    throw new AppointmentLifecycleError(
      "Agendamento n\u00e3o encontrado para este v\u00ednculo.",
      404,
      "APPOINTMENT_NOT_FOUND",
    );
  }

  const [patientResult, profileResult, requestResult, policyResult] =
    await Promise.all([
      appointmentResult.data.patient_id
        ? db.from("patients").select("id,name,email").eq(
          "id",
          appointmentResult.data.patient_id,
        ).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("profiles")
        .select(
          "id,first_name,last_name,full_name,name,clinic_name,avatar_url,address,address_line1,address_city,phone,working_hours",
        )
        .eq("id", appointmentResult.data.user_id)
        .maybeSingle(),
      db.from("appointment_reschedule_requests")
        .select(
          "status,original_start_time,original_end_time,requested_start_time,requested_end_time,reason,review_reason,reviewed_at,created_at,requested_at,within_free_window,professional_response_due_at,financial_right_protected,reaction_due_at,protection_reason,expired_without_response_at",
        )
        .eq("appointment_id", appointmentResult.data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      appointmentResult.data.policy_snapshot_id
        ? db.from("appointment_policy_snapshots")
          .select(
            "free_cancellation_cutoff_at,free_reschedule_cutoff_at,minimum_patient_reaction_hours,professional_response_sla_hours,late_cancellation_consequence,no_show_consequence,package_credit_policy,charge_policy,fiscal_policy,timezone",
          )
          .eq("id", appointmentResult.data.policy_snapshot_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (patientResult.error) throw patientResult.error;
  if (profileResult.error) throw profileResult.error;
  if (requestResult.error) throw requestResult.error;
  if (policyResult.error) throw policyResult.error;

  return {
    appointment: appointmentResult.data,
    patient: patientResult.data,
    professional: profileResult.data,
    pendingRequest: requestResult.data,
    policySnapshot: policyResult.data,
  };
}

export async function resolveAppointmentInvitation(
  db: ReturnType<typeof appointmentAdminClient>,
  rawToken: string,
): Promise<ResolvedAppointmentInvitation> {
  const token = String(rawToken || "").trim();
  if (token.length < 16 || token.length > 256) {
    throw new AppointmentLifecycleError(
      "Convite invalido ou expirado.",
      404,
      "INVALID_INVITATION",
    );
  }

  const tokenHash = await appointmentTokenHash(token);
  const tokenResult = await db
    .from("appointment_confirmation_tokens")
    .select(
      "id,appointment_id,appointment_revision,status,expires_at,sent_at,opened_at,used_at,revoked_at,metadata",
    )
    .eq("token_hash", tokenHash)
    .in("status", ["sent", "opened"])
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (tokenResult.error) throw tokenResult.error;
  if (!tokenResult.data) {
    throw new AppointmentLifecycleError(
      "Convite invalido ou expirado.",
      404,
      "INVALID_INVITATION",
    );
  }

  const appointmentResult = await db
    .from("appointments")
    .select(
      "id,user_id,patient_id,start_time,end_time,type,status,lifecycle_status,location,google_meet_link,created_at,updated_at,payment_status,invitation_sent_at,invitation_opened_at,confirmed_at,confirmation_revision,confirmed_revision,cancelled_at,cancellation_reason,reschedule_requested_at,reschedule_approved_at,reschedule_rejected_at,policy_snapshot_id,patient_right_status,patient_action_due_at,professional_response_due_at,financial_outcome,financial_protection_reason,outcome_review_required",
    )
    .eq("id", tokenResult.data.appointment_id)
    .maybeSingle();
  if (appointmentResult.error) throw appointmentResult.error;
  if (!appointmentResult.data) {
    throw new AppointmentLifecycleError(
      "Agendamento não encontrado.",
      404,
      "APPOINTMENT_NOT_FOUND",
    );
  }
  if (
    tokenResult.data.appointment_revision !==
      appointmentResult.data.confirmation_revision
  ) {
    throw new AppointmentLifecycleError(
      "Este convite foi substituido depois que os detalhes da consulta mudaram.",
      410,
      "SUPERSEDED_INVITATION",
    );
  }

  const [patientResult, profileResult, requestResult, policyResult] =
    await Promise.all([
      appointmentResult.data.patient_id
        ? db.from("patients").select("id,name,email").eq(
          "id",
          appointmentResult.data.patient_id,
        ).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db
        .from("profiles")
        .select(
          "id,first_name,last_name,full_name,name,clinic_name,avatar_url,address,address_line1,address_city,phone,working_hours",
        )
        .eq("id", appointmentResult.data.user_id)
        .maybeSingle(),
      db
        .from("appointment_reschedule_requests")
        .select(
          "status,original_start_time,original_end_time,requested_start_time,requested_end_time,reason,review_reason,reviewed_at,created_at,requested_at,within_free_window,professional_response_due_at,financial_right_protected,reaction_due_at,protection_reason,expired_without_response_at",
        )
        .eq("appointment_id", appointmentResult.data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      appointmentResult.data.policy_snapshot_id
        ? db
          .from("appointment_policy_snapshots")
          .select(
            "free_cancellation_cutoff_at,free_reschedule_cutoff_at,minimum_patient_reaction_hours,professional_response_sla_hours,late_cancellation_consequence,no_show_consequence,package_credit_policy,charge_policy,fiscal_policy,timezone",
          )
          .eq("id", appointmentResult.data.policy_snapshot_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  if (patientResult.error) throw patientResult.error;
  if (profileResult.error) throw profileResult.error;
  if (requestResult.error) throw requestResult.error;
  if (policyResult.error) throw policyResult.error;

  return {
    tokenHash,
    tokenRow: tokenResult.data,
    appointment: appointmentResult.data,
    patient: patientResult.data,
    professional: profileResult.data,
    pendingRequest: requestResult.data,
    policySnapshot: policyResult.data,
  };
}

export {
  professionalDisplayName,
  serializePublicAppointment,
} from "./appointment-public-dto.ts";
export function appPublicUrl() {
  const raw = (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("FRONTEND_URL") ||
    "https://www.neuronexai.com.br")
    .replace(/\/+$/, "");
  if (raw === "https://neuronexai.com.br") {
    return "https://www.neuronexai.com.br";
  }
  return raw;
}

export function appointmentDateParts(
  value: string | Date,
  timeZone = "America/Sao_Paulo",
) {
  const date = value instanceof Date ? value : new Date(value);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return { dateLabel, timeLabel };
}
