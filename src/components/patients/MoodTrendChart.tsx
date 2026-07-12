import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useReducedMotion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

export interface MoodTrendLog {
  mood_score: number;
  created_at: string | null;
}

interface MoodTrendChartProps {
  logs: readonly MoodTrendLog[];
  audience?: "patient" | "professional";
  className?: string;
}

const moodLabels: Record<number, { label: string; tone: string }> = {
  1: { label: "Muito difícil", tone: "border-rose-500/20 bg-rose-500/10 text-rose-500" },
  2: { label: "Difícil", tone: "border-orange-500/20 bg-orange-500/10 text-orange-500" },
  3: { label: "Neutro", tone: "border-zinc-500/20 bg-zinc-500/10 text-zinc-500" },
  4: { label: "Bem", tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" },
  5: { label: "Muito bem", tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" },
};

const MoodTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string | number;
}) => {
  const score = Number(payload?.[0]?.value);
  if (!active || !Number.isFinite(score)) return null;

  const meta = moodLabels[score] || moodLabels[3];
  return (
    <div className="desktop-retina-modal rounded-[18px] border border-border/55 bg-popover/96 p-3 shadow-xl">
      <p className="mb-2 border-b border-border/45 pb-2 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <span className={cn("inline-flex rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em]", meta.tone)}>
        {meta.label}
      </span>
    </div>
  );
};

export function MoodTrendChart({ logs, audience = "professional", className }: MoodTrendChartProps) {
  const shouldReduceMotion = useReducedMotion();
  const validRows = useMemo(
    () => logs
      .filter((log): log is MoodTrendLog & { created_at: string } => (
        Boolean(log.created_at) && Number.isFinite(new Date(log.created_at || "").getTime())
      ))
      .slice()
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()),
    [logs],
  );
  const rows = useMemo(() => validRows.slice(-14), [validRows]);
  const average = useMemo(
    () => validRows.length
      ? validRows.reduce((total, log) => total + Number(log.mood_score || 0), 0) / validRows.length
      : 0,
    [validRows],
  );
  const chartData = useMemo(
    () => rows.map((log) => ({
      date: format(new Date(log.created_at), "dd/MM"),
      fullDate: format(new Date(log.created_at), "dd 'de' MMMM", { locale: ptBR }),
      score: log.mood_score,
    })),
    [rows],
  );

  const emptyMessage = audience === "patient"
    ? "Com dois registros ou mais, seu histórico emocional começa a desenhar uma linha do tempo."
    : "Com dois registros ou mais, a tendência emocional começa a desenhar uma linha do tempo.";

  return (
    <section className={cn("patient-record-panel relative overflow-hidden rounded-[30px] border p-5 md:p-7", className)}>
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-foreground/[0.025] blur-[100px]" />
      <header className="relative z-10 mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="desktop-retina-inset flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/45 bg-background/52 text-foreground">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xl font-black tracking-[-0.035em] text-foreground">Tendência emocional</h3>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.19em] text-muted-foreground">Análise da variação de humor</p>
          </div>
        </div>
        <div className="desktop-retina-inset flex items-center gap-1 rounded-[18px] border border-border/45 bg-background/48 p-1">
          <div className="rounded-[14px] border border-border/45 bg-background/75 px-4 py-2.5 shadow-sm">
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">Média geral</p>
            <p className="text-xl font-black tracking-[-0.04em] text-foreground">{average.toFixed(1)}</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">Registros</p>
            <p className="text-xl font-black tracking-[-0.04em] text-foreground">{validRows.length}</p>
          </div>
        </div>
      </header>

      <figure
        className="desktop-retina-inset relative z-10 h-[300px] w-full rounded-[26px] border border-border/40 bg-background/52 p-5"
        aria-label={`Tendência emocional baseada em ${validRows.length} registros`}
      >
        {chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={chartData} margin={{ top: 16, right: 22, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.12)" vertical={false} />
              <XAxis dataKey="date" stroke="transparent" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }} dy={12} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="transparent" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontWeight: 700 }} />
              <Tooltip content={<MoodTooltip />} cursor={{ stroke: "hsl(var(--foreground) / 0.12)", strokeWidth: 1 }} />
              <ReferenceLine y={3} stroke="hsl(var(--border))" strokeDasharray="6 6" />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={5}
                dot={{ r: 6, fill: "#6366f1", strokeWidth: 4, stroke: "#fff" }}
                activeDot={{ r: 8, strokeWidth: 0, fill: "#4f46e5" }}
                isAnimationActive={!shouldReduceMotion}
                animationDuration={shouldReduceMotion ? 0 : 900}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        <figcaption className="sr-only">Pontuações de humor de um a cinco ao longo do tempo.</figcaption>
      </figure>
    </section>
  );
}
