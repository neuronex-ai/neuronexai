"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { isAfter, subDays } from "date-fns";
import {
  Activity,
  ArrowDownLeft,
  BadgeCent,
  Barcode,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileCheck,
  FileText,
  History,
  Key,
  Landmark,
  PlusCircle,
  QrCode,
  Receipt,
  Repeat,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useTransactions } from "@/hooks/use-transactions";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { useNeuroFinanceStatement } from "@/hooks/use-neurofinance-statement";
import { useNeuroFinanceBalanceDetails } from "@/hooks/use-neurofinance-balance-details";
import { FinanceiroMainContent, FinanceView } from "@/components/financeiro/FinanceiroMainContent";
import { NewTransactionModal } from "@/components/financeiro/NewTransactionModal";
import {
  SYNAPSE_PAGE_ACTION_EVENT,
  type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";
import { Transaction } from "@/types";

interface NavSubItem {
  id: FinanceView;
  label: string;
  icon: ElementType<{ className?: string }>;
  tag?: string;
  description?: string;
  subItems?: NavSubItem[];
}

interface NavItem {
  id: string;
  label: string;
  icon: ElementType<{ className?: string }>;
  sectionLabel?: string;
  subItems?: NavSubItem[];
}

const BANKING_QUERY_KEYS = ["onboarding", "payment"];

const FINANCE_NAV: NavItem[] = [
  {
    id: "management-root",
    sectionLabel: "Gestão Financeira",
    label: "Gestão",
    icon: Landmark,
    subItems: [
      { id: "gestao-visao-geral", label: "Visão Geral", icon: Landmark, description: "Resultado, previsão, recebíveis e pendências do consultório" },
      { id: "gestao-lancamentos", label: "Lançamentos", icon: Receipt, description: "Receitas e despesas" },
      { id: "gestao-cobrancas", label: "Cobranças", icon: WalletCards, description: "Cobranças abertas, vencidas e recorrentes" },
      { id: "gestao-recebimentos", label: "Recebimentos", icon: ArrowDownLeft, description: "Baixas e valores em aberto" },
      { id: "gestao-planejamento", label: "Planejamento", icon: Sparkles, description: "Metas e recorrências" },
    ],
  },
  { id: "account-balance-root", sectionLabel: "NeuroFinance", label: "Conta e Saldo", icon: CreditCard, subItems: [{ id: "conta-digital", label: "Conta e Saldo", icon: CreditCard }] },
  {
    id: "pix-root",
    label: "Área Pix",
    icon: BadgeCent,
    subItems: [
      { id: "pix-pagar", label: "Pagar Pix", icon: QrCode, tag: "Grátis", description: "Cole um Pix copia e cola e pague pela conta NeuroFinance" },
      { id: "pix-qrcode", label: "Gerar QR Code", icon: QrCode, tag: "Grátis", description: "Crie um QR Code para receber na hora" },
      { id: "pix-receber", label: "Pix recebidos", icon: ArrowDownLeft, tag: "Grátis", description: "Veja o que entrou por Pix" },
      { id: "pix-chaves", label: "Minhas chaves", icon: Key, description: "Gerencie chaves Pix" },
      { id: "pix-salarios", label: "Pagar salários", icon: Users, tag: "Grátis", description: "Pix em lote" },
      { id: "pix-limites", label: "Limites", icon: ShieldCheck, tag: "No App", description: "Ajuste limites de segurança" },
    ],
  },
  { id: "statement-root", label: "Extrato da conta", icon: FileText, subItems: [{ id: "extrato", label: "Extrato da conta", icon: FileText }] },
  {
    id: "cobrancas-root",
    label: "Cobranças bancárias",
    icon: WalletCards,
    subItems: [
      { id: "cobrancas-historia", label: "Todas as cobranças", icon: History },
      { id: "cobrancas-simulador", label: "Simulador de vendas", icon: BadgeCent },
      { id: "cobrancas-config", label: "Regras automáticas", icon: Settings },
    ],
  },
  {
    id: "pagamentos-root",
    label: "Pagamentos",
    icon: Receipt,
    subItems: [
      { id: "pagamentos-boletos", label: "Pagar boletos", icon: Barcode, description: "Digite ou anexe PDF" },
      { id: "pagamentos-agendados", label: "Agendados", icon: CalendarClock, description: "Pagamentos programados" },
    ],
  },
  {
    id: "antecipacoes-root",
    label: "Antecipação",
    icon: TrendingUp,
    subItems: [
      { id: "antecipacoes-lista", label: "Minhas antecipações", icon: History },
      { id: "antecipacoes-solicitar", label: "Antecipar recebimento", icon: TrendingUp },
      { id: "antecipacoes-automatica", label: "Antecipação automática", icon: Repeat },
    ],
  },
  { id: "transfers-root", label: "Transferências", icon: Send, subItems: [{ id: "pix-transferir", label: "Transferir via Pix", icon: Send, tag: "Grátis", description: "Envie dinheiro para uma chave Pix" }] },
  {
    id: "withdrawals-root",
    label: "Saques",
    icon: ArrowDownLeft,
    subItems: [
      { id: "transferencias", label: "Saques", icon: Send },
      { id: "contas-bancarias", label: "Contas e Chaves", icon: Landmark },
    ],
  },
  { id: "chargebacks-root", label: "Chargebacks", icon: Activity, subItems: [{ id: "cobrancas-chargebacks", label: "Chargebacks", icon: Activity }] },
  {
    id: "fiscal-root",
    label: "NFS-e",
    icon: FileText,
    subItems: [
      { id: "fiscal-dados", label: "Dados Fiscais", icon: Landmark },
      { id: "fiscal-nova", label: "Emitir nota fiscal", icon: PlusCircle, tag: "Em breve" },
      { id: "fiscal-lista", label: "Minhas Notas Fiscais", icon: FileCheck },
    ],
  },
  { id: "tarifas-root", label: "Tarifas", icon: Receipt, subItems: [{ id: "tarifas", label: "Custos e prazos", icon: Receipt }] },
  { id: "bank-settings-root", label: "Ajustes", icon: Settings, subItems: [{ id: "saude-conta", label: "Saúde da conta", icon: ShieldCheck }] },
];

const SIDEBAR_COLLAPSED_WIDTH = 280;
const SIDEBAR_EXPANDED_WIDTH = 280;
const SIDEBAR_EASE = [0.22, 1, 0.36, 1] as const;
const SIDEBAR_ENTER_DELAY = 45;
const SIDEBAR_LEAVE_DELAY = 90;
const SIDEBAR_DETAILS_REVEAL_DELAY = 70;
const SIDEBAR_WIDTH_COLLAPSE_DELAY = 135;
const SIDEBAR_WIDTH_TRANSITION = { type: "spring", stiffness: 360, damping: 40, mass: 0.7 } as const;

const getInitialFinanceView = (pathname: string, search: string): FinanceView => {
  const searchParams = new URLSearchParams(search);
  const viewParam = searchParams.get("view") as FinanceView;
  if (viewParam) return viewParam;

  const shouldOpenNeuroFinance = pathname.includes("/neurofinance") || BANKING_QUERY_KEYS.some((key) => searchParams.has(key));
  return shouldOpenNeuroFinance ? "conta-digital" : "gestao-visao-geral";
};

const DesktopFinanceiro = () => {
  const location = useLocation();
  const shouldReduceSidebarMotion = useReducedMotion();
  const financialAccount=useFinancialAccount();
  const { data: transactions, isLoading: isLoadingTransactions } = useTransactions(undefined,undefined,5000);
  const { data: nbStatement, isLoading: isNbStatementLoading } = useNeuroFinanceStatement(subDays(new Date(), 30), new Date());
  const { data: nbFutureDetails, isLoading: isNbFutureLoading } = useNeuroFinanceBalanceDetails("futuro");

  const [activeView, setActiveView] = useState<FinanceView>(() => getInitialFinanceView(location.pathname, location.search));
  const [extratoTab, setExtratoTab] = useState<"realizado" | "futuro" | "assinaturas">("realizado");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [showSidebarDetails, setShowSidebarDetails] = useState(true);
  const [agentTransactionModalOpen, setAgentTransactionModalOpen] = useState(false);
  const sidebarIntentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarDetailsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarWidthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const nextView = getInitialFinanceView(location.pathname, location.search);
    setActiveView((current) => (current === nextView ? current : nextView));
  }, [location.pathname, location.search]);

  const allTransactions = useMemo(() => {
    const merged = [...(transactions || [])];
    if (nbStatement) {
      nbStatement.forEach((nb: Transaction) => {
        if (!merged.find((m) => m.id === nb.id || m.external_reference === nb.id)) merged.push(nb);
      });
    }
    return merged;
  }, [transactions, nbStatement]);

  const realizedTransactions = useMemo(
    () => allTransactions.filter((transaction) => !isAfter(new Date(transaction.date), new Date()) && transaction.status === "completed"),
    [allTransactions],
  );

  const futureTransactions = useMemo(() => {
    const merged = new Map<string, Transaction>();
    [...allTransactions, ...(nbFutureDetails || [])].forEach((transaction) => {
      const key = transaction.external_reference || transaction.id;
      if (!merged.has(key)) merged.set(key, transaction);
    });
    return Array.from(merged.values())
      .filter((transaction) => isAfter(new Date(transaction.date), new Date()) || transaction.status === "pending")
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  }, [allTransactions, nbFutureDetails]);

  const subscriptionTransactions = useMemo(
    () => allTransactions.filter((transaction) => transaction.description?.toLowerCase().includes("assinatura") || transaction.category === "recurring"),
    [allTransactions],
  );

  useEffect(() => {
    const group = FINANCE_NAV.find((item) => item.subItems?.some((sub) => sub.id === activeView || sub.subItems?.some((nested) => nested.id === activeView)));
    if (group) setExpandedGroups((current) => current.includes(group.id) ? current : [group.id]);
  }, [activeView]);

  useEffect(() => {
    const handleSynapseAction = (event: Event) => {
      const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
      if (action?.action !== "open_modal" || action.modal !== "new_transaction") return;

      setActiveView("gestao-visao-geral");
      setSelectedTransaction(null);
      setAgentTransactionModalOpen(true);
    };

    window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
  }, []);

  const clearSidebarTimers = useCallback(() => {
    if (sidebarIntentTimer.current) {
      clearTimeout(sidebarIntentTimer.current);
      sidebarIntentTimer.current = null;
    }
    if (sidebarDetailsTimer.current) {
      clearTimeout(sidebarDetailsTimer.current);
      sidebarDetailsTimer.current = null;
    }
    if (sidebarWidthTimer.current) {
      clearTimeout(sidebarWidthTimer.current);
      sidebarWidthTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearSidebarTimers(), [clearSidebarTimers]);

  const setSidebarExpandedWithIntent = useCallback((expanded: boolean) => {
    if(!expanded){setIsSidebarExpanded(true);setShowSidebarDetails(true);return;}
    clearSidebarTimers();

    if (shouldReduceSidebarMotion) {
      setShowSidebarDetails(expanded);
      setIsSidebarExpanded(expanded);
      return;
    }

    sidebarIntentTimer.current = setTimeout(() => {
      if (expanded) {
        setIsSidebarExpanded(true);
        sidebarDetailsTimer.current = setTimeout(() => setShowSidebarDetails(true), SIDEBAR_DETAILS_REVEAL_DELAY);
        return;
      }

      setShowSidebarDetails(false);
      sidebarWidthTimer.current = setTimeout(() => setIsSidebarExpanded(false), SIDEBAR_WIDTH_COLLAPSE_DELAY);
    }, expanded ? SIDEBAR_ENTER_DELAY : SIDEBAR_LEAVE_DELAY);
  }, [clearSidebarTimers, shouldReduceSidebarMotion]);

  const handleGroupClick = (group: NavItem) => {
    if (!showSidebarDetails) {
      setExpandedGroups([group.id]);
      if (group.subItems?.length) setActiveView(group.subItems[0].id);
      return;
    }

    const isCurrentlyExpanded = expandedGroups.includes(group.id);
    if (isCurrentlyExpanded) setExpandedGroups([]);
    else {
      setExpandedGroups([group.id]);
      if (group.subItems?.length) setActiveView(group.subItems[0].id);
    }
  };

  const sidebarTransition = shouldReduceSidebarMotion
    ? { duration: 0 }
    : {
        width: SIDEBAR_WIDTH_TRANSITION,
        opacity: { duration: 0.18 },
        x: { duration: 0.24, ease: SIDEBAR_EASE },
      };

  const sidebarDetailTransition = shouldReduceSidebarMotion ? { duration: 0 } : { duration: 0.14, ease: SIDEBAR_EASE };
  const sidebarDisclosureTransition = shouldReduceSidebarMotion ? { duration: 0 } : { duration: 0.2, ease: SIDEBAR_EASE };
  const motionProps = {
    initial: { opacity: 0, x: 20, filter: "blur(10px)" },
    animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: { opacity: 0, x: -20, filter: "blur(10px)" },
    transition: { duration: shouldReduceSidebarMotion ? 0 : 0.28, ease: SIDEBAR_EASE },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background pt-10 font-sans text-foreground selection:bg-primary/20">
      <NewTransactionModal
        open={agentTransactionModalOpen}
        onOpenChange={setAgentTransactionModalOpen}
        showTrigger={false}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_10%,hsl(var(--foreground)/0.035),transparent_34%)] dark:bg-[radial-gradient(circle_at_50%_10%,hsl(var(--foreground)/0.045),transparent_34%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-[2200px] flex-1 gap-6 px-6 pb-12 md:px-8 lg:px-12 xl:px-16">
        <motion.nav
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0, width: isSidebarExpanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH }}
          transition={sidebarTransition}
          onMouseEnter={() => setSidebarExpandedWithIntent(true)}
          onMouseLeave={() => setSidebarExpandedWithIntent(false)}
          style={{ willChange: "width, transform" }}
          className="relative z-30 hidden shrink-0 lg:flex"
        >
          <div className="sticky top-10 flex max-h-[calc(100vh-5rem)] w-full flex-col overflow-hidden rounded-[30px] border border-border/70 bg-card/78 p-3 shadow-[0_24px_74px_-54px_hsl(var(--foreground)/0.76)] ring-1 ring-foreground/[0.025] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035] dark:ring-white/[0.035]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background)/0.62),transparent_28%),radial-gradient(circle_at_0%_0%,hsl(var(--foreground)/0.035),transparent_34%)]" />
            <div className={cn("relative z-10 flex flex-col gap-2 overflow-y-auto overflow-x-hidden no-scrollbar", showSidebarDetails ? "pr-1" : "items-center pr-0")}>
              {FINANCE_NAV.map((group) => {
                const isGroupExpanded = expandedGroups.includes(group.id);
                const hasActiveSub = group.subItems?.some((sub) => sub.id === activeView || sub.subItems?.some((nested) => nested.id === activeView));

                return (
                  <div key={group.id} className="flex flex-col gap-1 rounded-[22px]">
                    {group.sectionLabel && (
                      <div className={cn("transition-all", showSidebarDetails ? "px-3 pb-1 pt-3 text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground/65" : "mx-auto my-2 h-px w-8 rounded-full bg-border")}>
                        {showSidebarDetails ? group.sectionLabel : null}
                      </div>
                    )}
                    <button
                      onClick={() => handleGroupClick(group)}
                      title={group.label}
                      aria-expanded={showSidebarDetails ? isGroupExpanded : undefined}
                      className={cn(
                        "group relative flex h-12 items-center rounded-2xl transition-colors duration-200 ease-out",
                        showSidebarDetails ? "w-full gap-3 px-3" : "w-14 justify-center px-0",
                        hasActiveSub
                          ? "bg-foreground text-background shadow-[0_16px_38px_-26px_hsl(var(--foreground)/0.9)]"
                          : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                      )}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all", hasActiveSub ? "bg-background/14" : "border border-border/60 bg-background/55")}>
                        <group.icon className="h-5 w-5" />
                      </div>
                      <AnimatePresence initial={false}>
                        {showSidebarDetails ? (
                          <motion.div
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -4 }}
                            transition={sidebarDetailTransition}
                            className="flex min-w-0 flex-1 items-center justify-between overflow-hidden"
                          >
                            <span className="truncate text-[10px] font-black uppercase tracking-[0.15em]">{group.label}</span>
                            <ChevronRight className={cn("h-3.5 w-3.5 opacity-55 transition-transform duration-300", isGroupExpanded && "rotate-90")} />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </button>
                    <AnimatePresence>
                      {showSidebarDetails && isGroupExpanded && group.subItems ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={sidebarDisclosureTransition}
                          className="flex flex-col gap-1 overflow-hidden px-1 pb-1"
                        >
                          {group.subItems.map((sub) => {
                            const isSubActive = activeView === sub.id || sub.subItems?.some((nested) => nested.id === activeView);
                            return (
                              <button
                                key={sub.id}
                                onClick={() => setActiveView(sub.id)}
                                className={cn(
                                  "group/sub relative flex min-h-10 w-full items-center gap-3 rounded-[15px] px-3 py-2 transition-all duration-200",
                                  isSubActive
                                    ? "bg-foreground/[0.075] text-foreground"
                                    : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                                )}
                              >
                                {isSubActive && <motion.div layoutId="finance-sidebar-active" className="absolute inset-y-2 left-0 w-1 rounded-full bg-foreground" />}
                                <sub.icon className="h-3.5 w-3.5 shrink-0 transition-colors" />
                                <span className="flex-1 truncate text-left text-[9px] font-black uppercase leading-tight tracking-[0.1em]">{sub.label}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.nav>

        <div className="relative flex-1 overflow-hidden rounded-[34px] border border-border/45 bg-card/42 shadow-[0_22px_90px_-76px_hsl(var(--foreground)/0.7)] backdrop-blur-sm dark:border-white/[0.04] dark:bg-white/[0.02]">
          <AnimatePresence mode="wait">
            <FinanceiroMainContent
              selectedTransaction={selectedTransaction}
              setSelectedTransaction={setSelectedTransaction}
              activeView={activeView}
              setActiveView={setActiveView}
              allTransactions={allTransactions}
              managementTransactions={transactions||[]}
              neurofinance={{enabled:Boolean(financialAccount.isConnected),connected:financialAccount.isConnected}}
              isLoadingTransactions={isLoadingTransactions}
              motionProps={motionProps}
              extratoTab={extratoTab}
              setExtratoTab={setExtratoTab}
              realizedTransactions={realizedTransactions}
              futureTransactions={futureTransactions}
              subscriptionTransactions={subscriptionTransactions}
              isNbStatementLoading={isNbStatementLoading || isNbFutureLoading}
            />
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default DesktopFinanceiro;
