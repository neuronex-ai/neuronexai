"use client";

import { useMemo } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarClock, Landmark, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBillPaymentsCalendar } from "@/hooks/use-bill-payments-calendar";
import { useNeuroFinanceBalanceDetails } from "@/hooks/use-neurofinance-balance-details";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

interface NeuroFinanceMovementsTimelineProps {
  onOpenFutureStatement: () => void;
  onOpenScheduledPayments: () => void;
}

interface MovementItem {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  kind: "income" | "expense" | "settlement" | "payment";
}

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);

const dateLabel = (value: string) => {
  try {
    return format(parseISO(value.slice(0, 10)), "dd/MM");
  } catch {
    return value.slice(0, 10);
  }
};

export function NeuroFinanceMovementsTimeline({
  onOpenFutureStatement,
  onOpenScheduledPayments,
}: NeuroFinanceMovementsTimelineProps) {
  const futureStatement = useNeuroFinanceBalanceDetails("futuro");
  const scheduledPayments = useBillPaymentsCalendar(new Date(), addDays(new Date(), 45));

  const movements = useMemo(() => {
    const statementItems: MovementItem[] = ((futureStatement.data || []) as Transaction[]).map((transaction) => {
      const income = transaction.type === "income";
      return {
        id: `future:${transaction.id}`,
        date: transaction.date || transaction.created_at,
        title: transaction.description || (income ? "Entrada prevista" : "Saida prevista"),
        subtitle: income ? "Liquidacao/entrada futura" : "Movimento futuro da conta",
        amount: Number(transaction.amount || 0),
        kind: income ? "settlement" : "expense",
      };
    });

    const paymentItems: MovementItem[] = (scheduledPayments.data || []).map((payment) => ({
      id: `payment:${payment.id}`,
      date: payment.date,
      title: payment.beneficiaryName || "Pagamento agendado",
      subtitle: payment.bankName || "Pagamento bancario",
      amount: -Math.abs(Number(payment.amount || 0)),
      kind: "payment",
    }));

    return [...statementItems, ...paymentItems]
      .filter((item) => item.date)
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(0, 8);
  }, [futureStatement.data, scheduledPayments.data]);

  const isLoading = futureStatement.isLoading || scheduledPayments.isLoading;
  const projectedTotal = movements.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="finance-panel relative overflow-hidden rounded-[32px] border border-zinc-200/70 bg-white/80 p-6 shadow-[0_22px_70px_-54px_rgba(24,24,27,0.7)] dark:border-black/75 dark:bg-zinc-900/[0.42] dark:shadow-[0_24px_70px_-48px_rgba(0,0,0,0.98)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-400">NeuroFinance</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Próximos movimentos da conta</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenFutureStatement} className="h-11 rounded-2xl border-zinc-200 bg-white/70 text-[9px] font-black uppercase tracking-[0.16em] dark:border-black/75 dark:bg-black/[0.28]">
            Extrato futuro <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onOpenScheduledPayments} className="h-11 rounded-2xl border-zinc-200 bg-white/70 text-[9px] font-black uppercase tracking-[0.16em] dark:border-black/75 dark:bg-black/[0.28]">
            Pagamentos agendados <CalendarClock className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_260px]">
        <div className="finance-inset overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/70 dark:border-black/75 dark:bg-black/[0.24]">
          {isLoading ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-zinc-300" />
            </div>
          ) : movements.length ? (
            <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
              {movements.map((item) => {
                const positive = item.amount >= 0;
                const Icon = positive ? ArrowDownLeft : ArrowUpRight;
                return (
                  <div key={item.id} className="grid grid-cols-[56px_1fr_130px] items-center gap-4 px-5 py-4">
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", positive ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/12 text-rose-700 dark:text-rose-300")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{item.title}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{dateLabel(item.date)} · {item.subtitle}</p>
                    </div>
                    <p className={cn("text-right text-sm font-black tabular-nums", positive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                      {positive ? "+" : "-"} {currency(Math.abs(item.amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <CalendarClock className="h-8 w-8 text-zinc-300" />
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500">Sem movimentos previstos da conta</p>
            </div>
          )}
        </div>

        <div className="rounded-[24px] bg-zinc-950 p-5 text-white dark:bg-white dark:text-zinc-950">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Saldo previsto dos movimentos</p>
          <h3 className="mt-4 text-3xl font-black tracking-tight">{currency(projectedTotal)}</h3>
          <p className="mt-4 text-sm font-medium leading-relaxed opacity-62">
            Visão bancária curta. Calendário operacional fica na Gestão Financeira.
          </p>
        </div>
      </div>
    </section>
  );
}
