import { createContext, useContext } from "react";

import type {
  FeatureKey,
  PlanFeatures,
  SubscriptionAccessState,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/types/subscription";

export interface SubscriptionContextValue {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  accessState: SubscriptionAccessState;
  features: PlanFeatures;
  isLoading: boolean;
  isDevAccount: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  hasPaidAccess: boolean;
  canUseCurrentAccess: boolean;
  requiresUpsell: boolean;
  checkoutUrl?: string;
  message?: string;
  trialEndsAt?: Date;
  daysUntilTrialEnds?: number;
  canAccess: (feature: FeatureKey) => boolean;
  canAddPatient: (currentPatientCount: number) => boolean;
  refreshSubscription: () => void;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const useSubscription = (): SubscriptionContextValue => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
