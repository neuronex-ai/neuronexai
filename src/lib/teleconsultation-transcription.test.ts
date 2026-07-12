import { describe, expect, it } from 'vitest';

import { shouldStartTeleconsultationCapture } from './teleconsultation-transcription';

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
