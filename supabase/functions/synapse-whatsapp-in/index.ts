import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-synapse-channel-secret",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeInstanceKey = (value: unknown) => String(value || "").trim().toLowerCase();
const digitsOnly = (value: unknown) => String(value || "").replace(/\D/g, "");
const bearerToken = (value: string | null) => String(value || "").replace(/^Bearer\s+/i, "").trim();

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

async function ensureWhatsappSession(
  admin: any,
  professionalId: string,
  remoteJid: string,
  pushName?: string | null,
) {
  const phone = digitsOnly(remoteJid);
  const label = pushName ? `${pushName} • ${phone || remoteJid}` : (phone || remoteJid || "contato");
  const title = `WhatsApp • ${label}`.slice(0, 180);

  const { data: existing, error: findError } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", professionalId)
    .eq("title", title)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await admin
    .from("chat_sessions")
    .insert({
      user_id: professionalId,
      title,
      context_state: {
        source: "whatsapp",
        remoteJid: remoteJid || null,
        pushName: pushName || null,
        phoneNumber: phone || null,
      },
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const envChannelSecret = Deno.env.get("SYNAPSE_CHANNEL_SECRET") || "";
    const channelSecret = req.headers.get("x-synapse-channel-secret") || "";
    const authorizationSecret = bearerToken(req.headers.get("authorization"));

    // n8n self-hosted can block $env access inside nodes. To keep the workflow working,
    // accept the same shared secret via either x-synapse-channel-secret or Authorization: Bearer <secret>.
    const authorized = Boolean(envChannelSecret) && (
      channelSecret === envChannelSecret || authorizationSecret === envChannelSecret
    );

    if (!authorized) {
      return jsonResponse({ error: "Unauthorized Gateway" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = Deno.env.get("SYNAPSE_INTERNAL_SECRET");

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
    const finalMessage = String(
      body.message ||
      data.text ||
      webhookMessage.conversation ||
      webhookMessage.extendedTextMessage?.text ||
      "",
    ).trim();
    const pushName = String(body.push_name || data.pushName || "").trim();
    const sourceMessageId = String(body.source_message_id || key.id || "").trim();
    const sourceTimestamp = body.source_timestamp || data.messageTimestamp || Math.floor(Date.now() / 1000);
    const messageType = String(body.message_type || data.messageType || "text").trim();

    if (!instanceKey || !finalRemoteJid || !finalMessage) {
      return jsonResponse({ error: "Missing required fields: instance_name, remote_jid and message" }, 400);
    }

    const { data: instance, error: instanceError } = await supabaseAdmin
      .from("synapse_whatsapp_instances")
      .select("professional_id, instance_name, enabled")
      .eq("instance_key", instanceKey)
      .maybeSingle();

    if (instanceError) throw instanceError;
    if (!instance || instance.enabled === false) {
      return jsonResponse({ error: "WhatsApp instance is not mapped or is disabled" }, 404);
    }

    const professionalId = instance.professional_id;
    const sessionId = await ensureWhatsappSession(supabaseAdmin, professionalId, finalRemoteJid, pushName);

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
      },
      source: {
        remote_jid: finalRemoteJid,
        instance_name: instance.instance_name,
        push_name: pushName,
        source_message_id: sourceMessageId,
        source_timestamp: sourceTimestamp,
        message_type: messageType,
      },
    };

    const coreResponse = await fetch(`${supabaseUrl}/functions/v1/gemini-text-chat`, {
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

    return jsonResponse({
      ok: true,
      session_id: coreData.session_id || sessionId,
      professional_id: professionalId,
      remote_jid: finalRemoteJid,
      reply_text: replyText,
      reply_chunks: replyChunks,
      client_action: coreData.clientAction || null,
      core_result: coreData,
    });
  } catch (error: any) {
    console.error("[synapse-whatsapp-in] Gateway Error:", error);
    return jsonResponse({ error: error?.message || "Internal gateway error" }, 500);
  }
});
