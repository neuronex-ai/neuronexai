"use client";

import { Clock3, Network, Orbit } from "lucide-react";

import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";

export type NeuroVisionArea = "vision" | "neurotime";
export type NeuroVisionDimension = "2d" | "3d";

const AREA_OPTIONS = [
  { value: "vision", label: <><Network className="h-3.5 w-3.5" aria-hidden="true" /> Vision</> },
  { value: "neurotime", label: <><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> NeuroTime</> },
] as const;

const DIMENSION_OPTIONS = [
  { value: "2d", label: "2D" },
  { value: "3d", label: <><Orbit className="h-3.5 w-3.5" aria-hidden="true" /> 3D</> },
] as const;

type NeuroVisionPresentationSwitcherProps = {
  area: NeuroVisionArea;
  dimension: NeuroVisionDimension;
  onAreaChange: (area: NeuroVisionArea) => void;
  onDimensionChange: (dimension: NeuroVisionDimension) => void;
};

export const NeuroVisionPresentationSwitcher = ({
  area,
  dimension,
  onAreaChange,
  onDimensionChange,
}: NeuroVisionPresentationSwitcherProps) => (
  <div className="neurovision-presentation-shell pointer-events-auto flex items-center gap-1 rounded-[20px] border border-black/[0.075] bg-white/88 p-1 shadow-[0_22px_64px_-38px_rgba(24,24,27,0.34),inset_0_1px_0_rgba(255,255,255,0.96)] backdrop-blur-2xl dark:border-white/[0.09] dark:bg-[#08080a]/76 dark:shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)]">
    <MagneticSegmentedControl
      value={area}
      onValueChange={onAreaChange}
      options={AREA_OPTIONS}
      ariaLabel="Área do NeuroVision"
      behavior="single-select"
      id="neurovision-area"
      indicatorId="neurovision-area-indicator"
      className="min-h-11 bg-transparent"
      triggerClassName="min-h-10 rounded-[13px] px-3 text-[11px]"
    />
    {area === "vision" ? (
      <>
        <span className="mx-0.5 h-7 w-px bg-black/[0.075] dark:bg-white/[0.09]" aria-hidden="true" />
        <MagneticSegmentedControl
          value={dimension}
          onValueChange={onDimensionChange}
          options={DIMENSION_OPTIONS}
          ariaLabel="Dimensão do NeuroVision"
          behavior="single-select"
          id="neurovision-dimension"
          indicatorId="neurovision-dimension-indicator"
          className="min-h-11 bg-transparent"
          triggerClassName="min-h-10 rounded-[13px] px-3 text-[11px]"
        />
      </>
    ) : null}
  </div>
);

