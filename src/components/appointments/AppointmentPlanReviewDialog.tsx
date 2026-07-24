import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CircleDollarSign, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import {
  cancelAppointmentActionPlan,
  executeAgendaActionPlan,
  executeAppointmentActionPlan,
  getAppointmentActionPlan,
  type AppointmentActionPlan,
} from "@/lib/appointment-action-plans";
import { getAppointmentPlanErrorMessage } from "@/lib/appointment-action-plan-errors";
import {
  APPOINTMENT_PLAN_REVIEW_EVENT,
  type AppointmentPlanReviewReference,
} from "@/lib/appointment-plan-review";

const recordOf = (value: unknown) => value && typeof value === "object"
  ? value as Record<string, unknown>
  : {};

const formatDateTime = (value: unknown) => {
  if (!value) return "Data não informada";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
};

const statusMessage = (status: string) => {
  if (status === "expired") return "Este plano expirou. Peça ao Synapse para preparar uma nova revisão.";
  if (status === "superseded") return "Os dados mudaram. Uma nova versão precisa ser revisada.";
  if (status === "review_required") return "O impacto financeiro ou fiscal requer revisão profissional antes da execução.";
  if (status === "cancelled") return "Este plano foi cancelado e não pode mais ser executado.";
  if (status === "completed") return "Esta alteração já foi concluída.";
  return null;
};

export function AppointmentPlanReviewDialog() {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState<AppointmentPlanReviewReference | null>(null);
  const [plan, setPlan] = useState<AppointmentActionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleReview = (event: Event) => {
      const detail = (event as CustomEvent<AppointmentPlanReviewReference>).detail;
      if (!detail) return;
      setReference(detail);
      setPlan(null);
      setError(null);
    };
    window.addEventListener(APPOINTMENT_PLAN_REVIEW_EVENT, handleReview);
    return () => window.removeEventListener(APPOINTMENT_PLAN_REVIEW_EVENT, handleReview);
  }, []);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    setIsLoading(true);
    void getAppointmentActionPlan(reference.planId, reference.planVersion)
      .then((freshPlan) => {
        if (!active) return;
        if (freshPlan.planHash !== reference.planHash) {
          setError("A versão recebida não corresponde mais ao plano atual. Solicite uma nova revisão.");
          return;
        }
        setPlan(freshPlan);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o plano com segurança.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [reference]);

  const summary = useMemo(() => recordOf(plan?.summary), [plan]);
  const agenda = useMemo(() => recordOf(summary.agenda), [summary]);
  const financial = useMemo(() => recordOf(summary.financial), [summary]);
  const fiscal = useMemo(() => recordOf(summary.fiscal), [summary]);
  const policy = useMemo(() => recordOf(summary.policy), [summary]);
  const isAgendaV2 = summary.action === "create_series_v2";
  const terminalMessage = plan ? statusMessage(plan.status) : null;
  const canConfirm = plan?.status === "awaiting_confirmation" && !isSubmitting && !error;

  const close = () => {
    if (isSubmitting) return;
    setReference(null);
    setPlan(null);
    setError(null);
  };

  const confirm = async () => {
    if (!reference || !plan || !canConfirm) return;
    setIsSubmitting(true);
    try {
      let completed: AppointmentActionPlan;
      if (reference.conversationId) {
        const sourceId = `appointment-plan:${plan.planId}:v${plan.planVersion}:professional-app`;
        const { data, error: invocationError } = await supabase.functions.invoke(
          "synapse-text-fallback",
          {
            body: {
              message: "Confirmo",
              sessionId: reference.conversationId,
              requestId: sourceId,
              source: { source_message_id: sourceId, message_type: "appointment_plan_confirmation" },
              context: { channel: "professional_app", source: "appointment_plan_review" },
              appointmentPlanConfirmation: {
                planId: plan.planId,
                planVersion: plan.planVersion,
                planHash: plan.planHash,
              },
            },
          },
        );
        if (invocationError) throw invocationError;
        if (!data || typeof data !== "object" || (data as Record<string, unknown>).error) {
          throw new Error("O Synapse não confirmou a execução do plano.");
        }
        completed = await getAppointmentActionPlan(plan.planId, plan.planVersion);
        await queryClient.invalidateQueries({ queryKey: ["sessionMessages", reference.conversationId] });
      } else {
        completed = isAgendaV2
          ? await executeAgendaActionPlan(plan)
          : await executeAppointmentActionPlan(plan);
      }

      if (completed.status !== "completed") {
        setPlan(completed);
        throw new Error(statusMessage(completed.status) || "O plano precisa ser revisado novamente.");
      }
      const result = recordOf(completed.result);
      toast.success(String(result.message || "Alteração do agendamento concluída."));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] }),
        queryClient.invalidateQueries({ queryKey: ["appointment-lifecycle"] }),
      ]);
      close();
    } catch (caught) {
      const message = getAppointmentPlanErrorMessage(
        caught,
        summary.action === "reschedule" ? "reschedule" : "generic",
      );
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!reference || !plan || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await cancelAppointmentActionPlan({ ...plan, conversationId: reference.conversationId });
      if (reference.conversationId) {
        await queryClient.invalidateQueries({ queryKey: ["sessionMessages", reference.conversationId] });
      }
      toast.success("Plano cancelado. Nenhuma alteração foi realizada.");
      close();
    } catch {
      toast.error("Não foi possível cancelar este plano.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(reference)} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        className="agenda-modal-surface max-w-[620px] gap-0 overflow-hidden rounded-[28px] border p-0 motion-reduce:duration-0"
        contentContainerClassName="z-[240]"
        overlayClassName="z-[239] motion-reduce:duration-0"
        aria-busy={isLoading || isSubmitting}
      >
        <DialogHeader className="agenda-modal-header border-b px-6 py-5">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {String(summary.title || "Revisar alteração do agendamento")}
          </DialogTitle>
          <DialogDescription>
            Confira o resumo atualizado pelo servidor. A confirmação autoriza somente esta versão.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] space-y-3 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex min-h-56 items-center justify-center" aria-label="Carregando plano">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
            </div>
          ) : error || terminalMessage ? (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-relaxed text-foreground">
              {error || terminalMessage}
            </div>
          ) : plan ? (
            <>
              <ReviewRow
                icon={CalendarClock}
                label="Agenda"
                value={isAgendaV2
                  ? `${Number(summary.totalOccurrences || 1)} sessão(ões) na série`
                  : String(agenda.patientName || "Paciente selecionado")}
                detail={isAgendaV2
                  ? `${formatDateTime(summary.firstStartTime)} até ${formatDateTime(summary.lastStartTime)}`
                  : `${formatDateTime(agenda.startTime)} · ${Number(agenda.occurrenceCount || 1)} ocorrência(s)`}
              />
              <ReviewRow
                icon={CircleDollarSign}
                label="Financeiro e pacote"
                value={String(financial.impactMessage || "Sem ajuste externo previsto.")}
                detail={`Modelo: ${String(financial.mode || "sem financeiro")}`}
              />
              {!isAgendaV2 ? (
                <>
                  <ReviewRow
                    icon={FileCheck2}
                    label="Fiscal"
                    value={fiscal.automationEnabled ? "Automação fiscal considerada" : "Sem automação fiscal"}
                    detail={`${Number(fiscal.potentialDocuments || 0)} documento(s) potencial(is)`}
                  />
                  <ReviewRow
                    icon={ShieldCheck}
                    label="Política congelada"
                    value="Direitos e prazos serão revalidados na execução"
                    detail={`Cancelamento: ${String(policy.freeCancellationHours ?? "configurado")}h · Reagendamento: ${String(policy.freeRescheduleHours ?? "configurado")}h`}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="agenda-modal-footer border-t p-4">
          {plan?.status === "awaiting_confirmation" ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-xl px-5"
              disabled={isSubmitting}
              onClick={() => void cancel()}
            >
              Cancelar plano
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11 rounded-xl px-5" disabled={isSubmitting} onClick={close}>
            Fechar
          </Button>
          <Button type="button" className="agenda-primary-action min-h-11 rounded-xl px-5 font-semibold" disabled={!canConfirm} onClick={() => void confirm()}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
            Confirmar esta versão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="agenda-liquid-card rounded-2xl border p-4">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
      </div>
    </section>
  );
}
