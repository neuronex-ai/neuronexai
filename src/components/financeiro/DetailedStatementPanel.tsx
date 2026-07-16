"use client";

import { useEffect, useMemo, useState } from "react";
import { addYears, isAfter, subMonths } from "date-fns";
import {
    Activity,
    ArrowDownLeft,
    ArrowDownWideNarrow,
    ArrowUpRight,
    ArrowUpNarrowWide,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Landmark,
    Loader2,
    Printer,
    RefreshCw,
    Search,
    Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
    AdvancedFilterPopover,
    FilterCheckGroup,
    FilterDateGroup,
} from "@/components/financeiro/AdvancedFilterPopover";
import { FinancialStatement } from "@/components/financeiro/FinancialStatement";
import {
    countDetailedStatementFilters,
    emptyDetailedStatementFilters,
    filterDetailedStatementTransactions,
    isPixReceivedStatementPreset,
    sortStatementTransactions,
    togglePixReceivedStatementPreset,
    type DetailedStatementFilters,
    type StatementOriginFilter,
    type StatementPaymentMethodFilter,
    type StatementSortOrder,
    type StatementTransferMethodFilter,
} from "@/components/financeiro/statement/statement-utils";
import { StatementPrintModal } from "@/components/financeiro/statement/StatementPrintModal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNeuroFinanceBalance } from "@/hooks/use-neurofinance-balance";
import { useNeuroFinanceStatement } from "@/hooks/use-neurofinance-statement";
import { usePatients } from "@/hooks/use-patients";
import { useTransactions } from "@/hooks/use-transactions";
import { cn, formatCurrency } from "@/lib/utils";
import { toUserFacingError } from "@/lib/user-facing-error";
import type { Transaction } from "@/types";

export type DetailedStatementTab = "realizado" | "futuro" | "assinaturas";

interface DetailedStatementPanelProps {
    tab: DetailedStatementTab;
    onTabChange: (tab: DetailedStatementTab) => void;
    onSelectTransaction: (transaction: Transaction) => void;
    initialPixReceivedFilter?: boolean;
}

const paymentMethodOptions: { id: StatementPaymentMethodFilter; label: string }[] = [
    { id: "pix", label: "Pix" },
    { id: "boleto", label: "Boleto" },
    { id: "card", label: "Cartão" },
    { id: "cash", label: "Dinheiro" },
    { id: "convenio", label: "Convênio" },
    { id: "external_transfer", label: "Transferência externa" },
    { id: "manual", label: "Lançamento gerencial" },
    { id: "other", label: "Outro" },
];

const originOptions: { id: StatementOriginFilter; label: string }[] = [
    { id: "neurofinance", label: "NeuroFinance" },
    { id: "manual", label: "Lançamento gerencial" },
    { id: "agenda", label: "Agenda" },
];

const transferMethodOptions: { id: StatementTransferMethodFilter; label: string }[] = [
    { id: "pix", label: "Via Pix" },
];

const STATEMENT_PAGE_SIZE = 18;

function toggleFilterValue<T extends string>(values: T[], value: T) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function mergeTransactions(manual: Transaction[], neuroFinance: Transaction[]) {
    const merged = new Map<string, Transaction>();

    for (const transaction of manual) {
        merged.set(transaction.external_reference || transaction.id, transaction);
    }

    for (const transaction of neuroFinance) {
        merged.set(transaction.external_reference || transaction.id, transaction);
    }

    return Array.from(merged.values());
}

function KpiCard({
    label,
    value,
    hidden,
    isLoading,
    icon: Icon,
}: {
    label: string;
    value: number;
    hidden: boolean;
    isLoading: boolean;
    icon: typeof Wallet;
}) {
    return (
        <div className="group relative min-h-[112px] overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/78 p-5 shadow-[0_16px_44px_-38px_rgba(24,24,27,0.4)] transition-colors duration-300 hover:border-zinc-300 dark:border-white/[0.055] dark:bg-[#0b0c0e]/88 dark:hover:border-white/15">
            <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.016] dark:opacity-[0.035]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 to-transparent dark:from-white/[0.025]" />
            <div className="relative z-10">
                <div className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-50 text-zinc-400 shadow-sm transition-colors duration-300 group-hover:text-zinc-900 dark:border-white/[0.06] dark:bg-white/[0.035] dark:group-hover:text-white">
                    <Icon className="h-5 w-5" />
                </div>
                <p className="pr-14 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 transition-colors group-hover:text-zinc-900 dark:group-hover:text-white">{label}</p>
                {isLoading ? (
                    <Skeleton className="mt-4 h-8 w-32 rounded-lg" />
                ) : (
                    <p className="mt-4 text-2xl font-black tracking-tighter text-black tabular-nums dark:text-white">
                        {hidden ? "R$ ••••••" : formatCurrency(value)}
                    </p>
                )}
            </div>
        </div>
    );
}

export function DetailedStatementPanel({
    tab,
    onTabChange,
    onSelectTransaction,
    initialPixReceivedFilter = false,
}: DetailedStatementPanelProps) {
    const [filters, setFilters] = useState<DetailedStatementFilters>(() =>
        initialPixReceivedFilter
            ? togglePixReceivedStatementPreset(emptyDetailedStatementFilters())
            : emptyDetailedStatementFilters(),
    );
    const [sortOrder, setSortOrder] = useState<StatementSortOrder>("desc");
    const [showValues, setShowValues] = useState(true);
    const [page, setPage] = useState(1);

    const queryStart = useMemo(
        () => filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : subMonths(new Date(), 3),
        [filters.startDate],
    );
    const queryEnd = useMemo(
        () => filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : addYears(new Date(), 2),
        [filters.endDate],
    );

    const transactionsQuery = useTransactions(queryStart, queryEnd, 1000);
    const statementQuery = useNeuroFinanceStatement(queryStart, queryEnd);
    const { data: patients = [] } = usePatients();
    const {
        data: balance,
        isLoading: isLoadingBalance,
        syncNow,
        isSyncing,
    } = useNeuroFinanceBalance();

    const allTransactions = useMemo(
        () => mergeTransactions(transactionsQuery.data || [], statementQuery.data || []),
        [statementQuery.data, transactionsQuery.data],
    );

    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const tabTransactions = allTransactions.filter((transaction) => {
            if (tab === "assinaturas") {
                const text = `${transaction.description || ""} ${transaction.category || ""}`.toLowerCase();
                return text.includes("assinatura") || text.includes("recorr");
            }

            const isFuture = isAfter(new Date(transaction.date), now);
            if (tab === "futuro") return isFuture || transaction.status === "pending";
            return !isFuture && transaction.status === "completed";
        });

        return filterDetailedStatementTransactions(tabTransactions, filters, patients);
    }, [allTransactions, filters, patients, tab]);

    const sortedTransactions = useMemo(
        () => sortStatementTransactions(filteredTransactions, sortOrder),
        [filteredTransactions, sortOrder],
    );
    const printSummary = useMemo(() => {
        const income = sortedTransactions
            .filter((transaction) => transaction.type === "income")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
        const expense = sortedTransactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

        return { income, expense, balance: income - expense };
    }, [sortedTransactions]);
    const pageCount = Math.max(1, Math.ceil(sortedTransactions.length / STATEMENT_PAGE_SIZE));
    const paginatedTransactions = useMemo(
        () => sortedTransactions.slice((page - 1) * STATEMENT_PAGE_SIZE, page * STATEMENT_PAGE_SIZE),
        [page, sortedTransactions],
    );

    useEffect(() => {
        setPage(1);
    }, [filters, sortOrder, tab]);

    useEffect(() => {
        setPage((current) => Math.min(current, pageCount));
    }, [pageCount]);

    const activeFilters = countDetailedStatementFilters(filters);
    const isLoading = allTransactions.length === 0 &&
        (transactionsQuery.isLoading || statementQuery.isLoading);
    const pixReceivedFilterActive = isPixReceivedStatementPreset(filters);

    const updateFilter = <K extends keyof DetailedStatementFilters>(key: K, value: DetailedStatementFilters[K]) => {
        setFilters((current) => ({ ...current, [key]: value }));
    };

    const handleSync = async () => {
        try {
            await syncNow();
            await Promise.all([transactionsQuery.refetch(), statementQuery.refetch()]);
            toast.success("Dados financeiros atualizados.");
        } catch (error) {
            const friendlyError = toUserFacingError(error, "balance");
            toast.error(friendlyError.title, { description: friendlyError.message });
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Saldo disponível" value={balance.balance} hidden={!showValues} isLoading={isLoadingBalance} icon={Wallet} />
                <KpiCard label="Quanto entrou" value={balance.totalReceived} hidden={!showValues} isLoading={isLoadingBalance} icon={ArrowUpRight} />
                <KpiCard label="Quanto saiu" value={balance.paidOut} hidden={!showValues} isLoading={isLoadingBalance} icon={ArrowDownLeft} />
                <KpiCard label="Quanto vai cair" value={balance.pending} hidden={!showValues} isLoading={isLoadingBalance} icon={Calendar} />
            </div>

            <div className="flex flex-col gap-4 rounded-[24px] border border-zinc-200/60 bg-white/55 p-3 backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.018] xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {([
                        { id: "realizado", label: "Realizado", icon: Activity },
                        { id: "futuro", label: "Futuro e pendente", icon: Calendar },
                        { id: "assinaturas", label: "Assinaturas", icon: Landmark },
                    ] as const).map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "flex h-10 items-center gap-2 rounded-[14px] px-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all",
                                tab === item.id
                                    ? "bg-zinc-950 text-white shadow-md dark:bg-white dark:text-zinc-950"
                                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/[0.06] dark:hover:text-white",
                            )}
                        >
                            <item.icon className="h-3.5 w-3.5" />
                            {item.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        aria-pressed={pixReceivedFilterActive}
                        onClick={() => {
                            const willEnable = !pixReceivedFilterActive;
                            setFilters((current) => togglePixReceivedStatementPreset(current));
                            if (willEnable) onTabChange("realizado");
                        }}
                        className={cn(
                            "flex h-10 items-center gap-2 rounded-[14px] px-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all",
                            pixReceivedFilterActive
                                ? "bg-zinc-950 text-white shadow-md dark:bg-white dark:text-zinc-950"
                                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/[0.06] dark:hover:text-white",
                        )}
                    >
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                        Pix recebidos
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <AdvancedFilterPopover
                        activeFilters={activeFilters}
                        onClear={() => setFilters(emptyDetailedStatementFilters())}
                        triggerLabel="Filtro"
                        presentation="dialog"
                        title="Filtros do extrato"
                        description="Combine período, origem, método e pacientes."
                        widthClassName="w-[min(920px,calc(100vw-32px))]"
                    >
                        <div className="grid max-h-[72vh] gap-7 overflow-y-auto p-6 custom-scrollbar md:p-8 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-6">
                                <FilterDateGroup
                                    title="Período das transações"
                                    start={filters.startDate}
                                    end={filters.endDate}
                                    onStart={(value) => updateFilter("startDate", value)}
                                    onEnd={(value) => updateFilter("endDate", value)}
                                    compact
                                />

                                <div>
                                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Tipo</p>
                                    <Select value={filters.type} onValueChange={(value) => updateFilter("type", value as DetailedStatementFilters["type"])}>
                                        <SelectTrigger className="h-10 rounded-[12px] border-zinc-200 bg-white text-xs font-bold text-zinc-700 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Entradas e saídas</SelectItem>
                                            <SelectItem value="income">Entrada</SelectItem>
                                            <SelectItem value="expense">Saída</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Destinatário das saídas</p>
                                    <div className="relative">
                                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            value={filters.recipientQuery}
                                            onChange={(event) => updateFilter("recipientQuery", event.target.value)}
                                            placeholder="Nome, conta ou chave Pix"
                                            className="h-10 w-full rounded-[12px] border border-zinc-200 bg-white pl-10 pr-3 text-xs font-bold text-zinc-800 shadow-sm outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:focus:border-white/20"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <FilterCheckGroup
                                    title="Método de pagamento / convênio"
                                    options={paymentMethodOptions}
                                    selected={filters.paymentMethods}
                                    onToggle={(value) => updateFilter("paymentMethods", toggleFilterValue(filters.paymentMethods, value))}
                                    twoColumns
                                    compact
                                />
                                <FilterCheckGroup
                                    title="Origem"
                                    options={originOptions}
                                    selected={filters.origins}
                                    onToggle={(value) => updateFilter("origins", toggleFilterValue(filters.origins, value))}
                                    compact
                                />
                                <FilterCheckGroup
                                    title="Método de transferência"
                                    options={transferMethodOptions}
                                    selected={filters.transferMethods}
                                    onToggle={(value) => updateFilter("transferMethods", toggleFilterValue(filters.transferMethods, value))}
                                    compact
                                />
                                <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                    <Checkbox className="h-4 w-4 rounded-[5px] border-zinc-300 dark:border-white/20" checked={filters.feesOnly} onCheckedChange={(checked) => updateFilter("feesOnly", checked === true)} />
                                    Mostrar somente taxas pagas
                                </label>
                            </div>

                            <div>
                                <p className="mb-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Pacientes</p>
                                <div className="max-h-[310px] space-y-1 overflow-y-auto rounded-[18px] border border-zinc-200 bg-white p-2.5 shadow-sm custom-scrollbar dark:border-white/10 dark:bg-white/[0.035]">
                                    {patients.length === 0 ? (
                                        <p className="px-2 py-5 text-center text-xs font-semibold text-zinc-400">Nenhum paciente disponível.</p>
                                    ) : patients.map((patient) => (
                                        <label key={patient.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/[0.05]">
                                            <Checkbox
                                                className="h-4 w-4 rounded-[5px] border-zinc-300 dark:border-white/20"
                                                checked={filters.patientIds.includes(patient.id)}
                                                onCheckedChange={() => updateFilter("patientIds", toggleFilterValue(filters.patientIds, patient.id))}
                                            />
                                            <span className="truncate">{patient.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </AdvancedFilterPopover>

                    <div className="flex items-center rounded-[16px] border border-zinc-200 bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.035]">
                        <button
                            type="button"
                            onClick={() => setSortOrder("desc")}
                            title="Mais recente para o mais antigo"
                            className={cn("flex h-9 items-center gap-2 rounded-xl px-3 text-[9px] font-black uppercase tracking-[0.1em] transition-all", sortOrder === "desc" ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white")}
                        >
                            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                            Recentes
                        </button>
                        <button
                            type="button"
                            onClick={() => setSortOrder("asc")}
                            title="Mais antigo para o mais recente"
                            className={cn("flex h-9 items-center gap-2 rounded-xl px-3 text-[9px] font-black uppercase tracking-[0.1em] transition-all", sortOrder === "asc" ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white")}
                        >
                            <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                            Antigos
                        </button>
                    </div>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowValues((current) => !current)}
                        title={showValues ? "Ocultar valores" : "Mostrar valores"}
                        aria-pressed={!showValues}
                        className="h-11 w-11 rounded-[16px] border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035]"
                    >
                        {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleSync}
                        disabled={isSyncing}
                        title="Atualizar valores"
                        className="h-11 w-11 rounded-[16px] border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035]"
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <StatementPrintModal
                        transactions={sortedTransactions}
                        dateRange={{ from: queryStart, to: queryEnd }}
                        summary={printSummary}
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            title="Imprimir extrato"
                            className="h-11 w-11 rounded-[16px] border-zinc-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.035]"
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
                    </StatementPrintModal>
                </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/60 bg-white/45 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.05] dark:bg-white/[0.012]">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Movimentações encontradas</p>
                        <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">
                            {isLoading ? "Carregando..." : `${filteredTransactions.length} registro${filteredTransactions.length === 1 ? "" : "s"}`}
                        </p>
                    </div>
                    {(transactionsQuery.isFetching || statementQuery.isFetching) && !isLoading ? (
                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Atualizando
                        </span>
                    ) : null}
                </div>

                <FinancialStatement
                    transactions={paginatedTransactions}
                    isLoading={isLoading}
                    onSelectTransaction={onSelectTransaction}
                    sortOrder={sortOrder}
                    groupByDate
                />

                {!isLoading && sortedTransactions.length > 0 ? (
                    <div className="mt-5 flex flex-col gap-3 border-t border-zinc-200/70 px-1 pt-4 text-xs font-semibold text-zinc-500 dark:border-white/[0.07] dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Exibindo {paginatedTransactions.length} de {sortedTransactions.length} {sortedTransactions.length === 1 ? "movimentação" : "movimentações"}
                        </span>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                disabled={page <= 1}
                                title="Página anterior"
                                className="h-9 rounded-full"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="min-w-[54px] text-center text-[10px] font-black uppercase tracking-widest">
                                {page}/{pageCount}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                                disabled={page >= pageCount}
                                title="Próxima página"
                                className="h-9 rounded-full"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
