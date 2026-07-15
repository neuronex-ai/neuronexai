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
  channelSecret: string;
};

type InstanceConfig = RuntimeConfig & {
  instanceName: string;
  instanceApiKey: string;
  webhookUrl: string;
  psychologistRemoteJid: string | null;
  initialConnection?: unknown;
};

type EvolutionRequestCandidate = {
  path: string;
  init?: RequestInit;
  label?: string;
};

const WEBHOOK_EVENTS = [
  "APPLICATION_STARTUP",
  "QRCODE_UPDATED",
  "CONNECTION_UPDATE",
  "MESSAGES_SET",
  "MESSAGES_UPSERT",
  "MESSAGES_EDITED",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CHATS_SET",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "CHATS_DELETE",
  "CONTACTS_SET",
  "CONTACTS_UPSERT",
  "CONTACTS_UPDATE",
  "PRESENCE_UPDATE",
  "GROUPS_UPSERT",
  "GROUP_UPDATE",
  "GROUP_PARTICIPANTS_UPDATE",
  "REMOVE_INSTANCE",
  "LOGOUT_INSTANCE",
  "LABELS_EDIT",
  "LABELS_ASSOCIATION",
  "CALL",
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

const originFromBaseUrl = (baseUrl: string) => {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "https://wsapi.neuronexai.com.br";
  }
};

const normalizeWebhookBase = (value: string, marker: "webhook" | "webhook-test", fallbackOrigin: string) => {
  const fallback = `${fallbackOrigin.replace(/\/+$/, "")}/${marker}`;
  const raw = (value || fallback).trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fallback;
  }

  const legacyOrInvalidHost =
    url.hostname === "webhook" ||
    url.hostname === "webhook.neuronexai.com.br" ||
    !url.hostname.includes(".");
  const clean = legacyOrInvalidHost ? fallback : raw;
  const markerIndex = clean.indexOf(`/${marker}`);
  if (markerIndex >= 0) return clean.slice(0, markerIndex + marker.length + 1);
  return `${new URL(clean).origin}/${marker}`;
};

const buildWebhookUrl = (config: RuntimeConfig, instanceName: string) => {
  const base = config.webhookMode === "production" ? config.productionWebhookBase : config.sandboxWebhookBase;
  return `${base}/${encodeURIComponent(instanceName)}`;
};

const isManagedWebhookUrl = (value: string, instanceName: string) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    const isKnownHost =
      url.hostname === "webhook" ||
      url.hostname === "webhook.neuronexai.com.br" ||
      url.hostname === "wsapi.neuronexai.com.br";
    if (!isKnownHost) return false;
    const instance = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
    return instance === instanceName;
  } catch {
    return false;
  }
};

const getRuntimeConfig = (): RuntimeConfig => {
  const baseUrl = cleanBaseUrl(Deno.env.get("EVOLUTION_API_URL") || "");
  const managerApiKey = safeString(Deno.env.get("EVOLUTION_GLOBAL_API_KEY"));
  const evolutionOrigin = originFromBaseUrl(baseUrl);
  const webhookMode: WebhookMode =
    safeString(Deno.env.get("EVOLUTION_WEBHOOK_MODE")) === "production" ? "production" : "sandbox";
  const sandboxWebhookBase = normalizeWebhookBase(
    safeString(Deno.env.get("EVOLUTION_WEBHOOK_SANDBOX_BASE")) ||
      safeString(Deno.env.get("EVOLUTION_WEBHOOK_SANDBOX_URL")),
    "webhook-test",
    evolutionOrigin,
  );
  const productionWebhookBase = normalizeWebhookBase(
    safeString(Deno.env.get("EVOLUTION_WEBHOOK_PRODUCTION_BASE")) ||
      safeString(Deno.env.get("EVOLUTION_WEBHOOK_PRODUCTION_URL")),
    "webhook",
    evolutionOrigin,
  );

  if (!baseUrl || !managerApiKey) {
    throw new Error(
      "Configura\u00e7\u00e3o do WhatsApp Business ausente. Defina EVOLUTION_API_URL e EVOLUTION_GLOBAL_API_KEY com a chave mestra da Evolution API.",
    );
  }

  return {
    baseUrl,
    managerApiKey,
    webhookMode,
    sandboxWebhookBase,
    productionWebhookBase,
    channelSecret: safeString(Deno.env.get("SYNAPSE_CHANNEL_SECRET")),
  };
};

const toArray = (value: unknown, depth = 0): any[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && depth < 4) {
    const record = value as Record<string, any>;
    const keys = ["data", "response", "result", "rows", "chats", "contacts", "labels", "records", "messages"];
    for (const key of keys) {
      if (Array.isArray(record[key])) return record[key];
    }
    for (const key of keys) {
      const nested = toArray(record[key], depth + 1);
      if (nested.length) return nested;
    }
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

const addPhoneVariants = (variants: Set<string>, rawDigits: string) => {
  const digits = digitsOnly(rawDigits);
  if (!isLikelyPhoneDigits(digits)) return;

  const add = (value: string) => {
    if (!value) return;
    variants.add(value);
    variants.add(`${value}@s.whatsapp.net`);
    variants.add(`${value}@c.us`);
  };

  add(digits);
  const hasCountry = digits.startsWith("55") && digits.length >= 12;
  const local = hasCountry ? digits.slice(2) : digits;
  if (hasCountry) add(local);
  if (!hasCountry && local.length >= 10) add(`55${local}`);

  if (local.length === 11) {
    const ddd = local.slice(0, 2);
    const subscriberWithNine = local.slice(2);
    const subscriberWithoutNine = subscriberWithNine.startsWith("9")
      ? subscriberWithNine.slice(1)
      : subscriberWithNine;
    add(`${ddd}${subscriberWithNine}`);
    add(`${ddd}${subscriberWithoutNine}`);
    add(`55${ddd}${subscriberWithNine}`);
    add(`55${ddd}${subscriberWithoutNine}`);
    add(subscriberWithNine);
    add(subscriberWithoutNine);
  } else if (local.length === 10) {
    const ddd = local.slice(0, 2);
    const subscriber = local.slice(2);
    add(`${ddd}${subscriber}`);
    add(`${ddd}9${subscriber}`);
    add(`55${ddd}${subscriber}`);
    add(`55${ddd}9${subscriber}`);
    add(subscriber);
    add(`9${subscriber}`);
  } else if (local.length === 9) {
    add(local);
    if (local.startsWith("9")) add(local.slice(1));
  } else if (local.length === 8) {
    add(local);
    add(`9${local}`);
  }
};

const remoteJidToPhone = (remoteJid: string) => {
  const raw = safeString(remoteJid);
  if (!raw || raw.includes("@lid")) return "";
  const clean = raw.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/@.*$/, "");
  const digits = digitsOnly(clean);
  const isPhoneJid = raw.includes("@s.whatsapp.net") || raw.includes("@c.us") || /^[+\d\s().-]+$/.test(clean);
  return isPhoneJid && isLikelyPhoneDigits(digits) ? digits : "";
};

const phoneJidFor = (value: unknown) => {
  const digits = digitsOnly(value);
  return isLikelyPhoneDigits(digits) ? `${digits}@s.whatsapp.net` : "";
};

const addAlias = (aliases: Set<string>, value: unknown) => {
  const raw = safeString(value);
  if (!raw) return;
  aliases.add(raw.toLowerCase());
  aliases.add(raw.toLowerCase().replace(/@.*$/, ""));
  const phone = remoteJidToPhone(raw);
  if (phone) {
    addPhoneVariants(aliases, phone);
    return;
  }
  const digits = digitsOnly(raw);
  if (isLikelyPhoneDigits(digits) && /^[+\d\s().@-]+$/.test(raw)) {
    addPhoneVariants(aliases, digits);
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

const identityKeyFor = (...values: unknown[]) => {
  const phone = values.map((value) => remoteJidToPhone(safeString(value)) || (isLikelyPhoneDigits(digitsOnly(value)) ? digitsOnly(value) : "")).find(Boolean) || "";
  if (phone) {
    const local = phone.startsWith("55") && phone.length >= 12 ? phone.slice(2) : phone;
    if (local.length === 11) {
      const ddd = local.slice(0, 2);
      const subscriber = local.slice(2);
      return `55${ddd}${subscriber.startsWith("9") ? subscriber.slice(1) : subscriber}`;
    }
    if (local.length === 10) return `55${local}`;
    if (local.length === 9 && local.startsWith("9")) return local.slice(1);
    return local;
  }

  const group = values.map((value) => safeString(value).toLowerCase()).find((value) => isGroupJid(value));
  if (group) return group;
  return safeString(values.find(Boolean)).toLowerCase();
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

const contactLookupKeys = (remoteJid: string) => aliasCandidatesFrom(remoteJid);

const buildContactIndex = (contacts: any[]) => {
  const index = new Map<string, any>();
  for (const contact of contacts) {
    const jid = contactJidFrom(contact);
    for (const key of aliasCandidatesFrom(jid, extractPhoneNumber(contact), contact)) index.set(key, contact);
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
  const leftAliases = new Set(aliasCandidatesFrom(left));
  return aliasCandidatesFrom(right).some((alias) => leftAliases.has(alias));
};

const sameAnyJid = (target?: string | null, candidates: Array<string | null | undefined> = []) =>
  candidates.some((candidate) => sameJid(target, candidate));

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

const isPrivateSchemaUnavailable = (error: unknown) => {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = safeString(record.code);
  const message = safeString(record.message || (error instanceof Error ? error.message : String(error || "")));
  return code === "PGRST106" || /schema must be one of|schema .*private.*not exposed/i.test(message);
};

const isMissingCredentialRpc = (error: unknown) => {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = safeString(record.code);
  const message = safeString(record.message || (error instanceof Error ? error.message : String(error || "")));
  return code === "PGRST202" || /neurozap_(store|get)_instance_credential|function .*not.*found|Could not find the function/i.test(message);
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
  const message = (error instanceof Error ? error.message : String(error || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("nao encontrada") ||
    message.includes("nao encontrado") ||
    message.includes("does not exist") ||
    message.includes("instance missing") ||
    message.includes("instance not exist") ||
    message.includes("instancia removida")
  );
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
      "Accept": "application/json",
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
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `WhatsApp Business (${response.status}) em ${path}: a Evolution API recusou a chave enviada. Confira se EVOLUTION_GLOBAL_API_KEY no Supabase \u00e9 a chave mestra AUTHENTICATION_API_KEY da sua Evolution.`,
      );
    }
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
    safeString(node?.documentMessage?.caption) ||
    safeString(node?.buttonsResponseMessage?.selectedDisplayText) ||
    safeString(node?.listResponseMessage?.title) ||
    safeString(node?.reactionMessage?.text) ||
    safeString(node?.locationMessage?.name) ||
    safeString(node?.liveLocationMessage?.caption) ||
    safeString(node?.contactMessage?.displayName) ||
    safeString(message?.text) ||
    safeString(message?.messageText) ||
    safeString(message?.content) ||
    ""
  );
};

const extractContentType = (message: any): string => {
  const node = message?.message || message;
  if (message?.messageType) return safeString(message.messageType).replace(/Message$/i, "").toLowerCase();
  if (message?.event === "call" || message?.call || message?.callLog) return "call";
  if (node?.protocolMessage?.type === 0 || node?.protocolMessage?.type === "REVOKE") return "deleted";
  if (node?.editedMessage || node?.protocolMessage?.editedMessage) return "edited";
  if (node?.reactionMessage) return "reaction";
  if (node?.locationMessage || node?.liveLocationMessage) return "location";
  if (node?.contactMessage || node?.contactsArrayMessage) return "contact";
  if (node?.imageMessage) return "image";
  if (node?.stickerMessage) return "sticker";
  if (node?.audioMessage) return node.audioMessage?.ptt ? "ptt" : "audio";
  if (node?.documentMessage) return "document";
  if (node?.videoMessage) return "video";
  return safeString(message?.messageType) || safeString(message?.content_type) || "text";
};

const messageNodeForType = (message: any) => {
  const node = message?.message || message;
  return (
    node?.imageMessage ||
    node?.videoMessage ||
    node?.audioMessage ||
    node?.documentMessage ||
    node?.stickerMessage ||
    node?.locationMessage ||
    node?.liveLocationMessage ||
    node?.contactMessage ||
    node?.contactsArrayMessage ||
    node?.reactionMessage ||
    node?.protocolMessage ||
    message
  );
};

const extractMediaUrl = (message: any) => {
  const node = messageNodeForType(message);
  return (
    safeString(message?.media_url) ||
    safeString(message?.mediaUrl) ||
    safeString(message?.url) ||
    safeString(node?.url) ||
    safeString(node?.jpegThumbnail)
  );
};

const extractMessageMetadata = (message: any) => {
  const node = message?.message || message;
  const typed = messageNodeForType(message);
  const location = node?.locationMessage || node?.liveLocationMessage || null;
  const contact = node?.contactMessage || null;
  const contacts = node?.contactsArrayMessage?.contacts || null;
  const reaction = node?.reactionMessage || null;
  const protocol = node?.protocolMessage || null;

  return {
    pushName: safeString(message?.pushName),
    participant: safeString(message?.key?.participant || message?.participant),
    quotedMessageId: safeString(message?.contextInfo?.stanzaId || typed?.contextInfo?.stanzaId),
    caption: safeString(typed?.caption),
    mimetype: safeString(typed?.mimetype || message?.mimetype || message?.media_mimetype),
    fileName: safeString(typed?.fileName || typed?.title || message?.fileName || message?.media_filename),
    fileLength: safeString(typed?.fileLength),
    seconds: safeString(typed?.seconds),
    latitude: location?.degreesLatitude ?? location?.lat ?? null,
    longitude: location?.degreesLongitude ?? location?.lng ?? null,
    name: safeString(location?.name || contact?.displayName || reaction?.text),
    address: safeString(location?.address),
    displayName: safeString(contact?.displayName),
    vcard: safeString(contact?.vcard),
    contacts,
    reaction: safeString(reaction?.text),
    reactedMessageId: safeString(reaction?.key?.id),
    protocolType: protocol?.type ?? null,
    editedMessage: protocol?.editedMessage || node?.editedMessage || null,
    rawType: safeString(message?.messageType || message?.event),
  };
};

const statusTimestamp = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === "string" || typeof item === "number");
  return value === undefined ? null : toIso(value);
};

const conversationKindFor = (
  remoteJid: string,
  psychologistRemoteJid?: string | null,
  aliases: string[] = [],
): ConversationKind =>
  sameAnyJid(psychologistRemoteJid, [remoteJid, ...aliases]) ? "psychologist" : "patient";

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

  const phone = extractPhoneNumber(contact, chat, { remoteJid });
  const aliases = aliasCandidatesFrom(remoteJid, phone, chat, contact);
  const canonicalRemoteJid = canonicalRemoteJidFor(remoteJid, phone, aliases);
  const identityKey = identityKeyFor(remoteJid, phone, ...aliases);
  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid, aliases);
  const isGroup = isGroupJid(remoteJid);
  const labels = normalizeLabels(chat?.labels || chat?.labelIds || contact?.labels || contact?.labelIds, labelIndex);
  const contactStatus = extractContactStatus(contact, chat);

  return {
    instance_name: config.instanceName,
    remote_jid: remoteJid,
    canonical_remote_jid: canonicalRemoteJid || remoteJid,
    remote_jid_aliases: aliases,
    identity_key: identityKey || canonicalRemoteJid || remoteJid,
    identity_variants: aliases,
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
    contact_status: contactStatus,
    contact_about: contactStatus,
    metadata: { identity_key: identityKey, source: "sync" },
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
  const aliases = aliasCandidatesFrom(remoteJid, null, message, key);
  const canonicalRemoteJid = canonicalRemoteJidFor(remoteJid, null, aliases);
  const identityKey = identityKeyFor(remoteJid, ...aliases);
  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid, aliases);
  const isFromAi = Boolean(message?.is_from_ai);
  const metadata = extractMessageMetadata(message);
  const contentType = extractContentType(message);

  return {
    instance_name: config.instanceName,
    remote_jid: remoteJid,
    canonical_remote_jid: canonicalRemoteJid || remoteJid,
    identity_key: identityKey || canonicalRemoteJid || remoteJid,
    identity_variants: aliases,
    source_message_id: sourceId,
    direction,
    sender_kind: senderKindFor(direction, kind, isFromAi),
    content: text || null,
    content_type: contentType,
    status: safeString(message?.status) || "sent",
    is_from_ai: isFromAi,
    media_base64: safeString(message?.media_base64 || message?.base64) || null,
    media_mimetype: safeString(metadata.mimetype || message?.mimetype || message?.media_mimetype) || null,
    media_filename: safeString(metadata.fileName || message?.fileName || message?.media_filename) || null,
    media_url: extractMediaUrl(message) || null,
    metadata,
    delivered_at: statusTimestamp(message?.deliveredAt, message?.message?.deliveredAt),
    read_at: statusTimestamp(message?.readAt, message?.message?.readAt),
    edited_at: contentType === "edited" ? createdAt : statusTimestamp(message?.editedAt, message?.message?.editedAt),
    deleted_at: contentType === "deleted" ? createdAt : null,
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
    if (isPrivateSchemaUnavailable(error) || isMissingPrivateCredentialStore(error)) {
      const { error: rpcError } = await supabaseAdmin.rpc("neurozap_store_instance_credential", {
        p_user_id: userId,
        p_instance_name: instanceName,
        p_instance_api_key: instanceApiKey,
      });
      if (!rpcError) return;
      if (isMissingCredentialRpc(rpcError) || isMissingPrivateCredentialStore(rpcError)) {
        console.warn("[neurozap-evolution] private credential RPC unavailable; using server-side manager key fallback until migration is applied.");
        return;
      }
      throw rpcError;
    }
    throw error;
  }
};

const loadPrivateCredential = async (
  supabaseAdmin: any,
  userId: string,
  instanceName: string,
): Promise<string | null> => {
  const { data: credential, error } = await supabaseAdmin
    .schema("private")
    .from("neurozap_instance_credentials")
    .select("instance_api_key")
    .eq("user_id", userId)
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!error) return safeString(credential?.instance_api_key) || null;

  if (isPrivateSchemaUnavailable(error) || isMissingPrivateCredentialStore(error)) {
    const { data, error: rpcError } = await supabaseAdmin.rpc("neurozap_get_instance_credential", {
      p_user_id: userId,
      p_instance_name: instanceName,
    });
    if (!rpcError) return safeString(data) || null;
    if (isMissingCredentialRpc(rpcError) || isMissingPrivateCredentialStore(rpcError)) {
      console.warn("[neurozap-evolution] private credential RPC unavailable; using server-side manager key fallback until migration is applied.");
      return null;
    }
    throw rpcError;
  }

  throw error;
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

  const instanceApiKey = await loadPrivateCredential(supabaseAdmin, userId, instanceName);

  const storedEnvironment = safeString(settings.environment);
  const webhookMode: WebhookMode =
    storedEnvironment === "production" ? "production" : storedEnvironment === "sandbox" ? "sandbox" : runtime.webhookMode;
  const expectedWebhookUrl = buildWebhookUrl({ ...runtime, webhookMode }, instanceName);
  const storedWebhookUrl = safeString(settings.webhook_url);
  return {
    ...runtime,
    webhookMode,
    instanceName,
    instanceApiKey: instanceApiKey || runtime.managerApiKey,
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

  const webhookHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (runtime.channelSecret) {
    webhookHeaders["x-synapse-channel-secret"] = runtime.channelSecret;
  }

  const createPayload = {
    instanceName,
    token: desiredToken,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    ...INSTANCE_SETTINGS,
    webhook: {
      url: webhookUrl,
      byEvents: false,
      base64: true,
      headers: webhookHeaders,
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
  const config = { ...provisionalConfig, instanceApiKey, initialConnection: created };

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
  const webhookHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.channelSecret) {
    webhookHeaders["x-synapse-channel-secret"] = config.channelSecret;
  }

  const webhookConfig = {
    enabled: true,
    url: config.webhookUrl,
    byEvents: false,
    base64: true,
    webhookByEvents: false,
    webhookBase64: true,
    headers: webhookHeaders,
    events: WEBHOOK_EVENTS,
  };

  const payload = {
    webhook: {
      ...webhookConfig,
    },
  };
  return evolutionFetchAny(config, config.instanceApiKey, [
    {
      label: "webhook nested",
      path: `/webhook/set/${encodeURIComponent(config.instanceName)}`,
      init: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    },
    {
      label: "webhook direct",
      path: `/webhook/set/${encodeURIComponent(config.instanceName)}`,
      init: {
        method: "POST",
        body: JSON.stringify(webhookConfig),
      },
    },
  ]);
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
      label: "findChats all",
      path: `/chat/findChats/${encodeURIComponent(config.instanceName)}`,
      init: postJson({}),
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
      label: "findContacts all",
      path: `/chat/findContacts/${encodeURIComponent(config.instanceName)}`,
      init: postJson({}),
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

const instanceNameFromPayload = (payload: any) =>
  safeString(payload?.name) ||
  safeString(payload?.instanceName) ||
  safeString(payload?.instance?.instanceName) ||
  safeString(payload?.instance?.name);

const instanceStateFromPayload = (payload: any) =>
  safeString(payload?.connectionStatus) ||
  safeString(payload?.state) ||
  safeString(payload?.instance?.state) ||
  safeString(payload?.instance?.connectionStatus) ||
  safeString(payload?.connectionState);

const findOpenManagedInstance = async (runtime: RuntimeConfig, userId: string): Promise<InstanceConfig | null> => {
  const prefix = `neurozap-${userId.slice(0, 8).toLowerCase()}-`;
  const fetched = await evolutionFetch(runtime, runtime.managerApiKey, "/instance/fetchInstances").catch(() => []);
  const instances = toArray(fetched)
    .map((item) => ({
      raw: item,
      instanceName: instanceNameFromPayload(item),
      state: instanceStateFromPayload(item).toLowerCase(),
      ownerJid: extractOwnerJid(item),
    }))
    .filter((item) => item.instanceName.toLowerCase().startsWith(prefix));
  const open = instances.find((item) => ["open", "connected"].includes(item.state));
  if (!open) return null;
  return {
    ...runtime,
    instanceName: open.instanceName,
    instanceApiKey: runtime.managerApiKey,
    webhookUrl: buildWebhookUrl(runtime, open.instanceName),
    psychologistRemoteJid: open.ownerJid,
    initialConnection: open.raw,
  };
};

const adoptOpenManagedInstance = async (
  supabaseAdmin: any,
  userId: string,
  runtime: RuntimeConfig,
  current: InstanceConfig,
): Promise<InstanceConfig> => {
  const recovered = await findOpenManagedInstance(runtime, userId).catch(() => null);
  if (!recovered || recovered.instanceName === current.instanceName) return current;
  await upsertSettings(supabaseAdmin, userId, recovered, {
    is_active: true,
    connection_state: "open",
    psychologist_remote_jid: recovered.psychologistRemoteJid,
    psychologist_phone: recovered.psychologistRemoteJid ? remoteJidToPhone(recovered.psychologistRemoteJid) : null,
    webhook_enabled: true,
    webhook_events: WEBHOOK_EVENTS,
    settings_applied_at: new Date().toISOString(),
    last_status_at: new Date().toISOString(),
    last_error: null,
    metadata: { recovered_from_open_evolution_instance: true, previous_instance_name: current.instanceName },
  });
  await upsertMapping(supabaseAdmin, userId, recovered, {
    owner_remote_jid: recovered.psychologistRemoteJid,
    last_connection_state: "open",
    metadata: { recovered_from_open_evolution_instance: true },
  });
  return recovered;
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
  canonicalRemoteJid?: string | null,
  aliases: string[] = [],
  explicitPhone?: string | null,
) => {
  const canonical = canonicalRemoteJid || canonicalRemoteJidFor(remoteJid, explicitPhone, aliases);
  const { data: existingByCanonical, error: canonicalFindError } = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .contains("context_state", { source: "whatsapp", canonicalRemoteJid: canonical })
    .maybeSingle();
  if (canonicalFindError) throw canonicalFindError;
  if (existingByCanonical?.id) return existingByCanonical.id;

  const { data: existingByRemote, error: remoteFindError } = await supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .contains("context_state", { source: "whatsapp", remoteJid })
    .maybeSingle();
  if (remoteFindError) throw remoteFindError;
  if (existingByRemote?.id) return existingByRemote.id;

  const phone = explicitPhone || remoteJidToPhone(remoteJid);
  const title =
    conversationKind === "psychologist"
      ? "WhatsApp Business - Voc\u00ea e Synapse"
      : `WhatsApp Business - ${displayName || phone || "Paciente"}`.slice(0, 180);
  const basePayload = {
    user_id: userId,
    title,
    context_state: {
      source: "whatsapp",
      remoteJid,
      canonicalRemoteJid: canonical || remoteJid,
      aliases,
      phoneNumber: phone || null,
      pushName: displayName || null,
      conversation_kind: conversationKind,
    },
  };
  let { data: created, error: createError } = await supabaseAdmin
    .from("chat_sessions")
    .insert({ ...basePayload, origin_channel: "whatsapp", last_channel: "whatsapp" })
    .select("id")
    .single();
  if (createError && ["42703", "PGRST204"].includes(String(createError.code || ""))) {
    const compatibilityResult = await supabaseAdmin
      .from("chat_sessions")
      .insert(basePayload)
      .select("id")
      .single();
    created = compatibilityResult.data;
    createError = compatibilityResult.error;
  }
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
  const patchAliases = Array.isArray(patch.remote_jid_aliases) ? patch.remote_jid_aliases.map((item) => safeString(item)).filter(Boolean) : [];
  const phone = safeString(patch.patient_phone) || remoteJidToPhone(remoteJid) || "";
  const aliases = aliasCandidatesFrom(remoteJid, phone, ...patchAliases.map((alias) => ({ remoteJid: alias })));
  const canonicalRemoteJid = safeString(patch.canonical_remote_jid) || canonicalRemoteJidFor(remoteJid, phone, aliases);
  const mergedAliases = Array.from(new Set([...aliases, ...patchAliases, remoteJid, canonicalRemoteJid].map((alias) => safeString(alias).toLowerCase()).filter(Boolean)));
  const identityKey = safeString(patch.identity_key) || identityKeyFor(remoteJid, phone, ...mergedAliases);
  const kind = conversationKindFor(remoteJid, config.psychologistRemoteJid, mergedAliases);
  const isGroup = isGroupJid(remoteJid);
  const displayName = kind === "psychologist" ? "Voc\u00ea e Synapse" : safeString(patch.patient_name) || null;
  const sessionId = await ensureSynapseSession(supabaseAdmin, userId, remoteJid, kind, displayName, canonicalRemoteJid, mergedAliases, phone);
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    instance_name: config.instanceName,
    remote_jid: remoteJid,
    canonical_remote_jid: canonicalRemoteJid || remoteJid,
    remote_jid_aliases: mergedAliases,
    identity_key: identityKey || canonicalRemoteJid || remoteJid,
    identity_variants: mergedAliases,
    conversation_kind: kind,
    synapse_session_id: sessionId,
    ...patch,
    patient_phone: phone || null,
    contact_type: safeString(patch.contact_type) || (isGroup ? "group" : "person"),
    is_group: Boolean(patch.is_group ?? isGroup),
    deleted_at: null,
    updated_at: now,
  };

  let existing: Record<string, any> | null = null;
  if (identityKey) {
    const { data: existingByIdentity, error: existingByIdentityError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, remote_jid_aliases")
      .eq("user_id", userId)
      .eq("instance_name", config.instanceName)
      .eq("identity_key", identityKey)
      .maybeSingle();
    if (existingByIdentityError) throw existingByIdentityError;
    existing = existingByIdentity;
  }

  if (!existing && canonicalRemoteJid) {
    const { data: existingByCanonical, error: existingByCanonicalError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, remote_jid_aliases")
      .eq("user_id", userId)
      .eq("instance_name", config.instanceName)
      .eq("canonical_remote_jid", canonicalRemoteJid)
      .maybeSingle();
    if (existingByCanonicalError) throw existingByCanonicalError;
    existing = existingByCanonical;
  }

  if (!existing) {
    const { data: existingByRemote, error: existingByRemoteError } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, remote_jid_aliases")
      .eq("user_id", userId)
      .eq("instance_name", config.instanceName)
      .eq("remote_jid", remoteJid)
      .maybeSingle();
    if (existingByRemoteError) throw existingByRemoteError;
    existing = existingByRemote;
  }

  if (existing?.id) {
    const existingAliases = Array.isArray(existing.remote_jid_aliases)
      ? existing.remote_jid_aliases.map((item: unknown) => safeString(item).toLowerCase()).filter(Boolean)
      : [];
    const { data, error } = await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        ...payload,
        remote_jid_aliases: Array.from(new Set([...existingAliases, ...mergedAliases])),
      })
      .eq("id", existing.id)
      .select("id, synapse_session_id, conversation_kind")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("whatsapp_conversations")
    .upsert(payload, { onConflict: "user_id,instance_name,remote_jid" })
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
    const activeList = postgrestInList(Array.from(new Set(activeRemoteJids.filter(Boolean))));
    query = query
      .not("remote_jid", "in", activeList)
      .not("canonical_remote_jid", "in", activeList);
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
      config = await adoptOpenManagedInstance(supabaseAdmin, user.id, runtime, config);
      let setup = await applyRuntimeSetup(config);
      let connection: any = null;
      let normalizedConnection = extractConnectionPayload(config.initialConnection);

      if (!normalizedConnection.qr) {
        try {
          connection = await evolutionFetchWithFallback(config, config.instanceApiKey, `/instance/connect/${encodeURIComponent(config.instanceName)}`);
          normalizedConnection = extractConnectionPayload(connection);
        } catch (error) {
          if (!isEvolutionMissingError(error)) throw error;
          await retireInstanceMapping(supabaseAdmin, user.id, config.instanceName, "removed");
          config = await ensureInstanceConfig(supabaseAdmin, user.id, runtime, { forceNew: true, retiredReason: "removed" });
          recreated = true;
          setup = await applyRuntimeSetup(config);
          normalizedConnection = extractConnectionPayload(config.initialConnection);
          if (!normalizedConnection.qr) {
            connection = await evolutionFetchWithFallback(config, config.instanceApiKey, `/instance/connect/${encodeURIComponent(config.instanceName)}`);
            normalizedConnection = extractConnectionPayload(connection);
          }
        }
      }

      const connectionSource = (connection || config.initialConnection || {}) as Record<string, any>;
      const ownerJid = await fetchOwnerJid(config, connectionSource).catch(() => config.psychologistRemoteJid);
      const state = safeString(connectionSource?.instance?.state || connectionSource?.state || connectionSource?.connectionState) || (normalizedConnection.qr ? "qr" : "connecting");
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

    let loadedConfig = await loadInstanceConfig(supabaseAdmin, user.id, runtime);
    if (!loadedConfig) {
      return json({
        ok: false,
        connected: false,
        message: "WhatsApp Business ainda n\u00e3o conectado.",
      });
    }
    loadedConfig = await adoptOpenManagedInstance(supabaseAdmin, user.id, runtime, loadedConfig);

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
        .filter((chat): chat is NonNullable<ReturnType<typeof mapChat>> => chat !== null);
      const activeRemoteJids = chats.flatMap((chat) =>
        [chat.remote_jid, chat.canonical_remote_jid, ...(Array.isArray(chat.remote_jid_aliases) ? chat.remote_jid_aliases : [])]
          .map((value) => safeString(value))
          .filter(Boolean)
      );

      if (!chats.length) {
        const { count: existingConversationCount, error: existingCountError } = await supabaseAdmin
          .from("whatsapp_conversations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("instance_name", syncConfig.instanceName)
          .is("deleted_at", null);
        if (existingCountError) throw existingCountError;

        if (!existingConversationCount) {
          await upsertSettings(supabaseAdmin, user.id, syncConfig, {
            is_active: true,
            psychologist_remote_jid: ownerJid || syncConfig.psychologistRemoteJid,
            psychologist_phone: ownerJid || syncConfig.psychologistRemoteJid ? remoteJidToPhone(ownerJid || syncConfig.psychologistRemoteJid || "") : null,
            last_sync_at: new Date().toISOString(),
            last_error: null,
            metadata: {
              sync: {
                chats: 0,
                contacts: contacts.length,
                labels: labelIndex.size,
                messages: 0,
                waiting_for_history: true,
                synced_at: new Date().toISOString(),
                setup_warnings: setup.warnings,
              },
            },
          });
          await upsertMapping(supabaseAdmin, user.id, syncConfig, {
            owner_remote_jid: ownerJid || syncConfig.psychologistRemoteJid,
          });
          return json({
            ok: true,
            count: 0,
            messages: 0,
            waitingForHistory: true,
            contacts: contacts.length,
            labels: labelIndex.size,
          });
        }
      }

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
          .select("patient_phone, remote_jid, canonical_remote_jid")
          .eq("id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (savedConversationError) throw savedConversationError;
        const savedTarget = sendTargetFor(
          safeString(savedConversation?.patient_phone) ||
            safeString(savedConversation?.canonical_remote_jid) ||
            safeString(savedConversation?.remote_jid) ||
            remoteJid,
        );
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
      const canonicalRemoteJid = canonicalRemoteJidFor(remoteJid, digitsOnly(sendTarget), aliasCandidatesFrom(remoteJid, sendTarget));
      const { error: insertError } = await supabaseAdmin.from("whatsapp_messages").upsert(
        {
          user_id: user.id,
          conversation_id: conversation.id || null,
          synapse_session_id: conversation.synapse_session_id || null,
          instance_name: loadedConfig.instanceName,
          remote_jid: remoteJid,
          canonical_remote_jid: canonicalRemoteJid || remoteJid,
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
