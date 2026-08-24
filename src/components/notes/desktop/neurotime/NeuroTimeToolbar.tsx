import { CalendarRange, ChevronDown, Layers3, RotateCcw, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  darkMode: boolean;
  portalContainer?: HTMLElement | null;
};

const controlClass = (darkMode: boolean) => cn(
  "min-h-10 rounded-[13px] border px-3 text-[11px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-200",
  "focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none",
  darkMode
    ? "border-white/[0.075] bg-white/[0.035] text-white/66 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] hover:border-white/12 hover:bg-white/[0.07] hover:text-white focus-visible:ring-white/32"
    : "border-black/[0.065] bg-white/74 text-zinc-600 shadow-[0_12px_28px_-24px_rgba(24,24,27,0.3),inset_0_1px_0_rgba(255,255,255,0.98)] hover:border-black/[0.095] hover:bg-white hover:text-zinc-950 focus-visible:ring-zinc-950/24",
);

const menuClass = (darkMode: boolean) => cn(
  "z-[250] w-72 rounded-[18px] border p-1.5 shadow-[0_28px_80px_-34px_rgba(0,0,0,0.9)] backdrop-blur-3xl",
  darkMode ? "border-white/[0.09] bg-[#0b0b0d]/96 text-white" : "border-black/[0.075] bg-white/96 text-zinc-900",
);

export const NeuroTimeToolbar = ({
  patients,
  filters,
  availableSources,
  onChange,
  darkMode,
  portalContainer,
}: NeuroTimeToolbarProps) => {
  const patientLabel = filters.patientIds.length === 0
    ? "Pacientes"
    : filters.patientIds.length === 1
      ? patients.find((patient) => patient.id === filters.patientIds[0])?.name || "1 paciente"
      : `${filters.patientIds.length} pacientes`;
  const sourceLabel = filters.sources.length === 0
    ? "Fontes"
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
    <div className="flex flex-wrap items-center justify-end gap-1.5" role="toolbar" aria-label="Filtros do NeuroTime">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className={cn(controlClass(darkMode), "max-w-[174px] justify-between gap-2")}>
            <UsersRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{patientLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent portalContainer={portalContainer} align="end" className={menuClass(darkMode)}>
          <DropdownMenuLabel className={cn("px-3 py-2 text-[10px] uppercase tracking-[0.16em]", darkMode ? "text-white/42" : "text-zinc-500")}>Pacientes no campo temporal</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={filters.patientIds.length === 0} onCheckedChange={() => onChange({ ...filters, patientIds: [] })} onSelect={(event) => event.preventDefault()} className={cn("min-h-10 rounded-xl", darkMode ? "focus:bg-white/[0.08]" : "focus:bg-black/[0.05]")}>
            Todos os pacientes
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className={darkMode ? "bg-white/[0.07]" : "bg-black/[0.06]"} />
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {patients.map((patient) => (
              <DropdownMenuCheckboxItem key={patient.id} checked={filters.patientIds.includes(patient.id)} onCheckedChange={() => togglePatient(patient.id)} onSelect={(event) => event.preventDefault()} className={cn("min-h-10 rounded-xl", darkMode ? "focus:bg-white/[0.08]" : "focus:bg-black/[0.05]")}>
                <span className="truncate">{patient.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={filters.period} onValueChange={(period) => onChange({ ...filters, period: period as NeuroTimePeriodo })}>
        <SelectTrigger className={cn(controlClass(darkMode), "w-[126px] gap-2 px-3")} aria-label="Período do NeuroTime">
          <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent portalContainer={portalContainer} className="z-[250] rounded-[18px]">
          <SelectItem value="90-dias">90 dias</SelectItem>
          <SelectItem value="6-meses">6 meses</SelectItem>
          <SelectItem value="1-ano">1 ano</SelectItem>
          <SelectItem value="tudo">Todo o histórico</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" className={cn(controlClass(darkMode), "max-w-[154px] justify-between gap-2")}>
            <Layers3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{sourceLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent portalContainer={portalContainer} align="end" className={menuClass(darkMode)}>
          <DropdownMenuLabel className={cn("px-3 py-2 text-[10px] uppercase tracking-[0.16em]", darkMode ? "text-white/42" : "text-zinc-500")}>Fontes autorizadas</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={filters.sources.length === 0} onCheckedChange={() => onChange({ ...filters, sources: [] })} onSelect={(event) => event.preventDefault()} className={cn("min-h-10 rounded-xl", darkMode ? "focus:bg-white/[0.08]" : "focus:bg-black/[0.05]")}>
            Todas as fontes disponíveis
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator className={darkMode ? "bg-white/[0.07]" : "bg-black/[0.06]"} />
          {NEUROTIME_FONTES.map((source) => {
            const available = availableSources.has(source.value);
            return (
              <DropdownMenuCheckboxItem key={source.value} checked={filters.sources.includes(source.value)} disabled={!available} onCheckedChange={() => toggleSource(source.value)} onSelect={(event) => event.preventDefault()} className={cn("min-h-10 rounded-xl data-[disabled]:opacity-32", darkMode ? "focus:bg-white/[0.08]" : "focus:bg-black/[0.05]")}>
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
        <Button type="button" variant="ghost" size="icon" className={cn(controlClass(darkMode), "h-10 w-10 px-0")} onClick={() => onChange({ patientIds: [], sources: [], period: "1-ano" })} aria-label="Limpar filtros do NeuroTime" title="Limpar filtros">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
};
