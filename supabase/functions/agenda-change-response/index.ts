import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  appointmentAdminClient,
  appointmentTokenHash,
} from "../_shared/appointment-lifecycle.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

const normalizeToken = (value: unknown) => {
  const token = clean(value, 256);
  if (token.length < 32 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
};

const normalizeDecisions = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const decisions = value.map((raw) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
    const itemId = clean(item.itemId || item.item_id, 120);
    const decision = clean(item.decision, 40);
    const requestedStartTime = clean(item.requestedStartTime || item.requested_start_time, 120) || null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId)) return null;
    if (!["accept", "reject", "request_change"].includes(decision)) return null;
    if (decision === "request_change" && !requestedStartTime) return null;
    return {
      itemId,
      decision,
      ...(decision === "request_change" ? { requestedStartTime } : {}),
    };
  });
  return decisions.every(Boolean) ? decisions : null;
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ ok: false, error_code: "method_not_allowed" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 40) || "get";
    const token = normalizeToken(body.token);
    if (!token) {
      return json({ ok: false, error_code: "invalid_token", error: "Este link é inválido ou expirou." }, 400);
    }

    const db = appointmentAdminClient();
    const tokenHash = await appointmentTokenHash(token);

    if (action === "get") {
      const result = await db.rpc("get_appointment_change_batch_by_token", {
        p_token_hash: tokenHash,
      });
      if (result.error) throw result.error;
      if (!result.data) return json({ ok: true, found: false });
      return json({ ok: true, found: true, batch: result.data });
    }

    if (action === "respond") {
      const decisions = normalizeDecisions(body.decisions);
      if (!decisions) {
        return json({ ok: false, error_code: "invalid_decisions", error: "Revise as respostas antes de confirmar." }, 400);
      }
      const result = await db.rpc("process_appointment_change_batch_response", {
        p_token_hash: tokenHash,
        p_decisions: decisions,
        p_comment: clean(body.comment, 1000) || null,
      });
      if (result.error) {
        const message = clean(result.error.message, 1200).toLowerCase();
        if (/expired|invalid|window|no longer/.test(message)) {
          return json({ ok: false, error_code: "response_expired", error: "Este link não está mais disponível para resposta." }, 409);
        }
        if (/requested time|available/.test(message)) {
          return json({ ok: false, error_code: "slot_unavailable", error: "O horário escolhido não está mais disponível." }, 409);
        }
        throw result.error;
      }
      return json({ ok: true, result: result.data });
    }

    return json({ ok: false, error_code: "invalid_action", error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("[agenda-change-response]", clean(error instanceof Error ? error.message : error, 1200));
    return json({ ok: false, error_code: "agenda_response_failed", error: "Não foi possível processar esta revisão agora." }, 500);
  }
});
