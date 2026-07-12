import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    BrainCircuit,
    Check,
    GitBranch,
    LoaderCircle,
    Network,
    ShieldCheck,
    TriangleAlert,
    X,
} from 'lucide-react';

import { useSynapse } from '@/context/SynapseProvider';
import { useSynapseNotesAgentRun } from '@/hooks/use-synapse-notes-agent-run';
import { getSynapseAssistedSurface, type SynapseAssistedProduct } from '@/lib/synapse-assisted-surface-registry';
import { cn } from '@/lib/utils';
import type { SynapseActionPhase } from '@/lib/synapse-interface-actions';

const PRODUCT_COPY: Record<SynapseAssistedProduct, { name: string; detail: string }> = {
    neuroview: { name: 'NeuroView', detail: 'Leitura clínica assistida' },
    neuroflow: { name: 'NeuroFlow', detail: 'Mapeamento clínico assistido' },
    neuropulse: { name: 'NeuroPulse', detail: 'Síntese causal assistida' },
};

const ACTION_PHASE_COPY: Record<SynapseActionPhase, string> = {
    preparing: 'Preparando',
    navigating: 'Abrindo espaço',
    focusing: 'Conectando resultado',
    completed: 'Pronto',
    error: 'Atenção',
};

const RUN_STATUS_COPY: Record<string, string> = {
    queued: 'Organizando contexto',
    gathering: 'Reunindo sinais clínicos',
    reasoning: 'Relacionando evidências',
    drafting: 'Estruturando resultado',
    applying: 'Aplicando com segurança',
    completed: 'Resultado conectado',
    failed: 'Não foi possível concluir',
    cancelled: 'Ação cancelada',
};

const productIcon = (product?: SynapseAssistedProduct) => {
    if (product === 'neuroflow') return GitBranch;
    if (product === 'neuropulse') return Network;
    return BrainCircuit;
};

const actionProgress = (phase?: SynapseActionPhase) => {
    if (phase === 'preparing') return 14;
    if (phase === 'navigating') return 42;
    if (phase === 'focusing') return 78;
    if (phase === 'completed') return 100;
    return 0;
};

const elapsedCopy = (elapsedMs: number) => {
    if (elapsedMs < 1000) return 'agora';
    const seconds = Math.floor(elapsedMs / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min`;
};

export const SynapseActionOrchestrator = () => {
    const shouldReduceMotion = useReducedMotion();
    const {
        actionExperience,
        cancelActionExperience,
        isVoiceToolActive,
        voicePhase,
        voiceActivityToolName,
        voiceActivityLabel,
        voiceActivityMessage,
        voiceActivityElapsedMs,
    } = useSynapse();
    const { run } = useSynapseNotesAgentRun(actionExperience?.runId);

    const assistedSurface = getSynapseAssistedSurface(voiceActivityToolName);
    const product = actionExperience?.product || assistedSurface?.product;
    const isVoiceActivity = isVoiceToolActive && Boolean(voiceActivityLabel);
    const isVisible = Boolean(actionExperience || isVoiceActivity);
    const isAwaitingConfirmation = !actionExperience && voicePhase === 'awaiting_confirmation';
    const isError = actionExperience?.phase === 'error' || run?.status === 'failed';
    const isCompleted = actionExperience?.phase === 'completed' || run?.status === 'completed';
    const ProductIcon = productIcon(product);
    const activeStep = run?.steps?.find((step) => step.status === 'active') || run?.steps?.at(-1);
    const progress = run
        ? Math.max(0, Math.min(100, run.progress || 0))
        : actionExperience
          ? actionProgress(actionExperience.phase)
          : undefined;
    const title = product
        ? (assistedSurface?.title || PRODUCT_COPY[product].name)
        : actionExperience?.label || voiceActivityLabel || 'Synapse';
    const eyebrow = product
        ? (assistedSurface?.detail || PRODUCT_COPY[product].detail)
        : 'Ação assistida na interface';
    const status = isAwaitingConfirmation
        ? 'Aguardando sua confirmação'
        : run
          ? RUN_STATUS_COPY[run.status] || 'Processando'
          : actionExperience
            ? ACTION_PHASE_COPY[actionExperience.phase]
            : 'Trabalhando em tempo real';
    const message = activeStep?.description
        || activeStep?.title
        || actionExperience?.message
        || voiceActivityMessage
        || (isAwaitingConfirmation
            ? 'Confirme por voz para criar o conteúdo.'
            : 'Você pode continuar acompanhando a tela enquanto eu preparo o resultado.');
    const canCancel = Boolean(
        actionExperience && !['completed', 'error'].includes(actionExperience.phase),
    );

    return (
        <AnimatePresence initial={false} mode="sync">
            {isVisible ? (
                <motion.aside
                    key={actionExperience?.id || `voice-${voiceActivityToolName}`}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.99 }}
                    transition={shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 390, damping: 38, mass: 0.76 }}
                    className={cn(
                        'pointer-events-auto relative w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-black/[0.08] bg-white/[0.88] p-3 text-foreground shadow-[0_22px_70px_-38px_rgba(0,0,0,0.62)] backdrop-blur-2xl',
                        'dark:border-white/[0.065] dark:bg-[linear-gradient(148deg,rgba(24,24,25,0.96),rgba(9,9,10,0.97))] dark:shadow-[0_24px_72px_-42px_rgba(255,255,255,0.12)]',
                    )}
                    aria-live="polite"
                    aria-label={`Synapse em ${title}: ${status}`}
                >
                    <div
                        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent dark:via-white/20"
                        aria-hidden="true"
                    />
                    <div className="flex min-w-0 items-start gap-3">
                        <motion.span
                            animate={shouldReduceMotion || isCompleted || isError
                                ? undefined
                                : { opacity: [0.76, 1, 0.76] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-black/[0.07] bg-black/[0.035]',
                                'dark:border-white/[0.07] dark:bg-white/[0.05]',
                                isError && 'text-rose-500',
                                isCompleted && 'text-emerald-500',
                            )}
                            aria-hidden="true"
                        >
                            {isError ? (
                                <TriangleAlert className="h-4 w-4" />
                            ) : isCompleted ? (
                                <Check className="h-4 w-4" />
                            ) : isAwaitingConfirmation ? (
                                <ShieldCheck className="h-4 w-4" />
                            ) : (
                                <ProductIcon className="h-4 w-4" />
                            )}
                        </motion.span>

                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-[12px] font-semibold leading-4">{title}</p>
                                {isVoiceActivity ? (
                                    <span className="shrink-0 rounded-full bg-black/[0.045] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground dark:bg-white/[0.055]">
                                        voz · {elapsedCopy(voiceActivityElapsedMs)}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {eyebrow}
                            </p>
                        </div>

                        {canCancel ? (
                            <button
                                type="button"
                                onClick={cancelActionExperience}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.07]"
                                aria-label="Cancelar ação assistida"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-3 rounded-[15px] border border-black/[0.055] bg-black/[0.025] px-3 py-2.5 dark:border-white/[0.055] dark:bg-black/20">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold text-foreground/90">{status}</p>
                            {!isCompleted && !isError && !isAwaitingConfirmation ? (
                                <LoaderCircle className={cn('h-3.5 w-3.5 text-muted-foreground', !shouldReduceMotion && 'animate-spin')} />
                            ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-[1.45] text-muted-foreground">{message}</p>

                        <div
                            className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/[0.065] dark:bg-white/[0.07]"
                            role="progressbar"
                            aria-label="Progresso da ação assistida"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                        >
                            {progress === undefined ? (
                                <motion.span
                                    className="block h-full w-1/3 rounded-full bg-foreground/72"
                                    animate={shouldReduceMotion ? { x: '100%' } : { x: ['-110%', '310%'] }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
                                />
                            ) : (
                                <motion.span
                                    className="block h-full rounded-full bg-foreground/72"
                                    initial={false}
                                    animate={{ width: `${Math.max(4, progress)}%` }}
                                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                />
                            )}
                        </div>
                    </div>
                </motion.aside>
            ) : null}
        </AnimatePresence>
    );
};
