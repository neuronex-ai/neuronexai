import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles, Database, BrainCircuit, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: BrainCircuit, text: "Processando contexto..." },
  { icon: Search, text: "Analisando intenção..." },
  { icon: Database, text: "Consultando dados seguros..." },
  { icon: Sparkles, text: "Formulando resposta..." },
];

export const ThinkingIndicator = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 900);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);



  return (
    <div className="relative z-20 mb-8 flex w-full justify-start pl-6 animate-fade-in motion-reduce:animate-none">
      <div className="flex items-center gap-4 rounded-full border border-border/40 bg-background/74 p-3 pr-6 shadow-sm backdrop-blur-xl dark:border-white/[0.075] dark:bg-white/[0.045]">

        {/* Status dot */}
        <div className="relative flex items-center justify-center w-5 h-5">
          <div className={cn("absolute inset-0 rounded-full bg-foreground opacity-10", !shouldReduceMotion && "animate-ping")} />
          <div className={cn("relative h-2.5 w-2.5 rounded-full bg-foreground shadow-[0_0_10px_rgba(0,0,0,0.2)] dark:shadow-[0_0_10px_rgba(255,255,255,0.45)]", !shouldReduceMotion && "animate-pulse")} />
        </div>

        {/* Text Transition */}
        <div className="relative overflow-hidden flex flex-col justify-center min-w-[140px]">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStep}
              initial={shouldReduceMotion ? false : { y: 5, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { y: -5, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="text-[11px] font-medium text-muted-foreground tracking-wider uppercase"
            >
              {STEPS[currentStep].text}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
