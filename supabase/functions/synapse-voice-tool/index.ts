import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  executeAgentToolV3,
  executeConfirmedMutationV3,
  type AgentToolContextV3,
} from "../synapse-text-fallback/executor-v3.ts";
import { cancelPendingAppointmentPlan } from "../synapse-text-fallback/executor.ts";
import {
  loadConversationContext,
  saveConversationContext,
  updateContextFromResult,
} from "../synapse-text-fallback/entity-context.ts";
import {
  sanitizeVoiceAuditPayload,
  validateVoiceToolCall,
  voicePolicyFailurePayload,
} from "../_shared/synapse-voice-policy.ts";
import {
  assertVoiceSessionOwnership,
  recordVoiceTurn,
  updateVoiceSession,
  voiceConversationTitle,
} from "../_shared/synapse-voice-session.ts";
import { SYNAPSE_VOICE_DISPATCH_TOOL_NAME } from "../_shared/synapse-voice-toolset.ts";
import {
  cancelPersistedActionGroup,
  editPersistedActionGroup,
  loadActionGroupRow,
  prepareAndPersistActionGroup,
  rowPendingAction,
  rowReviewClientAction,
} from "../synapse-action-group/plan-builder.ts";
import { executePersistedActionGroup } from "../synapse-action-group/plan-executor.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type,x-synapse-gateway-secret",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

type PendingAction = {
  kind: "synapse_pending_action";
  actionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  summary: string;
  status: "pending" | "executing" | "executed" | "cancelled" | "failed";
  createdAt: string;
  expiresAt: string;
  conversationId?: string;
  voiceSessionId?: string | null;
  errorMessage?: string;
  updatedAt?: string;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: unknown;
  created_at: string;
};

type PendingReference = { row: MessageRow; action: PendingAction; attachments: any[] };
type AuthResult =
  | { error: Response }
  | { authorization: string; admin: any; userClient: any; user: { id: string } };

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const arrayValue = (value: unknown) =>
  Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];

function parseArgs(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function unwrapVoiceToolCall(nameValue: unknown, argsValue: unknown) {
  const requestedName = clean(nameValue, 120);
  const requestedArgs = parseArgs(argsValue);
  if (requestedName !== SYNAPSE_VOICE_DISPATCH_TOOL_NAME) {
    return { requestedName, name: requestedName, args: requestedArgs };
  }

  const name = clean(requestedArgs.tool_name || requestedArgs.toolName, 120);
  const args = parseArgs(
    requestedArgs.arguments ?? requestedArgs.args ?? requestedArgs.arguments_json,
  );
  return { requestedName, name, args };
}

function findPending(rows: MessageRow[]): PendingReference | null {
  for (const row of rows) {
    if (row.role !== "assistant") continue;
    const attachments = arrayValue(row.attachments);
    const action = attachments.find((item: any) =>
      item?.kind === "synapse_pending_action" &&
      item?.status === "pending" &&
      new Date(item.expiresAt).getTime() > Date.now()
    );
    if (action) return { row, action, attachments };
  }
  return null;
}

async function updatePending(admin: any, pending: PendingReference, status: PendingAction["status"], errorMessage?: string) {
  const attachments = pending.attachments.map((item: any) =>
    item?.kind === "synapse_pending_action" && item?.actionId === pending.action.actionId
      ? { ...item, status, updatedAt: new Date().toISOString(), ...(errorMessage ? { errorMessage } : {}) }
      : item
  );
  await admin.from("messages").update({ attachments }).eq("id", pending.row.id);
}

async function loadRows(admin: any, userId: string, sessionId: string) {
  const { data, error } = await admin
    .from("messages")
    .select("id,role,content,attachments,created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

async function saveMessage(
  admin: any,
  userId: string,
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  attachments: unknown[] = [],
) {
  const text = clean(content, 20000);
  if (!text) return;

  const { data: recent } = await admin
    .from("messages")
    .select("id,content,created_at")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.content === text && Date.now() - new Date(recent.created_at).getTime() < 8000) return;

  const basePayload = {
    user_id: userId,
    session_id: sessionId,
    role,
    content: text,
    attachments: attachments.length ? attachments : null,
  };
  let { error } = await admin.from("messages").insert({
    ...basePayload,
    source_channel: "voice",
    actor_kind: role === "user" ? "professional" : role === "assistant" ? "synapse" : "system",
    metadata: { source: "synapse_voice_tool" },
  });
  if (error && ["42703", "PGRST204"].includes(String(error.code || ""))) {
    const compatibilityResult = await admin.from("messages").insert(basePayload);
    error = compatibilityResult.error;
  }
  if (error) throw error;

  const sessionPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role === "user") sessionPatch.title = voiceConversationTitle(text);
  let sessionUpdate = admin
    .from("chat_sessions")
    .update(sessionPatch)
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (role === "user") {
    sessionUpdate = sessionUpdate.in("title", [
      "Conversa por voz",
      "Nova conversa",
      "Nova Conversa",
      "Synapse Global",
      "Conversa com o Synapse",
    ]);
  }
  await sessionUpdate;
}

function functionContent(payload: Record<string, unknown>) {
  return JSON.stringify(normalizeFunctionPayload(payload));
}

function humanToolLabel(name: string, args: Record<string, any>) {
  const patient = clean(args.patient_name || args.patientName, 120);
  if (patient) return `${name} para ${patient}`;
  return name.replace(/_/g, " ");
}

function isRetryableError(value: unknown) {
  const text = clean(value, 1200).toLowerCase();
  if (!text) return false;
  if (/confirm|confirmacao|confirmação|pendente|ambig|mais de um|nao encontrei|não encontrei|informe|diga|obrigatori|valid/.test(text)) {
    return false;
  }
  return /timeout|temporar|instavel|instável|indisponivel|indisponível|network|fetch|socket|5\d\d|rate limit|too many|gateway|asaas/.test(text);
}

function needsClarification(value: unknown) {
  const text = clean(value, 1200).toLowerCase();
  return /qual|informe|diga|preciso|mais de um|ambig|nao encontrei|não encontrei|selecione|confirme/.test(text);
}

function normalizeFunctionPayload(payload: Record<string, unknown>) {
  const ok = payload.ok === undefined ? !payload.error : Boolean(payload.ok);
  const rawMessage = clean(payload.spoken_summary || payload.message || payload.error, 1400);
  const spoken = rawMessage || (ok ? "Consulta concluida." : "Nao consegui concluir essa acao agora.");
  const confirmationRequired = Boolean(payload.confirmation_required ?? payload.confirmationRequired);
  const retryable = Boolean(payload.retryable ?? (!ok && isRetryableError(payload.error || spoken)));

  return {
    ok,
    tool: clean(payload.tool, 120) || undefined,
    label: clean(payload.label, 180) || undefined,
    spoken_summary: spoken,
    message: spoken,
    retryable,
    needs_clarification: Boolean(payload.needs_clarification ?? (!ok && !retryable && needsClarification(spoken))),
    confirmation_required: confirmationRequired,
    confirmationRequired,
    cancelled: Boolean(payload.cancelled),
    data: ok ? payload.data ?? null : null,
    error: ok ? null : clean(payload.error || spoken, 1400),
    error_code: ok ? null : clean(payload.error_code || payload.errorCode, 80) || "tool_failed",
    grounded: Boolean(payload.grounded),
    recordCount: Number(payload.recordCount || 0),
    structuredData: payload.structuredData || null,
  };
}

async function authenticate(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return { error: json({ error: "Sessao ausente." }, 401) };

  const gatewaySecret = Deno.env.get("SYNAPSE_VOICE_GATEWAY_SECRET") || "";
  if (gatewaySecret && request.headers.get("x-synapse-gateway-secret") !== gatewaySecret) {
    return { error: json({ error: "Gateway nao autorizado." }, 403) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { error: json({ error: "Supabase nao configurado para voz." }, 500) };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData.user;
  if (authError || !user) return { error: json({ error: "Sessao invalida." }, 401) };

  return { authorization, admin, userClient, user };
}

async function callActionGroup(
  authorization: string,
  payload: Record<string, unknown>,
) {
  const supabaseUrl = clean(Deno.env.get("SUPABASE_URL"), 1000);
  const anonKey = clean(Deno.env.get("SUPABASE_ANON_KEY"), 8000);
  const serviceKey = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), 8000);
  if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase nao configurado para o plano composto.");
  if (!authorization.startsWith("Bearer ")) throw new Error("Sessao ausente para o plano composto.");

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7));
  if (authError || !authData.user) throw new Error("Sessao invalida para o plano composto.");
  const userId = authData.user.id;
  const action = clean(payload.action, 80);

  if (action === "prepare") {
    const conversationId = clean(payload.conversationId || payload.sessionId, 120);
    const prepared = await prepareAndPersistActionGroup({
      admin,
      userId,
      conversationId,
      voiceSessionId: clean(payload.voiceSessionId, 120) || null,
      title: clean(payload.title, 180),
      intent: clean(payload.intent, 300),
      spokenSummary: clean(payload.spokenSummary || payload.summary, 1200),
      rawSteps: Array.isArray(payload.steps) ? payload.steps.slice(0, 12) : [],
      capabilityVersion: Number(payload.capabilityVersion) || 1,
    });

    if (prepared.row.confirmation_policy === "direct") {
      const result = await executePersistedActionGroup({
        admin,
        userId,
        row: prepared.row,
        confirmation: "direct",
        authorization,
        requestOrigin: null,
        userClient,
      });
      return { ok: result.status !== "failed", direct: true, result };
    }

    return {
      ok: true,
      direct: false,
      plan: prepared.row.review_public,
      pendingAction: rowPendingAction(prepared.row),
      clientAction: rowReviewClientAction(prepared.row),
    };
  }

  const planId = clean(payload.planId || payload.plan_id, 120);
  const planVersion = Number(payload.planVersion || payload.plan_version);

  if (action === "get") {
    const row = await loadActionGroupRow(admin, userId, planId, planVersion);
    return { ok: true, plan: row.review_public, status: row.status, result: row.result_internal };
  }

  if (action === "edit") {
    const next = await editPersistedActionGroup({
      admin,
      userId,
      planId,
      planVersion,
      planHash: clean(payload.planHash || payload.plan_hash, 64),
      edits: Array.isArray(payload.edits) ? payload.edits : [],
    });
    return {
      ok: true,
      plan: next.row.review_public,
      pendingAction: rowPendingAction(next.row),
      clientAction: rowReviewClientAction(next.row),
    };
  }

  if (action === "cancel") {
    const row = await loadActionGroupRow(admin, userId, planId, planVersion);
    await cancelPersistedActionGroup(admin, userId, row);
    return { ok: true, status: "cancelled" };
  }

  if (action === "execute") {
    const planHash = clean(payload.planHash || payload.plan_hash, 64);
    const row = await loadActionGroupRow(admin, userId, planId, planVersion);
    if (row.plan_hash !== planHash) throw new Error("A versao/hash confirmados nao correspondem ao plano atual.");
    const confirmation = clean(payload.confirmation, 20) as "direct" | "voice" | "opaque";
    const result = await executePersistedActionGroup({
      admin,
      userId,
      row,
      confirmation,
      authorization,
      requestOrigin: null,
      userClient,
    });
    return { ok: result.status !== "failed", result };
  }

  throw new Error("Acao de plano composto invalida.");
}

function groupSteps(value: unknown) {
  const steps = Array.isArray(value) ? value.slice(0, 12) : [];
  return steps.map((rawValue) => {
    const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? rawValue as Record<string, any>
      : {};
    return {
      area: clean(raw.area, 120),
      title: clean(raw.title, 180),
      summary: clean(raw.summary || raw.spoken_summary, 600),
      tool_name: clean(raw.tool_name || raw.toolName, 120),
      arguments: parseArgs(raw.arguments ?? raw.arguments_json),
      depends_on: Array.isArray(raw.depends_on) ? raw.depends_on.slice(0, 12) : [],
    };
  });
}

async function logVoiceAction(
  admin: any,
  input: {
    userId: string;
    conversationId: string;
    voiceSessionId?: string | null;
    toolName: string;
    status: "success" | "error" | "cancelled";
    durationMs: number;
    confirmationRequired?: boolean;
    riskLevel?: string;
    payload?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  try {
    await admin.from("synapse_action_logs").insert({
      user_id: input.userId,
      session_id: input.conversationId,
      voice_session_id: input.voiceSessionId || null,
      channel: "voice",
      action_type: "tool_call",
      tool_name: clean(input.toolName, 120),
      status: input.status,
      duration_ms: Math.max(0, Math.floor(input.durationMs || 0)),
      confirmation_required: Boolean(input.confirmationRequired),
      risk_level: input.riskLevel || null,
      payload: sanitizeVoiceAuditPayload(input.payload || {}),
      error_message: input.errorMessage ? clean(input.errorMessage, 1200) : null,
    });
  } catch (error) {
    console.warn("[synapse-voice-tool] action log failed", error instanceof Error ? error.message : error);
  }
}

serve(async (request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 80) || "execute_tool";
    const sessionId = clean(body.conversationId || body.conversation_id || body.sessionId || body.session_id, 120);
    const voiceSessionId = clean(body.voiceSessionId || body.voice_session_id, 120);
    if (!sessionId) return json({ error: "Conversa ausente." }, 400);

    const { data: session, error: sessionError } = await auth.admin
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (sessionError || !session) return json({ error: "Conversa nao encontrada." }, 404);

    await assertVoiceSessionOwnership(auth.admin, auth.user.id, sessionId, voiceSessionId);

    if (action === "update_voice_session") {
      if (!voiceSessionId) return json({ error: "Sessao de voz ausente." }, 400);
      await updateVoiceSession(auth.admin, auth.user.id, voiceSessionId, {
        status: clean(body.status, 40),
        closeCode: typeof body.closeCode === "number" ? body.closeCode : null,
        closeReason: clean(body.closeReason, 500) || null,
        latencyMs: body.latencyMs && typeof body.latencyMs === "object" ? body.latencyMs : undefined,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
      });
      return json({ ok: true });
    }

    if (action === "persist_message") {
      const role = clean(body.role, 20);
      if (!["user", "assistant", "system"].includes(role)) return json({ error: "Papel invalido." }, 400);
      const content = clean(body.content, 20000);
      const turn = await recordVoiceTurn(auth.admin, {
        userId: auth.user.id,
        conversationId: sessionId,
        voiceSessionId,
        role: role as "user" | "assistant" | "system",
        content,
        origin: clean(body.origin, 120) || "deepgram_conversation_text",
        isFinal: body.isFinal !== false,
        metadata: {
          provider: "deepgram-agent",
          confidence: typeof body.confidence === "number" ? body.confidence : null,
        },
      });
      await saveMessage(auth.admin, auth.user.id, sessionId, role as "user" | "assistant" | "system", content, [{
        source: "voice",
        provider: "deepgram-agent",
        voice_session_id: voiceSessionId || null,
        turn_id: turn?.id || null,
        confidence: typeof body.confidence === "number" ? body.confidence : null,
      }]);
      return json({ ok: true, turnId: turn?.id || null });
    }

    const rows = await loadRows(auth.admin, auth.user.id, sessionId);
    const pending = findPending(rows);
    const toolContext: AgentToolContextV3 = {
      admin: auth.admin,
      userId: auth.user.id,
      sessionId,
      authorization: auth.authorization,
      requestOrigin: request.headers.get("origin") || null,
      userClient: auth.userClient,
      channel: "voice",
      voiceSessionId: voiceSessionId || null,
      toolCallId: clean(body.callId || body.id, 120) || null,
      correlationId: clean(body.requestId || body.request_id || body.callId || body.id, 120) || null,
    };

    if (action === "cancel_pending_action" || clean(body.name, 120) === "cancel_pending_action") {
      const startedAt = Date.now();
      if (!pending) {
        await logVoiceAction(auth.admin, {
          userId: auth.user.id,
          conversationId: sessionId,
          voiceSessionId,
          toolName: "cancel_pending_action",
          status: "success",
          durationMs: Date.now() - startedAt,
          payload: { cancelled: false },
        });
        return json({
          ok: true,
          content: functionContent({
            ok: true,
            tool: "cancel_pending_action",
            cancelled: false,
            message: "Nao havia acao pendente para cancelar.",
          }),
        });
      }
      if (pending.action.conversationId && pending.action.conversationId !== sessionId) {
        return json({
          ok: true,
          content: functionContent({
            ok: false,
            tool: "cancel_pending_action",
            message: "A acao pendente pertence a outra conversa e nao foi alterada.",
            retryable: false,
          }),
        });
      }

      if (pending.action.toolName === "execute_action_group") {
        await callActionGroup(auth.authorization, {
          action: "cancel",
          planId: pending.action.arguments.plan_id,
          planVersion: pending.action.arguments.plan_version,
        });
      } else {
        await cancelPendingAppointmentPlan(pending.action, toolContext);
      }
      await updatePending(auth.admin, pending, "cancelled");
      const message = "A acao pendente foi cancelada. Nenhuma alteracao adicional foi realizada.";
      await saveMessage(auth.admin, auth.user.id, sessionId, "assistant", message, [{
        kind: "synapse_grounding",
        provider: "deepgram-agent",
        grounded: true,
        toolsUsed: ["cancel_pending_action"],
        generatedAt: new Date().toISOString(),
      }]);
      await logVoiceAction(auth.admin, {
        userId: auth.user.id,
        conversationId: sessionId,
        voiceSessionId,
        toolName: "cancel_pending_action",
        status: "cancelled",
        durationMs: Date.now() - startedAt,
        payload: { actionId: pending.action.actionId, toolName: pending.action.toolName },
      });
      return json({
        ok: true,
        content: functionContent({
          ok: true,
          tool: "cancel_pending_action",
          cancelled: true,
          message,
        }),
      });
    }

    if (action === "confirm_pending_action" || clean(body.name, 120) === "confirm_pending_action") {
      const startedAt = Date.now();
      if (!pending) {
        await logVoiceAction(auth.admin, {
          userId: auth.user.id,
          conversationId: sessionId,
          voiceSessionId,
          toolName: "confirm_pending_action",
          status: "error",
          durationMs: Date.now() - startedAt,
          payload: { hasPendingAction: false },
          errorMessage: "Nenhuma acao pendente para confirmar.",
        });
        return json({
          ok: true,
          content: functionContent({
            ok: false,
            tool: "confirm_pending_action",
            message: "Nao ha nenhuma acao pendente para confirmar.",
            needs_clarification: false,
            retryable: false,
          }),
        });
      }
      if (pending.action.conversationId && pending.action.conversationId !== sessionId) {
        return json({
          ok: true,
          content: functionContent({
            ok: false,
            tool: "confirm_pending_action",
            message: "A acao pendente pertence a outra conversa e nao pode ser confirmada aqui.",
            needs_clarification: false,
            retryable: false,
          }),
        });
      }
      await updatePending(auth.admin, pending, "executing");

      let result: any;
      if (pending.action.toolName === "execute_action_group") {
        const confirmationPolicy = clean(pending.action.arguments.confirmation_policy, 20);
        const group = await callActionGroup(auth.authorization, {
          action: "execute",
          planId: pending.action.arguments.plan_id,
          planVersion: pending.action.arguments.plan_version,
          planHash: pending.action.arguments.plan_hash,
          confirmation: confirmationPolicy === "opaque" ? "opaque" : "voice",
        });
        const groupResult = group.result || {};
        result = {
          ok: groupResult.status !== "failed",
          message: clean(groupResult.spokenSummary, 1200) || "Plano executado.",
          error: groupResult.status === "failed" ? clean(groupResult.spokenSummary, 1200) || "O plano nao foi executado." : null,
          grounded: true,
          recordCount: Array.isArray(groupResult.steps)
            ? groupResult.steps.filter((step: any) => step?.status === "completed").length
            : 0,
          data: groupResult,
          structuredData: groupResult,
          clientAction: groupResult.nextVisualAction || null,
        };
      } else {
        result = await executeConfirmedMutationV3(pending.action, toolContext);
      }

      await updatePending(auth.admin, pending, result.ok ? "executed" : "failed", result.error);
      const loadedContext = await loadConversationContext(auth.admin, auth.user.id, sessionId);
      const nextState = pending.action.toolName === "execute_action_group"
        ? loadedContext.state
        : updateContextFromResult(loadedContext.state, pending.action.toolName, pending.action.arguments, result);
      await saveConversationContext(auth.admin, auth.user.id, sessionId, nextState);
      const message = result.ok
        ? result.message || "Acao concluida."
        : `Nao consegui executar: ${result.error || "erro desconhecido"}.`;
      await saveMessage(auth.admin, auth.user.id, sessionId, "assistant", message, [{
        kind: "synapse_grounding",
        provider: "deepgram-agent",
        grounded: result.grounded,
        toolsUsed: [pending.action.toolName],
        recordsFound: result.recordCount || 0,
        generatedAt: new Date().toISOString(),
      }]);
      await logVoiceAction(auth.admin, {
        userId: auth.user.id,
        conversationId: sessionId,
        voiceSessionId,
        toolName: pending.action.toolName,
        status: result.ok ? "success" : "error",
        durationMs: Date.now() - startedAt,
        confirmationRequired: true,
        riskLevel: "high",
        payload: {
          actionId: pending.action.actionId,
          arguments: pending.action.arguments,
          result: result.data || null,
        },
        errorMessage: result.ok ? null : result.error || message,
      });
      return json({
        ok: true,
        content: functionContent({
          ok: result.ok,
          tool: pending.action.toolName,
          label: humanToolLabel(pending.action.toolName, pending.action.arguments),
          message,
          data: result.data || null,
          error: result.ok ? null : result.error || message,
          retryable: !result.ok && isRetryableError(result.error || message),
          structuredData: result.structuredData || null,
        }),
        clientAction: result.clientAction || null,
      });
    }

    const call = unwrapVoiceToolCall(
      body.name || body.functionName,
      body.arguments || body.args,
    );
    const { requestedName, name, args } = call;
    if (!name) {
      return json({
        ok: true,
        content: functionContent({
          ok: false,
          tool: requestedName || SYNAPSE_VOICE_DISPATCH_TOOL_NAME,
          message: "Nao consegui identificar qual capacidade do Synapse deve ser executada.",
          needs_clarification: true,
          retryable: false,
        }),
      });
    }
    const startedAt = Date.now();
    let policy: ReturnType<typeof validateVoiceToolCall>;

    try {
      policy = validateVoiceToolCall(name);
    } catch (policyError) {
      const payload = voicePolicyFailurePayload(policyError, name);
      await logVoiceAction(auth.admin, {
        userId: auth.user.id,
        conversationId: sessionId,
        voiceSessionId,
        toolName: name,
        status: "error",
        durationMs: Date.now() - startedAt,
        riskLevel: "blocked",
        payload: { arguments: args },
        errorMessage: payload.error,
      });
      return json({
        ok: true,
        content: functionContent(payload),
      });
    }

    if (name === "prepare_action_group") {
      const prepared = await callActionGroup(auth.authorization, {
        action: "prepare",
        conversationId: sessionId,
        voiceSessionId: voiceSessionId || null,
        title: clean(args.title, 180),
        intent: clean(args.intent, 300),
        spokenSummary: clean(args.spoken_summary || args.spokenSummary, 1200),
        steps: groupSteps(args.steps),
        capabilityVersion: 1,
      });

      if (prepared.direct) {
        const directResult = prepared.result || {};
        const directOk = directResult.status !== "failed";
        const directMessage = clean(directResult.spokenSummary, 1200) ||
          (directOk ? "Conclui as etapas solicitadas." : "Nao consegui concluir o plano solicitado.");
        await logVoiceAction(auth.admin, {
          userId: auth.user.id,
          conversationId: sessionId,
          voiceSessionId,
          toolName: name,
          status: directOk ? "success" : "error",
          durationMs: Date.now() - startedAt,
          confirmationRequired: false,
          riskLevel: policy.riskLevel,
          payload: { stepCount: Array.isArray(args.steps) ? args.steps.length : 0, direct: true },
          errorMessage: directOk ? null : directMessage,
        });
        return json({
          ok: true,
          content: functionContent({
            ok: directOk,
            tool: "execute_action_group",
            label: clean(args.title, 180) || "plano do Synapse",
            message: directMessage,
            data: directResult,
            error: directOk ? null : directMessage,
            structuredData: directResult,
          }),
          clientAction: directResult.nextVisualAction || null,
          structuredData: directResult,
        });
      }

      const pendingAction = {
        ...(prepared.pendingAction as PendingAction),
        conversationId: sessionId,
        voiceSessionId: voiceSessionId || null,
      } as PendingAction;
      const confirmationPolicy = clean(pendingAction.arguments?.confirmation_policy, 20);
      const message = confirmationPolicy === "opaque"
        ? `Preparei a revisao protegida: ${pendingAction.summary}. Confirme a acao para continuar.`
        : `Preparei a revisao: ${pendingAction.summary}. Diga confirmo acao quando estiver correto.`;
      await saveMessage(auth.admin, auth.user.id, sessionId, "assistant", message, [
        pendingAction,
        {
          kind: "synapse_grounding",
          provider: "deepgram-agent",
          grounded: true,
          toolsUsed: ["prepare_action_group"],
          generatedAt: new Date().toISOString(),
        },
      ]);
      await logVoiceAction(auth.admin, {
        userId: auth.user.id,
        conversationId: sessionId,
        voiceSessionId,
        toolName: name,
        status: "success",
        durationMs: Date.now() - startedAt,
        confirmationRequired: true,
        riskLevel: confirmationPolicy === "opaque" ? "high" : policy.riskLevel,
        payload: {
          stepCount: Array.isArray(args.steps) ? args.steps.length : 0,
          planId: pendingAction.arguments?.plan_id,
          planVersion: pendingAction.arguments?.plan_version,
          confirmationPolicy,
        },
      });
      return json({
        ok: true,
        content: functionContent({
          ok: true,
          tool: confirmationPolicy === "opaque" ? "manage_action_group" : "execute_action_group",
          label: clean(args.title, 180) || "plano do Synapse",
          message,
          data: prepared.plan || null,
          confirmation_required: true,
          confirmationRequired: true,
          grounded: true,
          structuredData: prepared.plan || null,
        }),
        clientAction: prepared.clientAction || null,
        structuredData: prepared.plan || null,
      });
    }

    const loadedContext = await loadConversationContext(auth.admin, auth.user.id, sessionId);
    const execution = await executeAgentToolV3(name, args, toolContext, loadedContext.state);
    await saveConversationContext(auth.admin, auth.user.id, sessionId, execution.state);

    const result = execution.result;
    let toolMessage = result.message || result.error || null;
    if (result.pendingAction) {
      const pendingAction = {
        ...(result.pendingAction as PendingAction),
        conversationId: sessionId,
        voiceSessionId: voiceSessionId || null,
      } as PendingAction;
      const message = `Antes de executar, preciso da sua confirmacao: ${pendingAction.summary}.`;
      toolMessage = message;
      await saveMessage(auth.admin, auth.user.id, sessionId, "assistant", message, [
        pendingAction,
        {
          kind: "synapse_grounding",
          provider: "deepgram-agent",
          grounded: false,
          toolsUsed: [name],
          generatedAt: new Date().toISOString(),
        },
      ]);
    }

    await recordVoiceTurn(auth.admin, {
      userId: auth.user.id,
      conversationId: sessionId,
      voiceSessionId,
      role: "tool",
      content: `${name}:${result.ok ? "success" : result.errorCode || "tool_failed"}`,
      origin: "synapse_voice_tool",
      toolCallId: clean(body.callId || body.id, 120) || null,
      toolName: name,
      confirmationRequired: Boolean(result.pendingAction),
      metadata: {
        ok: result.ok,
        code: result.ok ? null : result.errorCode || "tool_failed",
        record_count: Number(result.recordCount || 0),
        has_client_action: Boolean(result.clientAction),
      },
    });

    await logVoiceAction(auth.admin, {
      userId: auth.user.id,
      conversationId: sessionId,
      voiceSessionId,
      toolName: name,
      status: result.ok ? "success" : "error",
      durationMs: Date.now() - startedAt,
      confirmationRequired: policy.confirmationRequired || Boolean(result.pendingAction),
      riskLevel: policy.riskLevel,
      payload: {
        arguments: args,
        resolvedArgs: execution.resolvedArgs,
        grounded: result.grounded,
        recordCount: result.recordCount || 0,
        pendingAction: Boolean(result.pendingAction),
      },
      errorMessage: result.ok ? null : result.error || toolMessage || "Falha ao consultar o sistema.",
    });

    return json({
      ok: true,
      content: functionContent({
        ok: result.ok,
        tool: name,
        label: humanToolLabel(name, execution.resolvedArgs),
        message: toolMessage,
        data: result.ok ? result.data || null : null,
        error: result.ok ? null : result.error || "Falha ao consultar o sistema.",
        error_code: result.ok ? null : result.errorCode || "tool_failed",
        retryable: !result.ok && isRetryableError(result.error || toolMessage),
        needs_clarification: !result.ok && needsClarification(result.error || toolMessage),
        grounded: result.grounded,
        recordCount: result.recordCount || 0,
        confirmation_required: Boolean(result.pendingAction),
        confirmationRequired: Boolean(result.pendingAction),
        structuredData: result.structuredData || null,
      }),
      clientAction: result.clientAction || null,
      structuredData: result.structuredData || null,
    });
  } catch (error) {
    console.error("[synapse-voice-tool]", error);
    return json({
      error: error instanceof Error ? error.message : "Falha ao executar ferramenta de voz.",
    }, 500);
  }
});
