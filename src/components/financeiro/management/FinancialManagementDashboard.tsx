"use client";
import { useEffect, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Landmark,
  Plus,
  Search,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { ChargesWorkspace } from "@/components/financeiro/ChargesWorkspace";
import { FinancialSettlementModal } from "@/components/financeiro/FinancialSettlementModal";
import { ManualChargeModal } from "@/components/financeiro/ManualChargeModal";
import { NewTransactionModal } from "@/components/financeiro/NewTransactionModal";
import {
  SYNAPSE_PAGE_ACTION_EVENT,
  type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";
import {
  ConventionAndTransfersView,
  ManagementRecurrenceView,
} from "@/components/financeiro/management/ManagementSpecializedViews";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import {
  DesktopMiniStat,
  DesktopWorkspaceIcon,
  DesktopWorkspacePanel,
  DesktopWorkspaceShell,
} from "@/components/ui/desktop-workspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fromPlanningCents,
  useFinancialPlanning,
} from "@/hooks/use-financial-planning";
import {
  buildFinancialManagementMetrics,
  managementCategoryOf,
  managementAllowsManualSettlement,
  managementDateKeyOf,
  managementOriginOf,
  managementOutstandingAmountOf,
  managementStatusOf,
  monthKeyFromDate,
  type FinancialBasis,
} from "@/lib/financial-management-model";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import type { FinanceView } from "../FinancialDashboard";

const FINANCE_PANEL_SURFACE =
  "finance-panel border-border/55 bg-background/[0.76] dark:border-black/75 dark:bg-zinc-900/[0.58] dark:ring-black/50";

const MANAGEMENT_VIEW_CONTEXT: Partial<Record<FinanceView, { title: string; description: string }>> = {
  "gestao-visao-geral": { title: "Visão geral", description: "Resultado, previsões e pendências do consultório." },
  "gestao-cobrancas": { title: "Cobranças manuais", description: "Crie e acompanhe cobranças gerenciais sem misturá-las ao extrato bancário." },
  "gestao-lancamentos": { title: "Lançamentos", description: "Consulte entradas e saídas registradas na gestão." },
  "gestao-recebimentos": { title: "Recebimentos", description: "Acompanhe baixas e valores ainda em aberto." },
  "gestao-repasses-convenio": { title: "Repasses e convênio", description: "Somente cobranças vinculadas a uma configuração estruturada de convênio." },
  "gestao-recorrencia": { title: "Recorrência", description: "Controle entradas e saídas periódicas da clínica e pessoais." },
  "gestao-planejamento": { title: "Planejamento", description: "Defina metas e limites para o período selecionado." },
};

export interface NeuroFinanceManagementContext {
  enabled: boolean;
  connected: boolean;
  balance?: number;
  pending?: number;
  isStale?: boolean;
  lastUpdatedAt?: string | null;
}
type Props = {
  activeView: FinanceView;
  setActiveView: (v: FinanceView) => void;
  allTransactions: Transaction[];
  managementTransactions?: Transaction[];
  realizedTransactions: Transaction[];
  futureTransactions: Transaction[];
  subscriptionTransactions: Transaction[];
  isLoadingTransactions: boolean;
  setSelectedTransaction: (t: Transaction | null) => void;
  neurofinance?: NeuroFinanceManagementContext;
};
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(v) ? v : 0);
const amount = (t: Transaction) => Math.abs(Number(t.amount || 0));
const ENTRIES_PAGE_SIZE = 20;
const date = (t: Transaction, b: FinancialBasis) => {
  const k = managementDateKeyOf(t, b);
  return k ? k.split("-").reverse().join("/") : "Sem data";
};
function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DesktopWorkspacePanel className={cn(FINANCE_PANEL_SURFACE, "p-5 lg:p-6")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </DesktopWorkspacePanel>
  );
}
function Rows({
  rows,
  basis,
  onOpen,
  onSettle,
}: {
  rows: Transaction[];
  basis: FinancialBasis;
  onOpen: (t: Transaction) => void;
  onSettle?: (t: Transaction) => void;
}) {
  if (!rows.length)
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground dark:border-black/70">
        Nenhum registro neste recorte.
      </div>
    );
  return (
    <div className="finance-inset overflow-x-auto rounded-2xl border border-border/60 dark:border-black/75">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="border-b border-border/55 bg-muted/35 text-left text-muted-foreground dark:border-black/70 dark:bg-black/20">
          <tr>
            <th className="p-3">Data</th>
            <th className="p-3">Descrição</th>
            <th className="p-3">Categoria</th>
            <th className="p-3">Origem</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Valor</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/55 dark:divide-black/70">
          {rows.map((t) => {
            const open = managementOutstandingAmountOf(t) > 0;
            return (
              <tr key={t.id} className="transition-colors duration-150 hover:bg-muted/30 dark:hover:bg-white/[0.025]">
                <td className="p-3 text-muted-foreground">{date(t, basis)}</td>
                <td className="max-w-[280px] p-3">
                  <button
                    type="button"
                    onClick={() => onOpen(t)}
                    className="block max-w-full truncate rounded-sm font-medium hover:underline"
                  >
                    {t.description}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {t.patient_name || t.patients?.name || "Sem paciente"}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {managementCategoryOf(t)}
                </td>
                <td className="p-3">
                  <span className="inline-flex rounded-full border border-border/55 bg-muted/35 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
                    {managementOriginOf(t)}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs",
                      managementStatusOf(t) === "paid"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted/70 text-muted-foreground",
                    )}
                  >
                    {managementStatusOf(t) === "paid" ? "Pago" : "Em aberto"}
                  </span>
                </td>
                <td
                  className={cn(
                    "p-3 text-right font-semibold",
                    t.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
                  )}
                >
                  {t.type === "income" ? "+" : "−"} {money(amount(t))}
                </td>
                <td className="p-3 text-right">
                  {open && onSettle && managementAllowsManualSettlement(t) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSettle(t)}
                    >
                      Dar baixa
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onOpen(t)}>
                      Abrir
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function Planning({
  month,
  metrics,
}: {
  month: Date;
  metrics: ReturnType<typeof buildFinancialManagementMetrics>;
}) {
  const p = useFinancialPlanning(month);
  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setRevenue(
      p.goal
        ? String(fromPlanningCents(p.goal.revenue_goal_cents)).replace(".", ",")
        : "",
    );
    setExpenses(
      p.goal
        ? String(fromPlanningCents(p.goal.expense_limit_cents)).replace(
            ".",
            ",",
          )
        : "",
    );
    setNotes(p.goal?.notes || "");
  }, [p.goal, p.monthKey]);
  const parse = (x: string) =>
    Number(x.replace(/\./g, "").replace(",", ".")) || 0;
  const save = async () => {
    try {
      await p.saveGoal.mutateAsync({
        revenueGoal: parse(revenue),
        expenseLimit: parse(expenses),
        desiredProfit: Math.max(0, parse(revenue) - parse(expenses)),
        targetSessions: 0,
        notes,
      });
      toast.success("Planejamento salvo.");
    } catch {
      toast.error("Não foi possível salvar.");
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[.7fr_1.3fr]">
        <DesktopWorkspacePanel highContrast className="border-foreground/90 p-6 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.52)] dark:border-black/80 dark:shadow-[0_24px_64px_-42px_rgba(0,0,0,0.96)]">
          <Target className="h-5 w-5 opacity-60" />
          <p className="mt-8 text-sm opacity-60">Meta mensal</p>
          <p className="mt-2 text-4xl font-bold">{money(parse(revenue))}</p>
          <p className="mt-3 text-sm opacity-60">
            Realizado: {money(metrics.received)}
          </p>
        </DesktopWorkspacePanel>
        <Panel title="Metas do período">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Meta de receita</Label>
              <Input
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
              />
            </div>
            <div>
              <Label>Limite de despesas</Label>
              <Input
                value={expenses}
                onChange={(e) => setExpenses(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label>Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="mt-4" onClick={save}>
            Salvar
          </Button>
        </Panel>
      </div>
    </div>
  );
}
export const FinancialManagementDashboard = (props: Props) => {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [basis, setBasis] = useState<FinancialBasis>("cash");
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [settlement, setSettlement] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [entriesPage, setEntriesPage] = useState(1);
  const rows = props.managementTransactions || props.allTransactions;
  const metrics = useMemo(
    () =>
      buildFinancialManagementMetrics(rows, {
        monthKey: monthKeyFromDate(month),
        todayKey: format(new Date(), "yyyy-MM-dd"),
        basis,
      }),
    [rows, month, basis],
  );
  const aliases: Partial<Record<FinanceView, FinanceView>> = {
    "gestao-fluxo-caixa": "gestao-visao-geral",
    "gestao-receitas": "gestao-lancamentos",
    "gestao-despesas": "gestao-lancamentos",
    "gestao-inadimplencia": "gestao-recebimentos",
    "gestao-relatorios": "gestao-lancamentos",
  };
  const view = aliases[props.activeView] || props.activeView;
  const viewContext = MANAGEMENT_VIEW_CONTEXT[view] || MANAGEMENT_VIEW_CONTEXT["gestao-visao-geral"]!;
  const showPeriodControls = [
    "gestao-visao-geral",
    "gestao-lancamentos",
    "gestao-recebimentos",
    "gestao-repasses-convenio",
    "gestao-planejamento",
  ].includes(view);
  const showEntryActions = ["gestao-visao-geral", "gestao-lancamentos"].includes(view);
  const showChargeAction = view === "gestao-visao-geral";
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return rows;
    return rows.filter((transaction) =>
      `${transaction.description} ${transaction.patient_name || transaction.patients?.name || ""} ${transaction.category || ""} ${managementOriginOf(transaction)}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [rows, search]);
  const entriesPageCount = Math.max(1, Math.ceil(filtered.length / ENTRIES_PAGE_SIZE));
  const visibleEntries = useMemo(
    () => filtered.slice((entriesPage - 1) * ENTRIES_PAGE_SIZE, entriesPage * ENTRIES_PAGE_SIZE),
    [entriesPage, filtered],
  );

  useEffect(() => {
    setEntriesPage(1);
  }, [basis, search]);

  useEffect(() => {
    setEntriesPage((current) => Math.min(current, entriesPageCount));
  }, [entriesPageCount]);

  useEffect(() => {
    const handleSynapseAction = (event: Event) => {
      const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
      if (action?.action === "open_modal" && action.modal === "new_charge") {
        setChargeOpen(true);
      }
    };

    window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
  }, []);

  const openEntry = (type: "income" | "expense") => {
    setEntryType(type);
    setEntryOpen(true);
  };
  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Data", "Descrição", "Tipo", "Categoria", "Origem", "Status", "Valor"],
      ...filtered.map((t) => [
        date(t, basis),
        t.description,
        t.type,
        t.category,
        managementOriginOf(t),
        managementStatusOf(t),
        amount(t),
      ]),
    ]
      .map((r) => r.map(q).join(";"))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\ufeff${csv}`], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestao-financeira-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (props.isLoadingTransactions)
    return (
      <div className="p-6">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <NewTransactionModal
        open={entryOpen}
        onOpenChange={setEntryOpen}
        showTrigger={false}
        defaultType={entryType}
      />
      <ManualChargeModal open={chargeOpen} onOpenChange={setChargeOpen} />
      <FinancialSettlementModal
        transaction={settlement}
        open={Boolean(settlement)}
        onOpenChange={(v) => {
          if (!v) setSettlement(null);
        }}
      />
      <DesktopWorkspaceShell className="finance-frame border-border/45 bg-background/70 dark:border-black/80 dark:bg-black/[0.32] dark:ring-black/60">
        <div className="finance-panel mb-4 flex flex-wrap items-center gap-3 rounded-[28px] border border-border/55 bg-background/[0.76] p-4 dark:border-black/75 dark:bg-zinc-900/[0.58]">
          <DesktopWorkspaceIcon icon={CircleDollarSign} className="finance-inset dark:border-black/75 dark:bg-black/35" />
          <div className="min-w-48 flex-1">
            <h1 className="text-xl font-bold">{viewContext.title}</h1>
            <p className="text-sm text-muted-foreground">{viewContext.description}</p>
          </div>
          {showPeriodControls ? <div className="finance-inset flex items-center rounded-xl border border-border/60 bg-background/[0.45] dark:border-black/75 dark:bg-black/25">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-28 text-center text-sm capitalize">
              {format(month, "MMM yyyy", { locale: ptBR })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div> : null}
          {showPeriodControls ? <MagneticSegmentedControl
            id="financial-management-basis"
            indicatorId="financial-management-basis-indicator"
            value={basis}
            onValueChange={setBasis}
            ariaLabel="Regime de apuração financeira"
            behavior="single-select"
            options={[
              { value: "cash", label: "Caixa" },
              { value: "competence", label: "Competência" },
            ]}
            className="finance-inset h-12 min-h-12 shrink-0 rounded-xl border-border/60 bg-background/[0.45] dark:border-black/75 dark:bg-black/25"
            triggerClassName="h-11 min-h-11 rounded-lg px-3 py-0 text-xs"
          /> : null}
          {showEntryActions ? <Button variant="outline" className="min-h-11" onClick={() => openEntry("expense")}>
            <ArrowDownRight className="mr-2 h-4 w-4" />
            Despesa
          </Button> : null}
          {showEntryActions ? <Button variant="outline" className="min-h-11" onClick={() => openEntry("income")}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Receita
          </Button> : null}
          {showChargeAction ? <Button className="min-h-11" onClick={() => setChargeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cobrança
          </Button> : null}
        </div>
        <div key={view} className="animate-fade-in motion-reduce:animate-none">
        {view === "gestao-visao-geral" ? (
          <div data-synapse-target="finance-overview" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <DesktopMiniStat
                className="finance-kpi finance-kpi-accent dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                accent
                label="Resultado"
                value={compact(metrics.result)}
                detail={
                  basis === "cash" ? "Regime de caixa" : "Regime de competência"
                }
              />
              <DesktopMiniStat
                className="finance-kpi dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                tone="success"
                label="Recebido"
                value={compact(metrics.received)}
              />
              <DesktopMiniStat
                className="finance-kpi dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                label="Despesas pagas"
                value={compact(metrics.paidExpenses)}
              />
              <DesktopMiniStat
                className="finance-kpi dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                tone={metrics.overdueCount ? "warning" : "default"}
                label="A receber"
                value={compact(metrics.receivable)}
                detail={`${metrics.overdueCount} vencida(s)`}
              />
            </div>
            <div className="finance-inset flex flex-wrap items-center gap-3 rounded-2xl border border-border/55 bg-background/[0.42] p-4 dark:border-black/75 dark:bg-black/[0.24]">
              <Landmark className="h-4 w-4" />
              <p className="flex-1 text-sm text-muted-foreground">
                {props.neurofinance?.connected
                  ? `NeuroFinance conectado · saldo ${money(props.neurofinance.balance || 0)}`
                  : "A gestão funciona sem NeuroFinance. O módulo bancário é opcional."}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.setActiveView("conta-digital")}
              >
                Abrir
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
              <Panel title="Movimentações recentes">
                <Rows
                  rows={metrics.recent}
                  basis={basis}
                  onOpen={props.setSelectedTransaction}
                  onSettle={setSettlement}
                />
              </Panel>
              <Panel title="Precisa de atenção">
                {metrics.attention.length ? (
                  <div className="space-y-2">
                    {metrics.attention.map((x) => (
                      <button
                        key={x.id}
                        onClick={() =>
                          props.setSelectedTransaction(x.transaction)
                        }
                        className="finance-inset flex w-full items-center gap-3 rounded-xl border border-border/55 p-3 text-left transition-[background-color,transform] duration-150 hover:bg-muted/35 active:scale-[0.99] dark:border-black/70 dark:hover:bg-white/[0.025] motion-reduce:transition-none motion-reduce:active:scale-100"
                      >
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm">{x.title}</b>
                          <span className="text-xs text-muted-foreground">
                            {x.detail}
                          </span>
                        </span>
                        <b className="text-sm">{money(x.amount)}</b>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
                    Tudo em ordem
                  </div>
                )}
              </Panel>
            </div>
          </div>
        ) : null}
        {view === "gestao-lancamentos" ? (
          <div data-synapse-target="finance-entries">
          <Panel
            title="Lançamentos"
            action={
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            }
          >
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar descrição, paciente ou categoria"
              />
            </div>
            <Rows
              rows={visibleEntries}
              basis={basis}
              onOpen={props.setSelectedTransaction}
              onSettle={setSettlement}
            />
            <div className="mt-4 flex flex-col gap-3 text-xs font-semibold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {filtered.length === 0
                  ? "Nenhum lançamento encontrado"
                  : `${(entriesPage - 1) * ENTRIES_PAGE_SIZE + 1}–${Math.min(entriesPage * ENTRIES_PAGE_SIZE, filtered.length)} de ${filtered.length} lançamentos`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full"
                  aria-label="Página anterior de lançamentos"
                  onClick={() => setEntriesPage((current) => Math.max(1, current - 1))}
                  disabled={entriesPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-14 text-center text-[10px] font-black uppercase tracking-widest">
                  {entriesPage}/{entriesPageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full"
                  aria-label="Próxima página de lançamentos"
                  onClick={() => setEntriesPage((current) => Math.min(entriesPageCount, current + 1))}
                  disabled={entriesPage >= entriesPageCount}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Panel>
          </div>
        ) : null}
        {view === "gestao-cobrancas" ? (
          <div data-synapse-target="finance-charges">
            <ChargesWorkspace
              scope="management"
              title="Cobranças manuais"
              initialTypeFilters={["manual"]}
            />
          </div>
        ) : null}
        {view === "gestao-recebimentos" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              <DesktopMiniStat
                className="finance-kpi dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                tone={metrics.overdueCount ? "warning" : "default"}
                label="Vencidas"
                value={metrics.overdueCount}
                detail={money(metrics.overdueAmount)}
              />
              <DesktopMiniStat
                className="finance-kpi dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                label="A vencer"
                value={
                  metrics.openIncomeTransactions.length - metrics.overdueCount
                }
              />
              <DesktopMiniStat
                className="finance-kpi finance-kpi-accent dark:border-black/75 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.96)]"
                accent
                label="Total em aberto"
                value={compact(metrics.receivable)}
                detail="Considera baixas parciais"
              />
            </div>
            <Panel title="Recebimentos em aberto">
              <Rows
                rows={metrics.openIncomeTransactions}
                basis="competence"
                onOpen={props.setSelectedTransaction}
                onSettle={setSettlement}
              />
            </Panel>
          </div>
        ) : null}
        {view === "gestao-repasses-convenio" ? (
          <ConventionAndTransfersView
            transactions={rows}
            onOpen={props.setSelectedTransaction}
            onSettle={setSettlement}
          />
        ) : null}
        {view === "gestao-recorrencia" ? (
          <ManagementRecurrenceView
            transactions={rows}
            onOpen={props.setSelectedTransaction}
          />
        ) : null}
        {view === "gestao-planejamento" ? (
          <Planning month={month} metrics={metrics} />
        ) : null}
        </div>
      </DesktopWorkspaceShell>
    </div>
  );
};
export default FinancialManagementDashboard;
