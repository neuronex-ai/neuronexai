import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  cancelPersistedActionGroup,
  editPersistedActionGroup,
  loadActionGroupRow,
  prepareAndPersistActionGroup,
  rowPendingAction,
  rowReviewClientAction,
} from "./plan-builder.ts";
import { executePersistedActionGroup } from "./plan-executor.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-synapse-gateway-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (payload: Record<string, unknown>, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
});

function adminClient() {
  const url = clean(Deno.env.get("SUPABASE_URL"), 1000);
  const service = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), 8000);
  if (!url || !service) throw new Error("Supabase server-side não configurado.");
  return createClient(url, service, { auth: { persistSession: false } });
}

function userClient(authorization: string) {
  const url = clean(Deno.env.get("SUPABASE_URL"), 1000);
  const anon = clean(Deno.env.get("SUPABASE_ANON_KEY"), 8000);
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
}

function assertGatewaySecret(req: Request) {
  const expected = clean(Deno.env.get("SYNAPSE_VOICE_GATEWAY_SECRET"), 4000);
  const supplied = clean(req.headers.get("x-synapse-gateway-secret"), 4000);
  if (!expected || !supplied || supplied !== expected) throw new Error("Gateway não autorizado.");
}

async function authenticatedUser(req: Request, admin: ReturnType<typeof adminClient>) {
  const authorization = clean(req.headers.get("Authorization"), 8000);
  if (!authorization.startsWith("Bearer ")) throw new Error("Sessão ausente.");
  const { data, error } = await admin.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Sessão inválida.");
  return { user: data.user, authorization };
}

async function assertConversationOwnership(admin: any, userId: string, conversationId: string) {
  if (!UUID_PATTERN.test(conversationId)) throw new Error("Conversa inválida.");
  const { data, error } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Conversa não encontrada para este profissional.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    assertGatewaySecret(req);
    const admin = adminClient();
    const authenticated = await authenticatedUser(req, admin);
    const user = authenticated.user;
    const authorization = authenticated.authorization;
    const scopedUserClient = userClient(authorization);
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action, 80);

    if (action === "prepare") {
      const conversationId = clean(body?.conversationId || body?.sessionId, 120);
      await assertConversationOwnership(admin, user.id, conversationId);
      const rawSteps = Array.isArray(body?.steps) ? body.steps.slice(0, 12) : [];
      const prepared = await prepareAndPersistActionGroup({
        admin,
        userId: user.id,
        conversationId,
        voiceSessionId: clean(body?.voiceSessionId, 120) || null,
        title: clean(body?.title, 180),
        intent: clean(body?.intent, 300),
        spokenSummary: clean(body?.spokenSummary || body?.summary, 1200),
        rawSteps,
        capabilityVersion: Number(body?.capabilityVersion) || 1,
      });

      if (prepared.row.confirmation_policy === "direct") {
        const result = await executePersistedActionGroup({
          admin,
          userId: user.id,
          row: prepared.row,
          confirmation: "direct",
          authorization,
          requestOrigin: req.headers.get("origin"),
          userClient: scopedUserClient,
        });
        return json({ ok: result.status !== "failed", direct: true, result });
      }

      return json({
        ok: true,
        direct: false,
        plan: prepared.row.review_public,
        pendingAction: rowPendingAction(prepared.row),
        clientAction: rowReviewClientAction(prepared.row),
      });
    }

    if (action === "edit") {
      const next = await editPersistedActionGroup({
        admin,
        userId: user.id,
        planId: clean(body?.planId || body?.plan_id, 120),
        planVersion: Number(body?.planVersion || body?.plan_version),
        planHash: clean(body?.planHash || body?.plan_hash, 64),
        edits: Array.isArray(body?.edits) ? body.edits : [],
      });
      return json({
        ok: true,
        plan: next.row.review_public,
        pendingAction: rowPendingAction(next.row),
        clientAction: rowReviewClientAction(next.row),
      });
    }

    if (action === "get") {
      const row = await loadActionGroupRow(
        admin,
        user.id,
        clean(body?.planId || body?.plan_id, 120),
        Number(body?.planVersion || body?.plan_version),
      );
      return json({ ok: true, plan: row.review_public, status: row.status, result: row.result_internal });
    }

    if (action === "cancel") {
      const row = await loadActionGroupRow(
        admin,
        user.id,
        clean(body?.planId || body?.plan_id, 120),
        Number(body?.planVersion || body?.plan_version),
      );
      await cancelPersistedActionGroup(admin, user.id, row);
      return json({ ok: true, status: "cancelled" });
    }

    if (action === "execute") {
      const planId = clean(body?.planId || body?.plan_id, 120);
      const planVersion = Number(body?.planVersion || body?.plan_version);
      const planHash = clean(body?.planHash || body?.plan_hash, 64);
      const row = await loadActionGroupRow(admin, user.id, planId, planVersion);
      if (row.plan_hash !== planHash) throw new Error("A versão/hash confirmados não correspondem ao plano atual.");
      const confirmation = clean(body?.confirmation, 20) as "direct" | "voice" | "opaque";
      const result = await executePersistedActionGroup({
        admin,
        userId: user.id,
        row,
        confirmation,
        authorization,
        requestOrigin: req.headers.get("origin"),
        userClient: scopedUserClient,
      });
      return json({ ok: result.status !== "failed", result });
    }

    return json({ error: "Ação de plano composto inválida." }, 400);
  } catch (error) {
    const message = clean(error instanceof Error ? error.message : error, 1200) || "Falha no plano composto.";
    const authError = /Sessão|Gateway não autorizado/i.test(message);
    console.error("[synapse-action-group]", message);
    return json({ error: message }, authError ? 401 : 400);
  }
});
