"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleStop,
  Handshake,
  Loader2,
  Pause,
  Play,
  Plus,
  UserRound,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DesktopWorkspacePanel } from "@/components/ui/desktop-workspace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildFinancialEntryIdempotencyKey,
  recurringFinancialEntryScopeOf,
  useCreateRecurringFinancialEntry,
  useRecurringFinancialEntries,
  useUpdateRecurringFinancialEntryStatus,
  validateRecurringFinancialEntryInput,
  type FinancialEntryType,
  type RecurringFinancialEntry,
  type RecurringFinancialEntryAction,
  type RecurringFinancialEntryFrequency,
  type RecurringFinancialEntryScope,
} from "@/hooks/use-financial-entries";
import {
  buildConventionManagementSummary,
  buildRecurrenceManagementSummary,
  recurrenceFrequencyLabelOf,
  recurrenceReferenceDateOf,
  type RecurrenceScope,
} from "@/lib/finance-management-sections";
import {
  managementAllowsManualSettlement,
  managementOutstandingAmountOf,
  managementStatusOf,
} from "@/lib/financial-management-model";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const dateLabel = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : "Sem data definida";
};

const patientLabel = (transaction: Transaction) =>
  transaction.patient_name || transaction.patients?.name || "Sem paciente vinculado";

const transactionState = (transaction: Transaction) => {
  const status = managementStatusOf(transaction);
  if (status === "paid" || transaction.status === "completed") return "Recebido";
  if (["cancelled", "canceled"].includes(status)) return "Encerrado";
  if (status === "overdue") return "Vencido";
  return "Em aberto";
};

const surfaceClass =
  "finance-panel border-border/55 bg-background/[0.76] dark:border-black/75 dark:bg-zinc-900/[0.58] dark:ring-black/50";

function EmptyState({ icon: Icon, title, detail }: {
  icon: typeof Handshake;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border/65 bg-muted/20 px-6 py-12 text-center dark:border-black/75 dark:bg-black/20">
      <Icon className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function Status({ transaction }: { transaction: Transaction }) {
  const label = transactionState(transaction);
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold",
        label === "Recebido"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : label === "Vencido"
            ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
            : label === "Encerrado"
              ? "bg-muted text-muted-foreground"
              : "bg-muted/70 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function ConventionAndTransfersView({
  transactions,
  onOpen,
  onSettle,
}: {
  transactions: Transaction[];
  onOpen: (transaction: Transaction) => void;
  onSettle: (transaction: Transaction) => void;
}) {
  const summary = buildConventionManagementSummary(transactions);

  return (
    <section aria-labelledby="convention-view-title" className="space-y-4">
      <DesktopWorkspacePanel className={cn(surfaceClass, "p-5 lg:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="convention-view-title" className="text-base font-bold">Movimentações de convênio</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Somente lançamentos com vínculo estruturado a convênio aparecem aqui. A baixa não inicia uma transferência bancária.
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-right">
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Recebido</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{money(summary.received)}</dd>
            </div>
            <div>
              <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Em aberto</dt>
              <dd className="mt-1 text-sm font-bold text-foreground">{money(summary.outstanding)}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-5">
          {summary.rows.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="Nenhum lançamento de convênio"
              detail="Quando uma cobrança manual usar a configuração financeira de convênio do paciente, ela aparecerá aqui."
            />
          ) : (
            <div className="overflow-x-auto rounded-[22px] border border-border/60 dark:border-black/75">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-border/55 bg-muted/35 text-left text-muted-foreground dark:border-black/70 dark:bg-black/20">
                  <tr>
                    <th className="p-3">Paciente</th>
                    <th className="p-3">Referência</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-right">Em aberto</th>
                    <th className="p-3"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/55 dark:divide-black/70">
                  {summary.rows.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-muted/25 dark:hover:bg-white/[0.025]">
                      <td className="p-3 font-medium">{patientLabel(transaction)}</td>
                      <td className="max-w-[280px] p-3 text-muted-foreground">
                        <span className="block truncate">{transaction.description}</span>
                        <span className="mt-0.5 block text-xs">{dateLabel(transaction.date.slice(0, 10))}</span>
                      </td>
                      <td className="p-3"><Status transaction={transaction} /></td>
                      <td className="p-3 text-right font-semibold">{money(Math.abs(Number(transaction.amount || 0)))}</td>
                      <td className="p-3 text-right text-muted-foreground">{money(managementOutstandingAmountOf(transaction))}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          {managementAllowsManualSettlement(transaction) ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => onSettle(transaction)}>
                              Registrar recebimento
                            </Button>
                          ) : null}
                          <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(transaction)}>
                            Ver lançamento
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DesktopWorkspacePanel>
    </section>
  );
}

function LegacyScopeSection({
  scope,
  rows,
  onOpen,
}: {
  scope: RecurrenceScope;
  rows: Transaction[];
  onOpen: (transaction: Transaction) => void;
}) {
  const isClinic = scope === "clinic";
  const Icon = isClinic ? Building2 : UserRound;
  const title = isClinic ? "Clínica e consultório" : "Pessoais e particulares";

  return (
    <DesktopWorkspacePanel className={cn(surfaceClass, "min-w-0 p-5 lg:p-6")}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/65 dark:bg-black/35">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">{rows.length} ocorrência(s) identificada(s)</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {rows.length === 0 ? (
          <EmptyState
            icon={isClinic ? Building2 : UserRound}
            title="Nenhuma recorrência neste grupo"
            detail={isClinic ? "Receitas e despesas recorrentes da clínica aparecerão aqui." : "Marque o escopo como pessoal em um lançamento recorrente para separá-lo da clínica."}
          />
        ) : (
          rows.map((transaction) => {
            const isIncome = transaction.type === "income";
            const TypeIcon = isIncome ? ArrowDownLeft : ArrowUpRight;
            return (
              <button
                key={transaction.id}
                type="button"
                onClick={() => onOpen(transaction)}
                className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-border/55 bg-background/45 p-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-black/70 dark:bg-black/20 dark:hover:bg-white/[0.035]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 dark:bg-black/40">
                  <TypeIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{transaction.description}</span>
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{recurrenceFrequencyLabelOf(transaction)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dateLabel(recurrenceReferenceDateOf(transaction))}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold">{money(Math.abs(Number(transaction.amount || 0)))}</span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">{isIncome ? "Entrada" : "Saída"}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </DesktopWorkspacePanel>
  );
}

const recurringFrequencyLabel: Record<RecurringFinancialEntryFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

const recurringStatusLabel: Record<RecurringFinancialEntry["status"], string> = {
  active: "Ativa",
  paused: "Pausada",
  finished: "Encerrada",
  cancelled: "Encerrada",
};

const recurringStatusClass: Record<RecurringFinancialEntry["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  paused: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  finished: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

function RecurringScopeSection({
  scope,
  entries,
  pendingId,
  onAction,
  onFinish,
}: {
  scope: RecurringFinancialEntryScope;
  entries: RecurringFinancialEntry[];
  pendingId: string | null;
  onAction: (entry: RecurringFinancialEntry, action: RecurringFinancialEntryAction) => void;
  onFinish: (entry: RecurringFinancialEntry) => void;
}) {
  const isClinic = scope === "clinic";
  const Icon = isClinic ? Building2 : UserRound;
  const title = isClinic ? "Clínica e consultório" : "Pessoais e particulares";

  return (
    <DesktopWorkspacePanel className={cn(surfaceClass, "min-w-0 p-5 lg:p-6")}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/65 dark:bg-black/35">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {entries.length} recorrência(s)
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {entries.length === 0 ? (
          <EmptyState
            icon={isClinic ? Building2 : UserRound}
            title="Nenhuma recorrência neste grupo"
            detail={
              isClinic
                ? "Cadastre entradas e saídas regulares da clínica ou do consultório."
                : "Use este espaço para compromissos financeiros particulares, separados da clínica."
            }
          />
        ) : (
          entries.map((entry) => {
            const isIncome = entry.type === "income";
            const TypeIcon = isIncome ? ArrowDownLeft : ArrowUpRight;
            const isPending = pendingId === entry.id;
            const canPause = entry.status === "active";
            const canResume = entry.status === "paused";
            const canFinish = entry.status === "active" || entry.status === "paused";

            return (
              <article
                key={entry.id}
                className="finance-inset rounded-[22px] border border-border/55 bg-background/50 p-4 dark:border-black/75 dark:bg-black/20"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/65 dark:bg-black/40">
                    <TypeIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-bold text-foreground">{entry.title}</h4>
                      <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", recurringStatusClass[entry.status])}>
                        {recurringStatusLabel[entry.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recurringFrequencyLabel[entry.frequency]} · desde {dateLabel(entry.start_date)}
                      {entry.end_date ? ` até ${dateLabel(entry.end_date)}` : " · sem data final"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-foreground">{money(Math.abs(Number(entry.amount || 0)))}</p>
                    <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                      {isIncome ? "Entrada" : "Saída"}
                    </p>
                  </div>
                </div>

                {(canPause || canResume || canFinish) && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/45 pt-3 dark:border-black/70">
                    {canPause && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 rounded-xl px-3"
                        disabled={isPending}
                        onClick={() => onAction(entry, "pause")}
                      >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Pause className="mr-2 h-4 w-4" />}
                        Pausar
                      </Button>
                    )}
                    {canResume && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 rounded-xl border-border/60 bg-background/65 px-3 dark:border-black/75 dark:bg-black/25"
                        disabled={isPending}
                        onClick={() => onAction(entry, "resume")}
                      >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Play className="mr-2 h-4 w-4" />}
                        Reativar
                      </Button>
                    )}
                    {canFinish && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 rounded-xl px-3 text-muted-foreground hover:text-foreground"
                        disabled={isPending}
                        onClick={() => onFinish(entry)}
                      >
                        <CircleStop className="mr-2 h-4 w-4" />
                        Encerrar
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </DesktopWorkspacePanel>
  );
}

function CreateRecurrenceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createRecurrence = useCreateRecurringFinancialEntry();
  const operationId = useRef(crypto.randomUUID());
  const [type, setType] = useState<FinancialEntryType>("income");
  const [scope, setScope] = useState<RecurringFinancialEntryScope>("clinic");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<RecurringFinancialEntryFrequency>("monthly");
  const [startDate, setStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");

  const reset = () => {
    setType("income");
    setScope("clinic");
    setTitle("");
    setAmount("");
    setFrequency("monthly");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    operationId.current = crypto.randomUUID();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (createRecurrence.isPending) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    const input = {
      type,
      scope,
      title,
      amount: parsedAmount,
      frequency,
      startDate: new Date(`${startDate}T12:00:00`),
      endDate: endDate ? new Date(`${endDate}T12:00:00`) : null,
      idempotencyKey: buildFinancialEntryIdempotencyKey(["management-recurrence", operationId.current]),
      metadata: { source: "financial_management_desktop" },
    };
    const validationMessage = validateRecurringFinancialEntryInput(input);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    try {
      await createRecurrence.mutateAsync(input);
      toast.success("Recorrência criada.");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível criar a recorrência. Revise os dados e tente novamente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="finance-modal-surface desktop-retina-modal desktop-retina-form max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[30px] border border-border/55 bg-background/96 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-[620px]">
        <DialogHeader className="border-b border-border/50 px-7 py-6 text-left dark:border-black/70">
          <DialogTitle className="text-xl">Nova recorrência</DialogTitle>
          <DialogDescription>
            Organize uma entrada ou saída periódica. Nenhuma cobrança bancária será criada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-7 py-6">
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Tipo</legend>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/35 p-1 dark:bg-black/25">
                {(["income", "expense"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={type === option}
                    onClick={() => setType(option)}
                    className={cn(
                      "min-h-11 rounded-xl px-4 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      type === option
                        ? "bg-background text-foreground shadow-sm dark:bg-zinc-800"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option === "income" ? "Entrada" : "Saída"}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="recurrence-title">Título</Label>
              <Input
                id="recurrence-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                placeholder={type === "income" ? "Ex.: mensalidade da clínica" : "Ex.: aluguel do consultório"}
                autoComplete="off"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recurrence-amount">Valor</Label>
                <Input
                  id="recurrence-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0,00"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence-frequency">Frequência</Label>
                <Select value={frequency} onValueChange={(value) => setFrequency(value as RecurringFinancialEntryFrequency)}>
                  <SelectTrigger id="recurrence-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recurrence-start">Início</Label>
                <Input id="recurrence-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence-end">Fim opcional</Label>
                <Input id="recurrence-end" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Organização</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["clinic", "personal"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={scope === option}
                    onClick={() => setScope(option)}
                    className={cn(
                      "min-h-12 rounded-2xl border px-4 text-sm font-semibold transition-[background-color,color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      scope === option
                        ? "border-foreground/20 bg-foreground text-background dark:border-white/15"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground dark:border-black/70 dark:bg-black/20",
                    )}
                  >
                    {option === "clinic" ? "Clínica" : "Pessoal"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <DialogFooter className="border-t border-border/50 px-7 py-5 dark:border-black/70">
            <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={createRecurrence.isPending} onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11 rounded-xl px-6" disabled={createRecurrence.isPending}>
              {createRecurrence.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar recorrência
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManagementRecurrenceView({
  transactions,
  onOpen,
}: {
  transactions: Transaction[];
  onOpen: (transaction: Transaction) => void;
}) {
  const recurrenceQuery = useRecurringFinancialEntries();
  const updateRecurrence = useUpdateRecurringFinancialEntryStatus();
  const [createOpen, setCreateOpen] = useState(false);
  const [finishTarget, setFinishTarget] = useState<RecurringFinancialEntry | null>(null);
  const entries = recurrenceQuery.data || [];
  const legacySummary = useMemo(() => buildRecurrenceManagementSummary(transactions), [transactions]);
  const clinicEntries = entries.filter((entry) => recurringFinancialEntryScopeOf(entry) === "clinic");
  const personalEntries = entries.filter((entry) => recurringFinancialEntryScopeOf(entry) === "personal");
  const pendingId = updateRecurrence.isPending ? updateRecurrence.variables?.id || null : null;

  const applyAction = async (entry: RecurringFinancialEntry, action: RecurringFinancialEntryAction) => {
    try {
      await updateRecurrence.mutateAsync({ id: entry.id, action });
      toast.success(
        action === "pause"
          ? "Recorrência pausada."
          : action === "resume"
            ? "Recorrência reativada."
            : "Recorrência encerrada. O histórico foi preservado.",
      );
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a recorrência.");
      return false;
    }
  };

  const finishRecurrence = async () => {
    if (!finishTarget) return;
    const updated = await applyAction(finishTarget, "finish");
    if (updated) setFinishTarget(null);
  };

  return (
    <section aria-label="Recorrências financeiras" className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" className="min-h-11 rounded-2xl px-5" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova recorrência
        </Button>
      </div>

      {recurrenceQuery.isLoading ? (
        <DesktopWorkspacePanel className={cn(surfaceClass, "p-5 lg:p-6")}>
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Carregando recorrências…
          </div>
        </DesktopWorkspacePanel>
      ) : recurrenceQuery.isError ? (
        <DesktopWorkspacePanel className={cn(surfaceClass, "p-5 lg:p-6")}>
          <div className="rounded-[22px] border border-dashed border-border/65 px-6 py-10 text-center dark:border-black/75">
            <p className="text-sm font-semibold">Não foi possível carregar as recorrências.</p>
            <p className="mt-2 text-xs text-muted-foreground">Nenhum dado foi alterado.</p>
            <Button type="button" variant="outline" className="mt-5 min-h-11 rounded-xl" onClick={() => recurrenceQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        </DesktopWorkspacePanel>
      ) : entries.length > 0 ? (
        <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
          <RecurringScopeSection scope="clinic" entries={clinicEntries} pendingId={pendingId} onAction={(entry, action) => void applyAction(entry, action)} onFinish={setFinishTarget} />
          <RecurringScopeSection scope="personal" entries={personalEntries} pendingId={pendingId} onAction={(entry, action) => void applyAction(entry, action)} onFinish={setFinishTarget} />
        </div>
      ) : legacySummary.rows.length > 0 ? (
        <div className="space-y-4">
          <DesktopWorkspacePanel className={cn(surfaceClass, "p-5 lg:p-6")}>
            <h3 className="text-sm font-bold">Registros anteriores</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Estes itens permanecem disponíveis para consulta. Novos controles usam o cadastro de recorrência acima.
            </p>
          </DesktopWorkspacePanel>
          <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
            <LegacyScopeSection scope="clinic" rows={legacySummary.clinicRows} onOpen={onOpen} />
            <LegacyScopeSection scope="personal" rows={legacySummary.personalRows} onOpen={onOpen} />
          </div>
        </div>
      ) : (
        <DesktopWorkspacePanel className={cn(surfaceClass, "p-5 lg:p-6")}>
          <EmptyState
            icon={CalendarClock}
            title="Nenhuma recorrência cadastrada"
            detail="Crie uma entrada ou saída semanal, mensal ou anual para acompanhar compromissos repetidos."
          />
        </DesktopWorkspacePanel>
      )}

      <CreateRecurrenceDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={Boolean(finishTarget)} onOpenChange={(open) => { if (!open && !updateRecurrence.isPending) setFinishTarget(null); }}>
        <AlertDialogContent className="finance-modal-surface desktop-retina-modal rounded-[28px] border border-border/60 bg-background/96 shadow-2xl backdrop-blur-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar esta recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              Novos lançamentos deixarão de ser previstos. O histórico existente será mantido e esta ação não excluirá registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateRecurrence.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={updateRecurrence.isPending}
              onClick={(event) => {
                event.preventDefault();
                void finishRecurrence();
              }}
            >
              {updateRecurrence.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <CircleStop className="mr-2 h-4 w-4" />}
              Encerrar recorrência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
