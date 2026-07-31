"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  Check,
  Filter,
  Laptop,
  ListPlus,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  countActiveAgendaFilterGroups,
  createEmptyAgendaFilters,
  type AgendaDateFilterMode,
  type AgendaFilterState,
  type AgendaModalityFilter,
  type AgendaPatientFilterOption,
  validateAgendaDateFilter,
} from "@/lib/agenda-filters";
import {
  APPOINTMENT_STATUS_META,
  APPOINTMENT_STATUS_VALUES,
  type AppointmentStatus,
} from "@/lib/appointment-status";
import type { AppointmentOrigin } from "@/lib/appointment-metadata";

interface AgendaFiltersPopoverProps {
  filters: AgendaFilterState;
  onChange: (filters: AgendaFilterState) => void;
  patients: AgendaPatientFilterOption[];
  resultCount: number;
}

const DATE_MODES: Array<{ value: AgendaDateFilterMode; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "day", label: "Dia" },
  { value: "range", label: "Intervalo" },
  { value: "year", label: "Ano" },
];

const MODALITIES: Array<{
  value: AgendaModalityFilter;
  label: string;
  icon: typeof Laptop;
}> = [
  { value: "online", label: "Online", icon: Laptop },
  { value: "presencial", label: "Presencial", icon: MapPin },
];

const ORIGINS: Array<{
  value: AppointmentOrigin;
  label: string;
  icon: typeof Sparkles;
}> = [
  { value: "google", label: "Google Agenda", icon: CalendarRange },
  { value: "neuronex", label: "NeuroNex", icon: Sparkles },
  { value: "waitlist", label: "Lista de espera", icon: ListPlus },
];

const toggleValue = <Value extends string>(values: Value[], value: Value) =>
  values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];

const FilterChoice = ({
  active,
  label,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon?: typeof Check;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "agenda-tactile notification-liquid-control inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-[11px] font-bold text-muted-foreground",
      active && "notification-liquid-tab-active text-foreground",
    )}
  >
    {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
    <span>{label}</span>
    {active ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
  </button>
);

export const AgendaFiltersPopover = ({
  filters,
  onChange,
  patients,
  resultCount,
}: AgendaFiltersPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [patientSearch, setPatientSearch] = useState("");
  const activeGroups = countActiveAgendaFilterGroups(filters);
  const dateError = validateAgendaDateFilter(draft);

  const visiblePatients = useMemo(() => {
    const query = patientSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return patients;
    return patients.filter((patient) =>
      patient.name.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [patientSearch, patients]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDraft(filters);
      setPatientSearch("");
    }
  };

  const resetDraft = () => {
    setDraft(createEmptyAgendaFilters());
    setPatientSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={activeGroups ? `Filtros da agenda, ${activeGroups} grupos ativos` : "Filtrar agenda"}
          className={cn(
            "agenda-tactile notification-liquid-control relative h-10 shrink-0 rounded-full border px-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground",
            activeGroups > 0 && "notification-liquid-tab-active text-foreground",
          )}
        >
          <Filter className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Filtros
          {activeGroups > 0 ? (
            <span className="ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[8px] text-background">
              {activeGroups}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="agenda-menu-surface notification-popover-surface w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[24px] border border-border/50 bg-popover p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/45 px-4 py-3">
          <div>
            <p className="text-sm font-black text-foreground">Filtrar agenda</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Refine sem esconder o contexto do calendário.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={resetDraft}
            className="notification-liquid-control h-10 w-10 rounded-full"
            aria-label="Limpar todos os filtros"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="max-h-[min(68dvh,640px)] space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          <fieldset className="space-y-2.5">
            <legend className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Paciente
            </legend>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
                placeholder="Buscar paciente"
                aria-label="Buscar paciente nos filtros"
                className="agenda-field h-10 rounded-2xl pl-9 text-xs"
              />
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-[18px] border border-border/40 p-1">
              {visiblePatients.length ? (
                visiblePatients.map((patient) => {
                  const selected = draft.patientIds.includes(patient.id);
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          patientIds: toggleValue(current.patientIds, patient.id),
                        }))
                      }
                      className={cn(
                        "flex min-h-10 w-full items-center justify-between rounded-[14px] px-3 text-left text-xs font-semibold text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected && "bg-foreground/[0.065] text-foreground",
                      )}
                    >
                      <span className="truncate">{patient.name}</span>
                      {selected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum paciente encontrado.
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Período
            </legend>
            <div className="synapse-liquid-toolbar grid grid-cols-4 gap-1 rounded-[16px] p-1">
              {DATE_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={draft.dateMode === mode.value}
                  onClick={() => setDraft((current) => ({ ...current, dateMode: mode.value }))}
                  className={cn(
                    "min-h-9 rounded-[12px] px-2 text-[10px] font-black text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    draft.dateMode === mode.value && "notification-liquid-tab-active text-foreground",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {draft.dateMode === "day" ? (
              <Input
                type="date"
                value={draft.day}
                onChange={(event) => setDraft((current) => ({ ...current, day: event.target.value }))}
                aria-label="Dia filtrado"
                className="agenda-field h-10 rounded-2xl text-xs"
              />
            ) : null}
            {draft.dateMode === "range" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Início
                  <Input
                    type="date"
                    value={draft.rangeStart}
                    onChange={(event) => setDraft((current) => ({ ...current, rangeStart: event.target.value }))}
                    className="agenda-field h-10 rounded-2xl text-xs"
                  />
                </label>
                <label className="space-y-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Fim
                  <Input
                    type="date"
                    value={draft.rangeEnd}
                    onChange={(event) => setDraft((current) => ({ ...current, rangeEnd: event.target.value }))}
                    className="agenda-field h-10 rounded-2xl text-xs"
                  />
                </label>
              </div>
            ) : null}
            {draft.dateMode === "year" ? (
              <Input
                type="number"
                min={2000}
                max={2100}
                inputMode="numeric"
                value={draft.year}
                onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))}
                aria-label="Ano filtrado"
                className="agenda-field h-10 rounded-2xl text-xs"
              />
            ) : null}
            {dateError ? (
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300" role="alert">
                {dateError}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2.5">
            <legend className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Status
            </legend>
            <div className="flex flex-wrap gap-2">
              {APPOINTMENT_STATUS_VALUES.map((status) => (
                <FilterChoice
                  key={status}
                  active={draft.statuses.includes(status)}
                  label={APPOINTMENT_STATUS_META[status].shortLabel}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      statuses: toggleValue<AppointmentStatus>(current.statuses, status),
                    }))
                  }
                />
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Sem seleção, a agenda mostra os itens ativos e oculta cancelamentos.
            </p>
          </fieldset>

          <fieldset className="space-y-2.5">
            <legend className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Modalidade
            </legend>
            <div className="flex flex-wrap gap-2">
              {MODALITIES.map((modality) => (
                <FilterChoice
                  key={modality.value}
                  active={draft.modalities.includes(modality.value)}
                  label={modality.label}
                  icon={modality.icon}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      modalities: toggleValue(current.modalities, modality.value),
                    }))
                  }
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2.5">
            <legend className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Origem
            </legend>
            <div className="flex flex-wrap gap-2">
              {ORIGINS.map((origin) => (
                <FilterChoice
                  key={origin.value}
                  active={draft.origins.includes(origin.value)}
                  label={origin.label}
                  icon={origin.icon}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      origins: toggleValue(current.origins, origin.value),
                    }))
                  }
                />
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/45 px-4 py-3">
          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            {resultCount} {resultCount === 1 ? "item visível" : "itens visíveis"}
          </p>
          <Button
            type="button"
            disabled={Boolean(dateError)}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
            className="agenda-primary-action h-10 rounded-full px-5 text-[10px] font-black uppercase tracking-[0.12em]"
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
