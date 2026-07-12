"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BrainCircuit, FileText, ScanText } from "lucide-react";

interface RouteSelectionProps {
  onSelectRoute: (route: "import" | "template") => void;
}

const OPTIONS = [
  {
    route: "import" as const,
    title: "Importar documento",
    description: "Envie uma ficha existente para organizar os campos e revisar as respostas antes de salvar.",
    action: "Selecionar arquivo",
    icon: ScanText,
  },
  {
    route: "template" as const,
    title: "Usar um modelo",
    description: "Escolha uma estrutura clínica e preencha a anamnese durante o atendimento.",
    action: "Escolher modelo",
    icon: FileText,
  },
] as const;

export function RouteSelection({ onSelectRoute }: RouteSelectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="patient-record-panel relative overflow-hidden rounded-[30px] border px-5 py-8 sm:px-7 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,hsl(var(--foreground)/0.018),transparent_42%)] dark:bg-[linear-gradient(150deg,rgba(255,255,255,0.014),transparent_44%)]" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <header className="mx-auto max-w-2xl text-center">
          <span className="desktop-retina-inset mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/45 text-foreground">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Anamnese digital</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-foreground md:text-4xl">Como deseja começar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Importe uma ficha existente ou selecione um modelo para preencher com o paciente.
          </p>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {OPTIONS.map((option, index) => (
            <motion.button
              key={option.route}
              type="button"
              onClick={() => onSelectRoute(option.route)}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.04, duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              className="patient-record-card desktop-retina-interactive group flex min-h-[240px] flex-col rounded-[26px] border p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 md:p-7"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/50 bg-foreground text-background shadow-sm">
                <option.icon className="h-5 w-5" aria-hidden="true" />
              </span>

              <span className="mt-7 block text-xl font-bold tracking-tight text-foreground">{option.title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{option.description}</span>

              <span className="mt-auto flex items-center gap-2 border-t border-border/45 pt-5 text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground transition-colors group-hover:text-foreground">
                {option.action}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
