import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { SynapseNotesAgentRun } from "@/hooks/use-synapse-notes-agent-run";
import { cn } from "@/lib/utils";

interface SynapseAgentRunOverlayProps {
  run?: SynapseNotesAgentRun | null;
  title: string;
  className?: string;
  compact?: boolean;
}

const STATUS_COPY: Record<string, string> = {
  queued: "Organizando contexto",
  gathering: "Reunindo sinais clínicos",
  reasoning: "Relacionando evidências",
  drafting: "Estruturando resultado",
  applying: "Aplicando com segurança",
  completed: "Resultado conectado",
  failed: "Não foi possível concluir",
  cancelled: "Ação cancelada",
};

const FinishedIcon = ({ status }: { status: string }) =>
  status === "failed" || status === "cancelled" ? (
    <XCircle className="h-3.5 w-3.5 text-rose-400" />
  ) : (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  );

export const SynapseAgentRunOverlay = ({
  run,
  title,
  className,
  compact = false,
}: SynapseAgentRunOverlayProps) => {
  const shouldReduceMotion = Boolean(useReducedMotion());
  if (!run) return null;

  const isFinished = ["completed", "failed", "cancelled"].includes(run.status);
  const progress = Math.max(4, Math.min(100, run.progress || 0));

  return (
    <AnimatePresence>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, x: 6 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "pointer-events-none absolute bottom-5 right-5 z-[35] w-[min(276px,calc(100%-40px))] overflow-hidden rounded-[18px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(25,25,26,0.88),rgba(10,10,11,0.92))] px-3.5 py-3 text-white shadow-[0_20px_56px_-38px_rgba(255,255,255,0.18)] backdrop-blur-xl [.light_&]:border-zinc-200/70 [.light_&]:bg-white/88 [.light_&]:text-zinc-950 [.light_&]:shadow-zinc-900/10",
          compact && "max-w-[250px]",
          className,
        )}
        role="status"
        aria-live="off"
      >
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent [.light_&]:via-zinc-950/12" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-white/[0.07] bg-white/[0.045] [.light_&]:border-zinc-200 [.light_&]:bg-zinc-950/[0.03]">
            {isFinished ? (
              <FinishedIcon status={run.status} />
            ) : (
              <Loader2 className={cn("h-3.5 w-3.5 text-zinc-300 [.light_&]:text-zinc-600", !shouldReduceMotion && "animate-spin")} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="truncate text-[10px] font-semibold tracking-[0.02em]">{title}</h3>
              <span className="shrink-0 text-[9px] font-semibold tabular-nums text-zinc-400 [.light_&]:text-zinc-500">
                {Math.round(run.progress || 0)}%
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] text-zinc-400 [.light_&]:text-zinc-600">
              {STATUS_COPY[run.status] || "Processando"}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07] [.light_&]:bg-zinc-200">
              <motion.span
                className="block h-full rounded-full bg-zinc-100/85 [.light_&]:bg-zinc-950"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
