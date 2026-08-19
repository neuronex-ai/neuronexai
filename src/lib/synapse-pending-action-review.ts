import { supabase } from "@/integrations/supabase/client";
import {
  normalizeVoiceReviewAction,
  type SynapseActionReview,
  type SynapseReviewSegment,
} from "@/lib/synapse-voice-ui-protocol";

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const fieldSegment = (value: unknown): SynapseReviewSegment | null => {
  const field = asRecord(value);
  if (!field) return null;
  const fieldId = clean(field.fieldId, 120);
  if (!fieldId) return null;
  const label = clean(field.label || fieldId, 120) || fieldId;
  const type = clean(field.type, 40);
  if (type === "select") {
    const options = Array.isArray(field.options)
      ? field.options.flatMap((rawOption): Array<{ value: string; label: string }> => {
          const option = asRecord(rawOption);
          if (!option) return [];
          const optionValue = clean(option.value, 120);
          if (!optionValue) return [];
          return [{ value: optionValue, label: clean(option.label || optionValue, 120) || optionValue }];
        })
      : [];
    if (!options.length) return null;
    return {
      type: "select",
      fieldId,
      label,
      value: clean(field.value, 120),
      options,
    };
  }
  return {
    type: "editable",
    fieldId,
    label,
    value: field.value ?? "",
    maxLength: Number.isFinite(Number(field.maxLength)) ? Number(field.maxLength) : undefined,
    inputMode: ["money", "number"].includes(type) ? "decimal" : undefined,
  };
};

export function voiceReviewFromPersistedRow(row: Record<string, unknown>): SynapseActionReview | null {
  const review = asRecord(row.review_public);
  const planId = clean(row.plan_id || review?.planId, 160);
  const planVersion = Number(row.plan_version || review?.planVersion);
  const planHash = clean(row.plan_hash || review?.planHash, 64);
  const confirmationPolicy = clean(row.confirmation_policy || review?.confirmationPolicy, 20);
  const cards = Array.isArray(review?.cards) ? review.cards : [];
  if (!planId || !Number.isInteger(planVersion) || !planHash || !cards.length) return null;

  const actions = cards.flatMap((rawCard) => {
    const card = asRecord(rawCard);
    if (!card) return [];
    const id = clean(card.id, 160);
    if (!id) return [];
    const summary = clean(card.summary || card.title, 800);
    const editableFields = Array.isArray(card.editableFields) ? card.editableFields : [];
    const segments: SynapseReviewSegment[] = [
      ...(summary ? [{ type: "text" as const, text: summary }] : []),
      ...editableFields.flatMap((rawField): SynapseReviewSegment[] => {
        const segment = fieldSegment(rawField);
        return segment ? [segment] : [];
      }),
    ];
    if (!segments.length) return [];
    return [{ id, area: clean(card.area, 120) || "Ação", segments }];
  });
  if (!actions.length) return null;

  return normalizeVoiceReviewAction({
    type: "synapse_action_review",
    data: {
      reviewId: `${planId}:${planVersion}`,
      toolName: "execute_action_group",
      planId,
      planVersion,
      planHash,
      confirmationPolicy,
      actions,
    },
  }) as SynapseActionReview | null;
}

export async function loadPendingVoiceActionReview(conversationIdValue: unknown) {
  const conversationId = clean(conversationIdValue, 160);
  if (!UUID_PATTERN.test(conversationId)) return null;

  const { data, error } = await (supabase as any)
    .from("synapse_composite_action_plans")
    .select("plan_id,plan_version,plan_hash,confirmation_policy,review_public,expires_at,updated_at")
    .eq("conversation_id", conversationId)
    .eq("status", "awaiting_confirmation")
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? voiceReviewFromPersistedRow(data as Record<string, unknown>) : null;
}
