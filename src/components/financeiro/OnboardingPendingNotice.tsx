"use client";

import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Unplug,
} from "lucide-react";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/components/auth/SessionContextProvider";
import {
  buildNeuroFinanceSupportUrl,
  getNeuroFinanceSyncErrorMessage,
} from "@/lib/neurofinance-support";

interface OnboardingPendingNoticeProps {
  onRequestOnboarding?: () => void;
  onRecreateAccount?: () => void;
}

export const OnboardingPendingNotice = ({
  onRequestOnboarding,
  onRecreateAccount,
}: OnboardingPendingNoticeProps) => {
  const {
    account,
    isApproved,
    syncAccount,
    hasActionableRequirements,
    needsInitialOnboarding,
    isRestricted,
    isAwaitingApproval,
    isAccountCreated,
    isAccountMissing,
    uiStatus,
    lastSyncError,
  } = useFinancialAccount();
  const { profile } = useProfile();
  const { user } = useAuth();

  if (isApproved) return null;

  const isUnderReview =
    uiStatus === "pending_review" ||
    (isAwaitingApproval && !hasActionableRequirements && isAccountCreated);

  const icon = isAccountMissing ? (
    <Unplug className="h-5 w-5 text-red-500 md:h-6 md:w-6" />
  ) : isUnderReview ? (
    <Clock className="h-5 w-5 text-amber-500 md:h-6 md:w-6" />
  ) : isRestricted ? (
    <AlertCircle className="h-5 w-5 text-red-500 md:h-6 md:w-6" />
  ) : (
    <ShieldAlert className="h-5 w-5 text-orange-500 md:h-6 md:w-6" />
  );

  const title = isAccountMissing
    ? "Conta desconectada"
    : needsInitialOnboarding
      ? "Configuração necessária"
      : isUnderReview
        ? "Conta em análise"
        : isRestricted
          ? "Conta restrita"
          : "Ação necessária";

  const description = isAccountMissing
    ? "A conexão com o NeuroFinance foi interrompida. Seu histórico continua preservado enquanto nossa equipe verifica a recuperação."
    : needsInitialOnboarding
      ? "Para começar a receber pagamentos e emitir notas fiscais, complete a configuração do seu perfil financeiro."
      : isUnderReview
        ? "Sua documentação foi enviada e está em análise. Este processo pode levar algum tempo."
        : isRestricted
          ? "Sua conta sofreu restrições temporárias. Verifique as pendências cadastrais para restaurar o acesso total."
          : "Sua conta requer a atualização de algumas informações para continuar operando normalmente.";

  const primaryLabel = isAccountMissing
    ? "Falar com o suporte"
    : needsInitialOnboarding
      ? "Iniciar configuração"
      : isRestricted
        ? "Regularizar conta"
        : "Ver análise cadastral";

  const supportUrl = buildNeuroFinanceSupportUrl({
    professionalName:
      profile?.full_name ||
      profile?.name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
    professionalEmail: user?.email,
    userId: user?.id,
    accountId: (account as any)?.asaas_account_id || (account as any)?.id,
    error: lastSyncError,
    occurredAt:
      (account as any)?.metadata?.provider_connection?.detected_at ||
      (account as any)?.updated_at,
  });

  const handlePrimaryAction = () => {
    if (isAccountMissing) {
      window.open(supportUrl, "_blank", "noopener,noreferrer");
      return;
    }
    onRequestOnboarding?.();
  };

  return (
    <div className="relative mb-8 w-full overflow-hidden rounded-[28px] border border-zinc-200/50 bg-white/[0.92] p-5 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.72)] backdrop-blur-3xl backdrop-saturate-150 dark:border-white/[0.07] dark:bg-white/[0.022] md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_42%,rgba(0,0,0,.045),transparent_34%),radial-gradient(circle_at_0%_0%,rgba(255,255,255,.58),transparent_42%)] dark:bg-[radial-gradient(circle_at_84%_42%,rgba(255,255,255,.055),transparent_34%)]" />
      <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.014] dark:opacity-[0.04]" />

      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex w-full items-start gap-4 md:max-w-2xl md:gap-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-amber-500/[0.15] bg-amber-500/[0.055] text-zinc-900 shadow-[0_18px_40px_-30px_rgba(245,158,11,0.95)] dark:border-amber-400/20 dark:bg-amber-400/[0.07] dark:text-white md:h-14 md:w-14 md:rounded-[20px]">
            {icon}
          </div>

          <div className="space-y-2 pt-1">
            <h3 className="text-lg font-black uppercase leading-none tracking-tighter text-zinc-900 dark:text-white md:text-xl">
              {title}
            </h3>

            <p className="text-xs font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-sm">
              {description}
            </p>

            {!!lastSyncError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {getNeuroFinanceSyncErrorMessage(lastSyncError)}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 w-full shrink-0 md:w-auto">
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <Button
              variant="outline"
              onClick={() => syncAccount.mutate()}
              disabled={syncAccount.isPending}
              className="h-12 rounded-[16px] border-zinc-300/70 bg-white/[0.72] px-6 text-[10px] font-black uppercase tracking-[0.18em] shadow-sm backdrop-blur-xl transition-all hover:bg-white active:scale-[0.985] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] md:h-14 md:rounded-[20px]"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncAccount.isPending ? "animate-spin" : ""}`}
              />
              Sincronizar
            </Button>

            {(onRequestOnboarding || onRecreateAccount || isAccountMissing) && (
              <Button
                onClick={handlePrimaryAction}
                className="group h-12 rounded-[16px] bg-zinc-900 px-8 text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-[0_20px_54px_-32px_rgba(0,0,0,0.82)] transition-all hover:scale-[1.015] active:scale-[0.985] dark:bg-white dark:text-black md:h-14 md:rounded-[20px] md:text-[10px]"
              >
                <span className="flex items-center gap-3">
                  {isAccountMissing ? <MessageCircle className="h-4 w-4" /> : null}
                  {primaryLabel}
                  {!isAccountMissing ? (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  ) : null}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
