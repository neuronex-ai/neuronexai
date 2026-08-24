const APPOINTMENT_TIME_ZONE = "America/Sao_Paulo";
const APPOINTMENT_UTC_OFFSET = "-03:00";

const clean = (value: unknown, max = 2000) =>
  String(value ?? "").trim().slice(0, max);

const normalize = (value: unknown) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NUMBER_WORDS: Record<string, number> = {
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
};

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

const HOUR_TOKEN =
  "(?:\\d{1,2}|zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\\s+e\\s+(?:um|uma|dois|duas|tres|quatro))?)";
const MINUTE_TOKEN =
  "(?:\\d{1,2}|zero|cinco|dez|quinze|vinte|vinte\\s+e\\s+cinco|trinta|meia)";

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function localParts(reference: Date): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APPOINTMENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(reference);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function parseNumber(value: string) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const tokens = value.trim().split(/\s+/).filter((token) => token !== "e");
  if (!tokens.length) return null;
  let total = 0;
  for (const token of tokens) {
    const amount = NUMBER_WORDS[token];
    if (amount === undefined) return null;
    total += amount;
  }
  return total;
}

function validLocalDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addLocalDays(
  date: Pick<LocalDateParts, "year" | "month" | "day">,
  amount: number,
) {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + amount),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function localComparable(parts: LocalDateParts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
}

function localIso(parts: LocalDateParts) {
  if (!validLocalDate(parts.year, parts.month, parts.day)) return null;
  if (!Number.isInteger(parts.hour) || parts.hour < 0 || parts.hour > 23) {
    return null;
  }
  if (
    !Number.isInteger(parts.minute) || parts.minute < 0 || parts.minute > 59
  ) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${
    pad(parts.hour)
  }:${pad(parts.minute)}:00${APPOINTMENT_UTC_OFFSET}`;
}

function structuredIso(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[tT ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?\s*(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (!match) return null;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText = "00",
    zone,
  ] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  if (!localIso(parts) || Number(secondText) > 59) return null;
  const pad = (entry: string) => entry.padStart(2, "0");
  const normalizedZone = zone
    ? zone === "Z"
      ? "Z"
      : zone.includes(":")
      ? zone
      : `${zone.slice(0, 3)}:${zone.slice(3)}`
    : APPOINTMENT_UTC_OFFSET;
  const result = `${yearText}-${pad(monthText)}-${pad(dayText)}T${
    pad(hourText)
  }:${pad(minuteText)}:${pad(secondText)}${normalizedZone}`;
  return Number.isNaN(new Date(result).getTime()) ? null : result;
}

function timeFromText(text: string) {
  if (/\bmeio[- ]dia\b/.test(text)) return { hour: 12, minute: 0 };
  if (/\bmeia[- ]noite\b/.test(text)) return { hour: 0, minute: 0 };

  const periodPattern = new RegExp(
    `\\b(?:as\\s+)?(${HOUR_TOKEN})(?:\\s*(?::|h)\\s*(${MINUTE_TOKEN}))?(?:\\s+horas?)?(?:\\s+e\\s+(${MINUTE_TOKEN})(?:\\s+minutos?)?)?\\s+(?:da|de)\\s+(manha|tarde|noite|madrugada)\\b`,
  );
  const periodMatch = text.match(periodPattern);
  if (periodMatch) {
    let hour = parseNumber(periodMatch[1]);
    const minuteToken = periodMatch[2] || periodMatch[3] || "0";
    const minute = minuteToken === "meia" ? 30 : parseNumber(minuteToken);
    const period = periodMatch[4];
    if (
      hour === null || minute === null || hour < 0 || hour > 12 || minute > 59
    ) return null;
    if (period === "tarde" && hour < 12) hour += 12;
    if (period === "noite" && hour < 12) hour += 12;
    if ((period === "manha" || period === "madrugada") && hour === 12) hour = 0;
    return { hour, minute };
  }

  const clockPattern = new RegExp(
    `\\b(?:as\\s+)?(${HOUR_TOKEN})(?:(?:\\s*:\\s*|\\s*h\\s*)(${MINUTE_TOKEN})|\\s*h\\b|\\s+horas?\\b)(?:\\s+e\\s+(${MINUTE_TOKEN})(?:\\s+minutos?)?)?`,
  );
  const clockMatch = text.match(clockPattern);
  if (clockMatch) {
    const hour = parseNumber(clockMatch[1]);
    const minuteToken = clockMatch[2] || clockMatch[3] || "0";
    const minute = minuteToken === "meia" ? 30 : parseNumber(minuteToken);
    if (
      hour === null || minute === null || hour < 0 || hour > 23 || minute > 59
    ) return null;
    return { hour, minute };
  }

  const unqualified24Hour = text.match(
    new RegExp(`\\bas\\s+(${HOUR_TOKEN})\\b`),
  );
  if (unqualified24Hour) {
    const hour = parseNumber(unqualified24Hour[1]);
    if (hour !== null && hour >= 13 && hour <= 23) return { hour, minute: 0 };
  }
  return null;
}

function inferredYearDate(
  reference: LocalDateParts,
  day: number,
  month: number,
  time: { hour: number; minute: number },
  explicitYear?: number,
) {
  if (explicitYear) return { year: explicitYear, month, day };
  let year = reference.year;
  let candidate = { year, month, day, ...time };
  if (!validLocalDate(year, month, day)) return null;
  if (localComparable(candidate) <= localComparable(reference)) {
    year += 1;
    candidate = { year, month, day, ...time };
  }
  return validLocalDate(year, month, day) ? { year, month, day } : null;
}

function dateFromText(
  text: string,
  reference: LocalDateParts,
  time: { hour: number; minute: number },
) {
  if (/\bdepois de amanha\b/.test(text)) return addLocalDays(reference, 2);
  if (/\bamanha\b/.test(text)) return addLocalDays(reference, 1);
  if (/\bhoje\b/.test(text)) return addLocalDays(reference, 0);

  const relativeMatch = text.match(
    /\b(?:daqui(?:\s+a)?|em)\s+(\d{1,3}|(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte)(?:\s+e\s+(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove))?)\s+dias?\b/,
  );
  if (relativeMatch) {
    const amount = parseNumber(relativeMatch[1]);
    if (amount !== null && amount >= 0 && amount <= 730) {
      return addLocalDays(reference, amount);
    }
  }

  const isoDate = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoDate) {
    const candidate = {
      year: Number(isoDate[1]),
      month: Number(isoDate[2]),
      day: Number(isoDate[3]),
    };
    return validLocalDate(candidate.year, candidate.month, candidate.day)
      ? candidate
      : null;
  }

  const numericDate = text.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
  );
  if (numericDate) {
    const year = numericDate[3]
      ? Number(
        numericDate[3].length === 2 ? `20${numericDate[3]}` : numericDate[3],
      )
      : undefined;
    return inferredYearDate(
      reference,
      Number(numericDate[1]),
      Number(numericDate[2]),
      time,
      year,
    );
  }

  const numberedMonth = text.match(
    /\bdia\s+(\d{1,2})\s+(?:do\s+)?(?:mes\s+)?(\d{1,2})(?:\s+(?:de\s+)?(\d{4}))?\b/,
  );
  if (numberedMonth) {
    return inferredYearDate(
      reference,
      Number(numberedMonth[1]),
      Number(numberedMonth[2]),
      time,
      numberedMonth[3] ? Number(numberedMonth[3]) : undefined,
    );
  }

  const namedMonth = text.match(
    /\b(?:dia\s+)?(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?\b/,
  );
  if (namedMonth) {
    return inferredYearDate(
      reference,
      Number(namedMonth[1]),
      MONTHS[namedMonth[2]],
      time,
      namedMonth[3] ? Number(namedMonth[3]) : undefined,
    );
  }

  const weekday = text.match(
    /\b(?:(proxima|proximo)\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/,
  );
  if (weekday) {
    const currentWeekday = new Date(
      Date.UTC(reference.year, reference.month - 1, reference.day),
    ).getUTCDay();
    let amount = (WEEKDAYS[weekday[2]] - currentWeekday + 7) % 7;
    const sameDayAlreadyPassed = amount === 0 && (
      time.hour < reference.hour ||
      (time.hour === reference.hour && time.minute <= reference.minute)
    );
    if ((weekday[1] || sameDayAlreadyPassed) && amount === 0) amount = 7;
    return addLocalDays(reference, amount);
  }

  const numberedDay = text.match(/\bdia\s+(\d{1,2})\b/);
  if (numberedDay) {
    let year = reference.year;
    let month = reference.month;
    const day = Number(numberedDay[1]);
    let candidate = { year, month, day, ...time };
    if (!validLocalDate(year, month, day)) return null;
    if (localComparable(candidate) <= localComparable(reference)) {
      const nextMonth = new Date(Date.UTC(year, month, 1));
      year = nextMonth.getUTCFullYear();
      month = nextMonth.getUTCMonth() + 1;
      candidate = { year, month, day, ...time };
    }
    return validLocalDate(year, month, day) ? { year, month, day } : null;
  }

  return null;
}

/** Resolves a complete appointment instant from pt-BR speech without guessing a missing time. */
export function resolveSpokenAppointmentDateTime(
  value: unknown,
  reference = new Date(),
) {
  const raw = clean(value);
  if (!raw) return null;
  const alreadyStructured = structuredIso(raw);
  if (alreadyStructured) return alreadyStructured;

  const text = normalize(raw);
  const time = timeFromText(text);
  if (!time) return null;
  const referenceParts = localParts(reference);
  const date = dateFromText(text, referenceParts, time);
  if (!date) return null;
  return localIso({ ...date, ...time });
}
