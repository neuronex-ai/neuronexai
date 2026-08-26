import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SynapseLiquidGlassSurface } from './SynapseLiquidGlassSurface';

export type SynapseProcessingMode = 'thinking' | 'responding' | 'executing';

export const SynapseTextShimmer = ({
  children,
  className,
  reducedMotion = false,
}: {
  children: string;
  className?: string;
  reducedMotion?: boolean;
}) => {
  if (reducedMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <motion.span
      className={cn(
        'inline-block bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text text-transparent',
        className,
      )}
      style={{ backgroundSize: '220% 100%' }}
      animate={{ backgroundPosition: ['200% 50%', '-20% 50%'] }}
      transition={{ duration: 2.15, ease: 'linear', repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
};

const MODE_LABEL: Record<SynapseProcessingMode, string> = {
  thinking: 'Analisando',
  responding: 'Finalizando',
  executing: 'Executando',
};

export const SynapseProcessingState = ({
  label,
  detail,
  mode,
  reducedMotion,
}: {
  label: string;
  detail?: string;
  mode: SynapseProcessingMode;
  reducedMotion: boolean;
}) => {
  return (
    <SynapseLiquidGlassSurface
      variant="subtle"
      className="synapse-desktop-thinking relative min-h-[58px] w-full max-w-[332px] rounded-[17px] px-3 py-2.5"
      data-activity={mode}
      data-reduced-motion={reducedMotion ? 'true' : undefined}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-950/[0.065] bg-white/52 dark:border-white/[0.055] dark:bg-white/[0.035]" aria-hidden="true">
          {!reducedMotion ? (
            <motion.span
              className="absolute inset-[5px] rounded-full border border-foreground/12"
              animate={{ scale: [0.82, 1.08, 0.82], opacity: [0.18, 0.55, 0.18] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null}
          <Sparkles className="relative z-10 h-3.5 w-3.5 text-foreground/78" />
        </span>

        <div className="min-w-0 flex-1">
          <SynapseTextShimmer
            reducedMotion={reducedMotion}
            className="max-w-full truncate text-[11.5px] font-semibold leading-4 tracking-[-0.01em]"
          >
            {label}
          </SynapseTextShimmer>

          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/78">
              {MODE_LABEL[mode]}
            </span>
            <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden="true" />
            <span className="min-w-0 truncate text-[10px] font-medium text-muted-foreground">
              {detail || 'Organizando a melhor resposta'}
            </span>
          </div>
        </div>
      </div>

      {!reducedMotion ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-1.5 h-px overflow-hidden rounded-full bg-foreground/[0.055]" aria-hidden="true">
          <motion.span
            className="block h-full w-[46%] rounded-full bg-gradient-to-r from-transparent via-foreground/46 to-transparent"
            initial={{ x: '-140%' }}
            animate={{ x: '310%' }}
            transition={{ duration: mode === 'executing' ? 1.35 : 1.7, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      ) : null}
    </SynapseLiquidGlassSurface>
  );
};
