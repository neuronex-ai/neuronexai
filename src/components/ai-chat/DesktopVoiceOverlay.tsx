import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff, RefreshCcw, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeminiVoice } from "@/hooks/use-gemini-voice";
import { useVoiceConfig } from "@/hooks/use-voice-config";
import { VoiceSpiral } from "./VoiceSpiral";

interface DesktopVoiceOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SYSTEM_INSTRUCTION = `Você é o Synapse por voz. Fale em português brasileiro de forma curta, natural e humana. Nunca leia rotas, links, códigos, IDs ou estruturas técnicas em voz alta.`;

const friendlyError = (error: string | null) => {
  if (!error) return null;
  if (error.includes("microfone") || error.includes("Microfone")) return error;
  if (error.includes("Sessao invalida") || error.includes("Sessão inválida")) return "Sua sessao expirou. Entre novamente para usar o modo voz.";
  if (/deepgram|gateway|settings|cartesia|websocket|DEEPGRAM_API_KEY/i.test(error)) return error;
  return "Nao consegui continuar a conversa por voz. Tente reiniciar a sessao.";
};

export const DesktopVoiceOverlay = ({ isOpen, onClose }: DesktopVoiceOverlayProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const autoStartedRef = useRef(false);

  const {
    isLoading: voiceConfigLoading,
    refresh: refreshVoiceConfig,
    error: voiceConfigError,
    provider: voiceProvider,
    gatewayUrl: voiceGatewayUrl,
    sessionId: voiceSessionId,
  } = useVoiceConfig();

  const handleResponseText = useCallback((text: string) => {
    setDisplayText(text);
  }, []);

  const {
    isConnected,
    isSpeaking,
    isListening,
    isProcessing,
    isToolActive,
    activeToolLabel,
    activeToolMessage,
    audioIntensity,
    getAudioVolume,
    lastResponse,
    startSession,
    endSession,
    toggleListening,
    error: runtimeError,
  } = useGeminiVoice({
    token: null,
    provider: voiceProvider,
    gatewayUrl: voiceGatewayUrl,
    sessionId: voiceSessionId,
    systemInstruction: SYSTEM_INSTRUCTION,
    language: "pt-BR",
    onResponseText: handleResponseText,
  });

  const error = friendlyError(runtimeError || voiceConfigError);
  const isBlockingBusy = isStarting || voiceConfigLoading || (isProcessing && !isToolActive);

  const beginSession = useCallback(async () => {
    if (isConnected || isStarting) return;
    setIsStarting(true);
    setDisplayText("Preparando a conversa...");
    try {
      const config = await refreshVoiceConfig();
      await startSession({
        token: config.token,
        model: config.model,
        voiceName: config.voiceName,
        gatewayUrl: config.gatewayUrl,
        provider: config.provider,
        sessionId: config.sessionId,
      });
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "Não foi possível iniciar o modo voz.";
      setDisplayText(friendlyError(message) || message);
    } finally {
      setIsStarting(false);
    }
  }, [isConnected, isStarting, refreshVoiceConfig, startSession]);

  useEffect(() => {
    if (!isOpen) {
      autoStartedRef.current = false;
      return;
    }

    if (!autoStartedRef.current) {
      autoStartedRef.current = true;
      void beginSession();
    }
  }, [beginSession, isOpen]);

  useEffect(() => {
    if (!isOpen && isConnected) endSession();
  }, [endSession, isConnected, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !isOpen) return;
      endSession();
      setDisplayText("");
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [endSession, isOpen, onClose]);

  useEffect(() => {
    if (error) {
      setDisplayText(error);
      return;
    }
    if (isStarting || voiceConfigLoading) {
      setDisplayText("Preparando a conversa...");
      return;
    }
    if (isSpeaking && lastResponse) return;
    if (isToolActive) {
      setDisplayText(activeToolMessage || (activeToolLabel ? `Consultando ${activeToolLabel}...` : "Consultando no sistema..."));
      return;
    }
    if (isProcessing) {
      setDisplayText("Pensando...");
      return;
    }
    if (isListening && !isSpeaking) {
      setDisplayText("Ouvindo você...");
      return;
    }
    if (isConnected) {
      setDisplayText("Pode falar naturalmente.");
      return;
    }
    setDisplayText("Toque para iniciar o Synapse por voz.");
  }, [activeToolLabel, activeToolMessage, error, isConnected, isListening, isProcessing, isSpeaking, isStarting, isToolActive, lastResponse, voiceConfigLoading]);

  const handleClose = useCallback(() => {
    endSession();
    autoStartedRef.current = false;
    setDisplayText("");
    onClose();
  }, [endSession, onClose]);

  const handleMainAction = useCallback(() => {
    if (!isConnected) {
      void beginSession();
      return;
    }
    toggleListening();
  }, [beginSession, isConnected, toggleListening]);

  const handleReset = useCallback(() => {
    endSession();
    setDisplayText("");
    window.setTimeout(() => void beginSession(), 180);
  }, [beginSession, endSession]);

  const status = error
    ? { label: "Requer atenção", tone: "danger" }
    : isSpeaking
      ? { label: "Respondendo", tone: "active" }
      : isToolActive
        ? { label: "Consultando", tone: "active" }
        : isBlockingBusy
          ? { label: "Pensando", tone: "neutral" }
          : isListening
            ? { label: "Ouvindo", tone: "success" }
            : isConnected
              ? { label: "Conectado", tone: "neutral" }
              : { label: "Synapse voz", tone: "neutral" };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28 }}
          className="fixed inset-0 z-[100] overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-[#030305] dark:text-white"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.24)_45%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015)_42%,rgba(0,0,0,0))]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/70 dark:bg-white/12" />

          <div className="absolute inset-x-0 top-14 bottom-[clamp(12.5rem,34vh,17rem)] z-10 flex min-h-0 items-center justify-center px-4">
            <motion.div
              initial={shouldReduceMotion ? false : { scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
              className="pointer-events-none h-[min(58vh,680px,calc(100vw-3rem))] w-[min(58vh,680px,calc(100vw-3rem))] max-h-full max-w-full opacity-75 mix-blend-multiply dark:opacity-90 dark:mix-blend-screen"
              style={{
                filter: isSpeaking
                  ? "hue-rotate(-16deg) brightness(1.18)"
                  : isToolActive
                    ? "hue-rotate(12deg) brightness(1.02)"
                  : isListening
                    ? "brightness(1.1)"
                    : error
                      ? "grayscale(0.6) brightness(0.75)"
                      : "brightness(0.82)",
                transition: "filter 0.25s ease",
              }}
            >
              {shouldReduceMotion ? (
                <div className="h-full w-full rounded-full border border-black/10 bg-[radial-gradient(circle,hsl(var(--foreground)/0.08),transparent_62%)] shadow-[inset_0_0_90px_hsl(var(--foreground)/0.08)] dark:border-white/10 dark:bg-[radial-gradient(circle,rgba(255,255,255,0.1),transparent_62%)]" />
              ) : (
                <VoiceSpiral
                  totalDots={640}
                  dotRadius={2.35}
                  duration={isSpeaking ? 1.45 : isToolActive ? 2.15 : isProcessing ? 2 : 3}
                  minOpacity={0.12}
                  maxOpacity={isListening || isSpeaking ? 1 : isToolActive ? 0.82 : 0.62}
                  minScale={0.3}
                  maxScale={isListening ? 2.35 : isSpeaking ? 1.9 : isToolActive ? 1.55 : 1.35}
                  getAudioVolume={getAudioVolume}
                  isListening={isListening}
                  isProcessing={isProcessing || isSpeaking || isToolActive}
                  useMultipleColors
                  colors={["#f8fafc", "#cbd5e1", "#64748b"]}
                />
              )}
            </motion.div>
          </div>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: shouldReduceMotion
                ? "radial-gradient(circle at center, hsl(var(--foreground)/0.045) 0%, transparent 52%)"
                : `radial-gradient(circle at center, hsl(var(--foreground)/${0.03 + audioIntensity * 0.1}) 0%, transparent 52%)`,
              transition: shouldReduceMotion ? "none" : "background 0.12s ease",
            }}
          />

          <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-end p-4 sm:p-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="pointer-events-auto h-11 w-11 rounded-full border border-black/10 bg-white/54 text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-2xl transition hover:bg-white/80 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.075] dark:text-white/72 dark:hover:bg-white/12 dark:hover:text-white sm:h-12 sm:w-12"
              aria-label="Fechar modo voz"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          <footer className="absolute inset-x-0 bottom-0 z-30 max-h-[46vh] overflow-y-auto bg-gradient-to-t from-zinc-50 via-zinc-50/96 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 dark:from-[#030305] dark:via-[#030305]/96 sm:px-6 sm:pb-6 sm:pt-10">
            <motion.div
              initial={shouldReduceMotion ? false : { y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.08, type: "spring", stiffness: 220, damping: 24 }}
              className="flex items-center justify-center gap-[clamp(0.85rem,3vw,1.25rem)]"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                disabled={isStarting || voiceConfigLoading}
                className="h-[clamp(3rem,7vh,3.5rem)] w-[clamp(3rem,7vh,3.5rem)] rounded-full border border-black/10 bg-white/50 text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl transition hover:bg-white/80 hover:text-zinc-950 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/55 dark:hover:bg-white/12 dark:hover:text-white"
                title="Reiniciar conversa"
                aria-label="Reiniciar conversa por voz"
              >
                <RefreshCcw className="h-5 w-5" />
              </Button>

              <Button
                onClick={handleMainAction}
                disabled={isStarting || voiceConfigLoading}
                className={cn(
                  "h-[clamp(4rem,10vh,5rem)] w-[clamp(4rem,10vh,5rem)] rounded-full border text-white shadow-[0_24px_64px_-30px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.22)] transition active:scale-95 disabled:opacity-60",
                  error
                    ? "border-rose-400/30 bg-rose-500 hover:bg-rose-500/90"
                    : "border-white/15 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:text-black dark:hover:bg-white/90",
                )}
                aria-label={isConnected ? "Alternar escuta do modo voz" : "Iniciar modo voz"}
              >
                {isListening ? <MicOff className="h-7 w-7 sm:h-8 sm:w-8" /> : isConnected ? <Mic className="h-7 w-7 sm:h-8 sm:w-8" /> : <Phone className="h-6 w-6 sm:h-7 sm:w-7" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-[clamp(3rem,7vh,3.5rem)] w-[clamp(3rem,7vh,3.5rem)] rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl transition hover:bg-rose-500/15"
                title="Encerrar chamada"
                aria-label="Encerrar chamada de voz"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </motion.div>

            <div className="mt-[clamp(0.75rem,2vh,1.25rem)] flex flex-col items-center gap-2 text-center sm:gap-3">
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-2xl sm:px-4 sm:py-2 sm:text-[10px]",
                  status.tone === "danger"
                    ? "border-rose-500/25 bg-rose-500/10 text-rose-500"
                    : status.tone === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                      : status.tone === "active"
                        ? "border-foreground/15 bg-muted/45 text-foreground"
                      : "border-black/10 bg-white/42 text-zinc-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-white/55",
                )}
              >
                {status.tone === "success" ? (
                  <span className="flex gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full bg-current", !shouldReduceMotion && "animate-pulse")} />
                    <span className={cn("h-1.5 w-1.5 rounded-full bg-current", !shouldReduceMotion && "animate-pulse [animation-delay:0.18s]")} />
                    <span className={cn("h-1.5 w-1.5 rounded-full bg-current", !shouldReduceMotion && "animate-pulse [animation-delay:0.32s]")} />
                  </span>
                ) : isSpeaking ? (
                  <span className="flex h-4 items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((item) => (
                      <span
                        key={item}
                        className={cn("w-0.5 rounded-full bg-current", !shouldReduceMotion && "animate-[audio-wave_0.72s_ease-in-out_infinite]")}
                        style={{ height: `${6 + item * 1.7}px`, animationDelay: shouldReduceMotion ? undefined : `${item * 0.08}s` }}
                      />
                    ))}
                  </span>
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
                <span>{status.label}</span>
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={displayText.slice(0, 42)}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  className={cn(
                    "max-w-[min(42rem,92vw)] text-xs font-semibold leading-relaxed transition-colors sm:text-sm",
                    error
                      ? "text-rose-500"
                      : isConnected
                        ? "text-zinc-700 dark:text-white/70"
                        : "text-zinc-500 dark:text-white/42",
                  )}
                >
                  {displayText || "Synapse por voz"}
                </motion.p>
              </AnimatePresence>

              <div className="rounded-full border border-black/5 bg-white/32 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:text-white/24 sm:px-5 sm:py-2 sm:text-[10px]">
                ESC para fechar · fale naturalmente
              </div>
            </div>
          </footer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
