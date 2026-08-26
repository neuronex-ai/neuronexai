"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import {
  HANDWRITING_PILOT_STROKE_WIDTH,
  HANDWRITING_PILOT_TEXT,
  HANDWRITING_PILOT_VIEWBOX,
  handwritingPilotStrokes,
} from "./handwriting-pilot-paths";

type HandwritingGreetingPilotProps = {
  className?: string;
};

export const HandwritingGreetingPilot = ({
  className,
}: HandwritingGreetingPilotProps) => (
  <div
    className={cn("w-full", className)}
    role="img"
    aria-label={HANDWRITING_PILOT_TEXT}
  >
    <svg
      viewBox={HANDWRITING_PILOT_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className="block h-auto w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <style>{`
        @keyframes neuronex-handwriting-pilot-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={HANDWRITING_PILOT_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {handwritingPilotStrokes.map((stroke, index) => (
          <path
            key={index}
            d={stroke.d}
            pathLength={stroke.length}
            style={
              {
                strokeDasharray: stroke.length,
                strokeDashoffset: stroke.length,
                animationName: "neuronex-handwriting-pilot-draw",
                animationDuration: `${stroke.durationMs}ms`,
                animationDelay: `${stroke.delayMs}ms`,
                animationTimingFunction: "cubic-bezier(0.33, 0, 0.2, 1)",
                animationFillMode: "forwards",
              } as CSSProperties
            }
          />
        ))}
      </g>
    </svg>
  </div>
);

export default HandwritingGreetingPilot;
