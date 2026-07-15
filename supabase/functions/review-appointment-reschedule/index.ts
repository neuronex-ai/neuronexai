import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { deliverPatientEmail, renderTemplate } from "../_shared/email-delivery.ts";
import {
  AppointmentLifecycleError,
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

type Decision = "approve" | "reject";

function parseDecision(value: unknown): Decision {
  const decision = String(value || "") as Decision;
  if (!(["approve", "reject"] as string[]).includes(decision)) {
    throw new AppointmentLifecycleError("Decisao invalida.", 400, "INVALID_DECISION");
  }
  return decision;
}

function decisionEmailHtml(decision: Decision) {
  const approved = decision === "approve";
  return `
    <div style="margin:0 auto;max-width:600px;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b">
      <p style="margin:0 0 12px;font-size:15px">Olá, {{{RECIPIENT_NAME}}}.</p>
      <h1 style="margin:0 0 18px;font-size:26px;line-height:1.2">${approved ? "Seu novo horário foi aprovado" : "Sua solicitação foi analisada"}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#52525b">${approved ? "A consulta foi atualizada para os detalhes abaixo." : "O profissional manteve o horário original da consulta."}</p>
      <div style="margin:0 0 24px;padding:18px;border:1px solid #e4e4e7;border-radius:16px;background:#fafafa">
        <p style="margin:0 0 8px"><strong>Profissional:</strong> {{{PROFESSIONAL_NAME}}}</p>
        <p style="margin:0 0 8px"><strong>Data:</strong> {{{APPOINTMENT_DATE}}}</p>
        <p style="margin:0 0 8px"><strong>Horário:</strong> {{{APPOINTMENT_TIME}}}</p>
        <p style="margin:0"><strong>Observação:</strong> {{{REVIEW_REASON}}}</p>
      </div>
      <a href="{{{ACTION_URL}}}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#18181b;color:#fff;text-decoration:none;font-weight:700">Ver detalhes da consulta</a>
    </div>`;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: appointmentCorsHeaders });
  if (request.method !== "POST") return appointmentJson({ error: "Metodo nao permitido." }, 405);

  const db = appointmentAdminClient();

  try {
    const user = await requireProfessional(request, db);
    const body = await request.json().catch(() => ({}));
    const requestId = String(body.requestId || "").trim();
    const decision = parseDecision(body.decision);
    const reason = String(body.reason || "").trim() || null;
    if (!requestId) throw new AppointmentLifecycleError("Solicitacao obrigatoria.", 400, "REQUEST_REQUIRED");

    const rescheduleResult = await db
      .from("appointment_reschedule_requests")
      .select("id,appointment_id,psychologist_id,status,requested_start_time,requested_end_time")
      .eq("id", requestId)
      .eq("psychologist_id", user.id)
      .maybeSingle();
    if (rescheduleResult.error) throw rescheduleResult.error;
    if (!rescheduleResult.data) {
      throw new AppointmentLifecycleError("Solicitacao nao encontrada.", 404, "REQUEST_NOT_FOUND");
    }

    const appointmentResult = await db
      .from("appointments")
      .select("id,user_id,patient_id,start_time,end_time,type,location,confirmation_revision")
      .eq("id", rescheduleResult.data.appointment_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (appointmentResult.error) throw appointmentResult.error;
    if (!appointmentResult.data) {
      throw new AppointmentLifecycleError("Agendamento nao encontrado.", 404, "APPOINTMENT_NOT_FOUND");
    }

    const reviewResult = await db.rpc("review_appointment_reschedule", {
      p_request_id: requestId,
      p_actor_user_id: user.id,
      p_decision: decision,
      p_reason: reason,
      p_metadata: { source: "appointment_detail_modal", requestedAt: new Date().toISOString() },
    });
    if (reviewResult.error) throw reviewResult.error;

    const reviewedAppointment = reviewResult.data?.appointment || appointmentResult.data;
    const [patientResult, profileResult] = await Promise.all([
      reviewedAppointment.patient_id
        ? db.from("patients").select("name,email").eq("id", reviewedAppointment.patient_id).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("profiles").select("first_name,last_name,full_name,name,clinic_name").eq("id", user.id).maybeSingle(),
    ]);
    if (patientResult.error) throw patientResult.error;
    if (profileResult.error) throw profileResult.error;

    const patient = patientResult.data;
    const recipient = String(patient?.email || "").trim();
    if (!recipient.includes("@")) {
      await db.rpc("record_appointment_communication_event", {
        p_appointment_id: reviewedAppointment.id,
        p_event_type: "reschedule_decision_email_skipped",
        p_action_origin: "email_delivery",
        p_metadata: { requestId, decision, reason: "patient_without_valid_email" },
        p_idempotency_key: `appointment:${reviewedAppointment.id}:request:${requestId}:email-skipped`,
      });
      return appointmentJson({
        success: true,
        decision,
        appointment: reviewedAppointment,
        request: reviewResult.data?.request,
        notificationSent: false,
        warning: "A decisão foi salva, mas o paciente não possui e-mail válido.",
      });
    }

    let tokenId: string | null = null;
    try {
      const rawToken = generateAppointmentToken();
      const tokenHash = await appointmentTokenHash(rawToken);
      const tokenResult = await db
        .from("appointment_confirmation_tokens")
        .insert({
          appointment_id: reviewedAppointment.id,
          appointment_revision: reviewedAppointment.confirmation_revision,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
          status: "pending",
          created_by: user.id,
          metadata: {
            source: "reschedule_review",
            requestId,
            decision,
            appointmentRevision: reviewedAppointment.confirmation_revision,
          },
        })
        .select("id")
        .single();
      if (tokenResult.error) throw tokenResult.error;
      tokenId = tokenResult.data.id;

      const templateKey = decision === "approve"
        ? "appointment_reschedule_approved"
        : "appointment_reschedule_rejected";
      const templateResult = await db
        .from("system_email_templates")
        .select("subject,body_html")
        .eq("template_key", templateKey)
        .eq("enabled", true)
        .maybeSingle();
      const professionalName = professionalDisplayName(profileResult.data);
      const dateParts = appointmentDateParts(reviewedAppointment.start_time);
      const variables = {
        RECIPIENT_NAME: String(patient?.name || "Paciente").split(" ")[0],
        PROFESSIONAL_NAME: professionalName,
        APPOINTMENT_DATE: dateParts.dateLabel,
        APPOINTMENT_TIME: dateParts.timeLabel,
        REVIEW_REASON: reason || (decision === "approve" ? "Novo horário confirmado." : "Horário original mantido."),
        ACTION_URL: `${appPublicUrl()}/confirmar-agendamento/${rawToken}`,
      };
      const subject = renderTemplate(
        templateResult.data?.subject || (decision === "approve" ? "Novo horário da sua consulta" : "Retorno sobre seu pedido de reagendamento"),
        variables,
      );
      const html = renderTemplate(templateResult.data?.body_html || decisionEmailHtml(decision), variables);
      const delivery = await deliverPatientEmail({
        db,
        userId: user.id,
        senderName: professionalName,
        senderEmail: user.email || "notificacoes@email.neuronex.site",
        to: recipient,
        subject,
        html,
      });

      const sentAt = new Date().toISOString();
      const markSent = await db
        .from("appointment_confirmation_tokens")
        .update({
          status: "sent",
          sent_at: sentAt,
          metadata: {
            source: "reschedule_review",
            requestId,
            decision,
            provider: delivery.provider,
            providerMessageId: delivery.providerMessageId,
          },
        })
        .eq("id", tokenId);
      if (markSent.error) throw markSent.error;

      const eventType = decision === "approve" ? "reschedule_approved_email_sent" : "reschedule_rejected_email_sent";
      const communicationResult = await db.rpc("record_appointment_communication_event", {
        p_appointment_id: reviewedAppointment.id,
        p_event_type: eventType,
        p_action_origin: "email_delivery",
        p_metadata: { requestId, decision, recipient, provider: delivery.provider, providerMessageId: delivery.providerMessageId },
        p_idempotency_key: `appointment:${reviewedAppointment.id}:request:${requestId}:${eventType}`,
      });
      if (communicationResult.error) {
        console.warn("[review-appointment-reschedule] Timeline event failed", communicationResult.error);
      }

      const logResult = await db.from("email_delivery_logs").insert({
        user_id: user.id,
        template_key: templateKey,
        recipient,
        provider: delivery.provider,
        sender: delivery.provider === "gmail" ? user.email : "notificacoes@email.neuronex.site",
        status: "sent",
        provider_message_id: delivery.providerMessageId,
        metadata: { appointmentId: reviewedAppointment.id, requestId, decision, gmailError: delivery.gmailError },
      });
      if (logResult.error) {
        console.warn("[review-appointment-reschedule] Delivery log failed", logResult.error);
      }

      return appointmentJson({
        success: true,
        decision,
        appointment: reviewedAppointment,
        request: reviewResult.data?.request,
        notificationSent: true,
      });
    } catch (deliveryError) {
      if (tokenId) {
        await db
          .from("appointment_confirmation_tokens")
          .update({ status: "failed", revoked_at: new Date().toISOString() })
          .eq("id", tokenId);
      }
      console.error("[review-appointment-reschedule:notification]", deliveryError);
      await db.rpc("record_appointment_communication_event", {
        p_appointment_id: reviewedAppointment.id,
        p_event_type: "reschedule_decision_email_failed",
        p_action_origin: "email_delivery",
        p_metadata: { requestId, decision, recipient, error: deliveryError instanceof Error ? deliveryError.message : "unknown" },
        p_idempotency_key: `appointment:${reviewedAppointment.id}:request:${requestId}:email-failed`,
      });
      return appointmentJson({
        success: true,
        decision,
        appointment: reviewedAppointment,
        request: reviewResult.data?.request,
        notificationSent: false,
        warning: "A decisão foi salva, mas o e-mail automático não foi entregue.",
      });
    }
  } catch (error) {
    console.error("[review-appointment-reschedule]", error);
    return appointmentErrorResponse(error);
  }
});
