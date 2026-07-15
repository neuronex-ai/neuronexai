import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-synapse-channel-secret",
};

type ConversationKind = "patient" | "psychologist";

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeInstanceKey = (value: unknown) => String(value || "").trim().toLowerCase();
const digitsOnly = (value: unknown) => String(value || "").replace(/\D/g, "");
const bearerToken = (value: string | null) => String(value || "").replace(/^Bearer\s+/i, "").trim();
const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const isLikelyPhoneDigits = (digits: string) => {
  if (!digits) return false;
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return [8, 9, 10, 11].includes(local.length);
};

const isStatusJid = (remoteJid?: string | null) => {
  const value = safeString(remoteJid).toLowerCase();
  return value === "status@broadcast" || value.includes("status@broadcast");
};

const isGroupJid = (remoteJid?: string | null) => safeString(remoteJid).toLowerCase().includes("@g.us");

const remoteJidToPhone = (remoteJid: string) => {
  const raw = safeString(remoteJid);
  if (!raw || raw.includes("@lid")) return "";
  const clean = raw.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/@.*$/, "");
  const digits = digitsOnly(clean);
  const isPhoneJid = raw.includes("@s.whatsapp.net") || raw.includes("@c.us") || /^[+\d\s().-]+$/.test(clean);
  return isPhoneJid && isLikelyPhoneDigits(digits) ? digits : "";
};

const cleanBaseUrl = (value: string) => value.trim().replace(/\/+$/, "").replace(/\/manager$/i, "");

const addAlias = (aliases: Set<string>, value: unknown) => {
  const raw = safeString(value);
  if (!raw) return;
  aliases.add(raw.toLowerCase());
  const phone = remoteJidToPhone(raw);
  if (phone) {
    aliases.add(phone);
    aliases.add(`${phone}@s.whatsapp.net`);
    return;
  }
  const digits = digitsOnly(raw);
  if (isLikelyPhoneDigits(digits) && /^[+\d\s().@-]+$/.test(raw)) {
    aliases.add(digits);
    aliases.add(`${digits}@s.whatsapp.net`);
  }
};

const aliasCandidatesFrom = (remoteJid?: string | null, phone?: string | null, ...payloads: any[]) => {
  const aliases = new Set<string>();
  addAlias(aliases, remoteJid);
  addAlias(aliases, phone);
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    for (const key of ["id", "remoteJid", "remote_jid", "jid", "wuid", "number", "phone", "participant", "lid"]) {
      addAlias(aliases, payload?.[key]);
    }
    addAlias(aliases, payload?.key?.remoteJid);
    addAlias(aliases, payload?.key?.participant);
  }
  return Array.from(aliases).filter(Boolean).slice(0, 32);
};

const canonicalRemoteJidFor = (remoteJid?: string | null, phone?: string | null, aliases: string[] = []) => {
  const phoneDigits =
    remoteJidToPhone(safeString(remoteJid)) ||
    remoteJidToPhone(safeString(phone)) ||
    aliases.map((alias) => remoteJidToPhone(alias) || (isLikelyPhoneDigits(digitsOnly(alias)) ? digitsOnly(alias) : "")).find(Boolean) ||
    "";
  if (phoneDigits) return `${phoneDigits}@s.whatsapp.net`;
  const group = [safeString(remoteJid), ...aliases].find((alias) => isGroupJid(alias));
  if (group) return group.toLowerCase();
  return safeString(remoteJid).toLowerCase();
};

const sameJid = (a?: string | null, b?: string | null) => {
  const left = safeString(a).toLowerCase();
  const right = safeString(b).toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const leftDigits = digitsOnly(left);
  const rightDigits = digitsOnly(right);
  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
};

const sameAnyJid = (target?: string | null, candidates: Array<string | null | undefined> = []) =>
  candidates.some((candidate) => sameJid(target, candidate));

const sendTargetFor = (remoteJid: string, phone?: string | null) => {
  const fromPhone = remoteJidToPhone(safeString(phone)) || (isLikelyPhoneDigits(digitsOnly(phone)) ? digitsOnly(phone) : "");
  if (fromPhone) return fromPhone;
  const raw = safeString(remoteJid);
  if (!raw) return "";
  if (raw.includes("@s.whatsapp.net") || raw.includes("@c.us")) return remoteJidToPhone(raw);
  if (raw.includes("@g.us")) return raw;
  if (raw.includes("@lid")) return raw;
  if (raw.includes("@") || /[a-z]/i.test(raw)) return raw;
  const digits = digitsOnly(raw);
  return isLikelyPhoneDigits(digits) ? digits : "";
};

const evolutionFetch = async (baseUrl: string, apiKey: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `WhatsApp Business ${response.status}`);
  }
  return data;
};

const stripSynapseWidgets = (text: string) =>
  String(text || "")
    .replace(/```json\s+synapse_widget[\s\S]*?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitForWhatsApp = (text: string, maxLength = 1000) => {
  const clean = stripSynapseWidgets(text);
  if (!clean) return [];
  const chunks: string[] = [];
  let remaining = clean;

  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    const breakAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
    const end = breakAt > 240 ? breakAt : maxLength;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
};

const toIso = (value: unknown) => {
  if (typeof value === "number") {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  if (typeof value === "string" && value) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && value.length >= 10) return toIso(asNumber);
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
};

const extractMessageText = (body: any, data: any, webhookMessage: any) =>
  String(
    body.message ||
      data.text ||
      data.messageText ||
      webhookMessage.conversation ||
      webhookMessage.extendedTextMessage?.text ||
      webhookMessage.imageMessage?.caption ||
      webhookMessage.videoMessage?.caption ||
      "",
  ).trim();

async function ensureWhatsappSession(
  admin: any,
  professionalId: string,
  remoteJid: string,
  conversationKind: ConversationKind,
  pushName?: string | null,
  canonicalRemoteJid?: string | null,
  aliases: string[] = [],
  explicitPhone?: string | null,
) {
  const canonical = canonicalRemoteJid || canonicalRemoteJidFor(remoteJid, explicitPhone, aliases);
  const { data: existingByCanonical, error: canonicalFindError } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", professionalId)
    .contains("context_state", { source: "whatsapp", canonicalRemoteJid: canonical })
    .maybeSingle();
  if (canonicalFindError) throw canonicalFindError;
  if (existingByCanonical?.id) return existingByCanonical.id;

  const { data: existing, error: findError } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", professionalId)
    .contains("context_state", { source: "whatsapp", remoteJid })
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const phone = explicitPhone || remoteJidToPhone(remoteJid);
  const label =
    conversationKind === "psychologist"
      ? "Você e Synapse"
      : pushName
        ? `${pushName} - ${phone || remoteJid}`
        : phone || remoteJid || "Paciente";
  const title = `WhatsApp Business - ${label}`.slice(0, 180);

  const basePayload = {
    user_id: professionalId,
    title,
    context_state: {
      source: "whatsapp",
      remoteJid: remoteJid || null,
      canonicalRemoteJid: canonical || remoteJid || null,
      aliases,
      pushName: pushName || null,
      phoneNumber: phone || null,
      conversation_kind: conversationKind,
    },
  };
  let { data: created, error: createError } = await admin
    .from("chat_sessions")
    .insert({ ...basePayload, origin_channel: "whatsapp", last_channel: "whatsapp" })
    .select("id")
    .single();
  if (createError && ["42703", "PGRST204"].includes(String(createError.code || ""))) {
    const compatibilityResult = await admin
      .from("chat_sessions")
      .insert(basePayload)
      .select("id")
      .single();
    created = compatibilityResult.data;
    createError = compatibilityResult.error;
  }
  if (createError) throw createError;
  return created.id;
}

async function upsertConversation(
  admin: any,
  professionalId: string,
  instanceName: string,
  remoteJid: string,
  conversationKind: ConversationKind,
  sessionId: string,
  pushName: string | null,
  lastMessagePreview: string,
  rawPayload: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const isGroup = isGroupJid(remoteJid);
  const phone = remoteJidToPhone(remoteJid);
  const aliases = aliasCandidatesFrom(remoteJid, phone, rawPayload);
  const canonicalRemoteJid = canonicalRemoteJidFor(remoteJid, phone, aliases);
  const patientName = conversationKind === "psychologist"
    ? "Você e Synapse"
    : pushName || (isGroup ? "Grupo do WhatsApp" : null);
  const payload = {
    user_id: professionalId,
    instance_name: instanceName,
    remote_jid: remoteJid,
    canonical_remote_jid: canonicalRemoteJid || remoteJid,
    remote_jid_aliases: aliases,
    conversation_kind: conversationKind,
    synapse_session_id: sessionId,
    contact_type: isGroup ? "group" : "person",
    is_group: isGroup,
    deleted_at: null,
    patient_name: patientName,
    patient_phone: phone || null,
    last_message_preview: lastMessagePreview || null,
    last_message_at: now,
    unread_count: 0,
    raw_payload: rawPayload,
    updated_at: now,
  };

  const { data: existing, error: existingError } = await admin
    .from("whatsapp_conversations")
    .select("id, remote_jid_aliases")
    .eq("user_id", professionalId)
    .eq("instance_name", instanceName)
    .eq("canonical_remote_jid", canonicalRemoteJid || remoteJid)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const existingAliases = Array.isArray(existing.remote_jid_aliases)
      ? existing.remote_jid_aliases.map((item: unknown) => safeString(item).toLowerCase()).filter(Boolean)
      : [];
    const { data, error } = await admin
      .from("whatsapp_conversations")
      .update({ ...payload, remote_jid_aliases: Array.from(new Set([...existingAliases, ...aliases])) })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await admin
    .from("whatsapp_conversations")
    .upsert(payload, { onConflict: "user_id,instance_name,remote_jid" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertWhatsAppMessage(
  admin: any,
  row: Record<string, unknown>,
) {
  const { error } = await admin
    .from("whatsapp_messages")
    .upsert(row, { onConflict: "user_id,source_message_id" });
  if (error) throw error;
}

async function resolveInstanceApiKey(
  admin: any,
  professionalId: string,
  instanceName: string,
  fallback: string,
) {
  const { data, error } = await admin.rpc("neurozap_get_instance_credential", {
    p_user_id: professionalId,
    p_instance_name: instanceName,
  });
  if (!error && safeString(data)) return safeString(data);
  if (error) console.warn("[synapse-whatsapp-in] private credential RPC unavailable; using manager key fallback.", error);
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const envChannelSecret = Deno.env.get("SYNAPSE_CHANNEL_SECRET") || "";
    const channelSecret = req.headers.get("x-synapse-channel-secret") || "";
    const authorizationSecret = bearerToken(req.headers.get("authorization"));
    const authorized = Boolean(envChannelSecret) && (
      channelSecret === envChannelSecret || authorizationSecret === envChannelSecret
    );

    if (!authorized) return jsonResponse({ error: "Unauthorized Gateway" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = Deno.env.get("SYNAPSE_INTERNAL_SECRET");
    const evolutionBaseUrl = cleanBaseUrl(Deno.env.get("EVOLUTION_API_URL") || "");
    const evolutionManagerApiKey = safeString(Deno.env.get("EVOLUTION_GLOBAL_API_KEY"));
    const autoSend = safeString(Deno.env.get("SYNAPSE_WHATSAPP_AUTO_SEND") || "true").toLowerCase() !== "false";

    if (!supabaseUrl || !supabaseKey || !internalSecret) {
      throw new Error("Configuracao interna Synapse/Supabase ausente.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const body = await req.json();
    const data = body.data ?? {};
    const key = data.key ?? {};
    const webhookMessage = data.message ?? {};

    const fallbackRemoteJid = key.remoteJid || key.remoteJidAlt || "";
    const instanceName = body.instance_name || body.instance;
    const instanceKey = normalizeInstanceKey(instanceName);
    const finalRemoteJid = String(body.remote_jid || fallbackRemoteJid || "").trim();
    const finalMessage = extractMessageText(body, data, webhookMessage);
    const pushName = String(body.push_name || data.pushName || "").trim();
    const finalPhone = remoteJidToPhone(finalRemoteJid);
    const finalAliases = aliasCandidatesFrom(finalRemoteJid, finalPhone, body, data, key);
    const canonicalRemoteJid = canonicalRemoteJidFor(finalRemoteJid, finalPhone, finalAliases);
    const sourceMessageId = String(body.source_message_id || key.id || "").trim();
    const sourceTimestamp = body.source_timestamp || data.messageTimestamp || Math.floor(Date.now() / 1000);
    const messageType = String(body.message_type || data.messageType || "text").trim();
    const eventName = String(body.event || body.event_type || body.type || "").toUpperCase();

    if (!instanceKey || !finalRemoteJid) {
      return jsonResponse({ error: "Missing required fields: instance_name and remote_jid" }, 400);
    }

    if (isStatusJid(finalRemoteJid)) {
      return jsonResponse({ ok: true, ignored: true, reason: "status_broadcast" });
    }

    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("synapse_whatsapp_instances")
      .select("professional_id, instance_name, enabled, owner_remote_jid")
      .eq("instance_key", instanceKey)
      .maybeSingle();

    if (instanceError) throw instanceError;
    if (!instance || instance.enabled === false) {
      return jsonResponse({ error: "WhatsApp instance is not mapped or is disabled" }, 404);
    }

    const professionalId = instance.professional_id;
    let ownerRemoteJid = safeString(instance.owner_remote_jid) || null;
    if (!ownerRemoteJid) {
      const { data: settings } = await supabaseAdmin
        .from("whatsapp_settings")
        .select("psychologist_remote_jid")
        .eq("user_id", professionalId)
        .eq("instance_name", instance.instance_name)
        .maybeSingle();
      ownerRemoteJid = safeString(settings?.psychologist_remote_jid) || null;
      if (ownerRemoteJid) {
        await supabaseAdmin
          .from("synapse_whatsapp_instances")
          .update({ owner_remote_jid: ownerRemoteJid, updated_at: new Date().toISOString() })
          .eq("instance_name", instance.instance_name);
      }
    }

    const conversationKind: ConversationKind = sameAnyJid(ownerRemoteJid, [finalRemoteJid, canonicalRemoteJid, ...finalAliases]) ? "psychologist" : "patient";

    if (!finalMessage) {
      const shouldDelete = /DELETE|REMOVE|REMOVED|ARCHIVE/i.test(eventName) || Boolean(data.deleted || data.removed || data.archived || body.deleted || body.removed);
      if (shouldDelete) {
        await supabaseAdmin
          .from("whatsapp_conversations")
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("user_id", professionalId)
          .eq("instance_name", instance.instance_name)
          .eq("remote_jid", finalRemoteJid);
      }
      return jsonResponse({ ok: true, ignored: true, reason: shouldDelete ? "conversation_removed" : "non_message_event" });
    }
    const sessionId = await ensureWhatsappSession(
      supabaseAdmin,
      professionalId,
      finalRemoteJid,
      conversationKind,
      pushName || null,
      canonicalRemoteJid,
      finalAliases,
      finalPhone,
    );
    const conversationId = await upsertConversation(
      supabaseAdmin,
      professionalId,
      instance.instance_name,
      finalRemoteJid,
      conversationKind,
      sessionId,
      pushName || null,
      finalMessage,
      body,
    );

    const now = new Date().toISOString();
    await upsertWhatsAppMessage(supabaseAdmin, {
      user_id: professionalId,
      conversation_id: conversationId,
      synapse_session_id: sessionId,
      instance_name: instance.instance_name,
      remote_jid: finalRemoteJid,
      canonical_remote_jid: canonicalRemoteJid || finalRemoteJid,
      source_message_id: sourceMessageId || `inbound:${instance.instance_name}:${finalRemoteJid}:${sourceTimestamp}`,
      direction: "inbound",
      sender_kind: conversationKind,
      content: finalMessage,
      content_type: messageType,
      status: "received",
      is_from_ai: false,
      raw_payload: body,
      created_at: toIso(sourceTimestamp),
      updated_at: now,
    });

    const corePayload = {
      professional_id: professionalId,
      session_id: sessionId,
      remote_jid: finalRemoteJid,
      channel: "whatsapp",
      message: finalMessage,
      attachments: body.attachments || [],
      context: {
        currentContext: "synapse",
        route: "whatsapp",
        source: "whatsapp",
        channel: "whatsapp",
        instanceName: instance.instance_name,
        remoteJid: finalRemoteJid,
        pushName: pushName || null,
        conversationKind,
      },
      source: {
        remote_jid: finalRemoteJid,
        instance_name: instance.instance_name,
        push_name: pushName,
        source_message_id: sourceMessageId,
        source_timestamp: sourceTimestamp,
        message_type: messageType,
        conversation_kind: conversationKind,
      },
    };

    const coreResponse = await fetch(`${supabaseUrl}/functions/v1/synapse-text-fallback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-synapse-secret": internalSecret,
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      },
      body: JSON.stringify(corePayload),
    });

    const coreText = await coreResponse.text();
    let coreData: Record<string, any> = {};
    try {
      coreData = coreText ? JSON.parse(coreText) : {};
    } catch {
      coreData = { error: coreText };
    }

    if (!coreResponse.ok) {
      return jsonResponse({
        error: "Core Synapse Error",
        details: coreData.error || coreText,
      }, coreResponse.status);
    }

    const replyText = stripSynapseWidgets(String(coreData.response || ""));
    const replyChunks = splitForWhatsApp(replyText);
    const sentMessages: Record<string, unknown>[] = [];
    const shouldSendReplies = autoSend && Boolean(evolutionBaseUrl && evolutionManagerApiKey && replyChunks.length);
    const instanceApiKey = shouldSendReplies
      ? await resolveInstanceApiKey(supabaseAdmin, professionalId, instance.instance_name, evolutionManagerApiKey)
      : "";
    const sendTarget = sendTargetFor(finalRemoteJid, finalPhone);

    for (let index = 0; index < replyChunks.length; index += 1) {
      let sendResult: Record<string, unknown> | null = null;
      let sendError: string | null = null;
      let status = shouldSendReplies ? "sent" : "queued";
      if (shouldSendReplies) {
        try {
          if (!sendTarget) throw new Error("Contato sem telefone/JID de envio confirmado.");
          sendResult = await evolutionFetch(evolutionBaseUrl, instanceApiKey, `/message/sendText/${encodeURIComponent(instance.instance_name)}`, {
            method: "POST",
            body: JSON.stringify({ number: sendTarget, text: replyChunks[index] }),
          });
          sentMessages.push({ index, ok: true, result: sendResult });
        } catch (error) {
          status = "failed";
          sendError = error instanceof Error ? error.message : String(error);
          sentMessages.push({ index, ok: false, error: sendError });
        }
      }

      await upsertWhatsAppMessage(supabaseAdmin, {
        user_id: professionalId,
        conversation_id: conversationId,
        synapse_session_id: sessionId,
        instance_name: instance.instance_name,
        remote_jid: finalRemoteJid,
        canonical_remote_jid: canonicalRemoteJid || finalRemoteJid,
        source_message_id: `synapse:${sessionId}:${sourceMessageId || sourceTimestamp}:${index}`,
        direction: "outbound",
        sender_kind: "synapse",
        content: replyChunks[index],
        content_type: "text",
        status,
        is_from_ai: true,
        raw_payload: { core_result: coreData, send_result: sendResult, send_error: sendError },
        created_at: new Date(Date.now() + index).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (replyChunks[0]) {
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
          last_message_preview: replyChunks[replyChunks.length - 1],
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    }

    return jsonResponse({
      ok: true,
      session_id: coreData.session_id || sessionId,
      professional_id: professionalId,
      remote_jid: finalRemoteJid,
      conversation_kind: conversationKind,
      reply_text: replyText,
      reply_chunks: replyChunks,
      sent_messages: sentMessages,
      client_action: coreData.clientAction || null,
      core_result: coreData,
    });
  } catch (error: any) {
    console.error("[synapse-whatsapp-in] Gateway Error:", error);
    return jsonResponse({ error: error?.message || "Internal gateway error" }, 500);
  }
});
