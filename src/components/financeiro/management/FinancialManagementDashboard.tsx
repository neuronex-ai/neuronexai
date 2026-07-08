"use client";

import { motion } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  LineChart,
  PieChart,
  PlusCircle,
  ReceiptText,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { addDays, endOfMonth, format, isAfter, isBefore, isWithinInterval, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChargesWorkspace } from "@/components/financeiro/ChargesWorkspace";
import { FinancialCalendarCard } from "@/components/financeiro/ReceivablesCalendarCard";
import { fromPlanningCents, useFinancialPlanning } from "@/hooks/use-financial-planning";
import { useProjectedCashFlow } from "@/hooks/use-projected-cash-flow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Transaction } from "@/types";
import type { FinanceView } from "../FinancialDashboard";
import { NewTransactionModal } from "../NewTransactionModal";
import { RecurringManager } from "../RecurringManager";

type ManagementProps = {
  activeView: FinanceView;
  setActiveView: (view: FinanceView) => void;
  allTransactions: Transaction[];
  realizedTransactions: Transaction[];
  futureTransactions: Transaction[];
  subscriptionTransactions: Transaction[];
  isLoadingTransactions: boolean;
  setSelectedTransaction: (transaction: Transaction | null) => void;
};

type Metrics = ReturnType<typeof buildFinancialMetrics>;
type EntryType = "income" | "expense";

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

const shortCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

const parseMoneyInput = (value: string) => {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const amountOf = (transaction: Transaction) => Math.abs(Number(transaction.amount ?? 0));
const dateOf = (transaction: Transaction) => new Date(transaction.date || transaction.created_at || Date.now());
const isIncome = (transaction: Transaction) => transaction.type === "income";
const isExpense = (transaction: Transaction) => transaction.type === "expense";
const isPending = (transaction: Transaction) => transaction.status === "pending" || transaction.status === "scheduled";
const buildFinancialMetrics = (
  allTransactions: Transaction[],
  realizedTransactions: Transaction[],
  futureTransactions: Transaction[],
  subscriptionTransactions: Transaction[],
) => {
  const now = new Date();
  const monthRange = { start: startOfMonth(now), end: endOfMonth(now) };
  const upcomingRange = { start: now, end: addDays(now, 30) };

  const currentMonth = allTransactions.filter((transaction) => isWithinInterval(dateOf(transaction), monthRange));
  const realizedMonth = realizedTransactions.filter((transaction) => isWithinInterval(dateOf(transaction), monthRange));
  const futureMonth = futureTransactions.filter((transaction) => isWithinInterval(dateOf(transaction), monthRange) || isAfter(dateOf(transaction), now));

  const incomeMonth = realizedMonth.filter(isIncome).reduce((sum, transaction) => sum + amountOf(transaction), 0);
  const expenseMonth = realizedMonth.filter(isExpense).reduce((sum, transaction) => sum + amountOf(transaction), 0);
  const resultMonth = incomeMonth - expenseMonth;

  const receivable = [...futureMonth, ...currentMonth]
    .filter((transaction) => isIncome(transaction) && isPending(transaction))
    .reduce((sum, transaction) => sum + amountOf(transaction), 0);

  const pendingIncomeTransactions = allTransactions
    .filter((transaction) => isIncome(transaction) && isPending(transaction))
    .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime());

  const overdueIncomeTransactions = pendingIncomeTransactions.filter((transaction) => isBefore(dateOf(transaction), now));
  const overdueAmount = overdueIncomeTransactions.reduce((sum, transaction) => sum + amountOf(transaction), 0);

  const upcomingIncome = futureTransactions
    .filter((transaction) => isIncome(transaction) && isWithinInterval(dateOf(transaction), upcomingRange))
    .reduce((sum, transaction) => sum + amountOf(transaction), 0);

  const upcomingExpenses = futureTransactions
    .filter((transaction) => isExpense(transaction) && isWithinInterval(dateOf(transaction), upcomingRange))
    .reduce((sum, transaction) => sum + amountOf(transaction), 0);

  const expenseCategories = realizedMonth.filter(isExpense).reduce<Record<string, number>>((acc, transaction) => {
    const key = transaction.category || "Sem categoria";
    acc[key] = (acc[key] || 0) + amountOf(transaction);
    return acc;
  }, {});

  const revenueCategories = realizedMonth.filter(isIncome).reduce<Record<string, number>>((acc, transaction) => {
    const key = transaction.category || "Atendimentos";
    acc[key] = (acc[key] || 0) + amountOf(transaction);
    return acc;
  }, {});

  const fixedExpenses = subscriptionTransactions.filter(isExpense).reduce((sum, transaction) => sum + amountOf(transaction), 0);
  const averageTicket = realizedMonth.filter(isIncome).length ? incomeMonth / realizedMonth.filter(isIncome).length : 0;
  const breakEvenSessions = averageTicket > 0 ? Math.ceil(Math.max(expenseMonth || fixedExpenses, 0) / averageTicket) : 0;

  return {
    incomeMonth,
    expenseMonth,
    resultMonth,
    receivable,
    overdueAmount,
    overdueCount: overdueIncomeTransactions.length,
    pendingIncomeTransactions,
    overdueIncomeTransactions,
    upcomingIncome,
    upcomingExpenses,
    projectedBalance: resultMonth + upcomingIncome - upcomingExpenses,
    fixedExpenses,
    averageTicket,
    breakEvenSessions,
    currentMonth,
    realizedMonth,
    futureMonth,
    expenseCategories,
    revenueCategories,
    incomeTransactions: allTransactions.filter(isIncome).sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime()),
    expenseTransactions: allTransactions.filter(isExpense).sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime()),
  };
};

const ManagementBadge = ({ children, icon: Icon = Sparkles }: { children: ReactNode; icon?: ElementType<{ className?: string }> }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/75 px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white/45">
    <Icon className="h-3.5 w-3.5" />
    {children}
  </div>
);

const ManagementPanel = ({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) => (
  <motion.section
    initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    className={cn(
      "relative overflow-hidden rounded-[34px] border border-zinc-200/70 bg-white/78 shadow-[0_28px_90px_-72px_rgba(24,24,27,0.72)] backdrop-blur-xl dark:border-white/[0.065] dark:bg-[#08090b]/88 dark:shadow-[0_30px_100px_-70px_rgba(0,0,0,0.95)]",
      className,
    )}
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.62),transparent_34%,rgba(255,255,255,0.16))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_34%,rgba(255,255,255,0.015))]" />
    <div className="relative z-10">{children}</div>
  </motion.section>
);

const SectionTitle = ({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-400 dark:text-white/32">{eyebrow}</p>
    <h2 className="mt-1.5 text-2xl font-black tracking-[-0.045em] text-zinc-950 dark:text-white">{title}</h2>
    {description ? <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-zinc-500 dark:text-white/44">{description}</p> : null}
  </div>
);

const MetricCard = ({ icon: Icon, label, value, hint, tone = "default", onClick }: { icon: ElementType<{ className?: string }>; label: string; value: string; hint: string; tone?: "default" | "dark" | "warning" | "success"; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group relative min-h-[166px] overflow-hidden rounded-[28px] border p-5 text-left transition-all duration-300 hover:-translate-y-1 active:scale-[0.99]",
      tone === "dark"
        ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_28px_90px_-64px_rgba(0,0,0,0.85)] dark:border-white dark:bg-white dark:text-zinc-950"
        : "border-zinc-200/70 bg-white/78 text-zinc-950 shadow-[0_22px_74px_-62px_rgba(24,24,27,0.5)] dark:border-white/[0.065] dark:bg-white/[0.035] dark:text-white",
      tone === "warning" && "border-amber-500/25 bg-amber-50/75 dark:border-amber-300/15 dark:bg-amber-300/[0.055]",
      tone === "success" && "border-emerald-500/20 bg-emerald-50/75 dark:border-emerald-300/15 dark:bg-emerald-300/[0.05]",
    )}
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),transparent_42%)] opacity-70 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_42%)]" />
    <div className="relative z-10 flex items-start justify-between gap-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", tone === "dark" ? "bg-white/12 dark:bg-zinc-950/10" : "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950")}>
        <Icon className="h-5 w-5" />
      </div>
      <ArrowRight className="h-4 w-4 opacity-24 transition-transform group-hover:translate-x-1" />
    </div>
    <div className="relative z-10 mt-7">
      <div className="text-3xl font-black tracking-[-0.065em] xl:text-4xl">{value}</div>
      <div className={cn("mt-2 text-[9px] font-black uppercase tracking-[0.2em]", tone === "dark" ? "opacity-55" : "text-zinc-400 dark:text-white/34")}>{label}</div>
      <p className={cn("mt-3 text-xs font-semibold leading-relaxed", tone === "dark" ? "opacity-62" : "text-zinc-500 dark:text-white/42")}>{hint}</p>
    </div>
  </button>
);

const EmptyHint = ({ title, description, icon: Icon = Sparkles }: { title: string; description: string; icon?: ElementType<{ className?: string }> }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[28px] border border-dashed border-zinc-200/80 bg-zinc-50/70 p-8 text-center dark:border-white/10 dark:bg-white/[0.035]">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><Icon className="h-6 w-6" /></div>
    <h3 className="mt-5 text-xl font-black tracking-[-0.04em] text-zinc-950 dark:text-white">{title}</h3>
    <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-zinc-500 dark:text-white/44">{description}</p>
  </div>
);

const Hero = ({ metrics, setActiveView, onCreateEntry }: { metrics: Metrics; setActiveView: (view: FinanceView) => void; onCreateEntry: (type: EntryType) => void }) => (
  <ManagementPanel className="rounded-[42px]" delay={0.04}>
    <div className="grid gap-10 p-8 md:p-10 xl:grid-cols-[minmax(0,1fr)_430px] xl:p-12">
      <div>
        <ManagementBadge icon={Landmark}>Gestão Financeira</ManagementBadge>
        <p className="mt-10 text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 dark:text-white/35">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
        <h1 className="mt-5 max-w-5xl text-[clamp(3rem,5.6vw,6rem)] font-black leading-[0.88] tracking-[-0.075em] text-zinc-950 dark:text-white">
          Seu consultório em números.
        </h1>
        <p className="mt-7 max-w-3xl text-base font-medium leading-relaxed text-zinc-500 dark:text-white/48 md:text-lg">
          Receitas, despesas, recebíveis, cobranças vencidas e planejamento em uma camada gerencial separada do NeuroFinance.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button onClick={() => onCreateEntry("income")} className="h-14 rounded-2xl bg-zinc-950 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100">
            Lançar receita <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
          <Button onClick={() => onCreateEntry("expense")} variant="outline" className="h-14 rounded-2xl border-zinc-200/80 bg-white/70 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.07]">
            Lançar despesa
          </Button>
          <Button onClick={() => setActiveView("gestao-cobrancas")} variant="outline" className="h-14 rounded-2xl border-zinc-200/80 bg-white/70 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.07]">
            Cobranças
          </Button>
        </div>
      </div>

      <div className="rounded-[34px] bg-zinc-950 p-6 text-white shadow-[0_34px_110px_-74px_rgba(0,0,0,0.9)] dark:bg-white dark:text-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 dark:bg-zinc-950/10">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] opacity-55 dark:border-zinc-950/10">Resultado</span>
        </div>
        <p className="mt-10 text-[9px] font-black uppercase tracking-[0.25em] opacity-45">Resultado do mês</p>
        <h2 className="mt-3 text-5xl font-black tracking-[-0.075em]">{currency(metrics.resultMonth)}</h2>
        <p className="mt-4 text-sm font-medium leading-relaxed opacity-62">
          {metrics.resultMonth >= 0 ? "Seu consultório está positivo neste mês." : "As saídas superaram as entradas confirmadas neste mês."} A previsão considera entradas e saídas futuras já registradas.
        </p>
        <Button onClick={() => setActiveView("gestao-fluxo-caixa")} className="mt-8 h-12 w-full rounded-2xl bg-white text-[10px] font-black uppercase tracking-[0.2em] text-zinc-950 hover:bg-white/90 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900">
          Ver fluxo de caixa <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  </ManagementPanel>
);

const Radar = ({ metrics, setActiveView }: { metrics: Metrics; setActiveView: (view: FinanceView) => void }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
    <MetricCard icon={TrendingUp} label="Resultado" value={shortCurrency(metrics.resultMonth)} hint="Receitas menos despesas confirmadas" tone="dark" onClick={() => setActiveView("gestao-fluxo-caixa")} />
    <MetricCard icon={ArrowUpRight} label="Receitas" value={shortCurrency(metrics.incomeMonth)} hint="Entradas confirmadas no mês" tone="success" onClick={() => setActiveView("gestao-receitas")} />
    <MetricCard icon={ArrowDownLeft} label="Despesas" value={shortCurrency(metrics.expenseMonth)} hint="Saídas confirmadas no mês" onClick={() => setActiveView("gestao-despesas")} />
    <MetricCard icon={WalletCards} label="A receber" value={shortCurrency(metrics.receivable)} hint="Entradas pendentes e previstas" onClick={() => setActiveView("gestao-cobrancas")} />
    <MetricCard icon={Users} label="Vencidas" value={metrics.overdueCount.toString()} hint={`${currency(metrics.overdueAmount)} em atraso`} tone={metrics.overdueCount > 0 ? "warning" : "success"} onClick={() => setActiveView("gestao-inadimplencia")} />
    <MetricCard icon={LineChart} label="Previsão" value={shortCurrency(metrics.projectedBalance)} hint="Resultado projetado com próximos 30 dias" onClick={() => setActiveView("gestao-planejamento")} />
  </div>
);

const MiniBar = ({ label, value, max, tone = "default" }: { label: string; value: number; max: number; tone?: "default" | "positive" | "negative" }) => (
  <div>
    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-white/32">
      <span>{label}</span>
      <span>{shortCurrency(value)}</span>
    </div>
    <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.055]">
      <div
        className={cn("h-full rounded-full bg-zinc-950 dark:bg-white", tone === "positive" && "bg-emerald-500 dark:bg-emerald-300", tone === "negative" && "bg-amber-500 dark:bg-amber-300")}
        style={{ width: `${Math.min(100, Math.max(4, (Math.abs(value) / Math.max(max, 1)) * 100))}%` }}
      />
    </div>
  </div>
);

const CashFlowOverview = ({ metrics, setActiveView }: { metrics: Metrics; setActiveView: (view: FinanceView) => void }) => {
  const max = Math.max(metrics.incomeMonth, metrics.expenseMonth, metrics.upcomingIncome, metrics.upcomingExpenses, 1);
  const events = [
    { label: "Entradas previstas", value: metrics.upcomingIncome, icon: ArrowUpRight, tone: "positive" as const },
    { label: "Saídas previstas", value: metrics.upcomingExpenses, icon: ArrowDownLeft, tone: "negative" as const },
    { label: "Saldo projetado", value: metrics.projectedBalance, icon: LineChart, tone: metrics.projectedBalance >= 0 ? "positive" as const : "negative" as const },
  ];

  return (
    <ManagementPanel className="h-full" delay={0.12}>
      <div className="p-7 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <SectionTitle eyebrow="Fluxo de caixa" title="Realizado, previsto e projetado" description="Uma leitura gerencial do que entrou, saiu e ainda deve acontecer." />
          <Button onClick={() => setActiveView("gestao-fluxo-caixa")} variant="outline" className="h-11 shrink-0 rounded-2xl border-zinc-200 bg-white/70 text-[9px] font-black uppercase tracking-[0.18em] dark:border-white/10 dark:bg-white/[0.04]">Detalhes</Button>
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-5 rounded-[28px] border border-zinc-200/70 bg-zinc-50/70 p-6 dark:border-white/10 dark:bg-white/[0.035]">
            <MiniBar label="Receitas confirmadas" value={metrics.incomeMonth} max={max} tone="positive" />
            <MiniBar label="Despesas confirmadas" value={metrics.expenseMonth} max={max} tone="negative" />
            <MiniBar label="Entradas previstas" value={metrics.upcomingIncome} max={max} tone="positive" />
            <MiniBar label="Saídas previstas" value={metrics.upcomingExpenses} max={max} tone="negative" />
          </div>
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.label} className="flex items-center gap-4 rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl text-white", event.tone === "positive" ? "bg-emerald-500" : "bg-amber-500")}><event.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-white/32">{event.label}</p>
                  <p className="mt-1 text-lg font-black tracking-[-0.04em] text-zinc-950 dark:text-white">{currency(event.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ManagementPanel>
  );
};

const ActionQueue = ({ metrics, setActiveView }: { metrics: Metrics; setActiveView: (view: FinanceView) => void; onCreateEntry?: (type: EntryType) => void }) => {
  const actions = [
    metrics.overdueCount > 0
      ? { priority: "Alta", title: "Cobranças vencidas", description: `${metrics.overdueCount} cobrança${metrics.overdueCount > 1 ? "s" : ""} em atraso somando ${currency(metrics.overdueAmount)}.`, icon: AlertCircle, tone: "warning" as const, action: () => setActiveView("gestao-inadimplencia") }
      : { priority: "OK", title: "Sem atrasos críticos", description: "Não há cobranças pendentes vencidas no radar atual.", icon: CheckCircle2, tone: "success" as const, action: () => setActiveView("gestao-cobrancas") },
    metrics.upcomingExpenses > 0
      ? { priority: "Semana", title: "Despesas previstas", description: `${currency(metrics.upcomingExpenses)} em saídas futuras registradas para os próximos dias.`, icon: CalendarClock, tone: "default" as const, action: () => setActiveView("gestao-despesas") }
      : { priority: "Cadastro", title: "Mapear despesas fixas", description: "Cadastre despesas recorrentes para calcular ponto de equilíbrio e previsão mensal.", icon: ReceiptText, tone: "default" as const, action: () => setActiveView("gestao-despesas") },
    { priority: "Meta", title: "Planejar faturamento", description: metrics.averageTicket > 0 ? `Ticket médio atual: ${currency(metrics.averageTicket)}. Ponto de equilíbrio estimado: ${metrics.breakEvenSessions} sessões.` : "Defina metas de receita e ticket médio para acompanhar a saúde da clínica.", icon: Target, tone: "dark" as const, action: () => setActiveView("gestao-planejamento") },
    { priority: "Contador", title: "Preparar relatório", description: "Gere uma leitura mensal de receitas, despesas, pendências e categorias.", icon: FileText, tone: "default" as const, action: () => setActiveView("gestao-relatorios") },
  ];

  return (
    <ManagementPanel delay={0.18}>
      <div className="p-7 md:p-8">
        <SectionTitle eyebrow="Fila financeira" title="O que precisa de ação" description="Pendências e recomendações para manter a clínica previsível." />
        <div className="mt-8 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {actions.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={item.action}
              className={cn(
                "group min-h-[210px] rounded-[28px] border p-5 text-left transition-all hover:-translate-y-1 active:scale-[0.99]",
                item.tone === "dark" ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950" : "border-zinc-200/70 bg-zinc-50/72 text-zinc-950 dark:border-white/10 dark:bg-white/[0.035] dark:text-white",
                item.tone === "warning" && "border-amber-500/25 bg-amber-50/75 dark:border-amber-300/15 dark:bg-amber-300/[0.055]",
                item.tone === "success" && "border-emerald-500/20 bg-emerald-50/75 dark:border-emerald-300/15 dark:bg-emerald-300/[0.05]",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", item.tone === "dark" ? "bg-white/12 dark:bg-zinc-950/10" : "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950")}><item.icon className="h-5 w-5" /></div>
                <span className={cn("rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em]", item.tone === "dark" ? "border-white/10 opacity-55 dark:border-zinc-950/10" : "border-zinc-200 bg-white/70 text-zinc-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/32")}>{item.priority}</span>
              </div>
              <h3 className="mt-7 text-lg font-black leading-tight tracking-[-0.035em]">{item.title}</h3>
              <p className={cn("mt-3 text-sm font-medium leading-relaxed", item.tone === "dark" ? "opacity-62" : "text-zinc-500 dark:text-white/42")}>{item.description}</p>
              <div className={cn("mt-6 flex items-center text-[9px] font-black uppercase tracking-[0.18em]", item.tone === "dark" ? "opacity-70" : "text-zinc-500 dark:text-white/48")}>Resolver <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
            </button>
          ))}
        </div>
      </div>
    </ManagementPanel>
  );
};

const CategoryList = ({ title, categories, emptyLabel }: { title: string; categories: Record<string, number>; emptyLabel: string }) => {
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <ManagementPanel className="h-full" delay={0.2}>
      <div className="p-7 md:p-8">
        <SectionTitle eyebrow="Categorias" title={title} description="Onde o dinheiro está concentrado no mês." />
        <div className="mt-7 space-y-4">
          {entries.length ? entries.map(([label, value]) => (
            <div key={label}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="truncate text-sm font-black text-zinc-800 dark:text-white/82">{label}</span>
                <span className="text-sm font-black text-zinc-500 dark:text-white/44">{currency(value)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.055]"><div className="h-full rounded-full bg-zinc-950 dark:bg-white" style={{ width: `${Math.max(6, (value / max) * 100)}%` }} /></div>
            </div>
          )) : <EmptyHint title={emptyLabel} description="Conforme você lança receitas e despesas categorizadas, esta leitura fica mais inteligente." icon={PieChart} />}
        </div>
      </div>
    </ManagementPanel>
  );
};

const TransactionRows = ({ transactions, onSelect, emptyTitle, emptyDescription }: { transactions: Transaction[]; onSelect?: (transaction: Transaction) => void; emptyTitle: string; emptyDescription: string }) => (
  <div className="space-y-3">
    {transactions.length ? transactions.slice(0, 10).map((transaction) => (
      <button key={transaction.id} type="button" onClick={() => onSelect?.(transaction)} className="group grid w-full grid-cols-[1fr_160px_140px_auto] items-center gap-4 rounded-[22px] border border-zinc-200/70 bg-zinc-50/72 p-4 text-left transition-all hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.055]">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{transaction.description || transaction.category || "Movimentação financeira"}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-white/32">{transaction.category || "Sem categoria"}</p>
        </div>
        <div className="text-sm font-black text-zinc-950 dark:text-white">{currency(amountOf(transaction))}</div>
        <div className="text-xs font-bold text-zinc-500 dark:text-white/42">{format(dateOf(transaction), "dd MMM yyyy", { locale: ptBR })}</div>
        <ArrowRight className="h-4 w-4 text-zinc-300 transition-transform group-hover:translate-x-1 dark:text-white/24" />
      </button>
    )) : <EmptyHint title={emptyTitle} description={emptyDescription} icon={ReceiptText} />}
  </div>
);

const CashFlowTable = ({ metrics, onSelect }: { metrics: Metrics; onSelect?: (transaction: Transaction) => void }) => {
  const rows = Array.from(
    new Map(
      [...metrics.currentMonth, ...metrics.futureMonth]
        .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())
        .map((transaction) => [transaction.id, transaction]),
    ).values(),
  ).slice(0, 40);

  return (
    <ManagementPanel delay={0.16}>
      <div className="p-7 md:p-8">
        <SectionTitle eyebrow="Controle" title="Tabela de fluxo de caixa" description="Movimentos realizados, pendentes e previstos em ordem cronologica." />
        <div className="mt-7 overflow-hidden rounded-[28px] border border-zinc-200/70 bg-zinc-50/70 dark:border-white/10 dark:bg-white/[0.035]">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-zinc-200/70 bg-white/70 dark:border-white/10 dark:bg-white/[0.035]">
                  <tr className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-white/34">
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Movimento</th>
                    <th className="px-5 py-4">Categoria</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 dark:divide-white/10">
                  {rows.map((transaction) => {
                    const income = isIncome(transaction);
                    const pending = isPending(transaction);
                    const amount = amountOf(transaction);
                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => onSelect?.(transaction)}
                        className="cursor-pointer transition-colors hover:bg-white/80 dark:hover:bg-white/[0.055]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-xs font-bold text-zinc-500 dark:text-white/44">
                          {format(dateOf(transaction), "dd MMM yyyy", { locale: ptBR })}
                        </td>
                        <td className="max-w-[280px] px-5 py-4">
                          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{transaction.description || "Movimentacao financeira"}</p>
                          <p className="mt-1 text-[10px] font-bold text-zinc-400 dark:text-white/32">{income ? "Entrada" : "Saida"}</p>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-zinc-500 dark:text-white/44">{transaction.category || "Sem categoria"}</td>
                        <td className="px-5 py-4">
                          <span className={cn(
                            "rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em]",
                            pending ? "bg-amber-500/12 text-amber-700 dark:text-amber-300" : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                          )}>
                            {pending ? "Pendente" : "Confirmado"}
                          </span>
                        </td>
                        <td className={cn("px-5 py-4 text-right text-sm font-black tabular-nums", income ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                          {income ? "+" : "-"} {currency(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyHint title="Sem movimentos no fluxo" description="Receitas e despesas cadastradas aparecem aqui em ordem de vencimento ou realizacao." icon={LineChart} />
            </div>
          )}
        </div>
      </div>
    </ManagementPanel>
  );
};

const Overview = (props: ManagementProps & { metrics: Metrics; onCreateEntry: (type: EntryType) => void }) => {
  const { metrics, setActiveView, setSelectedTransaction, onCreateEntry } = props;

  return (
    <div className="space-y-6">
      <Hero metrics={metrics} setActiveView={setActiveView} onCreateEntry={onCreateEntry} />
      <Radar metrics={metrics} setActiveView={setActiveView} />
      <FinancialCalendarCard
        onOpenFutureStatement={() => setActiveView("gestao-fluxo-caixa")}
        onOpenScheduledPayments={() => setActiveView("gestao-despesas")}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <CashFlowOverview metrics={metrics} setActiveView={setActiveView} />
        <CategoryList title="Despesas por categoria" categories={metrics.expenseCategories} emptyLabel="Sem despesas categorizadas" />
      </div>
      <ActionQueue metrics={metrics} setActiveView={setActiveView} />
      <div className="grid gap-6 xl:grid-cols-2">
        <ManagementPanel>
          <div className="p-7 md:p-8">
            <SectionTitle eyebrow="Receitas" title="Entradas recentes" description="Últimas receitas lançadas ou conciliadas." />
            <div className="mt-7"><TransactionRows transactions={metrics.incomeTransactions} onSelect={setSelectedTransaction} emptyTitle="Sem receitas ainda" emptyDescription="Comece lançando uma receita manual ou gerando uma cobrança." /></div>
          </div>
        </ManagementPanel>
        <ManagementPanel>
          <div className="p-7 md:p-8">
            <SectionTitle eyebrow="Cobranças" title="Recebíveis em atenção" description="Cobranças pendentes, vencidas ou sem baixa." />
            <div className="mt-7"><ReceivablesList metrics={metrics} onSelect={setSelectedTransaction} /></div>
          </div>
        </ManagementPanel>
      </div>
      <PlanningPanel metrics={metrics} compact setActiveView={setActiveView} />
    </div>
  );
};

const ReceivablesList = ({ metrics, onSelect }: { metrics: Metrics; onSelect?: (transaction: Transaction) => void }) => {
  const transactions = metrics.pendingIncomeTransactions;
  if (!transactions.length) return <EmptyHint title="Sem cobranças pendentes" description="As cobranças abertas ou atrasadas aparecerão aqui para acompanhamento gerencial." icon={CheckCircle2} />;

  return (
    <div className="space-y-3">
      {transactions.slice(0, 8).map((transaction) => {
        const overdue = isBefore(dateOf(transaction), new Date());
        return (
          <button key={transaction.id} type="button" onClick={() => onSelect?.(transaction)} className={cn("grid w-full grid-cols-[1fr_130px_120px] items-center gap-3 rounded-[22px] border p-4 text-left transition-all hover:bg-white dark:hover:bg-white/[0.055]", overdue ? "border-amber-500/25 bg-amber-50/75 dark:border-amber-300/15 dark:bg-amber-300/[0.055]" : "border-zinc-200/70 bg-zinc-50/72 dark:border-white/10 dark:bg-white/[0.035]") }>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{transaction.description || "Cobrança pendente"}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-white/32">{overdue ? "Vencida" : "A receber"}</p>
            </div>
            <p className="text-sm font-black text-zinc-950 dark:text-white">{currency(amountOf(transaction))}</p>
            <p className="text-xs font-bold text-zinc-500 dark:text-white/42">{format(dateOf(transaction), "dd MMM", { locale: ptBR })}</p>
          </button>
        );
      })}
    </div>
  );
};

const RevenueExpensePanels = ({ metrics, setSelectedTransaction, onCreateEntry }: { metrics: Metrics; setSelectedTransaction: (transaction: Transaction | null) => void; onCreateEntry: (type: EntryType) => void }) => (
  <div className="grid gap-6 xl:grid-cols-2">
    <ManagementPanel>
      <div className="p-7 md:p-8">
        <SectionTitle eyebrow="Receitas" title="Receitas gerenciais" description="Entradas confirmadas, fontes de receita e lançamentos recentes." />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => onCreateEntry("income")} className="h-11 rounded-2xl bg-zinc-950 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white hover:bg-black dark:bg-white dark:text-zinc-950">
            Nova receita <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3">
          <MiniStat label="Mês" value={currency(metrics.incomeMonth)} dark />
          <MiniStat label="Ticket" value={currency(metrics.averageTicket)} />
          <MiniStat label="A receber" value={currency(metrics.receivable)} />
        </div>
        <div className="mt-7"><TransactionRows transactions={metrics.incomeTransactions} onSelect={setSelectedTransaction} emptyTitle="Sem receitas" emptyDescription="As receitas confirmadas e manuais aparecerão nesta lista." /></div>
      </div>
    </ManagementPanel>
    <CategoryList title="Receitas por categoria" categories={metrics.revenueCategories} emptyLabel="Sem receitas categorizadas" />
  </div>
);

const ExpensesPanels = ({ metrics, setSelectedTransaction, onCreateEntry }: { metrics: Metrics; setSelectedTransaction: (transaction: Transaction | null) => void; onCreateEntry: (type: EntryType) => void }) => (
  <div className="grid gap-6 xl:grid-cols-2">
    <ManagementPanel>
      <div className="p-7 md:p-8">
        <SectionTitle eyebrow="Despesas" title="Despesas do consultório" description="Custos fixos, variáveis e recorrências que afetam seu resultado." />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => onCreateEntry("expense")} className="h-11 rounded-2xl bg-zinc-950 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white hover:bg-black dark:bg-white dark:text-zinc-950">
            Nova despesa <PlusCircle className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-3">
          <MiniStat label="Mês" value={currency(metrics.expenseMonth)} dark />
          <MiniStat label="Fixas" value={currency(metrics.fixedExpenses)} />
          <MiniStat label="Previstas" value={currency(metrics.upcomingExpenses)} />
        </div>
        <div className="mt-7"><TransactionRows transactions={metrics.expenseTransactions} onSelect={setSelectedTransaction} emptyTitle="Sem despesas" emptyDescription="Cadastre despesas fixas e variáveis para calcular seu ponto de equilíbrio." /></div>
      </div>
    </ManagementPanel>
    <CategoryList title="Despesas por categoria" categories={metrics.expenseCategories} emptyLabel="Sem despesas categorizadas" />
  </div>
);

const MiniStat = ({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) => (
  <div className={cn("rounded-[24px] border p-4", dark ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950" : "border-zinc-200/70 bg-zinc-50/70 dark:border-white/10 dark:bg-white/[0.035]") }>
    <p className={cn("text-[8px] font-black uppercase tracking-[0.18em]", dark ? "opacity-45" : "text-zinc-400 dark:text-white/32")}>{label}</p>
    <p className="mt-3 text-lg font-black tracking-[-0.045em]">{value}</p>
  </div>
);

const PlanningPanel = ({ metrics, compact = false, setActiveView }: { metrics: Metrics; compact?: boolean; setActiveView: (view: FinanceView) => void }) => {
  const planning = useFinancialPlanning(new Date());
  const { data: projection = [] } = useProjectedCashFlow("mixed", compact ? 90 : 180, "monthly");
  const suggestedRevenue = Math.max(metrics.incomeMonth + metrics.upcomingIncome, metrics.incomeMonth, 0);
  const suggestedExpenseLimit = Math.max(metrics.expenseMonth + metrics.upcomingExpenses, metrics.fixedExpenses, 0);
  const [revenueGoal, setRevenueGoal] = useState("");
  const [expenseLimit, setExpenseLimit] = useState("");
  const [desiredProfit, setDesiredProfit] = useState("");
  const [targetSessions, setTargetSessions] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const goal = planning.goal;
    setRevenueGoal(String((goal ? fromPlanningCents(goal.revenue_goal_cents) : suggestedRevenue).toFixed(2)).replace(".", ","));
    setExpenseLimit(String((goal ? fromPlanningCents(goal.expense_limit_cents) : suggestedExpenseLimit).toFixed(2)).replace(".", ","));
    setDesiredProfit(String((goal ? fromPlanningCents(goal.desired_profit_cents) : Math.max(0, suggestedRevenue - suggestedExpenseLimit)).toFixed(2)).replace(".", ","));
    setTargetSessions(String(goal?.target_sessions || metrics.breakEvenSessions || ""));
    setNotes(goal?.notes || "");
  }, [metrics.breakEvenSessions, planning.goal, suggestedExpenseLimit, suggestedRevenue]);

  const revenueGoalValue = parseMoneyInput(revenueGoal);
  const expenseLimitValue = parseMoneyInput(expenseLimit);
  const desiredProfitValue = parseMoneyInput(desiredProfit);
  const targetSessionsValue = Math.max(0, Math.round(Number(targetSessions || 0)));
  const goalProgress = revenueGoalValue > 0 ? Math.min(100, (metrics.incomeMonth / revenueGoalValue) * 100) : 0;
  const expenseUsage = expenseLimitValue > 0 ? Math.min(100, (metrics.expenseMonth / expenseLimitValue) * 100) : 0;
  const remaining = Math.max(0, revenueGoalValue - metrics.incomeMonth);
  const sessionsNeeded = metrics.averageTicket > 0 ? Math.ceil(remaining / metrics.averageTicket) : 0;
  const projectedMonths = projection
    .filter((point) => new Date(point.date) >= startOfMonth(new Date()))
    .slice(0, compact ? 3 : 6);
  const projectionEvents = projectedMonths
    .flatMap((point) => point.details.slice(0, compact ? 2 : 4).map((detail) => ({ ...detail, period: point.fullLabel })))
    .slice(0, compact ? 4 : 10);

  const handleSave = async () => {
    try {
      await planning.saveGoal.mutateAsync({
        revenueGoal: revenueGoalValue,
        expenseLimit: expenseLimitValue,
        desiredProfit: desiredProfitValue,
        targetSessions: targetSessionsValue,
        notes,
      });
      toast.success("Meta financeira salva.");
    } catch (error) {
      console.error("Falha ao salvar planejamento:", error);
      toast.error("Nao foi possivel salvar a meta financeira.");
    }
  };

  return (
    <ManagementPanel>
      <div className="p-7 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <SectionTitle eyebrow="Planejamento" title="Metas e ponto de equilíbrio" description="Meta salva, limite de despesas e previsão explicada pelos eventos financeiros reais." />
          {compact ? <Button onClick={() => setActiveView("gestao-planejamento")} variant="outline" className="h-11 shrink-0 rounded-2xl border-zinc-200 bg-white/70 text-[9px] font-black uppercase tracking-[0.18em] dark:border-white/10 dark:bg-white/[0.04]">Abrir</Button> : null}
        </div>
        <div className="mt-8 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] bg-zinc-950 p-6 text-white dark:bg-white dark:text-zinc-950">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">{planning.goal ? "Meta salva" : "Meta inicial"}</p>
            <h3 className="mt-3 text-4xl font-black tracking-[-0.065em]">{currency(revenueGoalValue)}</h3>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10 dark:bg-zinc-950/10"><div className="h-full rounded-full bg-white dark:bg-zinc-950" style={{ width: `${goalProgress}%` }} /></div>
            <p className="mt-4 text-sm font-medium leading-relaxed opacity-62">Você já atingiu {goalProgress.toFixed(0)}% da meta de receita do mês.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MiniStat label="Falta" value={currency(remaining)} />
            <MiniStat label="Sessões" value={sessionsNeeded ? `${sessionsNeeded}` : "—"} />
            <MiniStat label="Equilíbrio" value={metrics.breakEvenSessions ? `${metrics.breakEvenSessions}` : "—"} />
          </div>
        </div>
        {!compact ? (
          <>
            <div className="mt-6 grid gap-4 xl:grid-cols-4">
              <PlanningField label="Meta de receita" value={revenueGoal} onChange={setRevenueGoal} />
              <PlanningField label="Limite de despesas" value={expenseLimit} onChange={setExpenseLimit} />
              <PlanningField label="Lucro desejado" value={desiredProfit} onChange={setDesiredProfit} />
              <div>
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-white/32">Sessões alvo</p>
                <Input value={targetSessions} onChange={(event) => setTargetSessions(event.target.value)} inputMode="numeric" className="h-12 rounded-2xl border-zinc-200 bg-white/80 text-sm font-bold dark:border-white/10 dark:bg-white/[0.035]" />
              </div>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4 rounded-[28px] border border-zinc-200/70 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-white/[0.035]">
                <MiniBar label="Receita realizada" value={metrics.incomeMonth} max={Math.max(revenueGoalValue, 1)} tone="positive" />
                <MiniBar label="Despesa usada" value={metrics.expenseMonth} max={Math.max(expenseLimitValue, 1)} tone={expenseUsage > 85 ? "negative" : "default"} />
                <MiniStat label="Resultado desejado" value={currency(desiredProfitValue)} />
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas do planejamento" className="min-h-24 rounded-2xl border-zinc-200 bg-white/80 text-sm dark:border-white/10 dark:bg-white/[0.035]" />
                <Button onClick={handleSave} disabled={planning.saveGoal.isPending} className="h-12 w-full rounded-2xl bg-zinc-950 text-[9px] font-black uppercase tracking-[0.18em] text-white dark:bg-white dark:text-zinc-950">
                  {planning.saveGoal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar planejamento
                </Button>
              </div>
              <div className="rounded-[28px] border border-zinc-200/70 bg-white/72 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400 dark:text-white/32">Eventos da previsão</p>
                <div className="mt-4 space-y-3">
                  {projectionEvents.length ? projectionEvents.map((event) => (
                    <div key={`${event.id}-${event.period}-${event.description}`} className="grid grid-cols-[1fr_120px] gap-3 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{event.description}</p>
                        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{event.period} · {event.source}</p>
                      </div>
                      <p className={cn("text-right text-sm font-black tabular-nums", event.type === "income" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                        {event.type === "income" ? "+" : "-"} {currency(event.amount)}
                      </p>
                    </div>
                  )) : (
                    <EmptyHint title="Sem eventos previstos" description="Cadastre cobranças, despesas ou recorrências para explicar a projeção." icon={LineChart} />
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </ManagementPanel>
  );
};

const PlanningField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <div>
    <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-white/32">{label}</p>
    <Input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" className="h-12 rounded-2xl border-zinc-200 bg-white/80 text-sm font-bold dark:border-white/10 dark:bg-white/[0.035]" />
  </div>
);

const ReportsPanel = ({ metrics }: { metrics: Metrics }) => {
  const reports = [
    { title: "DRE simplificada", description: "Receitas, despesas e resultado do mês.", icon: FileText },
    { title: "Fluxo de caixa", description: "Realizado, previsto e projetado.", icon: LineChart },
    { title: "Cobranças vencidas", description: "Valores em aberto por status e vencimento.", icon: Users },
    { title: "Contador", description: "Resumo mensal para exportação futura.", icon: ReceiptText },
  ];

  return (
    <ManagementPanel>
      <div className="p-7 md:p-8">
        <SectionTitle eyebrow="Relatórios" title="Leituras para decisão" description="Relatórios simples, bonitos e preparados para exportações futuras." />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reports.map((report) => (
            <article key={report.title} className="rounded-[28px] border border-zinc-200/70 bg-zinc-50/72 p-5 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><report.icon className="h-5 w-5" /></div>
              <h3 className="mt-7 text-lg font-black tracking-[-0.035em] text-zinc-950 dark:text-white">{report.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-500 dark:text-white/42">{report.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-[28px] bg-zinc-950 p-6 text-white dark:bg-white dark:text-zinc-950">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">Resumo do mês</p>
          <p className="mt-4 text-sm font-medium leading-relaxed opacity-66">Receitas confirmadas de {currency(metrics.incomeMonth)}, despesas de {currency(metrics.expenseMonth)} e resultado parcial de {currency(metrics.resultMonth)}.</p>
        </div>
      </div>
    </ManagementPanel>
  );
};

const RouteFrame = ({ eyebrow, title, description, children, setActiveView, onCreateEntry }: { eyebrow: string; title: string; description: string; children: ReactNode; setActiveView: (view: FinanceView) => void; onCreateEntry?: (type: EntryType) => void }) => (
  <div className="space-y-6">
    <ManagementPanel className="rounded-[38px]">
      <div className="flex items-center justify-between gap-6 p-8 md:p-10">
        <div>
          <ManagementBadge icon={Landmark}>{eyebrow}</ManagementBadge>
          <h1 className="mt-7 text-5xl font-black leading-[0.9] tracking-[-0.065em] text-zinc-950 dark:text-white">{title}</h1>
          <p className="mt-5 max-w-3xl text-base font-medium leading-relaxed text-zinc-500 dark:text-white/48">{description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {onCreateEntry ? (
            <>
              <Button onClick={() => onCreateEntry("income")} className="h-12 rounded-2xl bg-zinc-950 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white hover:bg-black dark:bg-white dark:text-zinc-950">
                Receita
              </Button>
              <Button onClick={() => onCreateEntry("expense")} variant="outline" className="h-12 rounded-2xl border-zinc-200 bg-white/70 px-4 text-[9px] font-black uppercase tracking-[0.18em] dark:border-white/10 dark:bg-white/[0.04]">
                Despesa
              </Button>
            </>
          ) : null}
          <Button onClick={() => setActiveView("gestao-visao-geral")} variant="outline" className="h-12 rounded-2xl border-zinc-200 bg-white/70 px-4 text-[9px] font-black uppercase tracking-[0.18em] dark:border-white/10 dark:bg-white/[0.04]">
            Visão geral
          </Button>
        </div>
      </div>
    </ManagementPanel>
    {children}
  </div>
);

export const FinancialManagementDashboard = (props: ManagementProps) => {
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>("income");
  const metrics = useMemo(
    () => buildFinancialMetrics(props.allTransactions, props.realizedTransactions, props.futureTransactions, props.subscriptionTransactions),
    [props.allTransactions, props.futureTransactions, props.realizedTransactions, props.subscriptionTransactions],
  );

  const common = { metrics, setActiveView: props.setActiveView };
  const openEntryModal = (type: EntryType) => {
    setEntryType(type);
    setEntryModalOpen(true);
  };
  const withEntryModal = (children: ReactNode) => (
    <>
      <NewTransactionModal
        open={entryModalOpen}
        onOpenChange={setEntryModalOpen}
        showTrigger={false}
        defaultType={entryType}
      />
      {children}
    </>
  );

  if (props.isLoadingTransactions) {
    return (
      <div className="space-y-6 px-6 py-6">
        <div className="h-80 animate-pulse rounded-[42px] bg-zinc-100 dark:bg-white/[0.035]" />
        <div className="grid gap-4 md:grid-cols-3"><div className="h-40 animate-pulse rounded-[28px] bg-zinc-100 dark:bg-white/[0.035]" /><div className="h-40 animate-pulse rounded-[28px] bg-zinc-100 dark:bg-white/[0.035]" /><div className="h-40 animate-pulse rounded-[28px] bg-zinc-100 dark:bg-white/[0.035]" /></div>
      </div>
    );
  }

  switch (props.activeView) {
    case "gestao-fluxo-caixa":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Fluxo de caixa" description="Realizado, previsto, projetado e cenários para entender a previsibilidade da clínica." setActiveView={props.setActiveView} onCreateEntry={openEntryModal}><CashFlowOverview {...common} /><CashFlowTable metrics={metrics} onSelect={props.setSelectedTransaction} /><ActionQueue {...common} /></RouteFrame></div>);
    case "gestao-receitas":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Receitas" description="Entradas confirmadas, ticket médio, fontes de receita e lançamentos recentes." setActiveView={props.setActiveView} onCreateEntry={openEntryModal}><RevenueExpensePanels metrics={metrics} setSelectedTransaction={props.setSelectedTransaction} onCreateEntry={openEntryModal} /></RouteFrame></div>);
    case "gestao-despesas":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Despesas" description="Custos fixos, variáveis, recorrências e categorias que afetam o resultado." setActiveView={props.setActiveView} onCreateEntry={openEntryModal}><ExpensesPanels metrics={metrics} setSelectedTransaction={props.setSelectedTransaction} onCreateEntry={openEntryModal} /></RouteFrame></div>);
    case "gestao-cobrancas":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Cobranças" description="Acompanhe cobranças abertas, a vencer, vencidas e recorrentes de forma gerencial." setActiveView={props.setActiveView}><ChargesWorkspace scope="management" title="Cobranças gerenciais" /><ActionQueue {...common} /></RouteFrame></div>);
    case "gestao-inadimplencia":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Cobranças" description="Filtro legado de inadimplência: cobranças vencidas dentro da área de Cobranças." setActiveView={props.setActiveView}><ChargesWorkspace scope="management" title="Cobranças vencidas" initialStatusFilters={["overdue"]} /></RouteFrame></div>);
    case "gestao-planejamento":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Planejamento" description="Metas, ponto de equilíbrio, ticket médio e cenários de crescimento." setActiveView={props.setActiveView} onCreateEntry={openEntryModal}><PlanningPanel {...common} /><RecurringManager /><ActionQueue {...common} /></RouteFrame></div>);
    case "gestao-relatorios":
      return withEntryModal(<div className="px-6 py-6"><RouteFrame eyebrow="Gestão Financeira" title="Relatórios" description="DRE simplificada, fluxo, cobranças vencidas e resumo para contador." setActiveView={props.setActiveView} onCreateEntry={openEntryModal}><ReportsPanel metrics={metrics} /></RouteFrame></div>);
    case "gestao-visao-geral":
    default:
      return withEntryModal(<div className="px-6 py-6"><Overview {...props} metrics={metrics} onCreateEntry={openEntryModal} /></div>);
  }
};

export default FinancialManagementDashboard;
