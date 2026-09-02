export type SynapseReviewFieldPresentation = {
  inputType: "text" | "date" | "datetime-local" | "number";
  editValue: string;
  formatForRequest: (value: string) => unknown;
  min?: string;
  step?: string;
  density: "compact" | "medium" | "wide";
  invalidOriginal?: boolean;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;
const DATE_FIELD_PATTERN = /(?:^|_)(?:date|due_date|data|vencimento)(?:$|_)/i;
const DATE_TIME_FIELD_PATTERN = /(?:^|_)(?:datetime|date_time|start_time|new_datetime|new_start_time|scheduled_at)(?:$|_)/i;
const NUMBER_FIELD_PATTERN = /(?:^|_)(?:amount|value|price|duration_minutes|duration|occurrence_count|count|installments)(?:$|_)/i;
const MONEY_FIELD_PATTERN = /(?:amount|value|price|valor|pre[cç]o)/i;

const clean = (value: unknown) => String(value ?? "").trim();

const normalizedDate = (value: string) => {
  const iso = value.match(DATE_ONLY_PATTERN);
  if (iso) return value;
  const br = value.match(BR_DATE_PATTERN);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
};

const numericValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const match = clean(value).match(/-?\d+(?:[.,]\d+)?/);
  return match ? match[0].replace(",", ".") : "";
};

const todayInSaoPaulo = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
};

/**
 * The review never needs to expose backend-shaped text to the psychologist.
 * Numbers stay numeric, dates use native localized controls, and edited values
 * are sent back in the canonical shape expected by the action planner.
 */
export const getSynapseReviewFieldPresentation = (
  fieldIdValue: unknown,
  labelValue: unknown,
  rawValue: unknown,
): SynapseReviewFieldPresentation => {
  const fieldId = clean(fieldIdValue);
  const label = clean(labelValue);
  const raw = clean(rawValue);
  const dateTimeMatch = raw.match(DATE_TIME_PATTERN);

  if (dateTimeMatch && (DATE_TIME_FIELD_PATTERN.test(fieldId) || /data|hor[aá]rio/i.test(label))) {
    const [, year, month, day, hour, minute] = dateTimeMatch;
    return {
      inputType: "datetime-local",
      editValue: `${year}-${month}-${day}T${hour}:${minute}`,
      formatForRequest: (value) => `${value}:00-03:00`,
      density: "medium",
    };
  }

  const isDateField = DATE_FIELD_PATTERN.test(fieldId) || /data|vencimento/i.test(label);
  if (isDateField && !DATE_TIME_FIELD_PATTERN.test(fieldId)) {
    const date = normalizedDate(raw);
    const dueDate = /due_date|vencimento/i.test(`${fieldId} ${label}`);
    return {
      inputType: "date",
      editValue: date || "",
      formatForRequest: (value) => value,
      ...(dueDate ? { min: todayInSaoPaulo() } : {}),
      density: "medium",
      invalidOriginal: Boolean(raw && !date),
    };
  }

  if (NUMBER_FIELD_PATTERN.test(fieldId) || /dura[cç][aã]o|valor|quantidade|parcelas/i.test(label)) {
    const money = MONEY_FIELD_PATTERN.test(`${fieldId} ${label}`);
    const number = numericValue(rawValue);
    return {
      inputType: "number",
      editValue: number,
      formatForRequest: (value) => {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : value;
      },
      step: money ? "0.01" : "1",
      density: "compact",
      invalidOriginal: Boolean(raw && !number),
    };
  }

  return {
    inputType: "text",
    editValue: raw,
    formatForRequest: (value) => value.trim(),
    density: raw.length > 28 ? "wide" : "medium",
  };
};
