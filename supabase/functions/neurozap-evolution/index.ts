import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "status"
  | "connect"
  | "configureWebhook"
  | "syncConversations"
  | "syncMessages"
  | "sendText";

type EvolutionConfig = {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
  webhookMode: "sandbox" | "production";
  webhookUrl: string;
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanBaseUrl = (value: string) =>
  value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/manager$/i, "");

const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, any>;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.chats)) return record.chats;
    if (Array.isArray(record.records)) return record.records;
    if (Array.isArray(record.messages)) return record.messages;
    if (Array.isArray(record?.messages?.records)) return record.messages.records;
  }
  return [];
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

const remoteJidToPhone = (remoteJid: string) =>
  remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/@.*$/, "");

const jidToNumber = (remoteJid: string) => remoteJidToPhone(remoteJid).replace(/\D/g, "");

const extractMessageText = (message: any): string => {
  const node = message?.message || message;
  return (
    safeString(node?.conversation) ||
    safeString(node?.extendedTextMessage?.text) ||
    safeString(node?.imageMessage?.caption) ||
    safeString(node?.videoMessage?.caption) ||
    safeString(message?.text) ||
    safeString(message?.messageText) ||
    safeString(message?.content) ||
    ""
  );
};

const extractContentType = (message: any): string => {
  const node = message?.message || message;
  if (node?.imageMessage) return "image";
  if (node?.audioMessage) return "audio";
  if (node?.documentMessage) return "document";
  if (node?.videoMessage) return "video";
  return safeString(message?.messageType) || safeString(message?.content_type) || "text";
};

const mapChat = (chat: any, instanceName: string) => {
  const remoteJid =
    safeString(chat?.id) ||
    safeString(chat?.remoteJid) ||
    safeString(chat?.remote_jid) ||
    safeString(chat?.jid);
  const lastMessage =
    safeString(chat?.lastMessage?.message?.conversation) ||
    safeString(chat?.lastMessage?.message?.extendedTextMessage?.text) ||
    safeString(chat?.lastMessage?.message?.imageMessage?.caption) ||
    safeString(chat?.lastMessage?.text) ||
    safeString(chat?.lastMessage) ||
    safeString(chat?.last_message_preview);

  if (!remoteJid) return null;

  return {
    instance_name: instanceName,
    remote_jid: remoteJid,
    patient_name:
      safeString(chat?.name) ||
      safeString(chat?.pushName) ||
      safeString(chat?.subject) ||
      null,
    patient_phone: remoteJidToPhone(remoteJid),
    profile_picture_url: safeString(chat?.profilePictureUrl) || safeString(chat?.profilePicUrl) || safeString(chat?.profile_picture_url) || null,
    last_message_preview: lastMessage || null,
    last_message_at: toIso(chat?.conversationTimestamp || chat?.lastMessage?.messageTimestamp || chat?.updatedAt || chat?.createdAt),
    unread_count: Number(chat?.unreadMessages || chat?.unread_count || 0),
    labels: Array.isArray(chat?.labels) ? chat.labels : [],
    raw_payload: chat || {},
  };
};

const mapMessage = (message: any, instanceName: string, fallbackRemoteJid?: string) => {
  const key = message?.key || {};
  const remoteJid =
    safeString(key?.remoteJid) ||
    safeString(message?.remoteJid) ||
    safeString(message?.remote_jid) ||
    safeString(fallbackRemoteJid);
  const createdAt = toIso(message?.messageTimestamp || message?.timestamp || message?.created_at || message?.createdAt);
  const text = extractMessageText(message);
  const sourceId =
    safeString(key?.id) ||
    safeString(message?.id) ||
    safeString(message?.source_message_id) ||
    `synthetic:${remoteJid}:${createdAt}:${text.slice(0, 80)}`;

  if (!remoteJid) return null;

  return {
    instance_name: instanceName,
    remote_jid: remoteJid,
    source_message_id: sourceId,
    direction: key?.fromMe || message?.fromMe || message?.direction === "outbound" ? "outbound" : "inbound",
    content: text || null,
    content_type: extractContentType(message),
    status: safeString(message?.status) || "sent",
    is_from_ai: Boolean(message?.is_from_ai),
    media_base64: safeString(message?.media_base64) || null,
    media_mimetype: safeString(message?.mimetype || message?.media_mimetype) || null,
    media_filename: safeString(message?.fileName || message?.media_filename) || null,
    raw_payload: message || {},
    created_at: createdAt,
  };
};

const requireConfig = (): EvolutionConfig => {
  const baseUrl = cleanBaseUrl(Deno.env.get("EVOLUTION_API_URL") || "");
  const instanceName = safeString(Deno.env.get("EVOLUTION_INSTANCE_NAME")) || "neuronex-ai";
  const apiKey = safeString(Deno.env.get("EVOLUTION_INSTANCE_API_KEY"));
  const webhookMode = (safeString(Deno.env.get("EVOLUTION_WEBHOOK_MODE")) || "sandbox") === "production"
    ? "production"
    : "sandbox";
  const webhookUrl =
    webhookMode === "production"
      ? safeString(Deno.env.get("EVOLUTION_WEBHOOK_PRODUCTION_URL"))
      : safeString(Deno.env.get("EVOLUTION_WEBHOOK_SANDBOX_URL"));

  if (!baseUrl || !apiKey || !webhookUrl) {
    throw new Error("Configuracao Evolution ausente. Defina EVOLUTION_API_URL, EVOLUTION_INSTANCE_API_KEY e webhook URL.");
  }

  return { baseUrl, instanceName, apiKey, webhookMode, webhookUrl };
};

const evolutionFetch = async (config: EvolutionConfig, path: string, init: RequestInit = {}) => {
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey,
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
    throw new Error(data?.message || data?.error || `Evolution API ${response.status}`);
  }
  return data;
};

const upsertSettings = async (supabaseAdmin: any, userId: string, config: EvolutionConfig, patch: Record<string, unknown>) => {
  const { error } = await supabaseAdmin.from("whatsapp_settings").upsert({
    user_id: userId,
    instance_name: config.instanceName,
    environment: config.webhookMode,
    updated_at: new Date().toISOString(),
    ...patch,
  });
  if (error) throw error;
};

const getUser = async (req: Request, supabaseUrl: string, anonKey: string) => {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Usuario nao autenticado.");
  return data.user;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Configuracao Supabase ausente.");

    const user = await getUser(req, supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const config = requireConfig();
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = safeString(body.action) as Action;

    if (!action) return json({ error: "Action obrigatoria." }, 400);

    if (action === "status") {
      const [connection, webhook] = await Promise.all([
        evolutionFetch(config, `/instance/connectionState/${encodeURIComponent(config.instanceName)}`),
        evolutionFetch(config, `/webhook/find/${encodeURIComponent(config.instanceName)}`).catch((error) => ({ error: error.message })),
      ]);
      const state = safeString(connection?.instance?.state || connection?.state);
      await upsertSettings(supabaseAdmin, user.id, config, {
        is_active: state === "open",
        connection_state: state || null,
        webhook_url: safeString(webhook?.url) || null,
        webhook_enabled: typeof webhook?.enabled === "boolean" ? webhook.enabled : null,
        webhook_events: Array.isArray(webhook?.events) ? webhook.events : [],
        last_status_at: new Date().toISOString(),
        metadata: { webhook },
      });
      return json({ ok: true, instanceName: config.instanceName, environment: config.webhookMode, connection, webhook });
    }

    if (action === "connect") {
      const connection = await evolutionFetch(config, `/instance/connect/${encodeURIComponent(config.instanceName)}`);
      return json({ ok: true, instanceName: config.instanceName, connection });
    }

    if (action === "configureWebhook") {
      const payload = {
        enabled: true,
        url: config.webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: ["MESSAGES_UPSERT", "SEND_MESSAGE"],
      };
      const webhook = await evolutionFetch(config, `/webhook/set/${encodeURIComponent(config.instanceName)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await upsertSettings(supabaseAdmin, user.id, config, {
        webhook_url: config.webhookUrl,
        webhook_enabled: true,
        webhook_events: payload.events,
        metadata: { webhook },
      });
      return json({ ok: true, environment: config.webhookMode, webhookUrl: config.webhookUrl, webhook });
    }

    if (action === "syncConversations") {
      const result = await evolutionFetch(config, `/chat/findChats/${encodeURIComponent(config.instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ where: {}, take: 80, skip: 0, orderBy: { updatedAt: "desc" } }),
      });
      const chats = toArray(result).map((chat) => mapChat(chat, config.instanceName)).filter(Boolean);
      let upserted = 0;
      if (chats.length) {
        const rows = chats.map((chat) => ({ ...chat, user_id: user.id, updated_at: new Date().toISOString() }));
        const { error } = await supabaseAdmin
          .from("whatsapp_conversations")
          .upsert(rows, { onConflict: "user_id,instance_name,remote_jid" });
        if (error) throw error;
        upserted = rows.length;
      }
      await upsertSettings(supabaseAdmin, user.id, config, { is_active: true, last_sync_at: new Date().toISOString() });
      return json({ ok: true, count: upserted });
    }

    if (action === "syncMessages") {
      const remoteJid = safeString(body.remoteJid);
      if (!remoteJid) return json({ error: "remoteJid obrigatorio." }, 400);
      const result = await evolutionFetch(config, `/chat/findMessages/${encodeURIComponent(config.instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ where: { key: { remoteJid } }, take: 50 }),
      });
      const messages = toArray(result).map((item) => mapMessage(item, config.instanceName, remoteJid)).filter(Boolean);

      const { data: conversation, error: convError } = await supabaseAdmin
        .from("whatsapp_conversations")
        .upsert({
          user_id: user.id,
          instance_name: config.instanceName,
          remote_jid: remoteJid,
          patient_phone: remoteJidToPhone(remoteJid),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,instance_name,remote_jid" })
        .select("id")
        .single();
      if (convError) throw convError;

      let upserted = 0;
      if (messages.length) {
        const rows = messages.map((message) => ({
          ...message,
          user_id: user.id,
          conversation_id: conversation.id,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabaseAdmin
          .from("whatsapp_messages")
          .upsert(rows, { onConflict: "user_id,source_message_id" });
        if (error) throw error;
        upserted = rows.length;
      }
      return json({ ok: true, count: upserted });
    }

    if (action === "sendText") {
      const remoteJid = safeString(body.remoteJid);
      const text = safeString(body.text);
      const conversationId = safeString(body.conversationId);
      if (!remoteJid || !text) return json({ error: "remoteJid e text sao obrigatorios." }, 400);

      const sent = await evolutionFetch(config, `/message/sendText/${encodeURIComponent(config.instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ number: remoteJid.includes("@lid") ? remoteJid : jidToNumber(remoteJid), text }),
      });

      const sourceId = safeString(sent?.key?.id || sent?.id) || crypto.randomUUID();
      const { error: insertError } = await supabaseAdmin.from("whatsapp_messages").upsert({
        user_id: user.id,
        conversation_id: conversationId || null,
        instance_name: config.instanceName,
        remote_jid: remoteJid,
        source_message_id: sourceId,
        direction: "outbound",
        content: text,
        content_type: "text",
        status: "sent",
        raw_payload: sent || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,source_message_id" });
      if (insertError) throw insertError;

      if (conversationId) {
        await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            last_message_preview: text,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId)
          .eq("user_id", user.id);
      }

      return json({ ok: true, sent });
    }

    return json({ error: `Action nao suportada: ${action}` }, 400);
  } catch (error) {
    console.error("[neurozap-evolution]", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
