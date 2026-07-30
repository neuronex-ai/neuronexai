import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  deliverPatientEmail,
  escapeHtml,
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
import {
  GoogleCalendarConnectionRequiredError,
  GoogleCalendarProviderError,
  syncCommittedAppointmentToGoogle,
} from "../_shared/google-calendar-provider.ts";
import { createNeurofinanceChargeForUser } from "../_shared/neurofinance-charge.ts";
import { isSubscriptionAccessError } from "../_shared/subscription-access.ts";
import {
  ensureTeleconsultationInvite,
  revokeTeleconsultationAccess,
} from "../_shared/teleconsultation-access.ts";

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

type WaitlistOutboxRow = {
  id: string;
  professional_id: string;
  offer_id: string;
  payload: Record<string, unknown>;
  lease_token: string;
  lease_expires_at: string;
};

type AppointmentEffectRow = {
  id: string;
  professionalId: string;
  appointmentId: string;
  appointmentRevision: number;
  effectType: "google_sync" | "teleconsultation_room" | "neurofinance_charge";
  operation: "create" | "update" | "cancel";
  payload: Record<string, unknown>;
  payloadFingerprint: string;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  leaseToken: string;
  leaseExpiresAt: string;
};

const terminalAppointmentStatuses = new Set([
  "cancelled",
  "canceled",
  "cancelled_by_patient",
  "cancelled_by_professional",
]);

const appointmentIsCancelled = (appointment: Record<string, unknown>) =>
  appointment.lifecycle_status === "cancelled" ||
  terminalAppointmentStatuses.has(String(appointment.status || "").toLowerCase());

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Falha desconhecida do provedor.";

async function completeAppointmentEffect(
  db: any,
  row: AppointmentEffectRow,
  result: Record<string, unknown>,
) {
  const completed = await db.rpc("complete_appointment_effect_outbox", {
    p_outbox_id: row.id,
    p_lease_token: row.leaseToken,
    p_result_safe: result,
  });
  if (completed.error) throw completed.error;
}

async function retryAppointmentEffect(
  db: any,
  row: AppointmentEffectRow,
  error: unknown,
  options: {
    retryable?: boolean;
    waitForConnection?: boolean;
    retryAfterSeconds?: number | null;
  } = {},
) {
  const retried = await db.rpc("retry_appointment_effect_outbox", {
    p_outbox_id: row.id,
    p_lease_token: row.leaseToken,
    p_error: errorMessage(error),
    p_retryable: options.retryable !== false,
    p_wait_for_connection: options.waitForConnection === true,
    p_retry_after_seconds: options.retryAfterSeconds || null,
  });
  if (retried.error) throw retried.error;
}

async function currentEffectAppointment(db: any, row: AppointmentEffectRow) {
  const result = await db
    .from("appointments")
    .select(
      "id,user_id,patient_id,type,status,lifecycle_status,start_time,end_time,google_meet_link,google_event_id,metadata,confirmation_revision",
    )
    .eq("id", row.appointmentId)
    .eq("user_id", row.professionalId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as Record<string, any> | null;
}

async function recordGoogleEffectState(
  db: any,
  row: AppointmentEffectRow,
  input: {
    status: "synced" | "failed" | "queued";
    googleEventId?: string | null;
    googleMeetLink?: string | null;
    error?: string | null;
  },
) {
  const recorded = await db.rpc("patch_appointment_google_sync_effect", {
    p_appointment_id: row.appointmentId,
    p_revision: row.appointmentRevision,
    p_outbox_id: row.id,
    p_lease_token: row.leaseToken,
    p_google_event_id: input.googleEventId || null,
    p_google_meet_link: input.googleMeetLink || null,
    p_status: input.status,
    p_error: input.error || null,
  });
  if (recorded.error) throw recorded.error;
  return recorded.data;
}

async function processAppointmentEffectQueue(
  db: any,
  limit: number,
  outboxId?: string | null,
) {
  const claimed = await db.rpc("claim_appointment_effect_outbox", {
    p_limit: limit,
    p_effect_type: null,
    p_outbox_id: outboxId || null,
  });
  if (claimed.error) {
    console.error("[appointment-effects] claim failed", claimed.error);
    return json({ error: "Não foi possível reservar os efeitos pendentes." }, 500);
  }

  const rows = (Array.isArray(claimed.data) ? claimed.data : []) as AppointmentEffectRow[];
  let completed = 0;
  let retried = 0;
  let waitingConnection = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!leaseIsActive(row.leaseToken, row.leaseExpiresAt)) {
      skipped += 1;
      continue;
    }
    try {
      const appointment = await currentEffectAppointment(db, row);
      if (!appointment) {
        await completeAppointmentEffect(db, row, { skipped: true, reason: "appointment_missing" });
        skipped += 1;
        continue;
      }
      if (Number(appointment.confirmation_revision || 1) !== row.appointmentRevision) {
        await completeAppointmentEffect(db, row, {
          skipped: true,
          reason: "superseded_revision",
          currentRevision: Number(appointment.confirmation_revision || 1),
        });
        skipped += 1;
        continue;
      }

      if (row.effectType === "google_sync") {
        const result = await syncCommittedAppointmentToGoogle({
          db,
          professionalId: row.professionalId,
          appointmentId: row.appointmentId,
          operation: row.operation,
        });
        await recordGoogleEffectState(db, row, {
          status: "synced",
          googleEventId: "googleEventId" in result ? result.googleEventId : null,
          googleMeetLink: "googleMeetLink" in result ? result.googleMeetLink : null,
        });
        await completeAppointmentEffect(db, row, {
          provider: "google_calendar",
          operation: row.operation,
          googleEventId: "googleEventId" in result ? result.googleEventId : null,
          skipped: "skipped" in result ? result.skipped : false,
        });
      } else if (row.effectType === "teleconsultation_room") {
        const cancel = row.operation === "cancel" || appointmentIsCancelled(appointment) ||
          appointment.type !== "online";
        const result = cancel
          ? await revokeTeleconsultationAccess(db, row.appointmentId, row.professionalId)
          : await ensureTeleconsultationInvite(db, appointment);
        await completeAppointmentEffect(db, row, {
          provider: "neuronex_teleconsultation",
          operation: cancel ? "revoke" : "ensure",
          inviteId: "inviteId" in result ? result.inviteId : null,
        });
      } else if (row.effectType === "neurofinance_charge") {
        if (appointmentIsCancelled(appointment)) {
          await completeAppointmentEffect(db, row, {
            skipped: true,
            reason: "appointment_cancelled",
          });
          skipped += 1;
          continue;
        }
        const amountCents = Number(row.payload.amountCents);
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
          throw new GoogleCalendarProviderError(
            "Snapshot financeiro sem valor em centavos válido.",
            422,
            false,
          );
        }
        const result = await createNeurofinanceChargeForUser({
          userId: row.professionalId,
          payload: {
            patient_id: appointment.patient_id || null,
            appointment_id: row.appointmentId,
            amount: amountCents,
            payment_method: String(row.payload.paymentMethod || "patient_decides"),
            due_date: row.payload.dueDate ? String(row.payload.dueDate) : null,
            financial_entry_id: row.payload.financialEntryId
              ? String(row.payload.financialEntryId)
              : null,
            operation_id: String(row.payload.operationId || row.idempotencyKey),
            description: "Sessão clínica · NeuroFinance",
          },
        });
        await completeAppointmentEffect(db, row, {
          provider: "asaas",
          paymentId: result.payment_id,
          financialEntryId: result.financial_entry_id,
          idempotentReplay: Boolean(result.idempotent_replay),
        });
      } else {
        throw new GoogleCalendarProviderError("Tipo de efeito não suportado.", 422, false);
      }
      completed += 1;
    } catch (error) {
      try {
        if (error instanceof GoogleCalendarConnectionRequiredError) {
          await recordGoogleEffectState(db, row, {
            status: "queued",
            error: errorMessage(error),
          });
          await retryAppointmentEffect(db, row, error, { waitForConnection: true });
          waitingConnection += 1;
          continue;
        }
        const retryable = error instanceof GoogleCalendarProviderError
          ? error.retryable
          : !isSubscriptionAccessError(error) &&
            !/conta financeira não configurada|snapshot financeiro/i.test(errorMessage(error));
        if (row.effectType === "google_sync") {
          await recordGoogleEffectState(db, row, {
            status: "failed",
            error: errorMessage(error),
          });
        }
        await retryAppointmentEffect(db, row, error, { retryable });
        retried += 1;
      } catch (transitionError) {
        console.error("[appointment-effects] transition failed", row.id, transitionError);
        retried += 1;
      }
      console.error("[appointment-effects] provider failed", row.id, error);
    }
  }

  return json({
    success: true,
    queue: "appointment_effects",
    claimed: rows.length,
    completed,
    retried,
    waitingConnection,
    skipped,
  });
}

const formatWaitlistOffer = (value: string) => {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

const processWaitlistOfferQueue = async (db: any, limit: number) => {
  const claimed = await db.rpc("claim_waitlist_offer_outbox", { p_limit: limit });
  if (claimed.error) return json({ error: "Não foi possível reservar as ofertas pendentes." }, 500);

  const rows = (Array.isArray(claimed.data) ? claimed.data : []) as WaitlistOutboxRow[];
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      if (!row.lease_token || new Date(row.lease_expires_at) <= new Date()) {
        skipped += 1;
        continue;
      }
      const offerResult = await db
        .from("professional_waitlist_offers")
        .select("id,status,patient_id,professional_id,offered_start_time,offered_end_time,expires_at")
        .eq("id", row.offer_id)
        .eq("professional_id", row.professional_id)
        .maybeSingle();
      if (offerResult.error) throw offerResult.error;
      const offer = offerResult.data;
      if (!offer || offer.status !== "pending" || new Date(offer.expires_at) <= new Date()) {
        const completed = await db.rpc("complete_waitlist_offer_outbox", {
          p_outbox_id: row.id,
          p_lease_token: row.lease_token,
          p_success: true,
          p_provider: "not_sent",
          p_provider_message_id: "offer_not_pending",
          p_error: null,
        });
        if (completed.error) throw completed.error;
        skipped += 1;
        continue;
      }

      const [patientResult, profileResult, accountResult] = await Promise.all([
        db.from("patients").select("name,email").eq("id", offer.patient_id).eq("user_id", row.professional_id).maybeSingle(),
        db.from("profiles").select("first_name,last_name,full_name,name,clinic_name").eq("id", row.professional_id).maybeSingle(),
        db.auth.admin.getUserById(row.professional_id),
      ]);
      if (patientResult.error) throw patientResult.error;
      if (profileResult.error) throw profileResult.error;
      if (!patientResult.data?.email) throw new Error("O paciente não possui e-mail cadastrado.");

      const professionalName = professionalDisplayName(profileResult.data || {});
      const senderEmail = accountResult.data.user?.email || "contato@neuronex.site";
      const patientFirstName = String(patientResult.data.name || "").trim().split(/\s+/)[0] || "Olá";
      const responsePath = String(row.payload?.responsePath || "");
      if (!responsePath.startsWith("/lista-de-espera/oferta?token=")) throw new Error("Caminho de resposta inválido.");
      const responseUrl = `${appPublicUrl().replace(/\/$/, "")}${responsePath}`;
      const starts = formatWaitlistOffer(offer.offered_start_time);
      const expires = formatWaitlistOffer(offer.expires_at);
      const clinic = String(profileResult.data?.clinic_name || "NeuroNex");
      const subject = `Um horário ficou disponível com ${professionalName}`;
      const html = `
        <!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f5f7;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:28px;overflow:hidden">
              <tr><td style="padding:32px">
                <p style="margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#71717a">Lista de espera segura</p>
                <h1 style="margin:0;font-size:28px;line-height:1.08">${escapeHtml(patientFirstName)}, abriu um horário</h1>
                <p style="margin:16px 0 0;color:#52525b;line-height:1.6">${escapeHtml(professionalName)} reservou temporariamente esta vaga para você.</p>
                <div style="margin:24px 0;padding:18px;border:1px solid #e4e4e7;border-radius:18px;background:#fafafa">
                  <strong style="display:block;font-size:16px;text-transform:capitalize">${escapeHtml(starts.date)}</strong>
                  <span style="display:block;margin-top:7px;color:#52525b">${escapeHtml(starts.time)} · ${escapeHtml(clinic)}</span>
                </div>
                <a href="${escapeHtml(responseUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#18181b;color:#fff;text-decoration:none;font-weight:800">Ver e confirmar horário</a>
                <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.55">A reserva expira em ${escapeHtml(expires.date)}, às ${escapeHtml(expires.time)}. Confirmar ou recusar não exige login.</p>
              </td></tr>
            </table>
          </td></tr></table>
        </body></html>`;
      const text = `${patientFirstName}, abriu um horário com ${professionalName}: ${starts.date}, ${starts.time}. Confirme ou recuse em ${responseUrl}. A reserva expira às ${expires.time}.`;

      const delivery = await deliverPatientEmail({
        db,
        userId: row.professional_id,
        senderName: professionalName,
        senderEmail,
        to: patientResult.data.email,
        subject,
        html,
        text,
        senderProfile: "operational",
      });
      const completed = await db.rpc("complete_waitlist_offer_outbox", {
        p_outbox_id: row.id,
        p_lease_token: row.lease_token,
        p_success: true,
        p_provider: delivery.provider,
        p_provider_message_id: delivery.providerMessageId,
        p_error: null,
      });
      if (completed.error || completed.data !== true) throw completed.error || new Error("Lease de entrega expirou.");
      delivered += 1;
    } catch (error) {
      await db.rpc("complete_waitlist_offer_outbox", {
        p_outbox_id: row.id,
        p_lease_token: row.lease_token,
        p_success: false,
        p_provider: null,
        p_provider_message_id: null,
        p_error: error instanceof Error ? error.message : "Falha desconhecida",
      });
      failed += 1;
    }
  }

  return json({ success: true, queue: "waitlist", claimed: rows.length, delivered, failed, skipped });
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
  if (body.processEffects === true) {
    return processAppointmentEffectQueue(
      db,
      limit,
      body.outboxId ? String(body.outboxId) : null,
    );
  }
  if (body.processWaitlist === true) {
    return processWaitlistOfferQueue(db, limit);
  }
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
