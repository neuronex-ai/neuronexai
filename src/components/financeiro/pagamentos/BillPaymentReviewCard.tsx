import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Landmark,
  LockKeyhole,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  BillConsultation,
  BillPaymentMode,
} from "@/hooks/use-neurofinance-bill-payments";
import { useNeuroFinanceTariffs } from "@/hooks/use-neurofinance-tariffs";
import { cn, formatCurrency } from "@/lib/utils";

interface BillPaymentReviewCardProps {
  consultation: BillConsultation;
  onBack: () => void;
  onConfirm: (decision: {
    paymentMode: BillPaymentMode;
    scheduleDate?: string | null;
  }) => void;
}

function maskDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  if (digits.length === 14) return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-${digits.slice(-2)}`;
  return value || "Não informado";
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function BillPaymentReviewCard({
  consultation,
  onBack,
  onConfirm,
}: BillPaymentReviewCardProps) {
  const { data: tariffs } = useNeuroFinanceTariffs();
  const tariff = tariffs?.find((item) => item.code === "bill_payment");
  const requiredBalance = Number.isFinite(consultation.requiredBalance)
    ? consultation.requiredBalance
    : consultation.value + consultation.fee;
  const canPayNow = consultation.canPayNow ??
    (consultation.availableBalance != null && consultation.availableBalance >= requiredBalance);
  const canSchedule = consultation.canSchedule ??
    Boolean(consultation.dueDate && consultation.dueDate > todayIso());
  const defaultScheduleDate = consultation.defaultScheduleDate || consultation.dueDate || "";
  const initialMode = consultation.recommendedMode || (canPayNow ? "now" : canSchedule ? "scheduled" : "now");
  const [paymentMode, setPaymentMode] = useState<BillPaymentMode>(initialMode);
  const [scheduleDate, setScheduleDate] = useState(defaultScheduleDate);

  useEffect(() => {
    setPaymentMode(consultation.recommendedMode || (canPayNow ? "now" : canSchedule ? "scheduled" : "now"));
    setScheduleDate(defaultScheduleDate);
  }, [canPayNow, canSchedule, consultation.recommendedMode, defaultScheduleDate]);

  const minimumFutureScheduleDate = useMemo(() => {
    const tomorrow = tomorrowIso();
    return consultation.minimumScheduleDate && consultation.minimumScheduleDate > tomorrow
      ? consultation.minimumScheduleDate
      : tomorrow;
  }, [consultation.minimumScheduleDate]);

  const canContinue = paymentMode === "now"
    ? canPayNow
    : canSchedule && Boolean(scheduleDate);

  const rows = [
    {
      icon: UserRound,
      label: "Recebedor",
      value: consultation.beneficiaryName || "Não informado pela instituição",
      detail: maskDocument(consultation.beneficiaryDocument),
    },
    {
      icon: Landmark,
      label: "Instituição",
      value: consultation.bankName || (consultation.bankCode
        ? `Instituição ${consultation.bankCode}`
        : "Não informada pela instituição"),
      detail: consultation.bankCode
        ? `Código bancário ${consultation.bankCode}`
        : "Dado não retornado na consulta",
    },
    {
      icon: CalendarDays,
      label: "Vencimento",
      value: consultation.dueDate
        ? formatDate(consultation.dueDate)
        : "Não informado pela instituição",
      detail: consultation.minimumScheduleDate
        ? `Primeira data operacional: ${formatDate(consultation.minimumScheduleDate)}`
        : "Data validada pela instituição",
    },
  ];

  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[34px] border border-border/65 bg-card/82 text-card-foreground shadow-[0_36px_110px_-72px_hsl(var(--foreground)/0.62)] backdrop-blur-3xl">
      <div className="border-b border-border/55 p-6 md:p-8">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400">
                Boleto localizado
              </p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">
                Confira e escolha quando pagar
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Confira os dados abaixo. Depois do PIN, recebedor, valor e data não poderão ser alterados.
              </p>
            </div>
          </div>
          <ReceiptText className="hidden h-6 w-6 text-muted-foreground/45 md:block" />
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="rounded-[26px] bg-foreground p-6 text-background shadow-[0_28px_70px_-44px_hsl(var(--foreground)/0.72)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-background/55">Valor total</p>
          <p className="mt-3 text-5xl font-black tracking-[-0.05em]">{formatCurrency(consultation.value)}</p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-4 rounded-[22px] border border-border/60 bg-background/50 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-foreground/[0.06] text-foreground">
                <row.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">{row.label}</p>
                <p className="mt-1 truncate text-sm font-black text-foreground">{row.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{row.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-3 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
            Quando deseja pagar?
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              disabled={!canPayNow}
              onClick={() => setPaymentMode("now")}
              aria-pressed={paymentMode === "now"}
              className={cn(
                "rounded-[22px] border p-5 text-left transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100",
                paymentMode === "now"
                  ? "border-foreground bg-foreground text-background shadow-lg"
                  : "border-border/65 bg-background/50 text-foreground hover:bg-muted/65",
              )}
            >
              <Clock3 className="h-5 w-5" />
              <p className="mt-4 text-sm font-black">Pagar agora</p>
              <p className={cn(
                "mt-1 text-[11px] leading-relaxed",
                paymentMode === "now" ? "opacity-65" : "text-zinc-500",
              )}>
                Saldo atual: {consultation.availableBalance == null
                  ? "atualizando..."
                  : formatCurrency(consultation.availableBalance)}
              </p>
            </button>

            <button
              type="button"
              disabled={!canSchedule}
              onClick={() => setPaymentMode("scheduled")}
              aria-pressed={paymentMode === "scheduled"}
              className={cn(
                "rounded-[22px] border p-5 text-left transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100",
                paymentMode === "scheduled"
                  ? "border-foreground bg-foreground text-background shadow-lg"
                  : "border-border/65 bg-background/50 text-foreground hover:bg-muted/65",
              )}
            >
              <CalendarClock className="h-5 w-5" />
              <p className="mt-4 text-sm font-black">Agendar pagamento</p>
              <p className={cn(
                "mt-1 text-[10px] leading-relaxed",
                paymentMode === "scheduled" ? "opacity-65" : "text-zinc-500",
              )}>
                Programe uma data futura até o vencimento e garanta o saldo antes do processamento.
              </p>
            </button>
          </div>

          {paymentMode === "scheduled" && canSchedule && (
            <div className="mt-3 rounded-[20px] border border-border/60 bg-background/50 p-4">
              <label className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400" htmlFor="bill-schedule-date">
                Data do pagamento
              </label>
              <Input
                id="bill-schedule-date"
                type="date"
                min={minimumFutureScheduleDate}
                max={consultation.dueDate || undefined}
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                className="mt-2 h-12 rounded-[16px] border-border/70 bg-background"
              />
            </div>
          )}
        </div>

        <p className="mt-6 text-[11px] font-medium leading-relaxed text-muted-foreground">
          {consultation.fee > 0
            ? `Taxa desta operação: ${formatCurrency(consultation.fee)}.`
            : `${tariff?.price_label || "Pagamento sem tarifa"}.`} Após a aprovação, o boleto é processado na data escolhida. Solicitações para hoje após 14h seguem no próximo dia útil, e a confirmação bancária pode ocorrer no mesmo dia ou no próximo dia útil.
        </p>

        <div className="finance-inset mt-3 flex items-center gap-2 rounded-[18px] border border-border/55 bg-muted/30 px-4 py-3 text-[10px] font-semibold text-muted-foreground dark:border-black/75 dark:bg-black/25">
          <LockKeyhole className="h-4 w-4 shrink-0 text-foreground" />
          O pagamento ou agendamento só será enviado após a confirmação com seu PIN financeiro.
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-[0.75fr_1.25fr]">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="h-13 rounded-[18px] text-[10px] font-black uppercase tracking-[0.16em]"
          >
            Corrigir dados
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => onConfirm({
              paymentMode,
              scheduleDate: paymentMode === "scheduled" ? scheduleDate : null,
            })}
            className="h-13 rounded-[18px] bg-foreground text-[10px] font-black uppercase tracking-[0.16em] text-background shadow-lg hover:bg-foreground/90"
          >
            {paymentMode === "scheduled" ? "Confirmar agendamento" : "Confirmar pagamento"}
          </Button>
        </div>
      </div>
    </section>
  );
}
