import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePatientPortalCurrent } from "@/hooks/use-patient-portal";
import { isPatientAccount } from "@/lib/auth-account-role";
import { clearPatientPortalInviteToken, storePatientPortalInviteToken } from "@/lib/patient-portal-flow";
import { useAuth } from "./SessionContextProvider";

interface PatientProtectedRouteProps {
  children: ReactNode;
}

export const PatientProtectedRoute = ({ children }: PatientProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const portal = usePatientPortalCurrent();

  if (isLoading) return null;
  if (!user) {
    const token = new URLSearchParams(location.search).get("token");
    if (token) storePatientPortalInviteToken(token);
    return <Navigate to="/portal/ativar" replace />;
  }

  if (portal.isLoading) return null;

  const portalStatus = portal.data?.status;
  const hasPatientRole = isPatientAccount(user);
  const hasPortalLink = Boolean(portal.data?.linkId);

  if (!hasPatientRole && !hasPortalLink) return <Navigate to="/dashboard" replace />;
  if (portalStatus === "active" && location.pathname.startsWith("/portal/ativar")) {
    clearPatientPortalInviteToken();
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};
