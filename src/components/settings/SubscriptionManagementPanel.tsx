import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  MessageCircle,
  ReceiptText,
} from "lucide-react";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { UpgradePlanModal } from "@/components/dashboard/UpgradePlanModal";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { useSubscription } from "@/context/SubscriptionContext";
import { useCurrentSubscription } from "@/hooks/use-current-subscription";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPPORT_URL = `https://wa.me/5548988724548?text=${encodeURIComponent(
  "Olá! Preciso de ajuda com minha assinatura da NeuroNex.",
)}`;

const planLabel = (plan?: string | null) => {
  if (plan === "Essential") return "Essencial";
  if (plan === "Professional") return "Profissional";
  return plan || "Não informado";
};

const subscriptionStatus = (status?: string | null) => {
  const labels: Record<string, { label: string; tone: string }> = {
    active: {
      label: "Ativa",
      tone: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300",
    },
    trialing: {
      label: "Período de teste",
      tone: "border-sky-500/20 bg-sky-500/[0.08] text-sky-700 dark:text-sky-300",
    },
    payment_pending: {
      label: "Pagamento pendente",
      tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
    },
    past_due: {
      label: "Pagamento em atraso",
      tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
    },
    grace_period: {
      label: "Regularização pendente",
      tone: "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
    },
    canceled: {
      label: "Cancelada",
      tone: "border-rose-500/20 bg-rose-500/[0.08] text-rose-700 dark:text-rose-300",
    },
    blocked: {
      label: "Acesso suspenso",
      tone: "border-rose-500/20 bg-rose-500/[0.08] text-rose-700 dark:text-rose-300",
    },
  };

  return labels[String(status || "")] || {
    label: "Em atualização",
    tone: "border-border/60 bg-muted/50 text-muted-foreground",
  };
};

const checkoutStatus = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (["paid", "received", "confirmed"].includes(normalized)) {
    return { label: "Pago", tone: "text-emerald-600 dark:text-emerald-300" };
  }
  if (["canceled", "expired", "abandoned", "refunded"].includes(normalized)) {
    return { label: normalized === "expired" ? "Expirado" : normalized === "refunded" ? "Estornado" : "Cancelado", tone: "text-muted-foreground" };
  }
  if (["blocked", "failed", "overdue"].includes(normalized)) {
    return { label: "Não concluído", tone: "text-rose-600 dark:text-rose-300" };
  }
  return { label: "Aguardando pagamento", tone: "text-amber-600 dark:text-amber-300" };
};

const formatDate = (value?: string | null) => {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
};

const formatCurrency = (amountCents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amountCents / 100);

export function SubscriptionManagementPanel() {
  const [activeView, setActiveView] = useState<"management" | "invoices">("management");
  const { user } = useAuth();
  const { plan, status, isTrial, trialEndsAt } = useSubscription();
  const currentSubscription = useCurrentSubscription();
  const statusInfo = subscriptionStatus(status);

  const billingHistory = useQuery({
    queryKey: ["subscription-billing-history", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_checkout_sessions")
        .select(
          "id, plan, status, amount_cents, currency, billing_type, created_at, paid_at, checkout_url",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(24);

      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const entitlement = currentSubscription.data;
  const periodEnd = entitlement?.current_period_end || (isTrial ? trialEndsAt?.toISOString() : null);
  const monthlyPrice = entitlement?.price_cents;

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/65">
            Assinatura
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-foreground">
            Plano, pagamentos e suporte
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
            Acompanhe o plano contratado e o histórico real de pagamentos da sua assinatura NeuroNex.
          </p>
        </div>
        <Button asChild variant="outline" className="desktop-retina-interactive h-11 rounded-2xl px-5">
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> Falar com o suporte
          </a>
        </Button>
      </header>

      <div className="space-y-5">
        <MagneticSegmentedControl
          id="settings-subscription-view"
          indicatorId="settings-subscription-view-indicator"
          value={activeView}
          onValueChange={setActiveView}
          ariaLabel="Área da assinatura"
          options={[
            { value: "management", label: "Minha assinatura" },
            { value: "invoices", label: "Faturas" },
          ]}
          className="desktop-retina-inset h-12 min-h-12 w-full max-w-md rounded-2xl border-border/45 bg-muted/35"
          triggerClassName="h-11 min-h-11 flex-1 rounded-xl px-4 text-xs font-bold"
        />

        <div
          id="settings-subscription-view-panel-management"
          role="tabpanel"
          aria-labelledby="settings-subscription-view-tab-management"
          hidden={activeView !== "management"}
          tabIndex={0}
          className="mt-0 space-y-5"
        >
          <section className="desktop-retina-panel overflow-hidden rounded-[30px] border border-border/45">
            <div className="grid gap-px bg-border/35 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <div className="bg-card/90 p-6 dark:bg-white/[0.035] md:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Plano atual
                    </p>
                    <p className="mt-3 text-3xl font-black tracking-[-0.045em] text-foreground">
                      {planLabel(plan)}
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]", statusInfo.tone)}>
                    {statusInfo.label}
                  </span>
                </div>
                {monthlyPrice != null ? (
                  <p className="mt-4 text-sm font-semibold text-muted-foreground">
                    {formatCurrency(monthlyPrice)} por {entitlement?.billing_cycle === "yearly" ? "ano" : "mês"}
                  </p>
                ) : null}
              </div>

              <div className="bg-card/90 p-6 dark:bg-white/[0.025] md:p-7">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <p className="mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  {isTrial ? "Fim do teste" : "Próxima referência"}
                </p>
                <p className="mt-2 text-base font-black text-foreground">{formatDate(periodEnd)}</p>
              </div>

              <div className="bg-card/90 p-6 dark:bg-white/[0.02] md:p-7">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <p className="mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                  Último pagamento
                </p>
                <p className="mt-2 text-base font-black text-foreground">
                  {entitlement?.last_payment_status ? checkoutStatus(entitlement.last_payment_status).label : "Sem registro"}
                </p>
              </div>
            </div>
          </section>

          {status === "past_due" || status === "payment_pending" || status === "grace_period" ? (
            <div className="flex gap-4 rounded-[24px] border border-amber-500/20 bg-amber-500/[0.07] p-5">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div>
                <p className="text-sm font-black text-foreground">Há um pagamento que precisa de atenção.</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                  Abra a aba Faturas para continuar o pagamento ou fale com o suporte se já tiver realizado a quitação.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 rounded-[24px] border border-border/45 bg-card/55 p-5 dark:bg-white/[0.02]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-sm font-black text-foreground">Situação da assinatura atualizada.</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                  O acesso é atualizado automaticamente após a confirmação de cada pagamento.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {plan !== "Enterprise" ? (
              <UpgradePlanModal currentPlan={plan}>
                <Button className="desktop-retina-interactive h-12 rounded-2xl px-6 font-bold">
                  Conhecer outros planos <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </UpgradePlanModal>
            ) : null}
            <Button asChild variant="ghost" className="h-12 rounded-2xl px-6 font-bold text-muted-foreground">
              <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
                Solicitar uma alteração
              </a>
            </Button>
          </div>
        </div>

        <div
          id="settings-subscription-view-panel-invoices"
          role="tabpanel"
          aria-labelledby="settings-subscription-view-tab-invoices"
          hidden={activeView !== "invoices"}
          tabIndex={0}
          className="mt-0"
        >
          <section className="desktop-retina-panel overflow-hidden rounded-[30px] border border-border/45">
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
              <div>
                <h3 className="text-base font-black text-foreground">Histórico de faturas</h3>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Pagamentos criados para sua assinatura da plataforma.
                </p>
              </div>
              <ReceiptText className="h-5 w-5 text-muted-foreground" />
            </div>

            {billingHistory.isLoading ? (
              <div className="flex min-h-52 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : billingHistory.isError ? (
              <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-bold text-foreground">Não foi possível consultar as faturas agora.</p>
                <Button variant="ghost" onClick={() => billingHistory.refetch()} className="mt-2 rounded-xl">
                  Tentar novamente
                </Button>
              </div>
            ) : billingHistory.data?.length ? (
              <div className="max-h-[440px] divide-y divide-border/35 overflow-y-auto custom-scrollbar">
                {billingHistory.data.map((invoice) => {
                  const state = checkoutStatus(invoice.status);
                  const actionable = Boolean(invoice.checkout_url) && invoice.status !== "paid";
                  return (
                    <article key={invoice.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/40">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-foreground">
                            Plano {planLabel(invoice.plan)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            {formatDate(invoice.paid_at || invoice.created_at)} · {formatCurrency(invoice.amount_cents, invoice.currency)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <span className={cn("text-[10px] font-black uppercase tracking-[0.13em]", state.tone)}>
                          {state.label}
                        </span>
                        {actionable ? (
                          <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                            <a href={invoice.checkout_url!} target="_blank" rel="noreferrer">
                              Abrir <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
                <ReceiptText className="h-6 w-6 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-black text-foreground">Nenhuma fatura registrada.</p>
                <p className="mt-1 max-w-sm text-xs font-medium text-muted-foreground">
                  Quando houver uma cobrança da assinatura, ela aparecerá aqui com o status confirmado.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
