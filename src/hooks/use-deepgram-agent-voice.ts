import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PcmAudioPlayer } from "@/lib/pcm-audio-player";
import type {
  SynapseVoiceFunctionStatus,
  SynapseVoicePhase,
  SynapseVoiceStartOverride,
  SynapseVoiceToolState,
} from "@/types/synapse-voice";

type ClientAction = { type?: string; payload?: unknown; data?: unknown };

interface Options {
  gatewayUrl?: string | null;
  sessionId?: string | null;
  conversationId?: string | null;
  voiceSessionId?: string | null;
  systemInstruction?: string;
  language?: string;
  onSessionIdChange?: (id: string) => void;
  onConversationIdChange?: (id: string) => void;
  onVoiceSessionIdChange?: (id: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponseText?: (text: string) => void;
  onClientAction?: (action: ClientAction) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onAudioIntensity?: (intensity: number) => void;
}

const DEFAULT_GATEWAY_URL = "ws://localhost:8080/v1/synapse/voice";

const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const gatewayUrlFromEnv = () => {
  const configured = import.meta.env.VITE_SYNAPSE_VOICE_GATEWAY_URL;
  if (configured) return configured;
  if (typeof window !== "undefined" && window.location.protocol === "https:") return "";
  return DEFAULT_GATEWAY_URL;
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
  .replace(/[{}\[\]"]/g, "")
  .replace(/\b(?:payload|params|tool|endpoint|json|uuid|session_id|clientAction|function_call)\b/gi, "")
  .replace(/\b[a-z]+(?:_[a-z0-9]+){1,}\b/gi, "ação")
  .replace(/\s+/g, " ")
  .trim();

export function useDeepgramAgentVoice({
  gatewayUrl,
  sessionId,
  conversationId,
  voiceSessionId,
  systemInstruction,
  language = "pt-BR",
  onSessionIdChange,
  onConversationIdChange,
  onVoiceSessionIdChange,
  onTranscript,
  onResponseText,
  onClientAction,
  onSpeakingStart,
  onSpeakingEnd,
  onAudioIntensity,
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
  const sessionIdRef = useRef<string | null>(sessionId || null);
  const conversationIdRef = useRef<string | null>(conversationId || sessionId || null);
  const voiceSessionIdRef = useRef<string | null>(voiceSessionId || null);
  const activeToolRef = useRef<SynapseVoiceToolState | null>(null);
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
    if (!activeTool) return undefined;
    const timer = window.setInterval(() => setElapsedTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTool]);

  const setLevel = useCallback((level: number) => {
    volumeRef.current = level;
    setAudioIntensity(level);
    callbacksRef.current.onAudioIntensity?.(level);
  }, []);

  const setActiveToolState = useCallback((tool: SynapseVoiceToolState | null) => {
    activeToolRef.current = tool;
    setActiveTool(tool);
    setElapsedTick(Date.now());
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
    setLevel(0);
  }, [setLevel]);

  const ensurePlayer = useCallback(() => {
    if (!playerRef.current) {
      playerRef.current = new PcmAudioPlayer(
        24000,
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
    const context = new AudioContext({ sampleRate: 16000 });
    await context.audioWorklet.addModule("/worklets/deepgram-agent-recorder.js");

    const source = context.createMediaStreamSource(stream);
    const configuredFrameMs = Number(import.meta.env.VITE_SYNAPSE_VOICE_FRAME_MS || "20");
    const worklet = new AudioWorkletNode(context, "deepgram-agent-recorder", {
      processorOptions: {
        targetSampleRate: 16000,
        frameMs: Number.isFinite(configuredFrameMs) && configuredFrameMs > 0 ? configuredFrameMs : 20,
      },
    });
    const silentGain = context.createGain();
    silentGain.gain.value = 0;

    worklet.port.onmessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; audio?: ArrayBuffer; level?: number };
      if (payload.type !== "audio" || !payload.audio) return;
      setLevel(Number(payload.level || 0));
      const ws = wsRef.current;
      if (!activeRef.current || !readyRef.current || !listeningRef.current) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(payload.audio);
    };

    source.connect(worklet);
    worklet.connect(silentGain);
    silentGain.connect(context.destination);

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
  }, [applyRestingPhase, stopPlayback]);

  const handleGatewayMessage = useCallback((payload: Record<string, unknown>) => {
    const type = clean(payload.type, 80);

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
      } else if (["connecting_deepgram", "waiting_welcome", "settings_sent"].includes(status)) {
        setIsProcessing(true);
        setVoicePhase("connecting");
      } else if (status === "deepgram_closed") {
        setActiveToolState(null);
        setVoicePhase("idle");
      }
      return;
    }

    if (type === "gateway_error") {
      const message = clean(payload.error || "Nao foi possivel continuar a voz.", 1000);
      setError(message);
      setIsProcessing(false);
      setVoicePhase("error");
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
      callbacksRef.current.onClientAction?.(payload.action as ClientAction);
    }
  }, [applyRestingPhase, buildToolState, handleDeepgramEvent, persistConversationId, persistVoiceSessionId, setActiveToolState, stopPlayback]);

  const handleBinaryAudio = useCallback(async (value: Blob | ArrayBuffer) => {
    const buffer = value instanceof Blob ? await value.arrayBuffer() : value;
    ensurePlayer().enqueue(buffer);
  }, [ensurePlayer]);

  const startSession = useCallback(async (override?: SynapseVoiceStartOverride) => {
    await closeEverything();
    activeRef.current = true;
    readyRef.current = false;
    listeningRef.current = true;
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
      throw new Error("Gateway de voz nao configurado. Defina VITE_SYNAPSE_VOICE_GATEWAY_URL.");
    }

    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData.session?.access_token || override?.token || "";
    if (!accessToken) throw new Error("Sessao invalida.");

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
      readyRef.current = false;
      setIsConnected(false);
      setIsListening(false);
      setIsProcessing(false);
      setIsSpeaking(false);
      setActiveToolState(null);
      setVoicePhase("idle");
    };

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Timeout ao conectar no gateway de voz.")), 12000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
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
          context: { route: "voice", source: "deepgram-agent" },
        }));
        void startInput().catch((caught) => {
          setError(caught instanceof Error ? caught.message : "Falha ao iniciar microfone.");
          void closeEverything();
        });
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Falha ao conectar no gateway de voz."));
      };
    });
  }, [closeEverything, gatewayUrl, handleBinaryAudio, handleGatewayMessage, language, setActiveToolState, startInput, systemInstruction]);

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
    if (!message) return;
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
    transcript,
    lastResponse,
    startSession,
    endSession,
    toggleListening,
    sendTextMessage,
    error,
    provider: "deepgram-agent" as const,
    inputProvider: "deepgram-flux" as const,
    outputProvider: "deepgram-elevenlabs" as const,
  };
}
