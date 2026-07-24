"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";

type StableTabViewportProps<Value extends string> = {
  value: Value;
  id: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export const StableTabViewport = <Value extends string>({
  value,
  id,
  children,
  className,
  contentClassName,
}: StableTabViewportProps<Value>) => {
  const prefersReducedMotion = useReducedMotionPreference();

  return (
    <div className={cn("relative min-h-0 overflow-hidden", className)}>
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={value}
          id={`${id}-panel-${value}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${value}`}
          tabIndex={0}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.01 }
              : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
          }
          className={cn("absolute inset-0 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", contentClassName)}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
