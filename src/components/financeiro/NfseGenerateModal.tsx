"use client";

import { ReactNode, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileCheck, FileText, Landmark, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";

import { InvoicesHistoryList } from "./invoice/InvoicesHistoryList";

type NfseView = "fiscal-nova" | "fiscal-lista" | "fiscal-dados";

interface NfseGenerateModalProps {
    children: ReactNode;
    onNavigate?: (view: NfseView) => void;
}

const options = [
    {
        view: "fiscal-nova" as const,
        title: "Nova Nota Fiscal",
        description: "Acesse a área de emissão de uma nova NFS-e.",
        icon: PlusCircle,
        tone: "bg-emerald-500/10 text-emerald-500",
    },
    {
        view: "fiscal-lista" as const,
        title: "Minhas Notas Fiscais",
        description: "Consulte notas emitidas, agendadas e seus respectivos status.",
        icon: FileCheck,
        tone: "bg-blue-500/10 text-blue-500",
    },
    {
        view: "fiscal-dados" as const,
        title: "Dados Fiscais",
        description: "Revise as informações usadas na emissão das notas.",
        icon: Landmark,
        tone: "bg-amber-500/10 text-amber-500",
    },
];

export const NfseGenerateModal = ({ children, onNavigate }: NfseGenerateModalProps) => {
    const [open, setOpen] = useState(false);

    const handleNavigate = (view: NfseView) => {
        setOpen(false);
        onNavigate?.(view);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="finance-modal-surface max-w-[760px] max-h-[90vh] bg-white dark:bg-[#0A0A0B] border-zinc-200 dark:border-white/5 p-0 overflow-hidden flex flex-col rounded-[48px] shadow-2xl z-[150] backdrop-blur-3xl outline-none [&>button]:hidden">
                <DialogHeader className="finance-separator px-10 py-8 border-b border-zinc-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 bg-zinc-50/50 dark:bg-white/[0.01]">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-[18px] bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xl">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em] leading-none mb-1.5">
                                Emissão de NFS-e
                            </DialogTitle>
                            <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.3em] opacity-60">Notas Fiscais de Serviço</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 p-8 bg-zinc-50/30 dark:bg-black/20 overflow-y-auto custom-scrollbar">
                    <div className="grid gap-3 md:grid-cols-3">
                        {options.map((option) => (
                            <motion.button
                                key={option.view}
                                type="button"
                                whileHover={{ y: -3 }}
                                onClick={() => handleNavigate(option.view)}
                                className="min-h-[190px] rounded-[28px] border border-zinc-200/70 bg-white p-5 text-left shadow-sm transition-colors hover:border-zinc-300 dark:border-white/5 dark:bg-zinc-900/50 dark:hover:border-white/15"
                            >
                                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-[16px] ${option.tone}`}>
                                    <option.icon className="h-5 w-5" />
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">{option.title}</h4>
                                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{option.description}</p>
                            </motion.button>
                        ))}
                    </div>

                    <div className="mt-8 border-t border-zinc-200 pt-7 dark:border-white/5">
                        <h5 className="mb-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Histórico de notas</h5>
                        <InvoicesHistoryList fiscalOnly heightClassName="h-[260px]" />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
