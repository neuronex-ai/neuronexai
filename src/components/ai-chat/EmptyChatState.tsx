"use client";

import { cn } from "@/lib/utils";
import { BrainCircuit, Calendar, Wallet, FileText, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const SUGGESTIONS = [
  { text: "Resumo executivo da agenda", icon: Calendar, delay: 0 },
  { text: "Análise de tendências financeiras", icon: Wallet, delay: 0.1 },
  { text: "Elaborar documentação clínica", icon: FileText, delay: 0.2 },
  { text: "Planejar seguimento do paciente", icon: Sparkles, delay: 0.3 },
];

interface EmptyChatStateProps {
  onSuggestionClick: (text: string) => void;
}

const SynapsePromptMark = () => {
  return (
    <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] border border-border/55 bg-background/82 shadow-[0_22px_58px_-42px_hsl(var(--foreground)/0.55),inset_0_1px_0_hsl(var(--background))] backdrop-blur-2xl dark:border-white/[0.085] dark:bg-white/[0.052] dark:shadow-[0_24px_64px_-42px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-[linear-gradient(135deg,hsl(var(--background)/0.58),transparent_44%),radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.04),transparent_60%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_44%),radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.055),transparent_60%)]" />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/50 bg-muted/45 text-foreground dark:border-white/[0.08] dark:bg-white/[0.06]">
        <BrainCircuit className="h-5 w-5" strokeWidth={1.7} />
      </div>
    </div>
  );
};

export const EmptyChatState = ({ onSuggestionClick }: EmptyChatStateProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center justify-center w-full h-full flex-1 text-center relative z-10 overflow-hidden min-h-[600px] px-4 pb-32">

      {/* Hero Section */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8"
      >
        <SynapsePromptMark />
      </motion.div>

      {/* Welcome Text */}
      <div className="space-y-4 max-w-2xl px-4 relative z-20 mb-8">
        <motion.h2
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.1, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl md:text-5xl font-medium tracking-tight text-foreground leading-tight antialiased"
        >
          Olá! Vamos Começar?
        </motion.h2>
      </div>

      {/* Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl px-6 relative z-20">
        {SUGGESTIONS.map((item, i) => (
          <motion.button
            key={i}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.18 + item.delay, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onSuggestionClick(item.text)}
            aria-label={`Iniciar conversa: ${item.text}`}
            className={cn(
              "group relative flex items-start gap-4 p-5 rounded-[24px] text-left transition-all duration-500",
              "border border-border/45 bg-background/72 hover:border-border/70 hover:bg-background/88",
              "shadow-[0_18px_46px_-36px_hsl(var(--foreground)/0.42),inset_0_1px_0_hsl(var(--background)/0.82)] backdrop-blur-xl",
              "dark:border-white/[0.075] dark:bg-white/[0.045] dark:hover:bg-white/[0.07]",
              "hover:scale-[1.012] active:scale-[0.985] motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
            )}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
          >
            {/* Icon Container */}
            <div className="relative w-12 h-12 rounded-[18px] bg-secondary/30 border border-border/20 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-lg">
              <item.icon className="h-5 w-5 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.5} />
            </div>

            <div className="flex flex-col justify-center h-full space-y-1">
              <span className="text-[14px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors tracking-tight">
                {item.text}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black group-hover:text-muted-foreground/80 transition-colors">
                  Sugestão Synapse
                </span>
                <div className="w-1 h-1 rounded-full bg-border" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 font-bold group-hover:text-muted-foreground/80">
                  Iniciar
                </span>
              </div>
            </div>

            {/* Shine Effect */}
            <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          </motion.button>
        ))}
      </div>
    </div>
  );
};
