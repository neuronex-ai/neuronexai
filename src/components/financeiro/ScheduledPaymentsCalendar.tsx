"use client";

import { useMemo, useState } from "react";
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Receipt,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { BillPaymentDetailsDialog } from "@/components/financeiro/pagamentos/ScheduledBillPayments";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  type BillPaymentCalendarItem,
  useBillPaymentsCalendar,
} from "@/hooks/use-bill-payments-calendar";
import {
  type BillPaymentRecord,
  downloadBillReceipt,
} from "@/hooks/use-neurofinance-bill-payments";
import { updateReceivableDateSelection } from "@/hooks/use-receivables-calendar";
import { cn } from "@/lib/utils";

interface ScheduledPaymentsCalendarProps {
  onOpenAllPayments: () => void;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_COPY: Record<string, {
  label: string;
  dot: string;
  style: string;
}> = {
  scheduled: {
    label: "Agendado",
    dot: "bg-blue-500",
    style: "border-blue-500/25 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200",
  },
  processing: {
    label: "Processando",
    dot: "bg-amber-500",
    style: "border-amber-500/25 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200",
  },
  paid: {
    label: "Pago",
    dot: "bg-emerald-500",
    style: "border-emerald-500/25 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  failed: {
    label: "Falhou",
    dot: "bg-red-500",
    style: "border-red-500/25 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200",
  },
  cancelled: {
    label: "Cancelado",
    dot: "bg-zinc-400",
    style: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300",
  },
  refunded: {
    label: "Estornado",
    dot: "bg-violet-500",
    style: "border-violet-500/25 bg-violet-50 text-violet-800 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-200",
  },
};

const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function selectionBounds(selectedDates: Date[]) {
  if (selectedDates.length === 0) return null;
  const sorted = [...selectedDates].sort((left, right) => left.getTime() - right.getTime());
  return {
    start: format(sorted[0], "yyyy-MM-dd"),
    end: format(sorted[sorted.length - 1], "yyyy-MM-dd"),
  };
}

function statusCopy(status: string) {
  return STATUS_COPY[status] || STATUS_COPY.processing;
}

export function ScheduledPaymentsCalendar({ onOpenAllPayments }: ScheduledPaymentsCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<BillPaymentRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const { data: items = [], isLoading } = useBillPaymentsCalendar(gridStart, gridEnd);

  const itemsByDate = useMemo(() => items.reduce<Record<string, BillPaymentCalendarItem[]>>((result, item) => {
    (result[item.date] ||= []).push(item);
    return result;
  }, {}), [items]);

  const selectedBounds = selectionBounds(selectedDates);
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

  const navigateMonth = (direction: "previous" | "next") => {
    setVisibleMonth((current) => direction === "previous" ? subMonths(current, 1) : addMonths(current, 1));
    setSelectedDates([]);
  };

  const handleDownload = async (record: BillPaymentRecord) => {
    setDownloadingId(record.id);
    try {
      await downloadBillReceipt(record);
      toast.success("Comprovante baixado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o comprovante.");
    } finally {
      setDownloadingId(null);
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
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-blue-500" /> Agendado</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-500" /> Processando</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Pago</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-red-500" /> Falhou</span>
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
              const dayStatuses = Array.from(new Set<string>(dayItems.map((item) => item.status)));

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDates((current) => updateReceivableDateSelection(current, day))}
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
                        {dayItems.length === 1 ? "1 pagamento" : `${dayItems.length} pagamentos`}
                      </p>
                      <div className="flex items-center gap-1.5 pt-1">
                        {dayStatuses.map((status) => (
                          <i
                            key={status}
                            className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-white dark:ring-zinc-950", statusCopy(status).dot)}
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
        <div className="relative mt-6 overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-[0_20px_54px_-42px_rgba(24,24,27,0.35)] dark:border-white/[0.08] dark:bg-zinc-950">
          <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.014] dark:opacity-[0.032]" />
          <div className="relative z-10 flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50 p-5 dark:border-white/[0.08] dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">Pagamentos no período</p>
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
              onClick={onOpenAllPayments}
              className="rounded-full border-zinc-200 bg-white px-5 text-[9px] font-black uppercase tracking-widest text-zinc-950 dark:border-white/10 dark:bg-white dark:text-zinc-950"
            >
              Ver todos <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
              <Receipt className="h-7 w-7 text-zinc-300" />
              <p className="mt-3 text-xs font-black uppercase tracking-widest text-zinc-500">Nenhum pagamento neste período</p>
            </div>
          ) : (
            <Table className="relative z-10 bg-white dark:bg-zinc-950">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/80">
                <TableRow className="border-zinc-200 hover:bg-transparent dark:border-white/[0.08] dark:hover:bg-transparent">
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Beneficiário</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Instituição</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Status</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Programado</TableHead>
                  <TableHead className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Vencimento</TableHead>
                  <TableHead className="text-center text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Comprovante</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white dark:bg-zinc-950">
                {filteredItems.map((item) => {
                  const status = statusCopy(item.status);
                  return (
                    <TableRow
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRecord(item.record)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setSelectedRecord(item.record);
                      }}
                      className="cursor-pointer border-zinc-100 bg-white transition-colors hover:bg-zinc-50 dark:border-white/[0.07] dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    >
                      <TableCell className="border-l-2 border-l-blue-500/70 py-4">
                        <p className="max-w-48 truncate text-xs font-black text-zinc-950 dark:text-white">
                          {item.beneficiaryName || "Beneficiário não informado"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        {item.bankName || "Não informada"}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest shadow-sm",
                          status.style,
                        )}>
                          <i className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-500 dark:text-zinc-300">
                        {format(parseISO(item.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-500 dark:text-zinc-300">
                        {item.dueDate ? format(parseISO(item.dueDate), "dd/MM/yyyy") : "Não informado"}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.hasReceipt
                          ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                          : <Clock3 className="mx-auto h-4 w-4 text-zinc-300" />}
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
            Selecione um dia ou duas datas para consultar os pagamentos
          </p>
        </div>
      )}

      <BillPaymentDetailsDialog
        record={selectedRecord}
        downloading={downloadingId === selectedRecord?.id}
        onDownload={handleDownload}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      />
    </>
  );
}
