"use client";

import { motion } from "framer-motion";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";

export type MagneticSegmentOption<Value extends string = string> = {
  value: Value;
  label: ReactNode;
  ariaLabel?: string;
};

type MagneticSegmentedControlProps<Options extends readonly MagneticSegmentOption[]> = {
  value: Options[number]["value"];
  onValueChange: (value: Options[number]["value"]) => void;
  options: Options;
  ariaLabel: string;
  id?: string;
  indicatorId?: string;
  className?: string;
  triggerClassName?: string;
  behavior?: "tabs" | "single-select";
};

export const MagneticSegmentedControl = <const Options extends readonly MagneticSegmentOption[]>({
  value,
  onValueChange,
  options,
  ariaLabel,
  id,
  indicatorId,
  className,
  triggerClassName,
  behavior = "tabs",
}: MagneticSegmentedControlProps<Options>) => {
  const generatedId = useId().replace(/:/g, "");
  const controlId = id || `magnetic-segment-${generatedId}`;
  const prefersReducedMotion = useReducedMotionPreference();
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAt = (index: number) => {
    const nextIndex = (index + options.length) % options.length;
    const nextOption = options[nextIndex];
    if (!nextOption) return;
    onValueChange(nextOption.value);
    triggerRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectAt(index + 1);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectAt(index - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectAt(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectAt(options.length - 1);
    }
  };

  return (
    <div
      role={behavior === "tabs" ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      className={cn(
        "dashboard-segment-list inline-flex min-h-12 items-center justify-center gap-1 rounded-[16px] p-0.5",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => {
              triggerRefs.current[index] = node;
            }}
            id={`${controlId}-tab-${option.value}`}
            type="button"
            role={behavior === "tabs" ? "tab" : "radio"}
            aria-label={option.ariaLabel}
            aria-selected={behavior === "tabs" ? active : undefined}
            aria-checked={behavior === "single-select" ? active : undefined}
            aria-controls={behavior === "tabs" ? `${controlId}-panel-${option.value}` : undefined}
            tabIndex={active ? 0 : -1}
            data-state={active ? "active" : "inactive"}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "dashboard-segment-trigger relative isolate inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[12px] border border-transparent px-4 py-2",
              "text-sm font-semibold text-muted-foreground ring-offset-background",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "active:translate-y-px active:scale-[0.985] motion-reduce:active:translate-y-0 motion-reduce:active:scale-100",
              active && "text-foreground",
              triggerClassName,
            )}
          >
            {active ? (
              <motion.span
                layoutId={indicatorId || `${controlId}-indicator`}
                aria-hidden="true"
                className="dashboard-segment-indicator absolute inset-0 -z-10 rounded-[inherit]"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 410, damping: 35, mass: 0.78 }
                }
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
