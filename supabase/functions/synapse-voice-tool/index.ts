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
      await cancelPendingAppointmentPlan(pending.action, toolContext);
      await updatePending(auth.admin, pending, "cancelled");
      const message = "A acao pendente foi cancelada. Nenhuma alteracao foi realizada.";
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
      const result = await executeConfirmedMutationV3(pending.action, toolContext);
      await updatePending(auth.admin, pending, result.ok ? "executed" : "failed", result.error);
      const loadedContext = await loadConversationContext(auth.admin, auth.user.id, sessionId);
      const nextState = updateContextFromResult(loadedContext.state, pending.action.toolName, pending.action.arguments, result);
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
