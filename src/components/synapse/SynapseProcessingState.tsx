import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

export type SynapseProcessingMode = 'thinking' | 'responding' | 'executing';

const conciseStatusLabel = (value: string) => {
  const label = value.trim();
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (/preparando solicitacao|processando solicitacao/.test(normalized)) return 'Analisando solicitação';
  if (/organizando contexto dos pacientes/.test(normalized)) return 'Analisando pacientes';
  if (/consultando agenda clinica/.test(normalized)) return 'Acessando Agenda';
  if (/conferindo dados financeiros/.test(normalized)) return 'Acessando Financeiro';
  if (/preparando conteudo solicitado/.test(normalized)) return 'Preparando conteúdo';
  if (/aguardando confirmacao/.test(normalized)) return 'Aguardando sua decisão';
  if (/resposta pronta/.test(normalized)) return 'Preparando resposta';

  return label || 'Analisando solicitação';
};

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
      transition={{ duration: 2.05, ease: 'linear', repeat: Infinity }}
    >
      {children}
    </motion.span>
  );
};

export const SynapseProcessingState = ({
  label,
  reducedMotion,
}: {
  label: string;
  detail?: string;
  mode: SynapseProcessingMode;
  reducedMotion: boolean;
}) => {
  const displayLabel = conciseStatusLabel(label);

  return (
    <div
      className="synapse-desktop-thinking min-w-0 py-1.5"
      data-reduced-motion={reducedMotion ? 'true' : undefined}
    >
      <SynapseTextShimmer
        reducedMotion={reducedMotion}
        className="max-w-full truncate text-[11.5px] font-semibold leading-5 tracking-[-0.01em]"
      >
        {displayLabel}
      </SynapseTextShimmer>
    </div>
  );
};
