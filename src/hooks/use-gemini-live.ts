import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGeminiVoice } from "@/hooks/use-gemini-voice";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import type { GeminiLiveStatus } from "@/lib/gemini-live-client";
import {
  executeSynapseInterfaceAction,
  normalizeSynapseClientAction,
} from "@/lib/synapse-interface-actions";

type ClientToolMap = Record<string, (params: unknown) => Promise<unknown> | unknown>;

const SYNAPSE_GLOBAL_VOICE_PROMPT = [
  "Voce e o Synapse AI, assistente operacional inteligente da NeuroNex AI.",
  "Fale sempre em portugues brasileiro, com vocabulario e construcao natural do Brasil.",
  "Responda por voz com frases curtas, humanas e uteis.",
  "Nunca cite fornecedores, APIs, modelos, banco de dados, rotas, JSON, IDs ou infraestrutura.",
  "Use ferramentas apenas quando precisar de dados reais ou executar acoes no sistema.",
  "Antes de acoes sensiveis, confirme de forma clara e execute somente apos confirmacao.",
].join(" ");

interface UseGeminiLiveOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onClientAction?: (action: unknown) => void;
}

export function useGeminiLive(options?: UseGeminiLiveOptions) {
  const navigate = useNavigate();
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
  } = useVoiceConfig();

  const voice = useGeminiVoice({
    token: null,
    language: "pt-BR",
    provider,
    gatewayUrl,
    sessionId,
    conversationId,
    voiceSessionId,
    systemInstruction: SYNAPSE_GLOBAL_VOICE_PROMPT,
    onClientAction: (rawAction) => {
      optionsRef.current?.onClientAction?.(rawAction);
      const action = normalizeSynapseClientAction(rawAction);
      if (!action) return;

      // Navigation and speech can overlap; the gateway keeps the voice session active.
      void executeSynapseInterfaceAction(action, {
        navigate,
        channel: "voice",
      });
    },
  });

  const status = useMemo<GeminiLiveStatus>(() => {
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

  const startSession = useCallback(async (_args?: { clientTools?: ClientToolMap }) => {
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
