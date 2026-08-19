import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { appointmentAdminClient } from "../_shared/appointment-lifecycle.ts";
import { runAgendaChangeCommunicationWorker } from "../_shared/agenda-change-communication-worker.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-neuronex-webhook-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const db = appointmentAdminClient();
    const candidate = request.headers.get("x-neuronex-webhook-secret") || "";
    const verified = await db.rpc("verify_appointment_communication_webhook_secret", {
      p_candidate: candidate,
    });
    if (verified.error || verified.data !== true) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const result = await runAgendaChangeCommunicationWorker(db, {
      limit: Math.max(1, Math.min(Number(body.limit || 20), 50)),
      outboxId: clean(body.outboxId, 120) || null,
    });
    return json({ ok: true, ...result });
  } catch (error) {
    console.error(
      "[process-agenda-change-communications]",
      clean(error instanceof Error ? error.message : error, 1200),
    );
    return json({ error: "Agenda communication worker failed" }, 500);
  }
});
