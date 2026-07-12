"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";

import { AppModalShell, ModalHeroIcon } from "@/components/ui/app-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { id: "0", label: "Domingo", short: "Dom" },
  { id: "1", label: "Segunda-feira", short: "Seg" },
  { id: "2", label: "Terça-feira", short: "Ter" },
  { id: "3", label: "Quarta-feira", short: "Qua" },
  { id: "4", label: "Quinta-feira", short: "Qui" },
  { id: "5", label: "Sexta-feira", short: "Sex" },
  { id: "6", label: "Sábado", short: "Sáb" },
];

type WorkingDayHours = { enabled: boolean; start: string; end: string };
type WorkingHours = Record<string, WorkingDayHours>;

const DEFAULT_WORKING_HOURS: WorkingHours = {
  "0": { enabled: false, start: "08:00", end: "12:00" },
  "1": { enabled: true, start: "08:00", end: "19:00" },
  "2": { enabled: true, start: "08:00", end: "19:00" },
  "3": { enabled: true, start: "08:00", end: "19:00" },
  "4": { enabled: true, start: "08:00", end: "19:00" },
  "5": { enabled: true, start: "08:00", end: "19:00" },
  "6": { enabled: false, start: "08:00", end: "12:00" },
};

export const AgendaSettingsModal = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({ ...DEFAULT_WORKING_HOURS });

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("working_hours").eq("id", user.id).single();
      if (error) {
        console.error("Error loading settings:", error);
        setWorkingHours({ ...DEFAULT_WORKING_HOURS });
      } else if (data?.working_hours && typeof data.working_hours === "object") {
        setWorkingHours(data.working_hours as WorkingHours);
      } else {
        setWorkingHours({ ...DEFAULT_WORKING_HOURS });
      }
    } catch (error) {
      console.error(error);
      setWorkingHours({ ...DEFAULT_WORKING_HOURS });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) void loadSettings();
  }, [open, loadSettings]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const cleanHours = JSON.parse(JSON.stringify(workingHours)) as WorkingHours;

      const { error } = await supabase
        .from("profiles")
        .update({ working_hours: cleanHours })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Horários atualizados com sucesso.");
      setOpen(false);
    } catch (error) {
      console.error("Save error detail:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configuração.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateDay = <K extends keyof WorkingDayHours>(dayId: string, field: K, value: WorkingDayHours[K]) => {
    setWorkingHours((prev) => ({
      ...prev,
      [dayId]: {
        ...(prev[dayId] ?? DEFAULT_WORKING_HOURS[dayId] ?? { enabled: false, start: "08:00", end: "18:00" }),
        [field]: value,
      },
    }));
  };

  return (
    <AppModalShell
      open={open}
      onOpenChange={setOpen}
      size="md"
      eyebrow="Agenda"
      title="Sua grade"
      description="Defina os dias e intervalos em que você atende."
      heroIcon={<ModalHeroIcon icon={Clock} ariaLabel="Grade de atendimento" />}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="desktop-retina-interactive h-10 w-10 shrink-0 rounded-full border border-border/50 bg-background/70 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
          aria-label="Configurar grade da agenda"
        >
          <Settings className="h-4 w-4" />
        </Button>
      }
      footer={
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving || isLoading}
          className="h-12 w-full rounded-2xl bg-foreground text-[10.5px] font-black uppercase tracking-[0.16em] text-background shadow-xl disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? "Salvando..." : "Salvar configuração"}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[18rem] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[29rem] space-y-3">
          {DAYS_OF_WEEK.map((day) => {
            const hw = workingHours[day.id] || { enabled: false, start: "08:00", end: "18:00" };
            return (
              <div
                key={day.id}
                className={cn(
                  "rounded-2xl border motion-safe:transition-colors",
                  hw.enabled
                    ? "border-border/70 bg-muted/35"
                    : "border-border/35 bg-transparent opacity-70",
                )}
              >
                <div className={cn("flex items-center gap-3 p-3 sm:p-4", hw.enabled && "pb-2")}>
                  <Switch
                    checked={hw.enabled}
                    onCheckedChange={(checked) => updateDay(day.id, "enabled", checked)}
                    aria-label={`Ativar ${day.label}`}
                  />
                  <span className="flex-1 truncate text-sm font-bold text-foreground">
                    <span className="hidden sm:inline">{day.label}</span>
                    <span className="sm:hidden">{day.short}</span>
                  </span>

                  {hw.enabled ? (
                    <div className="hidden items-center gap-2 sm:flex">
                      <Input
                        type="time"
                        value={hw.start}
                        onChange={(event) => updateDay(day.id, "start", event.target.value)}
                        className="h-10 w-[104px] rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                        aria-label={`Início em ${day.label}`}
                      />
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={hw.end}
                        onChange={(event) => updateDay(day.id, "end", event.target.value)}
                        className="h-10 w-[104px] rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                        aria-label={`Fim em ${day.label}`}
                      />
                    </div>
                  ) : null}
                </div>

                {hw.enabled ? (
                  <div className="px-3 pb-3 sm:hidden">
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={hw.start}
                        onChange={(event) => updateDay(day.id, "start", event.target.value)}
                        className="h-10 flex-1 rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                        aria-label={`Início em ${day.label}`}
                      />
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={hw.end}
                        onChange={(event) => updateDay(day.id, "end", event.target.value)}
                        className="h-10 flex-1 rounded-xl border-border/70 bg-background text-center text-sm font-bold"
                        aria-label={`Fim em ${day.label}`}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppModalShell>
  );
};
