import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import {
    QrCode,
    Key,
    ShieldCheck,
    TrendingUp,
    Landmark,
    Receipt,
    FileText,
    Users,
    Settings,
    BadgeCent,
    ChevronLeft,
    PieChart,
    Calendar,
    Send,
    Barcode,
    FolderOpen,
    Activity,
    Repeat,
    WalletCards,
    CalendarClock,
} from "lucide-react";

import { CashFlowScenarios } from "@/components/financeiro/CashFlowScenarios";
import { InvoicesListPanel } from "@/components/financeiro/InvoicesListPanel";
import { NeuroNexBankPanel } from "@/components/financeiro/NeuroNexBankPanel";
import { FinancialStatement } from "@/components/financeiro/FinancialStatement";
import { InvoicesHistoryList } from "@/components/financeiro/invoice/InvoicesHistoryList";
import { GenerateRPSForm } from "@/components/financeiro/invoice/GenerateRPSForm";
import { BankTransferView } from "@/components/financeiro/BankTransferView";
import { BankAccountsView } from "@/components/financeiro/BankAccountsView";
import { NeuroFinanceMovementsTimeline } from "@/components/financeiro/NeuroFinanceMovementsTimeline";
import TransactionDetailView from "@/components/financeiro/TransactionDetailView";
import { PixPagarCopiaCola } from "@/components/financeiro/pix/PixPagarCopiaCola";
import { PixTransferir } from "@/components/financeiro/pix/PixTransferir";
import { PixGerarQrCode } from "@/components/financeiro/pix/PixGerarQrCode";
import { PixChaves } from "@/components/financeiro/pix/PixChaves";
import { PixSalarios } from "@/components/financeiro/pix/PixSalarios";
import { PixLimites } from "@/components/financeiro/pix/PixLimites";
import { PagamentosAgendamento } from "@/components/financeiro/pagamentos/PagamentosAgendamento";
import { PagamentosGrupos } from "@/components/financeiro/pagamentos/PagamentosGrupos";
import { ScheduledBillPayments } from "@/components/financeiro/pagamentos/ScheduledBillPayments";
import { AsaasRegulatoryFooter } from "@/components/financeiro/AsaasRegulatoryFooter";
import { FiscalConfigPanel } from "@/components/settings/FiscalConfigPanel";
import { NeuroFinanceTariffs } from "@/components/financeiro/NeuroFinanceTariffs";
import { AnticipationsList } from "@/components/financeiro/antecipacoes/AnticipationsList";
import { AnticipationRequest } from "@/components/financeiro/antecipacoes/AnticipationRequest";
import { AutomaticAnticipation } from "@/components/financeiro/antecipacoes/AutomaticAnticipation";
import { SalesSimulator } from "@/components/financeiro/cobrancas/SalesSimulator";
import { ChargebacksPanel } from "@/components/financeiro/cobrancas/ChargebacksPanel";
import { AsaasAccountStatusTimeline } from "@/components/financeiro/AsaasAccountStatusTimeline";
import { DetailedStatementPanel } from "@/components/financeiro/DetailedStatementPanel";
import { FinancialManagementDashboard } from "@/components/financeiro/management/FinancialManagementDashboard";
import type{NeuroFinanceManagementContext}from"@/components/financeiro/management/FinancialManagementDashboard";
import type { Transaction } from "@/types";

export type FinanceView =
    | "gestao-visao-geral"
    | "gestao-lancamentos"
    | "gestao-recebimentos"
    | "gestao-fluxo-caixa"
    | "gestao-receitas"
    | "gestao-despesas"
    | "gestao-cobrancas"
    | "gestao-inadimplencia"
    | "gestao-repasses-convenio"
    | "gestao-recorrencia"
    | "gestao-planejamento"
    | "gestao-relatorios"
    | "conta-digital"
    | "pix"
    | "pix-pagar"
    | "pix-transferir"
    | "pix-qrcode"
    | "pix-receber"
    | "pix-chaves"
    | "pix-salarios"
    | "pix-limites"
    | "transferencias"
    | "pagamentos"
    | "pagamentos-boletos"
    | "pagamentos-agendados"
    | "pagamentos-agendar"
    | "pagamentos-grupos"
    | "contas-bancarias"
    | "saude-conta"
    | "extrato"
    | "fluxo-caixa"
    | "receitas"
    | "despesas"
    | "cobrancas-historia"
    | "cobrancas-config"
    | "cobrancas-simulador"
    | "cobrancas-chargebacks"
    | "antecipacoes"
    | "antecipacoes-lista"
    | "antecipacoes-solicitar"
    | "antecipacoes-automatica"
    | "antecipacoes-simulador"
    | "antecipacoes-historico"
    | "fiscal-dados"
    | "fiscal-nova"
    | "fiscal-lista"
    | "repasses-profissional"
    | "tarifas";

const SectionHeader = ({
    icon: Icon,
    title,
    subtitle,
    action,
    onBack,
}: {
    icon: ElementType<{ className?: string }>;
    title: string;
    subtitle: string;
    action?: ReactNode;
    onBack?: () => void;
}) => (
    <div className="finance-panel relative overflow-hidden rounded-[32px] border border-zinc-200/50 bg-white/60 p-6 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.04)] backdrop-blur-2xl dark:border-black/75 dark:bg-zinc-900/[0.42] dark:shadow-[0_18px_48px_-34px_rgba(0,0,0,0.96)] lg:p-7">
        <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay dark:opacity-[0.04]" />
        <div className="relative z-10 flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-5">
                <div className="group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-zinc-900 text-white shadow-2xl dark:bg-white dark:text-black">
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <Icon className="relative z-10 h-5 w-5" />
                </div>
                <div>
                    <h3 className="text-lg font-black uppercase leading-none tracking-tight text-zinc-900 dark:text-white">{title}</h3>
                    <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {action}
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Voltar para a visão anterior"
                        className="group/back flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 transition-all hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                        <ChevronLeft className="h-5 w-5 text-zinc-600 transition-transform group-hover/back:-translate-x-0.5 dark:text-zinc-400" />
                    </button>
                )}
            </div>
        </div>
    </div>
);

const ContentWrapper = ({ children }: { children: ReactNode }) => (
    <div className="finance-panel relative overflow-hidden rounded-[32px] border border-zinc-200/50 bg-white/40 p-5 shadow-sm backdrop-blur-xl dark:border-black/75 dark:bg-zinc-900/[0.36] dark:shadow-[0_18px_48px_-36px_rgba(0,0,0,0.94)] lg:p-6">
        <div className="premium-noise pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-overlay dark:opacity-[0.03]" />
        <div className="relative z-10">{children}</div>
    </div>
);

const PaymentRouteSwitcher = ({
    active,
    onSelect,
}: {
    active: "boleto" | "pix";
    onSelect: (route: "pagamentos-boletos" | "pix-pagar") => void;
}) => (
    <div role="group" aria-label="Forma de pagamento" className="finance-inset flex rounded-[18px] border border-zinc-200/70 bg-white/70 p-1 backdrop-blur-xl dark:border-black/75 dark:bg-black/[0.28]">
        {[
            { id: "boleto" as const, route: "pagamentos-boletos" as const, label: "Pagar boleto", icon: Barcode },
            { id: "pix" as const, route: "pix-pagar" as const, label: "Pagar Pix", icon: QrCode },
        ].map((item) => (
            <button
                key={item.id}
                type="button"
                aria-pressed={active === item.id}
                onClick={() => onSelect(item.route)}
                className={`flex h-11 items-center gap-2 rounded-[13px] px-4 text-[9px] font-black uppercase tracking-[0.12em] transition-all ${
                    active === item.id
                        ? "bg-zinc-950 text-white shadow-md dark:bg-white dark:text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                }`}
            >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
            </button>
        ))}
    </div>
);

const CapabilityNotice = ({ icon: Icon, title, description }: { icon: ElementType<{ className?: string }>; title: string; description: string }) => (
    <div className="finance-inset flex min-h-[260px] flex-col items-center justify-center rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/50 px-8 text-center dark:border-black/70 dark:bg-black/[0.18]">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-black/75 dark:bg-black/30 dark:shadow-[0_16px_38px_-30px_rgba(0,0,0,0.94)]">
            <Icon className="h-6 w-6 text-zinc-500" />
        </div>
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-zinc-900 dark:text-white">{title}</h4>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
    </div>
);

export interface FinancialDashboardProps {
    selectedTransaction: Transaction | null;
    setSelectedTransaction: (t: Transaction | null) => void;
    activeView: FinanceView;
    setActiveView: (view: FinanceView) => void;
    allTransactions: Transaction[];
    managementTransactions?:Transaction[];
    neurofinance?:NeuroFinanceManagementContext;
    isLoadingTransactions: boolean;
    motionProps: HTMLMotionProps<"div">;
    extratoTab: "realizado" | "futuro" | "assinaturas";
    setExtratoTab: (tab: "realizado" | "futuro" | "assinaturas") => void;
    realizedTransactions: Transaction[];
    futureTransactions: Transaction[];
    subscriptionTransactions: Transaction[];
    isNbStatementLoading: boolean;
    statementPixReceivedPreset?: boolean;
}

export function FinancialDashboard({
    selectedTransaction,
    setSelectedTransaction,
    activeView,
    setActiveView,
    allTransactions,
    managementTransactions,
    neurofinance,
    isLoadingTransactions,
    motionProps,
    extratoTab,
    setExtratoTab,
    realizedTransactions,
    futureTransactions,
    subscriptionTransactions,
    statementPixReceivedPreset = false,
}: FinancialDashboardProps) {
    const handleGoBack = () => {
        setActiveView("gestao-visao-geral");
        setSelectedTransaction(null);
    };

    if (selectedTransaction) {
        return (
            <motion.div {...motionProps} key="transaction-detail" className="px-6 py-6">
                <TransactionDetailView transaction={selectedTransaction} onBack={() => setSelectedTransaction(null)} />
            </motion.div>
        );
    }

    switch (activeView) {
        case "gestao-visao-geral":
        case "gestao-lancamentos":
        case "gestao-recebimentos":
        case "gestao-fluxo-caixa":
        case "gestao-receitas":
        case "gestao-despesas":
        case "gestao-cobrancas":
        case "gestao-inadimplencia":
        case "gestao-repasses-convenio":
        case "gestao-recorrencia":
        case "gestao-planejamento":
        case "gestao-relatorios":
            return (
                <motion.div {...motionProps} key={activeView}>
                    <FinancialManagementDashboard
                        activeView={activeView}
                        setActiveView={setActiveView}
                        allTransactions={allTransactions}
                        managementTransactions={managementTransactions}
                        neurofinance={neurofinance}
                        realizedTransactions={realizedTransactions}
                        futureTransactions={futureTransactions}
                        subscriptionTransactions={subscriptionTransactions}
                        isLoadingTransactions={isLoadingTransactions}
                        setSelectedTransaction={setSelectedTransaction}
                    />
                </motion.div>
            );

        case "conta-digital":
            return (
                <motion.div {...motionProps} key="conta-digital" className="space-y-6 px-6 py-6">
                    <NeuroNexBankPanel transactions={allTransactions} isLoadingTransactions={isLoadingTransactions} onNavigate={setActiveView} />
                    <NeuroFinanceMovementsTimeline
                        onOpenFutureStatement={() => {
                            setExtratoTab("futuro");
                            setActiveView("extrato");
                        }}
                        onOpenScheduledPayments={() => setActiveView("pagamentos-agendados")}
                    />
                    <AsaasRegulatoryFooter />
                </motion.div>
            );

        case "extrato":
        case "pix":
        case "pix-receber":
            return (
                <motion.div {...motionProps} key={`extrato-${statementPixReceivedPreset || activeView !== "extrato" ? "pix" : "all"}`} className="px-6 py-6">
                    <div className="mx-auto max-w-7xl space-y-6">
                        <SectionHeader icon={FileText} title="Extrato" subtitle="Histórico unificado NeuroFinance e manual" onBack={handleGoBack} />
                        <DetailedStatementPanel
                            tab={extratoTab}
                            onTabChange={setExtratoTab}
                            onSelectTransaction={setSelectedTransaction}
                            initialPixReceivedFilter={statementPixReceivedPreset || activeView === "pix" || activeView === "pix-receber"}
                        />
                    </div>
                </motion.div>
            );

        case "receitas":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={TrendingUp} title="Receitas" subtitle="Entradas confirmadas" onBack={handleGoBack} /><ContentWrapper><FinancialStatement transactions={allTransactions.filter((t) => t.type === "income")} isLoading={isLoadingTransactions} onSelectTransaction={setSelectedTransaction} /></ContentWrapper></motion.div>;
        case "despesas":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={PieChart} title="Despesas" subtitle="Saídas e custos" onBack={handleGoBack} /><ContentWrapper><FinancialStatement transactions={allTransactions.filter((t) => t.type === "expense")} isLoading={isLoadingTransactions} onSelectTransaction={setSelectedTransaction} /></ContentWrapper></motion.div>;
        case "pix-pagar":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={QrCode} title="Pagar Pix" subtitle="Cole o Pix e pague" action={<PaymentRouteSwitcher active="pix" onSelect={setActiveView} />} onBack={() => setActiveView("extrato")} /><ContentWrapper><PixPagarCopiaCola /></ContentWrapper></motion.div>;
        case "pix-transferir":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Send} title="Transferir" subtitle="Envie para uma chave Pix" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixTransferir /></ContentWrapper></motion.div>;
        case "pix-qrcode":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={QrCode} title="QR Code" subtitle="Gere um Pix para receber" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixGerarQrCode /></ContentWrapper></motion.div>;
        case "pix-chaves":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Key} title="Chaves Pix" subtitle="Suas chaves para receber" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixChaves /></ContentWrapper></motion.div>;
        case "pix-salarios":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Users} title="Salários" subtitle="Pix em lote para sua equipe" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixSalarios /></ContentWrapper></motion.div>;
        case "pix-limites":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={ShieldCheck} title="Limites" subtitle="Segurança da conta" onBack={() => setActiveView("extrato")} /><ContentWrapper><PixLimites /></ContentWrapper></motion.div>;
        case "transferencias":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Send} title="Saque" subtitle="Envie fundos para sua conta" onBack={handleGoBack} /><ContentWrapper><BankTransferView /></ContentWrapper></motion.div>;
        case "pagamentos":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Receipt} title="Pagamentos" subtitle="Pague boletos e Pix" action={<PaymentRouteSwitcher active="boleto" onSelect={setActiveView} />} onBack={handleGoBack} /><ContentWrapper><PagamentosAgendamento /></ContentWrapper></motion.div>;
        case "pagamentos-boletos":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Barcode} title="Pagar boletos" subtitle="Linha digitável, imagem ou PDF" action={<PaymentRouteSwitcher active="boleto" onSelect={setActiveView} />} onBack={() => setActiveView("pagamentos")} /><ContentWrapper><PagamentosAgendamento /></ContentWrapper></motion.div>;
        case "pagamentos-agendados":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={CalendarClock} title="Pagamentos Agendados" subtitle="Programações e histórico da conta NeuroFinance" onBack={() => setActiveView("pagamentos")} /><ContentWrapper><ScheduledBillPayments /></ContentWrapper></motion.div>;
        case "pagamentos-agendar":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Calendar} title="Pagar contas" subtitle="Boletos e Pix de fornecedores" onBack={() => setActiveView("pagamentos")} /><ContentWrapper><PagamentosAgendamento /></ContentWrapper></motion.div>;
        case "pagamentos-grupos":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={FolderOpen} title="Pagamentos em lote" subtitle="Organize várias contas de uma vez" onBack={() => setActiveView("pagamentos")} /><ContentWrapper><PagamentosGrupos /></ContentWrapper></motion.div>;
        case "contas-bancarias":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Landmark} title="Ajustes" subtitle="Conta bancária" onBack={handleGoBack} /><ContentWrapper><BankAccountsView /></ContentWrapper></motion.div>;
        case "saude-conta":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={ShieldCheck} title="Saúde da conta" subtitle="Status documental e análise cadastral" onBack={handleGoBack} /><AsaasAccountStatusTimeline /></motion.div>;
        case "fluxo-caixa":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={TrendingUp} title="Fluxo" subtitle="Análise de caixa" onBack={handleGoBack} /><div className="h-[500px] overflow-hidden rounded-[32px]"><CashFlowScenarios /></div></motion.div>;
        case "cobrancas-historia":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={WalletCards} title="Todas as cobranças" subtitle="Veja, filtre e crie cobranças" onBack={handleGoBack} /><InvoicesListPanel /></motion.div>;
        case "cobrancas-config":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Settings} title="Regras automáticas" subtitle="Como o sistema cobra por você" onBack={handleGoBack} /><ContentWrapper><CapabilityNotice icon={Settings} title="Cobrança no piloto automático" description="Aqui reuniremos regras simples para cobrar consultas, pacotes e assinaturas sem trabalho manual." /></ContentWrapper></motion.div>;
        case "cobrancas-simulador":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={BadgeCent} title="Simulador de vendas" subtitle="Veja taxas e valor líquido antes de cobrar" onBack={handleGoBack} /><SalesSimulator /></motion.div>;
        case "cobrancas-chargebacks":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Activity} title="Contestações" subtitle="Contestações e reversões de pagamento" onBack={handleGoBack} /><ChargebacksPanel /></motion.div>;
        case "antecipacoes-lista":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Repeat} title="Minhas antecipações" subtitle="Acompanhe solicitações e créditos" onBack={handleGoBack} /><AnticipationsList /></motion.div>;
        case "antecipacoes":
        case "antecipacoes-solicitar":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={TrendingUp} title="Antecipar recebimento" subtitle="Receba antes o que já está previsto" onBack={handleGoBack} /><AnticipationRequest /></motion.div>;
        case "antecipacoes-automatica":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Repeat} title="Antecipação automática" subtitle="Configure quando estiver disponível" onBack={handleGoBack} /><AutomaticAnticipation /></motion.div>;
        case "antecipacoes-simulador":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={WalletCards} title="Simular antecipação" subtitle="Veja o valor antes de confirmar" onBack={() => setActiveView("antecipacoes-solicitar")} /><AnticipationRequest /></motion.div>;
        case "antecipacoes-historico":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Repeat} title="Histórico de antecipações" subtitle="O que já foi antecipado" onBack={() => setActiveView("antecipacoes-lista")} /><AnticipationsList /></motion.div>;
        case "fiscal-dados":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={Landmark} title="Dados Fiscais" subtitle="Informações usadas na emissão da NFS-e" onBack={handleGoBack} /><ContentWrapper><FiscalConfigPanel /></ContentWrapper></motion.div>;
        case "fiscal-nova":
            return <motion.div {...motionProps} className="px-6 py-6"><GenerateRPSForm onBack={handleGoBack} onSuccess={() => setActiveView("fiscal-lista")} /></motion.div>;
        case "fiscal-lista":
            return <motion.div {...motionProps} className="px-6 py-6"><SectionHeader icon={FileText} title="Minhas Notas Fiscais" subtitle="Histórico fiscal" onBack={handleGoBack} /><ContentWrapper><InvoicesHistoryList fiscalOnly /></ContentWrapper></motion.div>;
        case "repasses-profissional":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Users} title="Repasses" subtitle="Conta bancária de destino para saques e recebimentos" onBack={handleGoBack} /><ContentWrapper><BankAccountsView /></ContentWrapper></motion.div>;
        case "tarifas":
            return <motion.div {...motionProps} className="space-y-6 px-6 py-6"><SectionHeader icon={Receipt} title="Tarifas" subtitle="Custos e prazos, sem letras miúdas" onBack={handleGoBack} /><NeuroFinanceTariffs /></motion.div>;
        default:
            return null;
    }
}
