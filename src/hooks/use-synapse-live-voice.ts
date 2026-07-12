import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAI } from "@/context/AIContext";
import { useSynapseVoice } from "@/hooks/use-synapse-voice";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import {
  executeSynapseInterfaceAction,
  normalizeSynapseClientAction,
  type SynapseActionLifecycleEvent,
} from "@/lib/synapse-interface-actions";

type SynapseLiveVoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting" | "error";

const SYNAPSE_GLOBAL_VOICE_PROMPT =
  "Converse em português brasileiro natural e seja breve. Consulte e navegue quando necessário. Ao receber um pedido explícito, pode preparar NeuroFlow ou NeuroPulse com as ferramentas disponíveis, sempre pedindo a confirmação exigida antes de gravar.";

interface UseSynapseLiveVoiceOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onClientAction?: (action: unknown) => void;
  onActionLifecycle?: (event: SynapseActionLifecycleEvent) => void;
}

export function useSynapseLiveVoice(options?: UseSynapseLiveVoiceOptions) {
  const navigate = useNavigate();
  const { currentContext, activePatientId, contextSummary } = useAI();
  const voiceContext = useMemo(() => ({
    currentContext,
    activePatientId,
    contextSummary,
  }), [activePatientId, contextSummary, currentContext]);
  const connectedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const {
    isLoading: isVoiceConfigLoading,
    error: voiceConfigError,
    refresh: refreshVoiceConfig,
    provider,
    gatewayUrl,
    sessionId,
    conversationId,
    voiceSessionId,
    inputSampleRate,
    outputSampleRate,
  } = useVoiceConfig();

  const voice = useSynapseVoice({
    token: null,
    language: "pt-BR",
    provider,
    gatewayUrl,
    sessionId,
    conversationId,
    voiceSessionId,
    inputSampleRate,
    outputSampleRate,
    systemInstruction: SYNAPSE_GLOBAL_VOICE_PROMPT,
    context: voiceContext,
    onClientAction: (rawAction) => {
      optionsRef.current?.onClientAction?.(rawAction);
      const action = normalizeSynapseClientAction(rawAction);
      if (!action) return;

      // Navigation and speech can overlap; the gateway keeps the voice session active.
      void executeSynapseInterfaceAction(action, {
        navigate,
        channel: "voice",
        onLifecycle: optionsRef.current?.onActionLifecycle,
      });
    },
  });

  const status = useMemo<SynapseLiveVoiceStatus>(() => {
    if (voice.error || voiceConfigError) return "error";
    if (voice.isConnected) return "connected";
    if (voice.isProcessing || isVoiceConfigLoading) return "connecting";
    return "disconnected";
  }, [isVoiceConfigLoading, voice.error, voice.isConnected, voice.isProcessing, voiceConfigError]);

  useEffect(() => {
    const error = voice.error || voiceConfigError;
    if (error) optionsRef.current?.onError?.(error);
  }, [voice.error, voiceConfigError]);

  useEffect(() => {
    if (voice.isConnected && !connectedRef.current) {
      connectedRef.current = true;
      optionsRef.current?.onConnect?.();
      return;
    }

    if (!voice.isConnected && connectedRef.current) {
      connectedRef.current = false;
      optionsRef.current?.onDisconnect?.();
    }
  }, [voice.isConnected]);

  const voiceStartSession = voice.startSession;
  const voiceEndSession = voice.endSession;
  const voicePhase = "voicePhase" in voice ? voice.voicePhase : status === "connected" ? "listening" : status;
  const isToolActive = "isToolActive" in voice ? Boolean(voice.isToolActive) : false;
  const activeToolLabel = "activeToolLabel" in voice ? String(voice.activeToolLabel || "") : "";
  const activeToolMessage = "activeToolMessage" in voice ? String(voice.activeToolMessage || "") : "";
  const activeToolElapsedMs = "activeToolElapsedMs" in voice ? Number(voice.activeToolElapsedMs || 0) : 0;
  const lastFunctionStatus = "lastFunctionStatus" in voice ? voice.lastFunctionStatus : null;

  const startSession = useCallback(async () => {
    const config = await refreshVoiceConfig();
    await voiceStartSession({
      token: config.token,
      model: config.model,
      voiceName: config.voiceName,
      gatewayUrl: config.gatewayUrl,
      provider: config.provider,
      sessionId: config.sessionId,
      conversationId: config.conversationId,
      voiceSessionId: config.voiceSessionId,
      inputSampleRate: config.inputSampleRate,
      outputSampleRate: config.outputSampleRate,
    });
  }, [refreshVoiceConfig, voiceStartSession]);

  const endSession = useCallback(async () => {
    voiceEndSession();
  }, [voiceEndSession]);

  return {
    status,
    isSpeaking: voice.isSpeaking,
    voicePhase,
    isToolActive,
    activeToolLabel,
    activeToolMessage,
    activeToolElapsedMs,
    lastFunctionStatus,
    getInputVolume: voice.getAudioVolume,
    startSession,
    endSession,
  };
}
