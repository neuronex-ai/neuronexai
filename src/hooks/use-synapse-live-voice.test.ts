import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSynapseLiveVoice } from './use-synapse-live-voice';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  executeAction: vi.fn().mockResolvedValue({
    success: true,
    action: 'navigate',
    message: 'Ação concluída.',
    durationMs: 12,
  }),
  voiceOptions: null as null | { onClientAction?: (action: unknown) => Promise<unknown> },
  voice: {} as Record<string, unknown>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/context/AIContext', () => ({
  useAI: () => ({ currentContext: 'notes', activePatientId: 'patient-1', contextSummary: 'Resumo' }),
}));

vi.mock('@/hooks/use-voice-config', () => ({
  useVoiceConfig: () => ({
    isLoading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue({}),
    provider: 'deepgram-agent',
    gatewayUrl: 'ws://localhost',
    sessionId: null,
    conversationId: null,
    voiceSessionId: null,
    inputSampleRate: 48000,
    outputSampleRate: 24000,
  }),
}));

vi.mock('@/hooks/use-synapse-voice', () => ({
  useSynapseVoice: (options: { onClientAction?: (action: unknown) => Promise<unknown> }) => {
    mocks.voiceOptions = options;
    return mocks.voice;
  },
}));

vi.mock('@/lib/synapse-interface-actions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/synapse-interface-actions')>('@/lib/synapse-interface-actions');
  return {
    ...actual,
    executeSynapseInterfaceAction: (...args: unknown[]) => mocks.executeAction(...args),
    normalizeSynapseClientAction: (action: unknown) => action,
    isCurrentCancelledSynapseAction: () => false,
  };
});

describe('useSynapseLiveVoice navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.voiceOptions = null;
    mocks.voice = {
      error: null,
      isConnected: true,
      isProcessing: false,
      isSpeaking: false,
      isToolActive: true,
      voicePhase: 'tool_active',
      activeTool: { id: 'tool-1', name: 'analyze_neuroview_patient_patterns', startedAt: Date.now() },
      activeToolLabel: 'Análise NeuroView',
      activeToolMessage: '',
      activeToolElapsedMs: 0,
      lastFunctionStatus: null,
      getAudioVolume: () => 0,
      getInputAudioSignal: () => ({ rms: 0, low: 0, mid: 0, high: 0 }),
      getOutputAudioSignal: () => ({ rms: 0, low: 0, mid: 0, high: 0 }),
      startSession: vi.fn(),
      endSession: vi.fn(),
    };
  });

  it('does not navigate from speculative tool activity', () => {
    renderHook(() => useSynapseLiveVoice());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it('executes navigation only after a definitive client action arrives and returns its ACK', async () => {
    renderHook(() => useSynapseLiveVoice());
    const action = { type: 'navigate', payload: { path: '/notas' } };
    const result = await mocks.voiceOptions?.onClientAction?.(action);
    expect(mocks.executeAction).toHaveBeenCalledWith(action, expect.objectContaining({ channel: 'voice' }));
    expect(result).toMatchObject({ success: true, action: 'navigate' });
  });
});
