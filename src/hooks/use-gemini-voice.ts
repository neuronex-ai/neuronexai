import { useCallback, useMemo, useState } from "react";
import { useDeepgramAgentVoice } from "@/hooks/use-deepgram-agent-voice";
import { useSynapseCascadeVoice } from "@/hooks/use-synapse-cascade-voice";

type ClientAction = { type?: string; payload?: unknown; data?: unknown };
type SynapseVoiceProvider = "deepgram-agent" | "legacy-cascade";

const DEFAULT_PROVIDER: SynapseVoiceProvider = "deepgram-agent";
const LEGACY_PROVIDER: SynapseVoiceProvider = "legacy-cascade";
const legacyCascadeEnabled = () => import.meta.env.VITE_SYNAPSE_LEGACY_CASCADE_ENABLED === "true";

const normalizeProvider = (provider?: string | null): SynapseVoiceProvider =>
  provider === LEGACY_PROVIDER ? LEGACY_PROVIDER : DEFAULT_PROVIDER;

interface UseGeminiVoiceOptions {
  token: string | null;
  model?: string;
  systemInstruction?: string;
  voiceName?: string;
  gatewayUrl?: string | null;
  provider?: string | null;
  language?: string;
  sessionId?: string | null;
  onSessionIdChange?: (sessionId: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponseText?: (text: string) => void;
  onAudioIntensity?: (intensity: number) => void;
  onClientAction?: (action: ClientAction) => void;
}

export function useGeminiVoice(options: UseGeminiVoiceOptions) {
  const [forcedLegacy, setForcedLegacy] = useState(false);
  const preferredProvider = normalizeProvider(options.provider || import.meta.env.VITE_SYNAPSE_VOICE_PROVIDER);
  const canUseLegacyCascade = legacyCascadeEnabled();
  const shouldUseLegacyCascade = canUseLegacyCascade && (forcedLegacy || preferredProvider === LEGACY_PROVIDER);

  const deepgram = useDeepgramAgentVoice({
    gatewayUrl: options.gatewayUrl,
    sessionId: options.sessionId,
    systemInstruction: options.systemInstruction,
    language: options.language,
    onSessionIdChange: options.onSessionIdChange,
    onSpeakingStart: options.onSpeakingStart,
    onSpeakingEnd: options.onSpeakingEnd,
    onTranscript: options.onTranscript,
    onResponseText: options.onResponseText,
    onAudioIntensity: options.onAudioIntensity,
    onClientAction: options.onClientAction,
  });

  const cascade = useSynapseCascadeVoice({
    enabled: canUseLegacyCascade,
    sessionId: options.sessionId,
    onSessionIdChange: options.onSessionIdChange,
    onSpeakingStart: options.onSpeakingStart,
    onSpeakingEnd: options.onSpeakingEnd,
    onTranscript: options.onTranscript,
    onResponseText: options.onResponseText,
    onAudioIntensity: options.onAudioIntensity,
    onClientAction: options.onClientAction,
  });
  const deepgramStartSession = deepgram.startSession;
  const deepgramEndSession = deepgram.endSession;
  const cascadeStartSession = cascade.startSession;
  const cascadeEndSession = cascade.endSession;

  const startSession = useCallback(async (_override?: {
    token?: string | null;
    model?: string;
    voiceName?: string;
    gatewayUrl?: string | null;
    provider?: string | null;
    sessionId?: string | null;
  }) => {
    const provider = normalizeProvider(_override?.provider || preferredProvider);

    if (provider === LEGACY_PROVIDER) {
      if (!legacyCascadeEnabled()) {
        throw new Error("legacy-cascade esta isolado. Defina VITE_SYNAPSE_LEGACY_CASCADE_ENABLED=true somente para rollback diagnostico.");
      }
      setForcedLegacy(true);
      await cascadeStartSession();
      return;
    }

    setForcedLegacy(false);
    await deepgramStartSession({ ..._override, provider: DEFAULT_PROVIDER });
  }, [cascadeStartSession, deepgramStartSession, preferredProvider]);

  const endSession = useCallback(() => {
    deepgramEndSession();
    cascadeEndSession();
    setForcedLegacy(false);
  }, [cascadeEndSession, deepgramEndSession]);

  const active = shouldUseLegacyCascade ? cascade : deepgram;

  const provider = useMemo(() => {
    if (shouldUseLegacyCascade) return cascade.provider;
    return deepgram.provider;
  }, [cascade.provider, deepgram.provider, shouldUseLegacyCascade]);

  const voicePhase = "voicePhase" in active ? active.voicePhase : active.isConnected ? "listening" : "idle";
  const activeTool = "activeTool" in active ? active.activeTool : null;
  const activeToolLabel = "activeToolLabel" in active ? active.activeToolLabel : "";
  const activeToolMessage = "activeToolMessage" in active ? active.activeToolMessage : "";
  const activeToolElapsedMs = "activeToolElapsedMs" in active ? active.activeToolElapsedMs : 0;
  const isToolActive = "isToolActive" in active ? active.isToolActive : false;
  const lastFunctionStatus = "lastFunctionStatus" in active ? active.lastFunctionStatus : null;

  return {
    ...active,
    startSession,
    endSession,
    provider,
    voicePhase,
    activeTool,
    activeToolLabel,
    activeToolMessage,
    activeToolElapsedMs,
    isToolActive,
    lastFunctionStatus,
  };
}
