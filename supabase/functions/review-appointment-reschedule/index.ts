import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  deliverPatientEmail,
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
  appointmentJson,
  AppointmentLifecycleError,
  appointmentTokenHash,
  appPublicUrl,
  generateAppointmentToken,
  requireProfessional,
} from "../_shared/appointment-lifecycle.ts";
import { professionalDisplayName } from "../_shared/appointment-public-dto.ts";

type Decision = "approve" | "reject";
type ReviewOutcome = "approved" | "declined" | "response_overdue";

type OutboxClaim = {
  id: string;
  appointment_id: string;
  reschedule_request_id: string | null;
  psychologist_id: string;
  patient_id: string | null;
  template_key: string;
  appointment_revision: number;
  policy_snapshot_id: string | null;
  appointment_start_time: string;
  appointment_end_time: string;
  lease_token: string | null;
  lease_expires_at: string | null;
};

type AppointmentFacts = {
  id: string;
  user_id: string;
  patient_id: string | null;
  start_time: string;
  end_time: string;
  confirmation_revision: number;
  policy_snapshot_id: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function leaseIsActive(token: unknown, expiresAtValue: unknown): boolean {
  const leaseToken = String(token || "");
  const expiresAt = Date.parse(String(expiresAtValue || ""));
  return uuidPattern.test(leaseToken) &&
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();
}

function activeLeaseToken(row: OutboxClaim): string | null {
  return leaseIsActive(row.lease_token, row.lease_expires_at)
    ? row.lease_token
    : null;
}

function sameInstant(left: unknown, right: unknown): boolean {
  const leftTime = Date.parse(String(left || ""));
  const rightTime = Date.parse(String(right || ""));
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

function hasCurrentFrozenFacts(
  row: OutboxClaim,
  appointment: AppointmentFacts,
): boolean {
  return appointment.id === row.appointment_id &&
    appointment.user_id === row.psychologist_id &&
    (appointment.patient_id || null) === (row.patient_id || null) &&
    appointment.confirmation_revision === row.appointment_revision &&
    (appointment.policy_snapshot_id || null) ===
      (row.policy_snapshot_id || null) &&
    sameInstant(appointment.start_time, row.appointment_start_time) &&
    sameInstant(appointment.end_time, row.appointment_end_time);
}

function reviewOutcome(value: string): ReviewOutcome {
  if (value === "approve") return "approved";
  if (value === "reject") return "declined";
  if (value === "expired_no_response") return "response_overdue";
  throw new Error("Unexpected review outcome");
}

function parseDecision(value: unknown): Decision {
  const decision = String(value || "") as Decision;
  if (!(<string[]> ["approve", "reject"]).includes(decision)) {
    throw new AppointmentLifecycleError(
      "Decis\u00e3o inv\u00e1lida.",
      400,
      "INVALID_DECISION",
    );
  }
  return decision;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: appointmentCorsHeaders });
  }
  if (request.method !== "POST") {
    return appointmentJson({ error: "M\u00e9todo n\u00e3o permitido." }, 405);
  }

  const db = appointmentAdminClient();
  let tokenId: string | null = null;
  let outboxId: string | null = null;
  let outboxLeaseToken: string | null = null;
  let outboxCompleted = false;
  let invitationRecorded = false;

  try {
    const user = await requireProfessional(request, db);
    const body = await request.json().catch(() => ({}));
    const requestId = String(body.requestId || "").trim();
    const decision = parseDecision(body.decision);
    const reason = String(body.reason || "").trim() || null;
    if (reason && reason.length > 500) {
      throw new AppointmentLifecycleError(
        "A mensagem deve ter no m\u00e1ximo 500 caracteres.",
        400,
        "REASON_TOO_LONG",
      );
    }
    if (!requestId) {
      throw new AppointmentLifecycleError(
        "Solicita\u00e7\u00e3o obrigat\u00f3ria.",
        400,
        "REQUEST_REQUIRED",
      );
    }

    const rescheduleResult = await db
      .from("appointment_reschedule_requests")
      .select("id,appointment_id,psychologist_id,status")
      .eq("id", requestId)
      .eq("psychologist_id", user.id)
      .maybeSingle();
    if (rescheduleResult.error) throw rescheduleResult.error;
    if (!rescheduleResult.data) {
      throw new AppointmentLifecycleError(
        "Solicita\u00e7\u00e3o n\u00e3o encontrada.",
        404,
        "REQUEST_NOT_FOUND",
      );
    }

    const reviewResult = await db.rpc("review_appointment_reschedule", {
      p_request_id: requestId,
      p_actor_user_id: user.id,
      p_decision: decision,
      p_reason: reason,
      p_metadata: { source: "appointment_detail_modal" },
    });
    if (reviewResult.error) throw reviewResult.error;

    const resultingDecision = String(reviewResult.data?.decision || decision);
    const outcome = reviewOutcome(resultingDecision);
    const reviewedAppointment = reviewResult.data?.appointment as
      | (AppointmentFacts & {
        type: string | null;
        location: string | null;
      })
      | null;
    if (!reviewedAppointment?.id) {
      throw new AppointmentLifecycleError(
        "Agendamento n\u00e3o encontrado.",
        404,
        "APPOINTMENT_NOT_FOUND",
      );
    }

    const outboxResult = await db
      .from("appointment_communication_outbox")
      .select("id,status")
      .eq("appointment_id", reviewedAppointment.id)
      .eq("reschedule_request_id", requestId)
      .in("status", ["pending", "failed", "processing", "delivered"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (outboxResult.error) throw outboxResult.error;
    outboxId = outboxResult.data?.id || null;

    if (resultingDecision === "expired_no_response") {
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: false,
        notificationQueued: true,
        message:
          "O prazo de resposta j\u00e1 havia vencido. O caso foi protegido e a comunica\u00e7\u00e3o foi enfileirada.",
      });
    }

    if (outboxResult.data?.status === "delivered") {
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: true,
        notificationQueued: false,
        repeatedRequest: true,
      });
    }

    if (!outboxId) {
      console.error(
        "[review-appointment-reschedule] decision saved without a communication item",
      );
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: false,
        notificationQueued: false,
        warning:
          "A decis\u00e3o foi salva, mas a notifica\u00e7\u00e3o n\u00e3o p\u00f4de ser preparada agora.",
      });
    }

    const claimed = await db.rpc("claim_appointment_communication_outbox", {
      p_limit: 1,
      p_outbox_id: outboxId,
    });
    if (claimed.error) throw claimed.error;
    if (!Array.isArray(claimed.data) || claimed.data.length === 0) {
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: false,
        notificationQueued: true,
        message:
          "A decis\u00e3o foi salva e a comunica\u00e7\u00e3o j\u00e1 est\u00e1 sendo processada.",
      });
    }

    const claimedRow = claimed.data[0] as OutboxClaim;
    const claimedLeaseToken = activeLeaseToken(claimedRow);
    if (!claimedLeaseToken) {
      console.error(
        "[review-appointment-reschedule] refused item without an active lease",
        outboxId,
      );
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: false,
        notificationQueued: true,
        warning:
          "A decis\u00e3o foi salva e a notifica\u00e7\u00e3o ser\u00e1 processada com seguran\u00e7a em instantes.",
      });
    }
    outboxLeaseToken = claimedLeaseToken;

    const expectedTemplate = decision === "approve"
      ? "appointment_reschedule_approved"
      : "appointment_reschedule_rejected";
    const claimMatchesReview = claimedRow.id === outboxId &&
      claimedRow.reschedule_request_id === requestId &&
      claimedRow.template_key === expectedTemplate &&
      hasCurrentFrozenFacts(claimedRow, reviewedAppointment);
    if (!claimMatchesReview) {
      const rejectedClaim = await db.rpc(
        "complete_appointment_communication_outbox",
        {
          p_outbox_id: outboxId,
          p_lease_token: outboxLeaseToken,
          p_success: false,
          p_error: "stale_or_mismatched_communication_facts",
        },
      );
      if (rejectedClaim.error) {
        console.error(
          "[review-appointment-reschedule] could not reject mismatched claim",
          outboxId,
          rejectedClaim.error,
        );
      } else {
        outboxCompleted = true;
      }
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: false,
        notificationQueued: false,
        warning:
          "A decis\u00e3o foi salva, mas os dados da consulta mudaram antes da notifica\u00e7\u00e3o.",
      });
    }

    const [patientResult, profileResult, snapshotResult] = await Promise.all([
      reviewedAppointment.patient_id
        ? db.from("patients").select("name,email").eq(
          "id",
          reviewedAppointment.patient_id,
        ).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("profiles").select(
        "first_name,last_name,full_name,name,clinic_name",
      ).eq("id", user.id).maybeSingle(),
      claimedRow.policy_snapshot_id
        ? db
          .from("appointment_policy_snapshots")
          .select(
            "appointment_id,appointment_revision,appointment_start_time,appointment_end_time,free_cancellation_cutoff_at,free_reschedule_cutoff_at,late_cancellation_consequence,timezone",
          )
          .eq("id", claimedRow.policy_snapshot_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (patientResult.error) throw patientResult.error;
    if (profileResult.error) throw profileResult.error;
    if (snapshotResult.error) throw snapshotResult.error;
    if (
      claimedRow.policy_snapshot_id &&
      (!snapshotResult.data ||
        snapshotResult.data.appointment_id !== claimedRow.appointment_id ||
        snapshotResult.data.appointment_revision !==
          claimedRow.appointment_revision ||
        !sameInstant(
          snapshotResult.data.appointment_start_time,
          claimedRow.appointment_start_time,
        ) ||
        !sameInstant(
          snapshotResult.data.appointment_end_time,
          claimedRow.appointment_end_time,
        ))
    ) {
      throw new Error("Communication policy snapshot does not match");
    }

    const patient = patientResult.data;
    const recipient = String(patient?.email || "").trim();
    if (!recipient.includes("@")) {
      const completed = await db.rpc(
        "complete_appointment_communication_outbox",
        {
          p_outbox_id: outboxId,
          p_lease_token: outboxLeaseToken,
          p_success: false,
          p_error: "patient_without_valid_email",
        },
      );
      if (completed.error) {
        console.error(
          "[review-appointment-reschedule] invalid-email completion failed",
          outboxId,
          completed.error,
        );
      } else {
        outboxCompleted = true;
      }
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: false,
        notificationQueued: true,
        warning:
          "A decis\u00e3o foi salva, mas o paciente n\u00e3o possui e-mail v\u00e1lido.",
      });
    }

    const rawToken = generateAppointmentToken();
    const tokenHash = await appointmentTokenHash(rawToken);
    const invitationKey = `outbox:${claimedRow.id}:invitation`;
    const prepared = await db.rpc("prepare_appointment_invitation", {
      p_appointment_id: reviewedAppointment.id,
      p_actor_user_id: user.id,
      p_token_hash: tokenHash,
      p_appointment_revision: claimedRow.appointment_revision,
      p_idempotency_key: invitationKey,
      p_metadata: { source: "reschedule_review", requestId, decision },
    });
    if (prepared.error) throw prepared.error;
    if (!prepared.data?.created) {
      const invitationAlreadySent = prepared.data?.status === "sent" ||
        prepared.data?.status === "opened";
      const completed = await db.rpc(
        "complete_appointment_communication_outbox",
        {
          p_outbox_id: outboxId,
          p_lease_token: outboxLeaseToken,
          p_success: invitationAlreadySent,
          p_provider: invitationAlreadySent ? "idempotent_replay" : null,
          p_provider_message_id: null,
          p_error: invitationAlreadySent
            ? null
            : "invitation_preparation_in_progress",
        },
      );
      if (completed.error) throw completed.error;
      outboxCompleted = true;
      return appointmentJson({
        success: true,
        outcome,
        notificationSent: invitationAlreadySent,
        notificationQueued: !invitationAlreadySent,
        repeatedRequest: true,
      });
    }
    tokenId = String(prepared.data.tokenId || "") || null;
    if (!tokenId) {
      throw new Error("Invitation preparation did not return a token");
    }

    const templateKey = expectedTemplate;
    const templateResult = await db
      .from("system_email_templates")
      .select("subject,preheader,body_html,body_text")
      .eq("template_key", templateKey)
      .eq("enabled", true)
      .maybeSingle();
    if (templateResult.error) throw templateResult.error;

    const professionalName = professionalDisplayName(profileResult.data);
    const snapshot = snapshotResult.data;
    const dateParts = appointmentDateParts(
      reviewedAppointment.start_time,
      snapshot?.timezone,
    );
    const reactionDueAt = reviewResult.data?.reactionDueAt ||
      reviewResult.data?.request?.reaction_due_at;
    const freeActionCutoff = reactionDueAt || (snapshot
      ? new Date(Math.min(
        new Date(snapshot.free_cancellation_cutoff_at).getTime(),
        new Date(snapshot.free_reschedule_cutoff_at).getTime(),
      )).toISOString()
      : null);
    const patientActionDeadline = humanDeadline(
      freeActionCutoff,
      snapshot?.timezone,
    );
    const freeCancellationDeadline = humanDeadline(
      snapshot?.free_cancellation_cutoff_at,
      snapshot?.timezone,
    );
    const freeRescheduleDeadline = humanDeadline(
      snapshot?.free_reschedule_cutoff_at,
      snapshot?.timezone,
    );
    const lateConsequence = reviewResult.data?.financialRightProtected
      ? "nenhuma penalidade financeira autom\u00e1tica pode ser aplicada a este caso protegido."
      : humanPolicyConsequence(snapshot?.late_cancellation_consequence);
    const preheader = templateResult.data?.preheader ||
      (decision === "approve"
        ? "Confira os detalhes atualizados da consulta."
        : "O hor\u00e1rio original foi mantido e suas a\u00e7\u00f5es foram reabertas.");
    const actionUrl = `${appPublicUrl()}/confirmar-agendamento/${rawToken}`;
    const recipientName = String(patient?.name || "Paciente").split(" ")[0];
    const appointmentLocation = reviewedAppointment.type === "online"
      ? "Teleconsulta NeuroNex"
      : reviewedAppointment.location || "Local a combinar com o profissional";
    const variables = {
      RECIPIENT_NAME: recipientName,
      PROFESSIONAL_NAME: professionalName,
      APPOINTMENT_DATE: dateParts.dateLabel,
      APPOINTMENT_TIME: dateParts.timeLabel,
      APPOINTMENT_LOCATION: appointmentLocation,
      REVIEW_REASON:
        "H\u00e1 um retorno dispon\u00edvel na p\u00e1gina segura.",
      ACTION_URL: actionUrl,
      PREHEADER: preheader,
      FREE_ACTION_DEADLINE: patientActionDeadline,
      PATIENT_ACTION_DEADLINE: patientActionDeadline,
      FREE_CANCELLATION_DEADLINE: freeCancellationDeadline,
      FREE_RESCHEDULE_DEADLINE: freeRescheduleDeadline,
      LATE_CONSEQUENCE: lateConsequence,
    };
    const fallback = buildOperationalEmail({
      preheader,
      recipientName,
      title: decision === "approve"
        ? "Novo hor\u00e1rio aprovado"
        : "Hor\u00e1rio original mantido",
      introduction: decision === "approve"
        ? "O hor\u00e1rio solicitado foi aprovado e agora \u00e9 o hor\u00e1rio oficial da consulta."
        : "O pedido anterior n\u00e3o foi aceito. Voc\u00ea ainda pode confirmar, cancelar ou solicitar outro hor\u00e1rio.",
      professionalName,
      appointmentDate: dateParts.dateLabel,
      appointmentTime: dateParts.timeLabel,
      appointmentLocation,
      actionUrl,
      actionLabel: decision === "approve"
        ? "Ver detalhes da consulta"
        : "Escolher pr\u00f3xima a\u00e7\u00e3o",
      policy: {
        cancellationDeadline: freeCancellationDeadline,
        rescheduleDeadline: freeRescheduleDeadline,
        consequence: lateConsequence,
      },
      detail: null,
    });
    const subject = renderTemplate(
      templateResult.data?.subject ||
        (decision === "approve"
          ? "Novo hor\u00e1rio da sua consulta"
          : "Retorno sobre seu pedido de reagendamento"),
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

    const [latestAppointmentResult, latestLeaseResult] = await Promise.all([
      db
        .from("appointments")
        .select(
          "id,user_id,patient_id,start_time,end_time,confirmation_revision,policy_snapshot_id",
        )
        .eq("id", claimedRow.appointment_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .from("appointment_communication_outbox")
        .select("status,lease_token,lease_expires_at")
        .eq("id", claimedRow.id)
        .maybeSingle(),
    ]);
    if (latestAppointmentResult.error) throw latestAppointmentResult.error;
    if (latestLeaseResult.error) throw latestLeaseResult.error;
    if (
      !latestAppointmentResult.data ||
      !hasCurrentFrozenFacts(
        claimedRow,
        latestAppointmentResult.data as AppointmentFacts,
      ) ||
      latestLeaseResult.data?.status !== "processing" ||
      latestLeaseResult.data?.lease_token !== outboxLeaseToken ||
      !leaseIsActive(
        latestLeaseResult.data?.lease_token,
        latestLeaseResult.data?.lease_expires_at,
      )
    ) {
      throw new Error("Communication facts or lease changed before delivery");
    }

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

    const invitationResult = await db.rpc("record_appointment_invitation", {
      p_appointment_id: reviewedAppointment.id,
      p_actor_user_id: user.id,
      p_token_id: tokenId,
      p_delivery: {
        source: "reschedule_review",
        requestId,
        decision,
        provider: delivery.provider,
        providerMessageId: delivery.providerMessageId,
        appointmentRevision: reviewedAppointment.confirmation_revision,
      },
    });
    if (invitationResult.error) throw invitationResult.error;
    invitationRecorded = true;

    const completed = await db.rpc(
      "complete_appointment_communication_outbox",
      {
        p_outbox_id: outboxId,
        p_lease_token: outboxLeaseToken,
        p_success: true,
        p_provider: delivery.provider,
        p_provider_message_id: delivery.providerMessageId,
      },
    );
    if (completed.error) throw completed.error;
    outboxCompleted = true;

    const deliveryLog = await db.from("email_delivery_logs").insert({
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
        appointmentId: reviewedAppointment.id,
        requestId,
        decision,
        gmailError: delivery.gmailError,
      },
    });
    if (deliveryLog.error) {
      console.error(
        "[review-appointment-reschedule] delivery log failed",
        deliveryLog.error,
      );
    }

    return appointmentJson({
      success: true,
      outcome,
      notificationSent: true,
      notificationQueued: false,
      financialProtectionActive: Boolean(
        reviewResult.data?.financialRightProtected,
      ),
      patientActionDeadline: reactionDueAt || null,
    });
  } catch (error) {
    if (tokenId && !invitationRecorded) {
      const tokenFailure = await db
        .from("appointment_confirmation_tokens")
        .update({ status: "failed" })
        .eq("id", tokenId);
      if (tokenFailure.error) {
        console.error(
          "[review-appointment-reschedule] token cleanup failed",
          tokenFailure.error,
        );
      }
    }
    if (outboxId && outboxLeaseToken && !outboxCompleted) {
      const completed = await db.rpc(
        "complete_appointment_communication_outbox",
        {
          p_outbox_id: outboxId,
          p_lease_token: outboxLeaseToken,
          p_success: false,
          p_error: error instanceof Error
            ? error.message
            : "unknown_delivery_error",
        },
      );
      if (completed.error) {
        console.error(
          "[review-appointment-reschedule] lease completion failed",
          completed.error,
        );
      } else {
        outboxCompleted = true;
      }
    }
    console.error("[review-appointment-reschedule]", error);
    const status = error instanceof AppointmentLifecycleError
      ? error.status
      : 500;
    const message = error instanceof AppointmentLifecycleError
      ? error.message
      : "N\u00e3o foi poss\u00edvel concluir a revis\u00e3o agora.";
    return appointmentJson({ error: message }, status);
  }
});
