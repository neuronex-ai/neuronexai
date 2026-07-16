import { useState } from "react";
import { usePatientGoals } from "@/hooks/use-patient-goals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, Plus, Trash2, Target, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface PatientGoalsTabProps {
  patientId: string;
}

export const PatientGoalsTab = ({ patientId }: PatientGoalsTabProps) => {
  const { goals, isLoading, addGoal, toggleGoal, deleteGoal, isAdding } = usePatientGoals(patientId);
  const [newDescription, setNewDescription] = useState("");
  const [date, setDate] = useState<Date>();

  const handleAdd = () => {
    if (!newDescription.trim()) return;
    addGoal({ description: newDescription, dueDate: date });
    setNewDescription("");
    setDate(undefined);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-2xl bg-muted/65 motion-reduce:animate-none" />
        <Skeleton className="h-16 w-full rounded-2xl bg-muted/65 motion-reduce:animate-none" />
        <Skeleton className="h-16 w-full rounded-2xl bg-muted/65 motion-reduce:animate-none" />
      </div>
    );
  }

  const completedCount = goals?.filter(g => g.is_completed).length || 0;
  const totalCount = goals?.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-5 pb-8">
      {/* Header / Progress - Redesigned Layout */}
      <div className="desktop-retina-panel relative overflow-hidden rounded-[28px] border border-border/45 bg-card/68 p-6">

        {/* Circular Progress - Absolute Positioned at Top Center */}
        <div className="absolute right-6 top-1/2 z-20 -translate-y-1/2">
          <div className="desktop-retina-inset relative flex h-16 w-16 items-center justify-center rounded-[22px] border border-border/45 bg-background/62 p-1.5">
            <svg className="w-full h-full -rotate-90 drop-shadow-lg" viewBox="0 0 36 36">
              <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path
                className="text-primary transition-all duration-1000 ease-out"
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
            <h3 className="text-xl font-bold text-foreground tracking-tight leading-none">Progresso Terapêutico</h3>
            <p className="text-[13px] text-muted-foreground font-medium opacity-60">
              <span className="text-foreground font-bold">{completedCount}</span> de <span className="text-foreground font-bold">{totalCount}</span> objetivos concluídos
            </p>
          </div>

          <div className="flex items-center">
            <span className="text-4xl font-black text-foreground tracking-tighter drop-shadow-sm">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Add New Goal Input */}
      <div className="flex gap-3">
        <div className="desktop-retina-inset flex h-14 flex-1 items-center rounded-2xl border border-border/45 bg-background/58 px-5 transition-colors focus-within:border-border/80 focus-within:bg-background/78">
          <Input
            placeholder="Digite uma nova meta ou tarefa..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="border-none bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/40 h-full p-0 text-sm text-foreground"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-9 h-9 rounded-xl hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors ml-2",
                  date && "text-primary bg-primary/10 hover:bg-primary/20"
                )}
                title="Adicionar prazo"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="desktop-retina-modal w-auto rounded-[22px] border-border/55 bg-popover/96 p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
        <Button onClick={handleAdd} disabled={isAdding || !newDescription.trim()} size="icon" className="desktop-retina-interactive h-14 w-14 flex-shrink-0 rounded-2xl bg-foreground text-background hover:bg-foreground/88">
          {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6 stroke-[3]" />}
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {goals?.length === 0 ? (
          <div className="desktop-retina-panel flex flex-col items-center justify-center rounded-[26px] border border-dashed border-border/50 bg-card/54 py-16 text-muted-foreground/70">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma meta definida.</p>
            <p className="text-xs mt-1 opacity-60">Comece adicionando objetivos para o paciente.</p>
          </div>
        ) : (
          goals?.map((goal) => (
            <div
              key={goal.id}
              className={cn(
                "desktop-retina-inset group flex items-center justify-between rounded-[22px] border p-5 transition-colors duration-300",
                goal.is_completed
                  ? "bg-emerald-500/[0.02] border-emerald-500/10"
                  : "border-border/40 bg-background/58 hover:border-border/75 hover:bg-background/76"
              )}
              style={{ contentVisibility: "auto", containIntrinsicSize: "82px" }}
            >
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <button
                  onClick={() => toggleGoal({ id: goal.id, isCompleted: !goal.is_completed })}
                  className="focus:outline-none mt-0.5 flex-shrink-0 transition-transform active:scale-90"
                >
                  {goal.is_completed ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-border/20 transition-colors hover:border-foreground/35 hover:bg-foreground/5 dark:border-zinc-700 dark:hover:bg-zinc-900" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium transition-all leading-snug",
                    goal.is_completed ? "text-muted-foreground line-through decoration-muted-foreground/20" : "text-foreground/90"
                  )}>
                    {goal.description}
                  </p>
                  {goal.due_date && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-wide">
                      <CalendarIcon className="h-3 w-3 opacity-70" />
                      <span>{format(new Date(goal.due_date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all rounded-xl flex-shrink-0 ml-2"
                onClick={() => deleteGoal(goal.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
