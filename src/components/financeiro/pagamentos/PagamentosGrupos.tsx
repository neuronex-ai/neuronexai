/**
 * ─── PagamentosGrupos — Meus Grupos de Pagamentos ───────────────
 * Lists local payment groups and their items.
 * Allows viewing group details, removing items, and submitting
 * pending groups for approval.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    RefreshCw,
    ChevronRight,
    Trash2,
    ArrowLeft,
    CheckCircle2,
    Clock,
    AlertCircle,
    XCircle,
    FolderOpen,
    Send,
} from "lucide-react";
import {
    usePaymentGroups,
    usePaymentGroupItems,
    useNeuroFinanceScheduledPayments,
} from "@/hooks/use-neurofinance-scheduled-payments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    DECODE: { label: "Decodificando", color: "text-amber-500 bg-amber-100 dark:bg-amber-500/10", icon: Clock },
    READ_DATA: { label: "Dados Lidos", color: "text-blue-500 bg-blue-100 dark:bg-blue-500/10", icon: CheckCircle2 },
    SUBMITTED: { label: "Submetido", color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10", icon: Send },
    PROCESSING: { label: "Processando", color: "text-amber-500 bg-amber-100 dark:bg-amber-500/10", icon: Clock },
    PROCESSED: { label: "Pago", color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10", icon: CheckCircle2 },
    SCHEDULED: { label: "Agendado", color: "text-blue-500 bg-blue-100 dark:bg-blue-500/10", icon: Clock },
    ERROR: { label: "Erro", color: "text-red-500 bg-red-100 dark:bg-red-500/10", icon: XCircle },
    DECODE_ERROR: { label: "Não foi possível ler", color: "text-red-500 bg-red-100 dark:bg-red-500/10", icon: XCircle },
    SCHEDULING_CANCELLED: { label: "Cancelado", color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-500/10", icon: XCircle },
};

function getStatusInfo(status: string) {
    return STATUS_MAP[status] || { label: "Em acompanhamento", color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-500/10", icon: AlertCircle };
}

export function PagamentosGrupos() {
    const { data: groupsData, isLoading, refetch, isRefetching } = usePaymentGroups();
    const { submitForApproval, removeGroupItem } = useNeuroFinanceScheduledPayments();
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const { data: itemsData, isLoading: isLoadingItems } = usePaymentGroupItems(selectedGroupId);

    const groups = groupsData?.groups || [];
    const groupItems = itemsData?.items || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-[28px] bg-zinc-900 dark:bg-white border border-zinc-800 dark:border-zinc-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-black/5 text-white dark:text-zinc-900 flex items-center justify-center shadow-lg">
                        <FolderOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-white dark:text-zinc-900">
                            Meus Grupos de Pagamentos
                        </h3>
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-0.5">
                            Histórico e acompanhamento de pagamentos no NeuroFinance
                        </p>
                    </div>
                    <button
                        onClick={() => { setSelectedGroupId(null); refetch(); }}
                        disabled={isRefetching}
                        className="ml-auto p-2.5 rounded-xl bg-white/10 dark:bg-black/5 text-white dark:text-zinc-900 hover:bg-white/20 dark:hover:bg-black/10 transition-colors"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* ─── Group List ───────────────────────────────────────── */}
                {!selectedGroupId && (
                    <motion.div
                        key="group-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                    >
                        {isLoading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 text-zinc-900 dark:text-white animate-spin mb-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Carregando grupos...
                                </span>
                            </div>
                        )}

                        {!isLoading && groups.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-14 h-14 rounded-[20px] bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-4">
                                    <FolderOpen className="w-7 h-7 text-zinc-400" />
                                </div>
                                <h4 className="text-sm font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-300">
                                    Nenhum grupo encontrado
                                </h4>
                                <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">
                                    Crie um agendamento de pagamentos para ver seus grupos aqui.
                                </p>
                            </div>
                        )}

                        {groups.map((group, idx) => {
                            const statusInfo = getStatusInfo(group.status);
                            const StatusIcon = statusInfo.icon;

                            return (
                                <motion.button
                                    key={group.group_id || idx}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => setSelectedGroupId(group.group_id)}
                                    className="w-full p-4 rounded-[20px] bg-white/60 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.06] hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", statusInfo.color)}>
                                            <StatusIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 truncate">
                                                    {group.description || "Grupo de pagamentos"}
                                                </p>
                                                <span className={cn("px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest", statusInfo.color)}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[9px] text-zinc-400">
                                                    {group.items_count} pagamento{group.items_count !== 1 ? "s" : ""}
                                                </span>
                                                <span className="text-[9px] text-zinc-400">
                                                    {group.created_at ? format(new Date(group.created_at), "dd MMM yyyy HH:mm", { locale: ptBR }) : "—"}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
                                    </div>
                                </motion.button>
                            );
                        })}
                    </motion.div>
                )}

                {/* ─── Group Detail ─────────────────────────────────────── */}
                {selectedGroupId && (
                    <motion.div
                        key="group-detail"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <button
                            onClick={() => setSelectedGroupId(null)}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Voltar aos Grupos
                        </button>

                        {isLoadingItems && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 text-zinc-900 dark:text-white animate-spin mb-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Carregando itens do grupo...
                                </span>
                            </div>
                        )}

                        {!isLoadingItems && groupItems.length === 0 && (
                            <div className="text-center py-8">
                                <p className="text-[10px] text-zinc-400">Nenhum item encontrado para este grupo.</p>
                            </div>
                        )}

                        {groupItems.map((item, idx) => {
                            const statusInfo = getStatusInfo(item.status || "READ_DATA");
                            const StatusIcon = statusInfo.icon;

                            return (
                                <div
                                    key={item.id || idx}
                                    className="p-4 rounded-[20px] bg-white/60 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.06]"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", statusInfo.color)}>
                                            <StatusIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black text-zinc-700 dark:text-zinc-200 truncate">
                                                        {item.description || `Item #${idx + 1}`}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={cn("px-1.5 py-0.5 rounded text-[7px] font-black uppercase", statusInfo.color)}>
                                                            {statusInfo.label}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-zinc-900 dark:text-white whitespace-nowrap">
                                                        {formatCurrency(item.amount || 0)}
                                                    </span>
                                                    {item.id && (
                                                        <button
                                                            onClick={() => removeGroupItem.mutate({ groupId: selectedGroupId, itemId: item.id! })}
                                                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {item.beneficiary_name && (
                                                <p className="text-[9px] text-zinc-500 mt-1">
                                                    Beneficiário: {item.beneficiary_name}
                                                </p>
                                            )}

                                            {item.due_date && (
                                                <p className="text-[9px] text-zinc-400 mt-0.5">
                                                    Vencimento: {format(new Date(item.due_date + "T12:00:00"), "dd/MM/yyyy")}
                                                </p>
                                            )}

                                            {item.error_message && (
                                                <p className="text-[9px] text-red-500 mt-1 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {getUserFacingErrorMessage(item.error_message, "payment")}
                                                </p>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Submit for Approval */}
                        {groupItems.length > 0 && (
                            <button
                                onClick={() => submitForApproval.mutate({ groupId: selectedGroupId })}
                                disabled={submitForApproval.isPending}
                                className="w-full h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 shadow-2xl transition-all"
                            >
                                {submitForApproval.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Enviar para Aprovação
                                    </>
                                )}
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
