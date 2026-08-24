"use client";

import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Speaker,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  type MediaDeviceChoice,
  type NetworkReadiness,
  useMediaReadiness,
} from "@/hooks/use-media-readiness";
import { cn } from "@/lib/utils";

interface MediaReadinessPanelProps {
  variant?: "mobile" | "desktop";
  initialAudioEnabled?: boolean;
  initialVideoEnabled?: boolean;
  onReadinessChange?: (ready: boolean, selection: MediaDeviceChoice) => void;
  className?: string;
}

const networkMeta: Record<NetworkReadiness, { label: string; icon: typeof Signal; className: string }> = {
  good: { label: "Conexão boa", icon: SignalHigh, className: "text-emerald-500" },
  fair: { label: "Conexão regular", icon: SignalMedium, className: "text-amber-500" },
  poor: { label: "Conexão fraca", icon: SignalLow, className: "text-red-500" },
  offline: { label: "Sem conexão", icon: SignalLow, className: "text-red-500" },
  unknown: { label: "Conexão disponível", icon: Signal, className: "text-muted-foreground" },
};

const deviceLabel = (label: string, fallback: string, index: number) => label || `${fallback} ${index + 1}`;

export const MediaReadinessPanel = ({
  variant = "desktop",
  initialAudioEnabled = true,
  initialVideoEnabled = true,
  onReadinessChange,
  className,
}: MediaReadinessPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readiness = useMediaReadiness({
    initialAudioEnabled,
    initialVideoEnabled,
  });
  const {
    getSelection,
  } = readiness;
  const selection = useMemo(
    () => getSelection(),
    [getSelection],
  );
  const network = networkMeta[readiness.network];
  const NetworkIcon = network.icon;
  const compact = variant === "mobile";
  const networkTone = compact || !["good", "unknown"].includes(readiness.network)
    ? network.className
    : "text-white/70";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = readiness.stream;
    if (readiness.stream) {
      void video.play().catch(() => undefined);
    }
    return () => {
      video.srcObject = null;
    };
  }, [readiness.stream]);

  useEffect(() => {
    onReadinessChange?.(readiness.isReady, selection);
  }, [onReadinessChange, readiness.isReady, selection]);

  return (
    <div className={cn(compact ? "space-y-4" : "space-y-5", className)}>
      <div
        className={cn(
          "teleconsultation-stage relative overflow-hidden bg-black",
          compact ? "aspect-[4/3] rounded-[28px]" : "aspect-video rounded-[30px]",
        )}
      >
        {readiness.videoEnabled && readiness.stream?.getVideoTracks().length ? (
          <video ref={videoRef} muted playsInline autoPlay className="h-full w-full scale-x-[-1] object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-900 to-black text-white/55">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/[0.07] bg-white/[0.06]">
              <CameraOff className="h-7 w-7" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em]">
              {readiness.videoEnabled ? "Câmera indisponível" : "Câmera desligada"}
            </p>
          </div>
        )}

        {readiness.status === "requesting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/78 text-white">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em]">Testando dispositivos</span>
          </div>
        ) : null}

        <div className={cn("absolute flex items-center justify-between gap-2", compact ? "bottom-3 left-3 right-3" : "bottom-4 left-4 right-4")}>
          <div className={cn("flex min-h-9 items-center gap-2 rounded-full border border-white/[0.07] bg-black/72 px-3.5 py-2 text-[8px] font-black uppercase tracking-[0.13em]", networkTone)}>
            <NetworkIcon className="h-3.5 w-3.5" />
            {network.label}
          </div>
          {readiness.isReady ? (
            <div className={cn(
              "flex min-h-9 items-center gap-2 rounded-full px-3.5 py-2 text-[8px] font-black uppercase tracking-[0.13em]",
              compact
                ? "border border-emerald-400/20 bg-emerald-500/18 text-emerald-300"
                : "border border-white/[0.09] bg-black/72 text-white/75",
            )}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Teste concluído
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn("grid grid-cols-2", compact ? "gap-3" : "gap-4")}>
        <button
          type="button"
          onClick={() => readiness.setAudioEnabled(!readiness.audioEnabled)}
          aria-pressed={readiness.audioEnabled}
          className={cn(
            "teleconsultation-action flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-[18px] border px-2 text-center text-[9px] font-black uppercase leading-tight tracking-[0.12em]",
            compact && "flex-col py-3",
            readiness.audioEnabled
              ? compact
                ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300"
                : "border-foreground/12 bg-foreground/[0.075] text-foreground dark:border-white/[0.075] dark:bg-white/[0.065]"
              : "teleconsultation-inset text-muted-foreground",
          )}
        >
          {readiness.audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          {readiness.audioEnabled ? "Microfone ligado" : "Microfone desligado"}
        </button>
        <button
          type="button"
          onClick={() => readiness.setVideoEnabled(!readiness.videoEnabled)}
          aria-pressed={readiness.videoEnabled}
          className={cn(
            "teleconsultation-action flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-[18px] border px-2 text-center text-[9px] font-black uppercase leading-tight tracking-[0.12em]",
            compact && "flex-col py-3",
            readiness.videoEnabled
              ? compact
                ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-600 dark:text-emerald-300"
                : "border-foreground/12 bg-foreground/[0.075] text-foreground dark:border-white/[0.075] dark:bg-white/[0.065]"
              : "teleconsultation-inset text-muted-foreground",
          )}
        >
          {readiness.videoEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          {readiness.videoEnabled ? "Câmera ligada" : "Câmera desligada"}
        </button>
      </div>

      {readiness.audioEnabled ? (
        <div className={cn("teleconsultation-inset rounded-[20px]", compact ? "p-4" : "p-5")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              <Mic className="h-3.5 w-3.5" />
              Nível do microfone
            </div>
            <span className="text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground/55">
              Fale para testar
            </span>
          </div>
          <div
            className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-foreground/[0.06] dark:bg-white/[0.06]"
            role="progressbar"
            aria-label="Nível do microfone"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(readiness.audioLevel * 100)}
          >
            <div
              className={cn(
                "h-full w-full origin-left rounded-full transition-transform duration-100 motion-reduce:transition-none",
                readiness.audioLevel > 0.72 ? "bg-amber-500" : compact ? "bg-emerald-500" : "bg-foreground/70",
              )}
              style={{ transform: `scaleX(${Math.max(0.04, readiness.audioLevel)})` }}
            />
          </div>
        </div>
      ) : null}

      {readiness.error ? (
        <div className="rounded-[20px] border border-red-500/20 bg-red-500/[0.07] p-4 text-red-600 dark:text-red-300">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">{readiness.error.title}</p>
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed opacity-75">{readiness.error.description}</p>
              {readiness.error.recoverable ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void readiness.requestMedia()}
                  className="mt-3 h-10 rounded-xl border-red-500/25 bg-transparent px-4 text-[8px] font-black uppercase tracking-[0.14em] text-red-600 hover:bg-red-500/10 dark:text-red-300"
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Testar novamente
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={cn("grid", compact ? "grid-cols-1 gap-3" : "gap-4 md:grid-cols-2")}>
        {readiness.audioInputs.length > 0 ? (
          <label className={cn(compact ? "space-y-2" : "space-y-2.5")}>
            <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> Microfone
            </span>
            <select
              value={readiness.audioInputId || ""}
              onChange={(event) => readiness.setAudioInputId(event.target.value)}
              className={cn("teleconsultation-inset w-full rounded-2xl px-4 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "h-12" : "h-[52px] px-5")}
            >
              {readiness.audioInputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device.label, "Microfone", index)}</option>
              ))}
            </select>
          </label>
        ) : null}

        {readiness.videoInputs.length > 0 ? (
          <label className={cn(compact ? "space-y-2" : "space-y-2.5")}>
            <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Camera className="h-3.5 w-3.5" /> Câmera
            </span>
            <select
              value={readiness.videoInputId || ""}
              onChange={(event) => readiness.setVideoInputId(event.target.value)}
              className={cn("teleconsultation-inset w-full rounded-2xl px-4 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "h-12" : "h-[52px] px-5")}
            >
              {readiness.videoInputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device.label, "Câmera", index)}</option>
              ))}
            </select>
          </label>
        ) : null}

        {readiness.audioOutputs.length > 0 ? (
          <label className={cn(compact ? "space-y-2" : "space-y-2.5 md:col-span-2")}>
            <span className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <Speaker className="h-3.5 w-3.5" /> Saída de áudio
            </span>
            <select
              value={readiness.audioOutputId || ""}
              onChange={(event) => readiness.setAudioOutputId(event.target.value)}
              className={cn("teleconsultation-inset w-full rounded-2xl px-4 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", compact ? "h-12" : "h-[52px] px-5")}
            >
              {readiness.audioOutputs.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device.label, "Saída", index)}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {(readiness.audioPermission === "denied" || readiness.videoPermission === "denied") && !readiness.error ? (
        <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/[0.07] p-4 text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-300">
          Uma permissão permanece bloqueada. Abra as configurações do site no navegador, libere o dispositivo e repita o teste.
        </div>
      ) : null}
    </div>
  );
};
