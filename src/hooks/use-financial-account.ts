"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAsaasAccountState } from "@/lib/asaas-account-status";
import {
  FINANCIAL_ACCOUNT_SAFE_SELECT,
  FINANCIAL_ACCOUNTS_READ_TABLE,
  normalizeFinancialAccountRow,
} from "@/lib/neurofinance-safe-selects";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

type FinancialUiStatus =
  | "not_started"
  | "pending"
  | "onboarding"
  | "pending_review"
  | "restricted"
  | "active"
  | "account_missing"
  | "disabled"
  | string;

export interface FinancialAccountRecord {
  id: string;
  user_id: string;
  status?: string | null;
  ui_status?: string | null;
  provider?: string | null;
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  default_currency?: string | null;
  bank_account_last4?: string | null;
  bank_name?: string | null;
  pix_enabled?: boolean | null;
  card_enabled?: boolean | null;
  platform_fee_percent?: number | null;
  platform_fee_fixed?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  asaas_account_id?: string | null;
  asaas_wallet_id?: string | null;
  requirements?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  asaas_onboarding_url?: string | null;
  asaas_environment?: string | null;
  last_asaas_event_type?: string | null;
  last_asaas_event_at?: string | null;
  last_balance_sync_at?: string | null;
  last_sync_error?: string | null;
  holder_name?: string | null;
  cpf_cnpj?: string | null;
  birth_date?: string | null;
  mobile_phone?: string | null;
  pep_status?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  company_type?: string | null;
  income_value?: number | string | null;
  business_url?: string | null;
  business_description?: string | null;
  business_mcc?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  bank_account_type?: string | null;
  bank_holder_name?: string | null;
  bank_holder_cpf_cnpj?: string | null;
  document_front_id?: string | null;
  document_back_id?: string | null;
  tos_accepted_at?: string | null;
  onboarding_payload?: Record<string, any> | null;
  account_status?: Record<string, any> | null;
  accountStatus?: Record<string, any> | null;
}

const invokeAsaasFunction = async (name: string, body?: Record<string, unknown> | FormData) => {
  const response = await supabase.functions.invoke(name, { body });

  if (response.error) {
    let detail = "";
    try {
      const context = (response.error as any)?.context;
      const payload = context?.json ? await context.json() : null;
      detail = payload?.error || payload?.message || "";
    } catch {
      // The generic Functions error remains the fallback.
    }
    const technicalError = detail || response.error.message;
    console.error(`[NeuroFinance:${name}]`, technicalError);
    throw new Error(getUserFacingErrorMessage(technicalError, "sync"));
  }
  if ((response.data as any)?.error) {
    console.error(`[NeuroFinance:${name}]`, (response.data as any).error);
    throw new Error(getUserFacingErrorMessage((response.data as any).error, "sync"));
  }

  return response.data as any;
};

const extractRequirements = (account: any) =>
  account?.requirements || account?.account_status || account?.accountStatus || {};

export const useFinancialAccount = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchLocalAccount = async (): Promise<FinancialAccountRecord | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from(FINANCIAL_ACCOUNTS_READ_TABLE)
      .select(FINANCIAL_ACCOUNT_SAFE_SELECT)
      .eq("user_id", userId)
      .returns<FinancialAccountRecord[]>()
      .maybeSingle();

    if (error) throw error;
    return normalizeFinancialAccountRow(data) || null;
  };

  const { data: account, isLoading, refetch } = useQuery({
    queryKey: ["financial-account", userId],
    queryFn: fetchLocalAccount,
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!userId) return;
    const channelName = `financial-account-${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_accounts",
          filter: `user_id=eq.${userId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["financial-account", userId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const invalidateFinancialQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["financial-account"] });
    queryClient.invalidateQueries({ queryKey: ["neurofinance-overview"] });
    queryClient.invalidateQueries({ queryKey: ["neurofinance-overview-items"] });
    queryClient.invalidateQueries({ queryKey: ["dashboardAlerts"] });
  };

  const cacheAndInvalidateFinancialAccount = (data?: any) => {
    if (userId && data) {
      queryClient.setQueryData(["financial-account", userId], data);
    }
    invalidateFinancialQueries();
  };

  const syncAccount = useMutation({
    mutationFn: async () => {
      try {
        await invokeAsaasFunction("asaas-account-sync", {});
      } catch (error) {
        console.error("[useFinancialAccount] Falha na sincronização cadastral", error);
        throw new Error(getUserFacingErrorMessage(error, "sync"));
      }
      return fetchLocalAccount();
    },
    onSuccess: cacheAndInvalidateFinancialAccount,
  });

  const startOnboarding = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      invokeAsaasFunction("asaas-connect-onboarding", payload),
    onSuccess: invalidateFinancialQueries,
  });

  const updateAccount = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      invokeAsaasFunction("asaas-account-update", payload),
    onSuccess: () => {
      invalidateFinancialQueries();
      refetch();
    },
  });

  const uploadFile = useMutation({
    mutationFn: (payload: FormData) => invokeAsaasFunction("asaas-upload-file", payload),
    onSuccess: invalidateFinancialQueries,
  });

  const accountState = getAsaasAccountState(account);
  const requirements = extractRequirements(account);
  const uiStatus = accountState.uiStatus as FinancialUiStatus;
  const isAccountCreated = !!(account as any)?.asaas_account_id;
  const isApproved = accountState.isApproved;
  const isPending = ["pending", "onboarding", "pending_review"].includes(uiStatus);
  const isRestricted = ["restricted", "disabled"].includes(uiStatus);
  const isAwaitingApproval = uiStatus === "pending_review";
  const isAccountMissing = uiStatus === "account_missing";
  const isAwaitingDocuments = accountState.hasActionableStages && !isApproved;
  const hasActionableRequirements = isAwaitingDocuments || isRestricted || isAccountMissing;
  const needsVerification = isAccountCreated && accountState.hasOpenStages;
  const needsInitialOnboarding = !isAccountCreated && uiStatus !== "account_missing";
  const isOperationallyConnected = isAccountCreated && !isAccountMissing;

  return {
    account,
    isLoading: isLoading || userId === undefined,
    refetch,
    syncAccount,
    startOnboarding,
    updateAccount,
    uploadFile,
    isConnected: isOperationallyConnected,
    hasAccount: isAccountCreated,
    isApproved,
    isPending,
    isRestricted,
    isAwaitingApproval,
    isAwaitingDocuments,
    isAccountCreated,
    isAccountMissing,
    needsInitialOnboarding,
    hasActionableRequirements,
    needsVerification,
    requirements,
    accountState,
    approvalStages: accountState.stages,
    openApprovalStages: accountState.openStages,
    actionableApprovalStages: accountState.actionableStages,
    uiStatus,
    lastSyncError: (account as any)?.last_sync_error || null,
    status: uiStatus,
  };
};
