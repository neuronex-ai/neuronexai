import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Clock3,
  ExternalLink,
  KeyRound,
  Landmark,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { SetPinModal } from "@/components/settings/SetPinModal";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useFinancialPinStatus } from "@/hooks/use-financial-pin-status";
import { useProfile } from "@/hooks/use-profile";
import { buildNeuroFinanceSupportUrl } from "@/lib/neurofinance-support";
import { cn } from "@/lib/utils";

const accountStatusCopy = (status?: string | null, hasAccount?: boolean) => {
  if (!hasAccount) {
    return {
      title: "NeuroFinance ainda não ativado",
      description: "A ativação é iniciada no próprio NeuroFinance. Nenhuma conta é criada por esta tela.",
      label: "Não ativado",
      icon: Landmark,
      tone: "border-border/55 bg-muted/45 text-muted-foreground",
    };
  }
  if (status === "active") {
    return {
      title: "Conta pronta para uso",
      description: "Cobranças, Pix e repasses estão disponíveis conforme os recursos liberados para sua conta.",
      label: "Ativa",
      icon: BadgeCheck,
      tone: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300",
    };
  }
  if (["pending", "onboarding", "pending_review"].includes(String(status))) {
    return {
      title: "Análise em andamento",
      description: "Acompanhe os documentos e as próximas etapas em Saúde da conta.",
      label: "Em análise",
      icon: Clock3,
      tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
    };
  }
  return {
    title: "Conta precisa de atenção",
    description: "Existe uma pendência de cadastro ou conexão. Abra Saúde da conta para ver o que falta.",
    label: "Ação necessária",
    icon: ShieldCheck,
    tone: "border-rose-500/20 bg-rose-500/[0.08] text-rose-700 dark:text-rose-300",
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Ainda não sincronizada";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export function NeuroFinanceSettingsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [pinOpen, setPinOpen] = useState(false);
  const pinStatus = useFinancialPinStatus(true);
  const {
    account,
    hasAccount,
    isLoading,
    uiStatus,
    lastSyncError,
    syncAccount,
  } = useFinancialAccount();

  const status = accountStatusCopy(uiStatus, hasAccount);
  const StatusIcon = status.icon;
  const supportUrl = buildNeuroFinanceSupportUrl({
    professionalName:
      profile?.full_name ||
      profile?.name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
    professionalEmail: user?.email,
    userId: user?.id,
    accountId: account?.asaas_account_id || account?.id,
    error: lastSyncError,
    occurredAt: account?.updated_at,
  });

  const closeAccountUrl = `https://wa.me/5548988724548?text=${encodeURIComponent(
    [
      "Olá! Quero solicitar o encerramento da minha conta NeuroFinance.",
      `Nome: ${profile?.full_name || profile?.name || "Não informado"}`,
      `E-mail: ${user?.email || "Não informado"}`,
      `Identificação da conta: ${account?.id || "Não informada"}`,
      "Entendo que a equipe confirmará os impactos e os dados que precisam ser preservados antes de concluir.",
    ].join("\n"),
  )}`;

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/65">
          NeuroFinance
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-foreground">
          Segurança e gestão da conta
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
          Consulte a situação da conta, gerencie o PIN único e acesse as pendências cadastrais. A ativação de uma nova conta não acontece por aqui.
        </p>
      </header>

      <section className="desktop-retina-panel overflow-hidden rounded-[30px] border border-border/45">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="flex items-start gap-4">
            <div className="desktop-retina-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/45">
              <StatusIcon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-black tracking-tight text-foreground">{status.title}</h3>
                <span className={cn("rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em]", status.tone)}>
                  {status.label}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
                {status.description}
              </p>
            </div>
          </div>
          {hasAccount ? (
            <Button
              variant="outline"
              disabled={syncAccount.isPending}
              onClick={() => syncAccount.mutate()}
              className="desktop-retina-interactive h-11 shrink-0 rounded-2xl px-5"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncAccount.isPending && "animate-spin")} />
              Atualizar situação
            </Button>
          ) : null}
        </div>

        <div className="grid gap-px border-t border-border/35 bg-border/30 sm:grid-cols-3">
          <div className="bg-card/75 p-5 dark:bg-white/[0.025]">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Titular</p>
            <p className="mt-1.5 truncate text-sm font-black text-foreground">
              {account?.holder_name || profile?.full_name || profile?.name || "Não informado"}
            </p>
          </div>
          <div className="bg-card/75 p-5 dark:bg-white/[0.02]">
            <WalletCards className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Conta de repasse</p>
            <p className="mt-1.5 truncate text-sm font-black text-foreground">
              {account?.bank_name
                ? `${account.bank_name}${account.bank_account_last4 ? ` · final ${account.bank_account_last4}` : ""}`
                : "Ainda não informada"}
            </p>
          </div>
          <div className="bg-card/75 p-5 dark:bg-white/[0.015]">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Última atualização</p>
            <p className="mt-1.5 text-sm font-black text-foreground">{formatDateTime(account?.updated_at)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="desktop-retina-panel rounded-[28px] border border-border/45 p-6">
          <div className="flex items-start gap-4">
            <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/45">
              <KeyRound className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-foreground">PIN financeiro único</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                {pinStatus.data?.isConfigured
                  ? "Ativo para saques, Pix, boletos e outras operações sensíveis, no computador e no celular."
                  : "Crie um PIN de seis dígitos para proteger as operações financeiras."}
              </p>
              {pinStatus.data?.pinUpdatedAt ? (
                <p className="mt-2 text-[10px] font-bold text-muted-foreground/70">
                  Atualizado em {formatDateTime(pinStatus.data.pinUpdatedAt)}
                </p>
              ) : null}
            </div>
          </div>
          <Button onClick={() => setPinOpen(true)} className="mt-5 h-11 w-full rounded-2xl font-bold">
            {pinStatus.data?.isConfigured ? "Alterar PIN" : "Criar PIN"}
          </Button>
        </section>

        <section className="desktop-retina-panel rounded-[28px] border border-border/45 p-6">
          <div className="flex items-start gap-4">
            <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/45">
              <ShieldCheck className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">Saúde da conta</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                A visão detalhada continua junto das operações financeiras, onde documentos e pendências têm contexto.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/financeiro?view=saude-conta")}
            className="mt-5 h-11 w-full rounded-2xl font-bold"
          >
            Abrir Saúde da conta <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </div>

      <section className="rounded-[28px] border border-border/45 bg-card/45 p-6 dark:bg-white/[0.018]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-foreground">Suporte e encerramento</p>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-muted-foreground">
              O encerramento exige confirmação da titularidade e análise de cobranças ou saldos pendentes. Nada é excluído automaticamente nesta tela.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-11 rounded-2xl px-5">
              <a href={supportUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> Pedir ajuda
              </a>
            </Button>
            {hasAccount ? (
              <Button asChild variant="ghost" className="h-11 rounded-2xl px-5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <a href={closeAccountUrl} target="_blank" rel="noreferrer">
                  <Trash2 className="mr-2 h-4 w-4" /> Solicitar encerramento
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <SetPinModal
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSuccess={() => {
          void pinStatus.refetch();
        }}
      />
    </div>
  );
}
