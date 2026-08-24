export type SynapseReviewFieldPresentation = {
  inputType: "text" | "date" | "datetime-local";
  editValue: string;
  formatForRequest: (value: string) => string;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;
const DATE_FIELD_PATTERN = /(?:^|_)(?:date|due_date|data|vencimento)(?:$|_)/i;
const DATE_TIME_FIELD_PATTERN = /(?:^|_)(?:datetime|date_time|start_time|new_datetime|new_start_time|scheduled_at)(?:$|_)/i;

/**
 * Keeps the plan value intact while presenting temporal fields through native,
 * localized controls. Edited appointment times are serialized in the product's
 * canonical Brasília offset instead of exposing or submitting a raw timestamp.
 */
export const getSynapseReviewFieldPresentation = (
  fieldIdValue: unknown,
  labelValue: unknown,
  rawValue: unknown,
): SynapseReviewFieldPresentation => {
  const fieldId = String(fieldIdValue || "");
  const label = String(labelValue || "");
  const raw = String(rawValue ?? "");
  const dateTimeMatch = raw.match(DATE_TIME_PATTERN);

  if (dateTimeMatch && (DATE_TIME_FIELD_PATTERN.test(fieldId) || /data|hor[aá]rio/i.test(label))) {
    const [, year, month, day, hour, minute] = dateTimeMatch;
    return {
      inputType: "datetime-local",
      editValue: `${year}-${month}-${day}T${hour}:${minute}`,
      formatForRequest: (value) => `${value}:00-03:00`,
    };
  }

  if (DATE_ONLY_PATTERN.test(raw) && (DATE_FIELD_PATTERN.test(fieldId) || /data|vencimento/i.test(label))) {
    return {
      inputType: "date",
      editValue: raw,
      formatForRequest: (value) => value,
    };
  }

  return {
    inputType: "text",
    editValue: raw,
    formatForRequest: (value) => value,
  };
};
