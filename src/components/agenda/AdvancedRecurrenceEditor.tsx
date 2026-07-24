import { CalendarRange, Plus, Repeat2, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AppointmentEventType } from "@/lib/appointment-form-flow";
import { getAppointmentRecurrenceTerminology } from "@/lib/appointment-recurrence-terminology";
import type { AgendaRecurrenceDraft, RecurrenceRuleKind } from "@/lib/agenda-scheduling";
import { cn } from "@/lib/utils";

const WEEK_DAYS = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
];

const KIND_OPTIONS: Array<{ value: RecurrenceRuleKind; label: string; description: string }> = [
  { value: "weekly", label: "Semanal", description: "Um ou mais dias da semana" },
  { value: "monthly", label: "Mensal", description: "Um ou mais dias do mês" },
  { value: "interval", label: "Por intervalo", description: "A cada N dias" },
  { value: "custom_dates", label: "Datas específicas", description: "Escolha cada data" },
  { value: "range_distribution", label: "Distribuir", description: "N sessões até uma data" },
];

interface AdvancedRecurrenceEditorProps {
  value: AgendaRecurrenceDraft;
  onChange: (value: AgendaRecurrenceDraft) => void;
  eventType?: AppointmentEventType;
}

export function AdvancedRecurrenceEditor({
  value,
  onChange,
  eventType = "session",
}: AdvancedRecurrenceEditorProps) {
  const terminology = getAppointmentRecurrenceTerminology(eventType);
  const patch = (next: Partial<AgendaRecurrenceDraft>) => onChange({ ...value, ...next });

  const toggleWeekDay = (weekday: number) => {
    const selected = value.weekDays.includes(weekday);
    const next = selected
      ? value.weekDays.filter((item) => item !== weekday)
      : [...value.weekDays, weekday].sort();
    if (next.length) patch({ weekDays: next });
  };

  const updateMonthDays = (raw: string) => {
    const days = [...new Set(raw.split(/[,;\s]+/).map(Number))]
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31)
      .sort((left, right) => left - right);
    patch({ monthDays: days });
  };

  const updateCustomDate = (index: number, date: string) => {
    const next = [...value.customDates];
    next[index] = date;
    patch({ customDates: next });
  };

  return (
    <section className="agenda-liquid-surface mt-3 rounded-[24px] border p-4" aria-labelledby="recurrence-rules-heading">
      <div className="flex items-start gap-3">
        <span className="synapse-chat-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border">
          <Repeat2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="recurrence-rules-heading" className="text-sm font-black tracking-[-0.02em] text-foreground">
            {terminology.heading}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {terminology.inheritanceDescription}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="advanced-recurrence-kind" className="text-xs font-bold text-foreground">
            Regra
          </Label>
          <Select value={value.kind} onValueChange={(kind) => patch({ kind: kind as RecurrenceRuleKind })}>
            <SelectTrigger
              id="advanced-recurrence-kind"
              className="agenda-field h-12 rounded-2xl px-4 text-left [&>span:first-child]:flex [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:flex-col [&>span:first-child]:items-start [&>span:first-child]:justify-center [&>span:first-child]:text-left"
            >
              <SelectValue className="text-left" />
            </SelectTrigger>
            <SelectContent className="agenda-menu-surface notification-liquid-menu rounded-[18px] p-1.5">
              {KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="notification-liquid-menu-item rounded-[13px] py-2.5">
                  <span className="flex flex-col">
                    <span className="font-bold">{option.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {option.value === "range_distribution"
                        ? terminology.distributionDescription
                        : option.description}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {value.kind === "weekly" ? (
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Dias da semana</Label>
            <div className="synapse-liquid-toolbar flex w-full items-center justify-between gap-1 p-1.5" role="group" aria-label="Dias da recorrência">
              {WEEK_DAYS.map((day) => {
                const selected = value.weekDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleWeekDay(day.value)}
                    className={cn(
                      "synapse-liquid-control relative flex h-11 min-w-11 flex-1 items-center justify-center rounded-full text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "synapse-liquid-tab-active text-foreground",
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {value.kind === "monthly" ? (
          <div className="space-y-2">
            <Label htmlFor="advanced-month-days" className="text-xs font-bold text-foreground">
              Dias do mês
            </Label>
            <Input
              id="advanced-month-days"
              value={value.monthDays.join(", ")}
              onChange={(event) => updateMonthDays(event.target.value)}
              placeholder="Ex.: 5, 12, 26"
              className="agenda-field h-12 rounded-2xl font-semibold"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Se 29, 30 ou 31 não existir, usaremos o último dia útil permitido e marcaremos o ajuste.
            </p>
          </div>
        ) : null}

        {value.kind === "interval" ? (
          <div className="space-y-2">
            <Label htmlFor="advanced-interval" className="text-xs font-bold text-foreground">Repetir a cada</Label>
            <div className="flex items-center gap-2">
              <Input
                id="advanced-interval"
                type="number"
                min={1}
                max={365}
                value={value.interval}
                onChange={(event) => patch({ interval: Math.max(1, Number(event.target.value) || 1) })}
                className="agenda-field h-12 w-28 rounded-2xl text-center font-black"
              />
              <span className="text-sm font-semibold text-muted-foreground">dias</span>
            </div>
          </div>
        ) : null}

        {value.kind === "custom_dates" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-bold text-foreground">Datas da série</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch({ customDates: [...value.customDates, ""] })}
                className="notification-liquid-control h-11 rounded-full px-3 text-xs font-bold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {(value.customDates.length ? value.customDates : [""]).map((date, index) => (
                <div key={`${index}-${date}`} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={date}
                    onChange={(event) => updateCustomDate(index, event.target.value)}
                    className="agenda-field h-11 flex-1 rounded-2xl font-semibold"
                    aria-label={`Data específica ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => patch({ customDates: value.customDates.filter((_, itemIndex) => itemIndex !== index) })}
                    className="notification-liquid-control h-11 w-11 rounded-full text-muted-foreground hover:text-destructive"
                    aria-label={`Remover data ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {value.kind === "range_distribution" ? (
          <div className="space-y-2">
            <Label htmlFor="advanced-distribution-until" className="text-xs font-bold text-foreground">
              Distribuir até
            </Label>
            <Input
              id="advanced-distribution-until"
              type="date"
              value={value.distributeUntilDate}
              onChange={(event) => patch({ distributeUntilDate: event.target.value, terminationKind: "count" })}
              className="agenda-field h-12 rounded-2xl font-semibold"
            />
          </div>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-xs font-bold text-foreground">Quando termina?</legend>
          <RadioGroup
            value={value.terminationKind}
            onValueChange={(terminationKind) => patch({ terminationKind: terminationKind as AgendaRecurrenceDraft["terminationKind"] })}
            className="grid grid-cols-3 gap-2"
          >
            {[
              { value: "count", label: terminology.terminationCountLabel },
              { value: "until", label: "Em uma data" },
              { value: "open", label: "Sem término" },
            ].map((option) => (
              <label
                key={option.value}
                className="agenda-choice-card has-[[data-state=checked]]:synapse-liquid-tab-active synapse-chat-glass flex min-h-11 cursor-pointer items-center justify-center rounded-[15px] border px-2 text-center text-[11px] font-bold text-muted-foreground has-[[data-state=checked]]:text-foreground"
              >
                <RadioGroupItem value={option.value} className="sr-only" />
                {option.label}
              </label>
            ))}
          </RadioGroup>

          {value.terminationKind === "count" ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={2}
                max={500}
                value={value.count}
                onChange={(event) => patch({ count: Math.max(2, Number(event.target.value) || 2) })}
                className="agenda-field h-11 w-28 rounded-2xl text-center font-black"
                aria-label={`Quantidade total de ${terminology.plural}`}
              />
              <span className="text-xs text-muted-foreground">
                incluindo {terminology.firstOccurrence}
              </span>
            </div>
          ) : null}
          {value.terminationKind === "until" ? (
            <Input
              type="date"
              value={value.untilDate}
              onChange={(event) => patch({ untilDate: event.target.value })}
              className="agenda-field h-11 rounded-2xl font-semibold"
              aria-label="Data final da recorrência"
            />
          ) : null}
          {value.terminationKind === "open" ? (
            <div className="flex gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/[0.07] p-3 text-xs leading-relaxed text-muted-foreground">
              <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              O sistema mantém somente os próximos 90 dias e repõe a janela diariamente. Conflitos voltam para revisão.
            </div>
          ) : null}
        </fieldset>

        <div className="agenda-liquid-card flex items-center justify-between gap-4 rounded-[18px] border p-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black text-foreground">
              <Settings2 className="h-3.5 w-3.5" /> {terminology.customizeLabel}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Ajuste horário ou duração de ocorrências específicas na revisão.
            </p>
          </div>
          <Switch
            checked={value.customizeOccurrences}
            onCheckedChange={(customizeOccurrences) => patch({ customizeOccurrences })}
            aria-label="Personalizar ocorrências específicas"
          />
        </div>
      </div>
    </section>
  );
}
