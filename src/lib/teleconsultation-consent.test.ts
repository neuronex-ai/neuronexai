import { describe, expect, it, vi } from 'vitest';

import {
  persistTeleconsultationTranscriptionDecision,
  type TeleconsultationTranscriptionDecision,
} from './teleconsultation-consent';
import type { Appointment } from '@/types';

const appointmentWithDecision = (decision: TeleconsultationTranscriptionDecision) => ({
  id: 'appointment-1',
  metadata: { teleconsultationTranscription: decision },
}) as Appointment;

describe('persistTeleconsultationTranscriptionDecision', () => {
  it.each([
    { enabled: true, label: 'aceita' },
    { enabled: false, label: 'recusada' },
  ])('confirma no banco a preferência $label antes de liberar o fluxo', async ({ enabled }) => {
    const execute = vi.fn().mockResolvedValue({ status: 'completed' });
    const readAppointment = vi.fn().mockResolvedValue(appointmentWithDecision({
      enabled,
      decidedAt: '2026-08-24T12:00:00.000Z',
      decidedBy: 'professional-1',
    }));

    const result = await persistTeleconsultationTranscriptionDecision({
      appointmentId: 'appointment-1',
      professionalId: 'professional-1',
      enabled,
      notes: '  decisão registrada  ',
    }, {
      execute,
      readAppointment,
      createIdempotencyKey: () => 'decision-1',
    });

    expect(execute).toHaveBeenCalledWith(
      'set_teleconsultation_transcription',
      { appointment_id: 'appointment-1', enabled, notes: 'decisão registrada' },
      'professional_app:teleconsultation-consent:appointment-1:decision-1',
      'professional_app',
    );
    expect(readAppointment).toHaveBeenCalledWith('appointment-1', 'professional-1');
    expect(result.decision.enabled).toBe(enabled);
  });

  it('mantém a sala bloqueada quando a leitura não confirma exatamente a decisão enviada', async () => {
    await expect(persistTeleconsultationTranscriptionDecision({
      appointmentId: 'appointment-1',
      professionalId: 'professional-1',
      enabled: true,
    }, {
      execute: vi.fn().mockResolvedValue({ status: 'completed' }),
      readAppointment: vi.fn().mockResolvedValue(appointmentWithDecision({ enabled: false })),
      createIdempotencyKey: () => 'decision-2',
    })).rejects.toThrow('A preferência de transcrição não foi confirmada');
  });
});
