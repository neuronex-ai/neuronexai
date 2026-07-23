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

import type {
  AppointmentTimelineItem,
  AppointmentTimelineVisualKind,
} from "@/lib/appointment-timeline";
import { cn } from "@/lib/utils";

const eventIcon = (kind: AppointmentTimelineVisualKind) => {
  if (kind === "email") return Mail;
  if (kind === "cancel") return XCircle;
  if (kind === "reschedule") return RotateCcw;
  if (kind === "financial") return Banknote;
  if (kind === "success") return CheckCircle2;
  return CalendarCheck2;
};

const eventTone = (kind: AppointmentTimelineVisualKind) => {
  if (kind === "cancel") return "bg-red-500/10 text-red-600 dark:text-red-300";
  if (kind === "success") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  }
  if (kind === "reschedule") {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
  }
  return "bg-muted/60 text-muted-foreground";
};

export function AppointmentTimelinePanel({
  events,
  isLoading,
  error,
}: {
  events: AppointmentTimelineItem[];
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
        <div className="agenda-liquid-card rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum evento registrado.
        </div>
      ) : null}
      {!isLoading && !error && events.length ? (
        <ol
          className="relative space-y-0 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-border"
          aria-label="Timeline do agendamento"
        >
          {events.map((event, index) => {
            const Icon = event.visualKind === "default" ? CircleDot : eventIcon(event.visualKind);
            return (
              <li
                key={`${event.occurredAt}-${index}`}
                className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-4 pb-6 last:pb-0"
              >
                <div
                  className={cn(
                    "patient-status-icon relative z-10 flex h-10 w-10 items-center justify-center rounded-[14px]",
                    eventTone(event.visualKind),
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <article className="agenda-liquid-card min-w-0 rounded-2xl border p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{event.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.actorName} · {event.channelName}
                      </p>
                    </div>
                    <time
                      className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground"
                      dateTime={event.occurredAt}
                    >
                      {format(new Date(event.occurredAt), "dd/MM/yyyy 'às' HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </time>
                  </div>
                  {event.statusChange ? (
                    <p className="mt-3 text-xs font-medium text-muted-foreground">
                      {event.statusChange}
                    </p>
                  ) : null}
                  {event.detail ? (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {event.detail}
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
