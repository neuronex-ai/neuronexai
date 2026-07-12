export interface TeleconsultationCaptureGate {
  transcriptionEnabled: boolean;
  consentStatus: string;
  isCaptureEnabled: boolean;
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
