import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

type LandingSectionStageProps = {
  children: ReactNode;
  index: number;
  className?: string;
};

/**
 * Keeps adjacent landing sections inside the same spatial sequence. Each block
 * approaches the viewer, settles, and recedes while the next one enters.
 */
export function LandingSectionStage({ children, index, className }: LandingSectionStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start end", "end start"],
  });
  const delay = Math.min(index * 0.018, 0.1);
  const opacity = useTransform(scrollYProgress, [0, 0.16, 0.84, 1], [0.34, 1, 1, 0.5]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.82, 1], [0.978, 1, 1, 0.986]);
  const y = useTransform(scrollYProgress, [0, 0.2, 0.82, 1], [54, 0, 0, -30]);

  return (
    <motion.div
      ref={stageRef}
      className={`relative origin-center will-change-transform ${className ?? ""}`}
      style={reduceMotion ? undefined : { opacity, scale, y }}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reduceMotion ? 0 : 0.72, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {index > 0 ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[14%] top-0 h-px origin-center bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          whileInView={reduceMotion ? undefined : { scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: reduceMotion ? 0 : 0.82, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
      {children}
    </motion.div>
  );
}
