import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAI } from "@/context/AIContext";
import { useSynapseVoice } from "@/hooks/use-synapse-voice";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import { useTheme } from "@/hooks/use-theme";
import {
  executeSynapseInterfaceAction,
  isCurrentCancelledSynapseAction,
  normalizeSynapseClientAction,
  type SynapseActionLifecycleEvent,
} from "@/lib/synapse-interface-actions";
import {
  parseAppointmentPlanReviewAction,
  requestAppointmentPlanReview,
} from "@/lib/appointment-plan-review";
import { loadPendingVoiceActionReview } from "@/lib/synapse-pending-action-review";
import {
  resolveSynapseThemeTarget,
  synapseThemeDirectiveFromAction,
} from "@/lib/synapse-theme-directive";
import {
  emitVoiceReviewAction,
  normalizeVoiceReviewAction,
} from "@/lib/synapse-voice-ui-protocol";

type SynapseLiveVoiceStatus = "disconnected" | "connecting" | "connected" | "disconnecting" | "error";

const SYNAPSE_GLOBAL_VOICE_PROMPT =
  "Converse em português brasileiro natural e seja breve. Para mutações use o planejador e preserve a revisão. SMOKE VISUAL: se eu disser 'mostrar mini-cards', chame prepare_action_group imediatamente, sem consultas, com 2 steps: note_module_create {name:'Teste Synapse - mini-cards'} e task_create {title:'Validar mini-cards do Synapse'}; use intent smoke_action_group_review e pare na revisão, sem confirmar nem executar. NeuroFlow e NeuroPulse só quando pedidos explicitamente.";

interface UseSynapseLiveVoiceOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onClientAction?: (action: unknown) => void;
  onActionLifecycle?: (event: SynapseActionLifecycleEvent | null) => void;
}

export function useSynapseLiveVoice(options?: UseSynapseLiveVoiceOptions) {
  const navigate = useNavigate();
  const { theme, transitionToTheme } = useTheme();
  const { currentContext, activePatientId, contextSummary } = useAI();
  const voiceContext = useMemo(() => ({
    currentContext,
    activePatientId,
    contextSummary,
  }), [activePatientId, contextSummary, currentContext]);
  const connectedRef = useRef(false);
  const activeLifecycleIdRef = useRef<string | null>(null);
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
    trackAudioIntensity: false,
    onClientAction: async (rawAction) => {
      try {
        optionsRef.current?.onClientAction?.(rawAction);
      } catch (error) {
        console.warn("[Synapse Voice] client action observer failed", error);
      }

      // Action-group reviews are a voice UI protocol, not a navigation action.
      // The Edge gateway already waits for this client-action ACK; emitting the
      // review here makes the horizontal cards visible while preserving the
      // pending server-side confirmation record.
      const actionReview = normalizeVoiceReviewAction(rawAction);
      if (actionReview?.type === "synapse_action_review") {
        emitVoiceReviewAction(actionReview);
        return {
          success: true,
          action: "review_action_group",
          message: "Revisão do grupo aberta nos cards.",
          durationMs: 0,
        };
      }
      if (actionReview?.type === "synapse_action_review_dismiss") {
        emitVoiceReviewAction(actionReview);
        return {
          success: true,
          action: "review_action_group",
          message: "Revisão do grupo encerrada.",
          durationMs: 0,
        };
      }

      const appointmentPlan = parseAppointmentPlanReviewAction(rawAction);
      if (appointmentPlan) {
        requestAppointmentPlanReview(appointmentPlan);
        return {
          success: true,
          action: "review_appointment_plan",
          message: "Plano aberto para revisão no painel.",
          durationMs: 0,
        };
      }
      const action = normalizeSynapseClientAction(rawAction);
      if (!action) {
        return {
          success: false,
          action: "navigate",
          message: "A interface recebeu uma acao invalida.",
          durationMs: 0,
        };
      }

      const themeDirective = synapseThemeDirectiveFromAction(action);
      if (themeDirective) {
        const targetTheme = resolveSynapseThemeTarget(themeDirective, theme);
        if (targetTheme !== theme) transitionToTheme(targetTheme);
        return {
          success: true,
          action: "navigate",
          message: `Tema alterado para modo ${targetTheme === "dark" ? "escuro" : "claro"}.`,
          durationMs: 0,
        };
      }

      // Navigation and speech can overlap; the gateway keeps the voice session active.
      const result = await executeSynapseInterfaceAction(action, {
        navigate,
        channel: "voice",
        onLifecycle: (event) => {
          activeLifecycleIdRef.current = event.id;
          optionsRef.current?.onActionLifecycle?.(event);
        },
      });
      if (isCurrentCancelledSynapseAction(result, activeLifecycleIdRef.current)) {
        activeLifecycleIdRef.current = null;
        optionsRef.current?.onActionLifecycle?.(null);
      }
      return result;
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
    if (!conversationId) return;
    let cancelled = false;
    void loadPendingVoiceActionReview(conversationId)
      .then((review) => {
        if (!cancelled && review) emitVoiceReviewAction(review);
      })
      .catch((error) => {
        console.warn("[Synapse Voice] pending review recovery failed", error);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

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
  const activeTool = "activeTool" in voice ? voice.activeTool : null;

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
    activeTool,
    lastFunctionStatus,
    getInputVolume: voice.getAudioVolume,
    getInputAudioSignal: voice.getInputAudioSignal,
    getOutputAudioSignal: voice.getOutputAudioSignal,
    startSession,
    endSession,
  };
}