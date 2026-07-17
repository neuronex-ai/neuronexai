import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  duration?: number;
}

export const FadeIn = ({
  children,
  delay = 0,
  className,
  direction = "up",
  distance = 22,
  duration = 0.62,
}: FadeInProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const shouldReduceMotion = useReducedMotion();

  const directionOffset = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial={
        shouldReduceMotion
          ? false
          : {
              opacity: 0,
              y: directionOffset[direction].y,
              x: directionOffset[direction].x,
            }
      }
      animate={
        shouldReduceMotion || isInView
          ? {
              opacity: 1,
              y: 0,
              x: 0,
            }
          : {}
      }
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              duration: duration,
              delay: delay,
              ease: [0.23, 1, 0.32, 1],
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
};
