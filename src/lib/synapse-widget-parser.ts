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

  const directType = firstString(value.__actionType, value.type);
  if (directType) return value as SynapseWidgetData;

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

export const parseSynapseWidgetsFromContent = (content: string): {
  cleanContent: string;
  widgetData: SynapseWidgetData[];
} => {
  const trimmed = content.trim();

  const fromRawJson = (() => {
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
    try {
      return unwrapSynapseToolResponse(JSON.parse(trimmed));
    } catch {
      return null;
    }
  })();

  if (fromRawJson) return { cleanContent: "", widgetData: [fromRawJson] };

  const fencePattern = /```(?:json|synapse|widget)?\s*([\s\S]*?)```/gi;
  const widgetData: SynapseWidgetData[] = [];
  const cleanContent = content
    .replace(fencePattern, (fullMatch, jsonCandidate) => {
      try {
        const parsedWidget = unwrapSynapseToolResponse(JSON.parse(String(jsonCandidate).trim()));
        if (!parsedWidget) return fullMatch;
        widgetData.push(parsedWidget);
        return "";
      } catch {
        return fullMatch;
      }
    })
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
