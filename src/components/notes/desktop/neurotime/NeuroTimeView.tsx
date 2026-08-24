import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { DatabaseZap, Focus, ShieldCheck } from "lucide-react";
import { useId, useMemo, useState } from "react";

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
import { buildNeuroTimeRibbonGeometry } from "./neurotime-ribbon-geometry";

type NeuroTimeViewProps = {
  patients: Patient[];
  notes: PersonalNote[];
  flows: NeuroTimeFlowDisponivel[];
  evidence: EvidenceNode[];
  evidenceAvailable: boolean;
  isLoading: boolean;
  darkMode: boolean;
  portalContainer?: HTMLElement | null;
};

const DEFAULT_FILTERS: NeuroTimeFiltros = {
  patientIds: [],
  sources: [],
  period: "1-ano",
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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
    <section className="mt-0 border-t border-white/[0.065] pt-4 [.light_&]:border-black/[0.055]" aria-labelledby="neurotime-patient-layers-title">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <h3 id="neurotime-patient-layers-title" className="text-[10px] font-bold uppercase tracking-[0.17em] text-white/46 [.light_&]:text-zinc-500">Campos mais ativos</h3>
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
              "neurotime-contained-row group/layer grid min-h-11 grid-cols-[minmax(130px,190px)_1fr_auto] items-center gap-4 rounded-[15px] px-3 text-left",
              "border border-transparent transition-colors hover:border-white/[0.07] hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              "motion-reduce:transition-none [.light_&]:hover:border-black/[0.055] [.light_&]:hover:bg-black/[0.025] [.light_&]:focus-visible:ring-zinc-950/30",
            )}
            aria-label={`Abrir campo temporal de ${patient.name}, ${eventCount} registros`}
          >
            <span className="truncate text-[11px] font-semibold text-white/58 group-hover/layer:text-white/82 [.light_&]:text-zinc-600 [.light_&]:group-hover/layer:text-zinc-900">{patient.name}</span>
            <NeuroTimePatientRibbon field={field} darkMode={darkMode} />
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

const NeuroTimePatientRibbon = ({
  field,
  darkMode,
}: {
  field: ReturnType<typeof buildNeuroTimeCampoTemporal>;
  darkMode: boolean;
}) => {
  const reducedMotion = useReducedMotion();
  const gradientId = `neurotime-layer-ribbon-${useId().replace(/:/g, "")}`;
  const geometry = useMemo(() => buildNeuroTimeRibbonGeometry(field.singularities), [field.singularities]);
  const first = field.singularities[0];
  const last = field.singularities[field.singularities.length - 1];

  return (
    <span className="relative flex h-9 items-center" aria-hidden="true">
      <span className={cn("absolute inset-x-0 top-1/2 h-px -translate-y-1/2", darkMode ? "bg-white/[0.045]" : "bg-zinc-950/[0.055]")} />
      <svg viewBox="0 0 1000 68" preserveAspectRatio="none" className="absolute inset-x-0 top-1/2 h-9 w-full -translate-y-1/2 overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={neuroTimeTemperatureColor(first?.thermalScore || 0, darkMode)} stopOpacity={first?.eventCount ? 0.56 : 0.12} />
            {field.singularities.map((singularity) => (
              <stop
                key={singularity.id}
                offset={`${clamp01(singularity.centroNormalizado) * 100}%`}
                stopColor={neuroTimeTemperatureColor(singularity.thermalScore, darkMode)}
                stopOpacity={singularity.eventCount ? 0.38 + singularity.recency * 0.46 : 0.1}
              />
            ))}
            <stop offset="100%" stopColor={neuroTimeTemperatureColor(last?.thermalScore || 0, darkMode)} stopOpacity={last?.eventCount ? 0.68 : 0.12} />
          </linearGradient>
        </defs>
        <motion.g
          initial={reducedMotion ? false : { scaleX: 0, opacity: 0.42 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.74, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "0px 34px" }}
        >
          <path
            d={geometry.areaPath}
            fill={`url(#${gradientId})`}
            style={{ filter: darkMode ? "drop-shadow(0 0 6px rgba(88,93,188,0.16))" : "drop-shadow(0 2px 5px rgba(54,66,116,0.10))" }}
          />
          <path d={geometry.centerPath} fill="none" stroke={darkMode ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.56)"} strokeWidth="0.7" />
        </motion.g>
        {field.singularities.some((singularity) => singularity.recordedRisk) ? (
          field.singularities.map((singularity) => singularity.recordedRisk ? (
            <circle
              key={singularity.id}
              cx={clamp01(singularity.centroNormalizado) * 1000}
              cy="34"
              r="3.2"
              fill={darkMode ? "rgba(248,113,113,0.82)" : "rgba(185,28,28,0.78)"}
            />
          ) : null)
        ) : null}
      </svg>
    </span>
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
  portalContainer,
}: NeuroTimeViewProps) => {
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
    const visiblePatients = rankedPatients.slice(0, 7);
    return {
      totalCount: rankedPatients.length,
      patientFields: visiblePatients.map((patient) => ({
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
  }, [events, field.endAt, field.singularities, field.startAt, filters, patients]);

  const handleFiltersChange = (next: NeuroTimeFiltros) => setFilters(next);
  const filteredEmpty = !isLoading && field.eventCount === 0 && !field.hasRecordedRisk;

  return (
    <MotionConfig reducedMotion="user">
      <div className="neurotime-scroll-region absolute inset-0 z-20 overflow-y-auto overscroll-contain px-6 pb-12 pt-6 lg:px-9 lg:pt-7" data-neurotime-view="true">
        <div className="mx-auto w-full max-w-[1440px]">
          <header className="pr-0 lg:pr-[430px]">
            <div>
              <h1 className="text-[clamp(1.55rem,2vw,2.25rem)] font-semibold tracking-[-0.035em] text-white/92 [.light_&]:text-zinc-950">
                {NEUROTIME_NOMENCLATURA.horizonte}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Resumo do campo temporal">
                {[
                  `${field.eventCount} ${field.eventCount === 1 ? "registro" : "registros"}`,
                  `${field.sourceCount} ${field.sourceCount === 1 ? "fonte" : "fontes"}`,
                  `${field.patientCount} ${field.patientCount === 1 ? "paciente" : "pacientes"}`,
                ].map((label) => (
                  <span key={label} className={cn(
                    "inline-flex min-h-6 items-center rounded-full border px-2.5 text-[9px] font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.065)]",
                    darkMode ? "border-white/[0.075] bg-white/[0.035] text-white/48" : "border-black/[0.06] bg-white/72 text-zinc-500 shadow-[0_10px_24px_-22px_rgba(24,24,27,0.28),inset_0_1px_0_rgba(255,255,255,0.98)]",
                  )}>{isLoading ? "—" : label}</span>
                ))}
              </div>
            </div>
          </header>

          <main className={cn(
            "neurotime-field-surface relative mt-5 overflow-visible rounded-[32px] border p-5 lg:p-6",
            darkMode
              ? "border-white/[0.075] bg-[#070708]/78 shadow-[0_30px_96px_-58px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.052)]"
              : "border-black/[0.06] bg-white/92 shadow-[0_28px_86px_-58px_rgba(24,24,27,0.26),inset_0_1px_0_rgba(255,255,255,0.98)]",
          )}>
            <div className="pointer-events-none absolute inset-x-[12%] top-16 h-36 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(81,67,184,0.09),transparent_68%)] opacity-70 [.light_&]:opacity-45" aria-hidden="true" />
            <div className="relative flex flex-wrap items-center justify-between gap-5">
              <NeuroTimeLegend darkMode={darkMode} portalContainer={portalContainer} />
              <div className="flex max-w-[760px] items-center justify-end">
                <NeuroTimeToolbar
                  patients={patients}
                  filters={filters}
                  availableSources={availableSources as Set<NeuroTimeFonte>}
                  onChange={handleFiltersChange}
                  darkMode={darkMode}
                  portalContainer={portalContainer}
                />
              </div>
            </div>

            <div className="relative mt-1">
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
              <footer className="relative mt-5 space-y-3 border-t border-white/[0.06] pt-4 text-[9px] text-white/28 [.light_&]:border-black/[0.05] [.light_&]:text-zinc-400">
                {!evidenceAvailable && events.length > 0 ? (
                  <div className="flex items-center gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[9px] text-white/32 [.light_&]:border-black/[0.05] [.light_&]:bg-black/[0.02] [.light_&]:text-zinc-400" role="status">
                    <DatabaseZap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    O horizonte usa as notas e os fluxos disponíveis; outras fontes surgirão quando houver registros neste campo.
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Risco exibido somente quando registrado.</span>
                  <span>Densidade {percent(Math.max(...field.singularities.map((item) => item.density), 0))} no ponto mais intenso.</span>
                </div>
              </footer>
            ) : null}
          </main>
        </div>
      </div>
    </MotionConfig>
  );
};

export default NeuroTimeView;
