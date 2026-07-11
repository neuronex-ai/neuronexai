"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    QrCode,
    Barcode,
    CreditCard,
    Loader2,
    Users,
    TextQuote,
    CheckCircle2,
    Plus,
    X
} from "lucide-react";
import { usePatients } from "@/hooks/use-patients";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { formatMoneyInput, moneyInputToCents } from "@/lib/financial-input";

interface CreatePaymentLinkModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type PaymentMethod = 'pix' | 'boleto' | 'card';

export const CreatePaymentLinkModal = ({ open, onOpenChange }: CreatePaymentLinkModalProps) => {
    const { data: patients } = usePatients();
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("Sessão de Psicoterapia");
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [selectedMethods, setSelectedMethods] = useState<PaymentMethod[]>(['pix', 'card']);
    const [successData, setSuccessData] = useState<any>(null);

    const toggleMethod = (method: PaymentMethod) => {
        setSelectedMethods(prev =>
            prev.includes(method)
                ? prev.filter(m => m !== method)
                : [...prev, method]
        );
    };

    const handleCreateLink = async () => {
        if (moneyInputToCents(amount) < 500) {
            return toast.error("O valor mínimo para cobrança é R$ 5,00");
        }
        if (selectedMethods.length === 0) {
            return toast.error("Selecione ao menos uma forma de pagamento");
        }
        if (!selectedPatientId) {
            return toast.error("Selecione um paciente");
        }

        setLoading(true);
        try {
            const cleanAmount = moneyInputToCents(amount);

            const { data, error } = await supabase.functions.invoke('asaas-create-payment', {
                body: {
                    amount: cleanAmount,
                    description,
                    patient_id: selectedPatientId,
                    payment_methods: selectedMethods
                }
            });

            if (error || data?.error) {
                throw new Error(error?.message || data?.error || "Failed to create payment link");
            }

            if (data?.checkout_url || data?.invoice_url) {
                toast.success("Cobrança gerada com sucesso!");
                
                if (data.pix_qr_code) {
                    setSuccessData(data);
                } else {
                    window.open(data.checkout_url || data.invoice_url, '_blank');
                    onOpenChange(false);
                }
            }
        } catch (err: any) {
            console.error("Link error:", err);
            toast.error(getUserFacingErrorMessage(err, "payment"));
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setSuccessData(null);
            setAmount("");
            setSelectedPatientId("");
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="finance-modal-surface sm:max-w-[480px] bg-zinc-950 border-white/5 p-0 overflow-hidden rounded-[32px] shadow-2xl">
                <div className="absolute inset-0 premium-noise opacity-[0.03] pointer-events-none" />

                <DialogHeader className="p-8 pb-4 flex flex-row items-center justify-between border-b border-white/5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                            {successData ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <Plus className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <DialogTitle className="text-lg font-black text-white uppercase tracking-tighter">
                            {successData ? "Cobrança Gerada" : "Nova Cobrança"}
                        </DialogTitle>
                    </div>
                    <button onClick={handleClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </DialogHeader>

                {successData ? (
                    <div className="p-8 space-y-8 relative z-10 text-center">
                        <div className="space-y-2">
                            <p className="text-zinc-400 text-sm font-medium">Escaneie o QR Code abaixo para pagar via PIX</p>
                            <div className="text-3xl font-black text-white">
                                R$ {(successData.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                        </div>

                        <div className="relative aspect-square w-full max-w-[240px] mx-auto bg-white p-4 rounded-3xl shadow-2xl">
                            <img 
                                src={`data:image/png;base64,${successData.pix_qr_code}`} 
                                alt="PIX QR Code" 
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 relative group">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 text-left">Código Copia e Cola</p>
                                <div className="text-[11px] font-mono text-zinc-300 break-all text-left line-clamp-2 pr-8">
                                    {successData.pix_copy_paste}
                                </div>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(successData.pix_copy_paste);
                                        toast.success("Código copiado!");
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                    <QrCode className="w-4 h-4 text-white" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={() => window.open(successData.checkout_url || successData.invoice_url, '_blank')}
                                    variant="outline"
                                    className="h-14 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-bold"
                                >
                                    Ver Fatura
                                </Button>
                                <Button
                                    onClick={handleClose}
                                    className="h-14 rounded-2xl bg-white text-black hover:bg-zinc-200 font-bold"
                                >
                                    Concluir
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 space-y-8 relative z-10">
                        {/* Valor */}
                        <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-zinc-500">R$</div>
                            <input
                                type="text"
                                value={amount}
                                onChange={(e) => setAmount(formatMoneyInput(e.target.value))}
                                placeholder="0,00"
                                className="w-full h-24 bg-white/[0.02] border-none text-5xl font-black text-white placeholder:text-zinc-800 text-right px-8 rounded-[24px] focus:ring-2 focus:ring-white/10 transition-all outline-none"
                            />
                        </div>

                        {/* Paciente */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1 flex items-center gap-2">
                                <Users className="w-3 h-3" /> Paciente
                            </label>
                            <select
                                value={selectedPatientId}
                                onChange={(e) => setSelectedPatientId(e.target.value)}
                                className="w-full h-14 bg-white/[0.03] border border-white/5 rounded-2xl px-5 text-sm font-bold text-white appearance-none outline-none focus:border-white/20 transition-all"
                            >
                                <option value="" disabled className="bg-zinc-900">Selecione um paciente...</option>
                                {patients?.map(p => (
                                    <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Descrição */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1 flex items-center gap-2">
                                <TextQuote className="w-3 h-3" /> Descrição
                            </label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ex: Sessão Quinzenal"
                                className="h-14 bg-white/[0.03] border-white/5 rounded-2xl px-5 text-sm font-bold text-white focus:border-white/20 transition-all"
                            />
                        </div>

                        {/* Formas de Pagamento */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ml-1">Formas de Pagamento Aceitas</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'pix', label: 'PIX', icon: QrCode },
                                    { id: 'card', label: 'CARTÃO', icon: CreditCard },
                                    { id: 'boleto', label: 'BOLETO', icon: Barcode },
                                ].map((method) => {
                                    const isActive = selectedMethods.includes(method.id as PaymentMethod);
                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => toggleMethod(method.id as PaymentMethod)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] border transition-all duration-500 relative overflow-hidden group/btn",
                                                isActive
                                                    ? "bg-white border-transparent text-black shadow-[0_12px_24px_-8px_rgba(255,255,255,0.2)]"
                                                    : "bg-white/[0.02] border-white/5 text-zinc-500 hover:bg-white/[0.05]"
                                            )}
                                        >
                                            <method.icon className={cn("w-5 h-5 transition-transform duration-500 group-hover/btn:scale-110", isActive ? "text-black" : "text-zinc-600")} />
                                            <span className="text-[9px] font-black tracking-widest uppercase">{method.label}</span>
                                            {isActive && (
                                                <div className="absolute top-2 right-2">
                                                    <CheckCircle2 className="w-3 h-3 text-black" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <Button
                            onClick={handleCreateLink}
                            disabled={loading}
                            className="w-full h-16 rounded-full bg-white text-black hover:bg-zinc-200 transition-all font-black uppercase tracking-[0.2em] text-[11px] mt-4 shadow-2xl"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Gerar Cobrança"
                            )}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
