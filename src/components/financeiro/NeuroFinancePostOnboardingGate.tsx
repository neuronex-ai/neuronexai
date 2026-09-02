"use client";

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { NeuroFinanceWelcomeWizard } from "@/components/financeiro/NeuroFinanceWelcomeWizard";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useFinancialPinStatus } from "@/hooks/use-financial-pin-status";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

const POST_ONBOARDING_ROLLOUT_AT = new Date("2026-06-11T00:00:00.000Z").getTime();

function NeuroFinancePostOnboardingContent() {
  const isMobile = useIsMobile();
  const { account, isConnected, isLoading, needsInitialOnboarding, refetch } = useFinancialAccount();
  const pinStatus = useFinancialPinStatus(Boolean(isConnected));
  const postOnboarding = account?.metadata?.neurofinance_post_onboarding;
  const isCompletedInAccount = Boolean(postOnboarding?.completed || postOnboarding?.completed_at);
  const accountCreatedAt = account?.created_at ? new Date(account.created_at).getTime() : null;
  const isLegacyAccount = Boolean(
    account?.id &&
    accountCreatedAt &&
    accountCreatedAt < POST_ONBOARDING_ROLLOUT_AT &&
    (account?.tos_accepted_at || account?.onboarding_completed_at || account?.onboarding_payload)
  );
  const shouldMarkAsComplete = Boolean(
    account?.id &&
    !isCompletedInAccount &&
    (pinStatus.data?.isConfigured || isLegacyAccount)
  );

  useEffect(() => {
    if (!shouldMarkAsComplete) return;

    supabase.functions
      .invoke("neurofinance-post-onboarding", { body: { action: "complete" } })
      .then(() => refetch())
      .catch((error) => {
        console.warn("[NeuroFinancePostOnboardingGate] Não foi possível registrar conclusão automática.", error);
      });
  }, [refetch, shouldMarkAsComplete]);

  const shouldOpen = Boolean(
    !isMobile &&
    !isLoading &&
    !pinStatus.isLoading &&
    isConnected &&
    !needsInitialOnboarding &&
    account?.id &&
    !isLegacyAccount &&
    !isCompletedInAccount &&
    !pinStatus.data?.isConfigured
  );

  const handleComplete = async () => {
    await Promise.allSettled([refetch(), pinStatus.refetch?.()]);
  };

  return (
    <NeuroFinanceWelcomeWizard
      open={shouldOpen}
      pinAlreadyConfigured={Boolean(pinStatus.data?.isConfigured)}
      onComplete={handleComplete}
    />
  );
}

export function NeuroFinancePostOnboardingGate() {
  const location = useLocation();
  if (!location.pathname.startsWith("/financeiro/neurofinance")) return null;
  return <NeuroFinancePostOnboardingContent />;
}
