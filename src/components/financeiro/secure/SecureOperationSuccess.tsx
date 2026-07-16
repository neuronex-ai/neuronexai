import { CheckCircle2, ExternalLink, FileCheck2, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface SecureOperationSuccessProps {
  title: string;
  description: string;
  amount: number;
  recipient: string;
  status?: string;
  receiptUrl?: string | null;
  newActionLabel: string;
  onNewAction: () => void;
  onRefreshReceipt?: () => Promise<string | null>;
}

function humanizeOperationStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["paid", "received", "confirmed", "completed"].includes(normalized)) return "Confirmado";
  if (["scheduled", "pending", "processing", "requested"].includes(normalized)) return "Em processamento";
  if (["cancelled", "canceled"].includes(normalized)) return "Cancelado";
  if (["failed", "rejected", "denied"].includes(normalized)) return "Não concluído";
  return "Enviado";
}

function escapeReceiptHtml(value?: string | null) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function SecureOperationSuccess({
  title,
  description,
  amount,
  recipient,
  status,
  receiptUrl,
  newActionLabel,
  onNewAction,
  onRefreshReceipt,
}: SecureOperationSuccessProps) {
  const resolveReceiptUrl = async () => {
    if (receiptUrl) return receiptUrl;
    if (!onRefreshReceipt) return null;
    try {
      return await onRefreshReceipt();
    } catch {
      return null;
    }
  };

  const openReceipt = async () => {
    const refreshed = await resolveReceiptUrl();
    if (refreshed) {
      window.open(refreshed, "_blank", "noopener,noreferrer");
      return;
    }

    const receiptWindow = window.open("", "_blank", "noopener,noreferrer,width=760,height=900");
    if (!receiptWindow) return;
    const safeTitle = escapeReceiptHtml(title);
    const safeAmount = escapeReceiptHtml(formatCurrency(amount));
    const safeRecipient = escapeReceiptHtml(recipient);
    const safeStatus = escapeReceiptHtml(humanizeOperationStatus(status));
    const safeDate = escapeReceiptHtml(new Date().toLocaleString("pt-BR"));
    receiptWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante NeuroFinance</title><style>body{padding:48px;background:#f4f4f5;color:#18181b;font-family:Arial}main{max-width:620px;margin:auto;background:#fff;padding:42px;border-radius:24px}.value{font-size:42px;font-weight:900}.row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e4e4e7}</style></head><body><main><p>NeuroFinance · Comprovante de solicitação</p><h1>${safeTitle}</h1><p class="value">${safeAmount}</p><div class="row"><span>Destino</span><strong>${safeRecipient}</strong></div><div class="row"><span>Status</span><strong>${safeStatus}</strong></div><div class="row"><span>Solicitado em</span><strong>${safeDate}</strong></div><p>A liquidação definitiva depende da confirmação bancária.</p></main><script>window.onload=()=>window.print()</script></body></html>`);
    receiptWindow.document.close();
  };

  const shareReceipt = async () => {
    const refreshed = await resolveReceiptUrl();
    const shareText = `${title}\n${formatCurrency(amount)}\nDestino: ${recipient}\nStatus: ${humanizeOperationStatus(status)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Comprovante NeuroFinance",
          text: shareText,
          ...(refreshed ? { url: refreshed } : {}),
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(refreshed ? `${shareText}\n${refreshed}` : shareText);
      toast.success("Dados do comprovante copiados.");
    } catch {
      toast.error("Não foi possível compartilhar o comprovante neste dispositivo.");
    }
  };

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-[30px] border border-zinc-200/70 bg-white/80 p-5 text-center shadow-[0_40px_100px_-55px_rgba(0,0,0,0.55)] backdrop-blur-3xl dark:border-white/[0.08] dark:bg-white/[0.025] sm:rounded-[36px] sm:p-7 md:p-12">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sm:h-24 sm:w-24 sm:rounded-[32px]"><CheckCircle2 className="h-10 w-10 sm:h-11 sm:w-11" /></div>
      <p className="mt-6 text-[9px] font-black uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400 sm:mt-7">Solicitação protegida</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 dark:text-white md:text-3xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-500">{description}</p>
      <div className="mx-auto mt-7 max-w-xl rounded-[24px] bg-zinc-950 p-5 text-left text-white shadow-2xl dark:bg-white dark:text-zinc-950 sm:mt-8 sm:rounded-[28px] sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">Valor enviado</p>
        <p className="mt-2 text-3xl font-black tracking-[-0.05em] sm:text-4xl">{formatCurrency(amount)}</p>
        <p className="mt-5 border-t border-white/10 pt-4 text-xs font-bold dark:border-black/10">{recipient}</p>
      </div>
      <div className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-3">
        <Button type="button" variant="outline" onClick={openReceipt} className="h-13 rounded-[18px] text-[9px] font-black uppercase tracking-widest">
          {receiptUrl ? <ExternalLink className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />} Comprovante
        </Button>
        <Button type="button" variant="outline" onClick={shareReceipt} className="h-13 rounded-[18px] text-[9px] font-black uppercase tracking-widest">
          <Share2 className="mr-2 h-4 w-4" /> Compartilhar
        </Button>
        <Button type="button" onClick={onNewAction} className="h-13 rounded-[18px] bg-zinc-950 text-[9px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-zinc-950">
          <FileCheck2 className="mr-2 h-4 w-4" /> {newActionLabel}
        </Button>
      </div>
    </section>
  );
}
