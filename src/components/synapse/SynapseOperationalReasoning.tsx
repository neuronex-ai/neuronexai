import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatSynapseElapsed } from '@/lib/synapse-agent-presentation';
import { SynapseLiquidGlassSurface } from './SynapseLiquidGlassSurface';
import { SynapseTextShimmer } from './SynapseProcessingState';

export type SynapseReasoningStepStatus = 'pending' | 'active' | 'complete' | 'waiting' | 'error';

export type SynapseReasoningStep = {
  id: string;
  title: string;
  detail?: string;
  status: SynapseReasoningStepStatus;
  toolName?: string;
  durationMs?: number;
};

export type SynapseReasoningState = 'running' | 'waiting' | 'complete' | 'error';

const StepIcon = ({ status }: { status: SynapseReasoningStepStatus }) => {
  if (status === 'complete') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === 'active') return <CircleDotDashed className="h-3.5 w-3.5 text-blue-500" />;
  if (status === 'waiting') return <CircleAlert className="h-3.5 w-3.5 text-amber-500" />;
  if (status === 'error') return <CircleX className="h-3.5 w-3.5 text-rose-500" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground/55" />;
};

const STATE_LABEL: Record<SynapseReasoningState, string> = {
  running: 'Raciocínio em andamento',
  waiting: 'Raciocínio pausado',
  complete: 'Raciocínio concluído',
  error: 'Raciocínio interrompido',
};

export const SynapseOperationalReasoning = ({
  steps,
  state,
  startedAt,
  finishedAt,
}: {
  steps: SynapseReasoningStep[];
  state: SynapseReasoningState;
  startedAt?: number;
  finishedAt?: number;
}) => {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [open, setOpen] = useState(state === 'running');
  const previousState = useRef<SynapseReasoningState>(state);

  useEffect(() => {
    if (state === 'running') setOpen(true);
    if (previousState.current === 'running' && state !== 'running') {
      const timer = window.setTimeout(() => setOpen(false), 900);
      previousState.current = state;
      return () => window.clearTimeout(timer);
    }
    previousState.current = state;
    return undefined;
  }, [state]);

  const completedCount = steps.filter((step) => step.status === 'complete').length;
  const elapsed = useMemo(() => {
    if (!startedAt) return '';
    const end = finishedAt || Date.now();
    return formatSynapseElapsed(Math.max(0, end - startedAt));
  }, [finishedAt, startedAt]);

  if (!steps.length) return null;

  return (
    <SynapseLiquidGlassSurface variant="subtle" className="rounded-[16px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-zinc-950/[0.07] bg-zinc-950/[0.035] text-muted-foreground dark:border-white/[0.055] dark:bg-white/[0.04]">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {state === 'running' ? (
              <SynapseTextShimmer reducedMotion={shouldReduceMotion} className="truncate text-[11.5px] font-semibold tracking-[-0.01em]">
                {STATE_LABEL[state]}
              </SynapseTextShimmer>
            ) : (
              <span className="truncate text-[11.5px] font-semibold tracking-[-0.01em] text-foreground/88">
                {STATE_LABEL[state]}
              </span>
            )}
            <span className="shrink-0 text-[9px] font-medium text-muted-foreground/70">
              {completedCount}/{steps.length}
            </span>
          </span>
          <span className="mt-0.5 block text-[9px] font-medium text-muted-foreground/72">
            Etapas operacionais verificáveis{elapsed ? ` · ${elapsed}` : ''}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-zinc-950/[0.055] dark:border-white/[0.04]"
          >
            <div className="space-y-0.5 px-3 py-2.5">
              {steps.map((step, index) => (
                <div key={step.id} className="relative flex min-w-0 gap-2.5 py-1.5">
                  {index !== steps.length - 1 ? (
                    <span className="absolute bottom-[-7px] left-[6.5px] top-[20px] border-l border-dashed border-muted-foreground/20" aria-hidden="true" />
                  ) : null}
                  <span className="relative z-10 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center bg-white/75 dark:bg-[#111113]">
                    <StepIcon status={step.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[10.5px] font-medium leading-4 text-foreground/82', step.status === 'pending' && 'text-muted-foreground')}>
                      {step.title}
                    </span>
                    {step.detail ? (
                      <span className="mt-0.5 block text-[9.5px] leading-4 text-muted-foreground">
                        {step.detail}
                      </span>
                    ) : null}
                  </span>
                  {step.durationMs ? (
                    <span className="mt-0.5 shrink-0 text-[8.5px] tabular-nums text-muted-foreground/60">
                      {formatSynapseElapsed(step.durationMs)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SynapseLiquidGlassSurface>
  );
};
