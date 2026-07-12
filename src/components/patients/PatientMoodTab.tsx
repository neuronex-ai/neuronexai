import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useReducedMotion } from "framer-motion";
import { Angry, ChevronLeft, ChevronRight, Frown, History, Laugh, Meh, MessageSquare, Smile, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientMoodLogs } from "@/hooks/use-patient-mood-logs";
import { cn } from "@/lib/utils";

interface PatientMoodTabProps {
  patientId: string;
}

const MOOD_PAGE_SIZE = 9;
const CHART_POINT_LIMIT = 30;

const moodConfig: Record<number, { label: string; icon: typeof Smile; color: string; bg: string; border: string }> = {
  1: { label: "Péssimo", icon: Angry, color: "#e11d48", bg: "bg-rose-500/10", border: "border-rose-500/18" },
  2: { label: "Ruim", icon: Frown, color: "#ea580c", bg: "bg-orange-500/10", border: "border-orange-500/18" },
  3: { label: "Neutro", icon: Meh, color: "#71717a", bg: "bg-zinc-500/10", border: "border-zinc-500/18" },
  4: { label: "Bem", icon: Smile, color: "#059669", bg: "bg-emerald-500/10", border: "border-emerald-500/18" },
  5: { label: "Ótimo", icon: Laugh, color: "#047857", bg: "bg-emerald-500/10", border: "border-emerald-500/18" },
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) => {
  const score = payload?.[0]?.value;
  if (!active || typeof score !== "number") return null;

  const config = moodConfig[score] || moodConfig[3];
  const Icon = config.icon;

  return (
    <div className="desktop-retina-modal rounded-[18px] border border-border/55 bg-popover/96 p-3 shadow-xl">
      <p className="mb-2 border-b border-border/45 pb-2 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", config.bg)}>
          <Icon className="h-4 w-4" style={{ color: config.color }} aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-foreground">{config.label}</span>
      </div>
    </div>
  );
};

export const PatientMoodTab = ({ patientId }: PatientMoodTabProps) => {
  const { data: logs = [], isLoading } = usePatientMoodLogs(patientId);
  const shouldReduceMotion = useReducedMotion();
  const [page, setPage] = useState(1);

  const orderedLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [logs],
  );
  const chartData = useMemo(
    () => [...orderedLogs]
      .slice(0, CHART_POINT_LIMIT)
      .reverse()
      .map((log) => ({
        date: format(new Date(log.created_at), "dd/MM"),
        fullDate: format(new Date(log.created_at), "dd 'de' MMMM", { locale: ptBR }),
        score: log.mood_score,
      })),
    [orderedLogs],
  );
  const averageMood = useMemo(
    () => (logs.length ? logs.reduce((total, log) => total + log.mood_score, 0) / logs.length : 0),
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
      <div className="desktop-retina-panel flex min-h-[400px] flex-col items-center justify-center rounded-[28px] border border-dashed border-border/55 bg-card/58 p-8 text-center">
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
      <section className="desktop-retina-panel overflow-hidden rounded-[28px] border border-border/45 bg-card/68 p-5 md:p-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="desktop-retina-inset flex h-11 w-11 items-center justify-center rounded-2xl border border-border/45 text-foreground">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Tendência emocional</h3>
              <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-muted-foreground">Variação dos registros de humor</p>
            </div>
          </div>
          <div className="desktop-retina-inset flex items-center divide-x divide-border/50 rounded-[18px] border border-border/45 bg-background/55">
            <div className="px-4 py-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">Média</p>
              <p className="text-xl font-black tracking-[-0.04em] text-foreground">{averageMood.toFixed(1)}</p>
            </div>
            <div className="px-4 py-2.5">
              <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">Registros</p>
              <p className="text-xl font-black tracking-[-0.04em] text-foreground">{logs.length}</p>
            </div>
          </div>
        </header>

        <div className="desktop-retina-inset h-[300px] w-full rounded-[24px] border border-border/40 bg-background/52 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 16, right: 22, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border) / 0.55)" vertical={false} />
              <XAxis dataKey="date" stroke="transparent" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }} dy={12} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="transparent" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--foreground) / 0.12)", strokeWidth: 1 }} />
              <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="6 6" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--foreground))"
                strokeWidth={3}
                dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2, stroke: "hsl(var(--foreground))" }}
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--foreground))", stroke: "hsl(var(--background))" }}
                isAnimationActive={!shouldReduceMotion}
                animationDuration={360}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="desktop-retina-panel overflow-hidden rounded-[28px] border border-border/45 bg-card/62">
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
                className="desktop-retina-inset rounded-[22px] border border-border/40 bg-background/58 p-5"
                style={{ contentVisibility: "auto", containIntrinsicSize: "190px" }}
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-[15px] border", config.bg, config.border)}>
                    <Icon className="h-5 w-5" style={{ color: config.color }} aria-hidden="true" />
                  </span>
                  <time className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground" dateTime={log.created_at}>
                    {format(new Date(log.created_at), "dd/MM • HH:mm")}
                  </time>
                </div>
                <h4 className="text-sm font-semibold text-foreground">{config.label}</h4>
                <div className="mt-3 min-h-16 rounded-[16px] border border-border/35 bg-muted/24 p-3.5">
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
