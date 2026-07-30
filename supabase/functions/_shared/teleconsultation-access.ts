const encoder = new TextEncoder();

export const TELECONSULTATION_NOTICE_VERSION = "2026-07-teleconsultation-transcription-v2";

export const TELECONSULTATION_NOTICE =
  "Esta sessão será transcrita para apoiar o registro clínico. O conteúdo permanece protegido, é usado somente para a finalidade clínica e segue as regras de sigilo, guarda profissional e proteção de dados aplicáveis.";

export const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const cleanDisplayName = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function frontendUrl() {
  let configured = "https://neuronexai.com.br";
  try {
    configured = Deno.env.get("FRONTEND_URL") || Deno.env.get("SITE_URL") || configured;
  } catch {
    // Pure helpers can run in restricted test environments without env access.
  }
  const raw = String(configured).trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

export function inviteTokenFromLink(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, frontendUrl());
    const match = url.pathname.match(/\/join\/([a-f0-9]{64})$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function inviteExpiryFor(appointment: Record<string, any>) {
  const appointmentBoundary = new Date(
    appointment.end_time || appointment.start_time || Date.now(),
  ).getTime();
  const afterSession = Number.isFinite(appointmentBoundary)
    ? appointmentBoundary + 12 * 60 * 60 * 1000
    : 0;
  return new Date(Math.max(afterSession, Date.now() + 24 * 60 * 60 * 1000)).toISOString();
}

function minimumInviteCoverageFor(appointment: Record<string, any>) {
  const appointmentBoundary = new Date(
    appointment.end_time || appointment.start_time || Date.now(),
  ).getTime();
  const afterSession = Number.isFinite(appointmentBoundary)
    ? appointmentBoundary + 12 * 60 * 60 * 1000
    : 0;
  // Keep a healthy redemption window without rotating a valid token on every
  // read merely because the 24-hour creation window moves with the clock.
  return Math.max(afterSession, Date.now() + 30 * 60 * 1000);
}

export async function ensureTeleconsultationInvite(
  admin: any,
  appointment: Record<string, any>,
) {
  if (!appointment?.id || appointment.type !== "online") {
    throw new Error("Este agendamento não possui sala de teleconsulta.");
  }

  const desiredExpiry = inviteExpiryFor(appointment);
  const { data: activeInvite, error: inviteReadError } = await admin
    .from("teleconsultation_invites")
    .select("id,appointment_id,token_hash,expires_at,revoked_at")
    .eq("appointment_id", appointment.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (inviteReadError) throw inviteReadError;

  const existingToken = inviteTokenFromLink(appointment.google_meet_link);
  const existingInviteCoversSession = activeInvite &&
    new Date(activeInvite.expires_at).getTime() >= minimumInviteCoverageFor(appointment);
  if (activeInvite && existingToken && existingInviteCoversSession) {
    const existingHash = await sha256Hex(existingToken);
    if (existingHash === activeInvite.token_hash) {
      return {
        inviteId: activeInvite.id,
        inviteToken: existingToken,
        meetLink: `${frontendUrl()}/join/${existingToken}`,
        expiresAt: activeInvite.expires_at,
      };
    }
  }

  const now = new Date().toISOString();
  const { error: revokeError } = await admin
    .from("teleconsultation_invites")
    .update({ revoked_at: now, updated_at: now })
    .eq("appointment_id", appointment.id)
    .is("revoked_at", null);
  if (revokeError) throw revokeError;

  const inviteToken = createInviteToken();
  const tokenHash = await sha256Hex(inviteToken);
  const expiresAt = desiredExpiry;
  const meetLink = `${frontendUrl()}/join/${inviteToken}`;

  const { data: createdInvite, error: createError } = await admin
    .from("teleconsultation_invites")
    .insert({
      appointment_id: appointment.id,
      created_by: appointment.user_id,
      token_hash: tokenHash,
      token_hint: inviteToken.slice(-8),
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (createError) throw createError;

  const { error: appointmentUpdateError } = await admin
    .from("appointments")
    .update({ google_meet_link: meetLink, updated_at: now })
    .eq("id", appointment.id)
    .eq("user_id", appointment.user_id);
  if (appointmentUpdateError) throw appointmentUpdateError;

  return {
    inviteId: createdInvite.id,
    inviteToken,
    meetLink,
    expiresAt,
  };
}

export async function revokeTeleconsultationAccess(
  admin: any,
  appointmentId: string,
  professionalId: string,
) {
  const now = new Date().toISOString();
  const appointmentResult = await admin
    .from("appointments")
    .select("id,user_id")
    .eq("id", appointmentId)
    .eq("user_id", professionalId)
    .maybeSingle();
  if (appointmentResult.error) throw appointmentResult.error;
  if (!appointmentResult.data) throw new Error("Agendamento não encontrado.");

  const [inviteResult, participantResult, appointmentUpdate] = await Promise.all([
    admin
      .from("teleconsultation_invites")
      .update({ revoked_at: now, updated_at: now })
      .eq("appointment_id", appointmentId)
      .is("revoked_at", null),
    admin
      .from("teleconsultation_participants")
      .update({ revoked_at: now, last_seen_at: now })
      .eq("appointment_id", appointmentId)
      .is("revoked_at", null),
    admin
      .from("appointments")
      .update({ google_meet_link: null, updated_at: now })
      .eq("id", appointmentId)
      .eq("user_id", professionalId),
  ]);
  if (inviteResult.error) throw inviteResult.error;
  if (participantResult.error) throw participantResult.error;
  if (appointmentUpdate.error) throw appointmentUpdate.error;
  return { success: true, revokedAt: now };
}

export async function resolveTeleconsultationInvite(admin: any, inviteToken: unknown) {
  const token = String(inviteToken ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;

  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const { data: invite, error: inviteError } = await admin
    .from("teleconsultation_invites")
    .select("id,appointment_id,created_by,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) return null;

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("id,user_id,patient_id,type,status,start_time,end_time,metadata,google_meet_link")
    .eq("id", invite.appointment_id)
    .maybeSingle();
  if (appointmentError) throw appointmentError;
  if (!appointment || appointment.type !== "online") return null;

  const cancelled = [
    "cancelled",
    "canceled",
    "cancelled_by_patient",
    "cancelled_by_professional",
  ].includes(String(appointment.status || "").toLowerCase());
  if (cancelled) return null;

  return { token, invite, appointment };
}

export function buildSessionJoinInfo(appointment: Record<string, any>) {
  const metadata = appointment.metadata && typeof appointment.metadata === "object"
    ? appointment.metadata
    : {};
  const decision = metadata.teleconsultationTranscription &&
      typeof metadata.teleconsultationTranscription === "object"
    ? metadata.teleconsultationTranscription
    : {};
  const room = metadata.teleconsultationRoom && typeof metadata.teleconsultationRoom === "object"
    ? metadata.teleconsultationRoom
    : {};
  const hasDecision = typeof decision.enabled === "boolean";
  const transcriptionEnabled = hasDecision && decision.enabled === true;
  const rawRoomStatus = room.status === "open" || room.status === "closed"
    ? room.status
    : "waiting";
  const heartbeat = typeof room.lastHeartbeatAt === "string"
    ? new Date(room.lastHeartbeatAt).getTime()
    : Number.NaN;
  const heartbeatExpired = rawRoomStatus === "open" &&
    (!Number.isFinite(heartbeat) || Date.now() - heartbeat > 45_000);
  const roomStatus = heartbeatExpired ? "closed" : rawRoomStatus;
  const canJoin = hasDecision && roomStatus === "open";
  const waitMessage = !hasDecision
    ? "Aguarde o psicólogo definir as opções da sessão."
    : roomStatus === "waiting"
    ? "A sala ainda não foi aberta pelo psicólogo."
    : roomStatus === "closed"
    ? "Esta sala já foi encerrada."
    : null;

  return {
    transcriptionEnabled,
    noticeText: transcriptionEnabled ? TELECONSULTATION_NOTICE : null,
    noticeVersion: transcriptionEnabled
      ? decision.noticeVersion || TELECONSULTATION_NOTICE_VERSION
      : null,
    decisionStatus: hasDecision ? "decided" : "pending",
    roomStatus,
    canJoin,
    waitMessage,
  };
}
