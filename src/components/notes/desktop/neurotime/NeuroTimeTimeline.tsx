import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { neuroTimeTemperatureColor } from "../../clinical-evidence/neurotime-model";
import type { NeuroTimeCampoTemporal, NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";
import { NeuroTimeToolcard } from "./NeuroTimeToolcard";

type NeuroTimeTimelineProps = {
  field: NeuroTimeCampoTemporal;
  darkMode: boolean;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const segmentLabel = (singularity: NeuroTimeSingularidade) => {
  const parts = [
    singularity.label,
    `densidade ${percent(singularity.density)}`,
    `atenção ${percent(singularity.attention)}`,
    `${singularity.eventCount} ${singularity.eventCount === 1 ? "registro" : "registros"}`,
  ];
  if (singularity.recordedRisk) {
    parts.push(`risco registrado ${singularity.recordedRisk.valor} de ${singularity.recordedRisk.escala}`);
  } else {
    parts.push("risco não informado neste período");
  }
  return parts.join(", ");
};

export const NeuroTimeTimeline = ({ field, darkMode }: NeuroTimeTimelineProps) => {
  const reducedMotion = useReducedMotion();
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [rovingIndex, setRovingIndex] = useState(0);
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

  return (
    <section className="relative min-h-[510px]" aria-label="Horizonte temporal clínico">
      <div className="absolute inset-x-0 top-[70px] flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.17em] text-white/28 [.light_&]:text-zinc-400" aria-hidden="true">
        <span>Histórico</span>
        <span>Agora</span>
      </div>

      <div
        className="absolute inset-x-0 top-[82px] h-[70px]"
        role="group"
        aria-label="Use as setas para percorrer o tempo, Enter para fixar e Escape para fechar"
        onPointerLeave={() => {
          if (!pinnedId) setActiveId(null);
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.08] [.light_&]:bg-black/[0.08]" />
        <motion.div
          className="relative flex h-full items-center"
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { delayChildren: 0.08, staggerChildren: 0.025 } },
          }}
        >
          {field.singularities.map((singularity, index) => {
            const color = singularity.eventCount
              ? neuroTimeTemperatureColor(singularity.thermalScore, darkMode)
              : darkMode ? "rgba(255,255,255,0.075)" : "rgba(24,24,27,0.09)";
            const previous = field.singularities[index - 1];
            const previousColor = previous?.eventCount
              ? neuroTimeTemperatureColor(previous.thermalScore, darkMode)
              : color;
            const visibleHeight = singularity.eventCount ? 5 + singularity.density * 25 : 2;
            const active = activeSingularity?.id === singularity.id;
            const opacity = singularity.eventCount ? 0.45 + singularity.recency * 0.52 : 0.72;
            return (
              <motion.button
                key={singularity.id}
                ref={(node) => { segmentRefs.current[index] = node; }}
                type="button"
                tabIndex={index === rovingIndex ? 0 : -1}
                aria-label={segmentLabel(singularity)}
                aria-pressed={pinnedId === singularity.id}
                title={singularity.compactLabel}
                onFocus={() => {
                  setRovingIndex(index);
                  setActiveId(singularity.id);
                }}
                onBlur={() => {
                  if (!pinnedId) setActiveId(null);
                }}
                onPointerEnter={() => {
                  if (!pinnedId) setActiveId(singularity.id);
                }}
                onClick={() => {
                  setActiveId(singularity.id);
                  setPinnedId((current) => current === singularity.id ? null : singularity.id);
                }}
                onKeyDown={(event) => handleKeyDown(event, index, singularity)}
                variants={{
                  hidden: { opacity: 0, scaleX: 0.25 },
                  visible: { opacity: 1, scaleX: 1 },
                }}
                transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30, mass: 0.72 }}
                style={{ transformOrigin: "left center" }}
                className={cn(
                  "group/segment relative flex h-14 min-w-0 flex-1 items-center focus-visible:z-20 focus-visible:outline-none",
                  "focus-visible:after:absolute focus-visible:after:inset-x-0 focus-visible:after:inset-y-1 focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-white/60",
                  "[.light_&]:focus-visible:after:ring-zinc-950/45",
                )}
              >
                <motion.span
                  aria-hidden="true"
                  animate={{
                    height: active ? Math.max(10, visibleHeight + 5) : visibleHeight,
                    opacity: active ? 1 : opacity,
                    scaleY: active ? 1.12 : 1,
                  }}
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  className={cn(
                    "absolute inset-x-[-1px] top-1/2 -translate-y-1/2 rounded-full",
                    singularity.recordedRisk && "ring-1 ring-red-300/75 [.light_&]:ring-red-600/70",
                  )}
                  style={{
                    background: `linear-gradient(90deg, ${previousColor}, ${color})`,
                    boxShadow: active && singularity.eventCount
                      ? `0 0 24px ${color}66, 0 0 7px ${color}88`
                      : singularity.eventCount
                        ? `0 0 ${6 + singularity.recency * 10}px ${color}2f`
                        : "none",
                  }}
                />
                {singularity.recordedRisk ? (
                  <ShieldAlert aria-hidden="true" className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 text-red-200 drop-shadow-[0_0_7px_rgba(248,113,113,0.7)] [.light_&]:text-red-700" />
                ) : null}
                {(index === 0 || index === field.singularities.length - 1 || index === Math.floor(field.singularities.length / 2)) ? (
                  <span aria-hidden="true" className="absolute left-1/2 top-[58px] -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-white/28 [.light_&]:text-zinc-400">
                    {singularity.compactLabel}
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {activeSingularity ? (
          <motion.div
            key={activeSingularity.id}
            initial={reducedMotion ? { opacity: 0, x: cardPlacement.x } : { opacity: 0, x: cardPlacement.x, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, x: cardPlacement.x, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0, x: cardPlacement.x } : { opacity: 0, x: cardPlacement.x, y: 5, scale: 0.99 }}
            transition={reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34, mass: 0.72 }}
            className={cn("absolute top-[178px] z-30", cardPlacement.className)}
          >
            <NeuroTimeToolcard
              singularity={activeSingularity}
              pinned={pinnedId === activeSingularity.id}
              onClose={() => {
                setPinnedId(null);
                setActiveId(null);
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
