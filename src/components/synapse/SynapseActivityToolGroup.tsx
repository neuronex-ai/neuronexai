import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDotDashed,
  CircleX,
  FileText,
  Mail,
  Search,
  Sparkles,
  UserRound,
  WalletCards,
  WandSparkles,
  Workflow,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';

import { cn } from '@/lib/utils';
import {
  formatSynapseElapsed,
  type SynapseAgentIntegration,
  type SynapseAgentToolCategory,
} from '@/lib/synapse-agent-presentation';
import { SynapseIntegrationMark } from './SynapseIntegrationMark';
import { SynapseLiquidGlassSurface } from './SynapseLiquidGlassSurface';
import { SynapseTextShimmer } from './SynapseProcessingState';

export type SynapseActivityGroupState = 'pending' | 'waiting' | 'completed' | 'interrupted';
export type SynapseActivityItemState = 'pending' | 'completed' | 'failed';

export type SynapseActivityToolItem = {
  id: string;
  toolName?: string;
  title: string;
  subtitle?: string;
  state: SynapseActivityItemState;
  category: SynapseAgentToolCategory;
  integration?: SynapseAgentIntegration;
  startedAt?: number;
  finishedAt?: number;
};

export type SynapseActivityGroupModel = {
  id: string;
  title: string;
  description?: string;
  state: SynapseActivityGroupState;
  startedAt: number;
  finishedAt?: number;
  tools: SynapseActivityToolItem[];
};

const CATEGORY_ICONS: Record<SynapseAgentToolCategory, ComponentType<{ className?: string }>> = {
  search: Search,
  patient: UserRound,
  calendar: Calendar,
  mail: Mail,
  finance: WalletCards,
  document: FileText,
  interface: Workflow,
  neuro: WandSparkles,
  generic: Sparkles,
};

const GROUP_LABELS: Record<SynapseActivityGroupState, string> = {
  pending: 'Em andamento',
  waiting: 'Aguardando confirmação',
  completed: 'Concluído',
  interrupted: 'Interrompido',
};

export const SynapseActivityToolGroup = ({ group }: { group: SynapseActivityGroupModel }) => {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [open, setOpen] = useState(group.state === 'pending' || group.state === 'waiting');

  useEffect(() => {
    if (group.state === 'pending' || group.state === 'waiting') setOpen(true);
    if (group.state === 'completed') {
      const timer = window.setTimeout(() => setOpen(false), 850);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [group.state]);

  const elapsed = formatSynapseElapsed((group.finishedAt || Date.now()) - group.startedAt);
  const isRunning = group.state === 'pending';

  return (
    <SynapseLiquidGlassSurface variant="card" className="rounded-[18px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[54px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            {isRunning ? (
              <SynapseTextShimmer reducedMotion={shouldReduceMotion} className="truncate text-[11.5px] font-semibold tracking-[-0.01em]">
                {group.title}
              </SynapseTextShimmer>
            ) : (
              <span className="truncate text-[11.5px] font-semibold tracking-[-0.01em] text-foreground/88">{group.title}</span>
            )}
            <span className="shrink-0 text-[8.5px] font-semibold text-muted-foreground/65">{GROUP_LABELS[group.state]}</span>
          </span>
          <span className="mt-0.5 block truncate text-[9.5px] text-muted-foreground">
            {group.description || `${group.tools.length} ${group.tools.length === 1 ? 'ação' : 'ações'}`}
          </span>
        </span>
        <span className="shrink-0 text-[8.5px] tabular-nums text-muted-foreground/60">{elapsed}</span>
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
            <div className="space-y-0.5 px-3.5 py-2.5">
              {group.tools.length ? group.tools.map((tool) => {
                const Icon = CATEGORY_ICONS[tool.category];
                const duration = tool.startedAt
                  ? formatSynapseElapsed((tool.finishedAt || Date.now()) - tool.startedAt)
                  : '';
                return (
                  <div key={tool.id} className="flex min-h-9 items-center gap-2.5 rounded-[11px] px-1.5 py-1.5">
                    {tool.integration ? (
                      <SynapseIntegrationMark integration={tool.integration} />
                    ) : (
                      <span className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border border-zinc-950/[0.06] bg-zinc-950/[0.035] text-muted-foreground dark:border-white/[0.05] dark:bg-white/[0.035]">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10.5px] font-medium leading-4 text-foreground/82">{tool.title}</span>
                      {tool.subtitle ? <span className="block truncate text-[9px] text-muted-foreground">{tool.subtitle}</span> : null}
                    </span>
                    {duration ? <span className="shrink-0 text-[8px] tabular-nums text-muted-foreground/55">{duration}</span> : null}
                    {tool.state === 'pending' ? (
                      <CircleDotDashed className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Em andamento" />
                    ) : tool.state === 'failed' ? (
                      <CircleX className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-label="Falhou" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Concluído" />
                    )}
                  </div>
                );
              }) : (
                <p className="px-1 py-2 text-[10px] text-muted-foreground">Nenhuma ferramenta foi necessária nesta execução.</p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SynapseLiquidGlassSurface>
  );
};
