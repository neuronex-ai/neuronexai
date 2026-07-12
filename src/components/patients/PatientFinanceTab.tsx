"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Wallet,
} from "lucide-react";

import { EditTransactionModal } from "../financeiro/EditTransactionModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePatientTransactions } from "@/hooks/use-patient-transactions";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

interface PatientFinanceTabProps {
  patientId: string;
}

const DESKTOP_PAGE_SIZE = 10;
const MOBILE_PAGE_SIZE = 8;

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TransactionItem = memo(function TransactionItem({
  transaction,
  isMobile,
}: {
  transaction: Transaction;
  isMobile: boolean;
}) {
  const isIncome = transaction.type === "income";

  return (
    <div
      className="desktop-retina-inset desktop-retina-interactive rounded-[22px] border border-border/45 bg-background/62"
      style={{ contentVisibility: "auto", containIntrinsicSize: isMobile ? "78px" : "88px" }}
    >
      <EditTransactionModal transaction={transaction}>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-4 rounded-[22px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
            isMobile ? "p-4" : "p-5",
          )}
          aria-label={`Editar ${transaction.description}`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-4">
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl border",
                isMobile ? "h-10 w-10" : "h-11 w-11",
                isIncome
                  ? "border-emerald-500/18 bg-emerald-500/9 text-emerald-600 dark:text-emerald-400"
                  : "border-rose-500/18 bg-rose-500/9 text-rose-600 dark:text-rose-400",
              )}
            >
              {isIncome ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </span>

            <span className="min-w-0 space-y-1">
              <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                {transaction.description}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="flex shrink-0 items-center gap-1.5">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {new Date(`${transaction.date}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
                <span aria-hidden="true">•</span>
                <span className="truncate">{transaction.category || "Geral"}</span>
              </span>
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span
              className={cn(
                "block font-mono font-black tracking-[-0.04em]",
                isMobile ? "text-sm" : "text-base",
                isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
              )}
            >
              {isIncome ? "+" : "−"} {formatCurrency(transaction.amount)}
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">BRL</span>
          </span>
        </button>
      </EditTransactionModal>
    </div>
  );
});

export const PatientFinanceTab = ({ patientId }: PatientFinanceTabProps) => {
  const { data: transactions = [], isLoading, error } = usePatientTransactions(patientId);
  const isMobile = useIsMobile();
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [page, setPage] = useState(1);

  const summary = useMemo(() => {
    let revenue = 0;
    let expenses = 0;

    for (const transaction of transactions) {
      if (transaction.type === "income") revenue += transaction.amount;
      if (transaction.type === "expense") expenses += transaction.amount;
    }

    return { revenue, expenses, balance: revenue - expenses };
  }, [transactions]);

  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
  const visibleTransactions = useMemo(
    () => transactions.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, transactions],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Carregando financeiro do paciente">
        <Skeleton className="h-40 w-full rounded-[28px]" />
        <Skeleton className="h-[420px] w-full rounded-[28px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-rose-500/16 bg-rose-500/7 px-6 py-12 text-center text-sm font-medium text-rose-600 dark:text-rose-300">
        Não foi possível carregar os dados financeiros.
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="desktop-retina-panel overflow-hidden rounded-[28px] border border-border/45 bg-card/68 p-5 md:p-6">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
          <SummaryMetric
            label="Balanço"
            value={summary.balance}
            icon={Wallet}
            tone="neutral"
            prominent
          />
          <SummaryMetric label="Receitas" value={summary.revenue} icon={ArrowDownRight} tone="positive" />
          <SummaryMetric label="Despesas" value={summary.expenses} icon={ArrowUpRight} tone="negative" />
        </div>
      </section>

      <section className="desktop-retina-panel overflow-hidden rounded-[28px] border border-border/45 bg-card/62">
        <header className="flex flex-col gap-3 border-b border-border/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <span className="desktop-retina-inset flex h-10 w-10 items-center justify-center rounded-2xl border border-border/45 text-muted-foreground">
              <Receipt className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">Histórico financeiro</h3>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {transactions.length} {transactions.length === 1 ? "movimentação" : "movimentações"}
              </p>
            </div>
          </div>

          {totalPages > 1 ? (
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Página {page} de {totalPages}
            </span>
          ) : null}
        </header>

        {transactions.length > 0 ? (
          <>
            <div className="custom-scrollbar max-h-[620px] space-y-2.5 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable] md:p-5">
              {visibleTransactions.map((transaction) => (
                <TransactionItem key={transaction.id} transaction={transaction} isMobile={isMobile} />
              ))}
            </div>

            {totalPages > 1 ? (
              <footer className="flex items-center justify-between gap-3 border-t border-border/45 bg-muted/18 px-4 py-3 md:px-5">
                <Button
                  type="button"
                  variant="outline"
                  className="desktop-retina-interactive h-10 rounded-xl px-4"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="desktop-retina-interactive h-10 rounded-xl px-4"
                  disabled={page === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Próxima
                  <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </footer>
            ) : null}
          </>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <span className="desktop-retina-inset mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/45 text-muted-foreground">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-foreground">Nenhuma movimentação</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              As receitas e despesas vinculadas a este paciente aparecerão aqui.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

const SummaryMetric = ({
  label,
  value,
  icon: Icon,
  tone,
  prominent = false,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: "neutral" | "positive" | "negative";
  prominent?: boolean;
}) => (
  <div
    className={cn(
      "rounded-[22px] border border-border/45 p-5",
      !prominent && "desktop-retina-inset bg-background/58",
      prominent && "bg-foreground text-background dark:bg-white dark:text-zinc-950",
    )}
  >
    <div className="mb-5 flex items-center justify-between gap-3">
      <span
        className={cn(
          "text-[9px] font-black uppercase tracking-[0.18em]",
          prominent ? "text-background/62 dark:text-zinc-600" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <Icon
        className={cn(
          "h-4 w-4",
          prominent && "text-background/62 dark:text-zinc-600",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-rose-600 dark:text-rose-400",
        )}
        aria-hidden="true"
      />
    </div>
    <p className={cn("font-black tracking-[-0.05em]", prominent ? "text-3xl" : "text-2xl")}>{formatCurrency(value)}</p>
  </div>
);
