const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

export const voiceConversationTitle = (value: unknown) =>
  clean(value, 5000)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_~`>#()]|\[|\]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/g, "")
    .trim()
    .slice(0, 72) || "Conversa por voz";

export interface VoiceSessionMetadata {
  provider?: string;
  sttProvider?: string;
  ttsProvider?: string;
  voiceId?: string | null;
  listenModel?: string | null;
  thinkModel?: string | null;
  metadata?: Record<string, unknown>;
}

export async function ensureVoiceConversation(
  admin: any,
  userId: string,
  requestedConversationId = "",
) {
  const requested = clean(requestedConversationId, 120);
  if (requested) {
    const { data, error } = await admin
      .from("chat_sessions")
      .select("id")
      .eq("id", requested)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
    throw new Error("Conversa de voz não encontrada para este usuário.");
  }

  const voiceInsert = await admin
    .from("chat_sessions")
    .insert({
      user_id: userId,
      title: "Conversa por voz",
      origin_channel: "voice",
      last_channel: "voice",
    })
    .select("id")
    .single();
  let { data, error } = voiceInsert;
  if (error && ["42703", "PGRST204"].includes(String(error.code || ""))) {
    const compatibilityInsert = await admin
      .from("chat_sessions")
      .insert({ user_id: userId, title: "Conversa por voz" })
      .select("id")
      .single();
    data = compatibilityInsert.data;
    error = compatibilityInsert.error;
  }
  if (error || !data?.id) throw error || new Error("Não foi possível criar a conversa por voz.");
  return data.id as string;
}

export async function ensureVoiceSessionRecord(
  admin: any,
  userId: string,
  conversationId: string,
  requestedVoiceSessionId = "",
  metadata: VoiceSessionMetadata = {},
) {
  const requested = clean(requestedVoiceSessionId, 120);
  if (requested) {
    const { data, error } = await admin
      .from("synapse_voice_sessions")
      .select("id")
      .eq("id", requested)
      .eq("user_id", userId)
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      await updateVoiceSession(admin, userId, data.id as string, {
        status: "connecting",
        metadata: metadata.metadata,
        provider: metadata.provider,
        sttProvider: metadata.sttProvider,
        ttsProvider: metadata.ttsProvider,
        voiceId: metadata.voiceId,
        listenModel: metadata.listenModel,
        thinkModel: metadata.thinkModel,
      });
      return data.id as string;
    }
  }

  const { data, error } = await admin
    .from("synapse_voice_sessions")
    .insert({
      id: requested || crypto.randomUUID(),
      conversation_id: conversationId,
      user_id: userId,
      psychologist_id: userId,
      provider: metadata.provider || "deepgram-agent",
      stt_provider: metadata.sttProvider || "deepgram-flux",
      tts_provider: metadata.ttsProvider || "azure-speech+deepgram-elevenlabs-pt-br-fallback",
      voice_id: metadata.voiceId || null,
      listen_model: metadata.listenModel || null,
      think_model: metadata.thinkModel || null,
      status: "connecting",
      metadata: metadata.metadata || {},
    })
    .select("id")
    .single();
  if (error || !data?.id) throw error || new Error("Não foi possível criar a sessão de voz.");
  return data.id as string;
}

export async function updateVoiceSession(
  admin: any,
  userId: string,
  voiceSessionId: string,
  patch: {
    status?: string;
    closeCode?: number | null;
    closeReason?: string | null;
    latencyMs?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    provider?: string;
    sttProvider?: string;
    ttsProvider?: string;
    voiceId?: string | null;
    listenModel?: string | null;
    thinkModel?: string | null;
  },
) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_event_at: new Date().toISOString(),
  };
  if (patch.status) {
    payload.status = patch.status;
    if (["ended", "error", "cancelled"].includes(patch.status)) payload.ended_at = new Date().toISOString();
  }
  if (patch.closeCode !== undefined) payload.close_code = patch.closeCode;
  if (patch.closeReason !== undefined) payload.close_reason = clean(patch.closeReason, 500) || null;
  if (patch.latencyMs) payload.latency_ms = patch.latencyMs;
  if (patch.metadata) payload.metadata = patch.metadata;
  if (patch.provider) payload.provider = patch.provider;
  if (patch.sttProvider) payload.stt_provider = patch.sttProvider;
  if (patch.ttsProvider) payload.tts_provider = patch.ttsProvider;
  if (patch.voiceId !== undefined) payload.voice_id = patch.voiceId;
  if (patch.listenModel !== undefined) payload.listen_model = patch.listenModel;
  if (patch.thinkModel !== undefined) payload.think_model = patch.thinkModel;

  const { error } = await admin
    .from("synapse_voice_sessions")
    .update(payload)
    .eq("id", voiceSessionId)
    .eq("user_id", userId);
  if (error) throw error;

  // Preserve sessions that reached the active voice pipeline even when they
  // produced no transcript. These rows are the only durable diagnostics for
  // silent microphone/TTS failures. Only remove an empty conversation when a
  // session was cancelled before settings were successfully applied.
  const shouldDeleteEmptyConversation =
    patch.status === "cancelled" && patch.metadata?.settingsApplied !== true;

  if (shouldDeleteEmptyConversation) {
    const { data: voiceSession } = await admin
      .from("synapse_voice_sessions")
      .select("conversation_id")
      .eq("id", voiceSessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (voiceSession?.conversation_id) {
      const { data: message } = await admin
        .from("messages")
        .select("id")
        .eq("session_id", voiceSession.conversation_id)
        .limit(1)
        .maybeSingle();
      if (!message?.id) {
        await admin
          .from("chat_sessions")
          .delete()
          .eq("id", voiceSession.conversation_id)
          .eq("user_id", userId);
      }
    }
  }
}

export async function assertVoiceSessionOwnership(
  admin: any,
  userId: string,
  conversationId: string,
  voiceSessionId = "",
) {
  const voiceId = clean(voiceSessionId, 120);
  if (!voiceId) return null;
  const { data, error } = await admin
    .from("synapse_voice_sessions")
    .select("id,conversation_id,user_id,status")
    .eq("id", voiceId)
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Sessão de voz não encontrada para esta conversa.");
  return data;
}

export async function recordVoiceTurn(
  admin: any,
  input: {
    userId: string;
    conversationId: string;
    voiceSessionId: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    origin?: string;
    isFinal?: boolean;
    toolCallId?: string | null;
    toolName?: string | null;
    confirmationRequired?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  if (!input.voiceSessionId) return null;
  const text = clean(input.content, 20000);
  if (!text) return null;

  const { data, error } = await admin
    .from("synapse_voice_turns")
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      voice_session_id: input.voiceSessionId,
      role: input.role,
      origin: input.origin || "deepgram_conversation_text",
      transcript: input.role === "user" ? text : null,
      response_text: input.role === "assistant" ? text : null,
      is_final: input.isFinal !== false,
      ended_at: new Date().toISOString(),
      tool_call_id: input.toolCallId || null,
      tool_name: input.toolName || null,
      confirmation_required: Boolean(input.confirmationRequired),
      metadata: input.metadata || {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
