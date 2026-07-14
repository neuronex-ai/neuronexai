import { createContext, useContext } from "react";

export type TourPlatform = "mobile" | "desktop";

export interface TourContextType {
  startTour: () => void;
  isTourOpen: boolean;
  closeTour: () => void;
  completeTour: () => void;
  isTourCompleted: boolean;
  resetTourCompleted: () => void;
  platform: TourPlatform;
}

export const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) throw new Error("useTour must be used within a TourProvider");
  return context;
};
