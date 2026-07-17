export type SynapseWidgetData = {
  __actionType?: string;
  type?: string;
  data?: unknown;
  payload?: unknown;
  title?: string;
};

export type SynapseClientAction = {
  type: string;
  data?: unknown;
  payload?: unknown;
};

export type SynapseRichData = SynapseClientAction | null | undefined;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export const firstString = (...values: unknown[]) =>
  values.find((value): value is string => typeof value === "string" && value.trim().length > 0);

export const normalizeSynapseWidgetType = (type?: string) =>
  (type || "synapse_action")
    .replace(/_widget$/i, "")
    .replace(/_response$/i, "")
    .toLowerCase();

export const unwrapSynapseToolResponse = (value: unknown): SynapseWidgetData | null => {
  if (!isRecord(value)) return null;

  const directType = firstString(
    value.__actionType,
    value.__action_type,
    value.actionType,
    value.action_type,
    value.widgetType,
    value.widget_type,
    value.type,
  );
  if (directType) return { ...value, __actionType: directType } as SynapseWidgetData;

  const responseEntry = Object.entries(value).find(([key]) => key.endsWith("_response"));
  if (!responseEntry) return null;

  const [responseKey, responseValue] = responseEntry;
  const response = isRecord(responseValue) ? responseValue : {};
  const content = isRecord(response.content) ? response.content : response;
  const data =
    (isRecord(content.appointment) && content.appointment) ||
    (isRecord(content.patient) && content.patient) ||
    (isRecord(content.invoice) && content.invoice) ||
    content;

  return {
    __actionType: responseKey.replace(/_response$/i, ""),
    data,
    title: firstString(content.message, response.message),
  };
};

const TECHNICAL_OBJECT_RE = /["']?(?:__action_?type|action_?type|widget_?type|tool_?name|user_id|patient_id|appointment_id|session_id|created_at|updated_at|last_session|risk_score|emergency_contact)["']?\s*:/i;

const inferWidgetFromPayload = (value: unknown): SynapseWidgetData | null => {
  if (!isRecord(value)) return null;
  const direct = unwrapSynapseToolResponse(value);
  if (direct) return direct;

  const payload = isRecord(value.data) ? value.data : value;
  if (Array.isArray(payload.patients)) {
    return { __actionType: "patient_list", data: payload, title: firstString(value.title, value.message) };
  }
  if (Array.isArray(payload.appointments)) {
    return { __actionType: "appointment_list", data: payload, title: firstString(value.title, value.message) };
  }
  if (Array.isArray(payload.transactions) || Array.isArray(payload.invoices)) {
    return { __actionType: "financial_summary", data: payload, title: firstString(value.title, value.message) };
  }
  return null;
};

const parseWidgetCandidate = (candidate: string) => {
  try {
    return inferWidgetFromPayload(JSON.parse(candidate.trim()));
  } catch {
    return null;
  }
};

const stripEmbeddedTechnicalObjects = (
  content: string,
  widgets: SynapseWidgetData[],
) => {
  let result = "";
  let cursor = 0;
  let index = 0;

  while (index < content.length) {
    if (content[index] !== "{") {
      index += 1;
      continue;
    }

    const start = index;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (; index < content.length; index += 1) {
      const char = content[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }

    if (end < 0) break;
    const candidate = content.slice(start, end);
    const widget = parseWidgetCandidate(candidate);
    const shouldHide = Boolean(widget) || TECHNICAL_OBJECT_RE.test(candidate);
    if (shouldHide) {
      result += content.slice(cursor, start);
      if (widget) widgets.push(widget);
      cursor = end;
    }
    index = end;
  }

  return `${result}${content.slice(cursor)}`;
};

export const parseSynapseWidgetsFromContent = (content: string): {
  cleanContent: string;
  widgetData: SynapseWidgetData[];
} => {
  const trimmed = content.trim();

  const fromRawJson = (() => {
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
    return parseWidgetCandidate(trimmed);
  })();

  if (fromRawJson) return { cleanContent: "", widgetData: [fromRawJson] };

  const fencePattern = /```(?:json|synapse|widget)?\s*([\s\S]*?)```/gi;
  const widgetData: SynapseWidgetData[] = [];
  const withoutTechnicalFences = content
    .replace(fencePattern, (fullMatch, jsonCandidate) => {
      const candidate = String(jsonCandidate).trim();
      const parsedWidget = parseWidgetCandidate(candidate);
      if (parsedWidget) {
        widgetData.push(parsedWidget);
        return "";
      }
      return TECHNICAL_OBJECT_RE.test(candidate) ? "" : fullMatch;
    })
    .trim();

  const cleanContent = stripEmbeddedTechnicalObjects(withoutTechnicalFences, widgetData)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanContent, widgetData };
};

export const parseSynapseWidgetFromContent = (content: string): {
  cleanContent: string;
  widgetData: SynapseWidgetData | null;
} => {
  const parsed = parseSynapseWidgetsFromContent(content);
  return { cleanContent: parsed.cleanContent, widgetData: parsed.widgetData[0] || null };
};

export const normalizeSynapseDataArray = (rawData: unknown): unknown[] => {
  if (Array.isArray(rawData)) return rawData;
  if (!isRecord(rawData)) return rawData ? [rawData] : [];
  if (Array.isArray(rawData.items)) return rawData.items;
  if (Array.isArray(rawData.results)) return rawData.results;
  if (Array.isArray(rawData.data)) return rawData.data;
  if (Array.isArray(rawData.patients)) return rawData.patients;
  if (Array.isArray(rawData.appointments)) return rawData.appointments;
  return [rawData];
};
