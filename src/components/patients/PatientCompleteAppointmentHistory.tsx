"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  History,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type PatientAppointmentHistoryItem,
  usePatientCompleteAppointmentHistory,
} from "@/hooks/use-patient-complete-appointment-history";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (value: string | null, pattern = "dd 'de' MMMM 'de' yyyy, HH:mm") =>
  value ? format(new Date(value), pattern, { locale: ptBR }) : "Data não informada";

const toneByEvent = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  cancel: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  archive: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  reschedule: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  financial: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  email: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  default: "bg-muted/35 text-muted-foreground",
} as const;

export function PatientCompleteAppointmentHistory({ patientId }: { patientId: string }) {
  const query = usePatientCompleteAppointmentHistory(patientId);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  if (query.isLoading) {
    return (
      <section className="patient-record-panel space-y-3 rounded-[30px] border p-5 md:p-6" aria-busy="true" aria-label="Carregando histórico completo">
        <Skeleton className="h-12 w-64 rounded-2xl motion-reduce:animate-none" />
        <Skeleton className="h-40 w-full rounded-[24px] motion-reduce:animate-none" />
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="patient-record-panel flex min-h-52 flex-col items-center justify-center rounded-[30px] border p-8 text-center">
        <History className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold text-foreground">Não foi possível carregar o histórico completo.</p>
        <p className="mt-1 text-xs text-muted-foreground">Os demais dados do prontuário permanecem disponíveis.</p>
        <Button type="button" variant="outline" onClick={() => void query.refetch()} className="mt-5 min-h-11 rounded-xl px-5">
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      </section>
    );
  }

  return (
    <section className="patient-record-panel overflow-hidden rounded-[30px] border">
      <header className="flex flex-col gap-3 border-b border-border/45 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <span className="clinical-inset-surface flex h-11 w-11 items-center justify-center rounded-[16px] border text-muted-foreground">
            <History className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-black tracking-[-0.025em] text-foreground">Histórico completo</h3>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {total} {total === 1 ? "agendamento preservado" : "agendamentos preservados"}
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-muted/35 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          Inclui itens removidos da agenda
        </span>
      </header>

      {items.length ? (
        <div className="space-y-3 p-4 md:p-5">
          {items.map((item, index) => {
            const expanded = expandedIndex === index;
            return (
              <AppointmentHistoryCard
                key={`${item.occurredAt || "sem-data"}-${index}`}
                item={item}
                expanded={expanded}
                onToggle={() => setExpandedIndex(expanded ? null : index)}
              />
            );
          })}

          {query.hasNextPage ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                className="desktop-retina-interactive min-h-11 rounded-xl px-5"
              >
                {query.isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                Carregar registros anteriores
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
          <CalendarClock className="h-7 w-7 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 text-sm font-semibold text-foreground">Nenhum agendamento registrado</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Quando houver sessões, o histórico operacional, financeiro e clínico relacionado aparecerá aqui.
          </p>
        </div>
      )}
    </section>
  );
}

function AppointmentHistoryCard({
  item,
  expanded,
  onToggle,
}: {
  item: PatientAppointmentHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const facts = [
    { icon: ShieldCheck, label: "Confirmação", value: item.confirmation },
    { icon: Clock3, label: "Estado", value: item.lifecycle },
    item.attendance ? { icon: UserRound, label: "Comparecimento", value: item.attendance } : null,
    item.reschedules ? { icon: RefreshCcw, label: "Reagendamentos", value: String(item.reschedules) } : null,
    item.package ? { icon: PackageCheck, label: item.package.name, value: item.package.coverage } : null,
    item.financial ? { icon: CircleDollarSign, label: "Financeiro", value: `${item.financial.status} · ${money.format(item.financial.amount)}` } : null,
    item.nfse ? { icon: FileCheck2, label: "NFS-e", value: `${item.nfse.status}${item.nfse.number ? ` · Nota ${item.nfse.number}` : ""}` } : null,
    item.teleconsultation ? { icon: Video, label: "Teleconsulta", value: item.teleconsultation } : null,
    item.clinicalSummary ? { icon: Stethoscope, label: "Registro clínico", value: item.clinicalSummary } : null,
  ].filter(Boolean) as Array<{ icon: typeof ShieldCheck; label: string; value: string }>;

  return (
    <article className={cn("patient-record-card overflow-hidden rounded-[24px] border", item.archived && "border-amber-500/20")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="desktop-retina-interactive flex min-h-24 w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 items-center gap-4">
          <span className={cn(
            "clinical-inset-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border text-muted-foreground",
            item.archived && "border-amber-500/18 bg-amber-500/8 text-amber-500",
          )}>
            {item.archived ? <Archive className="h-[18px] w-[18px]" /> : <CalendarClock className="h-[18px] w-[18px]" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black tracking-tight text-foreground">
              {formatDateTime(item.occurredAt)}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{item.modality}</span>
              <span aria-hidden="true">•</span>
              <span>{item.confirmation}</span>
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {item.archived ? (
            <span className="hidden rounded-full bg-amber-500/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300 sm:inline-flex">
              {item.archiveLabel}
            </span>
          ) : null}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border/45 px-5 pb-5 pt-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {facts.map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className="clinical-inset-surface rounded-[18px] border p-3.5">
                <div className="flex items-start gap-3">
                  <fact.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">{fact.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-foreground">{fact.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {item.reason || item.policy ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {item.reason ? (
                <div className="rounded-[18px] border border-amber-500/18 bg-amber-500/8 p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-300">Motivo registrado</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-foreground">{item.reason}</p>
                </div>
              ) : null}
              {item.policy ? (
                <div className="clinical-inset-surface rounded-[18px] border p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">Política congelada nesta sessão</p>
                  <p className="mt-2 text-xs font-semibold text-foreground">{item.policy.consequence}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Cancelamento sem perda até {formatDateTime(item.policy.cancellationDeadline, "dd/MM/yyyy, HH:mm")}.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Linha do tempo humanizada</p>
            {item.events.length ? (
              <ol className="space-y-2">
                {item.events.map((event, eventIndex) => (
                  <li key={`${event.occurredAt}-${eventIndex}`} className="clinical-inset-surface rounded-[18px] border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em]", toneByEvent[event.visualKind] || toneByEvent.default)}>
                          {event.title}
                        </span>
                        <p className="mt-2 text-xs font-semibold text-foreground">{event.actorName} · {event.channelName}</p>
                        {event.statusChange ? <p className="mt-1 text-[10px] font-medium text-muted-foreground">{event.statusChange}</p> : null}
                        {event.detail ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{event.detail}</p> : null}
                      </div>
                      <time className="shrink-0 text-[9px] font-semibold text-muted-foreground" dateTime={event.occurredAt}>
                        {formatDateTime(event.occurredAt, "dd/MM/yyyy, HH:mm")}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-[18px] border border-dashed border-border/55 p-4 text-xs text-muted-foreground">
                Nenhum evento adicional foi registrado para esta ocorrência.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
