import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type LandingSectionStageProps = {
  children: ReactNode;
  index: number;
  className?: string;
};

/**
 * Gives public landing sections a short, spatially continuous entrance as they
 * reach the viewport. Motion is deliberately one-shot: it clarifies sequence
 * during scrolling without turning the page into a looping visual effect.
 */
export function LandingSectionStage({ children, index, className }: LandingSectionStageProps) {
  const reduceMotion = useReducedMotion();
  const delay = Math.min(index * 0.025, 0.16);

  return (
    <motion.div
      className={`relative ${className ?? ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 36, scale: 0.992 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.82, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {index > 0 ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[12%] top-0 h-px origin-left bg-gradient-to-r from-transparent via-foreground/18 to-transparent"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          whileInView={reduceMotion ? undefined : { scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
      {children}
    </motion.div>
  );
}
