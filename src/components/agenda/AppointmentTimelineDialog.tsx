import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Banknote,
  CalendarCheck2,
  CheckCircle2,
  CircleDot,
  Loader2,
  Mail,
  RotateCcw,
  XCircle,
} from "lucide-react";

import type { AppointmentTimelineEvent } from "@/hooks/use-appointment-lifecycle";
import { cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  appointment_created: "Agendamento criado",
  invitation_sent: "Convite enviado por e-mail",
  awaiting_confirmation: "Aguardando confirmação",
  invitation_opened: "Paciente abriu o convite",
  patient_confirmed: "Paciente confirmou",
  cancellation_requested: "Cancelamento solicitado",
  patient_cancelled: "Paciente cancelou",
  appointment_cancelled: "Agendamento cancelado",
  patient_requested_reschedule: "Paciente solicitou reagendamento",
  psychologist_approved_reschedule: "Reagendamento aprovado",
  psychologist_rejected_reschedule: "Reagendamento recusado",
  appointment_rescheduled: "Data oficial atualizada",
  clinical_status_changed: "Status clínico atualizado",
  consultation_started: "Consulta iniciada",
  consultation_completed: "Consulta realizada",
  consultation_closed: "Consulta encerrada",
  financial_entry_created: "Cobrança criada",
  financial_launch_created: "Lançamento financeiro criado",
  charge_created: "Cobrança vinculada",
  charge_cancelled: "Cobrança cancelada",
  boleto_generated: "Boleto gerado",
  boleto_viewed: "Paciente visualizou o boleto",
  charge_viewed: "Paciente visualizou a cobrança",
  pix_generated: "PIX gerado",
  payment_paid: "Cobrança paga",
  payment_overdue: "Cobrança vencida",
  payment_expired: "Cobrança expirada",
  payment_failed: "Falha na cobrança",
  payment_refunded: "Pagamento estornado",
  package_session_linked: "Sessão vinculada ao pacote",
  cancellation_email_sent: "E-mail de cancelamento enviado",
  reschedule_approved_email_sent: "Novo horário enviado ao paciente",
  reschedule_rejected_email_sent: "Recusa enviada ao paciente",
  reschedule_decision_email_failed: "Falha ao enviar decisão por e-mail",
  reschedule_decision_email_skipped: "Decisão não enviada: paciente sem e-mail",
};

const ACTOR_LABELS: Record<string, string> = {
  psychologist: "Psicólogo",
  patient: "Paciente",
  system: "Sistema",
  edge_function: "Automação NeuroNex",
  provider: "Provedor financeiro",
};

const STATUS_LABELS: Record<string, string> = {
  created: "Criado",
  invitation_sent: "Convite enviado",
  awaiting_confirmation: "Aguardando confirmação",
  confirmed: "Confirmado",
  cancellation_requested: "Cancelamento solicitado",
  cancelled: "Cancelado",
  reschedule_requested: "Reagendamento solicitado",
  reschedule_approved: "Reagendamento aprovado",
  reschedule_rejected: "Reagendamento recusado",
  in_progress: "Em atendimento",
  completed: "Realizado",
  closed: "Encerrado",
};

const eventIcon = (eventType: string) => {
  if (eventType.includes("email") || eventType.includes("invitation")) return Mail;
  if (eventType.includes("cancel")) return XCircle;
  if (eventType.includes("reschedule")) return RotateCcw;
  if (
    eventType.includes("payment") ||
    eventType.includes("financial") ||
    eventType.includes("charge") ||
    eventType.includes("pix") ||
    eventType.includes("boleto")
  )
    return Banknote;
  if (
    eventType.includes("confirm") ||
    eventType.includes("completed") ||
    eventType.includes("closed")
  )
    return CheckCircle2;
  if (eventType.includes("created")) return CalendarCheck2;
  return CircleDot;
};

const eventTone = (eventType: string) => {
  if (eventType.includes("failed") || eventType.includes("cancel"))
    return "border-red-500/25 bg-red-500/10 text-red-600";
  if (
    eventType.includes("paid") ||
    eventType.includes("confirm") ||
    eventType.includes("approved") ||
    eventType.includes("completed")
  )
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-600";
  if (
    eventType.includes("request") ||
    eventType.includes("overdue") ||
    eventType.includes("rejected")
  )
    return "border-amber-500/25 bg-amber-500/10 text-amber-600";
  return "border-border/70 bg-muted/60 text-muted-foreground";
};

export function AppointmentTimelinePanel({
  appointmentId,
  events,
  isLoading,
  error,
}: {
  appointmentId: string;
  events: AppointmentTimelineEvent[];
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar sm:px-6"
      aria-label="Eventos do agendamento, dos mais recentes para os mais antigos"
    >
      {isLoading ? (
        <div
          className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Carregando histórico...
        </div>
      ) : null}
      {!isLoading && error ? (
        <div
          className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          O histórico ainda não está disponível. Verifique a conexão e tente novamente.
        </div>
      ) : null}
      {!isLoading && !error && events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum evento registrado.
        </div>
      ) : null}
      {!isLoading && !error && events.length ? (
        <ol
          className="relative space-y-0 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-border"
          aria-label="Timeline do agendamento"
        >
          {events.map((event) => {
            const Icon = eventIcon(event.event_type);
            return (
              <li
                key={event.id}
                className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 pb-6 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border",
                    eventTone(event.event_type),
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <article className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        {EVENT_LABELS[event.event_type] || event.event_type.replaceAll("_", " ")}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ACTOR_LABELS[event.actor_type] || event.actor_type} · {event.action_origin}
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground"
                      dateTime={event.created_at}
                    >
                      {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </time>
                  </div>
                  {event.from_status || event.to_status ? (
                    <p className="mt-3 text-xs font-medium text-muted-foreground">
                      {event.from_status
                        ? STATUS_LABELS[event.from_status] || event.from_status
                        : "—"}
                      <span className="mx-2" aria-hidden="true">
                        →
                      </span>
                      {event.to_status ? STATUS_LABELS[event.to_status] || event.to_status : "—"}
                    </p>
                  ) : null}
                  <details className="mt-3 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground">
                      Auditoria e metadados
                    </summary>
                    <dl className="mt-3 grid gap-2 break-all font-mono text-[11px] leading-relaxed">
                      <div>
                        <dt className="inline font-bold">Evento:</dt>{" "}
                        <dd className="inline">{event.id}</dd>
                      </div>
                      <div>
                        <dt className="inline font-bold">Agendamento:</dt>{" "}
                        <dd className="inline">{appointmentId}</dd>
                      </div>
                      <div>
                        <dt className="inline font-bold">Usuário:</dt>{" "}
                        <dd className="inline">
                          {event.actor_user_id || "não autenticado/sistema"}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-bold">Metadados:</dt>{" "}
                        <dd className="mt-1 whitespace-pre-wrap">
                          {JSON.stringify(event.metadata || {}, null, 2)}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </article>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
