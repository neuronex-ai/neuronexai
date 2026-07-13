import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowDownLeft,
    Loader2,
    RefreshCw,
    Search,
    CheckCircle2,
    Clock,
    XCircle,
    FileText,
    Undo2,
} from "lucide-react";
import { usePixRecebidos, usePixCobList } from "@/hooks/use-neurofinance-pix";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRefundPayment } from "@/hooks/use-neurofinance-payments";

type ViewTab = "recebidos" | "cobrancas";

export function PixReceber() {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState<ViewTab>("recebidos");
    const [searchTerm, setSearchTerm] = useState("");
    const { data: pixRecebidos, isLoading: isLoadingPix, refetch: refetchPix } = usePixRecebidos();
    const { data: cobList, isLoading: isLoadingCob, refetch: refetchCob } = usePixCobList();
    const { mutate: refundPayment, isPending: isRefunding } = useRefundPayment();

    useEffect(() => {
        const subview = new URLSearchParams(location.search).get("subview");
        setActiveTab(subview === "cobrancas" ? "cobrancas" : "recebidos");
    }, [location.search]);

    const handleRefund = (id: string) => {
        if (window.confirm("Confirma a devolução deste Pix? Revise o pagador e o valor antes de continuar.")) {
            refundPayment({ paymentId: id });
        }
    };

    const pixItems = useMemo(() => pixRecebidos?.payments || [], [pixRecebidos?.payments]);
    const cobItems = useMemo(() => cobList?.charges || [], [cobList?.charges]);
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredPixItems = useMemo(() => pixItems.filter((pix: any) => {
        if (!normalizedSearch) return true;
        const amount = Number(pix.gross_amount || pix.net_amount || 0) / 100;
        return `${pix.id || ""} ${pix.endToEndId || ""} ${pix.pagador?.nome || ""} ${amount}`.toLowerCase().includes(normalizedSearch);
    }), [normalizedSearch, pixItems]);

    const filteredCobItems = useMemo(() => cobItems.filter((cob: any) => {
        if (!normalizedSearch) return true;
        const amount = Number(cob.gross_amount || 0) / 100;
        return `${cob.id || ""} ${cob.txid || ""} ${cob.description || ""} ${cob.status || ""} ${amount}`.toLowerCase().includes(normalizedSearch);
    }), [cobItems, normalizedSearch]);

    const statusIcon = (status: string) => {
        switch (status?.toUpperCase()) {
            case "PAID":
            case "CONCLUIDA":
            case "RECEBIDO":
                return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
            case "PENDING":
            case "ATIVA":
            case "PENDENTE":
                return <Clock className="h-3.5 w-3.5 text-amber-500" />;
            case "FAILED":
            case "EXPIRED":
            case "REMOVIDA_PELO_USUARIO_RECEBEDOR":
            case "CANCELADA":
                return <XCircle className="h-3.5 w-3.5 text-red-500" />;
            default:
                return <Clock className="h-3.5 w-3.5 text-zinc-400" />;
        }
    };

    const statusLabel = (status: string) => {
        switch (status?.toUpperCase()) {
            case "PAID": return "Pago";
            case "CONCLUIDA": return "Concluída";
            case "PENDING": return "Pendente";
            case "ATIVA": return "Ativa";
            case "FAILED": return "Falhou";
            case "EXPIRED": return "Expirada";
            case "REMOVIDA_PELO_USUARIO_RECEBEDOR": return "Removida";
            default: return status || "—";
        }
    };

    const handleRefresh = () => {
        refetchPix();
        refetchCob();
    };

    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-5 dark:border-zinc-200 dark:bg-white sm:rounded-[28px] sm:p-6">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-lg dark:bg-black/5 dark:text-zinc-900 sm:h-12 sm:w-12">
                        <ArrowDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black uppercase tracking-tight text-white dark:text-zinc-900">Receber via Pix</h3>
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 sm:text-[10px]">Pix recebidos e cobranças pendentes</p>
                    </div>
                    <button onClick={handleRefresh} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-all hover:bg-white/20 dark:bg-black/5 dark:hover:bg-black/10" aria-label="Atualizar recebimentos">
                        <RefreshCw className="h-4 w-4 text-white dark:text-zinc-900" />
                    </button>
                </div>
            </div>

            <div className="flex gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-white/5 sm:gap-2">
                {[
                    { id: "recebidos" as ViewTab, label: "Recebidos", count: pixItems.length },
                    { id: "cobrancas" as ViewTab, label: "Cobranças", count: cobItems.length },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-[8px] font-black uppercase tracking-wider transition-all duration-300 sm:px-4 sm:text-[9px]",
                            activeTab === tab.id
                                ? "bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white"
                                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
                        )}
                    >
                        {tab.label}
                        <span className="rounded-md bg-zinc-200/80 px-1.5 py-0.5 text-[7px] font-black dark:bg-white/10">{tab.count}</span>
                    </button>
                ))}
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por ID, pagador, descrição ou valor"
                    className="h-11 w-full rounded-xl border border-zinc-200/50 bg-white/60 pl-10 pr-4 text-xs text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900/30 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-zinc-200 dark:focus:ring-white/30"
                />
            </div>

            <AnimatePresence mode="wait">
                {(isLoadingPix || isLoadingCob) ? (
                    <motion.div key="loading" className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-300 dark:text-zinc-600" />
                        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Consultando NeuroFinance...</p>
                    </motion.div>
                ) : (
                    <motion.div key={activeTab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                        {activeTab === "recebidos" && (
                            filteredPixItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <ArrowDownLeft className="mb-4 h-12 w-12 text-zinc-200 dark:text-zinc-700" />
                                    <p className="text-sm font-bold text-zinc-400">Nenhum Pix encontrado</p>
                                    <p className="mt-1 text-[10px] text-zinc-400">Recebimentos confirmados aparecerão aqui.</p>
                                </div>
                            ) : filteredPixItems.map((pix: any, index: number) => (
                                <div key={pix.endToEndId || pix.id || index} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-zinc-200/50 bg-white/60 p-4 transition-colors hover:bg-white dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10"><ArrowDownLeft className="h-4 w-4 text-emerald-500" /></div>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-zinc-900 dark:text-white">{pix.pagador?.nome || "Pagador não identificado"}</p>
                                        <p className="mt-0.5 truncate font-mono text-[9px] text-zinc-400">id: {pix.id || pix.endToEndId}</p>
                                        <p className="mt-1 text-[8px] text-zinc-400 sm:hidden">{pix.paid_at ? format(new Date(pix.paid_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}</p>
                                    </div>
                                    <div className="col-start-2 text-left sm:col-auto sm:text-right">
                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">+ R$ {((pix.gross_amount || pix.net_amount || 0) / 100).toFixed(2)}</p>
                                        <p className="mt-0.5 hidden text-[8px] text-zinc-400 sm:block">{pix.paid_at ? format(new Date(pix.paid_at), "dd/MM HH:mm", { locale: ptBR }) : "—"}</p>
                                    </div>
                                    <button onClick={() => handleRefund(pix.id)} disabled={isRefunding} className="col-start-1 row-start-2 flex h-9 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white sm:col-auto sm:row-auto" title="Devolver Pix">
                                        {isRefunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                                    </button>
                                </div>
                            ))
                        )}

                        {activeTab === "cobrancas" && (
                            filteredCobItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <FileText className="mb-4 h-12 w-12 text-zinc-200 dark:text-zinc-700" />
                                    <p className="text-sm font-bold text-zinc-400">Nenhuma cobrança encontrada</p>
                                    <p className="mt-1 text-[10px] text-zinc-400">Crie um QR Code ou cobrança para acompanhar aqui.</p>
                                </div>
                            ) : filteredCobItems.map((cob: any, index: number) => (
                                <div key={cob.txid || cob.id || index} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-zinc-200/50 bg-white/60 p-4 transition-colors hover:bg-white dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/5">{statusIcon(cob.status)}</div>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-bold text-zinc-900 dark:text-white">{cob.description || "Cobrança Pix"}</p>
                                        <p className="mt-0.5 truncate font-mono text-[9px] text-zinc-400">id: {cob.id || cob.txid}</p>
                                    </div>
                                    <div className="col-start-2 text-left sm:col-auto sm:text-right">
                                        <p className="text-sm font-black text-zinc-900 dark:text-white">R$ {((cob.gross_amount || 0) / 100).toFixed(2)}</p>
                                        <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-wider", cob.status === "ATIVA" ? "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" : cob.status === "CONCLUIDA" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400")}>{statusLabel(cob.status)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
