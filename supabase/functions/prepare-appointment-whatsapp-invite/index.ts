import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentDateParts,
  appointmentErrorResponse,
  appointmentJson,
  appointmentTokenHash,
  appPublicUrl,
  generateAppointmentToken,
  requireProfessional,
} from "../_shared/appointment-lifecycle.ts";
import { professionalDisplayName } from "../_shared/appointment-public-dto.ts";
import {
  buildAppointmentWhatsAppInviteMessage,
  normalizeWhatsAppRecipient,
} from "../_shared/appointment-whatsapp-invite.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: appointmentCorsHeaders });
  }
  if (request.method !== "POST") {
    return appointmentJson({ error: "Método não permitido." }, 405);
  }

  const db = appointmentAdminClient();
  let pendingTokenId: string | null = null;
  let invitationRecorded = false;

  try {
    const user = await requireProfessional(request, db);
    const body = await request.json().catch(() => ({}));
    const appointmentId = String(body.appointmentId || "").trim();
    const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID()).trim();
    if (!appointmentId) {
      return appointmentJson({ error: "O agendamento é obrigatório." }, 400);
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return appointmentJson(
        { error: "Não foi possível validar esta tentativa de envio." },
        400,
      );
    }

    const appointmentResult = await db
      .from("appointments")
      .select(
        "id,user_id,patient_id,start_time,type,location,lifecycle_status,confirmation_revision",
      )
      .eq("id", appointmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (appointmentResult.error) throw appointmentResult.error;
    if (!appointmentResult.data) {
      return appointmentJson(
        { error: "Agendamento não encontrado para esta conta." },
        404,
      );
    }
    const appointment = appointmentResult.data;
    if (
      ["cancelled", "in_progress", "completed", "closed"].includes(
        String(appointment.lifecycle_status),
      )
    ) {
      return appointmentJson(
        { error: "Este agendamento não aceita novos convites." },
        409,
      );
    }
    if (appointment.lifecycle_status === "reschedule_requested") {
      return appointmentJson(
        { error: "Responda primeiro à solicitação pendente do paciente." },
        409,
      );
    }

    const [patientResult, profileResult] = await Promise.all([
      appointment.patient_id
        ? db.from("patients").select("name,phone").eq(
          "id",
          appointment.patient_id,
        ).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("profiles").select(
        "first_name,last_name,full_name,name,clinic_name",
      ).eq("id", user.id).maybeSingle(),
    ]);
    if (patientResult.error) throw patientResult.error;
    if (profileResult.error) throw profileResult.error;

    const patient = patientResult.data;
    const recipientName = String(patient?.name || "Paciente").trim();
    const recipient = normalizeWhatsAppRecipient(patient?.phone);
    if (!recipient) {
      return appointmentJson(
        { error: "Adicione um WhatsApp válido ao cadastro do paciente." },
        400,
      );
    }
    const referenceDate = new Date(appointment.start_time);
    if (!Number.isFinite(referenceDate.getTime())) {
      return appointmentJson(
        { error: "A data do agendamento é inválida." },
        400,
      );
    }

    const rawToken = generateAppointmentToken();
    const tokenHash = await appointmentTokenHash(rawToken);
    const prepared = await db.rpc("prepare_appointment_invitation", {
      p_appointment_id: appointment.id,
      p_actor_user_id: user.id,
      p_token_hash: tokenHash,
      p_appointment_revision: appointment.confirmation_revision,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        source: "appointment_detail_whatsapp",
        appointmentRevision: appointment.confirmation_revision,
        channel: "whatsapp",
      },
    });
    if (prepared.error) throw prepared.error;
    if (!prepared.data?.created) {
      return appointmentJson(
        { error: "Este convite já foi preparado. Tente novamente para gerar outro link." },
        409,
      );
    }
    pendingTokenId = prepared.data.tokenId;
    const confirmationUrl =
      `${appPublicUrl()}/confirmar-agendamento/${rawToken}`;

    const snapshotResult = await db
      .from("appointment_policy_snapshots")
      .select("timezone")
      .eq("id", prepared.data.policySnapshotId)
      .maybeSingle();
    if (snapshotResult.error) throw snapshotResult.error;
    const { dateLabel: appointmentDate, timeLabel: appointmentTime } =
      appointmentDateParts(
        referenceDate,
        String(snapshotResult.data?.timezone || "America/Sao_Paulo"),
      );
    const whatsappMessage = buildAppointmentWhatsAppInviteMessage({
      patientName: recipientName,
      professionalName: professionalDisplayName(profileResult.data),
      appointmentDate,
      appointmentTime,
      confirmationUrl,
    });

    const invitationResult = await db.rpc("record_appointment_invitation", {
      p_appointment_id: appointment.id,
      p_actor_user_id: user.id,
      p_token_id: pendingTokenId,
      p_delivery: {
        provider: "whatsapp_link",
        recipient,
        appointmentRevision: appointment.confirmation_revision,
        channel: "whatsapp",
      },
    });
    if (invitationResult.error) throw invitationResult.error;
    invitationRecorded = true;

    return appointmentJson({
      success: true,
      invitationSent: true,
      provider: "whatsapp",
      confirmationUrl,
      whatsappMessage,
    });
  } catch (error) {
    if (pendingTokenId && !invitationRecorded) {
      await db
        .from("appointment_confirmation_tokens")
        .update({ status: "failed" })
        .eq("id", pendingTokenId);
    }
    console.error("[prepare-appointment-whatsapp-invite]", error);
    return appointmentErrorResponse(error);
  }
});
