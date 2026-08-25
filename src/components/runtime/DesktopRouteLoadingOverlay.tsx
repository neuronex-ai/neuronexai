import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";

const MIN_VISIBLE_MS = 560;

export function DesktopRouteLoadingOverlay() {
  const location = useLocation();
  const routeKey = `${location.pathname}${location.search}`;
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, MIN_VISIBLE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [routeKey]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483000] hidden cursor-wait items-center justify-center bg-background/82 backdrop-blur-md md:flex"
      role="status"
      aria-live="polite"
      aria-label="Carregando área"
      data-neuronex-desktop-route-loader
    >
      <NeuroNexLoadingLoop surface="inline" size={132} label="Carregando área" />
    </div>
  );
}

export default DesktopRouteLoadingOverlay;
