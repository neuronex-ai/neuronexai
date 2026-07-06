import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "status" | "connect" | "logout" | "syncConversations" | "syncMessages" | "sendText";
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

type EvolutionRequestCandidate = {
  path: string;
  init?: RequestInit;
  label?: string;
};

const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "SEND_MESSAGE",
  "CHATS_SET",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "CONTACTS_SET",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "LABELS_EDIT",
  "LABELS_ASSOCIATION",
];

const INSTANCE_SETTINGS = {
  rejectCall: false,
  groupsIgnore: true,
  alwaysOnline: false,
  readMessages: true,
  readStatus: false,
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

const isManagedWebhookUrl = (value: string, instanceName: string) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.hostname !== "webhook.neuronexai.com.br") return false;
    const instance = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return instance === instanceName;
  } catch {
    return false;
  }
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
    throw new Error("Configura\u00e7\u00e3o do WhatsApp Business ausente. Defina EVOLUTION_API_URL e EVOLUTION_GLOBAL_API_KEY.");
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

const isStatusJid = (remoteJid?: string | null) => {
  const value = safeString(remoteJid).toLowerCase();
  return value === "status@broadcast" || value.includes("status@broadcast");
};

const isGroupJid = (remoteJid?: string | null) => safeString(remoteJid).toLowerCase().includes("@g.us");
const digitsOnly = (value: unknown) => String(value || "").replace(/\D/g, "");

const isLikelyPhoneDigits = (digits: string) => {
  if (!digits) return false;
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return [8, 9, 10, 11].includes(local.length);
};

const remoteJidToPhone = (remoteJid: string) => {
  const raw = safeString(remoteJid);
  if (!raw || raw.includes("@lid")) return "";
  const clean = raw.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/@.*$/, "");
  const digits = digitsOnly(clean);
  const isPhoneJid = raw.includes("@s.whatsapp.net") || raw.includes("@c.us") || /^[+\d\s().-]+$/.test(clean);
  return isPhoneJid && isLikelyPhoneDigits(digits) ? digits : "";
};

const jidToNumber = (remoteJid: string) => remoteJidToPhone(remoteJid).replace(/\D/g, "");

const sendTargetFor = (remoteJid: string) => {
  const raw = safeString(remoteJid);
  if (!raw) return "";
  if (raw.includes("@s.whatsapp.net") || raw.includes("@c.us")) return jidToNumber(raw);
  if (raw.includes("@") || /[a-z]/i.test(raw)) return raw;
  const digits = digitsOnly(raw);
  return isLikelyPhoneDigits(digits) ? digits : "";
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

const extractPhoneNumber = (...payloads: any[]) => {
  for (const payload of payloads) {
    const values = [
      payload?.phone,
      payload?.number,
      payload?.wuid,
      payload?.id,
      payload?.jid,
      payload?.remoteJid,
      payload?.remote_jid,
    ];
    for (const value of values) {
      const raw = safeString(value);
      if (!raw) continue;
      const phone = remoteJidToPhone(raw);
      if (phone) return phone;
      const digits = digitsOnly(raw);
      if (isLikelyPhoneDigits(digits) && /^[+\d\s().@-]+$/.test(raw)) return digits;
    }
  }
  return "";
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

const pickQrValue = (...nodes: any[]) => {
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const candidates = [
      node?.qr,
      node?.qrCode,
      node?.qrcode?.base64,
      node?.qrcode?.code,
      node?.qrcode,
      node?.base64,
      node?.pairingCode,
      node?.code,
    ];
    for (const candidate of candidates) {
      const value = safeString(candidate);
      if (!value) continue;
      if (/^\d{3}$/.test(value)) continue;
      return value;
    }
  }
  return null;
};

const qrImageSrcFor = (qr: string | null) => {
  if (!qr) return null;
  if (qr.startsWith("data:")) return qr;
  if (/^https?:\/\//i.test(qr)) return null;
  return qr.length > 120 ? `data:image/png;base64,${qr}` : null;
};

const extractConnectionPayload = (payload: any) => {
  const nodes = [
    payload,
    payload?.connection,
    payload?.qrcode,
    payload?.data,
    payload?.data?.connection,
    payload?.data?.qrcode,
    payload?.instance,
  ];
  const qr = pickQrValue(...nodes);
  return {
    qr,
    qrImageSrc: qrImageSrcFor(qr),
    code: safeString(payload?.code || payload?.data?.code) || null,
    pairingCode: safeString(payload?.pairingCode || payload?.data?.pairingCode || payload?.qrcode?.pairingCode) || null,
    raw: payload || {},
  };
};

const generateInstanceName = (userId: string) =>
  `neurozap-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`.toLowerCase();

const generateInstanceToken = () =>
  `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

const isMissingPrivateCredentialStore = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /schema "private"|relation .*neurozap_instance_credentials|neurozap_instance_credentials.*does not exist|Could not find the table/i.test(message);
};

const readableEvolutionMessage = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readableEvolutionMessage).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readableEvolutionMessage(record.message) ||
      readableEvolutionMessage(record.error) ||
      readableEvolutionMessage(record.details) ||
      readableEvolutionMessage(record.response) ||
      readableEvolutionMessage(record.data) ||
      JSON.stringify(record).slice(0, 300)
    );
  }
  return "";
};

const isEvolutionMissingError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /(^|[\s(:])404([\s).:]|not found|n[aã]o encontrada|n[aã]o encontrado|does not exist|instance.*missing|instance.*not.*exist|inst[aâ]ncia.*removida/i.test(message);
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
    const message =
      readableEvolutionMessage(data?.message) ||
      readableEvolutionMessage(data?.error) ||
      readableEvolutionMessage(data?.response?.message) ||
      readableEvolutionMessage(data) ||
      `HTTP ${response.status}`;
    throw new Error(`WhatsApp Business (${response.status}) em ${path}: ${message}`);
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

const evolutionFetchAny = async (
  config: RuntimeConfig,
  instanceApiKey: string,
  candidates: EvolutionRequestCandidate[],
) => {
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return await evolutionFetchWithFallback(config, instanceApiKey, candidate.path, candidate.init || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(candidate.label ? `${candidate.label}: ${message}` : message);
    }
  }
  throw new Error(errors.find(Boolean) || "Não foi possível consultar o WhatsApp Business.");
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

  if (!remoteJid || isStatusJid(remoteJid)) return null;

  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid);
  const phone = extractPhoneNumber(contact, chat, { remoteJid });
  const isGroup = isGroupJid(remoteJid);
  const labels = normalizeLabels(chat?.labels || chat?.labelIds || contact?.labels || contact?.labelIds, labelIndex);
  const contactStatus = extractContactStatus(contact, chat);

  return {
    instance_name: config.instanceName,
    remote_jid: remoteJid,
    conversation_kind: kind,
    contact_type: isGroup ? "group" : "person",
    is_group: isGroup,
    patient_name:
      kind === "psychologist"
        ? "Voc\u00ea e Synapse"
        : safeString(chat?.name) ||
          safeString(chat?.pushName) ||
          safeString(contact?.pushName) ||
          safeString(contact?.name) ||
          safeString(contact?.verifiedName) ||
          safeString(chat?.subject) ||
          null,
    patient_phone: phone || null,
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
  if (!remoteJid || isStatusJid(remoteJid)) return null;

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
  if (error || !data.user) throw new Error("Usu\u00e1rio n\u00e3o autenticado.");
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

const retireInstanceMapping = async (
  supabaseAdmin: any,
  userId: string,
  instanceName: string,
  reason: string,
) => {
  if (!instanceName) return;
  await supabaseAdmin
    .from("synapse_whatsapp_instances")
    .update({
      enabled: false,
      last_connection_state: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("professional_id", userId)
    .eq("instance_name", instanceName);
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

  const storedEnvironment = safeString(settings.environment);
  const webhookMode: WebhookMode =
    storedEnvironment === "production" ? "production" : storedEnvironment === "sandbox" ? "sandbox" : runtime.webhookMode;
  const expectedWebhookUrl = buildWebhookUrl({ ...runtime, webhookMode }, instanceName);
  const storedWebhookUrl = safeString(settings.webhook_url);
  return {
    ...runtime,
    webhookMode,
    instanceName,
    instanceApiKey: safeString(credential?.instance_api_key) || runtime.managerApiKey,
    webhookUrl: isManagedWebhookUrl(storedWebhookUrl, instanceName) ? expectedWebhookUrl : storedWebhookUrl || expectedWebhookUrl,
    psychologistRemoteJid: safeString(settings.psychologist_remote_jid) || null,
  };
};

const ensureInstanceConfig = async (
  supabaseAdmin: any,
  userId: string,
  runtime: RuntimeConfig,
  options: { forceNew?: boolean; retiredReason?: string } = {},
): Promise<InstanceConfig> => {
  const existing = await loadInstanceConfig(supabaseAdmin, userId, runtime);
  if (existing && !options.forceNew && existing.instanceName !== "neuronex-ai") return existing;
  if (existing) {
    await retireInstanceMapping(
      supabaseAdmin,
      userId,
      existing.instanceName,
      options.retiredReason || (existing.instanceName === "neuronex-ai" ? "legacy_replaced" : "recreated"),
    );
  }

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

const applyRuntimeSetup = async (config: InstanceConfig) => {
  const warnings: string[] = [];
  let settings: unknown = null;
  let webhook: unknown = null;

  try {
    settings = await applyInstanceSettings(config);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  try {
    webhook = await applyWebhook(config);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  return { settings, webhook, warnings };
};

const postJson = (body: Record<string, unknown>): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

const findChats = (config: InstanceConfig) =>
  evolutionFetchAny(config, config.instanceApiKey, [
    {
      label: "findChats take",
      path: `/chat/findChats/${encodeURIComponent(config.instanceName)}`,
      init: postJson({ where: {}, take: 100, skip: 0, orderBy: { updatedAt: "desc" } }),
    },
    {
      label: "findChats limit",
      path: `/chat/findChats/${encodeURIComponent(config.instanceName)}`,
      init: postJson({ where: {}, limit: 100, offset: 0 }),
    },
    {
      label: "findChats get",
      path: `/chat/findChats/${encodeURIComponent(config.instanceName)}`,
      init: { method: "GET" },
    },
  ]);

const findContacts = (config: InstanceConfig) =>
  evolutionFetchAny(config, config.instanceApiKey, [
    {
      label: "findContacts post",
      path: `/chat/findContacts/${encodeURIComponent(config.instanceName)}`,
      init: postJson({ where: {} }),
    },
    {
      label: "findContacts get",
      path: `/chat/findContacts/${encodeURIComponent(config.instanceName)}`,
      init: { method: "GET" },
    },
  ]);

const findLabels = (config: InstanceConfig) =>
  evolutionFetchAny(config, config.instanceApiKey, [
    {
      label: "findLabels get",
      path: `/label/findLabels/${encodeURIComponent(config.instanceName)}`,
      init: { method: "GET" },
    },
    {
      label: "findLabels post",
      path: `/label/findLabels/${encodeURIComponent(config.instanceName)}`,
      init: postJson({}),
    },
    {
      label: "chat findLabels",
      path: `/chat/findLabels/${encodeURIComponent(config.instanceName)}`,
      init: { method: "GET" },
    },
  ]);

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
      ? "WhatsApp Business - Voc\u00ea e Synapse"
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
  const isGroup = isGroupJid(remoteJid);
  const displayName = kind === "psychologist" ? "Voc\u00ea e Synapse" : safeString(patch.patient_name) || null;
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
        ...patch,
        patient_phone: safeString(patch.patient_phone) || remoteJidToPhone(remoteJid) || null,
        contact_type: safeString(patch.contact_type) || (isGroup ? "group" : "person"),
        is_group: Boolean(patch.is_group ?? isGroup),
        deleted_at: null,
        updated_at: new Date().toISOString(),
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
    const result = await evolutionFetchAny(config, config.instanceApiKey, [
      {
        label: "findMessages key",
        path: `/chat/findMessages/${encodeURIComponent(config.instanceName)}`,
        init: postJson({ where: { key: { remoteJid } }, page, offset: (page - 1) * pageSize, take: pageSize, limit: pageSize }),
      },
      {
        label: "findMessages remote",
        path: `/chat/findMessages/${encodeURIComponent(config.instanceName)}`,
        init: postJson({ where: { remoteJid }, page, limit: pageSize, offset: (page - 1) * pageSize }),
      },
      {
        label: "findMessages jid",
        path: `/chat/findMessages/${encodeURIComponent(config.instanceName)}`,
        init: postJson({ remoteJid, page, limit: pageSize }),
      },
    ]);
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
  if (isStatusJid(remoteJid)) return 0;
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

const postgrestInList = (values: string[]) =>
  `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(",")})`;

const markMissingConversationsDeleted = async (
  supabaseAdmin: any,
  userId: string,
  instanceName: string,
  activeRemoteJids: string[],
) => {
  const patch = {
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let query = supabaseAdmin
    .from("whatsapp_conversations")
    .update(patch)
    .eq("user_id", userId)
    .eq("instance_name", instanceName)
    .is("deleted_at", null);

  if (activeRemoteJids.length) {
    query = query.not("remote_jid", "in", postgrestInList(activeRemoteJids));
  }

  const { error } = await query;
  if (error) throw error;
};

const logoutInstance = async (config: InstanceConfig) => {
  const path = `/instance/logout/${encodeURIComponent(config.instanceName)}`;
  const attempts: RequestInit[] = [
    { method: "DELETE" },
    { method: "POST" },
    { method: "GET" },
  ];
  const errors: string[] = [];

  for (const init of attempts) {
    try {
      return await evolutionFetchWithFallback(config, config.instanceApiKey, path, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      if (/already|not connected|disconnected|closed|logout|not found|404/i.test(message)) {
        return { ok: true, alreadyDisconnected: true, message };
      }
    }
  }

  return {
    ok: true,
    localOnly: true,
    warning: errors.find(Boolean) || "A Evolution não confirmou o logout; o vínculo local foi encerrado.",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Configura\u00e7\u00e3o Supabase ausente.");

    const user = await getUser(req, supabaseUrl, anonKey);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const runtime = getRuntimeConfig();
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = safeString(body.action) as Action;

    if (!action) return json({ ok: false, error: "Action obrigat\u00f3ria." });

    if (action === "connect") {
      let recreated = false;
      let config = await ensureInstanceConfig(supabaseAdmin, user.id, runtime);
      let setup = await applyRuntimeSetup(config);
      let connection: any = null;

      try {
        connection = await evolutionFetchWithFallback(config, config.instanceApiKey, `/instance/connect/${encodeURIComponent(config.instanceName)}`);
      } catch (error) {
        if (!isEvolutionMissingError(error)) throw error;
        await retireInstanceMapping(supabaseAdmin, user.id, config.instanceName, "removed");
        config = await ensureInstanceConfig(supabaseAdmin, user.id, runtime, { forceNew: true, retiredReason: "removed" });
        recreated = true;
        setup = await applyRuntimeSetup(config);
        connection = await evolutionFetchWithFallback(config, config.instanceApiKey, `/instance/connect/${encodeURIComponent(config.instanceName)}`);
      }

      const normalizedConnection = extractConnectionPayload(connection);
      const ownerJid = await fetchOwnerJid(config, connection).catch(() => config.psychologistRemoteJid);
      const state = safeString(connection?.instance?.state || connection?.state || connection?.connectionState) || (normalizedConnection.qr ? "qr" : "connecting");
      await upsertSettings(supabaseAdmin, user.id, config, {
        is_active: state === "open",
        connection_state: state,
        psychologist_remote_jid: ownerJid || config.psychologistRemoteJid,
        psychologist_phone: ownerJid || config.psychologistRemoteJid ? remoteJidToPhone(ownerJid || config.psychologistRemoteJid || "") : null,
        webhook_enabled: true,
        webhook_events: WEBHOOK_EVENTS,
        settings_applied_at: new Date().toISOString(),
        last_error: setup.warnings.length ? setup.warnings.slice(0, 2).join(" | ") : null,
        metadata: { setup, connect: { has_qrcode: Boolean(normalizedConnection.qr), recreated, state } },
      });
      await upsertMapping(supabaseAdmin, user.id, config, {
        owner_remote_jid: ownerJid || config.psychologistRemoteJid,
        last_connection_state: state,
      });
      return json({
        ok: true,
        instanceName: config.instanceName,
        environment: config.webhookMode,
        recreated,
        state,
        connected: state === "open",
        connection: normalizedConnection,
      });
    }

    const loadedConfig = await loadInstanceConfig(supabaseAdmin, user.id, runtime);
    if (!loadedConfig) {
      return json({
        ok: false,
        connected: false,
        message: "WhatsApp Business ainda n\u00e3o conectado.",
      });
    }

    if (action === "logout") {
      const logout = await logoutInstance(loadedConfig);

      await updateConnectionState(
        supabaseAdmin,
        user.id,
        loadedConfig,
        "disconnected",
        loadedConfig.psychologistRemoteJid,
        { logout },
      );

      return json({
        ok: true,
        connected: false,
        instanceName: loadedConfig.instanceName,
        logout,
      });
    }

    if (action === "status") {
      const [connection, webhook] = await Promise.all([
        evolutionFetchWithFallback(
          loadedConfig,
          loadedConfig.instanceApiKey,
          `/instance/connectionState/${encodeURIComponent(loadedConfig.instanceName)}`,
        ).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
        evolutionFetchWithFallback(
          loadedConfig,
          loadedConfig.instanceApiKey,
          `/webhook/find/${encodeURIComponent(loadedConfig.instanceName)}`,
        ).catch((error) => ({ error: error.message })),
      ]);
      if (connection?.error) {
        const missing = isEvolutionMissingError(connection.error);
        await upsertSettings(supabaseAdmin, user.id, loadedConfig, {
          is_active: false,
          connection_state: missing ? "removed" : "disconnected",
          last_status_at: new Date().toISOString(),
          last_error: connection.error,
          metadata: { status_warning: connection.error, webhook },
        });
        if (missing) await retireInstanceMapping(supabaseAdmin, user.id, loadedConfig.instanceName, "removed");
        return json({
          ok: true,
          warning: connection.error,
          connected: false,
          state: missing ? "removed" : "disconnected",
          instanceName: loadedConfig.instanceName,
          environment: loadedConfig.webhookMode,
          connection,
          webhook,
          psychologistRemoteJid: loadedConfig.psychologistRemoteJid,
        });
      }
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
      const setup = await applyRuntimeSetup(loadedConfig);
      const ownerJid = await fetchOwnerJid(loadedConfig).catch(() => loadedConfig.psychologistRemoteJid);
      const syncConfig = ownerJid ? { ...loadedConfig, psychologistRemoteJid: ownerJid } : loadedConfig;
      const [result, contactsResult, labelsResult] = await Promise.all([
        findChats(syncConfig),
        findContacts(syncConfig).catch((error) => ({ error: error.message, data: [] })),
        findLabels(syncConfig)
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
          return mapChat(chat, syncConfig, findContactFor(contactIndex, remoteJid), labelIndex);
        })
        .filter(Boolean);
      const activeRemoteJids = chats.map((chat) => chat.remote_jid);
      await markMissingConversationsDeleted(supabaseAdmin, user.id, syncConfig.instanceName, activeRemoteJids);
      let upserted = 0;
      for (const chat of chats) {
        await upsertConversation(supabaseAdmin, user.id, syncConfig, chat.remote_jid, {
          ...chat,
          updated_at: new Date().toISOString(),
        });
        upserted += 1;
      }
      let syncedMessages = 0;
      for (const chat of chats) {
        syncedMessages += await syncMessagesForRemote(supabaseAdmin, user.id, syncConfig, chat.remote_jid, 2, 200).catch((error) => {
          console.warn("[neurozap-evolution] message sync failed for chat", chat.remote_jid, error);
          return 0;
        });
      }
      await upsertSettings(supabaseAdmin, user.id, syncConfig, {
        is_active: true,
        psychologist_remote_jid: ownerJid || syncConfig.psychologistRemoteJid,
        psychologist_phone: ownerJid || syncConfig.psychologistRemoteJid ? remoteJidToPhone(ownerJid || syncConfig.psychologistRemoteJid || "") : null,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        metadata: {
          sync: {
            chats: chats.length,
            contacts: contacts.length,
            labels: labelIndex.size,
            messages: syncedMessages,
            synced_at: new Date().toISOString(),
            setup_warnings: setup.warnings,
          },
        },
      });
      await upsertMapping(supabaseAdmin, user.id, syncConfig, {
        owner_remote_jid: ownerJid || syncConfig.psychologistRemoteJid,
      });
      return json({ ok: true, count: upserted, messages: syncedMessages });
    }

    if (action === "syncMessages") {
      const remoteJid = safeString(body.remoteJid);
      if (!remoteJid) return json({ ok: false, error: "remoteJid obrigat\u00f3rio." });
      const ownerJid = loadedConfig.psychologistRemoteJid || await fetchOwnerJid(loadedConfig).catch(() => null);
      const messageConfig = ownerJid ? { ...loadedConfig, psychologistRemoteJid: ownerJid } : loadedConfig;
      const upserted = await syncMessagesForRemote(supabaseAdmin, user.id, messageConfig, remoteJid, 5, 200);
      return json({ ok: true, count: upserted });
    }

    if (action === "sendText") {
      const remoteJid = safeString(body.remoteJid);
      const text = safeString(body.text);
      const conversationId = safeString(body.conversationId);
      if (!remoteJid || !text) return json({ ok: false, error: "remoteJid e text s\u00e3o obrigat\u00f3rios." });

      let sendTarget = sendTargetFor(remoteJid);
      if ((!isLikelyPhoneDigits(digitsOnly(sendTarget)) || /@lid/i.test(sendTarget)) && conversationId) {
        const { data: savedConversation, error: savedConversationError } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("patient_phone, remote_jid")
          .eq("id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (savedConversationError) throw savedConversationError;
        const savedTarget = sendTargetFor(safeString(savedConversation?.patient_phone) || safeString(savedConversation?.remote_jid) || remoteJid);
        if (savedTarget) sendTarget = savedTarget;
      }

      const canSendByPhone = isLikelyPhoneDigits(digitsOnly(sendTarget));
      const canSendByJid = /@(s\.whatsapp\.net|c\.us|g\.us)$/i.test(sendTarget);
      if (!canSendByPhone && !canSendByJid) {
        return json({
          ok: false,
          error: "Ainda não recebemos o telefone real deste contato. Sincronize conversas e contatos antes de enviar.",
        });
      }

      const sent = await evolutionFetchWithFallback(loadedConfig, loadedConfig.instanceApiKey, `/message/sendText/${encodeURIComponent(loadedConfig.instanceName)}`, {
        method: "POST",
        body: JSON.stringify({ number: sendTarget, text }),
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

    return json({ ok: false, error: `Action n\u00e3o suportada: ${action}` });
  } catch (error) {
    console.error("[neurozap-evolution]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Erro interno." });
  }
});
