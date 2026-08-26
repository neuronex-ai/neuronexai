"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import {
  formatSynapseElapsed,
  type SynapseAgentIntegration,
} from "@/lib/synapse-agent-presentation";
import { SynapseIntegrationMark } from "./SynapseIntegrationMark";
import { SynapseLiquidGlassSurface } from "./SynapseLiquidGlassSurface";
import { SynapseTextShimmer } from "./SynapseProcessingState";

export type SynapseAgentStepStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "needs-confirmation"
  | "failed"
  | "cancelled";

export type { SynapseAgentIntegration } from "@/lib/synapse-agent-presentation";

export type SynapseAgentPlanStep = {
  id: string;
  title: string;
  detail?: string;
  status: SynapseAgentStepStatus;
  toolName?: string;
  integration?: SynapseAgentIntegration;
  startedAt?: number;
  durationMs?: number;
};

export type SynapseAgentPlanModel = {
  title?: string;
  steps: SynapseAgentPlanStep[];
};

const STATUS_LABELS: Record<SynapseAgentStepStatus, string> = {
  pending: "pendente",
  "in-progress": "em andamento",
  completed: "concluído",
  "needs-confirmation": "aguarda confirmação",
  failed: "falhou",
  cancelled: "cancelado",
};

const StatusIcon = ({ status }: { status: SynapseAgentStepStatus }) => {
  if (status === "completed") return <CheckCircle2 className="h-[16px] w-[16px] text-emerald-500" aria-hidden="true" />;
  if (status === "in-progress") return <CircleDotDashed className="h-[16px] w-[16px] text-blue-500" aria-hidden="true" />;
  if (status === "needs-confirmation") return <CircleAlert className="h-[16px] w-[16px] text-amber-500" aria-hidden="true" />;
  if (status === "failed") return <CircleX className="h-[16px] w-[16px] text-rose-500" aria-hidden="true" />;
  if (status === "cancelled") return <CircleX className="h-[16px] w-[16px] text-muted-foreground/60" aria-hidden="true" />;
  return <Circle className="h-[16px] w-[16px] text-muted-foreground/55" aria-hidden="true" />;
};

const statusClassName = (status: SynapseAgentStepStatus) => {
  if (status === "completed") return "border-emerald-500/12 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300";
  if (status === "in-progress") return "border-blue-500/14 bg-blue-500/[0.065] text-blue-700 dark:text-blue-300";
  if (status === "needs-confirmation") return "border-amber-500/18 bg-amber-500/[0.075] text-amber-700 dark:text-amber-300";
  if (status === "failed") return "border-rose-500/18 bg-rose-500/[0.075] text-rose-700 dark:text-rose-300";
  return "border-border/45 bg-muted/45 text-muted-foreground dark:border-white/[0.055] dark:bg-white/[0.035]";
};

export const SynapseAgentPlan = ({ plan }: { plan: SynapseAgentPlanModel }) => {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  const summary = useMemo(() => {
    const completed = plan.steps.filter((step) => step.status === "completed").length;
    const active = plan.steps.some((step) => step.status === "in-progress");
    const waiting = plan.steps.some((step) => step.status === "needs-confirmation");
    const failed = plan.steps.some((step) => step.status === "failed");
    const status = failed ? "Falha" : waiting ? "Confirmação" : active ? "Em andamento" : completed === plan.steps.length ? "Concluído" : "Preparando";
    return { completed, status };
  }, [plan.steps]);

  if (!plan.steps.length) return null;

  return (
    <motion.section
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.996 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      aria-label={plan.title || "Plano do Synapse"}
    >
      <SynapseLiquidGlassSurface variant="card" className="w-full min-w-0 rounded-[18px]">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex min-h-[50px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-expanded={!collapsed}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-zinc-950/[0.07] bg-zinc-950/[0.035] text-muted-foreground dark:border-white/[0.055] dark:bg-white/[0.04]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold tracking-[-0.01em] text-foreground">
                {plan.title || "Plano do Synapse"}
              </span>
              <span className="mt-0.5 block text-[9px] font-medium text-muted-foreground">
                {summary.completed}/{plan.steps.length} concluídas · {summary.status}
              </span>
            </span>
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200", !collapsed && "rotate-180")} aria-hidden="true" />
        </button>

        <AnimatePresence initial={false}>
          {!collapsed ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-zinc-950/[0.055] dark:border-white/[0.04]"
            >
              <LayoutGroup>
                <ul className="relative px-3 py-2.5">
                  {plan.steps.length > 1 ? (
                    <span className="pointer-events-none absolute bottom-[23px] left-[22px] top-[23px] border-l border-dashed border-muted-foreground/22" aria-hidden="true" />
                  ) : null}

                  <AnimatePresence initial={false} mode="popLayout">
                    {plan.steps.map((step, index) => {
                      const isExpanded = Boolean(expandedSteps[step.id]);
                      const canExpand = Boolean(step.detail);
                      return (
                        <motion.li
                          key={step.id}
                          layout
                          initial={shouldReduceMotion ? false : { opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -4 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 36, mass: 0.68 }}
                          className={cn(index > 0 && "mt-0.5")}
                        >
                          <button
                            type="button"
                            disabled={!canExpand}
                            onClick={() => canExpand && setExpandedSteps((current) => ({ ...current, [step.id]: !isExpanded }))}
                            className={cn(
                              "group relative flex min-h-10 w-full items-center gap-2 rounded-[12px] px-1.5 py-1.5 text-left transition-colors",
                              canExpand && "cursor-pointer hover:bg-foreground/[0.032] dark:hover:bg-white/[0.032]",
                              !canExpand && "cursor-default",
                            )}
                            aria-expanded={canExpand ? isExpanded : undefined}
                          >
                            <motion.span
                              key={step.status}
                              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.84, rotate: -8 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
                              className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center bg-white/74 dark:bg-[#111113]"
                            >
                              {step.status === "in-progress" && !shouldReduceMotion ? (
                                <motion.span
                                  className="absolute inset-[3px] rounded-full border border-blue-500/22"
                                  animate={{ scale: [0.78, 1.14, 0.78], opacity: [0.15, 0.6, 0.15] }}
                                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                  aria-hidden="true"
                                />
                              ) : null}
                              <StatusIcon status={step.status} />
                            </motion.span>

                            {step.integration ? <SynapseIntegrationMark integration={step.integration} /> : null}

                            <span className="min-w-0 flex-1">
                              {step.status === "in-progress" ? (
                                <SynapseTextShimmer reducedMotion={shouldReduceMotion} className="block truncate text-[11.5px] font-medium leading-4">
                                  {step.title}
                                </SynapseTextShimmer>
                              ) : (
                                <span className={cn(
                                  "block truncate text-[11.5px] font-medium leading-4 text-foreground",
                                  step.status === "completed" && "text-foreground/70",
                                  step.status === "cancelled" && "text-muted-foreground line-through",
                                )}>
                                  {step.title}
                                </span>
                              )}
                            </span>

                            {step.durationMs ? (
                              <span className="shrink-0 text-[8px] tabular-nums text-muted-foreground/55">{formatSynapseElapsed(step.durationMs)}</span>
                            ) : null}

                            <span className={cn(
                              "shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold tracking-[0.01em]",
                              statusClassName(step.status),
                            )}>
                              {STATUS_LABELS[step.status]}
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {canExpand && isExpanded ? (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                              >
                                <p className="mb-1 ml-9 border-l border-dashed border-muted-foreground/18 px-3 py-1.5 text-[10px] font-medium leading-4 text-muted-foreground">
                                  {step.detail}
                                </p>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </LayoutGroup>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </SynapseLiquidGlassSurface>
    </motion.section>
  );
};
