import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";
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

  if (isLoading) {
    return <NeuroNexLoadingLoop surface="page" label="Verificando acesso" />;
  }

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