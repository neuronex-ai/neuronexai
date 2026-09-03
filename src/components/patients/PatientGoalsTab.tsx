import { useEffect, useMemo, useState } from "react";
import { usePatientGoals } from "@/hooks/use-patient-goals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, Target, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface PatientGoalsTabProps {
  patientId: string;
}

const GOALS_PAGE_SIZE = 8;

export const PatientGoalsTab = ({ patientId }: PatientGoalsTabProps) => {
  const { goals, isLoading, addGoal, toggleGoal, deleteGoal, isAdding } = usePatientGoals(patientId);
  const [newDescription, setNewDescription] = useState("");
  const [date, setDate] = useState<Date>();
  const [page, setPage] = useState(1);

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    addGoal({ description: newDescription, dueDate: date });
    setNewDescription("");
    setDate(undefined);
    setPage(1);
  };

  const completedCount = goals?.filter(g => g.is_completed).length || 0;
  const totalCount = goals?.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const orderedGoals = useMemo(
    () => [...(goals || [])].sort((left, right) => {
      if (left.is_completed !== right.is_completed) return left.is_completed ? 1 : -1;
      const leftDate = left.due_date ? new Date(`${left.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right.due_date ? new Date(`${right.due_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    }),
    [goals],
  );
  const totalPages = Math.max(1, Math.ceil(orderedGoals.length / GOALS_PAGE_SIZE));
  const visibleGoals = useMemo(
    () => orderedGoals.slice((page - 1) * GOALS_PAGE_SIZE, page * GOALS_PAGE_SIZE),
    [orderedGoals, page],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl bg-muted/65 motion-reduce:animate-none" />
        <Skeleton className="h-16 w-full rounded-2xl bg-muted/65 motion-reduce:animate-none" />
        <Skeleton className="h-16 w-full rounded-2xl bg-muted/65 motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="patient-record-panel relative overflow-hidden rounded-[28px] border border-border/45 bg-card/68 p-6">
        <div className="absolute right-6 top-1/2 z-20 -translate-y-1/2">
          <div className="desktop-retina-inset relative flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/45 bg-background/62 p-1.5">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path
                className="text-primary transition-[stroke-dasharray] duration-300"
                strokeDasharray={`${progress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="h-7 w-7 text-primary" />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-6 pr-24">
          <div className="space-y-1">
            <h3 className="text-xl font-bold leading-none tracking-tight text-foreground">Progresso Terapêutico</h3>
            <p className="text-[13px] font-medium text-muted-foreground">
              <span className="font-bold text-foreground">{completedCount}</span> de <span className="font-bold text-foreground">{totalCount}</span> objetivos concluídos
            </p>
          </div>
          <span className="text-4xl font-black tracking-tighter text-foreground">{progress}%</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="desktop-retina-inset flex h-14 flex-1 items-center rounded-2xl border border-border/45 bg-background/58 px-5 transition-colors focus-within:border-border/80 focus-within:bg-background/78">
          <Input
            placeholder="Digite uma nova meta ou tarefa..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="h-full border-none bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "ml-2 h-9 w-9 rounded-xl text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
                  date && "bg-primary/10 text-primary hover:bg-primary/20"
                )}
                title="Adicionar prazo"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="desktop-retina-modal w-auto rounded-[22px] border-border/55 bg-popover/96 p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={handleAdd} disabled={isAdding || !newDescription.trim()} size="icon" className="desktop-retina-interactive h-14 w-14 flex-shrink-0 rounded-2xl bg-foreground text-background hover:bg-foreground/88">
          {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6 stroke-[3]" />}
        </Button>
      </div>

      <section className="patient-record-panel overflow-hidden rounded-[26px] border">
        <header className="flex items-center justify-between gap-3 border-b border-border/45 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Metas do paciente</h3>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{totalCount} {totalCount === 1 ? "registro" : "registros"}</p>
          </div>
          {totalPages > 1 ? <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Página {page} de {totalPages}</span> : null}
        </header>

        {orderedGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/70">
            <Target className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Nenhuma meta definida.</p>
            <p className="mt-1 text-xs opacity-60">Comece adicionando objetivos para o paciente.</p>
          </div>
        ) : (
          <div className="space-y-3 p-4 md:p-5">
            {visibleGoals.map((goal) => (
              <div
                key={goal.id}
                className={cn(
                  "desktop-retina-inset group flex items-center justify-between rounded-[22px] border p-5 transition-colors duration-200",
                  goal.is_completed
                    ? "border-emerald-500/10 bg-emerald-500/[0.02]"
                    : "border-border/40 bg-background/58 hover:border-border/75 hover:bg-background/76"
                )}
                style={{ contentVisibility: "auto", containIntrinsicSize: "82px" }}
              >
                <div className="flex min-w-0 flex-1 items-start gap-5">
                  <button
                    type="button"
                    onClick={() => toggleGoal({ id: goal.id, isCompleted: !goal.is_completed })}
                    className="mt-0.5 flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={goal.is_completed ? "Marcar meta como pendente" : "Marcar meta como concluída"}
                  >
                    {goal.is_completed ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="block h-6 w-6 rounded-full border-2 border-border/30 transition-colors hover:border-foreground/35 hover:bg-foreground/5 dark:border-zinc-700" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      "text-sm font-medium leading-snug",
                      goal.is_completed ? "text-muted-foreground line-through decoration-muted-foreground/20" : "text-foreground/90"
                    )}>
                      {goal.description}
                    </p>
                    {goal.due_date && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <CalendarIcon className="h-3 w-3 opacity-70" />
                        <span>{format(new Date(goal.due_date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 h-9 w-9 flex-shrink-0 rounded-xl text-muted-foreground opacity-0 transition-[opacity,color,background-color] hover:bg-rose-500/10 hover:text-rose-400 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => deleteGoal(goal.id)}
                  aria-label="Excluir meta"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <footer className="flex items-center justify-between border-t border-border/45 px-4 py-3 md:px-5">
            <Button type="button" variant="outline" className="h-10 rounded-xl px-4" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Anterior
            </Button>
            <Button type="button" variant="outline" className="h-10 rounded-xl px-4" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Próxima
              <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </footer>
        ) : null}
      </section>
    </div>
  );
};