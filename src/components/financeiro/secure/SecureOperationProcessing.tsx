import { Check, Landmark, Loader2, Network, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Solicitação validada", icon: Network, state: "complete" },
  { label: "Enviando com segurança", icon: ShieldCheck, state: "active" },
  { label: "Confirmação bancária", icon: Landmark, state: "pending" },
] as const;

export function SecureOperationProcessing() {
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <section aria-busy="true" aria-label="Processando operação financeira" className="relative mx-auto min-h-[540px] max-w-3xl overflow-hidden rounded-[36px] border border-border/65 bg-card/85 p-8 text-card-foreground shadow-[0_42px_120px_-70px_hsl(var(--foreground)/0.72)] backdrop-blur-3xl md:p-12">
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-foreground/[0.045] blur-[110px]" />
      <div className="relative flex min-h-[440px] flex-col items-center justify-center">
        <div className="relative mb-10 flex h-28 w-28 items-center justify-center">
          <motion.div className="absolute inset-0 rounded-full border border-border/75" animate={reduceMotion ? undefined : { scale: [0.92, 1.16, 0.92], opacity: [0.3, 0.75, 0.3] }} transition={{ duration: 2.2, repeat: Infinity }} />
          <motion.div className="absolute inset-3 rounded-full border border-foreground/15" animate={reduceMotion ? undefined : { rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-background shadow-[0_24px_60px_-30px_hsl(var(--foreground)/0.75)]">
            <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" />
          </div>
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.28em] text-muted-foreground">NeuroFinance protegido</p>
        <motion.h3 aria-live="polite" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-center text-2xl font-black tracking-tight text-foreground md:text-3xl">
          Enviando com segurança
        </motion.h3>
        <p className="mt-3 max-w-md text-center text-xs leading-relaxed text-muted-foreground">Não feche esta tela enquanto a NeuroFinance envia a solicitação. A confirmação bancária será exibida somente quando houver retorno real.</p>
        <div className="mt-10 w-full max-w-lg space-y-2">
          {STEPS.map((step) => (
            <div key={step.label} className={cn(
              "flex items-center gap-3 rounded-[18px] border px-4 py-3 transition-all duration-500",
              step.state === "active" ? "border-foreground/15 bg-foreground/[0.07] text-foreground" : step.state === "complete" ? "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300" : "border-border/45 bg-background/20 text-muted-foreground/55",
            )}>
              <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-foreground/[0.05]">
                {step.state === "complete" ? <Check className="h-4 w-4" /> : step.state === "active" ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <step.icon className="h-4 w-4" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.12em]">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
