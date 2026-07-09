"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Receipt,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  type FinancialPaymentCalendarItem,
  type FinancialPaymentSource,
  useManagementPaymentsCalendar,
} from "@/hooks/use-management-payments-calendar";
import {
  type ReceivableCalendarItem,
  type ReceivableSource,
  type ReceivableStatus,
  updateReceivableDateSelection,
  useReceivablesCalendar,
} from "@/hooks/use-receivables-calendar";
import { useUpdateFinancialEntry } from "@/hooks/use-financial-entries";

type CalendarMode = "receivables" | "payments";

interface ReceivablesCalendarCardProps {
  onOpenFutureStatement: () => void;
  onOpenScheduledPayments: () => void;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const SOURCE_LABELS: Record<ReceivableSource, string> = {
  neurofinance: "NeuroFinance",
  agenda: "Agenda",
  manual: "Gestão Financeira",
};

const SOURCE_STYLES: Record<ReceivableSource, string> = {
  neurofinance: "border-emerald-500/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200",
  agenda: "border-cyan-500/25 bg-cyan-50 text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-200",
  manual: "border-violet-500/25 bg-violet-50 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200",
};

const SOURCE_DOTS: Record<ReceivableSource, string> = {
  neurofinance: "bg-emerald-500",
  agenda: "bg-cyan-400",
  manual: "bg-violet-500",
};

const SOURCE_CELL_ACCENTS: Record<ReceivableSource, string> = {
  neurofinance: "border-l-emerald-500/70",
  agenda: "border-l-cyan-400/70",
  manual: "border-l-violet-500/70",
};

const PAYMENT_SOURCE_LABELS: Record<FinancialPaymentSource, string> = {
  management: "Gestao Financeira",
  neurofinance: "NeuroFinance",
};

const PAYMENT_SOURCE_STYLES: Record<FinancialPaymentSource, string> = {
  management: "border-rose-500/25 bg-rose-50 text-rose-800 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-200",
  neurofinance: "border-blue-500/25 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200",
};

const PAYMENT_SOURCE_DOTS: Record<FinancialPaymentSource, string> = {
  management: "bg-rose-500",
  neurofinance: "bg-blue-500",
};

const PAYMENT_SOURCE_CELL_ACCENTS: Record<FinancialPaymentSource, string> = {
  management: "border-l-rose-500/70",
  neurofinance: "border-l-blue-500/70",
};

const STATUS_LABELS: Record<ReceivableStatus, string> = {
  planned: "Planejado",
  pending: "Pendente",
  processing: "Processando",
  confirmed: "Confirmado",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<ReceivableStatus, string> = {
  planned: "border-sky-500/25 bg-sky-50 text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200",
  pending: "border-amber-500/30 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200",
  processing: "border-blue-500/25 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200",
  confirmed: "border-blue-500/25 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200",
  paid: "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200",
  overdue: "border-red-500/30 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200",
  cancelled: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300",
};

const STATUS_DOTS: Record<ReceivableStatus, string> = {
  planned: "bg-sky-400",
  pending: "bg-amber-400",
  processing: "bg-blue-500",
  confirmed: "bg-blue-500",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  cancelled: "bg-zinc-400",
};

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function selectionBounds(selectedDates: Date[]) {
  if (selectedDates.length === 0) return null;
  const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
  return {
    start: format(sorted[0], "yyyy-MM-dd"),
    end: format(sorted[sorted.length - 1], "yyyy-MM-dd"),
  };
}

export function FinancialCalendarCard({
  onOpenFutureStatement,
  onOpenScheduledPayments,
}: ReceivablesCalendarCardProps) {
  const [mode, setMode] = useState<CalendarMode>("receivables");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const queryClient = useQueryClient();
  const updateEntry = useUpdateFinancialEntry();

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const { data: items = [], isLoading } = useReceivablesCalendar(gridStart, gridEnd);

  const itemsByDate = useMemo(() => {
    return items.reduce<Record<string, ReceivableCalendarItem[]>>((result, item) => {
      (result[item.date] ||= []).push(item);
      return result;
    }, {});
  }, [items]);

  const selectedBounds = selectionBounds(selectedDates);
  const filteredItems = useMemo(() => {
    if (!selectedBounds) return [];
    return items.filter((item) => item.date >= selectedBounds.start && item.date <= selectedBounds.end);
  }, [items, selectedBounds]);

  const selectedTotal = filteredItems.reduce((total, item) => total + item.amount, 0);

  const handleDayClick = (day: Date) => {
    setSelectedDates((current) => updateReceivableDateSelection(current, day));
  };

  const navigateMonth = (direction: "previous" | "next") => {
    setVisibleMonth((current) => direction === "previous" ? subMonths(current, 1) : addMonths(current, 1));
    setSelectedDates([]);
  };

  const updateStatus = async (item: ReceivableCalendarItem, status: ReceivableStatus) => {
    if (!item.editable || !item.financialEntryId) return;

    try {
      await updateEntry.mutateAsync({
        id: item.financialEntryId,
        status: status as "planned" | "pending" | "paid" | "overdue" | "cancelled",
        paidAt: status === "paid" ? new Date() : null,
        cancelledAt: status === "cancelled" ? new Date() : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["financialEntries"] });
      toast.success("Status do recebimento atualizado.");
    } catch (error) {
      console.error("Falha ao atualizar status do recebimento:", error);
      toast.error("Não foi possível atualizar o status.");
    }
  };

  const selectedPeriodLabel = selectedBounds
    ? selectedBounds.start === selectedBounds.end
      ? format(parseISO(selectedBounds.start), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : `${format(parseISO(selectedBounds.start), "dd/MM/yyyy")} a ${format(parseISO(selectedBounds.end), "dd/MM/yyyy")}`
    : "";

  return (
    <section className="relative overflow-hidden rounded-[40px] border border-zinc-200/60 bg-white/70 p-5 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.55)] backdrop-blur-2xl dark:border-white/[0.06] dark:bg-white/[0.018] md:p-8">
      <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.018] dark:opacity-[0.04]" />
      <div className="relative z-10">
        <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.38em] text-zinc-400">Planejamento financeiro</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950 dark:text-white">
              Calendário Financeiro
            </h2>
          </div>

          <div className="flex w-full rounded-full border border-zinc-200 bg-zinc-100/80 p-1 dark:border-white/[0.06] dark:bg-black/30 xl:w-auto">
            {([
              { id: "receivables", label: "Calendário de Recebimentos" },
              { id: "payments", label: "Calendário de Pagamentos" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={cn(
                  "flex-1 rounded-full px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all xl:flex-none",
                  mode === tab.id
                    ? "bg-zinc-950 text-white shadow-lg dark:bg-white dark:text-black"
                    : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "payments" ? (
          <PaymentsCalendarPanel
            visibleMonth={visibleMonth}
            selectedDates={selectedDates}
            selectedBounds={selectedBounds}
            calendarDays={calendarDays}
            gridStart={gridStart}
            gridEnd={gridEnd}
            onDayClick={handleDayClick}
            onNavigateMonth={navigateMonth}
            onOpenScheduledPayments={onOpenScheduledPayments}
          />
        ) : (
          <>
            <div className="rounded-[32px] border border-zinc-200/70 bg-white p-4 dark:border-white/[0.06] dark:bg-black/20 md:p-6">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateMonth("previous")}
                    className="rounded-full border border-zinc-200 dark:border-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-44 text-center">
                    <p className="text-lg font-black capitalize tracking-tight text-zinc-950 dark:text-white">
                      {format(visibleMonth, "MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateMonth("next")}
                    className="rounded-full border border-zinc-200 dark:border-white/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-500" /> NeuroFinance</span>
                    <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-cyan-400" /> Agenda</span>
                    <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-500" /> Gestão Financeira</span>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-zinc-100 pb-3 dark:border-white/5">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
                    {weekday}
                  </div>
                ))}
              </div>

              {isLoading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-zinc-300" />
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-7 gap-1.5 md:gap-2">
                  {calendarDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayItems = itemsByDate[dateKey] || [];
                    const selected = selectedDates.some((selectedDate) => isSameDay(selectedDate, day));
                    const inSelectedRange = selectedBounds &&
                      dateKey >= selectedBounds.start &&
                      dateKey <= selectedBounds.end;
                    const dayTotal = dayItems.reduce((total, item) => total + item.amount, 0);
                    const daySources = Array.from(new Set(dayItems.map((item) => item.source)));
                    const hasPending = dayItems.some((item) => item.status !== "paid");

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "group/day relative min-h-24 rounded-[18px] border p-2 text-left transition-all md:min-h-28 md:p-3",
                          isSameMonth(day, visibleMonth)
                            ? "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md dark:border-white/[0.055] dark:bg-white/[0.02]"
                            : "border-transparent bg-zinc-50/50 text-zinc-300 dark:bg-white/[0.008] dark:text-zinc-700",
                          inSelectedRange && "border-zinc-400 bg-zinc-100/80 dark:border-white/20 dark:bg-white/[0.06]",
                          selected && "bg-zinc-950 text-white ring-2 ring-zinc-950 ring-offset-2 dark:bg-white dark:text-black dark:ring-white dark:ring-offset-zinc-950",
                        )}
                      >
                        <span className={cn(
                          "text-xs font-black",
                          !selected && isSameDay(day, new Date()) && "text-blue-600 dark:text-blue-400",
                        )}>
                          {format(day, "d")}
                        </span>

                        {dayItems.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <p className={cn(
                              "truncate text-[8px] font-black text-zinc-700 dark:text-zinc-200",
                              selected && "text-white dark:text-black",
                            )}>
                              {currency(dayTotal)}
                            </p>
                            <p className={cn(
                              "text-[7px] font-black uppercase tracking-wider text-zinc-400",
                              selected && "text-zinc-300 dark:text-zinc-600",
                            )}>
                              {hasPending ? "previsto" : "recebido"}
                            </p>
                            <div className="flex items-center gap-1.5 pt-1">
                              {daySources.map((source) => (
                                <i
                                  key={source}
                                  className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-950", SOURCE_DOTS[source])}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedBounds && (
              <div className="relative mt-6 overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_20px_54px_-42px_rgba(24,24,27,0.35)] dark:border-white/[0.08] dark:bg-zinc-950 dark:shadow-[0_24px_70px_-45px_rgba(0,0,0,0.85)]">
                <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.014] dark:opacity-[0.032]" />
                <div className="relative z-10 flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50 p-5 dark:border-white/[0.08] dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">Recebimentos no período</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-3">
                      <h3 className="text-base font-black text-zinc-950 dark:text-white">{selectedPeriodLabel}</h3>
                      <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-black text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100">
                        Total: {currency(selectedTotal)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenFutureStatement}
                    className="rounded-full border-zinc-200 bg-white px-5 text-[9px] font-black uppercase tracking-widest text-zinc-950 dark:border-white/10 dark:bg-white dark:text-zinc-950"
                  >
                    Extrato <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                    <Receipt className="h-7 w-7 text-zinc-300" />
                    <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500">Nenhum recebimento neste período</p>
                  </div>
                ) : (
                  <Table className="relative z-10 bg-white dark:bg-zinc-950">
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900/80">
                      <TableRow className="border-zinc-200 hover:bg-transparent dark:border-white/[0.08] dark:hover:bg-transparent">
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Origem</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Paciente</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Cobrança</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Status</TableHead>
                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Data</TableHead>
                        <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-white dark:bg-zinc-950">
                      {filteredItems.map((item) => (
                        <TableRow key={item.id} className="group/receivable border-zinc-100 bg-white transition-colors hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-zinc-950 dark:hover:bg-zinc-900">
                          <TableCell className={cn("border-l-2 py-4", SOURCE_CELL_ACCENTS[item.source])}>
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-widest shadow-sm",
                              SOURCE_STYLES[item.source],
                            )}>
                              <i className={cn("mr-1.5 h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-900", SOURCE_DOTS[item.source])} />
                              {SOURCE_LABELS[item.source]}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                            {item.patientName || "Não informado"}
                          </TableCell>
                          <TableCell>
                            <p className="max-w-56 truncate text-xs font-black text-zinc-950 dark:text-white">{item.description}</p>
                            <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                              {item.paymentMethod || "Método não informado"}
                            </p>
                          </TableCell>
                          <TableCell>
                            {item.editable ? (
                              <Select
                                value={item.status}
                                onValueChange={(status) => updateStatus(item, status as ReceivableStatus)}
                                disabled={updateEntry.isPending}
                              >
                                <SelectTrigger className={cn(
                                  "h-9 w-36 rounded-full border px-3 text-[9px] font-black uppercase tracking-wider shadow-sm",
                                  STATUS_STYLES[item.status],
                                )}>
                                  <span className="flex min-w-0 items-center gap-2">
                                    <i className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOTS[item.status])} />
                                    <SelectValue />
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planned">Planejado</SelectItem>
                                  <SelectItem value="pending">Pendente</SelectItem>
                                  <SelectItem value="paid">Pago</SelectItem>
                                  <SelectItem value="overdue">Vencido</SelectItem>
                                  <SelectItem value="cancelled">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest shadow-sm",
                                STATUS_STYLES[item.status],
                              )}>
                                <i className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[item.status])} />
                                {STATUS_LABELS[item.status]}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-zinc-500 dark:text-zinc-300">
                            {format(parseISO(item.date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right text-sm font-black tabular-nums text-zinc-950 dark:text-white">
                            {currency(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            {!selectedBounds && (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-zinc-200 px-5 py-4 text-center dark:border-white/10">
                <Sparkles className="h-4 w-4 text-zinc-400" />
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  Selecione um dia ou duas datas para consultar um intervalo
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

interface PaymentsCalendarPanelProps {
  visibleMonth: Date;
  selectedDates: Date[];
  selectedBounds: ReturnType<typeof selectionBounds>;
  calendarDays: Date[];
  gridStart: Date;
  gridEnd: Date;
  onDayClick: (day: Date) => void;
  onNavigateMonth: (direction: "previous" | "next") => void;
  onOpenScheduledPayments: () => void;
}

function PaymentsCalendarPanel({
  visibleMonth,
  selectedDates,
  selectedBounds,
  calendarDays,
  gridStart,
  gridEnd,
  onDayClick,
  onNavigateMonth,
  onOpenScheduledPayments,
}: PaymentsCalendarPanelProps) {
  const updateEntry = useUpdateFinancialEntry();
  const { data: items = [], isLoading } = useManagementPaymentsCalendar(gridStart, gridEnd, true);

  const itemsByDate = useMemo(() => {
    return items.reduce<Record<string, FinancialPaymentCalendarItem[]>>((result, item) => {
      (result[item.date] ||= []).push(item);
      return result;
    }, {});
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!selectedBounds) return [];
    return items.filter((item) => item.date >= selectedBounds.start && item.date <= selectedBounds.end);
  }, [items, selectedBounds]);

  const selectedTotal = filteredItems.reduce((total, item) => total + item.amount, 0);
  const selectedPeriodLabel = selectedBounds
    ? selectedBounds.start === selectedBounds.end
      ? format(parseISO(selectedBounds.start), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : `${format(parseISO(selectedBounds.start), "dd/MM/yyyy")} a ${format(parseISO(selectedBounds.end), "dd/MM/yyyy")}`
    : "";

  const updateStatus = async (item: FinancialPaymentCalendarItem, status: "planned" | "pending" | "paid" | "overdue" | "cancelled") => {
    if (!item.editable || !item.financialEntryId) return;

    try {
      await updateEntry.mutateAsync({
        id: item.financialEntryId,
        status,
        paidAt: status === "paid" ? new Date() : null,
        cancelledAt: status === "cancelled" ? new Date() : null,
      });
      toast.success("Status do pagamento atualizado.");
    } catch (error) {
      console.error("Falha ao atualizar status do pagamento:", error);
      toast.error("Não foi possível atualizar o status.");
    }
  };

  return (
    <>
      <div className="rounded-[32px] border border-zinc-200/70 bg-white p-4 dark:border-white/[0.06] dark:bg-black/20 md:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onNavigateMonth("previous")}
              className="rounded-full border border-zinc-200 dark:border-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-44 text-center">
              <p className="text-lg font-black capitalize tracking-tight text-zinc-950 dark:text-white">
                {format(visibleMonth, "MMMM yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onNavigateMonth("next")}
              className="rounded-full border border-zinc-200 dark:border-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-500" /> Despesas gerenciais</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-blue-500" /> Pagamentos bancarios</span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-zinc-100 pb-3 dark:border-white/5">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
              {weekday}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-300" />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-7 gap-1.5 md:gap-2">
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDate[dateKey] || [];
              const selected = selectedDates.some((selectedDate) => isSameDay(selectedDate, day));
              const inSelectedRange = selectedBounds &&
                dateKey >= selectedBounds.start &&
                dateKey <= selectedBounds.end;
              const dayTotal = dayItems.reduce((total, item) => total + item.amount, 0);
              const daySources = Array.from(new Set(dayItems.map((item) => item.source)));
              const hasPending = dayItems.some((item) => !["paid", "cancelled"].includes(item.status));

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "group/day relative min-h-24 rounded-[18px] border p-2 text-left transition-all md:min-h-28 md:p-3",
                    isSameMonth(day, visibleMonth)
                      ? "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md dark:border-white/[0.055] dark:bg-white/[0.02]"
                      : "border-transparent bg-zinc-50/50 text-zinc-300 dark:bg-white/[0.008] dark:text-zinc-700",
                    inSelectedRange && "border-zinc-400 bg-zinc-100/80 dark:border-white/20 dark:bg-white/[0.06]",
                    selected && "bg-zinc-950 text-white ring-2 ring-zinc-950 ring-offset-2 dark:bg-white dark:text-black dark:ring-white dark:ring-offset-zinc-950",
                  )}
                >
                  <span className={cn(
                    "text-xs font-black",
                    !selected && isSameDay(day, new Date()) && "text-blue-600 dark:text-blue-400",
                  )}>
                    {format(day, "d")}
                  </span>

                  {dayItems.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className={cn(
                        "truncate text-[8px] font-black text-zinc-700 dark:text-zinc-200",
                        selected && "text-white dark:text-black",
                      )}>
                        {currency(dayTotal)}
                      </p>
                      <p className={cn(
                        "text-[7px] font-black uppercase tracking-wider text-zinc-400",
                        selected && "text-zinc-300 dark:text-zinc-600",
                      )}>
                        {hasPending ? "previsto" : "pago"}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        {daySources.map((source) => (
                          <i
                            key={source}
                            className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-950", PAYMENT_SOURCE_DOTS[source])}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedBounds && (
        <div className="relative mt-6 overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_20px_54px_-42px_rgba(24,24,27,0.35)] dark:border-white/[0.08] dark:bg-zinc-950 dark:shadow-[0_24px_70px_-45px_rgba(0,0,0,0.85)]">
          <div className="relative z-10 flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50 p-5 dark:border-white/[0.08] dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">Pagamentos no periodo</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <h3 className="text-base font-black text-zinc-950 dark:text-white">{selectedPeriodLabel}</h3>
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-black text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100">
                  Total: {currency(selectedTotal)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenScheduledPayments}
              className="rounded-full border-zinc-200 bg-white px-5 text-[9px] font-black uppercase tracking-widest text-zinc-950 dark:border-white/10 dark:bg-white dark:text-zinc-950"
            >
              Pagamentos agendados <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
              <Receipt className="h-7 w-7 text-zinc-300" />
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500">Nenhum pagamento neste periodo</p>
            </div>
          ) : (
            <Table className="relative z-10 bg-white dark:bg-zinc-950">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/80">
                <TableRow className="border-zinc-200 hover:bg-transparent dark:border-white/[0.08] dark:hover:bg-transparent">
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Origem</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Beneficiario</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Pagamento</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Status</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Data</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-zinc-950">
                {filteredItems.map((item) => {
                  const status = item.status in STATUS_STYLES ? item.status : "processing";
                  return (
                    <TableRow key={item.id} className="group/payment border-zinc-100 bg-white transition-colors hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-zinc-950 dark:hover:bg-zinc-900">
                      <TableCell className={cn("border-l-2 py-4", PAYMENT_SOURCE_CELL_ACCENTS[item.source])}>
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1.5 text-[8px] font-black uppercase tracking-widest shadow-sm",
                          PAYMENT_SOURCE_STYLES[item.source],
                        )}>
                          <i className={cn("mr-1.5 h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-900", PAYMENT_SOURCE_DOTS[item.source])} />
                          {PAYMENT_SOURCE_LABELS[item.source]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                        {item.beneficiaryName || "Não informado"}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-56 truncate text-xs font-black text-zinc-950 dark:text-white">{item.description}</p>
                        <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-zinc-400">
                          {item.paymentMethod || "Método não informado"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {item.editable ? (
                          <Select
                            value={status}
                            onValueChange={(nextStatus) => updateStatus(item, nextStatus as "planned" | "pending" | "paid" | "overdue" | "cancelled")}
                            disabled={updateEntry.isPending}
                          >
                            <SelectTrigger className={cn(
                              "h-9 w-36 rounded-full border px-3 text-[9px] font-black uppercase tracking-wider shadow-sm",
                              STATUS_STYLES[status],
                            )}>
                              <span className="flex min-w-0 items-center gap-2">
                                <i className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOTS[status])} />
                                <SelectValue />
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planned">Planejado</SelectItem>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="overdue">Vencido</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest shadow-sm",
                            STATUS_STYLES[status],
                          )}>
                            <i className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status])} />
                            {STATUS_LABELS[status]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-500 dark:text-zinc-300">
                        {format(parseISO(item.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right text-sm font-black tabular-nums text-zinc-950 dark:text-white">
                        {currency(item.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {!selectedBounds && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-[22px] border border-dashed border-zinc-200 px-5 py-4 text-center dark:border-white/10">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
            Selecione um dia ou duas datas para consultar um intervalo
          </p>
        </div>
      )}
    </>
  );
}

export function ReceivablesCalendarCard(props: ReceivablesCalendarCardProps) {
  return <FinancialCalendarCard {...props} />;
}
