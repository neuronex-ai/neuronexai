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
import { RecurringManager } from "@/components/financeiro/RecurringManager";
import { Button } from "@/components/ui/button";
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
  managementDateKeyOf,
  managementOutstandingAmountOf,
  managementStatusOf,
  monthKeyFromDate,
  type FinancialBasis,
} from "@/lib/financial-management-model";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";
import type { FinanceView } from "../FinancialDashboard";
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
    <DesktopWorkspacePanel className="p-5 lg:p-6">
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
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum registro neste recorte.
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/35 text-left text-muted-foreground">
          <tr>
            <th className="p-3">Data</th>
            <th className="p-3">Descrição</th>
            <th className="p-3">Categoria</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Valor</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((t) => {
            const open = managementOutstandingAmountOf(t) > 0;
            return (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="p-3 text-muted-foreground">{date(t, basis)}</td>
                <td className="max-w-[280px] p-3">
                  <button
                    onClick={() => onOpen(t)}
                    className="block max-w-full truncate font-medium hover:underline"
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
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs",
                      managementStatusOf(t) === "paid"
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-amber-500/10 text-amber-700",
                    )}
                  >
                    {managementStatusOf(t) === "paid" ? "Pago" : "Em aberto"}
                  </span>
                </td>
                <td
                  className={cn(
                    "p-3 text-right font-semibold",
                    t.type === "income" ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {t.type === "income" ? "+" : "−"} {money(amount(t))}
                </td>
                <td className="p-3 text-right">
                  {open && onSettle ? (
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
  }, [p.goal?.id, p.monthKey]);
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
        <DesktopWorkspacePanel highContrast className="p-6">
          <Target className="h-5 w-5 opacity-60" />
          <p className="mt-8 text-sm opacity-60">Meta mensal</p>
          <p className="mt-2 text-4xl font-bold">{money(parse(revenue))}</p>
          <p className="mt-3 text-sm opacity-60">
            Realizado: {money(metrics.received)}
          </p>
        </DesktopWorkspacePanel>
        <Panel title="Metas do período">
          <div className="grid grid-cols-2 gap-4">
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
      <details className="rounded-[28px] border bg-background/60 p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Gerenciar recorrências
        </summary>
        <div className="mt-6">
          <RecurringManager />
        </div>
      </details>
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
  const filtered = rows.filter(
    (t) =>
      !search ||
      `${t.description} ${t.patient_name || t.patients?.name || ""} ${t.category || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const openEntry = (type: "income" | "expense") => {
    setEntryType(type);
    setEntryOpen(true);
  };
  const exportCsv = () => {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Data", "Descrição", "Tipo", "Categoria", "Status", "Valor"],
      ...filtered.map((t) => [
        date(t, basis),
        t.description,
        t.type,
        t.category,
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
    <div className="p-4 lg:p-5">
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
      <DesktopWorkspaceShell>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[28px] border bg-background/76 p-4">
          <DesktopWorkspaceIcon icon={CircleDollarSign} />
          <div className="min-w-48 flex-1">
            <h1 className="text-xl font-bold">Gestão financeira</h1>
            <p className="text-sm text-muted-foreground">
              Consultório, cobranças e planejamento
            </p>
          </div>
          <div className="flex items-center rounded-xl border">
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
          </div>
          <div className="flex rounded-xl border p-1">
            {(["cash", "competence"] as const).map((x) => (
              <button
                key={x}
                onClick={() => setBasis(x)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs",
                  basis === x && "bg-foreground text-background",
                )}
              >
                {x === "cash" ? "Caixa" : "Competência"}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => openEntry("expense")}>
            <ArrowDownRight className="mr-2 h-4 w-4" />
            Despesa
          </Button>
          <Button variant="outline" onClick={() => openEntry("income")}>
            <ArrowUpRight className="mr-2 h-4 w-4" />
            Receita
          </Button>
          <Button onClick={() => setChargeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cobrança
          </Button>
        </div>
        {view === "gestao-visao-geral" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DesktopMiniStat
                accent
                label="Resultado"
                value={compact(metrics.result)}
                detail={
                  basis === "cash" ? "Regime de caixa" : "Regime de competência"
                }
              />
              <DesktopMiniStat
                tone="success"
                label="Recebido"
                value={compact(metrics.received)}
              />
              <DesktopMiniStat
                label="Despesas pagas"
                value={compact(metrics.paidExpenses)}
              />
              <DesktopMiniStat
                tone={metrics.overdueCount ? "warning" : "default"}
                label="A receber"
                value={compact(metrics.receivable)}
                detail={`${metrics.overdueCount} vencida(s)`}
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border p-4">
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
            <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
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
                        className="flex w-full items-center gap-3 rounded-xl border p-3 text-left"
                      >
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
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
              rows={filtered}
              basis={basis}
              onOpen={props.setSelectedTransaction}
              onSettle={setSettlement}
            />
          </Panel>
        ) : null}
        {view === "gestao-cobrancas" ? (
          <ChargesWorkspace scope="management" title="Cobranças" />
        ) : null}
        {view === "gestao-recebimentos" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <DesktopMiniStat
                tone={metrics.overdueCount ? "warning" : "default"}
                label="Vencidas"
                value={metrics.overdueCount}
                detail={money(metrics.overdueAmount)}
              />
              <DesktopMiniStat
                label="A vencer"
                value={
                  metrics.openIncomeTransactions.length - metrics.overdueCount
                }
              />
              <DesktopMiniStat
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
        {view === "gestao-planejamento" ? (
          <Planning month={month} metrics={metrics} />
        ) : null}
      </DesktopWorkspaceShell>
    </div>
  );
};
export default FinancialManagementDashboard;
