"use client";

import DesktopHome from "@/components/dashboard/desktop/DesktopHome";
import DesktopHomeSynapseContextBridge from "@/components/dashboard/desktop/DesktopHomeSynapseContextBridge";

const DesktopDashboard = () => (
  <>
    <DesktopHomeSynapseContextBridge />
    <DesktopHome />
  </>
);

export default DesktopDashboard;
