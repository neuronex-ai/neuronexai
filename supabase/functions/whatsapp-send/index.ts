import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-synapse-secret",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const bearerToken = (value: string | null) => safeString(value).replace(/^Bearer\s+/i, "");
const cleanBaseUrl = (value: string) => value.trim().replace(/\/+$/, "").replace(/\/manager$/i, "");
const remoteJidToPhone = (remoteJid: string) =>
  remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/@.*$/, "");
const jidToNumber = (remoteJid: string) => remoteJidToPhone(remoteJid).replace(/\D/g, "");
const digitsOnly = (value: unknown) => String(value || "").replace(/\D/g, "");
const sendTargetFor = (remoteJid: string) => {
  const raw = safeString(remoteJid);
  if (!raw) return "";
  if (raw.includes("@s.whatsapp.net") || raw.includes("@c.us")) return jidToNumber(raw);
  if (raw.includes("@") || /[a-z]/i.test(raw)) return raw;
  return digitsOnly(raw) || raw;
};

const isMissingPrivateCredentialStore = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /schema "private"|relation .*neurozap_instance_credentials|neurozap_instance_credentials.*does not exist|Could not find the table/i.test(message);
};

const isPrivateSchemaUnavailable = (error: unknown) => {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = safeString(record.code);
  const message = safeString(record.message || (error instanceof Error ? error.message : String(error || "")));
  return code === "PGRST106" || /schema must be one of|schema .*private.*not exposed/i.test(message);
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = Deno.env.get("SYNAPSE_INTERNAL_SECRET") || "";
    const evolutionBaseUrl = cleanBaseUrl(Deno.env.get("EVOLUTION_API_URL") || "");
    const managerApiKey = safeString(Deno.env.get("EVOLUTION_GLOBAL_API_KEY")) || safeString(Deno.env.get("EVOLUTION_INSTANCE_API_KEY"));

    if (!supabaseUrl || !serviceRoleKey || !evolutionBaseUrl) {
      throw new Error("Configuração interna ausente para envio WhatsApp.");
    }

    const token = bearerToken(req.headers.get("authorization"));
    const headerSecret = safeString(req.headers.get("x-internal-synapse-secret"));
    const authorized = token === serviceRoleKey || (Boolean(internalSecret) && headerSecret === internalSecret);
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const conversationId = safeString(body.conversationId);
    const explicitRemoteJid = safeString(body.remoteJid);
    const message = safeString(body.message || body.text);
    const messageType = safeString(body.messageType) || "text";
    if (messageType !== "text") return json({ error: "Apenas mensagens de texto estao habilitadas neste canal." }, 400);
    if (!message) return json({ error: "Mensagem obrigatoria." }, 400);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    let conversation: any = null;

    if (conversationId) {
      const { data, error } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("id,user_id,instance_name,remote_jid,canonical_remote_jid,patient_phone,synapse_session_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      conversation = data;
    }

    if (!conversation && explicitRemoteJid && body.userId) {
      const { data, error } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("id,user_id,instance_name,remote_jid,canonical_remote_jid,patient_phone,synapse_session_id")
        .eq("user_id", body.userId)
        .eq("remote_jid", explicitRemoteJid)
        .maybeSingle();
      if (error) throw error;
      conversation = data;
    }

    if (!conversation) return json({ error: "Conversa WhatsApp não encontrada." }, 404);

    const { data: credential, error: credentialError } = await supabaseAdmin.rpc("neurozap_get_instance_credential", {
      p_user_id: conversation.user_id,
      p_instance_name: conversation.instance_name,
    });
    if (credentialError && !isPrivateSchemaUnavailable(credentialError) && !isMissingPrivateCredentialStore(credentialError)) throw credentialError;
    const instanceApiKey = safeString(credential) || managerApiKey;
    if (!instanceApiKey) return json({ error: "Canal WhatsApp ainda não configurado para envio." }, 409);

    const remoteJid = explicitRemoteJid || conversation.patient_phone || conversation.canonical_remote_jid || conversation.remote_jid;
    const payload = {
      number: sendTargetFor(remoteJid),
      text: message,
    };

    let sent: any;
    try {
      sent = await evolutionFetch(evolutionBaseUrl, instanceApiKey, `/message/sendText/${encodeURIComponent(conversation.instance_name)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (!managerApiKey || managerApiKey === instanceApiKey) throw error;
      sent = await evolutionFetch(evolutionBaseUrl, managerApiKey, `/message/sendText/${encodeURIComponent(conversation.instance_name)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    const sourceId = safeString(sent?.key?.id || sent?.id) || crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: messageError } = await supabaseAdmin.from("whatsapp_messages").upsert(
      {
        user_id: conversation.user_id,
        conversation_id: conversation.id,
        synapse_session_id: conversation.synapse_session_id || null,
        instance_name: conversation.instance_name,
        remote_jid: explicitRemoteJid || conversation.remote_jid,
        canonical_remote_jid: conversation.canonical_remote_jid || explicitRemoteJid || conversation.remote_jid,
        source_message_id: sourceId,
        direction: "outbound",
        sender_kind: "synapse",
        is_from_ai: true,
        content: message,
        content_type: "text",
        status: "sent",
        raw_payload: sent || {},
        created_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,source_message_id" },
    );
    if (messageError) throw messageError;

    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        last_message_preview: message,
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", conversation.id);

    return json({ success: true, ok: true, sent });
  } catch (error) {
    console.error("[whatsapp-send]", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
