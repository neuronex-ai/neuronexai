import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/context/SubscriptionContext";

type SubscriptionRouteGuardProps = {
  children: ReactNode;
};

const MINIMAL_ALLOWED_PREFIXES = [
  "/ajustes",
  "/payment/callback",
  "/help",
  "/initial-settings",
  "/pwa-intent",
];

export const SubscriptionRouteGuard = ({ children }: SubscriptionRouteGuardProps) => {
  const location = useLocation();
  const { isLoading, isDevAccount, canUseCurrentAccess } = useSubscription();

  // Keep the authenticated desktop shell visible while entitlement resolves.
  // Protected content remains unmounted until access is known, so this removes
  // a second full-page loading loop without weakening the route guard.
  if (isLoading) return null;

  if (isDevAccount || canUseCurrentAccess) {
    return <>{children}</>;
  }

  const isAllowedMinimalRoute = MINIMAL_ALLOWED_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  if (isAllowedMinimalRoute) {
    return <>{children}</>;
  }

  return (
    <Navigate
      to="/ajustes?tab=subscription"
      replace
      state={{ from: location, subscriptionBlocked: true }}
    />
  );
};
