"use client";

import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { cn } from "@/lib/utils";
import type { NeuroView3DFilter } from "../../neuroview-3d/model";

export const NEUROVISION_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "patients", label: "Pacientes" },
  { value: "recent", label: "Recentes" },
  { value: "risk", label: "Em risco" },
] as const;

type NeuroVisionFilterBarProps = {
  value: NeuroView3DFilter;
  onValueChange: (value: NeuroView3DFilter) => void;
  ariaLabel: string;
  darkMode: boolean;
  className?: string;
};

export const NeuroVisionFilterBar = ({
  value,
  onValueChange,
  ariaLabel,
  darkMode,
  className,
}: NeuroVisionFilterBarProps) => (
  <div
    className={cn(
      "neurovision-filter-shell rounded-[20px] border p-1 shadow-2xl backdrop-blur-2xl",
      darkMode
        ? "border-white/10 bg-black/52"
        : "border-black/[0.075] bg-white/88 shadow-[0_20px_52px_-34px_rgba(24,24,27,0.34),inset_0_1px_0_rgba(255,255,255,0.96)]",
      className,
    )}
  >
    <MagneticSegmentedControl
      value={value}
      onValueChange={onValueChange}
      options={NEUROVISION_FILTER_OPTIONS}
      ariaLabel={ariaLabel}
      behavior="single-select"
      className="min-h-11 bg-transparent"
      triggerClassName="min-h-10 px-3 text-[11px] xl:px-4"
    />
  </div>
);

