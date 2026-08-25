"use client";

import { DesktopDashboardCommandCenter } from "@/components/dashboard/desktop/DesktopDashboardCommandCenter";
import { DesktopSessionWelcome } from "@/components/dashboard/desktop/DesktopSessionWelcome";

const DesktopDashboard = () => (
  <>
    <DesktopSessionWelcome />
    <DesktopDashboardCommandCenter />
  </>
);

export default DesktopDashboard;
