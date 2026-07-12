import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    Check,
    Focus,
    LoaderCircle,
    Navigation,
    TriangleAlert,
    X,
} from 'lucide-react';

import { useSynapse } from '@/context/SynapseProvider';
import { cn } from '@/lib/utils';
import type { SynapseActionPhase } from '@/lib/synapse-interface-actions';

const PHASES: Exclude<SynapseActionPhase, 'error'>[] = [
    'preparing',
    'navigating',
    'focusing',
    'completed',
];

const PHASE_COPY: Record<SynapseActionPhase, string> = {
    preparing: 'Preparando',
    navigating: 'Navegando',
    focusing: 'Em foco',
    completed: 'Concluído',
    error: 'Atenção',
};

const phaseIcon = (phase: SynapseActionPhase, className: string) => {
    if (phase === 'completed') return <Check className={className} />;
    if (phase === 'error') return <TriangleAlert className={className} />;
    if (phase === 'navigating') return <Navigation className={className} />;
    if (phase === 'focusing') return <Focus className={className} />;
    return <LoaderCircle className={className} />;
};

export const SynapseActionOrchestrator = () => {
    const shouldReduceMotion = useReducedMotion();
    const { actionExperience, cancelActionExperience } = useSynapse();
    const activeIndex = actionExperience?.phase === 'error'
        ? -1
        : PHASES.indexOf(actionExperience?.phase || 'preparing');
    const canCancel = Boolean(
        actionExperience && !['completed', 'error'].includes(actionExperience.phase),
    );

    return (
        <AnimatePresence initial={false} mode="wait">
            {actionExperience ? (
                <motion.aside
                    key={actionExperience.id}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.99 }}
                    transition={shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 430, damping: 40, mass: 0.72 }}
                    className={cn(
                        'pointer-events-auto w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[20px] border border-black/[0.08] bg-white/[0.86] p-2.5 text-foreground shadow-[0_18px_55px_-30px_rgba(0,0,0,0.55)] backdrop-blur-2xl',
                        'dark:border-white/[0.09] dark:bg-[linear-gradient(145deg,rgba(26,26,27,0.94),rgba(10,10,11,0.96))] dark:shadow-[0_20px_64px_-30px_rgba(255,255,255,0.14)]',
                    )}
                    aria-live="polite"
                    aria-label={`Synapse: ${PHASE_COPY[actionExperience.phase]}`}
                >
                    <div className="flex min-w-0 items-center gap-2.5">
                        <motion.span
                            animate={shouldReduceMotion || ['completed', 'error'].includes(actionExperience.phase)
                                ? undefined
                                : { scale: [1, 1.06, 1], opacity: [0.72, 1, 0.72] }}
                            transition={shouldReduceMotion
                                ? { duration: 0 }
                                : { duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] border bg-black/[0.035]',
                                'border-black/[0.07] dark:border-white/[0.08] dark:bg-white/[0.055]',
                                actionExperience.phase === 'error' && 'text-destructive',
                                actionExperience.phase === 'completed' && 'text-emerald-500',
                            )}
                            aria-hidden="true"
                        >
                            {phaseIcon(
                                actionExperience.phase,
                                cn(
                                    'h-4 w-4',
                                    actionExperience.phase === 'preparing' && !shouldReduceMotion && 'animate-spin',
                                ),
                            )}
                        </motion.span>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-[12px] font-semibold leading-4">
                                    {actionExperience.label}
                                </span>
                                <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                                    {PHASE_COPY[actionExperience.phase]}
                                </span>
                            </div>
                            <p className="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground">
                                {actionExperience.message}
                            </p>
                        </div>

                        {canCancel ? (
                            <button
                                type="button"
                                onClick={cancelActionExperience}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.07]"
                                aria-label="Cancelar ação do Synapse"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-2 flex items-center gap-1 px-0.5" aria-hidden="true">
                        {PHASES.map((phase, index) => (
                            <span
                                key={phase}
                                className={cn(
                                    'h-0.5 flex-1 rounded-full bg-black/[0.07] transition-colors dark:bg-white/[0.08]',
                                    activeIndex >= index && 'bg-foreground/65 dark:bg-white/70',
                                    actionExperience.phase === 'error' && 'bg-destructive/20',
                                )}
                            />
                        ))}
                    </div>
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
};
