import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { deliverPatientEmail, renderTemplate } from "../_shared/email-delivery.ts";
import {
  appPublicUrl,
  appointmentAdminClient,
  appointmentCorsHeaders,
  appointmentDateParts,
  appointmentErrorResponse,
  appointmentJson,
  appointmentTokenHash,
  generateAppointmentToken,
  professionalDisplayName,
  requireProfessional,
} from "../_shared/appointment-lifecycle.ts";

function invitationExpiry(endTime: string) {
  const afterAppointment = new Date(endTime).getTime() + 7 * 24 * 60 * 60 * 1_000;
  const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1_000;
  return new Date(Math.max(afterAppointment, thirtyDays)).toISOString();
}

function confirmationEmailHtml() {
  return `
    <div style="margin:0 auto;max-width:600px;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b">
      <p style="margin:0 0 12px;font-size:15px">Olá, {{{RECIPIENT_NAME}}}.</p>
      <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2">Confirme os detalhes da sua consulta</h1>
      <div style="margin:0 0 24px;padding:18px;border:1px solid #e4e4e7;border-radius:16px;background:#fafafa">
        <p style="margin:0 0 8px"><strong>Profissional:</strong> {{{PROFESSIONAL_NAME}}}</p>
        <p style="margin:0 0 8px"><strong>Data:</strong> {{{APPOINTMENT_DATE}}}</p>
        <p style="margin:0 0 8px"><strong>Horário:</strong> {{{APPOINTMENT_TIME}}}</p>
        <p style="margin:0"><strong>Modalidade/local:</strong> {{{APPOINTMENT_LOCATION}}}</p>
      </div>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#52525b">Na página segura da NeuroNex você pode confirmar, cancelar ou solicitar outro horário.</p>
      <a href="{{{ACTION_URL}}}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#18181b;color:#fff;text-decoration:none;font-weight:700">Gerenciar agendamento</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">Este link é pessoal. Não o encaminhe a terceiros.</p>
    </div>`;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: appointmentCorsHeaders });
  if (request.method !== "POST") return appointmentJson({ error: "Metodo nao permitido." }, 405);

  const db = appointmentAdminClient();
  let pendingTokenId: string | null = null;
  let invitationRecorded = false;

  try {
    const user = await requireProfessional(request, db);
    const body = await request.json().catch(() => ({}));
    const appointmentId = String(body.appointmentId || "").trim();
    const action = String(body.action || "invite");
    if (!appointmentId) return appointmentJson({ error: "ID do agendamento e obrigatorio." }, 400);

    const appointmentResult = await db
      .from("appointments")
      .select("id,user_id,patient_id,start_time,end_time,type,location,lifecycle_status,confirmation_revision")
      .eq("id", appointmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (appointmentResult.error) throw appointmentResult.error;
    if (!appointmentResult.data) return appointmentJson({ error: "Agendamento nao encontrado para esta conta." }, 404);
    const appointment = appointmentResult.data;

    const [patientResult, profileResult] = await Promise.all([
      appointment.patient_id
        ? db.from("patients").select("name,email").eq("id", appointment.patient_id).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("profiles").select("first_name,last_name,full_name,name,clinic_name").eq("id", user.id).maybeSingle(),
    ]);
    if (patientResult.error) throw patientResult.error;
    if (profileResult.error) throw profileResult.error;

    const patient = patientResult.data;
    const recipient = String(body.patientEmail || patient?.email || "").trim();
    const recipientName = String(body.patientName || patient?.name || "Paciente").trim();
    if (!recipient.includes("@")) return appointmentJson({ error: "O paciente nao possui e-mail valido." }, 400);

    const profile = profileResult.data;
    const professionalName = professionalDisplayName(profile);
    const referenceDate = new Date(body.startTime || appointment.start_time);
    if (!Number.isFinite(referenceDate.getTime())) return appointmentJson({ error: "Data do agendamento invalida." }, 400);
    const { dateLabel: appointmentDate, timeLabel: appointmentTime } = appointmentDateParts(referenceDate);
    const appointmentLocation = appointment.type === "online"
      ? "Teleconsulta NeuroNex"
      : appointment.location || "Local a combinar com o profissional";
    const isCancellation = action === "cancel";
    let confirmationUrl = "";

    if (!isCancellation) {
      if (["cancelled", "in_progress", "completed", "closed"].includes(String(appointment.lifecycle_status))) {
        return appointmentJson({ error: "Este agendamento nao aceita novos convites." }, 409);
      }

      const rawToken = generateAppointmentToken();
      const tokenHash = await appointmentTokenHash(rawToken);
      const tokenResult = await db
        .from("appointment_confirmation_tokens")
        .insert({
          appointment_id: appointment.id,
          appointment_revision: appointment.confirmation_revision,
          token_hash: tokenHash,
          expires_at: invitationExpiry(appointment.end_time),
          status: "pending",
          created_by: user.id,
          metadata: {
            source: "appointment_detail_email",
            appointmentRevision: appointment.confirmation_revision,
          },
        })
        .select("id")
        .single();
      if (tokenResult.error) throw tokenResult.error;
      pendingTokenId = tokenResult.data.id;
      confirmationUrl = `${appPublicUrl()}/confirmar-agendamento/${rawToken}`;
    }

    const templateKey = isCancellation ? "appointment_cancelled" : "appointment_confirmation";
    const templateResult = await db
      .from("system_email_templates")
      .select("subject,body_html")
      .eq("template_key", templateKey)
      .eq("enabled", true)
      .maybeSingle();
    const variables = {
      RECIPIENT_NAME: recipientName.split(" ")[0],
      APPOINTMENT_DATE: appointmentDate,
      APPOINTMENT_TIME: appointmentTime,
      APPOINTMENT_LOCATION: appointmentLocation,
      ACTION_URL: isCancellation ? `${appPublicUrl()}/portal` : confirmationUrl,
      CANCELLATION_MESSAGE: String(body.cancellationReason || "Entre em contato com o profissional se precisar de ajuda."),
      PROFESSIONAL_NAME: professionalName,
    };
    const fallbackSubject = isCancellation
      ? "Seu atendimento foi cancelado"
      : `Confirme sua consulta com ${professionalName}`;
    const fallbackHtml = isCancellation
      ? "<p>Olá, {{{RECIPIENT_NAME}}}.</p><p>O atendimento de {{{APPOINTMENT_DATE}}} às {{{APPOINTMENT_TIME}}} foi cancelado.</p><p>{{{CANCELLATION_MESSAGE}}}</p>"
      : confirmationEmailHtml();
    const subject = renderTemplate(templateResult.data?.subject || fallbackSubject, variables);
    const html = renderTemplate(templateResult.data?.body_html || fallbackHtml, variables);

    const delivery = await deliverPatientEmail({
      db,
      userId: user.id,
      senderName: professionalName,
      senderEmail: user.email || "notificacoes@email.neuronex.site",
      to: recipient,
      subject,
      html,
    });

    if (pendingTokenId) {
      const invitationResult = await db.rpc("record_appointment_invitation", {
        p_appointment_id: appointment.id,
        p_actor_user_id: user.id,
        p_token_id: pendingTokenId,
        p_delivery: {
          provider: delivery.provider,
          providerMessageId: delivery.providerMessageId,
          recipient,
          appointmentRevision: appointment.confirmation_revision,
        },
      });
      if (invitationResult.error) throw invitationResult.error;
      invitationRecorded = true;
      const revokeResult = await db
        .from("appointment_confirmation_tokens")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("appointment_id", appointment.id)
        .in("status", ["pending", "sent", "opened"])
        .neq("id", pendingTokenId);
      if (revokeResult.error) {
        console.warn("[send-appointment-reminder] Previous invitation revoke failed", revokeResult.error);
      }
    } else {
      const communicationResult = await db.rpc("record_appointment_communication_event", {
        p_appointment_id: appointment.id,
        p_event_type: "cancellation_email_sent",
        p_action_origin: "email_delivery",
        p_metadata: { provider: delivery.provider, providerMessageId: delivery.providerMessageId, recipient },
        p_idempotency_key: `appointment:${appointment.id}:cancellation-email:${delivery.providerMessageId}`,
      });
      if (communicationResult.error) {
        console.warn("[send-appointment-reminder] Timeline event failed", communicationResult.error);
      }
    }

    const logResult = await db.from("email_delivery_logs").insert({
      user_id: user.id,
      template_key: templateKey,
      recipient,
      provider: delivery.provider,
      sender: delivery.provider === "gmail" ? user.email : "notificacoes@email.neuronex.site",
      status: "sent",
      provider_message_id: delivery.providerMessageId,
      metadata: { appointmentId: appointment.id, action, gmailError: delivery.gmailError },
    });
    if (logResult.error) console.warn("[send-appointment-reminder] Delivery log failed", logResult.error);

    return appointmentJson({
      success: true,
      invitationSent: Boolean(pendingTokenId),
      provider: delivery.provider,
      providerMessageId: delivery.providerMessageId,
    });
  } catch (error) {
    if (pendingTokenId && !invitationRecorded) {
      await db
        .from("appointment_confirmation_tokens")
        .update({ status: "failed", revoked_at: new Date().toISOString() })
        .eq("id", pendingTokenId);
    }
    console.error("[send-appointment-reminder]", error);
    return appointmentErrorResponse(error);
  }
});
