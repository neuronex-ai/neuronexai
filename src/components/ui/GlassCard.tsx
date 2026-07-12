import React from "react";
import { motion, HTMLMotionProps, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Omitimos as propriedades de drag que causam conflito entre React.HTMLAttributes e HTMLMotionProps
interface GlassCardProps extends Omit<
  HTMLMotionProps<"div">,
  "onDrag" | "onDragStart" | "onDragEnd"
> {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  delay?: number;
}

export const GlassCard = ({
  children,
  className,
  innerClassName,
  delay = 0,
  ...props
}: GlassCardProps) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.32, delay: delay / 1000, ease: [0.32, 0.72, 0, 1] }
      }
      className={cn(
        "overflow-hidden rounded-[32px] border border-zinc-200 bg-white/80 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0A0A0A]/80",
        className,
      )}
      {...props}
    >
      <div className={cn("h-full w-full", innerClassName)}>{children}</div>
    </motion.div>
  );
};
