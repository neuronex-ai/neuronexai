"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type MediaReadinessStatus = "idle" | "requesting" | "ready" | "error" | "unsupported";
export type MediaPermissionStatus = "granted" | "prompt" | "denied" | "unknown" | "unsupported";
export type NetworkReadiness = "good" | "fair" | "poor" | "offline" | "unknown";

export interface MediaDeviceChoice {
  audioInputId?: string;
  audioInputLabel?: string;
  audioOutputId?: string;
  audioOutputLabel?: string;
  videoInputId?: string;
  videoInputLabel?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface MediaReadinessError {
  code: string;
  title: string;
  description: string;
  recoverable: boolean;
}

interface UseMediaReadinessOptions {
  autoStart?: boolean;
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
}

interface ConnectionInformationLike extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

const getConnection = (): ConnectionInformationLike | undefined => {
  if (typeof navigator === "undefined") return undefined;
  const extendedNavigator = navigator as Navigator & {
    connection?: ConnectionInformationLike;
    mozConnection?: ConnectionInformationLike;
    webkitConnection?: ConnectionInformationLike;
  };
  return extendedNavigator.connection || extendedNavigator.mozConnection || extendedNavigator.webkitConnection;
};

const mapMediaError = (error: unknown): MediaReadinessError => {
  const mediaError = error as DOMException;
  const code = mediaError?.name || "UnknownError";

  if (code === "NotAllowedError" || code === "SecurityError") {
    return {
      code,
      title: "Permissão bloqueada",
      description: "Libere câmera e microfone nas permissões do navegador e execute o teste novamente.",
      recoverable: true,
    };
  }

  if (code === "NotFoundError" || code === "DevicesNotFoundError") {
    return {
      code,
      title: "Dispositivo não encontrado",
      description: "Conecte uma câmera ou um microfone e tente novamente. Também é possível entrar apenas com áudio.",
      recoverable: true,
    };
  }

  if (code === "NotReadableError" || code === "TrackStartError") {
    return {
      code,
      title: "Dispositivo em uso",
      description: "Outra aplicação pode estar usando a câmera ou o microfone. Feche-a e repita o teste.",
      recoverable: true,
    };
  }

  if (code === "OverconstrainedError" || code === "ConstraintNotSatisfiedError") {
    return {
      code,
      title: "Configuração indisponível",
      description: "O dispositivo selecionado não está mais disponível. Escolha outro dispositivo.",
      recoverable: true,
    };
  }

  if (code === "TypeError" && typeof window !== "undefined" && !window.isSecureContext) {
    return {
      code,
      title: "Conexão não segura",
      description: "O navegador só libera câmera e microfone em uma conexão HTTPS segura.",
      recoverable: false,
    };
  }

  return {
    code,
    title: "Não foi possível testar os dispositivos",
    description: "Revise as permissões do navegador e tente novamente.",
    recoverable: true,
  };
};

const readPermission = async (name: "camera" | "microphone"): Promise<MediaPermissionStatus> => {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";

  try {
    const result = await navigator.permissions.query({ name } as PermissionDescriptor);
    return result.state as MediaPermissionStatus;
  } catch {
    return "unknown";
  }
};

const evaluateNetwork = (): NetworkReadiness => {
  if (typeof navigator === "undefined") return "unknown";
  if (!navigator.onLine) return "offline";

  const connection = getConnection();
  if (!connection) return "unknown";

  const effectiveType = connection.effectiveType;
  const downlink = connection.downlink;
  const rtt = connection.rtt;

  if (effectiveType === "slow-2g" || effectiveType === "2g" || (typeof downlink === "number" && downlink < 0.8) || (typeof rtt === "number" && rtt > 700)) {
    return "poor";
  }

  if (effectiveType === "3g" || (typeof downlink === "number" && downlink < 2) || (typeof rtt === "number" && rtt > 350)) {
    return "fair";
  }

  if (effectiveType === "4g" || (typeof downlink === "number" && downlink >= 2) || (typeof rtt === "number" && rtt <= 350)) {
    return "good";
  }

  return "unknown";
};

export const useMediaReadiness = ({
  autoStart = true,
  initialAudioEnabled = true,
  initialVideoEnabled = true,
}: UseMediaReadinessOptions = {}) => {
  const [status, setStatus] = useState<MediaReadinessStatus>("idle");
  const [error, setError] = useState<MediaReadinessError | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioEnabled, setAudioEnabledState] = useState(initialAudioEnabled);
  const [videoEnabled, setVideoEnabledState] = useState(initialVideoEnabled);
  const [audioInputId, setAudioInputIdState] = useState<string | undefined>();
  const [audioOutputId, setAudioOutputIdState] = useState<string | undefined>();
  const [videoInputId, setVideoInputIdState] = useState<string | undefined>();
  const [audioPermission, setAudioPermission] = useState<MediaPermissionStatus>("unknown");
  const [videoPermission, setVideoPermission] = useState<MediaPermissionStatus>("unknown");
  const [audioLevel, setAudioLevel] = useState(0);
  const [network, setNetwork] = useState<NetworkReadiness>(() => evaluateNetwork());

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAudioLevelRef = useRef(0);
  const lastAudioSampleAtRef = useRef(0);
  const mountedRef = useRef(true);
  const configRef = useRef({
    audioEnabled: initialAudioEnabled,
    videoEnabled: initialVideoEnabled,
    audioInputId: undefined as string | undefined,
    audioOutputId: undefined as string | undefined,
    videoInputId: undefined as string | undefined,
  });

  const audioInputs = useMemo(() => devices.filter((device) => device.kind === "audioinput"), [devices]);
  const audioOutputs = useMemo(() => devices.filter((device) => device.kind === "audiooutput"), [devices]);
  const videoInputs = useMemo(() => devices.filter((device) => device.kind === "videoinput"), [devices]);

  const stopAudioMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    lastAudioLevelRef.current = 0;
    lastAudioSampleAtRef.current = 0;
    if (mountedRef.current) setAudioLevel(0);
  }, []);

  const stopCurrentStream = useCallback(() => {
    stopAudioMeter();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (mountedRef.current) setStream(null);
  }, [stopAudioMeter]);

  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const nextDevices = await navigator.mediaDevices.enumerateDevices();
    if (mountedRef.current) setDevices(nextDevices);
    return nextDevices;
  }, []);

  const startAudioMeter = useCallback((nextStream: MediaStream) => {
    const audioTrack = nextStream.getAudioTracks()[0];
    if (!audioTrack || typeof window === "undefined") return;

    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const context = new AudioContextConstructor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
      source.connect(analyser);
      audioContextRef.current = context;
      const values = new Uint8Array(analyser.frequencyBinCount);

      const sample = (timestamp: number) => {
        analyser.getByteFrequencyData(values);
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const nextLevel = Math.min(1, average / 72);
        // Updating React state at the browser's full animation-frame rate made
        // the entire pre-join panel render ~60 times per second. Twelve visual
        // samples per second remain responsive while keeping layout work calm.
        if (
          mountedRef.current &&
          timestamp - lastAudioSampleAtRef.current >= 80 &&
          Math.abs(nextLevel - lastAudioLevelRef.current) >= 0.012
        ) {
          lastAudioSampleAtRef.current = timestamp;
          lastAudioLevelRef.current = nextLevel;
          setAudioLevel(nextLevel);
        }
        animationFrameRef.current = requestAnimationFrame(sample);
      };

      animationFrameRef.current = requestAnimationFrame(sample);
    } catch {
      setAudioLevel(0);
    }
  }, []);

  const refreshPermissions = useCallback(async () => {
    const [microphone, camera] = await Promise.all([
      readPermission("microphone"),
      readPermission("camera"),
    ]);
    if (!mountedRef.current) return;
    setAudioPermission(microphone);
    setVideoPermission(camera);
  }, []);

  const requestMedia = useCallback(async (overrides: Partial<typeof configRef.current> = {}) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError({
        code: "Unsupported",
        title: "Navegador incompatível",
        description: "Este navegador não oferece acesso seguro à câmera e ao microfone.",
        recoverable: false,
      });
      return;
    }

    const nextConfig = { ...configRef.current, ...overrides };
    configRef.current = nextConfig;
    setStatus("requesting");
    setError(null);
    stopCurrentStream();

    if (!nextConfig.audioEnabled && !nextConfig.videoEnabled) {
      await enumerateDevices();
      await refreshPermissions();
      if (mountedRef.current) setStatus("ready");
      return;
    }

    const audioConstraints: MediaTrackConstraints | false = nextConfig.audioEnabled
      ? {
          deviceId: nextConfig.audioInputId ? { exact: nextConfig.audioInputId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false;

    const videoConstraints: MediaTrackConstraints | false = nextConfig.videoEnabled
      ? {
          deviceId: nextConfig.videoInputId ? { exact: nextConfig.videoInputId } : undefined,
          facingMode: nextConfig.videoInputId ? undefined : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : false;

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      if (!mountedRef.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = nextStream;
      setStream(nextStream);

      const nextDevices = await enumerateDevices();
      const audioTrack = nextStream.getAudioTracks()[0];
      const videoTrack = nextStream.getVideoTracks()[0];
      const detectedAudioInputId = audioTrack?.getSettings().deviceId;
      const detectedVideoInputId = videoTrack?.getSettings().deviceId;

      if (detectedAudioInputId && !nextConfig.audioInputId) {
        configRef.current.audioInputId = detectedAudioInputId;
        setAudioInputIdState(detectedAudioInputId);
      }
      if (detectedVideoInputId && !nextConfig.videoInputId) {
        configRef.current.videoInputId = detectedVideoInputId;
        setVideoInputIdState(detectedVideoInputId);
      }
      if (!configRef.current.audioOutputId) {
        const defaultOutput = nextDevices.find((device) => device.kind === "audiooutput" && device.deviceId === "default") || nextDevices.find((device) => device.kind === "audiooutput");
        if (defaultOutput) {
          configRef.current.audioOutputId = defaultOutput.deviceId;
          setAudioOutputIdState(defaultOutput.deviceId);
        }
      }

      if (audioTrack) startAudioMeter(nextStream);
      await refreshPermissions();
      setStatus("ready");
    } catch (mediaError) {
      await refreshPermissions();
      if (!mountedRef.current) return;
      setStatus("error");
      setError(mapMediaError(mediaError));
    }
  }, [enumerateDevices, refreshPermissions, startAudioMeter, stopCurrentStream]);

  const setAudioEnabled = useCallback((enabled: boolean) => {
    configRef.current.audioEnabled = enabled;
    setAudioEnabledState(enabled);
    void requestMedia({ audioEnabled: enabled });
  }, [requestMedia]);

  const setVideoEnabled = useCallback((enabled: boolean) => {
    configRef.current.videoEnabled = enabled;
    setVideoEnabledState(enabled);
    void requestMedia({ videoEnabled: enabled });
  }, [requestMedia]);

  const setAudioInputId = useCallback((deviceId: string) => {
    configRef.current.audioInputId = deviceId || undefined;
    setAudioInputIdState(deviceId || undefined);
    void requestMedia({ audioInputId: deviceId || undefined });
  }, [requestMedia]);

  const setVideoInputId = useCallback((deviceId: string) => {
    configRef.current.videoInputId = deviceId || undefined;
    setVideoInputIdState(deviceId || undefined);
    void requestMedia({ videoInputId: deviceId || undefined });
  }, [requestMedia]);

  const setAudioOutputId = useCallback((deviceId: string) => {
    configRef.current.audioOutputId = deviceId || undefined;
    setAudioOutputIdState(deviceId || undefined);
  }, []);

  const releaseMedia = useCallback(() => {
    stopCurrentStream();
  }, [stopCurrentStream]);

  const getSelection = useCallback((): MediaDeviceChoice => {
    const audioInput = audioInputs.find((device) => device.deviceId === configRef.current.audioInputId);
    const audioOutput = audioOutputs.find((device) => device.deviceId === configRef.current.audioOutputId);
    const videoInput = videoInputs.find((device) => device.deviceId === configRef.current.videoInputId);

    return {
      audioInputId: audioInput?.deviceId,
      audioInputLabel: audioInput?.label,
      audioOutputId: audioOutput?.deviceId,
      audioOutputLabel: audioOutput?.label,
      videoInputId: videoInput?.deviceId,
      videoInputLabel: videoInput?.label,
      audioEnabled: configRef.current.audioEnabled,
      videoEnabled: configRef.current.videoEnabled,
    };
  }, [audioInputs, audioOutputs, videoInputs]);

  useEffect(() => {
    mountedRef.current = true;
    const updateNetwork = () => setNetwork(evaluateNetwork());
    const connection = getConnection();

    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    connection?.addEventListener?.("change", updateNetwork);

    const handleDeviceChange = () => {
      void enumerateDevices();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);

    if (autoStart) void requestMedia();
    else {
      void enumerateDevices();
      void refreshPermissions();
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
      connection?.removeEventListener?.("change", updateNetwork);
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      stopCurrentStream();
    };
  }, [autoStart, enumerateDevices, refreshPermissions, requestMedia, stopCurrentStream]);

  const isReady = status === "ready" &&
    (!audioEnabled || Boolean(stream?.getAudioTracks().length)) &&
    (!videoEnabled || Boolean(stream?.getVideoTracks().length));

  return {
    status,
    error,
    stream,
    isReady,
    audioEnabled,
    videoEnabled,
    audioInputId,
    audioOutputId,
    videoInputId,
    audioInputs,
    audioOutputs,
    videoInputs,
    audioPermission,
    videoPermission,
    audioLevel,
    network,
    requestMedia,
    releaseMedia,
    getSelection,
    setAudioEnabled,
    setVideoEnabled,
    setAudioInputId,
    setAudioOutputId,
    setVideoInputId,
  };
};
