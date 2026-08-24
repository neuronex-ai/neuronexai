import { motion, useReducedMotion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { neuroTimeTemperatureColor } from "../../clinical-evidence/neurotime-model";
import type { NeuroTimeCampoTemporal, NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";
import { buildNeuroTimeRibbonGeometry } from "./neurotime-ribbon-geometry";
import { NeuroTimeToolcard } from "./NeuroTimeToolcard";

type NeuroTimeTimelineProps = {
  field: NeuroTimeCampoTemporal;
  darkMode: boolean;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const segmentLabel = (singularity: NeuroTimeSingularidade) => {
  const parts = [
    singularity.label,
    `densidade ${percent(singularity.density)}`,
    `atenção ${percent(singularity.attention)}`,
    `${singularity.eventCount} ${singularity.eventCount === 1 ? "registro" : "registros"}`,
  ];
  if (singularity.recordedRisk) parts.push(`risco registrado ${singularity.recordedRisk.valor} de ${singularity.recordedRisk.escala}`);
  else parts.push("risco não informado neste período");
  return parts.join(", ");
};

export const NeuroTimeTimeline = ({ field, darkMode }: NeuroTimeTimelineProps) => {
  const reducedMotion = useReducedMotion();
  const gradientId = `neurotime-ribbon-${useId().replace(/:/g, "")}`;
  const toolcardId = `neurotime-toolcard-${useId().replace(/:/g, "")}`;
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [rovingIndex, setRovingIndex] = useState(0);
  const geometry = useMemo(() => buildNeuroTimeRibbonGeometry(field.singularities), [field.singularities]);
  const activeSingularity = useMemo(() => (
    field.singularities.find((singularity) => singularity.id === (pinnedId || activeId)) || null
  ), [activeId, field.singularities, pinnedId]);
  const activeIndex = activeSingularity
    ? field.singularities.findIndex((singularity) => singularity.id === activeSingularity.id)
    : -1;

  useEffect(() => {
    const visibleIds = new Set(field.singularities.map((singularity) => singularity.id));
    setRovingIndex((current) => Math.max(0, Math.min(current, Math.max(0, field.singularities.length - 1))));
    setActiveId((current) => current && visibleIds.has(current) ? current : null);
    setPinnedId((current) => current && visibleIds.has(current) ? current : null);
  }, [field.singularities]);

  const focusAt = (index: number) => {
    const bounded = Math.max(0, Math.min(field.singularities.length - 1, index));
    const target = field.singularities[bounded];
    if (!target) return;
    setRovingIndex(bounded);
    setActiveId(target.id);
    segmentRefs.current[bounded]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number, singularity: NeuroTimeSingularidade) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(field.singularities.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveId(singularity.id);
      setPinnedId((current) => current === singularity.id ? null : singularity.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setPinnedId(null);
      setActiveId(null);
    }
  };

  const cardPlacement = activeIndex >= 0 && activeIndex <= 1
    ? { className: "left-0", x: "0%" }
    : activeIndex >= field.singularities.length - 2
      ? { className: "right-0", x: "0%" }
      : { className: "left-1/2", x: "-50%" };

  const first = field.singularities[0];
  const middle = field.singularities[Math.floor(field.singularities.length / 2)];
  const last = field.singularities[field.singularities.length - 1];

  return (
    <section
      className="relative min-h-[236px]"
      aria-label="Horizonte temporal clínico"
      onPointerLeave={() => { if (!pinnedId) setActiveId(null); }}
    >
      <div className={cn("absolute inset-x-0 top-3 flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[0.17em]", darkMode ? "text-white/28" : "text-zinc-400")} aria-hidden="true">
        <span>Histórico</span>
        <span>Agora</span>
      </div>

      <div className="absolute inset-x-0 top-[34px] h-[104px]" role="group" aria-label="Use as setas para percorrer o tempo, Enter para fixar e Escape para fechar">
        <div className={cn("pointer-events-none absolute inset-x-0 top-[42px] h-px", darkMode ? "bg-white/[0.065]" : "bg-black/[0.075]")} />
        <svg viewBox="0 0 1000 68" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-2 h-[68px] w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={neuroTimeTemperatureColor(first?.thermalScore || 0, darkMode)} stopOpacity={first?.eventCount ? 0.72 : 0.18} />
              {field.singularities.map((singularity) => (
                <stop
                  key={singularity.id}
                  offset={`${clamp01(singularity.centroNormalizado) * 100}%`}
                  stopColor={neuroTimeTemperatureColor(singularity.thermalScore, darkMode)}
                  stopOpacity={singularity.eventCount ? 0.5 + singularity.recency * 0.48 : 0.16}
                />
              ))}
              <stop offset="100%" stopColor={neuroTimeTemperatureColor(last?.thermalScore || 0, darkMode)} stopOpacity={last?.eventCount ? 0.9 : 0.18} />
            </linearGradient>
          </defs>
          <motion.g
            initial={reducedMotion ? false : { scaleX: 0, opacity: 0.35 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 24, mass: 0.9 }}
            style={{ transformOrigin: "0px 34px" }}
          >
            <path
              d={geometry.areaPath}
              fill={`url(#${gradientId})`}
              style={{ filter: darkMode ? "drop-shadow(0 0 10px rgba(90,105,205,0.22))" : "drop-shadow(0 3px 7px rgba(54,66,116,0.14))" }}
            />
            <path d={geometry.centerPath} fill="none" stroke={darkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.62)"} strokeWidth="0.8" />
          </motion.g>
        </svg>

        {activeSingularity ? (
          <motion.span
            aria-hidden="true"
            className={cn("pointer-events-none absolute top-[11px] h-[62px] w-px", darkMode ? "bg-white/36 shadow-[0_0_18px_rgba(255,255,255,0.26)]" : "bg-zinc-950/32 shadow-[0_0_14px_rgba(24,24,27,0.16)]")}
            animate={{ left: `${clamp01(activeSingularity.centroNormalizado) * 100}%` }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 38 }}
          />
        ) : null}

        {field.singularities.map((singularity, index) => {
          const left = clamp01(singularity.inicioNormalizado) * 100;
          const right = clamp01(singularity.fimNormalizado) * 100;
          const active = activeSingularity?.id === singularity.id;
          return (
            <button
              key={singularity.id}
              ref={(node) => { segmentRefs.current[index] = node; }}
              type="button"
              tabIndex={index === rovingIndex ? 0 : -1}
              aria-label={segmentLabel(singularity)}
              aria-pressed={pinnedId === singularity.id}
              aria-describedby={active ? toolcardId : undefined}
              title={singularity.compactLabel}
              onFocus={() => { setRovingIndex(index); setActiveId(singularity.id); }}
              onBlur={() => { if (!pinnedId) setActiveId(null); }}
              onPointerEnter={() => { if (!pinnedId) setActiveId(singularity.id); }}
              onClick={() => { setActiveId(singularity.id); setPinnedId((current) => current === singularity.id ? null : singularity.id); }}
              onKeyDown={(event) => handleKeyDown(event, index, singularity)}
              className={cn(
                "group/period absolute top-0 h-[84px] rounded-xl focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2",
                darkMode ? "focus-visible:ring-white/55" : "focus-visible:ring-zinc-950/42",
              )}
              style={{ left: `${left}%`, width: `${Math.max(0.45, right - left)}%` }}
            >
              <span className={cn("absolute inset-x-1 top-[22px] h-10 rounded-full transition-colors duration-150 motion-reduce:transition-none", active && (darkMode ? "bg-white/[0.045]" : "bg-zinc-950/[0.035]"))} aria-hidden="true" />
              {singularity.recordedRisk ? (
                <ShieldAlert aria-hidden="true" className={cn("absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2", darkMode ? "text-red-200 drop-shadow-[0_0_7px_rgba(248,113,113,0.7)]" : "text-red-700")} />
              ) : null}
            </button>
          );
        })}

        <div className={cn("pointer-events-none absolute inset-x-0 top-[82px] flex justify-between text-[8.5px] font-semibold", darkMode ? "text-white/27" : "text-zinc-400")} aria-hidden="true">
          <span>{first?.compactLabel}</span>
          <span>{middle?.compactLabel}</span>
          <span>{last?.compactLabel}</span>
        </div>
      </div>

      {activeSingularity ? (
        <motion.div
          id={toolcardId}
          initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.988 }}
          animate={{ opacity: 1, x: cardPlacement.x, y: 0, scale: 1 }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36, mass: 0.72 }}
          className={cn("absolute top-[142px] z-40", cardPlacement.className)}
        >
          <NeuroTimeToolcard
            singularity={activeSingularity}
            pinned={pinnedId === activeSingularity.id}
            darkMode={darkMode}
            onClose={() => { setPinnedId(null); setActiveId(null); }}
          />
        </motion.div>
      ) : null}
    </section>
  );
};
