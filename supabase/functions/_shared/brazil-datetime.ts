export const SYNAPSE_AGENDA_TIME_ZONE = "America/Sao_Paulo";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const pad2 = (value: number) => String(value).padStart(2, "0");

const normalizeText = (value: unknown) => clean(value, 5000)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/\s+/g, " ")
  .trim();

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYNAPSE_AGENDA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function localDateString(date: Date) {
  const value = localParts(date);
  return `${value.year}-${pad2(value.month)}-${pad2(value.day)}`;
}

function localDateAtNoon(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
}

function shiftLocalDate(reference: Date, days: number) {
  const value = localParts(reference);
  return localDateString(localDateAtNoon(value.year, value.month, value.day + days));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const SMALL_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
};

function parseSmallPortugueseNumber(value: string) {
  const normalized = normalizeText(value);
  if (/^\d{1,3}$/.test(normalized)) return Number(normalized);
  let total = 0;
  let consumed = false;
  for (const token of normalized.split(" ")) {
    if (!token || token === "e") continue;
    const amount = SMALL_NUMBER_WORDS[token];
    if (amount === undefined) return null;
    total += amount;
    consumed = true;
  }
  return consumed ? total : null;
}

function parseLocalDate(text: string, reference: Date) {
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const brazil = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](20\d{2}|\d{2}))?\b/);
  if (brazil) {
    const ref = localParts(reference);
    const day = Number(brazil[1]);
    const month = Number(brazil[2]);
    let year = brazil[3] ? Number(brazil[3]) : ref.year;
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const relativeDays = text.match(/\b(?:daqui(?:\s+a)?|em)\s+([a-z0-9 ]{1,40}?)\s+dias?\b/);
  if (relativeDays) {
    const count = parseSmallPortugueseNumber(relativeDays[1]);
    if (count !== null && Number.isInteger(count) && count >= 0 && count <= 366) {
      return shiftLocalDate(reference, count);
    }
  }

  if (/\bdepois de amanha\b/.test(text)) return shiftLocalDate(reference, 2);
  if (/\bamanha\b/.test(text)) return shiftLocalDate(reference, 1);
  if (/\bhoje\b/.test(text)) return shiftLocalDate(reference, 0);

  const dayOfMonth = text.match(/\bdia\s+(\d{1,2})\b/);
  if (dayOfMonth) {
    const ref = localParts(reference);
    const requestedDay = Number(dayOfMonth[1]);
    let year = ref.year;
    let month = ref.month;
    if (requestedDay < ref.day) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    if (requestedDay >= 1 && requestedDay <= daysInMonth(year, month)) {
      return `${year}-${pad2(month)}-${pad2(requestedDay)}`;
    }
  }

  const weekdays: Array<[RegExp, number]> = [
    [/\bdomingo\b/, 0],
    [/\bsegunda(?: feira)?\b/, 1],
    [/\bterca(?: feira)?\b/, 2],
    [/\bquarta(?: feira)?\b/, 3],
    [/\bquinta(?: feira)?\b/, 4],
    [/\bsexta(?: feira)?\b/, 5],
    [/\bsabado\b/, 6],
  ];
  const weekday = weekdays.find(([pattern]) => pattern.test(text));
  if (weekday) {
    const currentRaw = new Intl.DateTimeFormat("en-US", {
      timeZone: SYNAPSE_AGENDA_TIME_ZONE,
      weekday: "short",
    }).format(reference);
    const current = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[currentRaw] ?? 0;
    let offset = (weekday[1] - current + 7) % 7;
    const explicitlyNext = /\b(proxim[ao]|que vem|semana que vem)\b/.test(text);
    if (offset === 0 && explicitlyNext) offset = 7;
    return shiftLocalDate(reference, offset);
  }

  return null;
}

const HOUR_WORDS: Record<string, number> = {
  zero: 0,
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  "vinte e uma": 21,
  "vinte e um": 21,
  "vinte e duas": 22,
  "vinte e dois": 22,
  "vinte e tres": 23,
};

function applyDayPeriod(hour: number, period: string | undefined) {
  if (!period) return hour;
  if ((period === "tarde" || period === "noite") && hour >= 1 && hour <= 11) return hour + 12;
  if (period === "manha" && hour === 12) return 0;
  return hour;
}

function parseLocalTime(text: string) {
  if (/\bmeio[ -]?dia\b/.test(text)) return { hour: 12, minute: 0 };
  if (/\bmeia[ -]?noite\b/.test(text)) return { hour: 0, minute: 0 };

  const numericPatterns: Array<{ pattern: RegExp; periodIndex: number; halfIndex?: number }> = [
    {
      pattern: /\b(?:as|pelas?)\s+(\d{1,2})(?:\s*(?:h|:)\s*(\d{1,2}))?(?:\s+e\s+(meia))?\s*(?:horas?)?\s*(?:da|de)?\s*(manha|tarde|noite)?\b/,
      periodIndex: 4,
      halfIndex: 3,
    },
    {
      pattern: /\b(\d{1,2})\s*h\s*(\d{1,2})?\s*(?:da|de)?\s*(manha|tarde|noite)?\b/,
      periodIndex: 3,
    },
    {
      pattern: /\b(\d{1,2})\s+horas?\s*(?:da|de)?\s*(manha|tarde|noite)?\b/,
      periodIndex: 2,
    },
    {
      pattern: /\b(\d{1,2})\s+(?:da|de)\s+(manha|tarde|noite)\b/,
      periodIndex: 2,
    },
  ];
  for (const { pattern, periodIndex, halfIndex } of numericPatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const hour = Number(match[1]);
    let minute = Number(match[2] || 0);
    if (halfIndex && match[halfIndex] === "meia") minute = 30;
    const period = match[periodIndex];
    const adjusted = applyDayPeriod(hour, period);
    if (adjusted >= 0 && adjusted <= 23 && minute >= 0 && minute <= 59) return { hour: adjusted, minute };
  }

  const wordKeys = Object.keys(HOUR_WORDS).sort((left, right) => right.length - left.length);
  for (const key of wordKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixed = text.match(new RegExp(`\\b(?:as|pelas?)\\s+${escaped}(?:\\s+e\\s+(meia))?\\s*(?:horas?)?\\s*(?:da|de)?\\s*(manha|tarde|noite)?\\b`));
    if (prefixed) {
      const minute = prefixed[1] === "meia" ? 30 : 0;
      const hour = applyDayPeriod(HOUR_WORDS[key], prefixed[2]);
      if (hour >= 0 && hour <= 23) return { hour, minute };
    }

    const spokenWithHour = text.match(new RegExp(`\\b${escaped}(?:\\s+e\\s+(meia))?\\s+horas?\\s*(?:da|de)?\\s*(manha|tarde|noite)?\\b`));
    if (spokenWithHour) {
      const minute = spokenWithHour[1] === "meia" ? 30 : 0;
      const hour = applyDayPeriod(HOUR_WORDS[key], spokenWithHour[2]);
      if (hour >= 0 && hour <= 23) return { hour, minute };
    }

    const spokenWithPeriod = text.match(new RegExp(`\\b${escaped}(?:\\s+e\\s+(meia))?\\s+(?:da|de)\\s+(manha|tarde|noite)\\b`));
    if (spokenWithPeriod) {
      const minute = spokenWithPeriod[1] === "meia" ? 30 : 0;
      const hour = applyDayPeriod(HOUR_WORDS[key], spokenWithPeriod[2]);
      if (hour >= 0 && hour <= 23) return { hour, minute };
    }
  }

  return null;
}

export interface ResolvedNaturalDateTime {
  iso: string;
  date: string;
  time: string;
  timeZone: typeof SYNAPSE_AGENDA_TIME_ZONE;
}

export function resolveNaturalSaoPauloDateTime(
  value: unknown,
  reference = new Date(),
): ResolvedNaturalDateTime | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = parseLocalDate(text, reference);
  const time = parseLocalTime(text);
  if (!date || !time) return null;
  const clock = `${pad2(time.hour)}:${pad2(time.minute)}`;
  return {
    iso: `${date}T${clock}:00-03:00`,
    date,
    time: clock,
    timeZone: SYNAPSE_AGENDA_TIME_ZONE,
  };
}

export function canonicalizeSaoPauloDateTime(value: unknown, reference = new Date()) {
  const raw = clean(value, 120);
  if (!raw) return null;

  const natural = resolveNaturalSaoPauloDateTime(raw, reference);
  if (natural) return natural.iso;

  if (/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) {
    return `${raw.length === 16 ? `${raw}:00` : raw}-03:00`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = localParts(parsed);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}-03:00`;
}

export function saoPauloDateTimePresentation(value: unknown) {
  const raw = clean(value, 120);
  if (!raw) return null;
  const parsed = new Date(/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw) ? `${raw}-03:00` : raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = localParts(parsed);
  const date = `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
  const time = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  return {
    date,
    time,
    dateTime: `${date} ${time}`,
    iso: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${time}:${pad2(parts.second)}-03:00`,
    timeZone: SYNAPSE_AGENDA_TIME_ZONE,
  };
}

export function localizeAgendaTimestamps<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => localizeAgendaTimestamps(item)) as T;
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(source)) {
    next[key] = localizeAgendaTimestamps(nested);
  }

  const start = saoPauloDateTimePresentation(source.start_time ?? source.startTime);
  if (start) {
    next.start_time_local = start.dateTime;
    next.date_label = start.date;
    next.time_label = start.time;
    next.timezone = SYNAPSE_AGENDA_TIME_ZONE;
  }
  const end = saoPauloDateTimePresentation(source.end_time ?? source.endTime);
  if (end) next.end_time_local = end.dateTime;
  const datetime = saoPauloDateTimePresentation(source.datetime);
  if (datetime) next.datetime_local = datetime.dateTime;
  const nextDateTime = saoPauloDateTimePresentation(source.new_datetime);
  if (nextDateTime) next.new_datetime_local = nextDateTime.dateTime;

  return next as T;
}
