import { ReactNode } from "react";

import { useSubscriptionPlan } from "@/hooks/use-subscription-plan";
import { SubscriptionContext, type SubscriptionContextValue } from "./SubscriptionContext";

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  const { data, isLoading, canAccess, canAddPatient, refetch } = useSubscriptionPlan();

  const value: SubscriptionContextValue = {
    plan: data?.plan || 'Essential',
    status: data?.status || 'inactive',
    accessState: data?.accessState || 'blocked',
    features: data?.features || {
      maxPatients: 5,
      hasAICopilot: false,
      hasTelemedicine: false,
      hasAdvancedFinance: false,
      hasPatientPortal: false,
      hasAdminDashboard: false,
      hasAPIAccess: false,
    },
    isLoading,
    isDevAccount: data?.isDevAccount || false,
    isTrial: data?.isTrial || false,
    isTrialExpired: data?.isTrialExpired || false,
    hasPaidAccess: data?.hasPaidAccess || false,
    canUseCurrentAccess: data?.canUseCurrentAccess || false,
    requiresUpsell: data?.requiresUpsell || false,
    checkoutUrl: data?.checkoutUrl,
    message: data?.message,
    trialEndsAt: data?.trialEndsAt,
    daysUntilTrialEnds: data?.daysUntilTrialEnds,
    canAccess,
    canAddPatient,
    refreshSubscription: refetch,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
