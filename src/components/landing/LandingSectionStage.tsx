import type { ReactNode } from "react";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

import { cn } from "@/lib/utils";

export type LandingSectionStageEffect =
  | "reveal"
  | "handoff"
  | "focus-in"
  | "zoom-out"
  | "none";

type LandingSectionStageProps = {
  children: ReactNode;
  index: number;
  className?: string;
  contentClassName?: string;
  /**
   * Enables a transition tied to the visitor's actual scroll progress.
   * It is opt-in so ordinary content sections remain compact and predictable.
   */
  progressLinked?: boolean;
  effect?: LandingSectionStageEffect;
  /**
   * Holds the scene in the viewport while its scroll-linked transition plays.
   * Use only for intentionally cinematic, viewport-sized scenes.
   */
  sticky?: boolean;
  stickyClassName?: string;
};

const effects: Record<
  Exclude<LandingSectionStageEffect, "reveal" | "none">,
  { opacity: number[]; y: number[]; scale: number[]; clipPath: string[] }
> = {
  handoff: {
    opacity: [0.28, 1, 1, 0.42],
    y: [42, 0, 0, -42],
    scale: [0.982, 1, 1, 0.972],
    clipPath: [
      "inset(5% 2% 0% 2% round 36px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 2% 7% 2% round 32px)",
    ],
  },
  "focus-in": {
    opacity: [0.18, 1, 1, 0.72],
    y: [56, 0, 0, -18],
    scale: [0.94, 1, 1, 0.985],
    clipPath: [
      "inset(11% 7% 5% 7% round 48px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 2% 0% round 16px)",
    ],
  },
  "zoom-out": {
    opacity: [0.32, 1, 1, 0.56],
    y: [34, 0, 0, -30],
    scale: [0.965, 1, 1, 0.93],
    clipPath: [
      "inset(4% 3% 0% 3% round 36px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(0% 0% 0% 0% round 0px)",
      "inset(7% 5% 7% 5% round 44px)",
    ],
  },
};

/**
 * Creates spatial continuity between public landing chapters.
 *
 * Normal sections keep a short one-shot reveal. Important chapters can opt
 * into `progressLinked`, making their entrance and handoff follow the actual
 * scroll position. `sticky` is intentionally separate because only compact,
 * viewport-sized scenes should occupy extra scroll space.
 */
export function LandingSectionStage({
  children,
  index,
  className,
  contentClassName,
  progressLinked = false,
  effect = "reveal",
  sticky = false,
  stickyClassName,
}: LandingSectionStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const delay = Math.min(index * 0.02, 0.12);
  const isProgressLinked = progressLinked && effect !== "none" && !reduceMotion;

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: sticky ? ["start start", "end end"] : ["start 92%", "end 8%"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 115,
    damping: 30,
    mass: 0.34,
    restDelta: 0.001,
  });

  const selectedEffect =
    effect === "handoff" || effect === "focus-in" || effect === "zoom-out"
      ? effects[effect]
      : effects.handoff;
  const opacity = useTransform(progress, [0, 0.16, 0.78, 1], selectedEffect.opacity);
  const y = useTransform(progress, [0, 0.2, 0.8, 1], selectedEffect.y);
  const scale = useTransform(progress, [0, 0.2, 0.8, 1], selectedEffect.scale);
  const clipPath = useTransform(progress, [0, 0.2, 0.8, 1], selectedEffect.clipPath);

  const usesOneShotReveal = !isProgressLinked && effect !== "none";

  return (
    <div
      ref={stageRef}
      data-landing-stage={index}
      data-stage-effect={effect}
      className={cn(
        "relative",
        sticky && "md:min-h-[132svh]",
        className,
      )}
    >
      <motion.div
        className={cn(
          "relative transform-gpu",
          sticky && "md:sticky md:top-0 md:min-h-svh md:overflow-hidden",
          stickyClassName,
          contentClassName,
        )}
        style={isProgressLinked ? { opacity, y, scale, clipPath } : undefined}
        initial={
          usesOneShotReveal && !reduceMotion
            ? { opacity: 0, y: 24, scale: 0.994 }
            : false
        }
        whileInView={
          usesOneShotReveal && !reduceMotion
            ? { opacity: 1, y: 0, scale: 1 }
            : undefined
        }
        viewport={{ once: true, amount: 0.1 }}
        transition={{
          duration: reduceMotion ? 0 : 0.72,
          delay: reduceMotion ? 0 : delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
