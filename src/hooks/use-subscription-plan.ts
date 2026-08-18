import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import {
    SubscriptionPlan,
    SubscriptionStatus,
    SubscriptionAccessState,
    PlanFeatures,
    PLAN_FEATURES,
    FeatureKey
} from "@/types/subscription";

interface SubscriptionData {
    plan: SubscriptionPlan;
    planCode?: string;
    status: SubscriptionStatus;
    accessState: SubscriptionAccessState;
    features: PlanFeatures;
    limits?: Record<string, unknown>;
    rawFeatures?: Record<string, unknown>;
    isDevAccount: boolean;
    subscriptionId?: string;
    checkoutSessionId?: string;
    checkoutUrl?: string;
    currentPeriodEnd?: Date;
    trialEndsAt?: Date;
    isTrial: boolean;
    isTrialExpired: boolean;
    daysUntilTrialEnds?: number;
    hasPaidAccess: boolean;
    canUseCurrentAccess: boolean;
    requiresUpsell: boolean;
    message?: string;
}

interface UseSubscriptionPlanReturn {
    data: SubscriptionData | undefined;
    isLoading: boolean;
    error: Error | null;
    canAccess: (feature: FeatureKey) => boolean;
    canAddPatient: (currentPatientCount: number) => boolean;
    refetch: () => void;
}

const normalizePlan = (plan?: string): SubscriptionPlan => {
    if (plan === "Professional" || plan === "Enterprise" || plan === "Essential") return plan;
    return "Essential";
};

export const useSubscriptionPlan = (): UseSubscriptionPlanReturn => {
    const { user, isLoading: isAuthLoading } = useAuth();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['user-subscription', user?.id],
        queryFn: async (): Promise<SubscriptionData> => {
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { data: entitlement, error: entitlementError } = await supabase.functions.invoke('get-current-entitlement', {
                body: {},
            });

            if (entitlementError) throw entitlementError;

            const plan = normalizePlan(entitlement?.plan);
            const status = (entitlement?.status || 'inactive') as SubscriptionStatus;
            const accessState = (entitlement?.accessState || 'blocked') as SubscriptionAccessState;
            const features = (entitlement?.features || PLAN_FEATURES[plan]) as PlanFeatures;
            const currentPeriodEnd = entitlement?.currentPeriodEnd
                ? new Date(entitlement.currentPeriodEnd)
                : undefined;
            const trialEndsAt = entitlement?.trialEndsAt
                ? new Date(entitlement.trialEndsAt)
                : undefined;

            return {
                plan,
                planCode: entitlement?.planCode,
                status,
                accessState,
                features,
                limits: entitlement?.limits || {},
                rawFeatures: entitlement?.rawFeatures || {},
                isDevAccount: false,
                subscriptionId: entitlement?.subscriptionId,
                checkoutSessionId: entitlement?.checkoutSessionId,
                checkoutUrl: entitlement?.checkoutUrl,
                currentPeriodEnd,
                trialEndsAt,
                isTrial: Boolean(entitlement?.isTrial),
                isTrialExpired: Boolean(entitlement?.isTrialExpired),
                daysUntilTrialEnds: entitlement?.daysUntilTrialEnds,
                hasPaidAccess: Boolean(entitlement?.hasPaidAccess),
                canUseCurrentAccess: Boolean(entitlement?.canUseCurrentAccess),
                requiresUpsell: Boolean(entitlement?.requiresUpsell),
                message: entitlement?.message,
            };
        },
        enabled: !!user && !isAuthLoading,
        staleTime: 1000 * 60, // 1 minute; billing status can change asynchronously by webhook.
        gcTime: 1000 * 60 * 10,
    });

    const canAccess = (feature: FeatureKey): boolean => {
        if (!data) return false;
        if (!data.canUseCurrentAccess) return false;

        const featureMap: Record<FeatureKey, keyof PlanFeatures | 'maxPatients'> = {
            ai_copilot: 'hasAICopilot',
            telemedicine: 'hasTelemedicine',
            advanced_finance: 'hasAdvancedFinance',
            patient_portal: 'hasPatientPortal',
            admin_dashboard: 'hasAdminDashboard',
            api_access: 'hasAPIAccess',
            unlimited_patients: 'maxPatients',
        };

        const featureKey = featureMap[feature];
        if (featureKey === 'maxPatients') {
            return data.features.maxPatients === 'unlimited';
        }

        return Boolean(data.features[featureKey as keyof PlanFeatures]);
    };

    const canAddPatient = (currentPatientCount: number): boolean => {
        if (!data) return false;
        if (!data.canUseCurrentAccess) return false;

        const maxPatients = data.features.maxPatients;
        if (maxPatients === 'unlimited') return true;

        return currentPatientCount < maxPatients;
    };

    return {
        data,
        isLoading: isLoading || isAuthLoading,
        error: error as Error | null,
        canAccess,
        canAddPatient,
        refetch,
    };
};
