"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, useReducedMotion } from "framer-motion";
import { 
    X, 
    CreditCard, 
    Barcode, 
    QrCode, 
    Calendar, 
    User, 
    DollarSign,
    Info,
    ArrowRight,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMoneyInput, moneyInputToNumber } from "@/lib/financial-input";

const billingSchema = z.object({
    patient_id: z.string().min(1, "Selecione um paciente"),
    amount: z.number().min(5, "Valor mínimo é R$ 5,00"),
    dueDate: z.string().min(1, "Selecione o vencimento"),
    description: z.string().optional(),
    billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"]),
    installments: z.number().min(1).max(12).optional().default(1),
});

type BillingForm = z.infer<typeof billingSchema>;

interface BillingPatientOption {
    id: string;
    name: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patients: BillingPatientOption[];
}

const fieldClass =
    "w-full h-14 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 text-sm font-bold outline-none transition-all placeholder:text-zinc-400 hover:border-zinc-300 hover:bg-white focus:border-zinc-900/25 focus:ring-2 focus:ring-zinc-900/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:focus:border-white/25 dark:focus:ring-white/25 motion-reduce:transition-none";

const subtleButtonClass =
    "h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-95 dark:focus-visible:ring-white/25 dark:focus-visible:ring-offset-zinc-950 motion-reduce:transition-none motion-reduce:active:scale-100";

export const CreateBillingModal = ({ open, onOpenChange, patients }: Props) => {
    const [loading, setLoading] = React.useState(false);
    const shouldReduceMotion = useReducedMotion();

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BillingForm>({
        resolver: zodResolver(billingSchema),
        defaultValues: {
            billingType: "UNDEFINED",
            installments: 1
        }
    });

    const selectedType = watch("billingType");

    React.useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onOpenChange(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onOpenChange, open]);

    const onSubmit = async (data: BillingForm) => {
        setLoading(true);
        try {
            const methodMap: Record<BillingForm["billingType"], "pix" | "boleto" | "card" | "undefined"> = {
                PIX: "pix",
                BOLETO: "boleto",
                CREDIT_CARD: "card",
                UNDEFINED: "undefined",
            };

            const { data: paymentData, error } = await supabase.functions.invoke("asaas-create-payment", {
                body: {
                    patient_id: data.patient_id,
                    amount: Math.round(data.amount * 100),
                    payment_method: methodMap[data.billingType],
                    due_date: data.dueDate,
                    description: data.description,
                    installments: data.installments,
                },
            });

            if (error) throw error;
            if ((paymentData as any)?.error) throw new Error((paymentData as any).error);

            toast.success("Cobrança gerada com sucesso!");
            onOpenChange(false);
        } catch (error) {
            toast.error("Erro ao gerar cobrança. Verifique os dados.");
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-3 py-[max(0.75rem,env(safe-area-inset-top))] md:px-6">
            <motion.div 
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                onClick={() => onOpenChange(false)}
                className="absolute inset-0 bg-black/55 backdrop-blur-xl dark:bg-black/68"
            />
            
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-billing-title"
                initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 18 }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 360 }}
                className="relative flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_30px_90px_-42px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_30px_110px_-42px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[32px]"
            >
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-100 px-5 py-5 dark:border-white/5 sm:px-8 sm:py-6">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Nova Cobrança</h2>
                        <p className="text-xs text-zinc-500 font-medium mt-1">Gere faturas profissionais para seus pacientes</p>
                    </div>
                    <button 
                        onClick={() => onOpenChange(false)}
                        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    <form id="billing-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                                <User className="w-3 h-3" /> Paciente
                            </label>
                            <select 
                                {...register("patient_id")}
                                className="w-full h-14 px-5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-bold focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all outline-none"
                            >
                                <option value="">Selecione um paciente</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            {errors.patient_id && <p className="text-red-500 text-[10px] font-bold px-2">{errors.patient_id.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                                    <DollarSign className="w-3 h-3" /> Valor (R$)
                                </label>
                                <input 
                                    inputMode="decimal"
                                    {...register("amount", {
                                        setValueAs: moneyInputToNumber,
                                        onChange: (event) => { event.target.value = formatMoneyInput(event.target.value); },
                                    })}
                                    className="w-full h-14 px-5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Vencimento
                                </label>
                                <input 
                                    type="date"
                                    {...register("dueDate")}
                                    className="w-full h-14 px-5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-bold focus:ring-2 focus:ring-zinc-900 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Método de Recebimento</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { id: 'PIX', label: 'PIX', icon: QrCode },
                                    { id: 'BOLETO', label: 'Boleto', icon: Barcode },
                                    { id: 'CREDIT_CARD', label: 'Cartão', icon: CreditCard },
                                    { id: 'UNDEFINED', label: 'Todos', icon: Info },
                                ].map(method => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => setValue("billingType", method.id as any)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 group",
                                            selectedType === method.id 
                                                ? "bg-zinc-900 border-zinc-900 text-white dark:bg-white dark:border-white dark:text-black shadow-xl" 
                                                : "bg-transparent border-zinc-100 dark:border-white/5 text-zinc-400 hover:border-zinc-300 dark:hover:border-white/20"
                                        )}
                                    >
                                        <method.icon className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase">{method.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Descrição / Observações</label>
                            <textarea 
                                {...register("description")}
                                className="w-full h-24 p-5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-medium focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                                placeholder="Descreva o serviço realizado..."
                            />
                        </div>
                    </form>
                </div>

                <div className="px-8 py-6 bg-zinc-50 dark:bg-white/[0.02] border-t border-zinc-100 dark:border-white/5 shrink-0 flex items-center justify-end gap-4">
                    <button 
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="h-14 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        form="billing-form"
                        type="submit"
                        disabled={loading}
                        className="h-14 px-10 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gerar Cobrança"}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
