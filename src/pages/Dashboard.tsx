"use client";

import { Suspense, lazy } from "react";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useTour } from "@/components/onboarding/TourContext";
import { DevelopmentModeNotice } from "@/components/runtime/DevelopmentModeNotice";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";
import { useIsMobile } from "@/hooks/use-mobile";

// Lazy load ONLY the needed version
const DesktopDashboard = lazy(() => import("@/pages/desktop/DesktopDashboard"));
const MobileDashboard = lazy(() => import("@/mobile/pages/MobileDashboard").then(m => ({ default: m.MobileDashboard })));

const PageLoader = () => <NeuroNexLoadingLoop surface="page" label="Abrindo dashboard" />;

const Dashboard = () => {
  const isMobile = useIsMobile();

  return (
    <Suspense fallback={<PageLoader />}>
      {isMobile ? <MobileDashboard /> : <DesktopDashboard />}
      <DashboardDevelopmentNotice />
    </Suspense>
  );
};

const DashboardDevelopmentNotice = () => {
  const { user } = useAuth();
  const { isTourCompleted, isTourOpen } = useTour();

  return (
    <DevelopmentModeNotice
      user={user}
      enabled={Boolean(user && isTourCompleted && !isTourOpen)}
    />
  );
};

export default Dashboard;