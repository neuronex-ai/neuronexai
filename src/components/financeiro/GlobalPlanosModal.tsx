"use client";

import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Crown, Package, User, LayoutGrid } from "lucide-react";
import { useAllPackages } from "@/hooks/use-all-packages";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";


export const GlobalPlanosModal = ({ children }: { children: ReactNode }) => {
    const { data: packages, isLoading } = useAllPackages();

    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="finance-modal-surface max-w-[900px] h-[85vh] bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 p-0 overflow-hidden flex flex-col rounded-[48px] shadow-2xl z-[150] backdrop-blur-3xl outline-none [&>button]:hidden">
                <DialogHeader className="px-10 py-8 border-b border-zinc-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 bg-zinc-50/50 dark:bg-white/[0.01]">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-[18px] bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none mb-1.5">
                                Planos & Pacotes
                            </DialogTitle>
                            <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.3em] opacity-60">Visão Geral de Todas as Vendas</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 p-10 bg-zinc-50/30 dark:bg-black/20 overflow-y-auto custom-scrollbar">
                    <div className="relative mb-8 min-h-[210px] overflow-hidden rounded-[34px] bg-zinc-950 p-7 text-white shadow-[0_28px_80px_-36px_rgba(0,0,0,0.75)] dark:bg-white dark:text-zinc-950">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.2),transparent_26%),linear-gradient(135deg,transparent,rgba(255,255,255,.06))] dark:bg-[radial-gradient(circle_at_85%_15%,rgba(0,0,0,.14),transparent_28%)]" />
                        <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/15 bg-white/10 dark:border-black/10 dark:bg-black/[0.04]">
                                    <Crown className="h-6 w-6" />
                                </div>
                                <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-300 dark:border-amber-600/20 dark:bg-amber-500/10 dark:text-amber-700">
                                    Premium · Em breve
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/45 dark:text-black/40">Nova experiência de recorrência</p>
                                <h3 className="mt-2 max-w-xl text-2xl font-black leading-tight tracking-[-0.03em]">
                                    Crie Pacotes Psicoterapêuticos por Assinatura
                                </h3>
                                <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/60 dark:text-black/55">
                                    Organize sessões recorrentes, cobrança automática e acompanhamento do pacote em uma única assinatura.
                                </p>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Skeleton className="h-40 rounded-[24px]" />
                            <Skeleton className="h-40 rounded-[24px]" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AnimatePresence>
                                {packages && packages.length > 0 ? packages.map((pkg, idx) => {
                                    const remaining = pkg.total_sessions - pkg.sessions_used - (pkg.sessions_reserved || 0);
                                    const isActive = remaining > 0 && pkg.status === 'active';

                                    return (
                                        <motion.div
                                            key={pkg.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={`p-6 rounded-[32px] border ${isActive ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/10 shadow-lg' : 'bg-transparent border-dashed border-zinc-200 dark:border-zinc-800 opacity-60'} flex flex-col justify-between`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <User className="h-3 w-3 text-zinc-400" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{pkg.patient.name}</p>
                                                    </div>
                                                    <h4 className="text-xl font-black text-zinc-900 dark:text-white leading-tight">
                                                        {pkg.description || `${pkg.total_sessions} Sessões`}
                                                    </h4>
                                                </div>
                                                <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                                    {isActive ? 'Ativo' : 'Concluído'}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-6">
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Progresso</p>
                                                    <p className="text-sm font-black text-zinc-900 dark:text-white">
                                                        {pkg.sessions_used} / {pkg.total_sessions} <span className="text-zinc-400 font-medium">sessões</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Valor Final</p>
                                                    <p className="text-sm font-black text-zinc-900 dark:text-emerald-400">
                                                        {(pkg.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                            </div>

                                        </motion.div>
                                    )
                                }) : (
                                    <div className="col-span-1 md:col-span-2 py-20 text-center flex flex-col items-center">
                                        <div className="w-16 h-16 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <LayoutGrid className="h-6 w-6 text-zinc-400" />
                                        </div>
                                        <h3 className="text-lg font-black text-zinc-900 dark:text-white">Nenhum pacote vendido</h3>
                                        <p className="text-sm text-zinc-500 mt-1">Crie planos para seus pacientes e gerencie os recebimentos aqui.</p>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
};
