import { Button } from '@/components/ui/button';
import {
  isAttendedAppointmentStatus,
  isCancelledAppointmentStatus,
} from '@/lib/appointment-status';
import { getInitials } from '@/lib/appointment-utils';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/types';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  MapPin,
  Play,
  Video,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PatientRecapSidebar } from './PatientRecapSidebar';

interface UpcomingSessionsPanelProps {
  upcomingSessions: Appointment[];
  activeAppointment: Appointment | undefined;
  isLoading: boolean;
  startSession: (appointmentId: string) => void;
}

const isUpcoming = (session: Appointment, now: number) =>
  !isAttendedAppointmentStatus(session.status, session.notes) &&
  !isCancelledAppointmentStatus(session.status, session.notes) &&
  new Date(session.end_time || session.start_time).getTime() >= now;

const SessionIdentity = ({ session }: { session: Appointment }) => (
  <div className="flex min-w-0 items-center gap-3">
    <div className="teleconsultation-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-xs font-black text-foreground">
      {getInitials(session.patient_name || 'Paciente')}
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-bold tracking-[-0.02em] text-foreground">
        {session.patient_name || 'Paciente'}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        {format(new Date(session.start_time), 'dd/MM · HH:mm')}
      </p>
    </div>
  </div>
);

export const UpcomingSessionsPanel = ({
  upcomingSessions,
  isLoading,
  startSession,
}: UpcomingSessionsPanelProps) => {
  const [selectedSession, setSelectedSession] = useState<Appointment | null>(null);

  const { nextSession, futureSessions, pastSessions } = useMemo(() => {
    const now = Date.now();
    const sorted = [...upcomingSessions].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
    const future = sorted.filter((session) => isUpcoming(session, now));
    const history = sorted
      .filter(
        (session) =>
          !isCancelledAppointmentStatus(session.status, session.notes) &&
          (isAttendedAppointmentStatus(session.status, session.notes) ||
            new Date(session.end_time || session.start_time).getTime() < now),
      )
      .reverse();

    return {
      nextSession: future[0] || null,
      futureSessions: future.slice(1),
      pastSessions: history.slice(0, 8),
    };
  }, [upcomingSessions]);

  const recapSession = selectedSession || nextSession;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Carregando teleconsultas">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="teleconsultation-shell relative z-10 h-full min-h-0 w-full px-5 pb-5 pt-2 md:px-7 md:pb-7 md:pt-3 xl:px-8">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[1760px] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:gap-6">
        <main className="teleconsultation-scroll min-h-0 overflow-y-auto pr-1.5 xl:pr-2" aria-label="Teleconsultas">
          <div className="space-y-5 pb-4">
            <header className="teleconsultation-surface flex min-h-[88px] items-center justify-between gap-5 rounded-[28px] px-6 py-5 sm:px-7">
              <div className="flex min-w-0 items-center gap-[18px]">
                <div className="teleconsultation-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] text-foreground/75">
                  <Video className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Atendimento clínico
                  </p>
                  <h1 className="mt-1 text-xl font-black tracking-[-0.035em] text-foreground sm:text-2xl">
                    Teleconsulta
                  </h1>
                </div>
              </div>
              <div className="teleconsultation-inset rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {upcomingSessions.length} {upcomingSessions.length === 1 ? 'sessão' : 'sessões'}
              </div>
            </header>

            {nextSession ? (
              <section className="teleconsultation-surface overflow-hidden rounded-[32px] p-6 sm:p-8" aria-labelledby="next-session-title">
                <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="teleconsultation-inset inline-flex items-center rounded-full px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-foreground/75">
                        Próxima sessão
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(nextSession.start_time), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <h2 id="next-session-title" className="mt-6 truncate text-4xl font-black tracking-[-0.055em] text-foreground sm:text-5xl">
                      {nextSession.patient_name || 'Paciente'}
                    </h2>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <span className="teleconsultation-inset inline-flex min-h-11 items-center gap-2 rounded-[15px] px-4 text-sm font-bold text-foreground">
                        <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {format(new Date(nextSession.start_time), 'HH:mm')}
                      </span>
                      <span className="teleconsultation-inset inline-flex min-h-11 items-center gap-2 rounded-[15px] px-4 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
                        {nextSession.type === 'online' ? (
                          <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <MapPin className="h-4 w-4 text-rose-500" aria-hidden="true" />
                        )}
                        {nextSession.type === 'online' ? 'Teleconsulta' : 'Presencial'}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => startSession(nextSession.id)}
                    className="teleconsultation-action h-14 min-w-[190px] shrink-0 rounded-[18px] bg-foreground px-8 text-[10px] font-black uppercase tracking-[0.17em] text-background shadow-none"
                  >
                    <Play className="mr-2.5 h-4 w-4 fill-current" aria-hidden="true" />
                    Preparar sessão
                  </Button>
                </div>
              </section>
            ) : (
              <section className="teleconsultation-surface flex min-h-56 flex-col items-center justify-center rounded-[32px] px-8 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/45" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-black tracking-[-0.03em]">Agenda livre</h2>
                <p className="mt-1 text-sm text-muted-foreground">Nenhuma sessão clínica agendada neste período.</p>
              </section>
            )}

            <div className="teleconsultation-deferred-section grid gap-5 lg:grid-cols-2">
              <section className="teleconsultation-surface min-h-[320px] rounded-[30px] p-6 sm:p-7" aria-labelledby="future-sessions-title">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="future-sessions-title" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em] text-foreground">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Sessões futuras
                  </h2>
                  <span className="text-[10px] font-bold text-muted-foreground">{futureSessions.length}</span>
                </div>
                <div className="mt-5 space-y-3">
                  {futureSessions.length ? futureSessions.slice(0, 6).map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => startSession(session.id)}
                      className="teleconsultation-inset teleconsultation-action flex min-h-[76px] w-full items-center justify-between gap-4 rounded-[20px] p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <SessionIdentity session={session} />
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  )) : (
                    <p className="rounded-[20px] border border-dashed border-border/50 px-4 py-10 text-center text-sm text-muted-foreground">
                      Nada agendado depois da próxima sessão.
                    </p>
                  )}
                </div>
              </section>

              <section className="teleconsultation-surface min-h-[320px] rounded-[30px] p-6 sm:p-7" aria-labelledby="session-history-title">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="session-history-title" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em] text-foreground">
                    <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Histórico recente
                  </h2>
                  <span className="text-[10px] font-bold text-muted-foreground">{pastSessions.length}</span>
                </div>
                <div className="mt-5 space-y-3">
                  {pastSessions.length ? pastSessions.map((session) => {
                    const isSelected = selectedSession?.id === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSession(isSelected ? null : session)}
                        aria-pressed={isSelected}
                        className={cn(
                          'teleconsultation-action flex min-h-[76px] w-full items-center justify-between gap-4 rounded-[20px] border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'border-foreground/15 bg-foreground/[0.07]'
                            : 'teleconsultation-inset',
                        )}
                      >
                        <SessionIdentity session={session} />
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Concluída" />
                      </button>
                    );
                  }) : (
                    <p className="rounded-[20px] border border-dashed border-border/50 px-4 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma sessão concluída recentemente.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>

        <aside className="hidden min-h-0 xl:block" aria-label="Contexto da sessão">
          <PatientRecapSidebar
            patientId={recapSession?.patient_id}
            patientName={recapSession?.patient_name}
            className="h-full"
          />
        </aside>
      </div>
    </div>
  );
};
