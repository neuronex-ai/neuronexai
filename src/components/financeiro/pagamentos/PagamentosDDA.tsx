/**
 * ─── PagamentosDDA — Consulta DDA ───────────────────────────
 * Queries outstanding boletos via DDA (Débito Direto Autorizado)
 * through the NeuroFinance infrastructure.
 *
 * DDA boletos can be selected and routed to the scheduling flow.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    Search,
    Loader2,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    FileText,
    Clock,
    Barcode,
} from "lucide-react";
import { useDDABoletos } from "@/hooks/use-neurobank-scheduled-payments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PagamentosDDA() {
    const { data: ddaData, isLoading, refetch, isRefetching } = useDDABoletos();
    const [searchTerm, setSearchTerm] = useState("");

    const boletos = ddaData?.items || [];

    const filteredBoletos = boletos.filter((b) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            b.beneficiary_name?.toLowerCase().includes(term) ||
            b.payer_name?.toLowerCase().includes(term) ||
            b.content?.toLowerCase().includes(term) ||
            b.bank_name?.toLowerCase().includes(term)
        );
    });

    const overdueCount = boletos.filter((b) => b.overdue).length;
    const totalAmount = boletos.reduce((sum, b) => sum + (b.amount || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-[28px] bg-zinc-900 dark:bg-white border border-zinc-800 dark:border-zinc-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-black/5 text-white dark:text-zinc-900 flex items-center justify-center shadow-lg">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-white dark:text-zinc-900">
                            Consulta DDA
                        </h3>
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-0.5">
                            Boletos pendentes disponíveis no NeuroFinance
                        </p>
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className="ml-auto p-2.5 rounded-xl bg-white/10 dark:bg-black/5 text-white dark:text-zinc-900 hover:bg-white/20 dark:hover:bg-black/10 transition-colors"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-[20px] bg-white/60 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.06] text-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Total Boletos</span>
                    <span className="text-xl font-black text-zinc-900 dark:text-white">{boletos.length}</span>
                </div>
                <div className="p-4 rounded-[20px] bg-white/60 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.06] text-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Vencidos</span>
                    <span className={cn("text-xl font-black", overdueCount > 0 ? "text-red-500" : "text-emerald-500")}>{overdueCount}</span>
                </div>
                <div className="p-4 rounded-[20px] bg-white/60 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.06] text-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Valor Total</span>
                    <span className="text-lg font-black text-zinc-900 dark:text-white">{formatCurrency(totalAmount)}</span>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por beneficiário, banco ou código..."
                    className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white/60 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.06] text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/30 dark:focus:ring-white/30 transition-all"
                />
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-zinc-900 dark:text-white animate-spin mb-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Consultando DDA no NeuroFinance...
                    </span>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredBoletos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-[20px] bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <Barcode className="w-7 h-7 text-zinc-400" />
                    </div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-300">
                        {searchTerm ? "Nenhum boleto encontrado" : "Nenhum boleto pendente"}
                    </h4>
                    <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">
                        {searchTerm ? "Tente buscar por outro termo." : "Não há boletos pendentes no DDA da sua conta NeuroFinance no momento."}
                    </p>
                </div>
            )}

            {/* Boletos List */}
            {!isLoading && filteredBoletos.length > 0 && (
                <div className="space-y-2">
                    {filteredBoletos.map((boleto, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={cn(
                                "p-4 rounded-[20px] bg-white/60 dark:bg-white/[0.02] border transition-colors",
                                boleto.overdue
                                    ? "border-red-200/50 dark:border-red-500/10"
                                    : "border-zinc-200/50 dark:border-white/[0.06]"
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                                    boleto.overdue ? "bg-red-100 dark:bg-red-500/10" : "bg-zinc-100 dark:bg-white/10"
                                )}>
                                    {boleto.overdue ? (
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-white" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 truncate">
                                                {boleto.beneficiary_name || "Beneficiário não identificado"}
                                            </p>
                                            <p className="text-[9px] text-zinc-500 mt-0.5">
                                                {boleto.bank_name} ({boleto.bank_code})
                                            </p>
                                        </div>
                                        <span className="text-sm font-black text-zinc-900 dark:text-white whitespace-nowrap">
                                            {formatCurrency(boleto.amount)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-zinc-400" />
                                            <span className="text-[9px] text-zinc-400">
                                                Vence: {boleto.due_date ? format(new Date(boleto.due_date + "T12:00:00"), "dd MMM yyyy", { locale: ptBR }) : "—"}
                                            </span>
                                        </div>
                                        {boleto.overdue && (
                                            <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/10 text-[8px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
                                                Vencido
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-[9px] font-mono text-zinc-400 mt-1 truncate">
                                        {boleto.content}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
