import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Angry, ChevronLeft, ChevronRight, Frown, History, Laugh, Meh, MessageSquare, Smile } from "lucide-react";

import { MoodTrendChart } from "@/components/patients/MoodTrendChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientMoodLogs } from "@/hooks/use-patient-mood-logs";
import { cn } from "@/lib/utils";

interface PatientMoodTabProps {
  patientId: string;
}

const MOOD_PAGE_SIZE = 9;

const moodConfig: Record<number, { label: string; icon: typeof Smile; color: string; bg: string }> = {
  1: { label: "Muito difícil", icon: Angry, color: "text-rose-600 dark:text-rose-300", bg: "bg-rose-500/10 dark:bg-rose-400/12" },
  2: { label: "Ruim", icon: Frown, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/11 dark:bg-amber-400/12" },
  3: { label: "Neutro", icon: Meh, color: "text-blue-600 dark:text-blue-300", bg: "bg-blue-500/9 dark:bg-blue-400/11" },
  4: { label: "Bem", icon: Smile, color: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-500/10 dark:bg-cyan-400/12" },
  5: { label: "Muito bem", icon: Laugh, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10 dark:bg-emerald-400/12" },
};

export const PatientMoodTab = ({ patientId }: PatientMoodTabProps) => {
  const { data: logs = [], isLoading } = usePatientMoodLogs(patientId);
  const [page, setPage] = useState(1);

  const orderedLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [logs],
  );
  const totalPages = Math.max(1, Math.ceil(orderedLogs.length / MOOD_PAGE_SIZE));
  const visibleLogs = useMemo(
    () => orderedLogs.slice((page - 1) * MOOD_PAGE_SIZE, page * MOOD_PAGE_SIZE),
    [orderedLogs, page],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Carregando histórico de humor">
        <Skeleton className="h-[390px] w-full rounded-[28px]" />
        <Skeleton className="h-56 w-full rounded-[28px]" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="patient-record-card flex min-h-[400px] flex-col items-center justify-center rounded-[28px] border border-dashed p-8 text-center">
        <span className="desktop-retina-inset mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] border border-border/45 text-muted-foreground">
          <Smile className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-foreground">Nenhum registro emocional</p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Os registros feitos pelo paciente aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <MoodTrendChart logs={logs} audience="professional" />

      <section className="patient-record-panel overflow-hidden rounded-[28px] border">
        <header className="flex items-center justify-between border-b border-border/45 px-5 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Histórico detalhado</h3>
          </div>
          {totalPages > 1 ? <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Página {page} de {totalPages}</span> : null}
        </header>

        <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
          {visibleLogs.map((log) => {
            const config = moodConfig[log.mood_score] || moodConfig[3];
            const Icon = config.icon;

            return (
              <article
                key={log.id}
                className="patient-record-card rounded-[22px] border p-5"
                style={{ contentVisibility: "auto", containIntrinsicSize: "190px" }}
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className={cn("patient-status-icon flex h-10 w-10 items-center justify-center rounded-[15px]", config.bg, config.color)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <time className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground" dateTime={log.created_at}>
                    {format(new Date(log.created_at), "dd/MM • HH:mm")}
                  </time>
                </div>
                <h4 className="text-sm font-semibold text-foreground">{config.label}</h4>
                <div className="clinical-inset-surface mt-3 min-h-16 rounded-[16px] border p-3.5">
                  {log.notes ? (
                    <div className="flex gap-2.5">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <p className="text-xs leading-relaxed text-muted-foreground">{log.notes}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/65">Sem comentário.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {totalPages > 1 ? (
          <footer className="flex items-center justify-between border-t border-border/45 bg-muted/18 px-4 py-3 md:px-5">
            <Button type="button" variant="outline" className="desktop-retina-interactive h-10 rounded-xl" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Anterior
            </Button>
            <Button type="button" variant="outline" className="desktop-retina-interactive h-10 rounded-xl" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Próxima <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </footer>
        ) : null}
      </section>
    </div>
  );
};
