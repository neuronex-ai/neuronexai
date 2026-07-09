import { useEffect, useRef, useState, type RefObject } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { findBoletoCandidate } from "@/lib/boleto";
import { cn } from "@/lib/utils";
import {
  hasNativeCodeScanner,
  scanCodeWithNative,
} from "@/lib/native-mobile-security";
import {
  MobileFinanceButton,
  MobileFinanceSheet,
  mobileFinanceSurface,
} from "../../shared/MobileFinancePrimitives";

type ScannerMode = "pix" | "boleto";

type ScannerState = "idle" | "starting" | "scanning" | "error" | "native";

type ScreenOrientationLock =
  | "any"
  | "natural"
  | "landscape"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary";

type DetectedBarcode = {
  rawValue?: string;
  displayValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
};

type BarcodeWindow = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
};

const formatHints = {
  pix: [BarcodeFormat.QR_CODE],
  boleto: [
    BarcodeFormat.ITF,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
  ],
} satisfies Record<ScannerMode, BarcodeFormat[]>;

const copy = {
  pix: {
    title: "Ler QR Code Pix",
    description: "Aponte a câmera para o QR Code. O Pix será consultado antes da confirmação.",
    hint: "Nenhum pagamento é enviado a partir da leitura.",
  },
  boleto: {
    title: "Ler código de barras",
    description: "Enquadre as barras horizontais do boleto de ponta a ponta. Os dados serão validados antes do PIN.",
    hint: "QR Codes não são usados para boleto. A leitura apenas preenche a consulta.",
  },
} satisfies Record<ScannerMode, { title: string; description: string; hint: string }>;

export function MobileCodeScannerSheet({
  open,
  onOpenChange,
  mode,
  busy = false,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ScannerMode;
  busy?: boolean;
  onDetected: (value: string) => Promise<void> | void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);
  const lastInvalidToastRef = useRef(0);
  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      detectedRef.current = false;
      setState("idle");
      setError(null);
      return;
    }

    let cancelled = false;

    const start = async () => {
      detectedRef.current = false;
      setError(null);
      if (mode === "boleto") await lockLandscapeBestEffort();

      if (mode === "pix" && hasNativeCodeScanner()) {
        setState("native");
        try {
          const value = await scanCodeWithNative({ mode });
          if (cancelled) return;
          if (!value) {
            onOpenChange(false);
            return;
          }
          const detectedValue = normalizeDetectedValue(mode, value);
          if (!detectedValue) {
            throw new Error("Código não encontrado.");
          }
          detectedRef.current = true;
          onOpenChange(false);
          await onDetected(detectedValue);
        } catch (cause) {
          if (cancelled) return;
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível ler o código pela câmera.",
          );
          setState("error");
        }
        return;
      }

      const videoElement = await waitForVideoElement(videoRef, () => cancelled);

      if (!navigator.mediaDevices?.getUserMedia || !videoElement) {
        setError("Câmera indisponível neste navegador ou contexto.");
        setState("error");
        return;
      }

      setState("starting");
      if (mode === "boleto") {
        const nativeStarted = await startNativeBoletoScanner({
          video: videoElement,
          onDetected: async (value) => {
            detectedRef.current = true;
            controlsRef.current?.stop();
            onOpenChange(false);
            await onDetected(value);
          },
          onInvalid: () => {
            const now = Date.now();
            if (now - lastInvalidToastRef.current > 1800) {
              lastInvalidToastRef.current = now;
              toast.error("Código lido não parece boleto. Vire o celular e enquadre as barras.");
            }
          },
        }).catch((cause) => {
          console.warn("[BoletoScanner] BarcodeDetector fallback", cause);
          return null;
        });

        if (cancelled) {
          nativeStarted?.stop();
          return;
        }

        if (nativeStarted) {
          controlsRef.current = nativeStarted;
          setState("scanning");
          return;
        }
      }

      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formatHints[mode]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      if (mode === "boleto") {
        hints.set(DecodeHintType.ALLOWED_LENGTHS, [44, 46, 47, 48]);
      }
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: mode === "boleto" ? 150 : 260,
      });

      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: mode === "boleto" ? 1920 : 1280 },
              height: { ideal: mode === "boleto" ? 1080 : 720 },
              aspectRatio: mode === "boleto" ? { ideal: 16 / 9 } : undefined,
            },
          },
          videoElement,
          (result) => {
            if (!result || detectedRef.current) return;
            const value = normalizeDetectedValue(mode, result.getText());
            if (!value) {
              const now = Date.now();
              if (now - lastInvalidToastRef.current > 1800) {
                lastInvalidToastRef.current = now;
                toast.error("Código lido não parece boleto. Aponte para as barras horizontais.");
              }
              return;
            }
            detectedRef.current = true;
            controlsRef.current?.stop();
            onOpenChange(false);
            Promise.resolve(onDetected(value)).catch((cause) => {
              toast.error(
                cause instanceof Error
                  ? cause.message
                  : "Código lido, mas não foi possível validar.",
              );
            });
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState("scanning");
      } catch (cause) {
        if (cancelled) return;
        setError(cameraErrorMessage(cause));
        setState("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (mode === "boleto") void unlockOrientationBestEffort();
    };
  }, [mode, onDetected, onOpenChange, open, retryKey]);

  const content = copy[mode];
  const isLoading = state === "starting" || state === "native" || busy;

  return (
    <MobileFinanceSheet
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="h-[min(88dvh,42rem)]"
      bodyClassName="pb-[calc(24px+env(safe-area-inset-bottom))]"
    >
      <div className="py-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              Câmera segura
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {content.title}
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {content.description}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar leitor"
            onClick={() => onOpenChange(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/40 bg-card"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn(mobileFinanceSurface, "mt-6 overflow-hidden p-2")}>
          <div className={cn(
            "relative overflow-hidden rounded-[18px] bg-black",
            mode === "boleto" ? "aspect-[16/9]" : "aspect-[3/4]",
          )}>
            <video
              ref={videoRef}
              muted
              autoPlay
              playsInline
              onLoadedMetadata={(event) => {
                event.currentTarget.play().catch(() => undefined);
              }}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  "relative border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]",
                  mode === "boleto"
                    ? "h-[24%] w-[88%] rounded-[12px]"
                    : "h-[46%] w-[76%] rounded-[22px]",
                )}
              >
                {mode === "boleto" ? (
                  <>
                    <span className="absolute left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-white/65" />
                    <span className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-white/35" />
                  </>
                ) : null}
              </div>
            </div>
            {mode === "boleto" ? (
              <div className="pointer-events-none absolute left-3 right-3 top-3 rounded-full bg-black/58 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur-md">
                Vire o celular na horizontal
              </div>
            ) : null}
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/72 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="mt-3 text-xs font-semibold">
                  {state === "native"
                    ? "Abrindo leitor nativo"
                    : mode === "boleto"
                      ? "Abrindo câmera em paisagem"
                      : "Solicitando câmera"}
                </p>
              </div>
            ) : null}
            {state === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/82 p-5 text-center text-white">
                <Camera className="h-7 w-7 opacity-75" />
                <p className="mt-4 text-sm font-semibold">Não conseguimos iniciar a câmera.</p>
                <p className="mt-2 text-xs leading-5 text-white/64">{error}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-[18px] border border-border/40 bg-card p-3 text-[11px] leading-4 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          <span>{content.hint}</span>
        </div>

        {state === "error" ? (
          <Button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="mt-4 h-14 w-full rounded-[20px] text-xs font-semibold uppercase tracking-[0.16em]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        ) : (
          <MobileFinanceButton
            variant="secondary"
            className="mt-4 w-full"
            onClick={() => onOpenChange(false)}
          >
            Inserir código manualmente
          </MobileFinanceButton>
        )}
      </div>
    </MobileFinanceSheet>
  );
}

function cameraErrorMessage(cause: unknown) {
  if (cause instanceof DOMException) {
    if (cause.name === "NotAllowedError") {
      return "Permita o acesso à câmera nas configurações do navegador ou do app.";
    }
    if (cause.name === "NotFoundError") {
      return "Nenhuma câmera foi encontrada neste dispositivo.";
    }
    if (cause.name === "NotReadableError") {
      return "A câmera está em uso por outro aplicativo.";
    }
  }

  return cause instanceof Error
    ? cause.message
    : "Verifique a permissão de câmera e tente novamente.";
}

function normalizeDetectedValue(mode: ScannerMode, value?: string | null) {
  const text = value?.trim();
  if (!text) return null;
  if (mode === "boleto") return findBoletoCandidate(text);
  return text;
}

async function waitForVideoElement(
  ref: RefObject<HTMLVideoElement>,
  isCancelled: () => boolean,
  timeoutMs = 4200,
) {
  const startedAt = Date.now();

  while (!isCancelled()) {
    if (ref.current) return ref.current;
    if (Date.now() - startedAt > timeoutMs) return null;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  return null;
}

async function startNativeBoletoScanner({
  video,
  onDetected,
  onInvalid,
}: {
  video: HTMLVideoElement;
  onDetected: (value: string) => Promise<void> | void;
  onInvalid: () => void;
}): Promise<{ stop: () => void } | null> {
  const Detector = (window as BarcodeWindow).BarcodeDetector;
  if (!Detector) return null;

  await lockLandscapeBestEffort();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 16 / 9 },
    },
  });

  let frame = 0;
  let stopped = false;
  const detector = new Detector({ formats: ["itf", "code_128", "codabar", "ean_13", "ean_8"] });
  video.srcObject = stream;
  await video.play();

  const stop = () => {
    stopped = true;
    if (frame) window.cancelAnimationFrame(frame);
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    void unlockOrientationBestEffort();
  };

  const scan = async () => {
    if (stopped) return;
    try {
      const barcodes = await detector.detect(video);
      for (const barcode of barcodes) {
        const candidate = normalizeDetectedValue("boleto", barcode.rawValue || barcode.displayValue || "");
        if (candidate) {
          stop();
          await onDetected(candidate);
          return;
        }
        if (barcode.rawValue || barcode.displayValue) onInvalid();
      }
    } catch (error) {
      stop();
      console.warn("[BoletoScanner] BarcodeDetector stopped", error);
      toast.error("Não foi possível manter a leitura nativa do boleto.");
      return;
    }
    if (!stopped) frame = window.requestAnimationFrame(scan);
  };

  frame = window.requestAnimationFrame(scan);
  return { stop };
}

async function lockLandscapeBestEffort() {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: ScreenOrientationLock) => Promise<void>;
  };
  await orientation?.lock?.("landscape").catch(() => undefined);
}

async function unlockOrientationBestEffort() {
  const orientation = screen.orientation as ScreenOrientation & {
    unlock?: () => void;
  };
  orientation?.unlock?.();
}
