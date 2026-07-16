import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFiscalSettings } from "@/hooks/use-fiscal-settings";
import { useAsaasNfse } from "@/hooks/use-asaas-nfse";
import { useGenerateInvoice } from "@/hooks/use-generate-invoice";
import { useInvoices } from "@/hooks/use-invoices";
import { usePatients } from "@/hooks/use-patients";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    const shouldReduceMotion = useReducedMotion();
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
        <div className="desktop-retina-form flex h-full flex-col bg-background/20 text-foreground">
            <div className="grid grid-cols-[44px_1fr_44px] items-center border-b border-border/45 bg-muted/18 px-6 py-5 sm:px-8">
                <div>
                    <Button variant="ghost" size="icon" onClick={step === 0 ? onBack : () => setStep(s => s - 1)} className="h-10 w-10 rounded-2xl hover:bg-accent text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                </div>
                    <div className="flex flex-col items-center text-center">
                        <span className="finance-modal-icon flex h-11 w-11 items-center justify-center rounded-[15px] bg-muted/65 text-foreground">
                            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h2 className="mt-2 text-sm font-semibold tracking-tight text-foreground">Emitir NFS-e</h2>
                        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Transmissão protegida</span>
                    </div>
                <span aria-hidden="true" />
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 sm:p-10">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />

                <AnimatePresence mode="wait">
                    {step === 0 && (
                        <motion.div key="step0" initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }} className="relative z-10 flex w-full max-w-md flex-col items-center">
                            <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-[28px] bg-muted/65 text-muted-foreground shadow-inner">
                                <Building2 className="h-8 w-8" />
                            </div>
                            <h3 className="text-3xl font-bold mb-4 tracking-tight text-foreground">Emissão Automática</h3>

                            {!hasFiscalSettings && !isLoadingSettings ? (
                                <div className="flex w-full flex-col items-center gap-4 rounded-[22px] bg-rose-500/8 p-6 shadow-sm">
                                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                                    <div className="text-center">
                                        <p className="font-bold text-rose-600 dark:text-rose-200 text-sm mb-1">Configuração Incompleta</p>
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            Identificamos que falta(m): <span className="text-rose-500 font-semibold">{missingFields.join(", ")}</span>.
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={onBack} className="h-10 gap-2 rounded-xl border-border/45 bg-background/60 text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-muted">
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
                        <motion.div key="step1" initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }} className="relative z-10 w-full max-w-2xl space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Cobrança NeuroFinance</label>
                                <Select value={selectedPaymentId} onValueChange={handlePaymentSelection}>
                                    <SelectTrigger className="h-14 rounded-[18px] border-border/45 bg-background/64 px-5 text-sm shadow-sm focus:ring-ring">
                                        <SelectValue placeholder="Selecione uma cobrança paga" />
                                    </SelectTrigger>
                                    <SelectContent className="desktop-retina-modal border-border/55 bg-popover/96">
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
                                    <SelectTrigger className="h-14 rounded-[18px] border-border/45 bg-background/64 px-5 text-sm shadow-sm focus:ring-ring">
                                        <SelectValue placeholder="Selecione o Paciente" />
                                    </SelectTrigger>
                                    <SelectContent className="desktop-retina-modal border-border/55 bg-popover/96">
                                        {patients?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Valor</label>
                                    <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="h-14 rounded-[18px] border-border/45 bg-background/64 px-5 text-lg font-bold shadow-sm" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Descrição</label>
                                    <Input value={description} onChange={e => setDescription(e.target.value)} className="h-14 rounded-[18px] border-border/45 bg-background/64 px-5 shadow-sm" />
                                </div>
                            </div>

                            <Button onClick={() => setStep(2)} disabled={!patientId || !amount} className="group flex h-14 w-full items-center justify-between rounded-2xl bg-foreground px-8 text-xs font-bold uppercase tracking-[0.16em] text-background shadow-xl hover:bg-foreground/90">
                                <span>Revisar Dados Fiscais</span>
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                            </Button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }} className="relative z-10 w-full max-w-xl text-center">
                            <h3 className="text-2xl font-bold mb-8 text-foreground">Autorização de Emissão</h3>
                            <div className="desktop-retina-inset mb-8 space-y-6 rounded-[26px] border border-border/45 bg-background/58 p-7 text-left shadow-inner">
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
                            <Button onClick={handleIssue} disabled={isIssuing || isCreatingInvoice} className="h-14 w-full rounded-2xl bg-foreground text-xs font-bold uppercase tracking-[0.16em] text-background shadow-xl hover:bg-foreground/90">
                                {isIssuing ? "Processando..." : "Emitir Nota Agora"}
                            </Button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }} className="relative z-10 text-center">
                            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                                <CheckCircle2 className="h-10 w-10" />
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
