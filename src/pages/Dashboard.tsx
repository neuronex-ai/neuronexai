"use client";

import { Suspense, lazy } from "react";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { FounderProgramAnnouncementGate } from "@/components/founder/FounderProgramExperience";
import { useTour } from "@/components/onboarding/TourContext";
import { DevelopmentModeNotice } from "@/components/runtime/DevelopmentModeNotice";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";
import { useIsMobile } from "@/hooks/use-mobile";
import DesktopDashboard from "@/pages/desktop/DesktopDashboard";

const MobileDashboard = lazy(() => import("@/mobile/pages/MobileDashboard").then(m => ({ default: m.MobileDashboard })));

const MobilePageLoader = () => <NeuroNexLoadingLoop surface="page" label="Abrindo dashboard" />;

const Dashboard = () => {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <>
        <DesktopDashboard />
        <FounderProgramAnnouncementGate />
        <DashboardDevelopmentNotice />
      </>
    );
  }

  return (
    <Suspense fallback={<MobilePageLoader />}>
      <MobileDashboard />
      <FounderProgramAnnouncementGate />
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