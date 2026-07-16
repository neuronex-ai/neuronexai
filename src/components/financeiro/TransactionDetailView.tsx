"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    ArrowDownLeft,
    ArrowUpRight,
    Calendar,
    ChevronLeft,
    CreditCard,
    FileText,
    Landmark,
    Receipt,
    ShieldCheck,
    User,
} from "lucide-react";
import { Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { ReceiptModal } from "@/components/financeiro/ReceiptModal";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { managementOriginOf } from "@/lib/financial-management-model";
import {
    getStatementPaymentMethodLabel,
    getStatementStatusPresentation,
} from "@/components/financeiro/statement/statement-utils";

interface TransactionDetailViewProps {
    transaction: Transaction;
    onBack: () => void;
}

const getDocumentUrl = (transaction: Transaction, kind: "receipt" | "invoice") => {
    const metadata = ((transaction as any).metadata || {}) as Record<string, any>;
    if (kind === "receipt") {
        return (transaction as any).receipt_url || metadata.receipt_url || metadata.transaction_receipt_url || metadata.asaas_transaction_receipt_url || transaction.attachment_url || "";
    }

    return (transaction as any).invoice_url || (transaction as any).bank_slip_url || metadata.invoice_url || metadata.checkout_url || metadata.bank_slip_url || metadata.asaas_invoice_url || metadata.asaas_bank_slip_url || "";
};

const openDocument = (url: string, unavailableMessage: string) => {
    if (!url) {
        toast.info(unavailableMessage);
        return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
};

const categoryLabel = (value?: string | null) => {
    const raw = String(value || "").trim();
    const normalized = raw.toLowerCase();
    if (!raw || normalized === "general" || normalized === "geral") return "Geral";
    if (["session", "sessao", "sessão"].includes(normalized)) return "Sessão";
    if (["insurance", "convenio", "convênio"].includes(normalized)) return "Convênio";
    if (/^[A-Z0-9_]+$/.test(raw)) return "Outros";
    return raw;
};

const TransactionDetailView = ({ transaction, onBack }: TransactionDetailViewProps) => {
    const shouldReduceMotion = useReducedMotion();
    const isIncome = transaction.type === "income";
    const metadata=((transaction as any).metadata||{})as Record<string,any>;const statusPresentation=getStatementStatusPresentation(transaction);const isPaid=statusPresentation.kind==="completed";const isNeuro=Boolean(transaction.origin==="gateway_auto"||metadata.neurofinance_charge_id||metadata.neurofinance_transaction_id||metadata.provider_payment_id||metadata.asaas_payment_id);const isReconciled=Boolean(metadata.neurofinance_transaction_id||metadata.reconciliation_id||metadata.reconciliation_status==="matched");
    const patientName = (transaction as any).patient_name || (transaction as any).patients?.name;
    const invoiceUrl = getDocumentUrl(transaction, "invoice");
    const patientEmail = (transaction as any).patient_email || (transaction as any).patients?.email;

    const InfoRow = ({ icon: Icon, label, value, subValue }: any) => (
        <div className="desktop-retina-inset flex items-start gap-4 rounded-[20px] border border-border/45 bg-background/58 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted/65 text-muted-foreground">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
                <span className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">{label}</span>
                <span className="truncate text-[11px] font-black uppercase tracking-tight text-foreground">{value}</span>
                {subValue && <span className="mt-0.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">{subValue}</span>}
            </div>
        </div>
    );

    return (
        <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="mx-auto flex max-w-2xl flex-col gap-6"
        >
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={onBack} className="h-10 rounded-xl bg-muted/55 px-4 text-[10px] font-black uppercase tracking-widest">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Fechar
                </Button>
                <div className="flex items-center gap-2">
                    {isPaid?<ReceiptModal transaction={transaction} patientEmail={patientEmail}>
                        <Button variant="outline" size="sm" className="h-10 rounded-full border-zinc-200 px-6 text-[10px] font-black uppercase tracking-widest dark:border-zinc-800">
                            <Receipt className="mr-2 h-3.5 w-3.5" /> Recibo
                        </Button>
                    </ReceiptModal>:null}
                    {isNeuro && invoiceUrl && (
                        <Button onClick={() => openDocument(invoiceUrl, "Fatura ainda não disponível para esta movimentação.")} variant="outline" size="sm" className="h-10 rounded-full border-zinc-200 px-6 text-[10px] font-black uppercase tracking-widest dark:border-zinc-800">
                            <FileText className="mr-2 h-3.5 w-3.5" /> Fatura
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-4 py-6 text-center">
                <div className={cn(
                    "mx-auto flex h-16 w-16 items-center justify-center rounded-[23px] bg-foreground text-background shadow-xl",
                    !isIncome && "bg-muted text-muted-foreground"
                )}>
                    {isIncome ? <ArrowUpRight className="h-8 w-8" /> : <ArrowDownLeft className="h-8 w-8" />}
                </div>
                <div>
                    <h3 className="text-3xl font-black tracking-tighter text-foreground md:text-4xl">
                        {isIncome ? "+" : "-"} R$ {Math.abs(transaction.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{transaction.description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoRow
                    icon={Calendar}
                    label="Data e hora"
                    value={transaction.date && !isNaN(new Date(transaction.date).getTime())
                        ? format(new Date(transaction.date), "dd 'de' MMMM, yyyy", { locale: ptBR })
                        : "Data indisponível"}
                    subValue={transaction.date && !isNaN(new Date(transaction.date).getTime())
                        ? format(new Date(transaction.date), "HH:mm'h'")
                        : "Horário indisponível"}
                />
                <InfoRow
                    icon={ShieldCheck}
                    label="Status da operação"
                    value={statusPresentation.label}
                    subValue={isNeuro?(isReconciled?"Conciliado no NeuroFinance":"Vinculado ao NeuroFinance"):"Registro da gestão financeira"}
                />
                {patientName && <InfoRow icon={User} label="Paciente vinculado" value={patientName} />}
                <InfoRow
                    icon={Landmark}
                    label={isIncome ? "Origem" : "Destino"}
                    value={managementOriginOf(transaction)}
                    subValue={categoryLabel(transaction.category)}
                />
                <InfoRow
                    icon={CreditCard}
                    label="Forma de pagamento"
                    value={getStatementPaymentMethodLabel(transaction)}
                    subValue={(transaction as any).installments ? `${(transaction as any).installments} parcelas` : "À vista"}
                />
            </div>

            {isNeuro && (
                <div className="group relative mt-2 overflow-hidden rounded-[24px] bg-foreground p-6 text-background shadow-xl">
                    <div className="premium-noise pointer-events-none absolute inset-0 opacity-10" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h4 className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] opacity-70">Movimentação segura</h4>
                            <p className="text-[13px] font-black uppercase tracking-tight">{isReconciled?"Processada e conciliada no NeuroFinance":"Cobrança vinculada ao NeuroFinance"}</p>
                        </div>
                        <ShieldCheck className="h-8 w-8 opacity-40 transition-transform duration-500 group-hover:scale-110" />
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default TransactionDetailView;
