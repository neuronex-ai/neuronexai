"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type SynapseAgentStepStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "needs-confirmation"
  | "failed"
  | "cancelled";

export type SynapseAgentIntegration = "gmail" | "google_calendar";

export type SynapseAgentPlanStep = {
  id: string;
  title: string;
  detail?: string;
  status: SynapseAgentStepStatus;
  toolName?: string;
  integration?: SynapseAgentIntegration;
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

const GmailLogo = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
    <path fill="#4285F4" d="M3.25 5.5 7 8.28v10.47H4.75a1.5 1.5 0 0 1-1.5-1.5V5.5Z" />
    <path fill="#34A853" d="M17 8.28 20.75 5.5v11.75a1.5 1.5 0 0 1-1.5 1.5H17V8.28Z" />
    <path fill="#FBBC04" d="M3.25 5.5 12 12l-1.76 2.08L3.25 8.9V5.5Z" />
    <path fill="#EA4335" d="M20.75 5.5V8.9L12 15.4 3.25 8.9V5.5L12 12l8.75-6.5Z" />
    <path fill="#C5221F" d="M20.75 5.5 12 12 3.25 5.5l1.14-.86a1.55 1.55 0 0 1 1.86 0L12 8.92l5.75-4.28a1.55 1.55 0 0 1 1.86 0l1.14.86Z" />
  </svg>
);

const GoogleCalendarLogo = () => (
  <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3.2" fill="#fff" />
    <path fill="#4285F4" d="M7.2 3H18a3 3 0 0 1 3 3v10.8L17.2 21H6a3 3 0 0 1-3-3V7.2L7.2 3Z" />
    <path fill="#34A853" d="M3 16.8 7.2 21H18a3 3 0 0 0 3-3v-1.2H3Z" />
    <path fill="#FBBC04" d="M3 7.2V18a3 3 0 0 0 3 3h1.2V7.2H3Z" />
    <path fill="#EA4335" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1.2H3V6Z" />
    <rect x="7.2" y="7.2" width="13.8" height="9.6" fill="#fff" />
    <text x="14.1" y="14.45" textAnchor="middle" fontSize="6.9" fontWeight="800" fill="#4285F4" fontFamily="Arial, sans-serif">31</text>
  </svg>
);

const IntegrationMark = ({ integration }: { integration: SynapseAgentIntegration }) => (
  <span
    className="flex h-[19px] w-[19px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06]"
    title={integration === "gmail" ? "Gmail" : "Google Agenda"}
  >
    {integration === "gmail" ? <GmailLogo /> : <GoogleCalendarLogo />}
  </span>
);

const StatusIcon = ({ status }: { status: SynapseAgentStepStatus }) => {
  if (status === "completed") {
    return <CheckCircle2 className="h-[17px] w-[17px] text-emerald-500" aria-hidden="true" />;
  }
  if (status === "in-progress") {
    return <CircleDotDashed className="h-[17px] w-[17px] text-blue-500" aria-hidden="true" />;
  }
  if (status === "needs-confirmation") {
    return <CircleAlert className="h-[17px] w-[17px] text-amber-500" aria-hidden="true" />;
  }
  if (status === "failed") {
    return <CircleX className="h-[17px] w-[17px] text-rose-500" aria-hidden="true" />;
  }
  if (status === "cancelled") {
    return <CircleX className="h-[17px] w-[17px] text-muted-foreground/60" aria-hidden="true" />;
  }
  return <Circle className="h-[17px] w-[17px] text-muted-foreground/55" aria-hidden="true" />;
};

const statusClassName = (status: SynapseAgentStepStatus) => {
  if (status === "completed") return "border-emerald-500/15 bg-emerald-500/[0.075] text-emerald-700 dark:text-emerald-300";
  if (status === "in-progress") return "border-blue-500/15 bg-blue-500/[0.075] text-blue-700 dark:text-blue-300";
  if (status === "needs-confirmation") return "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300";
  if (status === "failed") return "border-rose-500/20 bg-rose-500/[0.08] text-rose-700 dark:text-rose-300";
  return "border-border/50 bg-muted/55 text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.04]";
};

export const SynapseAgentPlan = ({ plan }: { plan: SynapseAgentPlanModel }) => {
  const shouldReduceMotion = useReducedMotion();
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  if (!plan.steps.length) return null;

  return (
    <motion.section
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.995 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="w-full min-w-0 overflow-hidden rounded-[18px] border border-zinc-950/[0.085] bg-white/76 shadow-[0_20px_55px_-46px_rgba(24,24,27,0.62),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl dark:border-white/[0.06] dark:bg-white/[0.035] dark:shadow-[0_22px_60px_-48px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.035)]"
      aria-label={plan.title || "Plano do Synapse"}
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-950/[0.055] px-3.5 py-2.5 dark:border-white/[0.04]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-zinc-950/[0.07] bg-zinc-950/[0.035] text-muted-foreground dark:border-white/[0.055] dark:bg-white/[0.04]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-foreground">
              {plan.title || "Plano do Synapse"}
            </p>
            <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">
              Acompanhamento em tempo real
            </p>
          </div>
        </div>
      </div>

      <LayoutGroup>
        <ul className="relative px-3 py-2.5">
          {plan.steps.length > 1 ? (
            <span
              className="pointer-events-none absolute bottom-[23px] left-[22px] top-[23px] border-l border-dashed border-muted-foreground/25"
              aria-hidden="true"
            />
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
                      canExpand && "cursor-pointer hover:bg-foreground/[0.035] dark:hover:bg-white/[0.035]",
                      !canExpand && "cursor-default",
                    )}
                    aria-expanded={canExpand ? isExpanded : undefined}
                  >
                    <motion.span
                      key={step.status}
                      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.82, rotate: -8 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
                      className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center bg-white/80 dark:bg-[#111113]"
                    >
                      <StatusIcon status={step.status} />
                    </motion.span>

                    {step.integration ? <IntegrationMark integration={step.integration} /> : null}

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[11.5px] font-medium leading-4 text-foreground",
                          step.status === "completed" && "text-foreground/72",
                          step.status === "cancelled" && "text-muted-foreground line-through",
                        )}
                      >
                        {step.title}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-semibold tracking-[0.01em]",
                        statusClassName(step.status),
                      )}
                    >
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
                        <p className="mb-1 ml-9 border-l border-dashed border-muted-foreground/20 px-3 py-1.5 text-[10px] font-medium leading-4 text-muted-foreground">
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
    </motion.section>
  );
};
