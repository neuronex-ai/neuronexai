export interface TeleconsultationCaptureGate {
  transcriptionEnabled: boolean;
  consentStatus: string;
  isCaptureEnabled: boolean;
}

export interface TeleconsultationReviewGate {
  isOnlineSession: boolean;
  transcriptionEnabled: boolean;
  consentStatus: string;
}

/**
 * Capture is intentionally fail-closed: a missing/negative decision, consent
 * that is not explicitly granted, or an already active capture all block a
 * second start request.
 */
export const shouldStartTeleconsultationCapture = ({
  transcriptionEnabled,
  consentStatus,
  isCaptureEnabled,
}: TeleconsultationCaptureGate) =>
  transcriptionEnabled && consentStatus === 'granted' && !isCaptureEnabled;

/**
 * The end-of-session AI review belongs to the transcript workflow. An online
 * session explicitly configured without transcription must never create,
 * finalize, or present a transcript-derived summary for confirmation.
 */
export const shouldOpenTeleconsultationTranscriptionReview = ({
  isOnlineSession,
  transcriptionEnabled,
  consentStatus,
}: TeleconsultationReviewGate) =>
  !isOnlineSession || (transcriptionEnabled && consentStatus === 'granted');
