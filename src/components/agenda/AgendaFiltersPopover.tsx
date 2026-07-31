"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import type { Appointment } from "@/types";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  countActiveAgendaFilters,
  EMPTY_AGENDA_FILTERS,
  type AgendaFilterModality,
  type AgendaFilterOrigin,
  type AgendaFilters,
  type AgendaFilterStatus,
} from "@/lib/agenda-filters";

const STATUS_OPTIONS: AgendaFilterStatus[] = [
  "Pendente",
  "Confirmada",
  "Realizada",
  "Ausente",
  "Cancelada",
  "Cancelando",
  "Reagendando",
  "Atendimento",
];

interface AgendaFiltersPopoverProps {
  appointments: Appointment[];
  filters: AgendaFilters;
  onFiltersChange: (filters: AgendaFilters) => void;
}

export const AgendaFiltersPopover = ({
  appointments,
  filters,
  onFiltersChange,
}: AgendaFiltersPopoverProps) => {
  const activeCount = countActiveAgendaFilters(filters);
  const [dateMode, setDateMode] = useState<"date" | "range">(
    filters.dateFrom || filters.dateTo ? "range" : "date",
  );

  useEffect(() => {
    if (filters.dateFrom || filters.dateTo) setDateMode("range");
    else if (filters.date) setDateMode("date");
  }, [filters.date, filters.dateFrom, filters.dateTo]);
  const patients = useMemo(() => {
    const uniquePatients = new Map<string, string>();
    appointments.forEach((appointment) => {
      if (!appointment.patient_id || !appointment.patient_name?.trim()) return;
      uniquePatients.set(appointment.patient_id, appointment.patient_name.trim());
    });
    return [...uniquePatients.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [appointments]);

  const update = <Key extends keyof AgendaFilters>(
    key: Key,
    value: AgendaFilters[Key],
  ) => {
    const next = { ...filters, [key]: value };
    if (key === "date" && value) {
      next.dateFrom = "";
      next.dateTo = "";
    }
    if ((key === "dateFrom" || key === "dateTo") && value) {
      next.date = "";
    }
    onFiltersChange(next);
  };

  const changeDateMode = (mode: "date" | "range") => {
    setDateMode(mode);
    onFiltersChange({
      ...filters,
      date: mode === "date" ? filters.date : "",
      dateFrom: mode === "range" ? filters.dateFrom : "",
      dateTo: mode === "range" ? filters.dateTo : "",
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "agenda-filter-trigger agenda-floating-pill agenda-tactile pointer-events-auto relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] p-0 text-muted-foreground hover:text-foreground",
            activeCount > 0 && "synapse-liquid-tab-active text-foreground",
          )}
          aria-label={activeCount ? `Filtros, ${activeCount} ativos` : "Filtros"}
          title="Filtros"
        >
          <Filter className="agenda-filter-icon h-[18px] w-[18px]" aria-hidden="true" />
          {activeCount > 0 ? (
            <span className="agenda-filter-count absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[8px] font-black leading-none text-background">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="agenda-menu-surface notification-liquid-menu w-[min(440px,calc(100vw-1.5rem))] rounded-[24px] border p-3"
      >
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div>
            <p className="text-xs font-black text-foreground">Filtrar agenda</p>
            <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
              Os resultados mudam enquanto você escolhe.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onFiltersChange(EMPTY_AGENDA_FILTERS)}
            disabled={activeCount === 0}
            className="notification-liquid-control h-11 w-11 rounded-[14px]"
            aria-label="Limpar filtros"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <FilterField label="Paciente" className="sm:col-span-3">
            <Select
              value={filters.patientId}
              onValueChange={(value) => update("patientId", value)}
            >
              <SelectTrigger className="agenda-field h-11 rounded-[14px] text-xs font-bold">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="agenda-menu-surface rounded-[18px]">
                <SelectItem value="all">Todos</SelectItem>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <div className="sm:col-span-3">
            <MagneticSegmentedControl
              id="agenda-filter-date-mode"
              indicatorId="agenda-filter-date-mode-indicator"
              value={dateMode}
              onValueChange={changeDateMode}
              ariaLabel="Tipo de filtro por data"
              behavior="single-select"
              options={[
                { value: "date", label: "Data" },
                { value: "range", label: "Intervalo" },
              ]}
              className="h-12 min-h-12 w-full rounded-[18px]"
              triggerClassName="h-11 min-h-11 flex-1 rounded-[14px] px-4 py-0 text-xs font-black"
            />
          </div>

          {dateMode === "date" ? (
            <FilterField label="Data" className="sm:col-span-3">
              <Input
                type="date"
                value={filters.date}
                onChange={(event) => update("date", event.target.value)}
                className="agenda-field h-11 rounded-[14px] text-xs font-bold"
                aria-label="Filtrar por uma data"
              />
            </FilterField>
          ) : (
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="pl-1 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Intervalo
              </Label>
              <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => update("dateFrom", event.target.value)}
                className="agenda-field h-11 rounded-[14px] text-xs font-bold"
                aria-label="Início do intervalo"
              />
              <Input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => update("dateTo", event.target.value)}
                className="agenda-field h-11 rounded-[14px] text-xs font-bold"
                aria-label="Fim do intervalo"
              />
              </div>
            </div>
          )}

          <FilterField label="Modalidade">
            <Select
              value={filters.modality}
              onValueChange={(value: AgendaFilterModality) => update("modality", value)}
            >
              <SelectTrigger className="agenda-field h-11 rounded-[14px] text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="agenda-menu-surface rounded-[18px]">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Origem">
            <Select
              value={filters.origin}
              onValueChange={(value: AgendaFilterOrigin) => update("origin", value)}
            >
              <SelectTrigger className="agenda-field h-11 rounded-[14px] text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="agenda-menu-surface rounded-[18px]">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="google">Google Agenda</SelectItem>
                <SelectItem value="neuronex">NeuroNex</SelectItem>
                <SelectItem value="waitlist">Lista de espera</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Status">
            <Select
              value={filters.status}
              onValueChange={(value: AgendaFilterStatus) => update("status", value)}
            >
              <SelectTrigger className="agenda-field h-11 rounded-[14px] text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="agenda-menu-surface rounded-[18px]">
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const FilterField = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="pl-1 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);
