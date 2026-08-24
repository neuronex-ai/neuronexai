import { CalendarRange, ChevronDown, Layers3, Maximize2, Minimize2, RotateCcw, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";
import {
  NEUROTIME_FONTES,
  type NeuroTimeFiltros,
  type NeuroTimeFonte,
  type NeuroTimePeriodo,
} from "../../clinical-evidence/neurotime-types";

type NeuroTimeToolbarProps = {
  patients: Patient[];
  filters: NeuroTimeFiltros;
  availableSources: Set<NeuroTimeFonte>;
  onChange: (filters: NeuroTimeFiltros) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

const controlClass = cn(
  "min-h-11 rounded-[14px] border border-white/[0.09] bg-white/[0.045] px-3 text-xs font-semibold text-white/68",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl transition-colors duration-200",
  "hover:bg-white/[0.085] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
  "motion-reduce:transition-none [.light_&]:border-black/[0.07] [.light_&]:bg-white/66 [.light_&]:text-zinc-600",
  "[.light_&]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] [.light_&]:hover:bg-white [.light_&]:hover:text-zinc-950 [.light_&]:focus-visible:ring-zinc-950/30",
);

const menuClass = cn(
  "z-[180] w-72 rounded-[18px] border-white/[0.09] bg-[#0b0b0d]/94 p-1.5 text-white shadow-[0_28px_80px_-34px_rgba(0,0,0,0.9)] backdrop-blur-3xl",
  "[.light_&]:border-black/[0.08] [.light_&]:bg-white/96 [.light_&]:text-zinc-900",
);

export const NeuroTimeToolbar = ({
  patients,
  filters,
  availableSources,
  onChange,
  isFullscreen,
  onToggleFullscreen,
}: NeuroTimeToolbarProps) => {
  const patientLabel = filters.patientIds.length === 0
    ? "Todos os pacientes"
    : filters.patientIds.length === 1
      ? patients.find((patient) => patient.id === filters.patientIds[0])?.name || "1 paciente"
      : `${filters.patientIds.length} pacientes`;
  const sourceLabel = filters.sources.length === 0
    ? "Todas as fontes"
    : filters.sources.length === 1
      ? NEUROTIME_FONTES.find((item) => item.value === filters.sources[0])?.shortLabel || "1 fonte"
      : `${filters.sources.length} fontes`;

  const togglePatient = (patientId: string) => {
    const next = filters.patientIds.length === 0
      ? [patientId]
      : filters.patientIds.includes(patientId)
        ? filters.patientIds.filter((id) => id !== patientId)
        : [...filters.patientIds, patientId];
    onChange({ ...filters, patientIds: next.length ? next : [] });
  };

  const toggleSource = (source: NeuroTimeFonte) => {
    const next = filters.sources.length === 0
      ? [source]
      : filters.sources.includes(source)
        ? filters.sources.filter((item) => item !== source)
        : [...filters.sources, source];
    onChange({ ...filters, sources: next.length ? next : [] });
  };

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros do NeuroTime">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className={cn(controlClass, "max-w-[220px] justify-between gap-2")}>
            <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{patientLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={menuClass}>
          <DropdownMenuLabel className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/42 [.light_&]:text-zinc-500">
            Pacientes no campo temporal
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={filters.patientIds.length === 0}
            onCheckedChange={() => onChange({ ...filters, patientIds: [] })}
            onSelect={(event) => event.preventDefault()}
            className="min-h-10 rounded-xl focus:bg-white/[0.08] [.light_&]:focus:bg-black/[0.05]"
          >
            Todos os pacientes
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className="bg-white/[0.07] [.light_&]:bg-black/[0.06]" />
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {patients.map((patient) => (
              <DropdownMenuCheckboxItem
                key={patient.id}
                checked={filters.patientIds.includes(patient.id)}
                onCheckedChange={() => togglePatient(patient.id)}
                onSelect={(event) => event.preventDefault()}
                className="min-h-10 rounded-xl focus:bg-white/[0.08] [.light_&]:focus:bg-black/[0.05]"
              >
                <span className="truncate">{patient.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={filters.period} onValueChange={(period) => onChange({ ...filters, period: period as NeuroTimePeriodo })}>
        <SelectTrigger className={cn(controlClass, "w-[142px] gap-2 border-white/[0.09] bg-white/[0.045] px-3 [.light_&]:border-black/[0.07] [.light_&]:bg-white/66")} aria-label="Período do NeuroTime">
          <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[180] rounded-[18px]">
          <SelectItem value="90-dias">90 dias</SelectItem>
          <SelectItem value="6-meses">6 meses</SelectItem>
          <SelectItem value="1-ano">1 ano</SelectItem>
          <SelectItem value="tudo">Todo o histórico</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className={cn(controlClass, "max-w-[190px] justify-between gap-2")}>
            <Layers3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{sourceLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={menuClass}>
          <DropdownMenuLabel className="px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/42 [.light_&]:text-zinc-500">
            Fontes autorizadas
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={filters.sources.length === 0}
            onCheckedChange={() => onChange({ ...filters, sources: [] })}
            onSelect={(event) => event.preventDefault()}
            className="min-h-10 rounded-xl focus:bg-white/[0.08] [.light_&]:focus:bg-black/[0.05]"
          >
            Todas as fontes disponíveis
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className="bg-white/[0.07] [.light_&]:bg-black/[0.06]" />
          {NEUROTIME_FONTES.map((source) => {
            const available = availableSources.has(source.value);
            return (
              <DropdownMenuCheckboxItem
                key={source.value}
                checked={filters.sources.includes(source.value)}
                disabled={!available}
                onCheckedChange={() => toggleSource(source.value)}
                onSelect={(event) => event.preventDefault()}
                className="min-h-10 rounded-xl focus:bg-white/[0.08] data-[disabled]:opacity-32 [.light_&]:focus:bg-black/[0.05]"
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{source.label}</span>
                  {!available ? <span className="text-[9px] uppercase tracking-[0.12em] opacity-45">sem dados</span> : null}
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {(filters.patientIds.length > 0 || filters.sources.length > 0 || filters.period !== "1-ano") ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(controlClass, "h-11 w-11 px-0")}
          onClick={() => onChange({ patientIds: [], sources: [], period: "1-ano" })}
          aria-label="Limpar filtros do NeuroTime"
          title="Limpar filtros"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(controlClass, "ml-auto h-11 w-11 px-0")}
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "Sair da tela cheia" : "Abrir NeuroTime em tela cheia"}
        title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
    </div>
  );
};
