export const APPOINTMENT_PLAN_REVIEW_EVENT = "neuronex:appointment-plan-review";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLAN_HASH = /^[0-9a-f]{64}$/i;

export type AppointmentPlanReviewReference = {
  planId: string;
  planVersion: number;
  planHash: string;
  conversationId?: string | null;
  originChannel?: "synapse_text" | "synapse_voice" | "synapse_whatsapp" | "professional_app";
};

export type AppointmentPlanClientAction = {
  type: "review_appointment_plan";
  data: AppointmentPlanReviewReference;
};

export const parseAppointmentPlanReviewAction = (
  value: unknown,
): AppointmentPlanReviewReference | null => {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Record<string, unknown>;
  if (envelope.type !== "review_appointment_plan") return null;
  const data = envelope.data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const planId = String(record.planId || "");
  const planVersion = Number(record.planVersion);
  const planHash = String(record.planHash || "").toLowerCase();
  const conversationId = record.conversationId ? String(record.conversationId) : null;
  const originChannel = String(record.originChannel || "professional_app");

  if (!UUID.test(planId) || !Number.isInteger(planVersion) || planVersion < 1) return null;
  if (!PLAN_HASH.test(planHash)) return null;
  if (conversationId && !UUID.test(conversationId)) return null;
  if (!["synapse_text", "synapse_voice", "synapse_whatsapp", "professional_app"].includes(originChannel)) {
    return null;
  }

  return {
    planId,
    planVersion,
    planHash,
    conversationId,
    originChannel: originChannel as AppointmentPlanReviewReference["originChannel"],
  };
};

export const requestAppointmentPlanReview = (reference: AppointmentPlanReviewReference) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APPOINTMENT_PLAN_REVIEW_EVENT, { detail: reference }));
};
