import { describe, expect, it } from 'vitest';

import { resolveSynapseHistoryChannel } from './synapse-history';

describe('resolveSynapseHistoryChannel', () => {
  it('classifies legacy text, voice and WhatsApp sessions without new schema columns', () => {
    expect(resolveSynapseHistoryChannel({ id: 'text', title: 'Listar pacientes' })).toBe('text');
    expect(resolveSynapseHistoryChannel(
      { id: 'voice', title: 'Listar pacientes' },
      new Set(['voice']),
    )).toBe('voice');
    expect(resolveSynapseHistoryChannel({
      id: 'whatsapp',
      title: 'Paciente',
      context_state: { source: 'whatsapp' },
    })).toBe('whatsapp');
  });

  it('prefers explicit provenance and keeps legacy title fallbacks', () => {
    expect(resolveSynapseHistoryChannel({
      id: 'explicit-voice',
      title: 'Agenda de amanhã',
      origin_channel: 'voice',
    })).toBe('voice');
    expect(resolveSynapseHistoryChannel({
      id: 'legacy-voice',
      title: 'Conversa por voz — Agenda',
    })).toBe('voice');
    expect(resolveSynapseHistoryChannel({
      id: 'legacy-whatsapp',
      title: 'WhatsApp Business - Ana',
    })).toBe('whatsapp');
  });

  it('keeps WhatsApp provenance ahead of a stray voice-session association', () => {
    expect(resolveSynapseHistoryChannel(
      {
        id: 'shared-id',
        title: 'WhatsApp Business - Paciente',
        context_state: { source: 'whatsapp' },
      },
      new Set(['shared-id']),
    )).toBe('whatsapp');
  });
});
