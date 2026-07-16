import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFiscalSettings } from "@/hooks/use-fiscal-settings";
import { useAsaasNfse } from "@/hooks/use-asaas-nfse";
import { useGenerateInvoice } from "@/hooks/use-generate-invoice";
import { useInvoices } from "@/hooks/use-invoices";
import { usePatients } from "@/hooks/use-patients";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronLeft, Settings, ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

interface GenerateRPSFormProps {
    onBack: () => void;
    onSuccess: () => void;
    initialPatientId?: string;
}

export const GenerateRPSForm = ({ onBack, onSuccess, initialPatientId }: GenerateRPSFormProps) => {
    const [step, setStep] = useState(0);
    const { data: patients } = usePatients();
    const { data: invoices } = useInvoices();
    const { settings: fiscalSettings, isLoading: isLoadingSettings } = useFiscalSettings();
    const { issueInvoice, isIssuing } = useAsaasNfse();
    const { mutate: createInvoice, isPending: isCreatingInvoice } = useGenerateInvoice();

    const [patientId, setPatientId] = useState(initialPatientId || "");
    const [selectedPaymentId, setSelectedPaymentId] = useState("new");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("Sessão de Psicoterapia");
    const eligiblePayments = (invoices || []).filter((invoice) =>
        invoice.gateway_payment_id &&
        invoice.status === "paid" &&
        !invoice.nfse_reference &&
        (!initialPatientId || invoice.patient_id === initialPatientId)
    );

    useEffect(() => {
        if (initialPatientId) setPatientId(initialPatientId);
    }, [initialPatientId]);

    // Requisitos mínimos para emissão
    const missingFields = [];
    if (!fiscalSettings?.cnpj) missingFields.push("CNPJ");
    if (!fiscalSettings?.municipal_inscription) missingFields.push("Inscrição Municipal");
    if (!fiscalSettings?.service_code && !fiscalSettings?.asaas_municipal_service_id) missingFields.push("Serviço municipal Asaas");

    const hasFiscalSettings = missingFields.length === 0;

    const handlePaymentSelection = (value: string) => {
        setSelectedPaymentId(value);
        if (value === "new") return;

        const selectedPayment = eligiblePayments.find((invoice) => invoice.id === value);
        if (!selectedPayment) return;

        setPatientId(selectedPayment.patient_id || "");
        setAmount(String(selectedPayment.amount || ""));
        setDescription(selectedPayment.description || description);
    };

    const handleIssue = () => {
        if (!patientId || !amount) {
            toast.error("Por favor, selecione um paciente e informe o valor.");
            return;
        }

        const selectedPayment = eligiblePayments.find((invoice) => invoice.id === selectedPaymentId);
        if (selectedPayment) {
            issueInvoice({
                payment_id: selectedPayment.gateway_payment_id!,
                payment_record_id: selectedPayment.id,
                service_description: description || selectedPayment.description || "Serviços de psicologia",
                amount: Number(amount || selectedPayment.amount || 0),
                municipal_service_id: fiscalSettings?.asaas_municipal_service_id || undefined,
                municipal_service_code: fiscalSettings?.service_code || undefined,
                municipal_service_name: fiscalSettings?.asaas_municipal_service_name || undefined,
            }, {
                onSuccess: () => {
                    setStep(3);
                    onSuccess();
                },
                onError: (error: any) => {
                    console.error("[GenerateRPSForm] Falha ao emitir documento fiscal", error);
                    toast.error(getUserFacingErrorMessage(error, "payment"));
                }
            });
            return;
        }

        createInvoice({
            patientId,
            amount: parseFloat(amount),
            description,
            dueDate: new Date(),
            billingType: 'BOLETO'
        }, {
            onSuccess: (data: any) => {
                issueInvoice({
                    payment_id: data.asaasPaymentId,
                    service_description: description,
                    amount: parseFloat(amount),
                    municipal_service_id: fiscalSettings?.asaas_municipal_service_id || undefined,
                    municipal_service_code: fiscalSettings?.service_code || undefined,
                    municipal_service_name: fiscalSettings?.asaas_municipal_service_name || undefined,
                }, {
                    onSuccess: () => {
                        setStep(3);
                        onSuccess();
                    },
                    onError: (error: any) => {
                        console.error("[GenerateRPSForm] Falha ao emitir documento fiscal", error);
                        toast.error(getUserFacingErrorMessage(error, "payment"));
                    }
                });
            }
        });
    };

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            <div className="px-10 py-8 border-b border-border/50 flex items-center justify-between bg-card/30 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={step === 0 ? onBack : () => setStep(s => s - 1)} className="h-10 w-10 rounded-2xl hover:bg-accent text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">Emissor Fiscal</h2>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-2 mt-1">
                            <ShieldCheck className="h-3 w-3 text-emerald-500" /> Transmissão Segura
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-y-auto relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />

                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div key="step0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center max-w-md w-full relative z-10">
                            <div className="w-24 h-24 bg-accent/50 dark:bg-white/[0.03] rounded-[32px] flex items-center justify-center mb-8 border border-border shadow-inner">
                                <Building2 className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-3xl font-bold mb-4 tracking-tight text-foreground">Emissão Automática</h3>

                            {!hasFiscalSettings && !isLoadingSettings ? (
                                <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl flex flex-col items-center gap-4 w-full shadow-sm">
                                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                                    <div className="text-center">
                                        <p className="font-bold text-rose-600 dark:text-rose-200 text-sm mb-1">Configuração Incompleta</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Identificamos que falta(m): <span className="text-rose-500 font-semibold">{missingFields.join(", ")}</span>.
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={onBack} className="bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest gap-2">
                                        <Settings className="h-3.5 w-3.5" /> Ajustar Configurações
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center mb-10 leading-relaxed px-8">
                                    Sua conta está devidamente configurada para emissão automática de Notas de Serviço (NFS-e).
                                </p>
                            )}

                            <Button
                                onClick={() => setStep(1)}
                                disabled={!hasFiscalSettings}
                                className="w-full h-16 bg-foreground text-background hover:bg-foreground/90 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95"
                            >
                                Configurar Guia de Emissão
                            </Button>
                        </motion.div>
                    )}

                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-2xl space-y-8 relative z-10">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cobrança NeuroFinance</label>
                                <Select value={selectedPaymentId} onValueChange={handlePaymentSelection}>
                                    <SelectTrigger className="bg-accent/30 dark:bg-white/[0.03] border-border h-14 rounded-[20px] text-sm px-6 shadow-sm focus:ring-ring">
                                        <SelectValue placeholder="Selecione uma cobrança paga" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        <SelectItem value="new">Criar nova cobrança</SelectItem>
                                        {eligiblePayments.map((invoice) => (
                                            <SelectItem key={invoice.id} value={invoice.id}>
                                                {patients?.find(p => p.id === invoice.patient_id)?.name || "Paciente"} - R$ {Number(invoice.amount || 0).toFixed(2)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Paciente (Tomador)</label>
                                <Select value={patientId} onValueChange={setPatientId} disabled={Boolean(initialPatientId)}>
                                    <SelectTrigger className="bg-accent/30 dark:bg-white/[0.03] border-border h-16 rounded-[24px] text-base px-6 shadow-sm focus:ring-ring">
                                        <SelectValue placeholder="Selecione o Paciente" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                        {patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Valor</label>
                                    <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-accent/30 dark:bg-white/[0.03] border-border h-16 rounded-[24px] text-xl font-bold px-6 shadow-sm" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Descrição</label>
                                    <Input value={description} onChange={e => setDescription(e.target.value)} className="bg-accent/30 dark:bg-white/[0.03] border-border h-16 rounded-[24px] px-6 shadow-sm" />
                                </div>
                            </div>

                            <Button onClick={() => setStep(2)} disabled={!patientId || !amount} className="w-full h-16 bg-foreground text-background hover:bg-foreground/90 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-between px-10 group transition-all">
                                <span>Revisar Dados Fiscais</span>
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                            </Button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl text-center relative z-10">
                            <h3 className="text-2xl font-bold mb-8 text-foreground">Autorização de Emissão</h3>
                            <div className="bg-accent/20 dark:bg-white/[0.02] border border-border rounded-[40px] p-8 text-left space-y-6 mb-10 shadow-inner">
                                <div className="flex justify-between items-center border-b border-border pb-4">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Valor Total</span>
                                    <span className="text-2xl font-bold text-foreground">R$ {parseFloat(amount).toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Tomador</span>
                                    <p className="font-bold text-foreground">{patients?.find(p => p.id === patientId)?.name}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Serviço</span>
                                    <p className="text-xs text-muted-foreground italic">"{description}"</p>
                                </div>
                            </div>
                            <Button onClick={handleIssue} disabled={isIssuing || isCreatingInvoice} className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-95">
                                {isIssuing ? "Processando..." : "Emitir Nota Agora"}
                            </Button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center relative z-10">
                            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 className="h-12 w-12 text-white" />
                            </div>
                            <h3 className="text-3xl font-bold mb-2 text-foreground">Nota Autorizada!</h3>
                            <p className="text-muted-foreground text-sm">O documento fiscal foi enviado para o paciente.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
