const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const UNITS: Record<number, string> = {
  0: "zero",
  1: "um",
  2: "dois",
  3: "três",
  4: "quatro",
  5: "cinco",
  6: "seis",
  7: "sete",
  8: "oito",
  9: "nove",
  10: "dez",
  11: "onze",
  12: "doze",
  13: "treze",
  14: "quatorze",
  15: "quinze",
  16: "dezesseis",
  17: "dezessete",
  18: "dezoito",
  19: "dezenove",
};

const TENS: Record<number, string> = {
  20: "vinte",
  30: "trinta",
  40: "quarenta",
  50: "cinquenta",
  60: "sessenta",
  70: "setenta",
  80: "oitenta",
  90: "noventa",
};

const HUNDREDS: Record<number, string> = {
  100: "cem",
  200: "duzentos",
  300: "trezentos",
  400: "quatrocentos",
  500: "quinhentos",
  600: "seiscentos",
  700: "setecentos",
  800: "oitocentos",
  900: "novecentos",
};

const ACCENTS: Array<[RegExp, string]> = [
  [/\bvoce\b/gi, "você"],
  [/\bnao\b/gi, "não"],
  [/\bso\b/gi, "só"],
  [/\bja\b/gi, "já"],
  [/\bha\b/gi, "há"],
  [/\bacao\b/gi, "ação"],
  [/\bacoes\b/gi, "ações"],
  [/\binformacao\b/gi, "informação"],
  [/\binformacoes\b/gi, "informações"],
  [/\bexecucao\b/gi, "execução"],
  [/\bseguranca\b/gi, "segurança"],
  [/\bconfiavel\b/gi, "confiável"],
  [/\boperacao\b/gi, "operação"],
  [/\bconcluida\b/gi, "concluída"],
  [/\bremarcacao\b/gi, "remarcação"],
  [/\bnavegacao\b/gi, "navegação"],
  [/\bprontuario\b/gi, "prontuário"],
  [/\bhistorico\b/gi, "histórico"],
  [/\bclinico\b/gi, "clínico"],
  [/\bclinica\b/gi, "clínica"],
  [/\bhorarios\b/gi, "horários"],
  [/\bcobranca\b/gi, "cobrança"],
  [/\bsessao\b/gi, "sessão"],
  [/\bsessoes\b/gi, "sessões"],
  [/\bconfirmacao\b/gi, "confirmação"],
  [/\bpsicologo\b/gi, "psicólogo"],
  [/\bpossivel\b/gi, "possível"],
  [/\bproximo\b/gi, "próximo"],
  [/\bproxima\b/gi, "próxima"],
];

const TECHNICAL_LABELS: Record<string, string> = {
  confirm_pending_action: "confirmação pendente",
  cancel_pending_action: "cancelamento pendente",
  create_appointment: "novo agendamento",
  reschedule_appointment: "remarcação",
  cancel_appointment: "cancelamento",
  send_appointment_reminder: "lembrete de agendamento",
  create_neurofinance_charge: "cobrança NeuroFinance",
  draft_invoice: "cobrança",
  create_transaction: "lançamento financeiro",
  create_neuroflow_from_patient_history: "NeuroFlow",
  get_dashboard_next_appointment: "próxima consulta",
};

function numberToWords(value: number): string {
  const number = Math.floor(Math.abs(Number(value) || 0));
  if (number < 20) return UNITS[number];
  if (number < 100) {
    const ten = Math.floor(number / 10) * 10;
    const unit = number % 10;
    return unit ? `${TENS[ten]} e ${UNITS[unit]}` : TENS[ten];
  }
  if (number < 1000) {
    if (number === 100) return HUNDREDS[100];
    const hundred = Math.floor(number / 100) * 100;
    const rest = number % 100;
    const prefix = hundred === 100 ? "cento" : HUNDREDS[hundred];
    return rest ? `${prefix} e ${numberToWords(rest)}` : prefix;
  }
  if (number < 1000000) {
    const thousand = Math.floor(number / 1000);
    const rest = number % 1000;
    const prefix = thousand === 1 ? "mil" : `${numberToWords(thousand)} mil`;
    if (!rest) return prefix;
    return `${prefix}${rest < 100 ? " e " : " "}${numberToWords(rest)}`;
  }
  return String(number);
}

function turnForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "da manhã";
  if (hour >= 12 && hour < 18) return "da tarde";
  if (hour >= 18 && hour <= 23) return "da noite";
  return "da madrugada";
}

export function formatSpokenTime(hourValue: unknown, minuteValue: unknown) {
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (hour === 0 && minute === 0) return "meia-noite";
  if (hour === 12 && minute === 0) return "meio-dia";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  if (minute === 0) return `${numberToWords(displayHour)} ${displayHour === 1 ? "hora" : "horas"} ${turnForHour(hour)}`;
  return `${numberToWords(displayHour)} e ${numberToWords(minute)} ${turnForHour(hour)}`;
}

function formatSpokenDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
  const day = get("day");
  const month = get("month");
  return `${numberToWords(day)} de ${MONTHS[month - 1]}, às ${formatSpokenTime(get("hour"), get("minute"))}`;
}

function formatSpokenDate(year: string, month: string, day: string) {
  return `${numberToWords(Number(day))} de ${MONTHS[Number(month) - 1] || month}`;
}

function formatMoney(raw: string) {
  const normalized = clean(raw, 80).replace(/[R$\s]/gi, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return raw;
  const reais = Math.floor(amount);
  const cents = Math.round((amount - reais) * 100);
  const reaisText = reais === 1 ? "um real" : `${numberToWords(reais)} reais`;
  if (!cents) return reaisText;
  const centsText = cents === 1 ? "um centavo" : `${numberToWords(cents)} centavos`;
  return `${reaisText} e ${centsText}`;
}

export function normalizeVoiceText(value: unknown) {
  let text = clean(value, 5000);
  if (!text) return "";
  text = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\b[a-z]+_[a-z0-9_]+\b/gi, (match) => TECHNICAL_LABELS[match] || match.replace(/_/g, " "))
    .replace(/\b(?:appointment|patient|invoice|payment|transaction|session|voice)_id\b\s*[:=]?\s*["']?[a-z0-9-]+["']?/gi, "")
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\b/gi, "")
    .replace(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)\b/g, (_match, iso) => formatSpokenDateTime(iso))
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_match, year, month, day) => formatSpokenDate(year, month, day))
    .replace(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g, (_match, hour, minute) => formatSpokenTime(hour, minute))
    .replace(/\bR\$\s?[\d.]+,\d{2}\b/g, (match) => formatMoney(match));
  for (const [pattern, replacement] of ACCENTS) text = text.replace(pattern, replacement);
  return text.replace(/[{}[\]"`]/g, "").replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

export function normalizeVoicePayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  const spoken = normalizeVoiceText(record.spoken_summary || record.message || record.error || "");
  if (!spoken) return payload;
  return {
    ...record,
    spoken_summary: spoken,
    message: spoken,
    ...(record.error ? { error: normalizeVoiceText(record.error) } : {}),
  };
}
