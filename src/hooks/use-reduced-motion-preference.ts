import { useReducedMotion } from "framer-motion";
import { useSyncExternalStore } from "react";

const getInternalReducedMotion = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("reduce-motion");

const subscribeToInternalReducedMotion = (listener: () => void) => {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => undefined;
  }

  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
};

export const useReducedMotionPreference = () => {
  const systemReducedMotion = Boolean(useReducedMotion());
  const internalReducedMotion = useSyncExternalStore(
    subscribeToInternalReducedMotion,
    getInternalReducedMotion,
    () => false,
  );

  return systemReducedMotion || internalReducedMotion;
};
