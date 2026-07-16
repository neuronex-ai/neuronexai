import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Landmark,
  Loader2,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type BillPaymentRecord,
  downloadBillReceipt,
  useNeurofinanceBillPayments,
} from "@/hooks/use-neurofinance-bill-payments";
import { formatBoletoValue } from "@/lib/boleto";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { cn, formatCurrency } from "@/lib/utils";

const STATUS_COPY: Record<string, {
  label: string;
  className: string;
  icon: typeof Clock3;
}> = {
  scheduled: {
    label: "Agendado",
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icon: CalendarClock,
  },
  processing: {
    label: "Processando",
    className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Clock3,
  },
  paid: {
    label: "Pago",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  failed: {
    label: "Falhou",
    className: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelado",
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
    icon: AlertCircle,
  },
  refunded: {
    label: "Estornado",
    className: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    icon: AlertCircle,
  },
};

const BANK_STATUS_COPY: Record<string, string> = {
  PENDING: "Pendente",
  SCHEDULED: "Agendado",
  AWAITING_BALANCE: "Aguardando saldo",
  BANK_PROCESSING: "Processamento bancário",
  PROCESSING: "Processando",
  PAID: "Pago",
  DONE: "Concluído",
  CONFIRMED: "Confirmado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
  REFUNDED: "Estornado",
  scheduled: "Agendado",
  processing: "Processando",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
  refunded: "Estornado",
};

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Não informado";
  const date = value.length === 10
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return date.toLocaleString("pt-BR", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" });
}

function formatDocument(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value || "Não informado";
}

function formatBankStatus(record: BillPaymentRecord) {
  const raw = String(record.provider_status || record.status || "").trim();
  if (!raw) return "Não informado";
  const direct = BANK_STATUS_COPY[raw] || BANK_STATUS_COPY[raw.toUpperCase()] || STATUS_COPY[raw.toLowerCase()]?.label;
  if (direct) return direct;
  return "Em acompanhamento";
}

function providerDetails(record: BillPaymentRecord) {
  const payload = record.provider_payload || {};
  const consultation = (payload.consultation || payload) as Record<string, unknown>;
  const bankSlip = (consultation.bankSlipInfo || {}) as Record<string, unknown>;
  const execution = (payload.execution || {}) as Record<string, unknown>;
  return { bankSlip, execution };
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.025]">
      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-zinc-950 dark:text-white">{value}</p>
    </div>
  );
}

export function ScheduledBillPayments() {
  const { list } = useNeurofinanceBillPayments();
  const [selected, setSelected] = useState<BillPaymentRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const records = useMemo(() => list.data || [], [list.data]);

  const summary = useMemo(() => ({
    scheduled: records.filter((item) => item.status === "scheduled").length,
    processing: records.filter((item) => item.status === "processing").length,
    completed: records.filter((item) => item.status === "paid").length,
  }), [records]);

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
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Agendados", value: summary.scheduled, icon: CalendarClock },
          { label: "Em processamento", value: summary.processing, icon: Clock3 },
          { label: "Concluídos", value: summary.completed, icon: CheckCircle2 },
        ].map((item) => (
          <div key={item.label} className="rounded-[24px] border border-zinc-200/70 bg-white/70 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <item.icon className="h-5 w-5 text-zinc-400" />
            <p className="mt-5 text-3xl font-black text-zinc-950 dark:text-white">{item.value}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{item.label}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[30px] border border-zinc-200/70 bg-white/72 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.35)] dark:border-white/[0.07] dark:bg-[#0b0b0d]/78">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200/70 px-6 py-5 dark:border-white/[0.07]">
          <div>
            <h3 className="text-base font-black text-zinc-950 dark:text-white">Boletos enviados</h3>
            <p className="mt-1 text-xs text-zinc-500">Agendamentos, pagamentos e comprovantes em um só lugar.</p>
          </div>
          <ReceiptText className="h-5 w-5 text-zinc-300" />
        </div>

        {list.isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-zinc-100 text-zinc-400 dark:bg-white/[0.05]">
              <WalletCards className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-black text-zinc-950 dark:text-white">Nenhum boleto enviado</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
              Quando um pagamento for agendado ou processado, todas as informações aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">
            {records.map((record) => {
              const status = STATUS_COPY[record.status] || STATUS_COPY.processing;
              const StatusIcon = status.icon;
              return (
                <button key={record.id} type="button" onClick={() => setSelected(record)} className="grid w-full gap-4 px-6 py-5 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.025] md:grid-cols-[minmax(0,1.3fr)_160px_150px_140px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{record.beneficiary_name || "Beneficiário não informado"}</p>
                    <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.13em] text-zinc-400">{record.bank_name || (record.bank_code ? `Banco ${record.bank_code}` : "Instituição não informada")}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">{record.payment_mode === "scheduled" ? "Agendado para" : "Solicitado em"}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-800 dark:text-zinc-200">{formatDate(record.scheduled_date || record.created_at)}</p>
                  </div>
                  <span className={cn("flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em]", status.className)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                  <p className="text-right text-sm font-black text-zinc-950 dark:text-white">{formatCurrency((Number(record.amount || 0) + Number(record.fee_amount || 0)) / 100)}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <BillPaymentDetailsDialog record={selected} downloading={downloadingId === selected?.id} onDownload={handleDownload} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

export function BillPaymentDetailsDialog({
  record,
  downloading,
  onDownload,
  onOpenChange,
}: {
  record: BillPaymentRecord | null;
  downloading: boolean;
  onDownload: (record: BillPaymentRecord) => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (!record) return null;

  const status = STATUS_COPY[record.status] || STATUS_COPY.processing;
  const { bankSlip, execution } = providerDetails(record);
  const originalValue = Number(bankSlip.originalValue || execution.originalValue || record.amount / 100);
  const discount = Number(bankSlip.discountValue || execution.discount || 0);
  const interest = Number(bankSlip.interestValue || execution.interest || 0);
  const fine = Number(bankSlip.fineValue || execution.fine || 0);
  const fee = Number(record.fee_amount || 0) / 100;

  return (
    <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
      <DialogContent className="finance-modal-surface max-h-[90vh] max-w-3xl overflow-y-auto rounded-[32px] border-zinc-200 bg-white/95 p-0 shadow-[0_40px_120px_-44px_rgba(0,0,0,0.55)] backdrop-blur-3xl dark:border-white/10 dark:bg-zinc-950/95">
        <DialogHeader className="border-b border-zinc-200/70 p-7 dark:border-white/[0.07]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-zinc-950 dark:text-white">Detalhes do boleto</DialogTitle>
              <DialogDescription className="mt-1">Dados consultados, escolha de pagamento e retorno bancário.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-7">
          <div className="flex flex-col justify-between gap-4 rounded-[26px] bg-zinc-950 p-6 text-white dark:bg-white dark:text-zinc-950 sm:flex-row sm:items-end">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-45">Valor total</p>
              <p className="mt-2 text-3xl font-black">{formatCurrency((Number(record.amount || 0) + Number(record.fee_amount || 0)) / 100)}</p>
            </div>
            <span className={cn("w-fit rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em]", status.className)}>{status.label}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Beneficiário" value={record.beneficiary_name || "Não informado"} />
            <DetailItem label="CPF/CNPJ" value={formatDocument(record.beneficiary_document)} />
            <DetailItem label="Instituição" value={record.bank_name || "Nome não retornado pela instituição"} />
            <DetailItem label="Código bancário" value={record.bank_code || "Não informado"} />
            <DetailItem label="Vencimento" value={formatDate(record.due_date)} />
            <DetailItem label="Data programada" value={formatDate(record.scheduled_date)} />
            <DetailItem label="Forma escolhida" value={record.payment_mode === "scheduled" ? "Pagamento agendado" : "Pagamento imediato"} />
            <DetailItem label="Status bancário" value={formatBankStatus(record)} />
          </div>

          <div>
            <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Valores informados</p>
            <div className="grid gap-3 sm:grid-cols-5">
              <DetailItem label="Original" value={formatCurrency(originalValue)} />
              <DetailItem label="Desconto" value={formatCurrency(discount)} />
              <DetailItem label="Juros" value={formatCurrency(interest)} />
              <DetailItem label="Multa" value={formatCurrency(fine)} />
              <DetailItem label="Taxa" value={formatCurrency(fee)} />
            </div>
          </div>

          <div>
            <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Identificação e auditoria</p>
            <div className="grid gap-3">
              <DetailItem label="Linha digitável" value={formatBoletoValue(record.identification_field || "") || "Não informada"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Autorizado com PIN" value={formatDate(record.authorized_at, true)} />
                <DetailItem label="Enviado à instituição" value={formatDate(record.submitted_at, true)} />
                <DetailItem label="Data do pagamento" value={formatDate(record.payment_date || record.paid_at)} />
                <DetailItem label="Última atualização" value={formatDate(record.updated_at, true)} />
              </div>
            </div>
          </div>

          {record.error_message && <div className="rounded-[18px] border border-red-500/20 bg-red-500/[0.07] p-4 text-xs font-semibold text-red-700 dark:text-red-300">{getUserFacingErrorMessage(record.error_message, "payment")}</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" disabled={!record.receipt_url} onClick={() => record.receipt_url && window.open(record.receipt_url, "_blank", "noopener,noreferrer")} className="h-12 rounded-[17px] text-[9px] font-black uppercase tracking-widest">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir comprovante
            </Button>
            <Button type="button" disabled={!record.receipt_url || downloading} onClick={() => onDownload(record)} className="h-12 rounded-[17px] bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-zinc-950">
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar comprovante
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-[18px] border border-zinc-200/70 bg-zinc-50/70 p-4 text-[10px] leading-relaxed text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.025]">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0" />
            O status é atualizado pelo NeuroFinance conforme a confirmação bancária. Em pagamentos agendados, mantenha saldo suficiente até a data programada.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
