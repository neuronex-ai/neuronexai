import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  resolveClinicalSessionCompletionAttempt,
  type ClinicalSessionCompletionInput,
} from './use-complete-appointment-clinical-session';

const appointmentId = '99115fd2-785e-45dc-bc91-1daf9cc04c52';
const input: ClinicalSessionCompletionInput = {
  draftPending: false,
  sessionSummaryNoteId: '9d8a50fb-8e39-4e45-ab31-8e2e8ba25391',
  sessionTranscriptId: '3a6da51f-fcf4-4200-860f-21f0335b50d9',
};

describe('clinical session completion attempts', () => {
  it('reuses the same idempotency key for an identical retry', () => {
    const keyFactory = vi.fn(() => 'stable-key');
    const first = resolveClinicalSessionCompletionAttempt(
      null,
      appointmentId,
      input,
      keyFactory,
    );
    const retry = resolveClinicalSessionCompletionAttempt(
      first,
      appointmentId,
      { ...input },
      keyFactory,
    );

    expect(retry).toBe(first);
    expect(retry.idempotencyKey).toBe('stable-key');
    expect(keyFactory).toHaveBeenCalledTimes(1);
  });

  it('starts another attempt when the appointment or completion payload changes', () => {
    const keyFactory = vi
      .fn<(appointmentId: string) => string>()
      .mockReturnValueOnce('first-key')
      .mockReturnValueOnce('changed-payload-key')
      .mockReturnValueOnce('changed-appointment-key');
    const first = resolveClinicalSessionCompletionAttempt(
      null,
      appointmentId,
      input,
      keyFactory,
    );
    const changedPayload = resolveClinicalSessionCompletionAttempt(
      first,
      appointmentId,
      { ...input, draftPending: true },
      keyFactory,
    );
    const changedAppointment = resolveClinicalSessionCompletionAttempt(
      changedPayload,
      '9f1cdf56-277f-4abc-bbb9-c2b806fcce8b',
      { ...input, draftPending: true },
      keyFactory,
    );

    expect(changedPayload.idempotencyKey).toBe('changed-payload-key');
    expect(changedAppointment.idempotencyKey).toBe('changed-appointment-key');
    expect(keyFactory).toHaveBeenCalledTimes(3);
  });
});

describe('clinical session completion clients', () => {
  const desktopSource = readFileSync(
    resolve(process.cwd(), 'src/hooks/use-desktop-clinical-session.ts'),
    'utf8',
  );
  const mobileSource = readFileSync(
    resolve(process.cwd(), 'src/mobile/components/MobileActiveSession.tsx'),
    'utf8',
  );

  it.each([
    ['desktop', desktopSource],
    ['mobile', mobileSource],
  ])('%s completes through the guarded RPC client without clinical metadata', (_, source) => {
    expect(source).toContain('completeClinicalSession({');
    expect(source).not.toMatch(/status:\s*['"]attended['"]/u);
    expect(source).not.toContain('sessionDraftNotes');
    expect(source).not.toContain('sessionCompletedAt');
  });
});
