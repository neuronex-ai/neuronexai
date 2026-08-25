import { ReactNode } from "react";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";
import { useSubscription } from "@/context/SubscriptionContext";
import { FeatureKey } from "@/types/subscription";

interface FeatureGateProps {
    /** The feature key to check access for */
    feature: FeatureKey;
    /** Content to render when access is denied */
    fallback?: ReactNode;
    /** Content to render when access is granted */
    children: ReactNode;
    /** Whether to show a loading state while checking */
    showLoading?: boolean;
}

/**
 * FeatureGate component controls access to features based on user's subscription plan.
 * If the user doesn't have access, it renders the fallback (usually an upsell component).
 */
export const FeatureGate = ({
    feature,
    fallback,
    children,
    showLoading = true
}: FeatureGateProps) => {
    const { canAccess, isLoading } = useSubscription();

    if (isLoading && showLoading) {
        return <NeuroNexLoadingLoop surface="section" className="min-h-[400px]" label="Verificando acesso" />;
    }

    if (canAccess(feature)) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    // Default fallback if none provided
    return null;
};