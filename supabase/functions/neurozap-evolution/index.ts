import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "status" | "connect" | "syncConversations" | "syncMessages" | "sendText";
type WebhookMode = "sandbox" | "production";
type ConversationKind = "patient" | "psychologist";
type SenderKind = "patient" | "psychologist" | "synapse" | "professional" | "system";

type RuntimeConfig = {
  baseUrl: string;
  managerApiKey: string;
  webhookMode: WebhookMode;
  sandboxWebhookBase: string;
  productionWebhookBase: string;
};

type InstanceConfig = RuntimeConfig & {
  instanceName: string;
  instanceApiKey: string;
  webhookUrl: string;
  psychologistRemoteJid: string | null;
};

const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
  "CHATS_UPSERT",
  "CONTACTS_UPSERT",
];

const INSTANCE_SETTINGS = {
  rejectCall: false,
  groupsIgnore: true,
  alwaysOnline: false,
  readMessages: true,
  readStatus: true,
  syncFullHistory: true,
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const cleanBaseUrl = (value: string) =>
  value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/manager$/i, "");

const normalizeWebhookBase = (value: string, marker: "webhook" | "webhook-test") => {
  const fallback =
    marker === "webhook-test"
      ? "https://webhook.neuronexai.com.br/webhook-test"
      : "https://webhook.neuronexai.com.br/webhook";
  const clean = (value || fallback).trim().replace(/\/+$/, "");
  const markerIndex = clean.indexOf(`/${marker}`);
  if (markerIndex >= 0) return clean.slice(0, markerIndex + marker.length + 1);
  return clean;
};

const buildWebhookUrl = (config: RuntimeConfig, instanceName: string) => {
  const base = config.webhookMode === "production" ? config.productionWebhookBase : config.sandboxWebhookBase;
  return `${base}/${encodeURIComponent(instanceName)}`;
};

const getRuntimeConfig = (): RuntimeConfig => {
  const baseUrl = cleanBaseUrl(Deno.env.get("EVOLUTION_API_URL") || "");
  const managerApiKey = safeString(Deno.env.get("EVOLUTION_GLOBAL_API_KEY"));
  const legacyInstanceKey = safeString(Deno.env.get("EVOLUTION_INSTANCE_API_KEY"));
  const webhookMode: WebhookMode =
    safeString(Deno.env.get("EVOLUTION_WEBHOOK_MODE")) === "production" ? "production" : "sandbox";
  const sandboxWebhookBase = normalizeWebhookBase(
    safeString(Deno.env.get("EVOLUTION_WEBHOOK_SANDBOX_BASE")) ||
      safeString(Deno.env.get("EVOLUTION_WEBHOOK_SANDBOX_URL")),
    "webhook-test",
  );
  const productionWebhookBase = normalizeWebhookBase(
    safeString(Deno.env.get("EVOLUTION_WEBHOOK_PRODUCTION_BASE")) ||
      safeString(Deno.env.get("EVOLUTION_WEBHOOK_PRODUCTION_URL")),
    "webhook",
  );

  if (!baseUrl || !(managerApiKey || legacyInstanceKey)) {
    throw new Error("Configuração do WhatsApp Business ausente. Defina EVOLUTION_API_URL e EVOLUTION_GLOBAL_API_KEY.");
  }

  return {
    baseUrl,
    managerApiKey: managerApiKey || legacyInstanceKey,
    webhookMode,
    sandboxWebhookBase,
    productionWebhookBase,
  };
};

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

const compactArray = <T>(value: T[]) => value.filter(Boolean);

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
const digitsOnly = (value: unknown) => String(value || "").replace(/\D/g, "");

const sendTargetFor = (remoteJid: string) => {
  const raw = safeString(remoteJid);
  if (!raw) return "";
  if (raw.includes("@s.whatsapp.net") || raw.includes("@c.us")) return jidToNumber(raw);
  if (raw.includes("@") || /[a-z]/i.test(raw)) return raw;
  const digits = digitsOnly(raw);
  return digits || raw;
};

const contactJidFrom = (value: any) => {
  const raw =
    safeString(value?.id) ||
    safeString(value?.remoteJid) ||
    safeString(value?.remote_jid) ||
    safeString(value?.jid) ||
    safeString(value?.wuid) ||
    safeString(value?.number) ||
    safeString(value?.phone);
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const digits = digitsOnly(raw);
  return digits ? `${digits}@s.whatsapp.net` : raw;
};

const contactLookupKeys = (remoteJid: string) =>
  compactArray([
    safeString(remoteJid).toLowerCase(),
    remoteJidToPhone(remoteJid).toLowerCase(),
    digitsOnly(remoteJid),
  ]);

const buildContactIndex = (contacts: any[]) => {
  const index = new Map<string, any>();
  for (const contact of contacts) {
    const jid = contactJidFrom(contact);
    for (const key of contactLookupKeys(jid)) index.set(key, contact);
  }
  return index;
};

const findContactFor = (index: Map<string, any>, remoteJid: string) => {
  for (const key of contactLookupKeys(remoteJid)) {
    const found = index.get(key);
    if (found) return found;
  }
  return null;
};

const buildLabelIndex = (labels: any[]) => {
  const index = new Map<string, any>();
  for (const label of labels) {
    const ids = compactArray([
      safeString(label?.id),
      safeString(label?.labelId),
      safeString(label?.label_id),
      safeString(label?.name),
    ]);
    for (const id of ids) index.set(id, label);
  }
  return index;
};

const normalizeLabels = (rawLabels: unknown, labelIndex: Map<string, any>) => {
  const values = Array.isArray(rawLabels)
    ? rawLabels
    : typeof rawLabels === "string" && rawLabels
      ? rawLabels.split(",")
      : [];

  return values.map((item) => {
    if (typeof item === "string" || typeof item === "number") {
      const id = String(item);
      const label = labelIndex.get(id);
      return label
        ? {
          id: safeString(label.id || label.labelId || id) || id,
          name: safeString(label.name || label.label || id) || id,
          color: safeString(label.color || label.hexColor) || null,
        }
        : { id, name: id };
    }

    const label = item as Record<string, unknown>;
    const id = safeString(label.id || label.labelId || label.label_id || label.name);
    const resolved = id ? labelIndex.get(id) : null;
    return {
      id: id || safeString(resolved?.id) || crypto.randomUUID(),
      name: safeString(label.name || label.label || resolved?.name || resolved?.label || id) || "Marcador",
      color: safeString(label.color || label.hexColor || resolved?.color || resolved?.hexColor) || null,
    };
  });
};

const extractProfilePicture = (...payloads: any[]) => {
  for (const payload of payloads) {
    const value =
      safeString(payload?.profilePictureUrl) ||
      safeString(payload?.profilePicUrl) ||
      safeString(payload?.profilePic) ||
      safeString(payload?.profile_picture_url) ||
      safeString(payload?.picture) ||
      safeString(payload?.avatar);
    if (value) return value;
  }
  return null;
};

const extractContactStatus = (...payloads: any[]) => {
  for (const payload of payloads) {
    const value =
      safeString(payload?.status) ||
      safeString(payload?.statusMessage) ||
      safeString(payload?.about) ||
      safeString(payload?.description);
    if (value) return value;
  }
  return null;
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

const normalizeOwnerJid = (value: unknown) => {
  const raw = safeString(value);
  if (!raw) return null;
  if (raw.includes("@")) return raw;
  const digits = digitsOnly(raw);
  return digits ? `${digits}@s.whatsapp.net` : null;
};

const findStringDeep = (input: unknown, keys: string[], depth = 0): string | null => {
  if (!input || depth > 4) return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findStringDeep(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  for (const value of Object.values(record)) {
    const found = findStringDeep(value, keys, depth + 1);
    if (found) return found;
  }
  return null;
};

const extractOwnerJid = (...payloads: unknown[]) => {
  const keys = [
    "ownerJid",
    "owner",
    "owner_jid",
    "jid",
    "wuid",
    "number",
    "profileId",
    "profile_id",
    "id",
  ];
  for (const payload of payloads) {
    const found = normalizeOwnerJid(findStringDeep(payload, keys));
    if (found) return found;
  }
  return null;
};

const extractApiKey = (payload: any, fallback: string) =>
  safeString(payload?.hash) ||
  safeString(payload?.apikey) ||
  safeString(payload?.apiKey) ||
  safeString(payload?.token) ||
  safeString(payload?.instance?.hash) ||
  safeString(payload?.instance?.apikey) ||
  safeString(payload?.instance?.apiKey) ||
  fallback;

const extractConnectionPayload = (payload: any) =>
  payload?.qrcode || payload?.connection || payload?.base64 || payload?.code
    ? payload
    : payload?.data || payload?.instance || payload;

const generateInstanceName = (userId: string) =>
  `neurozap-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`.toLowerCase();

const generateInstanceToken = () =>
  `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

const isMissingPrivateCredentialStore = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /schema "private"|relation .*neurozap_instance_credentials|neurozap_instance_credentials.*does not exist|Could not find the table/i.test(message);
};

const evolutionFetch = async (
  config: { baseUrl: string; managerApiKey: string },
  apiKey: string,
  path: string,
  init: RequestInit = {},
) => {
  const response = await fetch(`${config.baseUrl}${path}`, {
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
    const message = data?.message || data?.error || data?.response?.message || `WhatsApp Business ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
  }
  return data;
};

const evolutionFetchWithFallback = async (
  config: RuntimeConfig,
  instanceApiKey: string,
  path: string,
  init: RequestInit = {},
) => {
  try {
    return await evolutionFetch(config, instanceApiKey, path, init);
  } catch (error) {
    if (instanceApiKey === config.managerApiKey) throw error;
    return evolutionFetch(config, config.managerApiKey, path, init);
  }
};

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

const conversationKindFor = (remoteJid: string, psychologistRemoteJid?: string | null): ConversationKind =>
  sameJid(remoteJid, psychologistRemoteJid) ? "psychologist" : "patient";

const senderKindFor = (
  direction: "inbound" | "outbound",
  conversationKind: ConversationKind,
  isFromAi = false,
): SenderKind => {
  if (isFromAi) return "synapse";
  if (direction === "outbound") return "professional";
  return conversationKind === "psychologist" ? "psychologist" : "patient";
};

const mapChat = (chat: any, config: InstanceConfig, contact: any = null, labelIndex = new Map<string, any>()) => {
  const remoteJid =
    safeString(chat?.id) ||
    safeString(chat?.remoteJid) ||
    safeString(chat?.remote_jid) ||
    safeString(chat?.jid) ||
    contactJidFrom(contact);
  const lastMessage =
    safeString(chat?.lastMessage?.message?.conversation) ||
    safeString(chat?.lastMessage?.message?.extendedTextMessage?.text) ||
    safeString(chat?.lastMessage?.message?.imageMessage?.caption) ||
    safeString(chat?.lastMessage?.text) ||
    safeString(chat?.lastMessage) ||
    safeString(chat?.last_message_preview);

  if (!remoteJid || remoteJid.includes("@g.us")) return null;

  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid);
  const phone = remoteJidToPhone(remoteJid);
  const labels = normalizeLabels(chat?.labels || chat?.labelIds || contact?.labels || contact?.labelIds, labelIndex);
  const contactStatus = extractContactStatus(contact, chat);

  return {
    instance_name: config.instanceName,
    remote_jid: remoteJid,
    conversation_kind: kind,
    patient_name:
      kind === "psychologist"
        ? "Você e Synapse"
        : safeString(chat?.name) ||
          safeString(chat?.pushName) ||
          safeString(contact?.pushName) ||
          safeString(contact?.name) ||
          safeString(contact?.verifiedName) ||
          safeString(chat?.subject) ||
          null,
    patient_phone: phone,
    profile_picture_url: extractProfilePicture(chat, contact),
    last_message_preview: lastMessage || null,
    last_message_at: toIso(chat?.conversationTimestamp || chat?.lastMessage?.messageTimestamp || chat?.updatedAt || chat?.createdAt),
    unread_count: Number(chat?.unreadMessages || chat?.unread_count || 0),
    labels,
    raw_payload: { chat: chat || {}, contact: contact || null, contact_status: contactStatus, labels },
  };
};

const mapMessage = (message: any, config: InstanceConfig, fallbackRemoteJid?: string) => {
  const key = message?.key || {};
  const remoteJid =
    safeString(key?.remoteJid) ||
    safeString(message?.remoteJid) ||
    safeString(message?.remote_jid) ||
    safeString(fallbackRemoteJid);
  if (!remoteJid || remoteJid.includes("@g.us")) return null;

  const createdAt = toIso(message?.messageTimestamp || message?.timestamp || message?.created_at || message?.createdAt);
  const text = extractMessageText(message);
  const sourceId =
    safeString(key?.id) ||
    safeString(message?.id) ||
    safeString(message?.source_message_id) ||
    `synthetic:${config.instanceName}:${remoteJid}:${createdAt}:${text.slice(0, 80)}`;
  const direction = key?.fromMe || message?.fromMe || message?.direction === "outbound" ? "outbound" : "inbound";
  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid);
  const isFromAi = Boolean(message?.is_from_ai);

  return {
    instance_name: config.instanceName,
    remote_jid: remoteJid,
    source_message_id: sourceId,
    direction,
    sender_kind: senderKindFor(direction, kind, isFromAi),
    content: text || null,
    content_type: extractContentType(message),
    status: safeString(message?.status) || "sent",
    is_from_ai: isFromAi,
    media_base64: safeString(message?.media_base64) || null,
    media_mimetype: safeString(message?.mimetype || message?.media_mimetype) || null,
    media_filename: safeString(message?.fileName || message?.media_filename) || null,
    raw_payload: message || {},
    created_at: createdAt,
  };
};

const getUser = async (req: Request, supabaseUrl: string, anonKey: string) => {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Usuário não autenticado.");
  return data.user;
};

const upsertSettings = async (
  supabaseAdmin: any,
  userId: string,
  config: Pick<InstanceConfig, "instanceName" | "webhookMode" | "webhookUrl">,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin.from("whatsapp_settings").upsert({
    user_id: userId,
    instance_name: config.instanceName,
    environment: config.webhookMode,
    webhook_url: config.webhookUrl,
    updated_at: new Date().toISOString(),
    ...patch,
  });
  if (error) throw error;
};

const upsertMapping = async (
  supabaseAdmin: any,
  userId: string,
  config: Pick<InstanceConfig, "instanceName" | "webhookMode" | "webhookUrl">,
  patch: Record<string, unknown> = {},
) => {
  const { error } = await supabaseAdmin.from("synapse_whatsapp_instances").upsert(
    {
      professional_id: userId,
      instance_name: config.instanceName,
      label: "NeuroZap",
      enabled: true,
      environment: config.webhookMode,
      webhook_url: config.webhookUrl,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: "instance_name" },
  );
  if (error) throw error;
};

const storePrivateCredential = async (supabaseAdmin: any, userId: string, instanceName: string, instanceApiKey: string) => {
  const { error } = await supabaseAdmin.schema("private").from("neurozap_instance_credentials").upsert(
    {
      user_id: userId,
      instance_name: instanceName,
      instance_api_key: instanceApiKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    if (isMissingPrivateCredentialStore(error)) {
      console.warn("[neurozap-evolution] private credential store unavailable; using server-side manager key fallback until migration is applied.");
      return;
    }
    throw error;
  }
};

const loadInstanceConfig = async (
  supabaseAdmin: any,
  userId: string,
  runtime: RuntimeConfig,
): Promise<InstanceConfig | null> => {
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("whatsapp_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsError) throw settingsError;
  const instanceName = safeString(settings?.instance_name);
  if (!instanceName) return null;

  const { data: credential, error: credentialError } = await supabaseAdmin
    .schema("private")
    .from("neurozap_instance_credentials")
    .select("instance_api_key")
    .eq("user_id", userId)
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (credentialError && !isMissingPrivateCredentialStore(credentialError)) throw credentialError;

  const webhookMode: WebhookMode = settings.environment === "production" ? "production" : runtime.webhookMode;
  return {
    ...runtime,
    webhookMode,
    instanceName,
    instanceApiKey: safeString(credential?.instance_api_key) || runtime.managerApiKey,
    webhookUrl: safeString(settings.webhook_url) || buildWebhookUrl({ ...runtime, webhookMode }, instanceName),
    psychologistRemoteJid: safeString(settings.psychologist_remote_jid) || null,
  };
};

const ensureInstanceConfig = async (
  supabaseAdmin: any,
  userId: string,
  runtime: RuntimeConfig,
): Promise<InstanceConfig> => {
  const existing = await loadInstanceConfig(supabaseAdmin, userId, runtime);
  if (existing) return existing;

  const instanceName = generateInstanceName(userId);
  const desiredToken = generateInstanceToken();
  const webhookUrl = buildWebhookUrl(runtime, instanceName);
  const provisionalConfig: InstanceConfig = {
    ...runtime,
    instanceName,
    instanceApiKey: desiredToken,
    webhookUrl,
    psychologistRemoteJid: null,
  };

  const createPayload = {
    instanceName,
    token: desiredToken,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    ...INSTANCE_SETTINGS,
    webhook: {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: true,
      events: WEBHOOK_EVENTS,
    },
  };

  let created: any = {};
  try {
    created = await evolutionFetch(runtime, runtime.managerApiKey, "/instance/create", {
      method: "POST",
      body: JSON.stringify(createPayload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/exist|already|duplicate|409/i.test(message)) throw error;
    created = { reused: true };
  }

  const instanceApiKey = extractApiKey(created, desiredToken);
  const config = { ...provisionalConfig, instanceApiKey };

  await storePrivateCredential(supabaseAdmin, userId, instanceName, instanceApiKey);
  await upsertSettings(supabaseAdmin, userId, config, {
    is_active: false,
    connection_state: "created",
    webhook_enabled: true,
    webhook_events: WEBHOOK_EVENTS,
    settings_applied_at: new Date().toISOString(),
    last_error: null,
    metadata: { created: { reused: Boolean(created?.reused), has_qrcode: Boolean(created?.qrcode) } },
  });
  await upsertMapping(supabaseAdmin, userId, config, {
    last_connection_state: "created",
    metadata: { managed_by: "neurozap", webhook_events: WEBHOOK_EVENTS },
  });

  return config;
};

const applyInstanceSettings = async (config: InstanceConfig) => {
  await evolutionFetchWithFallback(config, config.instanceApiKey, `/settings/set/${encodeURIComponent(config.instanceName)}`, {
    method: "POST",
    body: JSON.stringify(INSTANCE_SETTINGS),
  });
};

const applyWebhook = async (config: InstanceConfig) => {
  const payload = {
    webhook: {
      enabled: true,
      url: config.webhookUrl,
      byEvents: false,
      base64: true,
      events: WEBHOOK_EVENTS,
    },
  };
  return evolutionFetchWithFallback(config, config.instanceApiKey, `/webhook/set/${encodeURIComponent(config.instanceName)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

const fetchOwnerJid = async (config: InstanceConfig, ...payloads: unknown[]) => {
  const direct = extractOwnerJid(...payloads);
  if (direct) return direct;
  const fetched = await evolutionFetch(config, config.managerApiKey, `/instance/fetchInstances?instanceName=${encodeURIComponent(config.instanceName)}`)
    .catch(() => null);
  return extractOwnerJid(fetched);
};

const updateConnectionState = async (
  supabaseAdmin: any,
  userId: string,
  config: InstanceConfig,
  state: string,
  ownerJid?: string | null,
  metadata: Record<string, unknown> = {},
) => {
  const ownerRemoteJid = ownerJid || config.psychologistRemoteJid || null;
  await upsertSettings(supabaseAdmin, userId, config, {
    is_active: state === "open",
    connection_state: state || null,
    psychologist_remote_jid: ownerRemoteJid,
    psychologist_phone: ownerRemoteJid ? remoteJidToPhone(ownerRemoteJid) : null,
    last_status_at: new Date().toISOString(),
    last_error: null,
    metadata,
  });
  await upsertMapping(supabaseAdmin, userId, config, {
    owner_remote_jid: ownerRemoteJid,
    last_connection_state: state || null,
  });
};

const ensureSynapseSession = async (
  supabaseAdmin: any,
  userId: string,
  remoteJid: string,
  conversationKind: ConversationKind,
  displayName?: string | null,
) => {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .contains("context_state", { source: "whatsapp", remoteJid })
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id;

  const phone = remoteJidToPhone(remoteJid);
  const title =
    conversationKind === "psychologist"
      ? "WhatsApp Business - Você e Synapse"
      : `WhatsApp Business - ${displayName || phone || "Paciente"}`.slice(0, 180);
  const { data: created, error: createError } = await supabaseAdmin
    .from("chat_sessions")
    .insert({
      user_id: userId,
      title,
      context_state: {
        source: "whatsapp",
        remoteJid,
        phoneNumber: phone || null,
        pushName: displayName || null,
        conversation_kind: conversationKind,
      },
    })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
};

const upsertConversation = async (
  supabaseAdmin: any,
  userId: string,
  config: InstanceConfig,
  remoteJid: string,
  patch: Record<string, unknown> = {},
) => {
  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid);
  const displayName = kind === "psychologist" ? "Você e Synapse" : safeString(patch.patient_name) || null;
  const sessionId = await ensureSynapseSession(supabaseAdmin, userId, remoteJid, kind, displayName);
  const { data, error } = await supabaseAdmin
    .from("whatsapp_conversations")
    .upsert(
      {
        user_id: userId,
        instance_name: config.instanceName,
        remote_jid: remoteJid,
        conversation_kind: kind,
        synapse_session_id: sessionId,
        patient_phone: remoteJidToPhone(remoteJid),
        updated_at: new Date().toISOString(),
        ...patch,
      },
      { onConflict: "user_id,instance_name,remote_jid" },
    )
    .select("id, synapse_session_id, conversation_kind")
    .single();
  if (error) throw error;
  return data;
};

const fetchMessagesForRemote = async (
  config: InstanceConfig,
  remoteJid: string,
  maxPages = 3,
  pageSize = 200,
) => {
  const collected: any[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await evolutionFetchWithFallback(config, config.instanceApiKey, `/chat/findMessages/${encodeURIComponent(config.instanceName)}`, {
      method: "POST",
      body: JSON.stringify({ where: { key: { remoteJid } }, page, offset: pageSize, take: pageSize }),
    });
    const items = toArray(result);
    collected.push(...items);
    if (items.length < pageSize) break;
  }
  return collected;
};

const syncMessagesForRemote = async (
  supabaseAdmin: any,
  userId: string,
  config: InstanceConfig,
  remoteJid: string,
  maxPages = 3,
  pageSize = 200,
) => {
  const result = await fetchMessagesForRemote(config, remoteJid, maxPages, pageSize);
  const messages = result.map((item) => mapMessage(item, config, remoteJid)).filter(Boolean);
  const conversation = await upsertConversation(supabaseAdmin, userId, config, remoteJid);
  if (!messages.length) return 0;

  const rows = messages.map((message) => ({
    ...message,
    user_id: userId,
    conversation_id: conversation.id,
    synapse_session_id: conversation.synapse_session_id,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from("whatsapp_messages")
    .upsert(rows, { onConflict: "user_id,source_message_id" });
  if (error) throw error;
  return rows.length;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Configuração Supabase ausente.");

    const user = await getUser(req, supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const runtime = getRuntimeConfig();
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = safeString(body.action) as Action;

    if (!action) return json({ error: "Action obrigatoria." }, 400);

    if (action === "connect") {
      const config = await ensureInstanceConfig(supabaseAdmin, user.id, runtime);
      await applyInstanceSettings(config);
      const webhook = await applyWebhook(config);
      const connection = await evolutionFetchWithFallback(config, config.instanceApiKey, `/instance/connect/${encodeURIComponent(config.instanceName)}`);
      await upsertSettings(supabaseAdmin, user.id, config, {
        webhook_enabled: true,
        webhook_events: WEBHOOK_EVENTS,
        settings_applied_at: new Date().toISOString(),
        last_error: null,
        metadata: { webhook, connect: { has_qrcode: Boolean(connection?.base64 || connection?.qrcode || connection?.code || connection?.qrcode?.base64) } },
      });
      return json({
        ok: true,
        instanceName: config.instanceName,
        environment: config.webhookMode,
        connection: extractConnectionPayload(connection),
      });
    }

    const loadedConfig = await loadInstanceConfig(supabaseAdmin, user.id, runtime);
    if (!loadedConfig) {
      return json({
        ok: false,
        connected: false,
        message: "WhatsApp Business ainda não conectado.",
      });
    }

    if (action === "status") {
      const [connection, webhook] = await Promise.all([
        evolutionFetchWithFallback(
          loadedConfig,
          loadedConfig.instanceApiKey,
          `/instance/connectionState/${encodeURIComponent(loadedConfig.instanceName)}`,
        ),
        evolutionFetchWithFallback(
          loadedConfig,
          loadedConfig.instanceApiKey,
          `/webhook/find/${encodeURIComponent(loadedConfig.instanceName)}`,
        ).catch((error) => ({ error: error.message })),
      ]);
      const state = safeString(connection?.instance?.state || connection?.state || connection?.connectionState);
      const ownerJid = await fetchOwnerJid(loadedConfig, connection);
      await updateConnectionState(supabaseAdmin, user.id, loadedConfig, state, ownerJid, { webhook });
      return json({
        ok: true,
        instanceName: loadedConfig.instanceName,
        environment: loadedConfig.webhookMode,
        connection,
        webhook,
        psychologistRemoteJid: ownerJid || loadedConfig.psychologistRemoteJid,
      });
    }

    if (action === "syncConversations") {
      const [result, contactsResult, labelsResult] = await Promise.all([
        evolutionFetchWithFallback(loadedConfig, loadedConfig.instanceApiKey, `/chat/findChats/${encodeURIComponent(loadedConfig.instanceName)}`, {
          method: "POST",
          body: JSON.stringify({ where: {}, take: 100, skip: 0, orderBy: { updatedAt: "desc" } }),
        }),
        evolutionFetchWithFallback(loadedConfig, loadedConfig.instanceApiKey, `/chat/findContacts/${encodeURIComponent(loadedConfig.instanceName)}`, {
          method: "POST",
          body: JSON.stringify({ where: {} }),
        }).catch((error) => ({ error: error.message, data: [] })),
        evolutionFetchWithFallback(loadedConfig, loadedConfig.instanceApiKey, `/label/findLabels/${encodeURIComponent(loadedConfig.instanceName)}`)
          .catch((error) => ({ error: error.message, data: [] })),
      ]);
      const contacts = toArray(contactsResult);
      const contactIndex = buildContactIndex(contacts);
      const labelIndex = buildLabelIndex(toArray(labelsResult));
      const chats = toArray(result)
        .map((chat) => {
          const remoteJid =
            safeString(chat?.id) ||
            safeString(chat?.remoteJid) ||
            safeString(chat?.remote_jid) ||
            safeString(chat?.jid);
          return mapChat(chat, loadedConfig, findContactFor(contactIndex, remoteJid), labelIndex);
        })
        .filter(Boolean);
      let upserted = 0;
      for (const chat of chats) {
        await upsertConversation(supabaseAdmin, user.id, loadedConfig, chat.remote_jid, {
          ...chat,
          updated_at: new Date().toISOString(),
        });
        upserted += 1;
      }
      let syncedMessages = 0;
      for (const chat of chats) {
        syncedMessages += await syncMessagesForRemote(supabaseAdmin, user.id, loadedConfig, chat.remote_jid, 2, 200).catch((error) => {
          console.warn("[neurozap-evolution] message sync failed for chat", chat.remote_jid, error);
          return 0;
        });
      }
      await upsertSettings(supabaseAdmin, user.id, loadedConfig, {
        is_active: true,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        metadata: {
          sync: {
            chats: chats.length,
            contacts: contacts.length,
            labels: labelIndex.size,
            messages: syncedMessages,
            synced_at: new Date().toISOString(),
          },
        },
      });
      return json({ ok: true, count: upserted, messages: syncedMessages });
    }

    if (action === "syncMessages") {
      const remoteJid = safeString(body.remoteJid);
      if (!remoteJid) return json({ error: "remoteJid obrigatório." }, 400);
      const upserted = await syncMessagesForRemote(supabaseAdmin, user.id, loadedConfig, remoteJid, 5, 200);
      return json({ ok: true, count: upserted });
    }

    if (action === "sendText") {
      const remoteJid = safeString(body.remoteJid);
      const text = safeString(body.text);
      const conversationId = safeString(body.conversationId);
      if (!remoteJid || !text) return json({ error: "remoteJid e text são obrigatórios." }, 400);

      const sent = await evolutionFetchWithFallback(loadedConfig, loadedConfig.instanceApiKey, `/message/sendText/${encodeURIComponent(loadedConfig.instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ number: sendTargetFor(remoteJid), text }),
      });

      const conversation = conversationId
        ? { id: conversationId, synapse_session_id: null }
        : await upsertConversation(supabaseAdmin, user.id, loadedConfig, remoteJid);
      const sourceId = safeString(sent?.key?.id || sent?.id) || crypto.randomUUID();
      const { error: insertError } = await supabaseAdmin.from("whatsapp_messages").upsert(
        {
          user_id: user.id,
          conversation_id: conversation.id || null,
          synapse_session_id: conversation.synapse_session_id || null,
          instance_name: loadedConfig.instanceName,
          remote_jid: remoteJid,
          source_message_id: sourceId,
          direction: "outbound",
          sender_kind: "professional",
          content: text,
          content_type: "text",
          status: "sent",
          raw_payload: sent || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,source_message_id" },
      );
      if (insertError) throw insertError;

      if (conversation.id) {
        await supabaseAdmin
          .from("whatsapp_conversations")
          .update({
            last_message_preview: text,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversation.id)
          .eq("user_id", user.id);
      }

      return json({ ok: true, success: true, sent });
    }

    return json({ error: `Action não suportada: ${action}` }, 400);
  } catch (error) {
    console.error("[neurozap-evolution]", error);
    return json({ error: error instanceof Error ? error.message : "Erro interno." }, 500);
  }
});
