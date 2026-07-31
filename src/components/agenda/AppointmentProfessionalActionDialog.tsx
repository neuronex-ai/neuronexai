"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Archive, CheckCircle2, FileCheck2, Loader2, Receipt, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  type ProfessionalAppointmentAction,
  useExecuteProfessionalAppointmentAction,
  useProfessionalAppointmentActionPreview,
} from "@/hooks/use-appointment-professional-action";
import { useSendEmail } from "@/hooks/use-send-email";

export function AppointmentProfessionalActionDialog({
  appointmentId,
  patientName,
  patientEmail,
  startTime,
  itemKind = "session",
  action,
  open,
  onOpenChange,
  onCompleted,
}: {
  appointmentId: string;
  patientName: string;
  patientEmail?: string | null;
  startTime: string;
  itemKind?: "session" | "event";
  action: ProfessionalAppointmentAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [reason, setReason] = useState("");
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const preview = useProfessionalAppointmentActionPreview(appointmentId, action, open);
  const execute = useExecuteProfessionalAppointmentAction();
  const sendEmail = useSendEmail();

  useEffect(() => {
    if (!open) return;
    setReason("");
    idempotencyKeyRef.current = crypto.randomUUID();
  }, [action, open]);

  if (!action) return null;
  const isArchive = action === "archive";
  const itemLabel = itemKind === "event" ? "evento" : "agendamento";
  const data = preview.data;
  const canConfirm = Boolean(data?.canExecute && reason.trim().length >= 3 && !execute.isPending);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      const result = await execute.mutateAsync({
        appointmentId,
        action,
        reason: reason.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (result.emailRequired && patientEmail) {
        try {
          await sendEmail.mutateAsync({
            type: "reminder",
            params: {
              appointmentId,
              action: "cancel",
              cancellationReason: reason.trim(),
              idempotencyKey: `${idempotencyKeyRef.current}:email`,
              patientEmail,
              patientName,
              startTime,
            },
          });
        } catch {
          toast.warning("O cancelamento foi registrado, mas o e-mail não pôde ser enviado agora.");
        }
      } else if (result.emailRequired) {
        toast.warning("O cancelamento foi registrado, mas o paciente não possui e-mail cadastrado.");
      }

      toast.success(result.message);
      onOpenChange(false);
      onCompleted();
    } catch (error) {
      console.error("[AppointmentProfessionalAction] Falha ao executar ação", error);
      toast.error("Não foi possível concluir esta ação com segurança.");
      void preview.refetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="agenda-modal-surface desktop-retina-modal desktop-retina-form z-[220] w-[calc(100%-2rem)] max-w-[560px] gap-0 overflow-hidden rounded-[30px] border p-0">
        <DialogHeader className="agenda-modal-header border-b px-6 py-5 text-left">
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border ${isArchive ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300" : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300"}`}>
              {isArchive ? <Archive className="h-[18px] w-[18px]" /> : <XCircle className="h-[18px] w-[18px]" />}
            </span>
            <div>
              <DialogTitle className="text-lg font-black tracking-[-0.025em] text-foreground">
                {isArchive ? `Arquivar ${itemLabel}` : `Cancelar ${itemLabel}`}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isArchive
                  ? "O item deixará o calendário, mas continuará integralmente no prontuário e na auditoria."
                  : "O backend revalidará direitos do paciente e consequências antes de permitir o cancelamento."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="agenda-modal-body patient-record-scrollbar max-h-[65vh] space-y-4 overflow-y-auto p-6">
          {preview.isLoading ? (
            <div className="flex min-h-44 items-center justify-center" aria-busy="true" aria-label="Calculando impacto da ação">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
            </div>
          ) : preview.isError || !data ? (
            <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-700 dark:text-rose-200">
              Não foi possível calcular o impacto. Nenhuma alteração foi feita.
            </div>
          ) : (
            <>
              <div className="agenda-liquid-card rounded-[20px] border p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {itemKind === "event" ? "Evento" : "Agendamento"}
                </p>
                <p className="mt-2 text-sm font-bold text-foreground">{patientName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.appointmentDate ? format(new Date(data.appointmentDate), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR }) : "Data não informada"} · {data.currentStatus}
                </p>
              </div>

              {isArchive && data.preserved.financialRecords > 0 ? (
                <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-sm font-bold text-foreground">Esta sessão possui consequências já registradas.</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Deseja removê-la da agenda mesmo assim? As informações continuarão registradas no prontuário do paciente.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <PreservedFact icon={ShieldCheck} label="Histórico" value="Preservado" />
                <PreservedFact icon={Receipt} label="Registros financeiros" value={String(data.preserved.financialRecords)} />
                <PreservedFact icon={FileCheck2} label="Documentos fiscais" value={String(data.preserved.fiscalDocuments)} />
                <PreservedFact icon={CheckCircle2} label="Registros clínicos" value={String(data.preserved.clinicalRecords)} />
              </div>

              {data.warnings.length ? (
                <ul className="space-y-2" aria-label="Avisos da ação">
                  {data.warnings.map((warning) => (
                    <li key={warning} className="flex gap-3 rounded-[18px] border border-amber-500/18 bg-amber-500/8 p-3.5 text-xs leading-relaxed text-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}

              {data.blockers.length ? (
                <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-rose-700 dark:text-rose-200">Ação bloqueada</p>
                  <ul className="mt-3 space-y-2 text-xs leading-relaxed text-foreground">
                    {data.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">Nenhum vínculo será alterado enquanto essas pendências existirem.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="appointment-action-reason" className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                    Motivo obrigatório
                  </label>
                  <Textarea
                    id="appointment-action-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={1000}
                    className="agenda-field min-h-24 resize-none rounded-[18px] px-4 py-3 text-sm"
                    placeholder={isArchive ? "Explique por que este item deve sair da agenda…" : "Informe o motivo comunicado ao paciente…"}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <footer className="agenda-modal-footer flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="agenda-tactile min-h-11 rounded-xl px-5">
            Voltar
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
            className={`agenda-tactile min-h-11 rounded-xl px-5 font-bold ${isArchive ? "bg-amber-600 text-white hover:bg-amber-700" : "bg-rose-600 text-white hover:bg-rose-700"}`}
          >
            {execute.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
            {isArchive ? "Confirmar arquivamento" : "Confirmar cancelamento"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function PreservedFact({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="agenda-liquid-card flex items-center gap-3 rounded-[18px] border p-3.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1 text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
