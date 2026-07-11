import { useRecurringInvoices } from "@/hooks/use-recurring-invoices";
import { usePatients } from "@/hooks/use-patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Repeat, User, CalendarDays, ArrowDownRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";

export const RecurringInvoicesList = () => {
    const { invoices, isLoading, addInvoice, toggleInvoice, removeInvoice } = useRecurringInvoices();
    const { data: patients } = usePatients();
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form State
    const [patientId, setPatientId] = useState("");
    const [amount, setAmount] = useState("");
    const [day, setDay] = useState("5");
    const [desc, setDesc] = useState("Mensalidade Terapia");

    const handleAdd = () => {
        if (!amount || !patientId) return;
        addInvoice({
            patient_id: patientId,
            amount: parseFloat(amount),
            day_of_month: parseInt(day),
            description: desc,
            active: true
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setAmount("");
                setPatientId("");
            }
        });
    };

    return (
        <div className="flex flex-col h-full p-8">
            <div className="flex items-center justify-between mb-8 px-1 shrink-0 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-900/10 dark:bg-white/10 rounded-[18px] border border-zinc-900/20 dark:border-white/20 text-zinc-900 dark:text-white shadow-sm">
                        <ArrowDownRight className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em]">Receita Recorrente</h3>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Assinaturas Ativas</p>
                    </div>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-2xl bg-zinc-100 hover:bg-zinc-900 dark:bg-white/5 dark:hover:bg-white text-zinc-400 hover:text-white dark:hover:text-black transition-all shadow-sm group">
                            <Plus className="h-5 w-5 transition-transform group-hover:rotate-90" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="finance-modal-surface bg-white dark:bg-[#09090b] border-zinc-200 dark:border-white/10 w-[380px] rounded-[32px] p-8 shadow-2xl">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="flex items-center gap-3 text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tighter">
                                <div className="p-2.5 rounded-xl bg-zinc-900/10 dark:bg-white/10 text-zinc-900 dark:text-white"><Repeat className="h-5 w-5" /></div>
                                Nova Assinatura
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Paciente</label>
                                <Select value={patientId} onValueChange={setPatientId}>
                                    <SelectTrigger className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-12 rounded-2xl text-xs font-bold focus:ring-0 text-zinc-900 dark:text-zinc-200 shadow-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                        {patients?.map(p => <SelectItem key={p.id} value={p.id} className="text-xs font-medium focus:bg-zinc-100 dark:focus:bg-zinc-800 rounded-lg cursor-pointer">{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Descrição do Plano</label>
                                <Input placeholder="Ex: Mensalidade Terapia" value={desc} onChange={e => setDesc(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-12 rounded-2xl text-xs font-bold text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 shadow-sm focus-visible:ring-0" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Valor (R$)</label>
                                    <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-12 rounded-2xl text-xs font-bold text-zinc-900 dark:text-white shadow-sm focus-visible:ring-0" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Dia Venc.</label>
                                    <Input type="number" placeholder="Dia" min={1} max={31} value={day} onChange={e => setDay(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 h-12 rounded-2xl text-xs text-center font-bold text-zinc-900 dark:text-zinc-200 shadow-sm focus-visible:ring-0" />
                                </div>
                            </div>

                            <Button onClick={handleAdd} className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl mt-2 transition-transform active:scale-95">
                                Confirmar Assinatura
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 relative z-10">
                {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-300 dark:text-zinc-700" /></div> :
                    invoices?.map(inv => (
                        <div key={inv.id} className={cn(
                            "group relative p-5 rounded-[24px] border transition-all duration-300 flex items-center justify-between overflow-hidden shadow-sm",
                            inv.active
                                ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-white hover:shadow-lg dark:hover:shadow-white/5"
                                : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-white/5 opacity-60 grayscale hover:opacity-80"
                        )}>
                            {/* Active Indicator Strip */}
                            {inv.active && <div className="absolute left-0 top-4 bottom-4 w-1 bg-zinc-900 dark:bg-white rounded-r-full shadow-lg" />}

                            <div className="flex items-center gap-5 min-w-0 pl-3">
                                <div className={cn(
                                    "w-11 h-11 rounded-[16px] flex items-center justify-center border transition-colors shadow-inner",
                                    inv.active ? "bg-zinc-900/10 dark:bg-white/10 border-zinc-900/20 dark:border-white/20 text-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-white/5"
                                )}>
                                    <User className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-zinc-900 dark:text-white truncate mb-1 uppercase tracking-tight">{inv.patient?.name || "Paciente"}</p>
                                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wide">
                                        <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Dia {inv.day_of_month}</span>
                                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                        <span className="truncate max-w-[120px]">{inv.description}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-5">
                                <span className={cn(
                                    "text-sm font-black tracking-tighter",
                                    inv.active ? "text-zinc-900 dark:text-white" : "text-zinc-400"
                                )}>
                                    {formatCurrency(inv.amount)}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={inv.active}
                                        onCheckedChange={(checked) => toggleInvoice({ id: inv.id, active: checked })}
                                        className="scale-90 data-[state=checked]:bg-zinc-900 dark:data-[state=checked]:bg-white data-[state=unchecked]:bg-zinc-200 dark:data-[state=unchecked]:bg-zinc-700"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        onClick={() => removeInvoice(inv.id)}
                                        title="Remover assinatura"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                }
                {invoices?.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[32px] bg-zinc-50/50 dark:bg-white/[0.02] p-8">
                        <Repeat className="h-10 w-10 mb-4 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sem assinaturas ativas</p>
                    </div>
                )}
            </div>

            {invoices && invoices.length > 0 && (
                <div className="p-6 mt-auto rounded-[24px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 flex justify-between items-center shrink-0 relative z-10 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">Média Mensal</span>
                    <span className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter">
                        {formatCurrency(invoices.filter(i => i.active).reduce((acc, curr) => acc + Number(curr.amount), 0))}
                    </span>
                </div>
            )}
        </div>
    );
};
