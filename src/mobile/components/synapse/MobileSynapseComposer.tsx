import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Mic, Send, Sparkles, X } from "lucide-react";

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
      {isUploading ? (
        <p className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.16em] synapse-tertiary-text">
          Enviando anexos...
        </p>
      ) : null}
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
            whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
            className={cn(
              "synapse-focusable absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[15px] transition",
              isListening ? "synapse-control-active" : "synapse-control",
            )}
            aria-label={isListening ? "Parar gravação" : "Falar"}
          >
            {isListening ? <X className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
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
