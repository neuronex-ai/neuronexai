import { CalendarClock, Loader2, TimerReset, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAgendaV2,
  useProfessionalAgendaTimezone,
  type AgendaPlanSmartFitCandidate,
} from "@/hooks/use-agenda-v2";
import {
  getAppointmentPlanIssues,
  prepareAppointmentActionPlan,
  type AppointmentActionPlan,
  type AppointmentPlanIssue,
} from "@/lib/appointment-action-plans";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types";

type RescheduleConflict = {
  appointment: Appointment;
  requestedStart: string;
  requestedEnd: string;
  issues: AppointmentPlanIssue[];
};

interface AppointmentRescheduleConflictDialogProps {
  conflict: RescheduleConflict | null;
  onOpenChange: (open: boolean) => void;
  onPlanReady: (plan: AppointmentActionPlan) => void;
}

const formatDateTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone,
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(value));

export function AppointmentRescheduleConflictDialog({
  conflict,
  onOpenChange,
  onPlanReady,
}: AppointmentRescheduleConflictDialogProps) {
  const { data: professionalTimeZone = "America/Sao_Paulo" } = useProfessionalAgendaTimezone();
  const {
    suggestAppointmentSmartFit,
    isSuggestingAppointmentSmartFit,
  } = useAgendaV2();
  const [allowShorter, setAllowShorter] = useState(false);
  const [candidates, setCandidates] = useState<AgendaPlanSmartFitCandidate[]>([]);
  const [issues, setIssues] = useState<AppointmentPlanIssue[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    if (!conflict) return;
    setMessage(null);
    try {
      const result = await suggestAppointmentSmartFit({
        appointmentId: conflict.appointment.id,
        anchorStart: conflict.requestedStart,
        allowShorter,
        minimumDurationMinutes: 30,
      });
      setCandidates(result.candidates);
      if (!result.candidates.length) {
        setMessage("Nenhum encaixe compatível foi encontrado nos próximos 14 dias.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível buscar um encaixe.");
    }
  }, [allowShorter, conflict, suggestAppointmentSmartFit]);

  useEffect(() => {
    if (!conflict) return;
    setIssues(conflict.issues);
    setCandidates([]);
    setMessage(null);
    void loadCandidates();
  }, [conflict, loadCandidates]);

  const prepareCandidate = async (candidate: AgendaPlanSmartFitCandidate) => {
    if (!conflict || isPreparing) return;
    setIsPreparing(true);
    setMessage(null);
    try {
      const plan = await prepareAppointmentActionPlan("reschedule", {
        appointment_id: conflict.appointment.id,
        start_time: candidate.startTime,
        end_time: candidate.endTime,
        type: conflict.appointment.type,
        location: conflict.appointment.location,
        communication: {
          sendConfirmation: true,
          provider: "configured",
          template: "appointment_reconfirmation_required",
          reminderPolicy: "professional_settings",
        },
      }, [
        "professional-app:smart-fit-reschedule",
        conflict.appointment.id,
        candidate.startTime,
        candidate.endTime,
      ].join(":"), "professional_app");

      if (plan.status === "awaiting_confirmation") {
        onOpenChange(false);
        onPlanReady(plan);
        toast.info("Encaixe preparado. Revise o novo horário antes de confirmar.");
        return;
      }
      if (plan.status === "review_required") {
        setIssues(getAppointmentPlanIssues(plan));
        setMessage("Este encaixe deixou de estar disponível. Escolha outra sugestão.");
        void loadCandidates();
        return;
      }
      setMessage("O encaixe não está mais disponível para revisão.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível preparar o encaixe.");
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Dialog open={Boolean(conflict)} onOpenChange={onOpenChange}>
      <DialogContent
        className="agenda-modal-surface max-w-[620px] gap-0 overflow-hidden rounded-[28px] border p-0 motion-reduce:duration-0"
        contentContainerClassName="z-[246]"
        overlayClassName="z-[245] motion-reduce:duration-0"
      >
        <DialogHeader className="agenda-modal-header border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <WandSparkles className="h-5 w-5" aria-hidden="true" />
            Reencaixar este agendamento
          </DialogTitle>
          <DialogDescription>
            O horário escolhido entrou em conflito. O Synapse procura a alternativa mais próxima sem alterar as demais sessões.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-4 overflow-y-auto p-6">
          {conflict ? (
            <section className="agenda-liquid-card rounded-2xl border p-4">
              <div className="flex gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateTime(conflict.requestedStart, professionalTimeZone)} – {formatDateTime(conflict.requestedEnd, professionalTimeZone)}
                  </p>
                  <ul className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
                    {issues.map((issue, index) => (
                      <li key={`${issue.code}-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <button
            type="button"
            aria-pressed={allowShorter}
            onClick={() => {
              setAllowShorter((current) => !current);
              setCandidates([]);
            }}
            className={cn(
              "synapse-chat-glass flex min-h-11 w-full items-center justify-between rounded-2xl border px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              allowShorter && "synapse-liquid-tab-active",
            )}
          >
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
              <TimerReset className="h-4 w-4" aria-hidden="true" />
              Permitir reduzir somente esta sessão
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              mínimo 30 min
            </span>
          </button>

          <div className="space-y-2" aria-live="polite">
            {isSuggestingAppointmentSmartFit ? (
              <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                Procurando horários compatíveis…
              </div>
            ) : candidates.length ? candidates.map((candidate) => (
              <button
                type="button"
                key={`${candidate.startTime}-${candidate.endTime}`}
                disabled={isPreparing}
                onClick={() => void prepareCandidate(candidate)}
                className="agenda-liquid-card flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none"
              >
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {formatDateTime(candidate.startTime, professionalTimeZone)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {candidate.durationMinutes} min · {candidate.keepsFullDuration ? "duração preservada" : "sessão personalizada"}
                  </span>
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Escolher</span>
              </button>
            )) : message ? (
              <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-foreground">
                {message}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="agenda-modal-footer border-t p-4">
          <Button type="button" variant="outline" className="min-h-11 rounded-xl px-5" onClick={() => onOpenChange(false)}>
            Manter horário atual
          </Button>
          <Button
            type="button"
            className="agenda-primary-action min-h-11 rounded-xl px-5 font-semibold"
            disabled={isSuggestingAppointmentSmartFit || isPreparing}
            onClick={() => void loadCandidates()}
          >
            {isPreparing || isSuggestingAppointmentSmartFit ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            Buscar novamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { RescheduleConflict };
