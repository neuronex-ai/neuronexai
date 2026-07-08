import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { recordSpeechTurn } from "@/lib/browser-speech-turn-recorder";

type ClientAction = { type?: string; payload?: unknown; data?: unknown };

interface Options {
  sessionId?: string | null;
  onSessionIdChange?: (id: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponseText?: (text: string) => void;
  onClientAction?: (action: ClientAction) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  onAudioIntensity?: (intensity: number) => void;
}

interface NeuralSpeechPayload {
  spokenText?: string;
  audioBase64?: string;
  mimeType?: string;
  provider?: string;
  voice?: string;
  error?: string;
}

const cleanForSpeech = (value: string) => value
  .replace(/```json\s+synapse_widget[\s\S]*?```/gi, "")
  .replace(/```[\s\S]*?```/g, "")
  .replace(/https?:\/\/\S+/g, "")
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "")
  .replace(/[*_#>`~]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const selectPortugueseVoice = () => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase() === "pt-br" && voice.localService)
    || voices.find((voice) => voice.lang.toLowerCase() === "pt-br")
    || voices.find((voice) => voice.lang.toLowerCase().startsWith("pt"))
    || null;
};

const audioExtension = (type: string) => {
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  if (type.includes("mpeg")) return "mp3";
  return "webm";
};

const base64ToBlob = (value: string, mimeType: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

export function useSynapseCascadeVoice({
  sessionId,
  onSessionIdChange,
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
  const [listeningEnabled, setListeningEnabled] = useState(false);
  const [fallbackListening, setFallbackListening] = useState(false);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [lastResponse, setLastResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const listeningEnabledRef = useRef(false);
  const processingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(sessionId || null);
  const startListeningRef = useRef<() => void>(() => undefined);
  const stopListeningRef = useRef<() => void>(() => undefined);
  const recorderAbortRef = useRef<AbortController | null>(null);
  const lastSubmittedRef = useRef<{ text: string; at: number } | null>(null);
  const volumeRef = useRef(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId || null;
  }, [sessionId]);

  const updateAudioLevel = useCallback((level: number) => {
    volumeRef.current = level;
    setAudioIntensity(level);
    onAudioIntensity?.(level);
  }, [onAudioIntensity]);

  const clearAudioElement = useCallback(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioElementRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    clearAudioElement();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, [clearAudioElement]);

  const stopInput = useCallback(() => {
    stopListeningRef.current();
    recorderAbortRef.current?.abort();
    recorderAbortRef.current = null;
    setFallbackListening(false);
    updateAudioLevel(0);
  }, [updateAudioLevel]);

  const playLocalSpeech = useCallback((text: string) => new Promise<void>((resolve) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.02;
    utterance.pitch = 0.98;
    const voice = selectPortugueseVoice();
    if (voice) utterance.voice = voice;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setIsSpeaking(false);
      onSpeakingEnd?.();
      resolve();
    };

    utterance.onstart = () => {
      setIsSpeaking(true);
      onSpeakingStart?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }), [onSpeakingEnd, onSpeakingStart]);

  const playNeuralAudio = useCallback((audioBase64: string, mimeType: string) => new Promise<void>((resolve, reject) => {
    try {
      const blob = base64ToBlob(audioBase64, mimeType);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = "auto";
      audioElementRef.current = audio;
      audioUrlRef.current = url;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearAudioElement();
        setIsSpeaking(false);
        onSpeakingEnd?.();
        resolve();
      };

      audio.onplay = () => {
        setIsSpeaking(true);
        onSpeakingStart?.();
      };
      audio.onended = finish;
      audio.onerror = () => {
        clearAudioElement();
        setIsSpeaking(false);
        reject(new Error("Falha ao reproduzir a voz neural."));
      };

      void audio.play().catch((caught) => {
        clearAudioElement();
        setIsSpeaking(false);
        reject(caught instanceof Error ? caught : new Error("Reprodução de áudio bloqueada."));
      });
    } catch (caught) {
      reject(caught);
    }
  }), [clearAudioElement, onSpeakingEnd, onSpeakingStart]);

  const speak = useCallback(async (rawText: string) => {
    const fallbackText = cleanForSpeech(rawText);
    if (!fallbackText) return "";

    stopInput();
    stopSpeech();

    let spokenText = fallbackText;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<NeuralSpeechPayload>("synapse-voice-speak", {
        body: { text: rawText },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      spokenText = cleanForSpeech(data?.spokenText || fallbackText) || fallbackText;
      setLastResponse(spokenText);
      onResponseText?.(spokenText);

      if (!data?.audioBase64) throw new Error("Áudio neural ausente.");
      await playNeuralAudio(data.audioBase64, data.mimeType || "audio/mpeg");
      return spokenText;
    } catch (caught) {
      console.warn("[Synapse Voice] Voz neural indisponível; usando voz local.", caught);
      spokenText = cleanForSpeech(spokenText) || fallbackText;
      setLastResponse(spokenText);
      onResponseText?.(spokenText);
      await playLocalSpeech(spokenText);
      return spokenText;
    }
  }, [onResponseText, playLocalSpeech, playNeuralAudio, stopInput, stopSpeech]);

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Sessão inválida.");

    const { data: latest } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.id) {
      sessionIdRef.current = latest.id;
      onSessionIdChange?.(latest.id);
      return latest.id;
    }

    const { data, error: createError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: auth.user.id, title: "Conversa por voz" })
      .select("id")
      .single();

    if (createError || !data) throw createError || new Error("Não foi possível criar a conversa.");
    sessionIdRef.current = data.id;
    onSessionIdChange?.(data.id);
    return data.id;
  }, [onSessionIdChange]);

  const submitTranscript = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || processingRef.current || !activeRef.current || !listeningEnabledRef.current) return;

    const now = Date.now();
    const previous = lastSubmittedRef.current;
    if (previous && previous.text === text && now - previous.at < 1800) return;
    lastSubmittedRef.current = { text, at: now };

    stopInput();
    stopSpeech();
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);
    setLastResponse("");
    onTranscript?.(text, true);

    try {
      const currentSessionId = await ensureSession();
      const { data, error: invokeError } = await supabase.functions.invoke("synapse-voice-turn", {
        body: {
          message: text,
          sessionId: currentSessionId,
          context: { route: "voice", source: "free-cascade", aiProvider: "groq" },
        },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      const response = typeof data?.response === "string" ? data.response.trim() : "";
      if (typeof data?.session_id === "string") {
        sessionIdRef.current = data.session_id;
        onSessionIdChange?.(data.session_id);
      }

      if (data?.clientAction) onClientAction?.(data.clientAction);
      if (response) await speak(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível processar sua fala.");
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [ensureSession, onClientAction, onSessionIdChange, onTranscript, speak, stopInput, stopSpeech]);

  const transcribeAudio = useCallback(async (blob: Blob) => {
    if (blob.size < 1000 || !activeRef.current || !listeningEnabledRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    let text = "";
    try {
      const form = new FormData();
      const type = blob.type || "audio/webm";
      form.append("audio", new File([blob], `synapse-voice.${audioExtension(type)}`, { type }));
      const { data, error: invokeError } = await supabase.functions.invoke("synapse-voice-transcribe", {
        body: form,
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      text = typeof data?.text === "string" ? data.text.trim() : "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível transcrever o áudio.");
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }

    if (text) await submitTranscript(text);
  }, [submitTranscript]);

  const recognition = useSpeechRecognition({
    lang: "pt-BR",
    continuous: false,
    onResult: (text) => void submitTranscript(text),
    onInterimResult: (text) => onTranscript?.(text, false),
    onError: (code) => {
      if (!["unsupported", "no-speech", "aborted"].includes(code)) {
        setError(`Falha no reconhecimento de voz: ${code}`);
      }
    },
  });

  useEffect(() => {
    startListeningRef.current = recognition.startListening;
    stopListeningRef.current = recognition.stopListening;
  }, [recognition.startListening, recognition.stopListening]);

  const startWhisperFallback = useCallback(async () => {
    if (
      recorderAbortRef.current
      || !activeRef.current
      || !listeningEnabledRef.current
      || processingRef.current
    ) return;

    const controller = new AbortController();
    recorderAbortRef.current = controller;
    setFallbackListening(true);

    try {
      const blob = await recordSpeechTurn({
        signal: controller.signal,
        onLevel: updateAudioLevel,
        noiseSuppression: import.meta.env.VITE_SYNAPSE_VOICE_NOISE_SUPPRESSION === "true",
      });
      if (blob && !controller.signal.aborted) await transcribeAudio(blob);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : "Falha ao capturar o áudio.");
      }
    } finally {
      if (recorderAbortRef.current === controller) recorderAbortRef.current = null;
      setFallbackListening(false);
      updateAudioLevel(0);
    }
  }, [transcribeAudio, updateAudioLevel]);

  useEffect(() => {
    const browserListening = recognition.isSupported && recognition.isListening;
    if (
      !activeRef.current
      || !listeningEnabled
      || isProcessing
      || isSpeaking
      || browserListening
      || fallbackListening
    ) return;

    const timer = window.setTimeout(() => {
      if (!activeRef.current || !listeningEnabledRef.current || processingRef.current) return;
      if (recognition.isSupported) startListeningRef.current();
      else void startWhisperFallback();
    }, 260);

    return () => window.clearTimeout(timer);
  }, [fallbackListening, isProcessing, isSpeaking, listeningEnabled, recognition.isListening, recognition.isSupported, startWhisperFallback]);

  const startSession = useCallback(async () => {
    activeRef.current = true;
    listeningEnabledRef.current = true;
    setListeningEnabled(true);
    setError(null);
    setLastResponse("");
    setIsConnected(true);

    if (recognition.isSupported) startListeningRef.current();
    else void startWhisperFallback();
  }, [recognition.isSupported, startWhisperFallback]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    listeningEnabledRef.current = false;
    processingRef.current = false;
    stopInput();
    stopSpeech();
    setIsConnected(false);
    setListeningEnabled(false);
    setIsProcessing(false);
  }, [stopInput, stopSpeech]);

  return {
    isConnected,
    isSpeaking,
    isListening: listeningEnabled && (recognition.isListening || fallbackListening),
    isProcessing,
    audioIntensity,
    getAudioVolume: () => volumeRef.current,
    transcript: recognition.transcript,
    lastResponse,
    startSession,
    endSession,
    toggleListening: () => {
      if (listeningEnabledRef.current) {
        listeningEnabledRef.current = false;
        setListeningEnabled(false);
        stopInput();
      } else {
        listeningEnabledRef.current = true;
        setListeningEnabled(true);
        if (activeRef.current) {
          if (recognition.isSupported) startListeningRef.current();
          else void startWhisperFallback();
        }
      }
    },
    sendTextMessage: (text: string) => void submitTranscript(text),
    error: error || recognition.error,
    provider: "legacy-cascade" as const,
    inputProvider: recognition.isSupported ? "browser-speech" : "deepgram-stt-fallback",
    outputProvider: "neural-or-local-speech",
  };
}
