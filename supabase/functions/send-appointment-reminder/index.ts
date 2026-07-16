import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  deliverPatientEmail,
  EmailDeliveryUnavailableError,
  renderTemplate,
} from "../_shared/email-delivery.ts";
import {
  buildOperationalEmail,
  humanDeadline,
  humanPolicyConsequence,
} from "../_shared/operational-email.ts";
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
    const action = String(body.action || "invite");
    const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID())
      .trim();
    if (!appointmentId) {
      return appointmentJson(
        { error: "O agendamento é obrigatório." },
        400,
      );
    }
    if (!["invite", "cancel"].includes(action)) {
      return appointmentJson({ error: "Ação de comunicação inválida." }, 400);
    }
    if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
      return appointmentJson({ error: "Não foi possível validar esta tentativa de envio." }, 400);
    }

    const appointmentResult = await db
      .from("appointments")
      .select(
        "id,user_id,patient_id,start_time,end_time,type,location,lifecycle_status,confirmation_revision,policy_snapshot_id",
      )
      .eq("id", appointmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (appointmentResult.error) throw appointmentResult.error;
    if (!appointmentResult.data) {
      return appointmentJson({
        error: "Agendamento não encontrado para esta conta.",
      }, 404);
    }
    const appointment = appointmentResult.data;

    const [patientResult, profileResult] = await Promise.all([
      appointment.patient_id
        ? db.from("patients").select("name,email").eq(
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
    const recipient = String(patient?.email || "").trim();
    const recipientName = String(patient?.name || "Paciente").trim();
    if (!recipient.includes("@")) {
      return appointmentJson(
        { error: "O paciente não possui um e-mail válido." },
        400,
      );
    }

    const profile = profileResult.data;
    const professionalName = professionalDisplayName(profile);
    const referenceDate = new Date(appointment.start_time);
    if (!Number.isFinite(referenceDate.getTime())) {
      return appointmentJson({ error: "A data do agendamento é inválida." }, 400);
    }
    const appointmentLocation = appointment.type === "online"
      ? "Teleconsulta NeuroNex"
      : appointment.location || "Local a combinar com o profissional";
    const isCancellation = action === "cancel";
    let confirmationUrl = "";
    let policySnapshot: Record<string, any> | null = null;

    if (!isCancellation) {
      if (
        ["cancelled", "in_progress", "completed", "closed"].includes(
          String(appointment.lifecycle_status),
        )
      ) {
        return appointmentJson({
          error: "Este agendamento não aceita novos convites.",
        }, 409);
      }
      if (appointment.lifecycle_status === "reschedule_requested") {
        return appointmentJson({
          error: "Responda primeiro à solicitação pendente do paciente.",
        }, 409);
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
          source: "appointment_detail_email",
          appointmentRevision: appointment.confirmation_revision,
        },
      });
      if (prepared.error) throw prepared.error;
      if (!prepared.data?.created) {
        return appointmentJson({
          success: true,
          invitationSent: prepared.data?.status === "sent" ||
            prepared.data?.status === "opened",
          idempotentReplay: true,
        });
      }
      pendingTokenId = prepared.data.tokenId;
      confirmationUrl = `${appPublicUrl()}/confirmar-agendamento/${rawToken}`;

      const snapshotResult = await db
        .from("appointment_policy_snapshots")
        .select(
          "free_cancellation_cutoff_at,free_reschedule_cutoff_at,late_cancellation_consequence,timezone",
        )
        .eq("id", prepared.data.policySnapshotId)
        .maybeSingle();
      if (snapshotResult.error) throw snapshotResult.error;
      policySnapshot = snapshotResult.data;
    } else {
      if (appointment.lifecycle_status !== "cancelled") {
        return appointmentJson({
          error:
            "Conclua o cancelamento antes de enviar esta comunicação.",
        }, 409);
      }
      if (appointment.policy_snapshot_id) {
        const snapshotResult = await db
          .from("appointment_policy_snapshots")
          .select(
            "free_cancellation_cutoff_at,free_reschedule_cutoff_at,late_cancellation_consequence,timezone",
          )
          .eq("id", appointment.policy_snapshot_id)
          .maybeSingle();
        if (snapshotResult.error) throw snapshotResult.error;
        policySnapshot = snapshotResult.data;
      }
    }

    const { dateLabel: appointmentDate, timeLabel: appointmentTime } =
      appointmentDateParts(
        referenceDate,
        String(policySnapshot?.timezone || "America/Sao_Paulo"),
      );

    const templateKey = isCancellation
      ? "appointment_cancelled"
      : appointment.lifecycle_status === "awaiting_reconfirmation" ||
          appointment.confirmation_revision > 1
      ? "appointment_reconfirmation"
      : "appointment_confirmation";
    const templateResult = await db
      .from("system_email_templates")
      .select("subject,preheader,body_html,body_text")
      .eq("template_key", templateKey)
      .eq("enabled", true)
      .maybeSingle();
    const freeActionCutoff = policySnapshot
      ? new Date(Math.min(
        new Date(policySnapshot.free_cancellation_cutoff_at).getTime(),
        new Date(policySnapshot.free_reschedule_cutoff_at).getTime(),
      )).toISOString()
      : null;
    const preheader = templateResult.data?.preheader ||
      (templateKey === "appointment_reconfirmation"
        ? "O profissional atualizou detalhes que exigem uma nova confirmação."
        : "Revise o horário e confirme com segurança.");
    const freeActionDeadline = humanDeadline(
      freeActionCutoff,
      policySnapshot?.timezone,
    );
    const freeCancellationDeadline = humanDeadline(
      policySnapshot?.free_cancellation_cutoff_at,
      policySnapshot?.timezone,
    );
    const freeRescheduleDeadline = humanDeadline(
      policySnapshot?.free_reschedule_cutoff_at,
      policySnapshot?.timezone,
    );
    const lateConsequence = humanPolicyConsequence(
      policySnapshot?.late_cancellation_consequence,
    );
    const variables = {
      RECIPIENT_NAME: recipientName.split(" ")[0],
      APPOINTMENT_DATE: appointmentDate,
      APPOINTMENT_TIME: appointmentTime,
      APPOINTMENT_LOCATION: appointmentLocation,
      ACTION_URL: isCancellation ? `${appPublicUrl()}/portal` : confirmationUrl,
      CANCELLATION_MESSAGE:
        "O cancelamento e seus efeitos foram registrados na página segura.",
      PROFESSIONAL_NAME: professionalName,
      PREHEADER: preheader,
      FREE_ACTION_DEADLINE: freeActionDeadline,
      PATIENT_ACTION_DEADLINE: freeActionDeadline,
      FREE_CANCELLATION_DEADLINE: freeCancellationDeadline,
      FREE_RESCHEDULE_DEADLINE: freeRescheduleDeadline,
      LATE_CONSEQUENCE: lateConsequence,
    };
    const fallbackSubject = isCancellation
      ? "Seu atendimento foi cancelado"
      : templateKey === "appointment_reconfirmation"
      ? "O horário mudou: confirme novamente"
      : `Confirme sua consulta com ${professionalName}`;
    const fallback = buildOperationalEmail({
      preheader,
      recipientName: recipientName.split(" ")[0],
      title: isCancellation
        ? "Atendimento cancelado"
        : templateKey === "appointment_reconfirmation"
        ? "Confirme novamente o atendimento"
        : "Confirme os detalhes da sua consulta",
      introduction: isCancellation
        ? "O cancelamento foi registrado com a política aplicável. Consulte a página segura para os detalhes operacionais."
        : templateKey === "appointment_reconfirmation"
        ? "O profissional alterou um detalhe relevante. Sua confirmação anterior permanece no histórico, mas esta nova versão precisa da sua resposta."
        : "Seu atendimento foi reservado. Revise as informações antes de escolher sua ação.",
      professionalName,
      appointmentDate,
      appointmentTime,
      appointmentLocation,
      actionUrl: isCancellation ? `${appPublicUrl()}/portal` : confirmationUrl,
      actionLabel: isCancellation ? "Ver detalhes" : "Gerenciar agendamento",
      policy: policySnapshot
        ? {
          cancellationDeadline: freeCancellationDeadline,
          rescheduleDeadline: freeRescheduleDeadline,
          consequence: lateConsequence,
        }
        : null,
    });
    const subject = renderTemplate(
      templateResult.data?.subject || fallbackSubject,
      variables,
    );
    const html = renderTemplate(
      templateResult.data?.body_html || fallback.html,
      variables,
    );
    const text = renderTemplate(
      templateResult.data?.body_text || fallback.text,
      variables,
    );

    const delivery = await deliverPatientEmail({
      db,
      userId: user.id,
      senderName: professionalName,
      senderEmail: user.email || "notificacoes@email.neuronex.site",
      to: recipient,
      subject,
      html,
      text,
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
    } else {
      const communicationResult = await db.rpc(
        "record_appointment_communication_event",
        {
          p_appointment_id: appointment.id,
          p_event_type: "cancellation_email_sent",
          p_action_origin: "email_delivery",
          p_metadata: {
            provider: delivery.provider,
            providerMessageId: delivery.providerMessageId,
            recipient,
          },
          p_idempotency_key:
            `appointment:${appointment.id}:cancellation-email:${delivery.providerMessageId}`,
        },
      );
      if (communicationResult.error) {
        console.warn(
          "[send-appointment-reminder] Timeline event failed",
          communicationResult.error,
        );
      }
    }

    const logResult = await db.from("email_delivery_logs").insert({
      user_id: user.id,
      template_key: templateKey,
      recipient,
      provider: delivery.provider,
      sender: delivery.provider === "gmail"
        ? user.email
        : "notificacoes@email.neuronex.site",
      status: "sent",
      provider_message_id: delivery.providerMessageId,
      metadata: {
        appointmentId: appointment.id,
        action,
        gmailError: delivery.gmailError,
      },
    });
    if (logResult.error) {
      console.warn(
        "[send-appointment-reminder] Delivery log failed",
        logResult.error,
      );
    }

    return appointmentJson({
      success: true,
      invitationSent: Boolean(pendingTokenId),
      provider: delivery.provider,
      idempotentReplay: false,
    });
  } catch (error) {
    if (pendingTokenId && !invitationRecorded) {
      await db
        .from("appointment_confirmation_tokens")
        .update({ status: "failed" })
        .eq("id", pendingTokenId);
    }
    console.error("[send-appointment-reminder]", error);
    if (error instanceof EmailDeliveryUnavailableError) {
      return appointmentJson({ error: error.message, code: error.code }, 503);
    }
    return appointmentErrorResponse(error);
  }
});
