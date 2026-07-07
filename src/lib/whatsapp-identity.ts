const BRAZIL_COUNTRY_CODE = "55";

export const digitsOnly = (value: unknown) => String(value || "").replace(/\D/g, "");

export const isGroupJid = (value?: string | null) => String(value || "").toLowerCase().includes("@g.us");

export const isStatusJid = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "status@broadcast" || normalized.includes("status@broadcast");
};

export const isLikelyPhoneDigits = (digits: string) => {
  if (!digits) return false;
  const local = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12 ? digits.slice(2) : digits;
  return [8, 9, 10, 11].includes(local.length);
};

const stripJidSuffix = (value: string) =>
  value
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@g.us", "")
    .replace(/@.*$/, "");

export const phoneDigitsFrom = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw || raw.includes("@lid")) continue;
    const clean = stripJidSuffix(raw);
    const looksLikePhone =
      raw.includes("@s.whatsapp.net") ||
      raw.includes("@c.us") ||
      /^[+\d\s().-]+$/.test(clean);
    if (!looksLikePhone) continue;
    const digits = digitsOnly(clean);
    if (isLikelyPhoneDigits(digits)) return digits;
  }
  return "";
};

export const remoteJidToPhone = (remoteJid?: string | null) => phoneDigitsFrom(remoteJid);

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

  const hasCountry = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12;
  const local = hasCountry ? digits.slice(2) : digits;
  if (hasCountry) add(local);
  if (!hasCountry && local.length >= 10) add(`${BRAZIL_COUNTRY_CODE}${local}`);

  if (local.length === 11) {
    const ddd = local.slice(0, 2);
    const subscriberWithNine = local.slice(2);
    const subscriberWithoutNine = subscriberWithNine.startsWith("9")
      ? subscriberWithNine.slice(1)
      : subscriberWithNine;
    add(`${ddd}${subscriberWithNine}`);
    add(`${ddd}${subscriberWithoutNine}`);
    add(`${BRAZIL_COUNTRY_CODE}${ddd}${subscriberWithNine}`);
    add(`${BRAZIL_COUNTRY_CODE}${ddd}${subscriberWithoutNine}`);
    add(subscriberWithNine);
    add(subscriberWithoutNine);
  } else if (local.length === 10) {
    const ddd = local.slice(0, 2);
    const subscriber = local.slice(2);
    add(`${ddd}${subscriber}`);
    add(`${ddd}9${subscriber}`);
    add(`${BRAZIL_COUNTRY_CODE}${ddd}${subscriber}`);
    add(`${BRAZIL_COUNTRY_CODE}${ddd}9${subscriber}`);
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

const addIdentityVariant = (variants: Set<string>, value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return;
  const lowered = raw.toLowerCase();
  variants.add(lowered);
  variants.add(lowered.replace(/@.*$/, ""));

  const phone = phoneDigitsFrom(raw);
  if (phone) {
    addPhoneVariants(variants, phone);
    return;
  }

  const digits = digitsOnly(raw);
  if (isLikelyPhoneDigits(digits) && /^[+\d\s().@-]+$/.test(raw)) {
    addPhoneVariants(variants, digits);
  }
};

export const identityVariantsFrom = (...values: unknown[]) => {
  const variants = new Set<string>();
  for (const value of values) {
    if (Array.isArray(value)) {
      value.forEach((item) => addIdentityVariant(variants, item));
      continue;
    }
    addIdentityVariant(variants, value);
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["id", "remoteJid", "remote_jid", "jid", "wuid", "number", "phone", "participant", "lid"]) {
        addIdentityVariant(variants, record[key]);
      }
      addIdentityVariant(variants, (record.key as Record<string, unknown> | undefined)?.remoteJid);
      addIdentityVariant(variants, (record.key as Record<string, unknown> | undefined)?.participant);
    }
  }
  return Array.from(variants).filter(Boolean);
};

export const identitiesIntersect = (leftValues: unknown[], rightValues: unknown[]) => {
  const left = new Set(identityVariantsFrom(...leftValues));
  if (!left.size) return false;
  return identityVariantsFrom(...rightValues).some((variant) => left.has(variant));
};

export const identityKeyFor = (...values: unknown[]) => {
  const phone = values.map((value) => phoneDigitsFrom(String(value || ""))).find(Boolean) || "";
  if (phone) {
    const local = phone.startsWith(BRAZIL_COUNTRY_CODE) && phone.length >= 12 ? phone.slice(2) : phone;
    if (local.length === 11) {
      const ddd = local.slice(0, 2);
      const subscriber = local.slice(2);
      return `${BRAZIL_COUNTRY_CODE}${ddd}${subscriber.startsWith("9") ? subscriber.slice(1) : subscriber}`;
    }
    if (local.length === 10) return `${BRAZIL_COUNTRY_CODE}${local}`;
    if (local.length === 9 && local.startsWith("9")) return local.slice(1);
    return local;
  }

  const group = values.map((value) => String(value || "").trim().toLowerCase()).find((value) => isGroupJid(value));
  if (group) return group;

  return String(values.find(Boolean) || "").trim().toLowerCase();
};

export const canonicalRemoteJidFor = (...values: unknown[]) => {
  const phone = values.map((value) => phoneDigitsFrom(String(value || ""))).find(Boolean) || "";
  if (phone) return `${phone}@s.whatsapp.net`;
  const group = values.map((value) => String(value || "").trim().toLowerCase()).find((value) => isGroupJid(value));
  if (group) return group;
  return String(values.find(Boolean) || "").trim().toLowerCase();
};

export const formatPhoneDigits = (digits: string) => {
  if (!digits || !isLikelyPhoneDigits(digits)) return "";
  const local = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  if (local.length === 9) return `${local.slice(0, 5)}-${local.slice(5)}`;
  if (local.length === 8) return `${local.slice(0, 4)}-${local.slice(4)}`;
  return digits;
};

export const formatRemoteJid = (...values: Array<string | null | undefined>) => {
  const digits = phoneDigitsFrom(...values);
  return digits ? formatPhoneDigits(digits) : "Número não informado";
};
