import { motion, useReducedMotion } from 'framer-motion';
import { BrainCircuit, Check, GitBranch, Network, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';

import { useSynapse } from '@/context/SynapseProvider';
import {
    getSynapseAssistedSurfaceByProduct,
    type SynapseAssistedProduct,
} from '@/lib/synapse-assisted-surface-registry';
import { cn } from '@/lib/utils';

const iconForProduct = (product: SynapseAssistedProduct) => {
    if (product === 'neuroflow') return GitBranch;
    if (product === 'neuropulse') return Network;
    return BrainCircuit;
};

export const SynapseAssistedSurfaceStage = ({
    product,
    onDismiss,
}: {
    product: SynapseAssistedProduct;
    onDismiss?: () => void;
}) => {
    const shouldReduceMotion = useReducedMotion();
    const { voicePhase, voiceActivityMessage, isVoiceToolActive } = useSynapse();
    const surface = getSynapseAssistedSurfaceByProduct(product);
    const awaitingConfirmation = voicePhase === 'awaiting_confirmation';
    const ProductIcon = iconForProduct(product);
    const steps = awaitingConfirmation
        ? ['Confirmar', 'Preparar', 'Conectar']
        : ['Contexto', 'Raciocínio', 'Resultado'];

    useEffect(() => {
        if (isVoiceToolActive || !onDismiss) return;
        const timeout = window.setTimeout(onDismiss, 700);
        return () => window.clearTimeout(timeout);
    }, [isVoiceToolActive, onDismiss]);

    return (
        <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.055),transparent_56%)] px-6 [.light_&]:bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.035),transparent_58%)]"
            role="status"
            aria-live="polite"
        >
            <div className="w-full max-w-[470px] rounded-[28px] border border-white/[0.065] bg-[linear-gradient(148deg,rgba(25,25,26,0.92),rgba(9,9,10,0.95))] p-5 text-white shadow-[0_28px_90px_-55px_rgba(255,255,255,0.28)] backdrop-blur-2xl [.light_&]:border-zinc-200/80 [.light_&]:bg-white/88 [.light_&]:text-zinc-950 [.light_&]:shadow-zinc-950/10">
                <div className="flex items-center gap-3.5">
                    <motion.span
                        animate={shouldReduceMotion ? undefined : { opacity: [0.72, 1, 0.72] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] border border-white/[0.07] bg-white/[0.055] [.light_&]:border-zinc-200 [.light_&]:bg-zinc-950/[0.035]"
                        aria-hidden="true"
                    >
                        {awaitingConfirmation ? <ShieldCheck className="h-5 w-5" /> : <ProductIcon className="h-5 w-5" />}
                    </motion.span>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 [.light_&]:text-zinc-500">
                            Synapse · {surface?.title}
                        </p>
                        <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em]">
                            {awaitingConfirmation ? 'Aguardando sua confirmação' : 'Construindo junto com você'}
                        </h2>
                    </div>
                </div>

                <p className="mt-4 text-[12px] leading-relaxed text-zinc-400 [.light_&]:text-zinc-600">
                    {voiceActivityMessage || (awaitingConfirmation
                        ? 'A criação só começa depois que você confirmar por voz.'
                        : 'O contexto está sendo processado; o resultado será conectado a esta área assim que estiver pronto.')}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
                    {steps.map((step, index) => {
                        const active = awaitingConfirmation ? index === 0 : index === 1;
                        const completed = !awaitingConfirmation && index === 0;
                        return (
                            <div
                                key={step}
                                className={cn(
                                    'flex min-h-11 items-center gap-2 rounded-[14px] border border-white/[0.055] bg-black/20 px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500',
                                    '[.light_&]:border-zinc-200/80 [.light_&]:bg-zinc-950/[0.025]',
                                    active && 'border-white/[0.12] text-zinc-100 [.light_&]:border-zinc-300 [.light_&]:text-zinc-900',
                                    completed && 'text-zinc-300 [.light_&]:text-zinc-700',
                                )}
                            >
                                {completed ? (
                                    <Check className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600', active && 'bg-zinc-100 [.light_&]:bg-zinc-900')} />
                                )}
                                <span className="truncate">{step}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
};
