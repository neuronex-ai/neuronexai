import { useCallback } from "react";
import { useDeepgramAgentVoice } from "@/hooks/use-deepgram-agent-voice";
import type { SynapseVoiceStartOverride } from "@/types/synapse-voice";

type ClientAction = { type?: string; payload?: unknown; data?: unknown };
type ClientActionExecutionResult = {
  success: boolean;
  action?: string;
  message?: string;
  durationMs?: number;
  cancelled?: boolean;
};
type SynapseVoiceProvider = "deepgram-agent";

const DEFAULT_PROVIDER: SynapseVoiceProvider = "deepgram-agent";

const isSupportedProvider = (provider?: string | null) =>
  !provider || provider === DEFAULT_PROVIDER;

interface UseSynapseVoiceOptions {
  token: string | null;
  model?: string;
  systemInstruction?: string;
  voiceName?: string;
  gatewayUrl?: string | null;
  provider?: string | null;
  language?: string;
  sessionId?: string | null;
  conversationId?: string | null;
  voiceSessionId?: string | null;
  inputSampleRate?: number;
  outputSampleRate?: number;
  context?: Record<string, unknown>;
  onSessionIdChange?: (sessionId: string) => void;
  onConversationIdChange?: (conversationId: string) => void;
  onVoiceSessionIdChange?: (voiceSessionId: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponseText?: (text: string) => void;
  onAudioIntensity?: (intensity: number) => void;
  onClientAction?: (
    action: ClientAction,
  ) => ClientActionExecutionResult | Promise<ClientActionExecutionResult>;
  trackAudioIntensity?: boolean;
}

export function useSynapseVoice(options: UseSynapseVoiceOptions) {
  const preferredProvider = options.provider || DEFAULT_PROVIDER;
  const deepgram = useDeepgramAgentVoice({
    gatewayUrl: options.gatewayUrl,
    sessionId: options.sessionId,
    conversationId: options.conversationId,
    voiceSessionId: options.voiceSessionId,
    inputSampleRate: options.inputSampleRate,
    outputSampleRate: options.outputSampleRate,
    context: options.context,
    systemInstruction: options.systemInstruction,
    language: options.language,
    onSessionIdChange: options.onSessionIdChange,
    onConversationIdChange: options.onConversationIdChange,
    onVoiceSessionIdChange: options.onVoiceSessionIdChange,
    onSpeakingStart: options.onSpeakingStart,
    onSpeakingEnd: options.onSpeakingEnd,
    onTranscript: options.onTranscript,
    onResponseText: options.onResponseText,
    onAudioIntensity: options.onAudioIntensity,
    onClientAction: options.onClientAction,
    trackAudioIntensity: options.trackAudioIntensity,
  });
  const deepgramStartSession = deepgram.startSession;
  const deepgramEndSession = deepgram.endSession;

  const startSession = useCallback(async (_override?: SynapseVoiceStartOverride) => {
    const provider = _override?.provider || preferredProvider;
    if (!isSupportedProvider(provider)) {
      throw new Error("Nao consegui preparar o canal de voz do Synapse.");
    }
    await deepgramStartSession({ ..._override, provider: DEFAULT_PROVIDER });
  }, [deepgramStartSession, preferredProvider]);

  const endSession = useCallback(() => {
    deepgramEndSession();
  }, [deepgramEndSession]);

  return {
    ...deepgram,
    startSession,
    endSession,
    provider: deepgram.provider,
    voicePhase: deepgram.voicePhase,
    activeTool: deepgram.activeTool,
    activeToolLabel: deepgram.activeToolLabel,
    activeToolMessage: deepgram.activeToolMessage,
    activeToolElapsedMs: deepgram.activeToolElapsedMs,
    isToolActive: deepgram.isToolActive,
    lastFunctionStatus: deepgram.lastFunctionStatus,
  };
}
