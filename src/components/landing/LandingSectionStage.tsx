import type { ReactNode } from "react";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

type LandingSectionStageProps = {
  children: ReactNode;
  index: number;
  className?: string;
};

/**
 * Scroll-linked chapter wrapper for supporting public landing sections.
 * Main narrative scenes own their sticky choreography; this wrapper keeps the
 * remaining sections tied to scroll progress without updating React on pixels.
 */
export function LandingSectionStage({ children, index, className }: LandingSectionStageProps) {
  const chapterRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: chapterRef,
    offset: ["start 92%", "end 10%"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.18, 0.86, 1], [0.72, 1, 1, 0.86]);
  const y = useTransform(scrollYProgress, [0, 0.22, 1], [28, 0, -16]);
  const scale = useTransform(scrollYProgress, [0, 0.22, 1], [0.992, 1, 0.996]);
  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.22, 1],
    ["inset(4% 0% 0% 0% round 0px)", "inset(0% 0% 0% 0% round 0px)", "inset(0% 0% 3% 0% round 0px)"],
  );
  const dividerScale = useTransform(scrollYProgress, [0.06, 0.34], [0, 1]);
  const dividerOpacity = useTransform(scrollYProgress, [0.06, 0.22, 0.92], [0, 1, 0.38]);

  return (
    <div ref={chapterRef} className={`relative ${className ?? ""}`}>
      {index > 0 ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[12%] top-0 z-20 h-px origin-left bg-gradient-to-r from-transparent via-foreground/18 to-transparent"
          style={reduceMotion ? undefined : { scaleX: dividerScale, opacity: dividerOpacity }}
        />
      ) : null}
      <motion.div
        style={reduceMotion ? undefined : { opacity, y, scale, clipPath, willChange: "transform, opacity, clip-path" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
