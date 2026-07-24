"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";

const DESKTOP_ROUTE_ORDER = [
  "/dashboard",
  "/agenda",
  "/teleconsulta",
  "/pacientes",
  "/notas",
  "/financeiro",
  "/ajustes",
  "/neurozap",
  "/synapse-ai",
] as const;

const getRouteIndex = (pathname: string) => {
  const index = DESKTOP_ROUTE_ORDER.findIndex(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return index === -1 ? DESKTOP_ROUTE_ORDER.length : index;
};

const routeVariants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * 18,
    scale: 0.996,
    filter: "blur(5px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * -12,
    scale: 0.998,
    filter: "blur(3px)",
  }),
};

type DesktopRouteTransitionProps = {
  pathname: string;
  children: ReactNode;
};

export const DesktopRouteTransition = ({
  pathname,
  children,
}: DesktopRouteTransitionProps) => {
  const shouldReduceMotion = useReducedMotionPreference();
  const previousRoute = useRef({ index: getRouteIndex(pathname), pathname });
  const currentIndex = getRouteIndex(pathname);
  const direction = useMemo<1 | -1>(() => {
    if (currentIndex !== previousRoute.current.index) {
      return currentIndex > previousRoute.current.index ? 1 : -1;
    }
    return pathname >= previousRoute.current.pathname ? 1 : -1;
  }, [currentIndex, pathname]);

  useEffect(() => {
    previousRoute.current = { index: currentIndex, pathname };
  }, [currentIndex, pathname]);

  return (
    <div className="relative w-full" data-desktop-route-viewport="true">
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          data-desktop-route-stage={pathname}
          variants={shouldReduceMotion ? undefined : routeVariants}
          initial={shouldReduceMotion ? false : "enter"}
          animate={shouldReduceMotion ? { opacity: 1 } : "center"}
          exit={shouldReduceMotion ? { opacity: 1 } : "exit"}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  x: { type: "spring", stiffness: 360, damping: 38, mass: 0.82 },
                  scale: { type: "spring", stiffness: 390, damping: 40, mass: 0.78 },
                  opacity: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                  filter: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                }
          }
          className="w-full"
          style={{
            transformOrigin: "50% 18%",
            willChange: shouldReduceMotion ? "auto" : "transform, opacity, filter",
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
