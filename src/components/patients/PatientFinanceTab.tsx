"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileText,
  Layers3,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";

import { EditTransactionModal } from "../financeiro/EditTransactionModal";
import { InvoiceEmissionModal } from "../financeiro/InvoiceEmissionModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePatientInvoices } from "@/hooks/use-invoices";
import { usePatientTransactions } from "@/hooks/use-patient-transactions";
import { cn } from "@/lib/utils";
import type { Invoice, Transaction } from "@/types";
import { managementOriginOf } from "@/lib/financial-management-model";

interface PatientFinanceTabProps {
  patientId: string;
}

const DESKTOP_PAGE_SIZE = 10;
const MOBILE_PAGE_SIZE = 8;
type FinanceView = "movements" | "charges" | "nfse";

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
  const originLabel = managementOriginOf(transaction);
  const isEditable = originLabel === "Lançamento manual";

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
          aria-label={`${isEditable ? "Editar" : "Abrir detalhes de"} ${transaction.description}`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-4">
            <span
              className={cn(
                "patient-status-icon flex shrink-0 items-center justify-center rounded-2xl",
                isMobile ? "h-10 w-10" : "h-11 w-11",
                isIncome
                  ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/12 dark:text-emerald-300"
                  : "bg-rose-500/10 text-rose-600 dark:bg-rose-400/12 dark:text-rose-300",
              )}
            >
              {isIncome ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </span>

            <span className="min-w-0 space-y-1">
              <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                {transaction.description}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="flex shrink-0 items-center gap-1.5">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {new Date(`${transaction.date}T00:00:00`).toLocaleDateString("pt-BR")}
                </span>
                <span aria-hidden="true">•</span>
                <span className="truncate">{transaction.category || "Geral"}</span>
                <span aria-hidden="true">•</span>
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                  <Layers3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {originLabel}
                </span>
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
  const patientInvoices = usePatientInvoices(patientId);
  const isMobile = useIsMobile();
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [view, setView] = useState<FinanceView>("movements");

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

      {!isMobile ? (
        <nav
          aria-label="Áreas financeiras do paciente"
          className="desktop-retina-inset grid grid-cols-3 gap-1 rounded-[20px] border border-border/45 bg-muted/28 p-1.5"
        >
          {([
            { value: "movements" as const, label: "Movimentações", icon: Wallet },
            { value: "charges" as const, label: "Cobranças", icon: Receipt },
            { value: "nfse" as const, label: "NFS-e", icon: FileCheck2 },
          ]).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={view === item.value}
              onClick={() => setView(item.value)}
              className={cn(
                "desktop-retina-interactive flex min-h-11 items-center justify-center gap-2 rounded-[15px] px-3 text-[9px] font-black uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                view === item.value
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-background/75 hover:text-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
      ) : null}

      {(isMobile || view === "movements") ? <section className="desktop-retina-panel overflow-hidden rounded-[28px] border border-border/45 bg-card/62">
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
      </section> : null}

      {!isMobile && view === "charges" ? (
        <PatientInvoicePanel
          invoices={patientInvoices.data?.invoices || []}
          isLoading={patientInvoices.isLoading}
          mode="charges"
        />
      ) : null}

      {!isMobile && view === "nfse" ? (
        <PatientInvoicePanel
          invoices={patientInvoices.data?.invoices || []}
          isLoading={patientInvoices.isLoading}
          mode="nfse"
          patientId={patientId}
        />
      ) : null}
    </div>
  );
};

const invoiceStatusLabel: Record<Invoice["status"], string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  overdue: "Vencido",
};

const PatientInvoicePanel = ({
  invoices,
  isLoading,
  mode,
  patientId,
}: {
  invoices: Invoice[];
  isLoading: boolean;
  mode: "charges" | "nfse";
  patientId?: string;
}) => {
  const visible = mode === "nfse"
    ? invoices.filter((invoice) => Boolean(invoice.nfse_status || invoice.nfse_reference || invoice.nfse_number))
    : invoices;

  return (
    <section className="desktop-retina-panel overflow-hidden rounded-[28px] border border-border/45 bg-card/62">
      <header className="flex flex-col gap-3 border-b border-border/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <span className="desktop-retina-inset flex h-10 w-10 items-center justify-center rounded-2xl border border-border/45 text-muted-foreground">
            {mode === "nfse" ? <FileCheck2 className="h-4 w-4" aria-hidden="true" /> : <Receipt className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {mode === "nfse" ? "Notas fiscais do paciente" : "Cobranças do paciente"}
            </h3>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {visible.length} {visible.length === 1 ? "registro" : "registros"}
            </p>
          </div>
        </div>

        {mode === "nfse" && patientId ? (
          <InvoiceEmissionModal initialPatientId={patientId}>
            <Button type="button" className="desktop-retina-interactive min-h-11 rounded-xl px-5 text-xs font-bold">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Nova NFS-e para este paciente
            </Button>
          </InvoiceEmissionModal>
        ) : null}
      </header>

      {isLoading ? (
        <div className="space-y-3 p-5" aria-busy="true" aria-label="Carregando registros financeiros">
          <Skeleton className="h-20 rounded-[20px] motion-reduce:animate-none" />
          <Skeleton className="h-20 rounded-[20px] motion-reduce:animate-none" />
        </div>
      ) : visible.length ? (
        <div className="patient-record-scrollbar max-h-[620px] space-y-2.5 overflow-y-auto p-4 [scrollbar-gutter:stable] md:p-5">
          {visible.map((invoice) => {
            const documentUrl = mode === "nfse"
              ? invoice.nfse_pdf_url || invoice.nfse_xml_url
              : invoice.payment_url || invoice.pdf_url;
            const fiscalStatus = invoice.nfse_status_description || invoice.nfse_status || "Registrada";
            return (
              <article key={invoice.id} className="desktop-retina-inset rounded-[22px] border border-border/45 bg-background/62 p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                      mode === "nfse"
                        ? "border-sky-500/18 bg-sky-500/9 text-sky-600 dark:text-sky-300"
                        : "border-border/55 bg-muted/40 text-muted-foreground",
                    )}>
                      {mode === "nfse" ? <FileText className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-foreground">
                        {invoice.description || (mode === "nfse" ? "Nota fiscal de serviço" : "Cobrança NeuroFinance")}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        <span>{mode === "nfse" ? fiscalStatus : invoiceStatusLabel[invoice.status]}</span>
                        <span aria-hidden="true">•</span>
                        <span>{new Date(invoice.created_at).toLocaleDateString("pt-BR")}</span>
                        {invoice.appointment_id ? <span className="rounded-full border border-border/50 px-2 py-0.5">Vinculada a agendamento</span> : null}
                      </div>
                      {mode === "nfse" && invoice.nfse_number ? (
                        <p className="mt-2 text-xs font-medium text-muted-foreground">Nota {invoice.nfse_number}</p>
                      ) : null}
                      {mode === "nfse" && invoice.nfse_error_message ? (
                        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{invoice.nfse_error_message}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-black tracking-[-0.035em] text-foreground">{formatCurrency(invoice.amount)}</p>
                    {documentUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 min-h-10 rounded-xl px-3 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground"
                        onClick={() => window.open(documentUrl, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                        Abrir documento
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
          <span className="desktop-retina-inset mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/45 text-muted-foreground">
            {mode === "nfse" ? <FileCheck2 className="h-6 w-6" /> : <Receipt className="h-6 w-6" />}
          </span>
          <p className="text-sm font-semibold text-foreground">
            {mode === "nfse" ? "Nenhuma NFS-e vinculada" : "Nenhuma cobrança vinculada"}
          </p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {mode === "nfse"
              ? "Notas emitidas ou registradas para este paciente aparecerão aqui."
              : "Cobranças NeuroFinance e registros legados deste paciente aparecerão aqui."}
          </p>
        </div>
      )}
    </section>
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
