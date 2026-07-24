import { describe, expect, it } from 'vitest';

import {
  shouldOpenTeleconsultationTranscriptionReview,
  shouldStartTeleconsultationCapture,
} from './teleconsultation-transcription';

describe('shouldStartTeleconsultationCapture', () => {
  it('permite iniciar somente com decisão afirmativa e consentimento concedido', () => {
    expect(
      shouldStartTeleconsultationCapture({
        transcriptionEnabled: true,
        consentStatus: 'granted',
        isCaptureEnabled: false,
      }),
    ).toBe(true);
  });

  it.each([
    { transcriptionEnabled: false, consentStatus: 'granted', isCaptureEnabled: false },
    { transcriptionEnabled: true, consentStatus: 'declined', isCaptureEnabled: false },
    { transcriptionEnabled: true, consentStatus: 'granted', isCaptureEnabled: true },
  ])('bloqueia captura sem autorização explícita: %o', (gate) => {
    expect(shouldStartTeleconsultationCapture(gate)).toBe(false);
  });
});

describe('shouldOpenTeleconsultationTranscriptionReview', () => {
  it.each([
    { transcriptionEnabled: false, consentStatus: 'declined' },
    { transcriptionEnabled: false, consentStatus: 'granted' },
    { transcriptionEnabled: true, consentStatus: 'declined' },
  ])('does not open the transcript review or generate an AI summary without affirmative consent: %o', (decision) => {
    expect(
      shouldOpenTeleconsultationTranscriptionReview({
        isOnlineSession: true,
        ...decision,
      }),
    ).toBe(false);
  });

  it.each([
    {
      isOnlineSession: true,
      transcriptionEnabled: true,
      consentStatus: 'granted',
    },
    {
      isOnlineSession: false,
      transcriptionEnabled: false,
      consentStatus: 'pending',
    },
  ])('keeps the existing review path only when it is eligible: %o', (gate) => {
    expect(shouldOpenTeleconsultationTranscriptionReview(gate)).toBe(true);
  });
});
