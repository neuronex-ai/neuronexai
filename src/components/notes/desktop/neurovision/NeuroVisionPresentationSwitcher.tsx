"use client";

import { motion } from "framer-motion";
import { Clock3, Network } from "lucide-react";
import type { ReactNode } from "react";

import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { cn } from "@/lib/utils";

export type NeuroVisionArea = "vision" | "neurotime";
export type NeuroVisionDimension = "2d" | "3d";

const DIMENSION_OPTIONS = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
] as const;

type NeuroVisionPresentationSwitcherProps = {
  area: NeuroVisionArea;
  dimension: NeuroVisionDimension;
  onAreaChange: (area: NeuroVisionArea) => void;
  onDimensionChange: (dimension: NeuroVisionDimension) => void;
};

const areaTriggerClass =
  "dashboard-segment-trigger relative isolate inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[13px] border border-transparent px-3 py-2 text-[11px] font-semibold text-muted-foreground ring-offset-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px active:scale-[0.985] motion-reduce:active:translate-y-0 motion-reduce:active:scale-100";

export const NeuroVisionPresentationSwitcher = ({
  area,
  dimension,
  onAreaChange,
  onDimensionChange,
}: NeuroVisionPresentationSwitcherProps) => {
  const reducedMotion = useReducedMotionPreference();
  const indicatorTransition = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 410, damping: 35, mass: 0.78 };

  const areaButton = (value: NeuroVisionArea, label: string, icon: ReactNode) => {
    const active = area === value;
    return (
      <button
        type="button"
        className={cn(areaTriggerClass, active && "text-foreground")}
        onClick={() => onAreaChange(value)}
        aria-pressed={active}
      >
        {active ? (
          <motion.span
            layoutId="neurovision-area-indicator"
            aria-hidden="true"
            className="dashboard-segment-indicator absolute inset-0 -z-10 rounded-[inherit]"
            transition={indicatorTransition}
          />
        ) : null}
        <span className="relative z-10 inline-flex items-center gap-2">{icon}{label}</span>
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Visualização do NeuroVision"
      className="neurovision-presentation-shell pointer-events-auto flex items-center gap-1 rounded-[20px] border border-black/[0.075] bg-white/88 p-1 shadow-[0_22px_64px_-38px_rgba(24,24,27,0.34),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-2xl dark:border-white/[0.09] dark:bg-[#08080a]/76 dark:shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]"
    >
      <div
        role="group"
        aria-label="Vision em 2D ou 3D"
        className={cn(
          "neurovision-vision-cluster flex items-center gap-1 rounded-[16px] border p-0.5 transition-[border-color,background-color,box-shadow,opacity] duration-200 motion-reduce:transition-none",
          area === "vision"
            ? "border-black/[0.075] bg-black/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.64)] dark:border-white/[0.10] dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]"
            : "border-transparent bg-transparent opacity-72 hover:opacity-100",
        )}
      >
        {areaButton("vision", "Vision", <Network className="h-3.5 w-3.5" aria-hidden="true" />)}
        <MagneticSegmentedControl
          value={dimension}
          onValueChange={onDimensionChange}
          options={DIMENSION_OPTIONS}
          ariaLabel="Dimensão do Vision"
          behavior="single-select"
          id="neurovision-dimension"
          indicatorId="neurovision-dimension-indicator"
          className="neurovision-dimension-segment min-h-10 gap-0.5 rounded-[13px] bg-transparent p-0"
          triggerClassName="min-h-9 rounded-[11px] px-3 text-[11px]"
        />
      </div>

      <span className="mx-0.5 h-7 w-px bg-black/[0.075] dark:bg-white/[0.09]" aria-hidden="true" />
      {areaButton("neurotime", "NeuroTime", <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />)}
    </div>
  );
};
