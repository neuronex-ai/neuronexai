import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Clock3, DatabaseZap, Focus, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Patient, PersonalNote } from "@/types";
import type { EvidenceNode } from "../../clinical-evidence/evidence-types";
import { mergeNeuroTimeEvidence, type NeuroTimeFlowDisponivel } from "../../clinical-evidence/neurotime-adapter";
import {
  buildNeuroTimeCampoTemporal,
  buildNeuroTimeHorizonteDeEventos,
  neuroTimeTemperatureColor,
} from "../../clinical-evidence/neurotime-model";
import {
  NEUROTIME_NOMENCLATURA,
  type NeuroTimeFiltros,
  type NeuroTimeFonte,
} from "../../clinical-evidence/neurotime-types";
import { NeuroTimeLegend } from "./NeuroTimeLegend";
import { NeuroTimeTimeline } from "./NeuroTimeTimeline";
import { NeuroTimeToolbar } from "./NeuroTimeToolbar";

type NeuroTimeViewProps = {
  patients: Patient[];
  notes: PersonalNote[];
  flows: NeuroTimeFlowDisponivel[];
  evidence: EvidenceNode[];
  evidenceAvailable: boolean;
  isLoading: boolean;
  darkMode: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
};

const DEFAULT_FILTERS: NeuroTimeFiltros = {
  patientIds: [],
  sources: [],
  period: "1-ano",
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const NeuroTimeLoading = () => (
  <div className="rounded-[32px] border border-white/[0.075] bg-white/[0.025] p-6 [.light_&]:border-black/[0.06] [.light_&]:bg-white/54" role="status" aria-label="Carregando NeuroTime">
    <div className="flex items-center justify-between gap-6">
      <Skeleton className="h-10 w-72 rounded-2xl bg-white/[0.07] [.light_&]:bg-black/[0.06]" />
      <Skeleton className="h-9 w-40 rounded-2xl bg-white/[0.06] [.light_&]:bg-black/[0.05]" />
    </div>
    <div className="mt-16 flex h-24 items-center gap-1.5">
      {Array.from({ length: 14 }, (_, index) => (
        <Skeleton key={index} className="flex-1 rounded-full bg-white/[0.07] [.light_&]:bg-black/[0.055]" style={{ height: 4 + ((index * 11) % 24) }} />
      ))}
    </div>
    <span className="sr-only">Organizando o horizonte de eventos.</span>
  </div>
);

const NeuroTimePatientLayers = ({
  patientFields,
  totalCount,
  darkMode,
  onSelectPatient,
}: {
  patientFields: Array<{ patient: Patient; eventCount: number; field: ReturnType<typeof buildNeuroTimeCampoTemporal> }>;
  totalCount: number;
  darkMode: boolean;
  onSelectPatient: (patientId: string) => void;
}) => {
  if (totalCount < 2) return null;
  return (
    <section className="mt-2 border-t border-white/[0.065] pt-5 [.light_&]:border-black/[0.055]" aria-labelledby="neurotime-patient-layers-title">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 id="neurotime-patient-layers-title" className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/46 [.light_&]:text-zinc-500">Campos mais ativos</h3>
          <p className="mt-1 text-[10px] text-white/28 [.light_&]:text-zinc-400">Selecione um paciente para ampliar sua trajetória.</p>
        </div>
        <span className="text-[9px] font-semibold tabular-nums text-white/28 [.light_&]:text-zinc-400">{totalCount} campos</span>
      </div>
      <div className="grid gap-1.5">
        {patientFields.map(({ patient, field, eventCount }) => (
          <button
            key={patient.id}
            type="button"
            onClick={() => onSelectPatient(patient.id)}
            className={cn(
              "group/layer grid min-h-11 grid-cols-[minmax(130px,190px)_1fr_auto] items-center gap-4 rounded-[15px] px-3 text-left",
              "border border-transparent transition-colors hover:border-white/[0.07] hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              "motion-reduce:transition-none [.light_&]:hover:border-black/[0.055] [.light_&]:hover:bg-black/[0.025] [.light_&]:focus-visible:ring-zinc-950/30",
            )}
            aria-label={`Abrir campo temporal de ${patient.name}, ${eventCount} registros`}
          >
            <span className="truncate text-[11px] font-semibold text-white/58 group-hover/layer:text-white/82 [.light_&]:text-zinc-600 [.light_&]:group-hover/layer:text-zinc-900">{patient.name}</span>
            <span className="flex h-5 items-center" aria-hidden="true">
              {field.singularities.map((singularity) => {
                const color = singularity.eventCount
                  ? neuroTimeTemperatureColor(singularity.thermalScore, darkMode)
                  : darkMode ? "rgba(255,255,255,0.055)" : "rgba(24,24,27,0.07)";
                return (
                  <span
                    key={singularity.id}
                    className={cn("-mr-px min-w-0 flex-1 rounded-full", singularity.recordedRisk && "ring-1 ring-red-300/65 [.light_&]:ring-red-600/65")}
                    style={{
                      height: singularity.eventCount ? 2 + singularity.density * 9 : 1,
                      background: color,
                      opacity: singularity.eventCount ? 0.46 + singularity.recency * 0.5 : 1,
                    }}
                  />
                );
              })}
            </span>
            <span className="text-[9px] font-semibold tabular-nums text-white/28 [.light_&]:text-zinc-400">{eventCount}</span>
          </button>
        ))}
      </div>
      {totalCount > patientFields.length ? (
        <p className="mt-2 pl-3 text-[9px] text-white/28 [.light_&]:text-zinc-400">Mais {totalCount - patientFields.length} pacientes fazem parte do campo geral.</p>
      ) : null}
    </section>
  );
};

export const NeuroTimeView = ({
  patients,
  notes,
  flows,
  evidence,
  evidenceAvailable,
  isLoading,
  darkMode,
  isFullscreen,
  onToggleFullscreen,
}: NeuroTimeViewProps) => {
  const reducedMotion = useReducedMotion();
  const [filters, setFilters] = useState<NeuroTimeFiltros>(DEFAULT_FILTERS);
  const mergedEvidence = useMemo(() => mergeNeuroTimeEvidence({ evidence, notes, flows }), [evidence, flows, notes]);
  const events = useMemo(() => buildNeuroTimeHorizonteDeEventos(mergedEvidence, patients), [mergedEvidence, patients]);
  const availableSources = useMemo(() => new Set(events.map((event) => event.fonte)), [events]);
  const field = useMemo(() => buildNeuroTimeCampoTemporal({ events, patients, filters }), [events, filters, patients]);
  const patientLayerSummary = useMemo(() => {
    const counts = new Map<string, number>();
    field.singularities.flatMap((singularity) => singularity.events).forEach((event) => {
      counts.set(event.patientId, (counts.get(event.patientId) || 0) + 1);
    });
    const rankedPatients = patients
      .filter((patient) => counts.has(patient.id))
      .sort((left, right) => (counts.get(right.id) || 0) - (counts.get(left.id) || 0) || left.name.localeCompare(right.name, "pt-BR"));
    return {
      totalCount: rankedPatients.length,
      patientFields: rankedPatients.slice(0, 7).map((patient) => ({
        patient,
        eventCount: counts.get(patient.id) || 0,
        field: buildNeuroTimeCampoTemporal({
          events,
          patients,
          filters: { ...filters, patientIds: [patient.id] },
          bounds: { startAt: field.startAt, endAt: field.endAt },
        }),
      })),
    };
  }, [events, field.endAt, field.startAt, filters, patients]);

  const handleFiltersChange = (next: NeuroTimeFiltros) => setFilters(next);
  const filteredEmpty = !isLoading && field.eventCount === 0 && !field.hasRecordedRisk;

  return (
    <MotionConfig reducedMotion="user">
      <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain px-6 pb-12 pt-[86px] lg:px-9" data-neurotime-view="true">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[1440px]"
        >
          <header className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-white/32 [.light_&]:text-zinc-400">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> NeuroTime
              </div>
              <h1 className="mt-2 text-[clamp(1.55rem,2vw,2.25rem)] font-semibold tracking-[-0.035em] text-white/92 [.light_&]:text-zinc-950">
                {NEUROTIME_NOMENCLATURA.horizonte}
              </h1>
              <p className="mt-1 text-xs text-white/38 [.light_&]:text-zinc-500">A trajetória clínica, do primeiro registro até agora.</p>
            </div>
            {!isLoading && field.eventCount > 0 ? (
              <div className="flex items-center gap-3 text-[10px] font-semibold text-white/34 [.light_&]:text-zinc-400">
                <span>{field.eventCount} registros</span>
                <span className="h-1 w-1 rounded-full bg-white/20 [.light_&]:bg-black/20" aria-hidden="true" />
                <span>{field.sourceCount} {field.sourceCount === 1 ? "fonte" : "fontes"}</span>
                <span className="h-1 w-1 rounded-full bg-white/20 [.light_&]:bg-black/20" aria-hidden="true" />
                <span>{field.patientCount} {field.patientCount === 1 ? "paciente" : "pacientes"}</span>
              </div>
            ) : null}
          </header>

          <div className="mt-6">
            <NeuroTimeToolbar
              patients={patients}
              filters={filters}
              availableSources={availableSources as Set<NeuroTimeFonte>}
              onChange={handleFiltersChange}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
            />
          </div>

          <main className="relative mt-4 overflow-hidden rounded-[34px] border border-white/[0.075] bg-[#070708]/46 p-5 shadow-[0_32px_110px_-58px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-2xl lg:p-7 [.light_&]:border-black/[0.06] [.light_&]:bg-white/54 [.light_&]:shadow-[0_32px_100px_-58px_rgba(24,24,27,0.42),inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div className="pointer-events-none absolute inset-x-[12%] top-16 h-36 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(81,67,184,0.095),transparent_68%)] blur-3xl [.light_&]:opacity-55" aria-hidden="true" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30 [.light_&]:text-zinc-400">{NEUROTIME_NOMENCLATURA.campo}</p>
                <p className="mt-1 text-xs font-semibold text-white/58 [.light_&]:text-zinc-600">
                  {filters.patientIds.length === 1
                    ? patients.find((patient) => patient.id === filters.patientIds[0])?.name || "Paciente selecionado"
                    : filters.patientIds.length > 1
                      ? `${filters.patientIds.length} pacientes selecionados`
                      : "Visão clínica geral"}
                </p>
              </div>
              <NeuroTimeLegend />
            </div>

            {!evidenceAvailable && events.length > 0 ? (
              <div className="relative mt-4 flex items-center gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[9px] text-white/32 [.light_&]:border-black/[0.05] [.light_&]:bg-black/[0.02] [.light_&]:text-zinc-400" role="status">
                <DatabaseZap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                O horizonte usa as notas e os fluxos disponíveis; outras fontes surgirão quando houver registros neste campo.
              </div>
            ) : null}

            <div className="relative mt-2">
              {isLoading ? <NeuroTimeLoading /> : null}
              {filteredEmpty ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center" role="status">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/[0.08] bg-white/[0.04] text-white/42 [.light_&]:border-black/[0.065] [.light_&]:bg-black/[0.025] [.light_&]:text-zinc-500">
                    <Focus className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-sm font-semibold text-white/76 [.light_&]:text-zinc-800">Nenhum evento neste recorte</h2>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-white/34 [.light_&]:text-zinc-500">Amplie o período ou volte a todas as fontes para reencontrar a trajetória.</p>
                  <Button type="button" variant="outline" className="mt-5 min-h-11 rounded-[15px] border-white/[0.09] bg-white/[0.045] text-xs text-white/68 hover:bg-white/[0.08] hover:text-white [.light_&]:border-black/[0.07] [.light_&]:bg-white [.light_&]:text-zinc-700 [.light_&]:hover:bg-zinc-50 [.light_&]:hover:text-zinc-950" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Restaurar campo geral
                  </Button>
                </div>
              ) : null}
              {!isLoading && !filteredEmpty ? (
                <>
                  <NeuroTimeTimeline field={field} darkMode={darkMode} />
                  <NeuroTimePatientLayers
                    patientFields={patientLayerSummary.patientFields}
                    totalCount={patientLayerSummary.totalCount}
                    darkMode={darkMode}
                    onSelectPatient={(patientId) => setFilters((current) => ({ ...current, patientIds: [patientId] }))}
                  />
                </>
              ) : null}
            </div>

            {!isLoading && !filteredEmpty ? (
              <footer className="relative mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4 text-[9px] text-white/28 [.light_&]:border-black/[0.05] [.light_&]:text-zinc-400">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Risco exibido somente quando registrado.</span>
                <span>Densidade {percent(Math.max(...field.singularities.map((item) => item.density), 0))} no ponto mais intenso.</span>
              </footer>
            ) : null}
          </main>
        </motion.div>
      </div>
    </MotionConfig>
  );
};

export default NeuroTimeView;
