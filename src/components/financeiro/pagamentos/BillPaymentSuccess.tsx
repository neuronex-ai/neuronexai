import { CheckCircle2, ExternalLink, FileCheck2, Landmark, Printer, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BillConsultation, BillExecutionResponse } from "@/hooks/use-neurofinance-bill-payments";
import { formatCurrency } from "@/lib/utils";

interface BillPaymentSuccessProps {
  consultation: BillConsultation;
  execution: BillExecutionResponse;
  onNewPayment: () => void;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusCopy(status: string, scheduled: boolean) {
  if (scheduled) {
    return {
      title: "Pagamento agendado",
      description: "O boleto foi registrado com segurança e será processado na data escolhida.",
    };
  }
  if (status === "paid") {
    return {
      title: "Pagamento confirmado",
      description: "A instituição bancária confirmou a efetivação do boleto.",
    };
  }
  return {
    title: "Pagamento enviado com segurança",
    description: "A solicitação foi recebida e agora acompanha o processamento bancário.",
  };
}

function humanizePaymentStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["paid", "received", "confirmed", "completed"].includes(normalized)) return "Confirmado";
  if (["scheduled"].includes(normalized)) return "Agendado";
  if (["pending", "processing", "requested"].includes(normalized)) return "Em processamento";
  if (["cancelled", "canceled"].includes(normalized)) return "Cancelado";
  if (["failed", "rejected", "denied"].includes(normalized)) return "Não concluído";
  return "Enviado";
}

export function BillPaymentSuccess({
  consultation,
  execution,
  onNewPayment,
}: BillPaymentSuccessProps) {
  const scheduled = execution.record?.payment_mode === "scheduled" || execution.status === "scheduled";
  const copy = statusCopy(execution.status, scheduled);
  const receiptUrl = execution.receiptUrl || execution.record?.receipt_url;

  const openReceipt = () => {
    if (receiptUrl) {
      window.open(receiptUrl, "_blank", "noopener,noreferrer");
      return;
    }

    const receiptWindow = window.open("", "_blank", "noopener,noreferrer,width=760,height=900");
    if (!receiptWindow) return;

    receiptWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Comprovante NeuroFinance</title>
          <style>
            body { margin: 0; padding: 48px; background: #f4f4f5; color: #18181b; font-family: Arial, sans-serif; }
            main { max-width: 620px; margin: 0 auto; background: white; padding: 42px; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.08); }
            h1 { margin: 8px 0 4px; font-size: 24px; }
            .eyebrow { font-size: 10px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: #71717a; }
            .value { margin: 32px 0; font-size: 42px; font-weight: 900; }
            dl { margin: 0; }
            div.row { display: flex; justify-content: space-between; gap: 24px; padding: 14px 0; border-bottom: 1px solid #e4e4e7; }
            dt { color: #71717a; } dd { margin: 0; font-weight: 700; text-align: right; }
            footer { margin-top: 32px; color: #a1a1aa; font-size: 10px; line-height: 1.5; }
            @media print { body { background: white; padding: 0; } main { box-shadow: none; } }
          </style>
        </head>
        <body>
          <main>
            <p class="eyebrow">NeuroFinance · Comprovante de solicitação</p>
            <h1>${escapeHtml(copy.title)}</h1>
            <p>${escapeHtml(copy.description)}</p>
            <p class="value">${escapeHtml(formatCurrency(consultation.value))}</p>
            <dl>
              <div class="row"><dt>Recebedor</dt><dd>${escapeHtml(consultation.beneficiaryName || "Não informado")}</dd></div>
              <div class="row"><dt>Instituição</dt><dd>${escapeHtml(consultation.bankName || (consultation.bankCode ? `Código bancário ${consultation.bankCode}` : "Não informada"))}</dd></div>
              <div class="row"><dt>Status</dt><dd>${escapeHtml(humanizePaymentStatus(execution.status))}</dd></div>
              <div class="row"><dt>Solicitado em</dt><dd>${escapeHtml(new Date().toLocaleString("pt-BR"))}</dd></div>
            </dl>
            <footer>Este documento registra a solicitação enviada pelo NeuroFinance. A liquidação definitiva depende da confirmação bancária.</footer>
          </main>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-[36px] border border-zinc-200/70 bg-white/80 p-7 text-center shadow-[0_40px_100px_-55px_rgba(0,0,0,0.55)] backdrop-blur-3xl dark:border-white/[0.08] dark:bg-white/[0.025] md:p-12">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[32px] bg-emerald-500/10 text-emerald-600 shadow-[0_25px_60px_-35px_rgba(16,185,129,0.8)] dark:text-emerald-400">
        <CheckCircle2 className="h-11 w-11" />
      </div>
      <p className="mt-7 text-[9px] font-black uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">
        Solicitação protegida
      </p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 dark:text-white md:text-3xl">{copy.title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-500">{copy.description}</p>

      <div className="mx-auto mt-8 max-w-xl rounded-[28px] bg-zinc-950 p-6 text-left text-white shadow-2xl dark:bg-white dark:text-zinc-950">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">Valor do boleto</p>
        <p className="mt-2 text-4xl font-black tracking-[-0.05em]">{formatCurrency(consultation.value)}</p>
        {scheduled && execution.record?.scheduled_date && (
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] opacity-55">
            Agendado para {new Date(`${execution.record.scheduled_date}T12:00:00`).toLocaleDateString("pt-BR")}
          </p>
        )}
        <div className="mt-6 grid gap-3 border-t border-white/10 pt-5 text-[10px] font-bold dark:border-black/10 sm:grid-cols-2">
          <span className="flex items-center gap-2"><Landmark className="h-4 w-4" /> {consultation.bankName || (consultation.bankCode ? `Banco ${consultation.bankCode}` : "Instituição não informada")}</span>
          <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4" /> Registro protegido no NeuroFinance</span>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={openReceipt}
          className="h-13 rounded-[18px] text-[9px] font-black uppercase tracking-widest"
        >
          {receiptUrl ? <ExternalLink className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
          {receiptUrl ? "Abrir comprovante" : "Gerar comprovante"}
        </Button>
        <Button
          type="button"
          onClick={onNewPayment}
          className="h-13 rounded-[18px] bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-zinc-950"
        >
          <FileCheck2 className="mr-2 h-4 w-4" /> Pagar outro boleto
        </Button>
      </div>
    </section>
  );
}
