import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarClock, Check, Clock3, Loader2, ShieldCheck, X } from "lucide-react";
import { useId, useState } from "react";

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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AppointmentRescheduleRequest } from "@/hooks/use-appointment-lifecycle";

type Decision = "approve" | "reject";

const dateTime = (value: string) => format(new Date(value), "dd 'de' MMMM, HH:mm", { locale: ptBR });

export function AppointmentRescheduleReview({
  request,
  isReviewing,
  onReview,
}: {
  request: AppointmentRescheduleRequest;
  isReviewing: boolean;
  onReview: (input: { requestId: string; decision: Decision; reason?: string }) => Promise<unknown>;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const headingId = useId();
  const isOverdue = request.status === "expired_no_response";

  const closeDialog = () => {
    if (isReviewing) return;
    setDecision(null);
    setReason("");
  };

  const confirmDecision = async () => {
    if (!decision) return;
    try {
      await onReview({ requestId: request.id, decision, reason: reason.trim() || undefined });
      closeDialog();
    } catch {
      // The hook owns user-facing error feedback and keeps the dialog open.
    }
  };

  return (
    <>
      <section className="agenda-liquid-surface rounded-[22px] border border-amber-500/25 p-4 sm:p-5" aria-labelledby={headingId}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">{isOverdue ? "Proteção do paciente" : "Pendência do paciente"}</p>
            <h3 id={headingId} className="mt-1 text-base font-bold tracking-tight text-foreground">{isOverdue ? "Decisão profissional em atraso" : "Solicitação de reagendamento"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Recebida em {format(new Date(request.requested_at || request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="agenda-liquid-card mt-4 grid items-center gap-2 rounded-2xl border p-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Horário original</p>
            <p className="mt-1 text-sm font-bold">{dateTime(request.original_start_time)}</p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Horário solicitado</p>
            <p className="mt-1 text-sm font-bold text-primary">{dateTime(request.requested_start_time)}</p>
          </div>
        </div>

        {request.reason ? (
          <blockquote className="agenda-liquid-card mt-3 rounded-xl border-l-2 border-amber-500/50 px-3 py-2 text-sm text-muted-foreground">“{request.reason}”</blockquote>
        ) : null}

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          {request.professional_response_due_at ? (
            <p className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-muted-foreground">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Prazo de resposta: {dateTime(request.professional_response_due_at)}
            </p>
          ) : null}
          {request.financial_right_protected ? (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Direito financeiro protegido
            </p>
          ) : null}
        </div>

        {isOverdue ? (
          <p className="mt-3 rounded-xl border border-amber-500/25 bg-background/60 px-3 py-2 text-sm leading-relaxed text-muted-foreground" role="status">
            O prazo de análise terminou. Nenhuma falta, consumo de pacote ou penalidade financeira automática pode ser aplicada enquanto o caso estiver protegido.
          </p>
        ) : null}

        {!isOverdue ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="agenda-tactile h-11 rounded-xl border-red-500/25 text-red-600 hover:bg-red-500/10 hover:text-red-700"
            disabled={isReviewing}
            onClick={() => setDecision("reject")}
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />Recusar
          </Button>
          <Button type="button" className="agenda-primary-action agenda-tactile h-11 rounded-xl" disabled={isReviewing} onClick={() => setDecision("approve")}>
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />Aceitar novo horário
          </Button>
        </div> : null}
      </section>

      <AlertDialog open={decision !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <AlertDialogContent className="agenda-modal-surface desktop-retina-modal z-[220] w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-[28px] p-0">
          <AlertDialogHeader className="agenda-modal-header space-y-2 p-5 text-left sm:p-6">
            <AlertDialogTitle className="text-xl font-bold tracking-tight">
              {decision === "approve" ? "Aprovar novo horário?" : "Recusar reagendamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {decision === "approve"
                ? "A data oficial será alterada e o paciente receberá automaticamente os novos detalhes."
                : "O agendamento original será mantido e o paciente receberá uma notificação."}
            </AlertDialogDescription>
            <div className="pt-3">
              <label htmlFor="review-reason" className="mb-2 block text-sm font-semibold text-foreground">Mensagem ao paciente <span className="font-normal text-muted-foreground">(opcional)</span></label>
              <Textarea
                id="review-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                className="agenda-field min-h-24 rounded-xl"
                placeholder={decision === "approve" ? "Novo horário confirmado." : "Informe o motivo, se desejar."}
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="agenda-modal-footer grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:space-x-0">
            <AlertDialogCancel disabled={isReviewing} className="agenda-tactile mt-0 h-11 rounded-xl">Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isReviewing}
              onClick={(event) => {
                event.preventDefault();
                void confirmDecision();
              }}
              className={`agenda-tactile h-11 rounded-xl ${decision === "reject" ? "bg-red-600 text-white hover:bg-red-700" : "agenda-primary-action"}`}
            >
              {isReviewing ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Salvando decisão" /> : decision === "approve" ? "Aprovar" : "Recusar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
