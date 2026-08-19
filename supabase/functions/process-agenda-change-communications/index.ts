import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  deliverPatientEmail,
  escapeHtml,
} from "../_shared/email-delivery.ts";
import {
  appPublicUrl,
  appointmentAdminClient,
  appointmentTokenHash,
  generateAppointmentToken,
} from "../_shared/appointment-lifecycle.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-neuronex-webhook-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

interface AgendaChangeOutboxRow {
  id: string;
  batchId: string;
  professionalId: string;
  leaseToken: string;
  patient?: { name?: string | null; email?: string | null } | null;
  professional?: { name?: string | null } | null;
  items?: Array<{
    id?: string;
    originalStartTime?: string;
    originalEndTime?: string;
    proposedStartTime?: string;
    proposedEndTime?: string;
    responseDueAt?: string;
  }>;
}

const formatDateTime = (value: unknown) => {
  const date = new Date(clean(value, 100));
  if (!Number.isFinite(date.getTime())) return "horário a revisar";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const buildEmail = (row: AgendaChangeOutboxRow, actionUrl: string) => {
  const items = Array.isArray(row.items) ? row.items.slice(0, 50) : [];
  const firstName = clean(row.patient?.name, 160).split(/\s+/)[0] || "Olá";
  const professionalName = clean(row.professional?.name, 180) || "Seu psicólogo";
  const itemLines = items.map((item, index) => {
    const original = formatDateTime(item.originalStartTime);
    const proposed = formatDateTime(item.proposedStartTime);
    return `${index + 1}. ${original} → ${proposed}`;
  });
  const htmlLines = items.map((item, index) => {
    const original = escapeHtml(formatDateTime(item.originalStartTime));
    const proposed = escapeHtml(formatDateTime(item.proposedStartTime));
    return `<li style="margin:0 0 10px"><strong>${index + 1}.</strong> ${original} → <strong>${proposed}</strong></li>`;
  }).join("");
  const subject = items.length === 1
    ? "Revise uma alteração no seu horário"
    : `Revise ${items.length} alterações nos seus horários`;
  const text = [
    `${firstName}, ${professionalName} propôs uma alteração de agenda para você revisar.`,
    "",
    ...itemLines,
    "",
    `Revise e responda com segurança: ${actionUrl}`,
    "",
    "O link é individual e temporário. Nenhuma resposta é registrada apenas por abrir esta mensagem.",
  ].join("\n");
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;color:#171717;line-height:1.55">
      <p>${escapeHtml(firstName)},</p>
      <p><strong>${escapeHtml(professionalName)}</strong> propôs uma alteração de agenda para você revisar.</p>
      <ul style="padding-left:20px">${htmlLines}</ul>
      <p style="margin:26px 0">
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:700">Revisar alterações</a>
      </p>
      <p style="font-size:12px;color:#666">O link é individual e temporário. Nenhuma resposta é registrada apenas por abrir esta mensagem.</p>
    </div>`;
  return { subject, text, html };
};

async function complete(
  db: ReturnType<typeof appointmentAdminClient>,
  row: AgendaChangeOutboxRow,
  success: boolean,
  providerMessageId: string | null,
  error: string | null,
) {
  return db.rpc("complete_agenda_change_communication_outbox", {
    p_outbox_id: row.id,
    p_lease_token: row.leaseToken,
    p_success: success,
    p_provider_message_id: providerMessageId,
    p_error: error,
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = appointmentAdminClient();
  const candidate = request.headers.get("x-neuronex-webhook-secret") || "";
  const verified = await db.rpc("verify_appointment_communication_webhook_secret", {
    p_candidate: candidate,
  });
  if (verified.error || verified.data !== true) return json({ error: "Unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(Number(body.limit || 20), 50));
  const outboxId = clean(body.outboxId, 120) || null;
  const claimed = await db.rpc("claim_agenda_change_communication_outbox", {
    p_limit: limit,
    p_outbox_id: outboxId,
  });
  if (claimed.error) {
    console.error("[process-agenda-change-communications] claim failed", claimed.error.message);
    return json({ error: "Não foi possível reservar as comunicações de agenda pendentes." }, 500);
  }

  const rows = (Array.isArray(claimed.data) ? claimed.data : []) as AgendaChangeOutboxRow[];
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!clean(row.id, 120) || !clean(row.leaseToken, 120) || !clean(row.professionalId, 120)) {
      skipped += 1;
      continue;
    }
    try {
      const recipient = clean(row.patient?.email, 320);
      if (!recipient.includes("@")) throw new Error("Patient has no valid email");
      const rawToken = generateAppointmentToken();
      const tokenHash = await appointmentTokenHash(rawToken);
      const prepared = await db.rpc("prepare_agenda_change_batch_delivery", {
        p_outbox_id: row.id,
        p_lease_token: row.leaseToken,
        p_token_hash: tokenHash,
      });
      if (prepared.error) throw prepared.error;

      const actionUrl = `${appPublicUrl().replace(/\/$/, "")}/confirmar-alteracao-agenda/${encodeURIComponent(rawToken)}`;
      const copy = buildEmail(row, actionUrl);
      const account = await db.auth.admin.getUserById(row.professionalId);
      if (account.error) throw account.error;
      const senderEmail = clean(account.data.user?.email, 320) || "notificacoes@email.neuronex.site";
      const senderName = clean(row.professional?.name, 180) || "NeuroNex";
      const delivery = await deliverPatientEmail({
        db,
        userId: row.professionalId,
        senderName,
        senderEmail,
        to: recipient,
        subject: copy.subject,
        html: copy.html,
        text: copy.text,
        senderProfile: "operational",
      });

      const completed = await complete(db, row, true, delivery.providerMessageId, null);
      if (completed.error) throw completed.error;
      delivered += 1;

      const deliveryLog = await db.from("email_delivery_logs").insert({
        user_id: row.professionalId,
        template_key: "agenda_change_batch_review",
        recipient,
        provider: delivery.provider,
        sender: delivery.provider === "gmail" ? senderEmail : "notificacoes@email.neuronex.site",
        status: "sent",
        provider_message_id: delivery.providerMessageId,
        metadata: {
          source: "agenda_change_communication_outbox",
          outboxId: row.id,
          batchId: row.batchId,
          itemCount: Array.isArray(row.items) ? row.items.length : 0,
          gmailError: delivery.gmailError,
        },
      });
      if (deliveryLog.error) {
        console.warn("[process-agenda-change-communications] delivery log failed", row.id, deliveryLog.error.message);
      }
    } catch (error) {
      failed += 1;
      const message = clean(error instanceof Error ? error.message : error, 1200) || "delivery_failed";
      const completed = await complete(db, row, false, null, message);
      if (completed.error) {
        console.error("[process-agenda-change-communications] completion failed", row.id, completed.error.message);
      }
      console.error("[process-agenda-change-communications] delivery failed", row.id, message);
    }
  }

  return json({ ok: true, claimed: rows.length, delivered, failed, skipped });
});
