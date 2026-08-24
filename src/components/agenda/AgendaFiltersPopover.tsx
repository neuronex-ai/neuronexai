"use client";

import { useMemo } from "react";
import { Filter, RotateCcw } from "lucide-react";
import type { Appointment } from "@/types";
import { Button } from "@/components/ui/button";
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "agenda-floating-pill agenda-header-control agenda-tactile pointer-events-auto h-11 shrink-0 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground",
            activeCount > 0 && "synapse-liquid-tab-active text-foreground",
          )}
          aria-label={activeCount ? `Filtros, ${activeCount} ativos` : "Filtros"}
        >
          <Filter className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Filtros
          {activeCount > 0 ? (
            <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[8px] text-background">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="agenda-menu-surface notification-liquid-menu w-[min(440px,calc(100vw-1.5rem))] rounded-[26px] border p-4"
      >
        <div className="flex items-center justify-between gap-4 px-1 pb-4">
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
            className="notification-liquid-control h-9 w-9 rounded-full"
            aria-label="Limpar filtros"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-3">
          <FilterField label="Paciente" className="sm:col-span-3">
            <Select
              value={filters.patientId}
              onValueChange={(value) => update("patientId", value)}
            >
              <SelectTrigger className="agenda-field h-10 rounded-[14px] text-xs font-bold">
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

          <FilterField label="Data">
            <Input
              type="date"
              value={filters.date}
              onChange={(event) => update("date", event.target.value)}
              className="agenda-field h-10 rounded-[14px] text-xs font-bold"
              aria-label="Filtrar por uma data"
            />
          </FilterField>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="pl-1 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Intervalo
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(event) => update("dateFrom", event.target.value)}
                className="agenda-field h-10 rounded-[14px] text-xs font-bold"
                aria-label="Início do intervalo"
              />
              <Input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(event) => update("dateTo", event.target.value)}
                className="agenda-field h-10 rounded-[14px] text-xs font-bold"
                aria-label="Fim do intervalo"
              />
            </div>
          </div>

          <FilterField label="Modalidade">
            <Select
              value={filters.modality}
              onValueChange={(value: AgendaFilterModality) => update("modality", value)}
            >
              <SelectTrigger className="agenda-field h-10 rounded-[14px] text-xs font-bold">
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
              <SelectTrigger className="agenda-field h-10 rounded-[14px] text-xs font-bold">
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
              <SelectTrigger className="agenda-field h-10 rounded-[14px] text-xs font-bold">
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
