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
  appointmentDateParts,
  appointmentTokenHash,
  appPublicUrl,
  generateAppointmentToken,
} from "../_shared/appointment-lifecycle.ts";
import { professionalDisplayName } from "../_shared/appointment-public-dto.ts";

const headers = {
  "Content-Type": "application/json; charset=UTF-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-neuronex-webhook-secret",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

type OutboxRow = {
  id: string;
  appointment_id: string;
  reschedule_request_id?: string | null;
  psychologist_id: string;
  patient_id?: string | null;
  template_key: string;
  payload?: Record<string, unknown> | null;
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

function activeLeaseToken(row: OutboxRow): string | null {
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
  row: OutboxRow,
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

const copyFor = (templateKey: string) => {
  switch (templateKey) {
    case "appointment_reschedule_approved":
      return {
        title: "Novo hor\u00e1rio aprovado",
        introduction:
          "O hor\u00e1rio solicitado foi aprovado e agora \u00e9 o hor\u00e1rio oficial da consulta.",
        actionLabel: "Ver detalhes da consulta",
      };
    case "appointment_reschedule_rejected":
      return {
        title: "Hor\u00e1rio original mantido",
        introduction:
          "O pedido anterior n\u00e3o foi aceito. Voc\u00ea ainda pode confirmar, cancelar ou solicitar outro hor\u00e1rio.",
        actionLabel: "Escolher pr\u00f3xima a\u00e7\u00e3o",
      };
    case "appointment_reschedule_response_overdue":
      return {
        title: "Decis\u00e3o do profissional em atraso",
        introduction:
          "O prazo de resposta venceu. O hor\u00e1rio original n\u00e3o foi cancelado e nenhuma penalidade financeira pode ser aplicada por esse atraso.",
        actionLabel: "Ver situa\u00e7\u00e3o protegida",
      };
    case "appointment_policy_changed":
      return {
        title: "Pol\u00edtica futura atualizada",
        introduction:
          "A pol\u00edtica desta ocorr\u00eancia futura foi atualizada sem antecipar nenhum prazo que j\u00e1 havia sido concedido.",
        actionLabel: "Revisar pol\u00edtica",
      };
    default:
      return {
        title: "Atualiza\u00e7\u00e3o do seu atendimento",
        introduction:
          "Houve uma atualiza\u00e7\u00e3o operacional relacionada a esta consulta.",
        actionLabel: "Ver detalhes com seguran\u00e7a",
      };
  }
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const db = appointmentAdminClient();
  const candidate = request.headers.get("x-neuronex-webhook-secret") || "";
  const verified = await db.rpc(
    "verify_appointment_communication_webhook_secret",
    {
      p_candidate: candidate,
    },
  );
  if (verified.error || verified.data !== true) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body.limit || 10), 50));
  const outboxId = body.outboxId ? String(body.outboxId) : null;
  const claimed = await db.rpc("claim_appointment_communication_outbox", {
    p_limit: limit,
    p_outbox_id: outboxId,
  });
  if (claimed.error) {
    console.error(
      "[process-appointment-communications] claim failed",
      claimed.error,
    );
    return json({
      error:
        "N\u00e3o foi poss\u00edvel reservar as comunica\u00e7\u00f5es pendentes.",
    }, 500);
  }

  const rows = (Array.isArray(claimed.data) ? claimed.data : []) as OutboxRow[];
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  let repeated = 0;

  for (const row of rows) {
    const leaseToken = activeLeaseToken(row);
    if (!leaseToken) {
      skipped += 1;
      console.error(
        "[process-appointment-communications] refused item without an active lease",
        row.id,
      );
      continue;
    }

    let tokenId: string | null = null;
    let invitationRecorded = false;
    let claimCompleted = false;
    try {
      const appointmentResult = await db
        .from("appointments")
        .select(
          "id,user_id,patient_id,start_time,end_time,type,location,lifecycle_status,confirmation_revision,policy_snapshot_id",
        )
        .eq("id", row.appointment_id)
        .eq("user_id", row.psychologist_id)
        .maybeSingle();
      if (appointmentResult.error) throw appointmentResult.error;
      if (!appointmentResult.data) throw new Error("Appointment not found");
      const appointment = appointmentResult.data as AppointmentFacts & {
        type: string | null;
        location: string | null;
        lifecycle_status: string;
      };
      if (!hasCurrentFrozenFacts(row, appointment)) {
        throw new Error("Communication facts changed before delivery");
      }

      const [
        patientResult,
        profileResult,
        accountResult,
        snapshotResult,
        requestResult,
      ] = await Promise.all([
        appointment.patient_id
          ? db.from("patients").select("name,email").eq(
            "id",
            appointment.patient_id,
          ).eq("user_id", row.psychologist_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        db.from("profiles").select(
          "first_name,last_name,full_name,name,clinic_name",
        ).eq("id", row.psychologist_id).maybeSingle(),
        db.auth.admin.getUserById(row.psychologist_id),
        appointment.policy_snapshot_id
          ? db
            .from("appointment_policy_snapshots")
            .select(
              "appointment_id,appointment_revision,appointment_start_time,appointment_end_time,free_cancellation_cutoff_at,free_reschedule_cutoff_at,late_cancellation_consequence,timezone",
            )
            .eq("id", appointment.policy_snapshot_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        row.reschedule_request_id
          ? db
            .from("appointment_reschedule_requests")
            .select(
              "appointment_id,psychologist_id,patient_id,review_reason,reaction_due_at,financial_right_protected,protection_reason",
            )
            .eq("id", row.reschedule_request_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (patientResult.error) throw patientResult.error;
      if (profileResult.error) throw profileResult.error;
      if (accountResult.error) throw accountResult.error;
      if (snapshotResult.error) throw snapshotResult.error;
      if (requestResult.error) throw requestResult.error;
      if (
        row.policy_snapshot_id &&
        (!snapshotResult.data ||
          snapshotResult.data.appointment_id !== row.appointment_id ||
          snapshotResult.data.appointment_revision !==
            row.appointment_revision ||
          !sameInstant(
            snapshotResult.data.appointment_start_time,
            row.appointment_start_time,
          ) ||
          !sameInstant(
            snapshotResult.data.appointment_end_time,
            row.appointment_end_time,
          ))
      ) {
        throw new Error("Communication policy snapshot does not match");
      }
      if (
        row.reschedule_request_id &&
        (!requestResult.data ||
          requestResult.data.appointment_id !== row.appointment_id ||
          requestResult.data.psychologist_id !== row.psychologist_id ||
          (requestResult.data.patient_id || null) !==
            (row.patient_id || null))
      ) {
        throw new Error("Communication request does not match");
      }

      const patient = patientResult.data;
      const recipient = String(patient?.email || "").trim();
      if (!recipient.includes("@")) {
        throw new Error("Patient has no valid email");
      }

      const rawToken = generateAppointmentToken();
      const prepared = await db.rpc("prepare_appointment_invitation", {
        p_appointment_id: appointment.id,
        p_actor_user_id: row.psychologist_id,
        p_token_hash: await appointmentTokenHash(rawToken),
        p_appointment_revision: row.appointment_revision,
        p_idempotency_key: `outbox:${row.id}:invitation`,
        p_metadata: {
          source: "appointment_communication_outbox",
          outboxId: row.id,
        },
      });
      if (prepared.error) throw prepared.error;
      if (!prepared.data?.created) {
        if (
          prepared.data?.status === "sent" || prepared.data?.status === "opened"
        ) {
          const completed = await db.rpc(
            "complete_appointment_communication_outbox",
            {
              p_outbox_id: row.id,
              p_lease_token: leaseToken,
              p_success: true,
              p_provider: "idempotent_replay",
              p_provider_message_id: null,
            },
          );
          if (completed.error) throw completed.error;
          claimCompleted = true;
          delivered += 1;
          repeated += 1;
          continue;
        }
        throw new Error("Invitation preparation is already in progress");
      }
      tokenId = String(prepared.data.tokenId || "") || null;
      if (!tokenId) {
        throw new Error("Invitation preparation did not return a token");
      }

      const templateResult = await db
        .from("system_email_templates")
        .select("subject,preheader,body_html,body_text,sender_profile")
        .eq("template_key", row.template_key)
        .eq("enabled", true)
        .maybeSingle();
      if (templateResult.error) throw templateResult.error;

      const snapshot = snapshotResult.data;
      const reschedule = requestResult.data;
      const rawDeadline = reschedule?.reaction_due_at ||
        (snapshot
          ? new Date(Math.min(
            new Date(snapshot.free_cancellation_cutoff_at).getTime(),
            new Date(snapshot.free_reschedule_cutoff_at).getTime(),
          )).toISOString()
          : null);
      const deadline = humanDeadline(rawDeadline, snapshot?.timezone);
      const cancellationDeadline = humanDeadline(
        snapshot?.free_cancellation_cutoff_at,
        snapshot?.timezone,
      );
      const rescheduleDeadline = humanDeadline(
        snapshot?.free_reschedule_cutoff_at,
        snapshot?.timezone,
      );
      const consequence = reschedule?.financial_right_protected
        ? "nenhuma penalidade financeira autom\u00e1tica pode ser aplicada a este caso protegido."
        : humanPolicyConsequence(snapshot?.late_cancellation_consequence);
      const dateParts = appointmentDateParts(
        appointment.start_time,
        snapshot?.timezone,
      );
      const professionalName = professionalDisplayName(profileResult.data);
      const recipientName = String(patient?.name || "Paciente").split(" ")[0];
      const location = appointment.type === "online"
        ? "Teleconsulta NeuroNex"
        : appointment.location || "Local a combinar com o profissional";
      const actionUrl = `${appPublicUrl()}/confirmar-agendamento/${rawToken}`;
      const copy = copyFor(row.template_key);
      const preheader = templateResult.data?.preheader || copy.introduction;
      const variables = {
        RECIPIENT_NAME: recipientName,
        PROFESSIONAL_NAME: professionalName,
        APPOINTMENT_DATE: dateParts.dateLabel,
        APPOINTMENT_TIME: dateParts.timeLabel,
        APPOINTMENT_LOCATION: location,
        ACTION_URL: actionUrl,
        PREHEADER: preheader,
        FREE_ACTION_DEADLINE: deadline,
        PATIENT_ACTION_DEADLINE: deadline,
        FREE_CANCELLATION_DEADLINE: cancellationDeadline,
        FREE_RESCHEDULE_DEADLINE: rescheduleDeadline,
        LATE_CONSEQUENCE: consequence,
        REVIEW_REASON:
          "H\u00e1 um retorno dispon\u00edvel na p\u00e1gina segura.",
      };
      const fallback = buildOperationalEmail({
        preheader,
        recipientName,
        title: copy.title,
        introduction: copy.introduction,
        professionalName,
        appointmentDate: dateParts.dateLabel,
        appointmentTime: dateParts.timeLabel,
        appointmentLocation: location,
        actionUrl,
        actionLabel: copy.actionLabel,
        policy: {
          cancellationDeadline,
          rescheduleDeadline,
          consequence,
        },
        detail: null,
      });
      const subject = renderTemplate(
        templateResult.data?.subject || copy.title,
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
      const senderEmail = accountResult.data.user?.email ||
        "notificacoes@email.neuronex.site";

      const [latestAppointmentResult, latestLeaseResult] = await Promise.all([
        db
          .from("appointments")
          .select(
            "id,user_id,patient_id,start_time,end_time,confirmation_revision,policy_snapshot_id",
          )
          .eq("id", row.appointment_id)
          .eq("user_id", row.psychologist_id)
          .maybeSingle(),
        db
          .from("appointment_communication_outbox")
          .select("status,lease_token,lease_expires_at")
          .eq("id", row.id)
          .maybeSingle(),
      ]);
      if (latestAppointmentResult.error) throw latestAppointmentResult.error;
      if (latestLeaseResult.error) throw latestLeaseResult.error;
      if (
        !latestAppointmentResult.data ||
        !hasCurrentFrozenFacts(
          row,
          latestAppointmentResult.data as AppointmentFacts,
        ) ||
        latestLeaseResult.data?.status !== "processing" ||
        latestLeaseResult.data?.lease_token !== leaseToken ||
        !leaseIsActive(
          latestLeaseResult.data?.lease_token,
          latestLeaseResult.data?.lease_expires_at,
        )
      ) {
        throw new Error("Communication facts or lease changed before delivery");
      }

      const delivery = await deliverPatientEmail({
        db,
        userId: row.psychologist_id,
        senderName: professionalName,
        senderEmail,
        to: recipient,
        subject,
        html,
        text,
        senderProfile: templateResult.data?.sender_profile || "operational",
      });

      const recorded = await db.rpc("record_appointment_invitation", {
        p_appointment_id: appointment.id,
        p_actor_user_id: row.psychologist_id,
        p_token_id: tokenId,
        p_delivery: {
          source: "appointment_communication_outbox",
          outboxId: row.id,
          provider: delivery.provider,
          providerMessageId: delivery.providerMessageId,
          appointmentRevision: appointment.confirmation_revision,
        },
      });
      if (recorded.error) throw recorded.error;
      invitationRecorded = true;

      const completed = await db.rpc(
        "complete_appointment_communication_outbox",
        {
          p_outbox_id: row.id,
          p_lease_token: leaseToken,
          p_success: true,
          p_provider: delivery.provider,
          p_provider_message_id: delivery.providerMessageId,
        },
      );
      if (completed.error) throw completed.error;
      claimCompleted = true;

      const deliveryLog = await db.from("email_delivery_logs").insert({
        user_id: row.psychologist_id,
        template_key: row.template_key,
        recipient,
        provider: delivery.provider,
        sender: delivery.provider === "gmail"
          ? senderEmail
          : "notificacoes@email.neuronex.site",
        status: "sent",
        provider_message_id: delivery.providerMessageId,
        metadata: {
          appointmentId: appointment.id,
          outboxId: row.id,
          gmailError: delivery.gmailError,
        },
      });
      if (deliveryLog.error) {
        console.error(
          "[process-appointment-communications] delivery log failed",
          row.id,
          deliveryLog.error,
        );
      }
      delivered += 1;
    } catch (error) {
      if (tokenId && !invitationRecorded) {
        const tokenFailure = await db
          .from("appointment_confirmation_tokens")
          .update({ status: "failed" })
          .eq("id", tokenId);
        if (tokenFailure.error) {
          console.error(
            "[process-appointment-communications] token cleanup failed",
            row.id,
            tokenFailure.error,
          );
        }
      }
      const message = error instanceof Error
        ? error.message
        : "Unknown delivery error";
      if (!claimCompleted) {
        const completed = await db.rpc(
          "complete_appointment_communication_outbox",
          {
            p_outbox_id: row.id,
            p_lease_token: leaseToken,
            p_success: false,
            p_error: message,
          },
        );
        if (completed.error) {
          console.error(
            "[process-appointment-communications] lease completion failed",
            row.id,
            completed.error,
          );
        } else {
          claimCompleted = true;
        }
      }
      console.error("[process-appointment-communications]", row.id, error);
      failed += 1;
    }
  }

  return json({
    success: true,
    processed: rows.length,
    delivered,
    failed,
    skipped,
    repeated,
  });
});
