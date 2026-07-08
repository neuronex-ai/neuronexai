"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Calendar, FileText, Sparkles, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { text: "Resumo executivo da agenda", icon: Calendar, delay: 0 },
  { text: "Análise de tendências financeiras", icon: Wallet, delay: 0.08 },
  { text: "Elaborar documentação clínica", icon: FileText, delay: 0.16 },
  { text: "Planejar seguimento do paciente", icon: Sparkles, delay: 0.24 },
];

interface EmptyChatStateProps {
  onSuggestionClick: (text: string) => void;
}

export const EmptyChatState = ({ onSuggestionClick }: EmptyChatStateProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative z-10 flex h-full min-h-[560px] w-full flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-32 text-center">
      <div className="relative z-20 mb-8 max-w-2xl space-y-4 px-4">
        <motion.h2
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-medium leading-tight tracking-tight text-foreground antialiased md:text-5xl"
        >
          Olá! Vamos Começar?
        </motion.h2>
      </div>

      <div className="relative z-20 grid w-full max-w-3xl grid-cols-1 gap-4 px-6 md:grid-cols-2">
        {SUGGESTIONS.map((item) => (
          <motion.button
            key={item.text}
            type="button"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.12 + item.delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onSuggestionClick(item.text)}
            aria-label={`Iniciar conversa: ${item.text}`}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
            className={cn(
              "notes-liquid-surface group relative flex min-h-[112px] items-start gap-4 rounded-[24px] border p-5 text-left backdrop-blur-xl",
              "border-border/40 shadow-[0_18px_46px_-38px_hsl(var(--foreground)/0.38),inset_0_1px_0_hsl(var(--background)/0.78)]",
              "transition-[border-color,background-color,box-shadow,transform] duration-300 hover:scale-[1.012] hover:border-foreground/12 active:scale-[0.985]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "dark:border-white/[0.04] dark:bg-white/[0.028] dark:shadow-[0_22px_54px_-42px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.025)]",
              "dark:hover:border-white/[0.06] dark:hover:bg-white/[0.04] motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
            )}
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-border/30 bg-muted/45 text-muted-foreground shadow-sm transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground dark:border-white/[0.04] dark:bg-white/[0.035]">
              <item.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100" strokeWidth={1.5} />
            </div>

            <div className="flex h-full min-w-0 flex-col justify-center space-y-1">
              <span className="text-[14px] font-semibold tracking-tight text-foreground/84 transition-colors group-hover:text-foreground">
                {item.text}
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Sugestão Synapse
                </span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/65">
                  Iniciar
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
