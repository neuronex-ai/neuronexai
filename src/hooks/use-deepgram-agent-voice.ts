import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analysePcm16, PcmAudioPlayer, SILENT_PCM_SIGNAL, type PcmAudioSignal } from "@/lib/pcm-audio-player";
import {
  SYNAPSE_ACTION_GROUP_EDIT_REQUEST_EVENT,
  SYNAPSE_OPAQUE_CAPTURE_BLOCK_EVENT,
  emitActionGroupEditResult,
  emitVoiceReviewAction,
  type SynapseActionGroupEditRequest,
  type SynapseOpaqueCaptureBlock,
} from "@/lib/synapse-voice-ui-protocol";
import type {
  SynapseVoiceFunctionStatus,
  SynapseVoicePhase,
  SynapseVoiceStartOverride,
  SynapseVoiceToolState,
} from "@/types/synapse-voice";

type ClientAction = { type?: string; payload?: unknown; data?: unknown };
type ClientActionExecutionResult = {
  success: boolean;
  action?: string;
  message?: string;
  durationMs?: number;
  cancelled?: boolean;
};
type PendingStart = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

interface Options {
  gatewayUrl?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  voiceSessionId?: string | null;
  inputSampleRate?: number;
  outputSampleRate?: number;
  systemInstruction?: string;
  language?: string;
  context?: Record<string, unknown>;
  onSessionIdChange?: (id: string) => void;
  onConversationIdChange?: (id: string) => void;
  onVoiceSessionIdChange?: (id: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponseText?: (text: string) => void;
  onClientAction?: (
    action: ClientAction,
  ) => ClientActionExecutionResult | Promise<ClientActionExecutionResult>;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onAudioIntensity?: (intensity: number) => void;
  trackAudioIntensity?: boolean;
}

const DEFAULT_GATEWAY_URL = "ws://localhost:8789/v1/synapse/voice";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

const isLocalBrowserRuntime = () => {
  if (typeof window === "undefined") return import.meta.env.DEV;
  if (import.meta.env.DEV) return true;
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname);
};

const localBrowserGatewayUrl = () => {
  if (typeof window === "undefined") return DEFAULT_GATEWAY_URL;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/v1/synapse/voice`;
};

const userFacingVoiceError = (errorType: unknown, rawError: unknown) => {
  const type = clean(errorType, 80);
  const message = clean(rawError, 1000);

  if (/auth|permission/i.test(type) || /sess[aã]o|token|auth|unauthorized|401|403/i.test(message)) {
    return "Sua sessao expirou. Entre novamente para usar o Synapse por voz.";
  }
  if (/microfone|microphone|getUserMedia|permission denied|notallowed/i.test(message)) {
    return "Nao consegui acessar o microfone. Verifique a permissao do navegador e tente novamente.";
  }
  if (/config|provider|gateway|network|voice|socket|deepgram|eleven|api[_ -]?key|secret/i.test(`${type} ${message}`)) {
    return "Nao consegui iniciar a voz do Synapse agora. Verifique a conexao e tente novamente.";
  }
  return message || "Nao consegui continuar a conversa por voz. Tente reiniciar a sessao.";
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const gatewayUrlFromEnv = () => {
  if (isLocalBrowserRuntime()) {
    return localBrowserGatewayUrl();
  }
  return "";
};

const normalizeSampleRate = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 8000 && parsed <= 96000 ? Math.round(parsed) : fallback;
};

const parseMessage = (value: unknown) => {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const eventText = (event: Record<string, unknown>) => clean(
  event.content || event.text || event.transcript || event.message,
  20000,
);

const eventRole = (event: Record<string, unknown>) => clean(
  event.role || event.speaker || (event.channel as Record<string, unknown> | undefined)?.role,
  40,
).toLowerCase();

const phaseFromToolStatus = (status: string): SynapseVoicePhase => {
  if (status === "confirmation_required") return "awaiting_confirmation";
  if (status === "retrying") return "tool_retrying";
  if (status === "cancelling") return "tool_cancelling";
  return "tool_active";
};

const TOOL_LABELS: Record<string, string> = {
  navigate_system: "Navegação",
  search_patients: "Busca de paciente",
  list_patients: "Lista de pacientes",
  get_patient_details: "Prontuário",
  report_all_patients: "Resumo de pacientes",
  search_clinical_history: "Histórico clínico",
  generate_patient_insights: "Insights clínicos",
  suggest_treatment_approach: "Plano terapêutico",
  detect_risk_patterns: "Análise de risco",
  get_calendar: "Agenda",
  create_appointment: "Novo agendamento",
  reschedule_appointment: "Remarcação",
  cancel_appointment: "Cancelamento",
  find_available_slots: "Horários disponíveis",
  create_patient: "Cadastro de paciente",
  update_patient_info: "Atualização do paciente",
  add_patient_medication: "Medicação",
  create_session_note: "Nota clínica",
  send_whatsapp_message: "WhatsApp",
  read_whatsapp_conversations: "Conversas do WhatsApp",
  send_email: "E-mail",
  draft_email: "Rascunho de e-mail",
  get_financial_metrics: "Resumo financeiro",
  list_transactions: "Lançamentos financeiros",
  create_transaction: "Lançamento financeiro",
  generate_financial_report: "Relatório financeiro",
  send_payment_reminder: "Lembrete de pagamento",
  draft_invoice: "Cobrança",
  generate_document: "Documento",
  draft_official_document: "Documento oficial",
  search_medical_articles: "Referências clínicas",
  search_cid10: "CID-10",
  get_medication_info: "Informações de medicação",
  get_latest_scientific_updates: "Atualizações científicas",
  search_normative_docs: "Normas profissionais",
  analyze_neuroview_patient_patterns: "Análise no NeuroView",
  create_neuroflow_from_patient_history: "Criação no NeuroFlow",
  create_neuropulse_cause_effect_diagram: "Diagrama no NeuroPulse",
  prepare_action_group: "Preparando ações",
  execute_action_group: "Executando ações",
  manage_action_group: "Revisão protegida",
  confirm_pending_action: "Confirmação da ação",
  cancel_pending_action: "Cancelamento da ação",
};

const toHumanToolLabel = (value: unknown) => {
  const raw = clean(value, 160);
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (TOOL_LABELS[key]) return TOOL_LABELS[key];
  if (/appointment|calendar|agenda/i.test(raw)) return "Agenda";
  if (/patient|paciente|clinical|history/i.test(raw)) return "Paciente";
  if (/finance|invoice|payment|transaction/i.test(raw)) return "Financeiro";
  if (/document|note|prontuario/i.test(raw)) return "Documento";
  if (!raw || /[_{}[\]"]/.test(raw) || /^[a-z0-9_\s-]+$/i.test(raw)) return "Ação do Synapse";
  return raw;
};

const sanitizeToolMessage = (value: unknown) => clean(value, 800)
  .replace(/[{}[\]"]/g, "")
  .replace(/\b(?:payload|params|tool|endpoint|json|uuid|session_id|clientAction|function_call)\b/gi, "")
  .replace(/\b[a-z]+(?:_[a-z0-9]+){1,}\b/gi, "ação")
  .replace(/\s+/g, " ")
  .trim();

export function useDeepgramAgentVoice({
  gatewayUrl,
  sessionId,
  conversationId,
  voiceSessionId,
  inputSampleRate,
  outputSampleRate,
  systemInstruction,
  language = "pt-BR",
  context,
  onSessionIdChange,
  onConversationIdChange,
  onVoiceSessionIdChange,
  onTranscript,
  onResponseText,
  onClientAction,
  onSpeakingStart,
  onSpeakingEnd,
  onAudioIntensity,
  trackAudioIntensity = true,
}: Options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voicePhase, setVoicePhase] = useState<SynapseVoicePhase>("idle");
  const [activeTool, setActiveTool] = useState<SynapseVoiceToolState | null>(null);
  const [lastFunctionStatus, setLastFunctionStatus] = useState<SynapseVoiceFunctionStatus | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || sessionId || null);
  const [currentVoiceSessionId, setCurrentVoiceSessionId] = useState<string | null>(voiceSessionId || null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const playerRef = useRef<PcmAudioPlayer | null>(null);
  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const listeningRef = useRef(false);
  const volumeRef = useRef(0);
  const inputSignalRef = useRef<PcmAudioSignal>(SILENT_PCM_SIGNAL);
  const firstInputFrameLoggedRef = useRef(false);
  const opaqueCaptureBlockedRef = useRef(false);
  const lastAudioStateUpdateRef = useRef(0);
  const sessionIdRef = useRef<string | null>(sessionId || null);
  const conversationIdRef = useRef<string | null>(conversationId || sessionId || null);
  const voiceSessionIdRef = useRef<string | null>(voiceSessionId || null);
  const activeToolRef = useRef<SynapseVoiceToolState | null>(null);
  const pendingStartRef = useRef<PendingStart | null>(null);
  const startingPromiseRef = useRef<Promise<void> | null>(null);
  const targetInputSampleRate = normalizeSampleRate(inputSampleRate, 48000);
  const targetOutputSampleRate = normalizeSampleRate(outputSampleRate, 24000);
  const inputSampleRateRef = useRef(targetInputSampleRate);
  const outputSampleRateRef = useRef(targetOutputSampleRate);
  const callbacksRef = useRef({
    onSessionIdChange,
    onConversationIdChange,
    onVoiceSessionIdChange,
    onTranscript,
    onResponseText,
    onClientAction,
    onSpeakingStart,
    onSpeakingEnd,
    onAudioIntensity,
  });

  callbacksRef.current = {
    onSessionIdChange,
    onConversationIdChange,
    onVoiceSessionIdChange,
    onTranscript,
    onResponseText,
    onClientAction,
    onSpeakingStart,
    onSpeakingEnd,
    onAudioIntensity,
  };

  useEffect(() => {
    inputSampleRateRef.current = targetInputSampleRate;
    outputSampleRateRef.current = targetOutputSampleRate;
  }, [targetInputSampleRate, targetOutputSampleRate]);

  useEffect(() => {
    const nextConversationId = conversationId || sessionId || null;
    if (!nextConversationId) return;
    sessionIdRef.current = nextConversationId;
    conversationIdRef.current = nextConversationId;
    setCurrentConversationId(nextConversationId);
  }, [conversationId, sessionId]);

  useEffect(() => {
    if (!voiceSessionId) return;
    voiceSessionIdRef.current = voiceSessionId;
    setCurrentVoiceSessionId(voiceSessionId);
  }, [voiceSessionId]);

  useEffect(() => {
    const onOpaqueCaptureBlock = (event: Event) => {
      const detail = (event as CustomEvent<SynapseOpaqueCaptureBlock>).detail;
      opaqueCaptureBlockedRef.current = Boolean(detail?.blocked);
      if (detail?.blocked) {
        console.info("[Synapse Voice] Deepgram microphone forwarding paused for opaque confirmation");
      }
    };
    window.addEventListener(SYNAPSE_OPAQUE_CAPTURE_BLOCK_EVENT, onOpaqueCaptureBlock as EventListener);
    return () => {
      window.removeEventListener(SYNAPSE_OPAQUE_CAPTURE_BLOCK_EVENT, onOpaqueCaptureBlock as EventListener);
      opaqueCaptureBlockedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onActionGroupEditRequest = (event: Event) => {
      const detail = (event as CustomEvent<SynapseActionGroupEditRequest>).detail;
      if (!detail?.reviewId || !detail?.planId || !detail?.planVersion || !detail?.planHash || !detail?.stepId || !detail?.fieldId) {
        return;
      }
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !readyRef.current) {
        emitActionGroupEditResult({
          reviewId: detail.reviewId,
          stepId: detail.stepId,
          fieldId: detail.fieldId,
          success: false,
          message: "A conexão de voz ainda não está pronta para atualizar esta revisão.",
        });
        return;
      }
      socket.send(JSON.stringify({
        type: "action_group_edit_request",
        requestId: globalThis.crypto?.randomUUID?.() || `action-edit-${Date.now()}`,
        reviewId: detail.reviewId,
        planId: detail.planId,
        planVersion: detail.planVersion,
        planHash: detail.planHash,
        stepId: detail.stepId,
        fieldId: detail.fieldId,
        value: detail.value,
      }));
    };
    window.addEventListener(SYNAPSE_ACTION_GROUP_EDIT_REQUEST_EVENT, onActionGroupEditRequest as EventListener);
    return () => window.removeEventListener(SYNAPSE_ACTION_GROUP_EDIT_REQUEST_EVENT, onActionGroupEditRequest as EventListener);
  }, []);

  useEffect(() => {
    if (!activeTool) return undefined;
    const timer = window.setInterval(() => setElapsedTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTool]);

  const setLevel = useCallback((level: number, signal?: PcmAudioSignal) => {
    volumeRef.current = level;
    inputSignalRef.current = signal || (level === 0 ? SILENT_PCM_SIGNAL : inputSignalRef.current);
    const now = performance.now();
    const shouldPublish = level === 0 || now - lastAudioStateUpdateRef.current >= 80;
    if (!shouldPublish) return;
    lastAudioStateUpdateRef.current = now;
    if (trackAudioIntensity) setAudioIntensity(level);
    callbacksRef.current.onAudioIntensity?.(level);
  }, [trackAudioIntensity]);

  const setActiveToolState = useCallback((tool: SynapseVoiceToolState | null) => {
    activeToolRef.current = tool;
    setActiveTool(tool);
    setElapsedTick(Date.now());
  }, []);

  const resolvePendingStart = useCallback(() => {
    const pending = pendingStartRef.current;
    if (!pending) return;
    pendingStartRef.current = null;
    window.clearTimeout(pending.timeoutId);
    pending.resolve();
  }, []);

  const rejectPendingStart = useCallback((error: Error) => {
    const pending = pendingStartRef.current;
    if (!pending) return;
    pendingStartRef.current = null;
    window.clearTimeout(pending.timeoutId);
    pending.reject(error);
  }, []);

  const buildToolState = useCallback((
    payload: Record<string, unknown>,
    status: SynapseVoiceFunctionStatus | string,
  ): SynapseVoiceToolState => {
    const source = (
      payload.activeTool && typeof payload.activeTool === "object"
        ? payload.activeTool
        : payload
    ) as Record<string, unknown>;
    const existing = activeToolRef.current;
    const startedAt = toNumber(source.startedAt, existing?.startedAt || Date.now());
    const elapsedMs = toNumber(source.elapsedMs, Math.max(0, Date.now() - startedAt));
    const name = clean(source.name || existing?.name || "synapse_tool", 120);
    const label = toHumanToolLabel(source.label || existing?.label || name);
    const message = sanitizeToolMessage(source.message || existing?.message || "");
    const confirmationRequired = Boolean(source.confirmationRequired || existing?.confirmationRequired);

    return {
      id: clean(source.id || existing?.id || "synapse-tool", 120),
      name,
      label,
      message,
      status,
      startedAt,
      elapsedMs,
      confirmationRequired,
    };
  }, []);

  const applyRestingPhase = useCallback(() => {
    const tool = activeToolRef.current;
    if (tool) {
      setIsProcessing(true);
      setVoicePhase(phaseFromToolStatus(String(tool.status)));
      return;
    }
    setIsProcessing(false);
    if (readyRef.current && listeningRef.current) {
      setVoicePhase("listening");
    } else if (activeRef.current) {
      setVoicePhase("connecting");
    } else {
      setVoicePhase("idle");
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playerRef.current?.stop();
    setIsSpeaking(false);
  }, []);

  const cleanupInput = useCallback(async () => {
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (inputContextRef.current && inputContextRef.current.state !== "closed") {
      await inputContextRef.current.close();
    }
    workletRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;
    streamRef.current = null;
    inputContextRef.current = null;
    firstInputFrameLoggedRef.current = false;
    setLevel(0);
  }, [setLevel]);

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new PcmAudioPlayer(
        outputSampleRateRef.current,
        () => {
          setIsSpeaking(true);
          setIsProcessing(Boolean(activeToolRef.current));
          setVoicePhase("speaking");
          callbacksRef.current.onSpeakingStart?.();
        },
        () => {
          setIsSpeaking(false);
          applyRestingPhase();
          callbacksRef.current.onSpeakingEnd?.();
        },
      );
    }
    return playerRef.current;
  }, [applyRestingPhase]);

  const closeEverything = useCallback(async () => {
    activeRef.current = false;
    readyRef.current = false;
    listeningRef.current = false;
    opaqueCaptureBlockedRef.current = false;
    const pending = pendingStartRef.current;
    if (pending) {
      pendingStartRef.current = null;
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error("A preparação da voz foi cancelada."));
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop" }));
      ws.close(1000, "client_end");
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    await cleanupInput();
    await playerRef.current?.close();
    playerRef.current = null;
    setIsConnected(false);
    setIsListening(false);
    setIsProcessing(false);
    setIsSpeaking(false);
    setActiveToolState(null);
    setLastFunctionStatus(null);
    setVoicePhase("idle");
  }, [cleanupInput, setActiveToolState]);

  const startInput = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microfone indisponivel neste dispositivo.");
    }
    if (!("AudioWorkletNode" in window)) {
      throw new Error("AudioWorklet nao esta disponivel neste navegador.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: import.meta.env.VITE_SYNAPSE_VOICE_NOISE_SUPPRESSION === "true",
        autoGainControl: true,
      },
    });
    const effectiveInputSampleRate = inputSampleRateRef.current;
    const context = new AudioContext({ sampleRate: effectiveInputSampleRate });
    await context.audioWorklet.addModule("/worklets/deepgram-agent-recorder.js");

    const source = context.createMediaStreamSource(stream);
    const configuredFrameMs = Number(import.meta.env.VITE_SYNAPSE_VOICE_FRAME_MS || "80");
    const effectiveFrameMs = Number.isFinite(configuredFrameMs) && configuredFrameMs > 0
      ? Math.min(120, Math.max(80, configuredFrameMs))
      : 80;
    const worklet = new AudioWorkletNode(context, "deepgram-agent-recorder", {
      processorOptions: {
        targetSampleRate: effectiveInputSampleRate,
        frameMs: effectiveFrameMs,
      },
    });
    const silentGain = context.createGain();
    silentGain.gain.value = 0;

    worklet.port.onmessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; audio?: ArrayBuffer; level?: number };
      if (payload.type !== "audio" || !payload.audio) return;
      const signal = analysePcm16(payload.audio, effectiveInputSampleRate);
      setLevel(Number(payload.level || signal.rms || 0), signal);
      if (opaqueCaptureBlockedRef.current) return;
      const ws = wsRef.current;
      if (!activeRef.current || !readyRef.current || !listeningRef.current) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!firstInputFrameLoggedRef.current) {
        firstInputFrameLoggedRef.current = true;
        console.info("[Synapse Voice] first microphone PCM frame", {
          bytes: payload.audio.byteLength,
          sampleRate: effectiveInputSampleRate,
          frameMs: effectiveFrameMs,
          audioContextState: context.state,
        });
      }
      ws.send(payload.audio);
    };

    source.connect(worklet);
    worklet.connect(silentGain);
    silentGain.connect(context.destination);

    if (context.state !== "running") {
      await context.resume().catch(() => undefined);
    }
    if (context.state !== "running") {
      worklet.port.close();
      worklet.disconnect();
      source.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close().catch(() => undefined);
      throw new Error(`O capturador de áudio ficou ${context.state}. Clique novamente para liberar o microfone.`);
    }

    const track = stream.getAudioTracks()[0];
    const trackSettings = track?.getSettings?.() || {};
    console.info("[Synapse Voice] microphone capture running", {
      sampleRate: context.sampleRate,
      targetSampleRate: effectiveInputSampleRate,
      frameMs: effectiveFrameMs,
      microphone: {
        label: track?.label || "",
        enabled: track?.enabled ?? false,
        muted: track?.muted ?? false,
        readyState: track?.readyState || "",
        deviceId: trackSettings.deviceId ? "available" : "",
        channelCount: trackSettings.channelCount,
        sampleRate: trackSettings.sampleRate,
      },
    });

    streamRef.current = stream;
    inputContextRef.current = context;
    sourceRef.current = source;
    workletRef.current = worklet;
    silentGainRef.current = silentGain;
  }, [setLevel]);

  const persistConversationId = useCallback((id: string) => {
    const nextId = clean(id, 160);
    if (!nextId || conversationIdRef.current === nextId) return;
    conversationIdRef.current = nextId;
    sessionIdRef.current = nextId;
    setCurrentConversationId(nextId);
    callbacksRef.current.onSessionIdChange?.(nextId);
    callbacksRef.current.onConversationIdChange?.(nextId);
  }, []);

  const persistVoiceSessionId = useCallback((id: string) => {
    const nextId = clean(id, 160);
    if (!nextId || voiceSessionIdRef.current === nextId) return;
    voiceSessionIdRef.current = nextId;
    setCurrentVoiceSessionId(nextId);
    callbacksRef.current.onVoiceSessionIdChange?.(nextId);
  }, []);

  const handleDeepgramEvent = useCallback((event: Record<string, unknown>) => {
    const type = clean(event.type, 80);

    if (type === "SettingsApplied") {
      readyRef.current = true;
      setIsConnected(true);
      setIsListening(listeningRef.current);
      applyRestingPhase();
      resolvePendingStart();
      return;
    }

    if (type === "UserStartedSpeaking" || type === "AgentAudioInterrupted" || type === "StartOfTurn") {
      stopPlayback();
      applyRestingPhase();
      return;
    }

    if (type === "AgentThinking" || type === "FunctionCallRequest") {
      setIsProcessing(true);
      if (!activeToolRef.current) setVoicePhase("thinking");
      return;
    }

    if (type === "AgentStartedSpeaking") {
      setIsSpeaking(true);
      setIsProcessing(Boolean(activeToolRef.current));
      setVoicePhase("speaking");
      return;
    }

    if (type === "AgentAudioDone") {
      setIsSpeaking(false);
      applyRestingPhase();
      return;
    }

    if (type === "ConversationText") {
      const text = eventText(event);
      if (!text) return;
      const role = eventRole(event);
      if (role === "user" || role === "human") {
        setTranscript(text);
        callbacksRef.current.onTranscript?.(text, true);
        return;
      }
      if (role === "assistant" || role === "agent" || role === "ai") {
        setLastResponse(text);
        callbacksRef.current.onResponseText?.(text);
      }
    }
  }, [applyRestingPhase, resolvePendingStart, stopPlayback]);

  const handleGatewayMessage = useCallback((payload: Record<string, unknown>) => {
    const type = clean(payload.type, 80);

    if (type === "review_action") {
      emitVoiceReviewAction(payload.action);
      return;
    }

    if (type === "action_group_edit_result") {
      emitActionGroupEditResult({
        reviewId: clean(payload.reviewId || payload.review_id, 160),
        stepId: clean(payload.stepId || payload.step_id, 160),
        fieldId: clean(payload.fieldId || payload.field_id, 120),
        success: payload.success === true,
        message: clean(payload.message, 500),
      });
      return;
    }

    if (type === "gateway_status") {
      const status = clean(payload.status, 80);
      const nextConversationId = typeof payload.conversationId === "string"
        ? payload.conversationId
        : typeof payload.sessionId === "string"
          ? payload.sessionId
          : null;
      if (nextConversationId) persistConversationId(nextConversationId);
      if (typeof payload.voiceSessionId === "string") persistVoiceSessionId(payload.voiceSessionId);
      if (status === "ready") {
        readyRef.current = true;
        setIsConnected(true);
        setIsListening(listeningRef.current);
        applyRestingPhase();
        resolvePendingStart();
      } else if (["connecting_deepgram", "waiting_welcome", "settings_sent"].includes(status)) {
        setIsProcessing(true);
        setVoicePhase("connecting");
      } else if (status === "deepgram_closed") {
        setActiveToolState(null);
        setVoicePhase("idle");
        if (!readyRef.current) {
          rejectPendingStart(new Error("A conversa por voz foi encerrada antes de ficar pronta."));
        }
      }
      return;
    }

    if (type === "gateway_error") {
      console.warn("[Synapse Voice] Gateway error", payload);
      const message = userFacingVoiceError(payload.errorType, payload.error);
      setError(message);
      setIsProcessing(false);
      setVoicePhase("error");
      rejectPendingStart(new Error(message));
      void closeEverything().finally(() => {
        setError(message);
        setVoicePhase("error");
      });
      return;
    }

    if (type === "deepgram_event" && payload.event && typeof payload.event === "object") {
      handleDeepgramEvent(payload.event as Record<string, unknown>);
      return;
    }

    if (type === "barge_in") {
      stopPlayback();
      applyRestingPhase();
      return;
    }

    if (type === "voice_state") {
      const phase = clean(payload.phase, 80);
      if (["tool_completed", "tool_failed", "tool_cancelled"].includes(phase)) {
        setActiveToolState(null);
        setIsProcessing(true);
        setVoicePhase("thinking");
        return;
      }
      if (phase === "thinking") {
        setActiveToolState(null);
        setIsProcessing(true);
        setVoicePhase("thinking");
        return;
      }
      if (phase === "awaiting_confirmation" && payload.activeTool && typeof payload.activeTool === "object") {
        const tool = buildToolState(
          {
            ...payload,
            activeTool: {
              ...(payload.activeTool as Record<string, unknown>),
              confirmationRequired: true,
            },
          },
          "confirmation_required",
        );
        setActiveToolState(tool);
        setIsProcessing(true);
        setVoicePhase("awaiting_confirmation");
        return;
      }
      if (phase.startsWith("tool_") && payload.activeTool && typeof payload.activeTool === "object") {
        const status = phase === "tool_retrying"
          ? "retrying"
          : phase === "tool_cancelling"
            ? "cancelling"
            : "progress";
        const tool = buildToolState(payload, status);
        setActiveToolState(tool);
        setIsProcessing(true);
        setVoicePhase(phaseFromToolStatus(String(tool.status)));
      }
      return;
    }

    if (type === "function_status") {
      const status = clean(payload.status, 80) as SynapseVoiceFunctionStatus;
      const message = clean(payload.message, 500);
      setLastFunctionStatus(status);

      if (["started", "progress", "retrying", "cancelling", "complement_received", "confirmation_required"].includes(status)) {
        const tool = buildToolState(payload, status);
        setActiveToolState(tool);
        setIsProcessing(true);
        setVoicePhase(phaseFromToolStatus(status));
      } else if (["completed", "failed", "cancelled"].includes(status)) {
        setActiveToolState(null);
        setIsProcessing(true);
        setVoicePhase("thinking");
      }

      if (message) {
        setLastResponse(message);
        callbacksRef.current.onResponseText?.(message);
      }
      return;
    }

    if (type === "client_action" && payload.action && typeof payload.action === "object") {
      const callId = clean(payload.callId || payload.id, 120);
      const name = clean(payload.name, 120);
      void (async () => {
        const startedAt = performance.now();
        let result: ClientActionExecutionResult;
        try {
          const callback = callbacksRef.current.onClientAction;
          if (!callback) throw new Error("A interface nao possui um executor para esta acao.");
          const execution = await callback(payload.action as ClientAction);
          if (!execution || typeof execution !== "object") {
            throw new Error("A interface nao confirmou o resultado da acao.");
          }
          result = execution;
        } catch (caught) {
          result = {
            success: false,
            message: caught instanceof Error
              ? caught.message
              : "A interface nao conseguiu concluir a acao.",
            durationMs: Math.round(performance.now() - startedAt),
          };
        }

        const socket = wsRef.current;
        if (!callId || !socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
          type: "client_action_result",
          id: callId,
          callId,
          name,
          success: result.success === true,
          message: clean(result.message, 800),
          cancelled: Boolean(result.cancelled),
          error_code: result.success === true ? null : "client_action_failed",
          durationMs: Number.isFinite(Number(result.durationMs))
            ? Math.max(0, Math.round(Number(result.durationMs)))
            : Math.round(performance.now() - startedAt),
        }));
      })();
      return;
    }
  }, [applyRestingPhase, buildToolState, closeEverything, handleDeepgramEvent, persistConversationId, persistVoiceSessionId, rejectPendingStart, resolvePendingStart, setActiveToolState, stopPlayback]);

  const handleBinaryAudio = useCallback(async (value: Blob | ArrayBuffer) => {
    const buffer = value instanceof Blob ? await value.arrayBuffer() : value;
    ensurePlayer().enqueue(buffer);
  }, [ensurePlayer]);

  const startSessionAttempt = useCallback(async (override?: SynapseVoiceStartOverride) => {
    await closeEverything();
    activeRef.current = true;
    readyRef.current = false;
    listeningRef.current = true;
    firstInputFrameLoggedRef.current = false;
    opaqueCaptureBlockedRef.current = false;
    setIsListening(false);
    setIsProcessing(true);
    setIsSpeaking(false);
    setVoicePhase("connecting");
    setActiveToolState(null);
    setLastFunctionStatus(null);
    setError(null);
    setTranscript("");
    setLastResponse("");

    const targetGatewayUrl = override?.gatewayUrl || gatewayUrl || gatewayUrlFromEnv();
    if (!targetGatewayUrl) {
      throw new Error("Nao consegui encontrar o canal seguro de voz do Synapse.");
    }

    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData.session?.access_token || override?.token || "";
    if (!accessToken) throw new Error("Sessao invalida.");

    inputSampleRateRef.current = normalizeSampleRate(override?.inputSampleRate ?? inputSampleRate, 48000);
    outputSampleRateRef.current = normalizeSampleRate(override?.outputSampleRate ?? outputSampleRate, 24000);

    const ws = new WebSocket(targetGatewayUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        const payload = parseMessage(event.data);
        if (payload) handleGatewayMessage(payload);
        return;
      }
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        void handleBinaryAudio(event.data);
      }
    };

    ws.onclose = () => {
      const wasReady = readyRef.current;
      readyRef.current = false;
      opaqueCaptureBlockedRef.current = false;
      setIsConnected(false);
      setIsListening(false);
      setIsProcessing(false);
      setIsSpeaking(false);
      setActiveToolState(null);
      setVoicePhase("idle");
      if (!wasReady) {
        rejectPendingStart(new Error("A conexao de voz fechou antes do Synapse ficar pronto."));
      }
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          rejectPendingStart(new Error("Timeout ao preparar a conversa por voz."));
        }, 22000);
        pendingStartRef.current = { resolve, reject, timeoutId };

        ws.onopen = () => {
          const nextConversationId = override?.conversationId
            || override?.sessionId
            || conversationIdRef.current
            || sessionIdRef.current
            || undefined;
          const nextVoiceSessionId = override?.voiceSessionId
            || voiceSessionIdRef.current
            || undefined;
          ws.send(JSON.stringify({
            type: "start",
            authorization: `Bearer ${accessToken}`,
            sessionId: nextConversationId,
            conversationId: nextConversationId,
            voiceSessionId: nextVoiceSessionId,
            systemInstruction,
            language,
            voiceUiCapabilities: {
              version: 1,
              capabilities: ["review_action:v1", "action_group_edit:v1", "opaque_confirmation:v1", "screen_context:v1"],
            },
            context: {
              ...(context || {}),
              ...(override?.context || {}),
              route: clean(override?.context?.currentContext || context?.currentContext || "voice", 80),
              source: "deepgram-agent",
            },
          }));
          void startInput().catch((caught) => {
            const inputError = caught instanceof Error ? caught : new Error("Falha ao iniciar microfone.");
            setError(inputError.message);
            rejectPendingStart(inputError);
            void closeEverything();
          });
        };
        ws.onerror = () => {
          rejectPendingStart(new Error("Falha ao conectar no gateway de voz."));
        };
      });
    } catch (caught) {
      const startError = caught instanceof Error ? caught : new Error("Nao foi possivel iniciar a voz do Synapse.");
      setError(startError.message);
      await closeEverything();
      throw startError;
    }
  }, [closeEverything, context, gatewayUrl, handleBinaryAudio, handleGatewayMessage, inputSampleRate, language, outputSampleRate, rejectPendingStart, setActiveToolState, startInput, systemInstruction]);

  const startSession = useCallback((override?: SynapseVoiceStartOverride) => {
    if (startingPromiseRef.current) return startingPromiseRef.current;
    const pending = startSessionAttempt(override);
    startingPromiseRef.current = pending;
    void pending.finally(() => {
      if (startingPromiseRef.current === pending) startingPromiseRef.current = null;
    }).catch(() => undefined);
    return pending;
  }, [startSessionAttempt]);

  const endSession = useCallback(() => {
    void closeEverything();
  }, [closeEverything]);

  const toggleListening = useCallback(() => {
    if (!activeRef.current) {
      void startSession();
      return;
    }
    const next = !listeningRef.current;
    listeningRef.current = next;
    setIsListening(next && readyRef.current);
    if (!next) setLevel(0);
    applyRestingPhase();
  }, [applyRestingPhase, setLevel, startSession]);

  const sendTextMessage = useCallback((text: string) => {
    const message = clean(text, 2000);
    if (!message || opaqueCaptureBlockedRef.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "inject_user_message", message }));
    setTranscript(message);
    callbacksRef.current.onTranscript?.(message, true);
  }, []);

  useEffect(() => () => {
    void closeEverything();
  }, [closeEverything]);

  const activeToolElapsedMs = activeTool
    ? Math.max(activeTool.elapsedMs, Date.now() - activeTool.startedAt, elapsedTick ? Date.now() - activeTool.startedAt : 0)
    : 0;

  return {
    isConnected,
    isSpeaking,
    isListening,
    isProcessing,
    voicePhase,
    activeTool,
    activeToolLabel: activeTool?.label || "",
    activeToolMessage: activeTool?.message || "",
    activeToolElapsedMs,
    isToolActive: Boolean(activeTool),
    lastFunctionStatus,
    conversationId: currentConversationId,
    voiceSessionId: currentVoiceSessionId,
    audioIntensity,
    getAudioVolume: () => volumeRef.current,
    getInputAudioSignal: () => inputSignalRef.current,
    getOutputAudioSignal: () => playerRef.current?.getSignal() || SILENT_PCM_SIGNAL,
    transcript,
    lastResponse,
    startSession,
    endSession,
    toggleListening,
    sendTextMessage,
    error,
    provider: "deepgram-agent" as const,
    inputProvider: "deepgram-flux" as const,
    outputProvider: "azure-speech" as const,
  };
}
