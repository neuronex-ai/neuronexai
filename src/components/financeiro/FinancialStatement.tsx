"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion } from "framer-motion";
import {
    Activity,
    ArrowDownLeft,
    ArrowUpRight,
    CalendarDays,
    CheckCircle2,
    Clock,
    FileText,
    Landmark,
    User,
    XCircle,
} from "lucide-react";

import {
    getStatementOrigin,
    getStatementPaymentMethodLabel,
    getStatementStatusPresentation,
    groupStatementTransactionsByDate,
    sortStatementTransactions,
    type StatementSortOrder,
} from "@/components/financeiro/statement/statement-utils";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

interface FinancialStatementProps {
    transactions: Transaction[];
    isLoading?: boolean;
    onSelectTransaction?: (transaction: Transaction) => void;
    sortOrder?: StatementSortOrder;
    groupByDate?: boolean;
}

const originCopy = {
    neurofinance: { label: "NeuroFinance", icon: Landmark, tone: "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black dark:border-white" },
    manual: { label: "Lançamento gerencial", icon: FileText, tone: "bg-white text-zinc-900 border-zinc-200 dark:bg-transparent dark:text-zinc-400 dark:border-zinc-800" },
    agenda: { label: "Agenda", icon: CalendarDays, tone: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-white/[0.05] dark:text-zinc-300 dark:border-white/10" },
} as const;

function OriginTag({ transaction }: { transaction: Transaction }) {
    const origin = getStatementOrigin(transaction);
    const copy = originCopy[origin];
    const Icon = copy.icon;

    return (
        <div className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-widest", copy.tone)}>
            <Icon className="h-2.5 w-2.5" />
            {copy.label}
        </div>
    );
}

function MethodDetails({ transaction }: { transaction: Transaction }) {
    const installments = transaction.installments;
    const label = getStatementPaymentMethodLabel(transaction);

    return (
        <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-400">{label}</span>
            {installments && installments > 1 ? (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-zinc-900 dark:bg-white/10 dark:text-white">
                    {installments}X DE R$ {((transaction.amount || 0) / installments).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
            ) : null}
        </div>
    );
}

function TransactionRow({
    transaction,
    index,
    onSelectTransaction,
}: {
    transaction: Transaction;
    index: number;
    onSelectTransaction?: (transaction: Transaction) => void;
}) {
    const shouldReduceMotion = useReducedMotion();
    const isIncome = transaction.type === "income";
    const status = getStatementStatusPresentation(transaction);
    const patientName = transaction.patient_name || transaction.patients?.name;
    const StatusIcon = status.kind === "completed"
        ? CheckCircle2
        : ["cancelled", "failed", "overdue"].includes(status.kind)
            ? XCircle
            : Clock;

    return (
        <motion.button
            type="button"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { delay: Math.min(index, 8) * 0.035 }}
            onClick={() => onSelectTransaction?.(transaction)}
            className={cn(
                "group relative flex w-full items-center justify-between rounded-[24px] border p-4 text-left transition-all duration-300 md:p-5",
                "border-zinc-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.02]",
                "hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-lg dark:hover:border-white/[0.1] dark:hover:bg-white/[0.04]",
            )}
        >
            <div className="flex min-w-0 items-center gap-5">
                <div className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border transition-all",
                    isIncome
                        ? "border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        : "border-zinc-100 bg-zinc-50 text-zinc-400 dark:border-white/5 dark:bg-black/20 dark:text-zinc-600",
                )}>
                    {isIncome ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <h4 className="max-w-full truncate text-[11px] font-black uppercase leading-none tracking-tight text-zinc-900 transition-transform group-hover:translate-x-1 dark:text-white">
                            {transaction.description}
                        </h4>
                        <OriginTag transaction={transaction} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-400">
                            {transaction.date && !isNaN(new Date(transaction.date).getTime())
                                ? format(new Date(transaction.date), "dd 'de' MMM", { locale: ptBR })
                                : "DATA INDISPONÍVEL"}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <MethodDetails transaction={transaction} />

                        {patientName ? (
                            <>
                                <div className="h-1 w-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                                <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 dark:border-white/10 dark:bg-white/5">
                                    <User className="h-2.5 w-2.5 text-zinc-400" />
                                    <span className="text-[8px] font-black uppercase tracking-tight text-zinc-500 dark:text-zinc-400">{patientName}</span>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-baseline gap-1">
                    <span className={cn("text-[10px] font-light italic", isIncome ? "text-zinc-400" : "text-zinc-300")}>R$</span>
                    <span className={cn("text-lg font-black leading-none tracking-tighter", isIncome ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")}>
                        {Math.abs(transaction.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                </div>

                <div className={cn(
                    "flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest",
                    status.kind === "completed" ? "text-emerald-600 dark:text-emerald-400" :
                        ["cancelled", "failed", "overdue"].includes(status.kind) ? "text-rose-600 dark:text-rose-400" :
                            "text-amber-600 dark:text-amber-400",
                )}>
                    <StatusIcon className={cn("h-3 w-3", status.kind === "processing" && !shouldReduceMotion && "animate-pulse")} />
                    {status.label}
                </div>
            </div>
        </motion.button>
    );
}

export const FinancialStatement = ({
    transactions,
    isLoading,
    onSelectTransaction,
    sortOrder = "desc",
    groupByDate = false,
}: FinancialStatementProps) => {
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="h-20 w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-white/5" />
                ))}
            </div>
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/5">
                    <Activity className="h-6 w-6 text-zinc-300 dark:text-zinc-700" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Nenhuma movimentação</h3>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Os registros aparecerão aqui conforme ocorrerem.</p>
            </div>
        );
    }

    if (!groupByDate) {
        return (
            <div className="space-y-2">
                {sortStatementTransactions(transactions, sortOrder).map((transaction, index) => (
                    <TransactionRow key={transaction.id} transaction={transaction} index={index} onSelectTransaction={onSelectTransaction} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-7">
            {groupStatementTransactionsByDate(transactions, sortOrder).map((group) => (
                <section key={group.key} className="space-y-2">
                    <div className="flex items-center gap-3 px-1">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300">{group.label}</h3>
                        <div className="h-px flex-1 bg-zinc-200/80 dark:bg-white/[0.07]" />
                        <span className="text-[9px] font-bold text-zinc-400">{group.transactions.length}</span>
                    </div>
                    {group.transactions.map((transaction, index) => (
                        <TransactionRow key={transaction.id} transaction={transaction} index={index} onSelectTransaction={onSelectTransaction} />
                    ))}
                </section>
            ))}
        </div>
    );
};
