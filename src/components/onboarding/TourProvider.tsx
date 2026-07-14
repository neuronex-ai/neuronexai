import { useIsMobile } from "@/hooks/use-mobile";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { TourContext, type TourPlatform } from "./TourContext";

const LEGACY_TOUR_COMPLETED_KEY = "neuro_nex_tour_completed";
const TOUR_VERSION = "v2";

const completionKeyFor = (platform: TourPlatform) => `neuro_nex_tour_${TOUR_VERSION}_${platform}_completed`;

const readCompletion = (platform: TourPlatform) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(completionKeyFor(platform)) === "true";
};

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const platform: TourPlatform = isMobile ? "mobile" : "desktop";
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(() => readCompletion(platform));

  useEffect(() => {
    setIsTourOpen(false);
    setIsTourCompleted(readCompletion(platform));
  }, [platform]);

  const startTour = useCallback(() => {
    setIsTourOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
  }, []);

  const completeTour = useCallback(() => {
    setIsTourOpen(false);
    setIsTourCompleted(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(completionKeyFor(platform), "true");
      window.localStorage.setItem(LEGACY_TOUR_COMPLETED_KEY, "true");
    }
  }, [platform]);

  const resetTourCompleted = useCallback(() => {
    setIsTourOpen(false);
    setIsTourCompleted(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(completionKeyFor(platform));
      window.localStorage.removeItem(LEGACY_TOUR_COMPLETED_KEY);
    }
  }, [platform]);

  const value = useMemo(
    () => ({
      startTour,
      isTourOpen,
      closeTour,
      completeTour,
      isTourCompleted,
      resetTourCompleted,
      platform,
    }),
    [closeTour, completeTour, isTourCompleted, isTourOpen, platform, resetTourCompleted, startTour],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};
