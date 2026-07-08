import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brain, CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SynapseNotesAgentRun } from "@/hooks/use-synapse-notes-agent-run";

interface SynapseAgentRunOverlayProps {
  run?: SynapseNotesAgentRun | null;
  title: string;
  className?: string;
  compact?: boolean;
}

const statusIcon = (status?: string) => {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-rose-400" />;
  if (status === "active") return <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-100 [.light_&]:text-zinc-900" />;
  return <span className="h-2 w-2 rounded-full bg-zinc-500/50" />;
};

export const SynapseAgentRunOverlay = ({
  run,
  title,
  className,
  compact = false,
}: SynapseAgentRunOverlayProps) => {
  const shouldReduceMotion = useReducedMotion();
  if (!run) return null;

  const steps = run.steps?.length ? run.steps : run.trace?.steps || [];
  const summary = run.trace?.summary || (typeof run.result?.summary === "string" ? run.result.summary : "");
  const isFinished = ["completed", "failed", "cancelled"].includes(run.status);

  return (
    <AnimatePresence>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "pointer-events-auto absolute z-[65] overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-4 text-white shadow-2xl shadow-black/20 backdrop-blur-3xl ring-1 ring-white/5 [.light_&]:border-zinc-200/70 [.light_&]:bg-white/70 [.light_&]:text-zinc-950 [.light_&]:shadow-zinc-900/10",
          compact ? "bottom-6 left-6 w-[320px]" : "bottom-8 left-8 w-[380px]",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_42%,rgba(255,255,255,0.04))] [.light_&]:bg-[linear-gradient(135deg,rgba(255,255,255,0.72),transparent_46%,rgba(0,0,0,0.03))]" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 [.light_&]:border-zinc-200 [.light_&]:bg-white/80">
                {isFinished ? <Sparkles className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.24em]">{title}</h3>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-400 [.light_&]:text-zinc-500">
                  {run.status} / {Math.round(run.progress || 0)}%
                </p>
              </div>
            </div>
            {!isFinished && <Loader2 className="mt-1 h-4 w-4 animate-spin text-zinc-300 [.light_&]:text-zinc-600" />}
          </div>

          <div className="h-1 overflow-hidden rounded-full bg-white/10 [.light_&]:bg-zinc-200">
            <motion.div
              className="h-full rounded-full bg-white [.light_&]:bg-zinc-950"
              initial={false}
              animate={{ width: `${Math.max(4, Math.min(100, run.progress || 0))}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
            />
          </div>

          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.slice(-5).map((step, index) => (
                <motion.div
                  key={`${step.title}-${step.at || index}`}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: shouldReduceMotion ? 0 : index * 0.035 }}
                  className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2 [.light_&]:border-zinc-200/80 [.light_&]:bg-white/70"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">{statusIcon(step.status)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase tracking-[0.14em]">{step.title}</p>
                    {step.description && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                        {step.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {summary && (
            <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-300 [.light_&]:text-zinc-700">
              {summary}
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
