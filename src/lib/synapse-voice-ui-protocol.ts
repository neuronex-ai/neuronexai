export const SYNAPSE_VOICE_REVIEW_EVENT = "synapse:voice-review-action";
export const SYNAPSE_ACTION_GROUP_EDIT_REQUEST_EVENT = "synapse:action-group-edit-request";
export const SYNAPSE_ACTION_GROUP_EDIT_RESULT_EVENT = "synapse:action-group-edit-result";
export const SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT = "synapse:opaque-confirmation-request";
export const SYNAPSE_OPAQUE_CONFIRM_RESPONSE_EVENT = "synapse:opaque-confirmation-response";
export const SYNAPSE_OPAQUE_CAPTURE_BLOCK_EVENT = "synapse:opaque-capture-block";

export type SynapseReviewTextSegment = {
  type: "text";
  text: string;
};

export type SynapseReviewEditableSegment = {
  type: "editable";
  fieldId: string;
  label: string;
  value: unknown;
  maxLength?: number;
  inputMode?: string;
};

export type SynapseReviewSelectSegment = {
  type: "select";
  fieldId: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
};

export type SynapseReviewSegment =
  | SynapseReviewTextSegment
  | SynapseReviewEditableSegment
  | SynapseReviewSelectSegment;

export type SynapseReviewCard = {
  id: string;
  area: string;
  segments: SynapseReviewSegment[];
};

export type SynapseActionReview = {
  type: "synapse_action_review";
  data: {
    reviewId: string;
    toolName?: string;
    planId?: string;
    planVersion?: number;
    planHash?: string;
    confirmationPolicy?: "direct" | "voice" | "opaque";
    actions: SynapseReviewCard[];
  };
};

export type SynapseActionReviewDismiss = {
  type: "synapse_action_review_dismiss";
};

export type SynapseVoiceReviewAction = SynapseActionReview | SynapseActionReviewDismiss;

export type SynapseActionGroupEditRequest = {
  reviewId: string;
  planId: string;
  planVersion: number;
  planHash: string;
  stepId: string;
  fieldId: string;
  value: unknown;
};

export type SynapseActionGroupEditResult = {
  reviewId: string;
  stepId: string;
  fieldId: string;
  success: boolean;
  message?: string;
};

export type SynapseOpaqueConfirmationRequest = {
  requestId: string;
  challengeId: string;
};

export type SynapseOpaqueConfirmationResponse = {
  requestId: string;
  success: boolean;
  cancelled?: boolean;
  message?: string;
};

export type SynapseOpaqueCaptureBlock = {
  blocked: boolean;
};

let pendingOpaqueConfirmationRequest: SynapseOpaqueConfirmationRequest | null = null;

export const getPendingOpaqueConfirmationRequest = () => pendingOpaqueConfirmationRequest;

const clearPendingOpaqueConfirmationRequest = (requestId: string) => {
  if (pendingOpaqueConfirmationRequest?.requestId === requestId) {
    pendingOpaqueConfirmationRequest = null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const safePlanVersion = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : undefined;
};

const safePlanHash = (value: unknown) => {
  const hash = String(value || "").trim().slice(0, 64);
  return /^[a-f0-9]{64}$/i.test(hash) ? hash : undefined;
};

export const normalizeVoiceReviewAction = (value: unknown): SynapseVoiceReviewAction | null => {
  const record = asRecord(value);
  if (!record) return null;
  if (record.type === "synapse_action_review_dismiss") {
    return { type: "synapse_action_review_dismiss" };
  }
  if (record.type !== "synapse_action_review") return null;

  const data = asRecord(record.data);
  const reviewId = String(data?.reviewId || "").trim().slice(0, 160);
  const rawActions = Array.isArray(data?.actions) ? data.actions : [];
  if (!reviewId || !rawActions.length) return null;

  const actions = rawActions.flatMap((rawCard): SynapseReviewCard[] => {
    const card = asRecord(rawCard);
    if (!card) return [];
    const id = String(card.id || "").trim().slice(0, 160);
    const area = String(card.area || "Ação").trim().slice(0, 120) || "Ação";
    const segments = Array.isArray(card.segments)
      ? card.segments.flatMap((rawSegment): SynapseReviewSegment[] => {
          const segment = asRecord(rawSegment);
          if (!segment) return [];
          if (segment.type === "text") {
            return [{ type: "text", text: String(segment.text || "").slice(0, 800) }];
          }
          if (segment.type === "editable") {
            const fieldId = String(segment.fieldId || "").trim().slice(0, 120);
            if (!fieldId) return [];
            return [{
              type: "editable",
              fieldId,
              label: String(segment.label || fieldId).slice(0, 120),
              value: segment.value ?? "",
              maxLength: Number.isFinite(Number(segment.maxLength)) ? Number(segment.maxLength) : undefined,
              inputMode: typeof segment.inputMode === "string" ? segment.inputMode.slice(0, 40) : undefined,
            }];
          }
          if (segment.type === "select") {
            const fieldId = String(segment.fieldId || "").trim().slice(0, 120);
            const options = Array.isArray(segment.options)
              ? segment.options.flatMap((rawOption): Array<{ value: string; label: string }> => {
                  const option = asRecord(rawOption);
                  if (!option) return [];
                  const optionValue = String(option.value || "").slice(0, 120);
                  if (!optionValue) return [];
                  return [{ value: optionValue, label: String(option.label || optionValue).slice(0, 120) }];
                })
              : [];
            if (!fieldId || !options.length) return [];
            return [{
              type: "select",
              fieldId,
              label: String(segment.label || fieldId).slice(0, 120),
              value: String(segment.value || "").slice(0, 120),
              options,
            }];
          }
          return [];
        })
      : [];
    if (!id || !segments.length) return [];
    return [{ id, area, segments }];
  });

  if (!actions.length) return null;
  const planId = String(data?.planId || "").trim().slice(0, 160) || undefined;
  const planVersion = safePlanVersion(data?.planVersion);
  const planHash = safePlanHash(data?.planHash);
  const rawPolicy = String(data?.confirmationPolicy || "").trim();
  const confirmationPolicy = ["direct", "voice", "opaque"].includes(rawPolicy)
    ? rawPolicy as "direct" | "voice" | "opaque"
    : undefined;

  return {
    type: "synapse_action_review",
    data: {
      reviewId,
      toolName: String(data?.toolName || "").trim().slice(0, 120) || undefined,
      planId,
      planVersion,
      planHash,
      confirmationPolicy,
      actions,
    },
  };
};

export const emitVoiceReviewAction = (value: unknown) => {
  const action = normalizeVoiceReviewAction(value);
  if (!action || typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent<SynapseVoiceReviewAction>(SYNAPSE_VOICE_REVIEW_EVENT, {
    detail: action,
  }));
  return true;
};

export const emitActionGroupEditRequest = (request: SynapseActionGroupEditRequest) => {
  if (typeof window === "undefined") return false;
  const planVersion = safePlanVersion(request.planVersion);
  const planHash = safePlanHash(request.planHash);
  const planId = String(request.planId || "").trim().slice(0, 160);
  const stepId = String(request.stepId || "").trim().slice(0, 160);
  const fieldId = String(request.fieldId || "").trim().slice(0, 120);
  if (!planId || !planVersion || !planHash || !stepId || !fieldId) return false;
  window.dispatchEvent(new CustomEvent<SynapseActionGroupEditRequest>(SYNAPSE_ACTION_GROUP_EDIT_REQUEST_EVENT, {
    detail: {
      reviewId: String(request.reviewId || "").slice(0, 160),
      planId,
      planVersion,
      planHash,
      stepId,
      fieldId,
      value: request.value,
    },
  }));
  return true;
};

export const emitActionGroupEditResult = (result: SynapseActionGroupEditResult) => {
  if (typeof window === "undefined") return false;
  const reviewId = String(result.reviewId || "").trim().slice(0, 160);
  const stepId = String(result.stepId || "").trim().slice(0, 160);
  const fieldId = String(result.fieldId || "").trim().slice(0, 120);
  if (!reviewId || !stepId || !fieldId) return false;
  window.dispatchEvent(new CustomEvent<SynapseActionGroupEditResult>(SYNAPSE_ACTION_GROUP_EDIT_RESULT_EVENT, {
    detail: {
      reviewId,
      stepId,
      fieldId,
      success: result.success === true,
      message: String(result.message || "").slice(0, 500),
    },
  }));
  return true;
};

export const setOpaqueCaptureBlocked = (blocked: boolean) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SynapseOpaqueCaptureBlock>(SYNAPSE_OPAQUE_CAPTURE_BLOCK_EVENT, {
    detail: { blocked },
  }));
};

export const requestOpaqueConfirmation = async (
  challengeIdValue: unknown,
  timeoutMs = 55_000,
): Promise<{ success: boolean; cancelled?: boolean; message: string }> => {
  if (typeof window === "undefined") {
    return { success: false, cancelled: true, message: "Confirmação visual indisponível neste ambiente." };
  }

  const challengeId = String(challengeIdValue || "").trim().slice(0, 160);
  if (!challengeId) {
    return { success: false, cancelled: true, message: "Desafio de confirmação inválido." };
  }

  const requestId = globalThis.crypto?.randomUUID?.() || `opaque-confirm-${Date.now()}`;
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result: { success: boolean; cancelled?: boolean; message: string }) => {
      if (settled) return;
      settled = true;
      clearPendingOpaqueConfirmationRequest(requestId);
      window.clearTimeout(timer);
      window.removeEventListener(SYNAPSE_OPAQUE_CONFIRM_RESPONSE_EVENT, onResponse as EventListener);
      resolve(result);
    };
    const onResponse = (event: Event) => {
      const detail = (event as CustomEvent<SynapseOpaqueConfirmationResponse>).detail;
      if (!detail || detail.requestId !== requestId) return;
      finish({
        success: detail.success === true,
        cancelled: Boolean(detail.cancelled),
        message: String(detail.message || (detail.success ? "Confirmação concluída." : "Confirmação não concluída.")).slice(0, 500),
      });
    };
    const timer = window.setTimeout(() => {
      finish({ success: false, cancelled: true, message: "A confirmação expirou sem expor o número do desafio." });
    }, Math.max(5_000, Math.min(58_000, timeoutMs)));

    window.addEventListener(SYNAPSE_OPAQUE_CONFIRM_RESPONSE_EVENT, onResponse as EventListener);
    const detail: SynapseOpaqueConfirmationRequest = { requestId, challengeId };
    pendingOpaqueConfirmationRequest = detail;
    window.dispatchEvent(new CustomEvent<SynapseOpaqueConfirmationRequest>(SYNAPSE_OPAQUE_CONFIRM_REQUEST_EVENT, {
      detail,
    }));
  });
};

export const respondOpaqueConfirmation = (response: SynapseOpaqueConfirmationResponse) => {
  if (typeof window === "undefined") return;
  clearPendingOpaqueConfirmationRequest(String(response.requestId || "").slice(0, 160));
  window.dispatchEvent(new CustomEvent<SynapseOpaqueConfirmationResponse>(SYNAPSE_OPAQUE_CONFIRM_RESPONSE_EVENT, {
    detail: {
      requestId: String(response.requestId || "").slice(0, 160),
      success: response.success === true,
      cancelled: Boolean(response.cancelled),
      message: String(response.message || "").slice(0, 500),
    },
  }));
};
