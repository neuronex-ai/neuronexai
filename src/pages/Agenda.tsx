"use client";

import { Suspense, lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";

const DesktopAgenda = lazy(() => import("@/pages/desktop/DesktopAgenda"));
const MobileAgenda = lazy(() => import("@/mobile/pages/MobileAgenda"));

const PageLoader = () => <NeuroNexLoadingLoop surface="page" label="Abrindo agenda" />;

export default function Agenda() {
  const isMobile = useIsMobile();

  return (
    <Suspense fallback={<PageLoader />}>
      {isMobile ? <MobileAgenda /> : <DesktopAgenda />}
    </Suspense>
  );
}