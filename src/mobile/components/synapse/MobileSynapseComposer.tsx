import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Mic, Send, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface MobileSynapseComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoiceMode: () => void;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  isProcessing: boolean;
  isUploading?: boolean;
}

export function MobileSynapseComposer({
  value,
  onChange,
  onSend,
  onVoiceMode,
  isListening,
  onStartListening,
  onStopListening,
  isProcessing,
  isUploading = false,
}: MobileSynapseComposerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);
  const hasText = Boolean(value.trim());
  const state = isUploading
    ? "loading"
    : isProcessing
      ? "sending"
      : isListening
        ? "voice-listening"
        : isFocused
          ? "focused"
          : "default";

  return (
    <div className="mx-auto w-full max-w-lg">
      <AnimatePresence mode="wait">
        {isListening ? (
          <motion.p
            key="listening"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300"
          >
            <span className="synapse-dictation-dot" aria-hidden="true" />
            Transcrevendo para texto
          </motion.p>
        ) : isUploading ? (
          <motion.p
            key="uploading"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.16em] synapse-tertiary-text"
          >
            Enviando anexos...
          </motion.p>
        ) : null}
      </AnimatePresence>
      <motion.div
        data-state={state}
        animate={shouldReduceMotion ? undefined : { y: isFocused ? -2 : 0, scale: isFocused ? 1.006 : 1 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
        className="synapse-composer flex min-h-[68px] items-center gap-2.5 rounded-[26px] p-2"
      >
        <div className="relative min-w-0 flex-1">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            disabled={isProcessing || isUploading}
            placeholder="Mensagem..."
            className="synapse-input h-12 w-full rounded-[18px] px-4 pr-12 text-base font-medium disabled:opacity-50"
            aria-label="Mensagem para o Synapse"
          />
          <motion.button
            type="button"
            onClick={() => (isListening ? onStopListening() : onStartListening())}
            disabled={isProcessing || isUploading}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
            className={cn(
              "synapse-focusable absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[15px] transition disabled:opacity-45",
              isListening ? "synapse-dictation-active" : "synapse-control",
            )}
            aria-label={isListening ? "Parar transcricao" : "Transcrever por voz"}
            aria-pressed={isListening}
          >
            {isListening && !shouldReduceMotion ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-1 rounded-[13px] border border-current/22"
                animate={{ opacity: [0.28, 0.7, 0.28], scale: [0.92, 1.04, 0.92] }}
                transition={{ repeat: Infinity, duration: 1.65, ease: "easeInOut" }}
              />
            ) : null}
            <Mic className="relative z-10 h-4.5 w-4.5" />
          </motion.button>
        </div>

        <motion.button
          type="button"
          onClick={() => (hasText ? onSend() : onVoiceMode())}
          disabled={isProcessing || isUploading}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
          animate={shouldReduceMotion ? undefined : { rotate: hasText ? 0 : -6 }}
          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30 }}
          className={cn(
            "synapse-focusable flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] disabled:opacity-50",
            hasText ? "synapse-control-active" : "synapse-control",
          )}
          aria-label={hasText ? "Enviar mensagem" : "Abrir modo voz"}
        >
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : hasText ? <Send className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </motion.button>
      </motion.div>
    </div>
  );
}
