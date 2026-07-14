import { RecurringExpensesPanel } from "./RecurringExpensesPanel";
import { RecurringInvoicesList } from "./RecurringInvoicesList";
import { Repeat, ShieldCheck } from "lucide-react";

export const RecurringManager = () => {
    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Section Header Premium */}
            <div className="flex items-center justify-between px-2 pb-8 border-b border-zinc-200 dark:border-white/5">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-[24px] bg-white dark:bg-[#0F0F11] border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-[0_15px_35px_-10px_rgba(0,0,0,0.05)] dark:shadow-2xl transition-transform duration-500 hover:rotate-6">
                        <Repeat className="h-6 w-6 text-zinc-900 dark:text-white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase">Assinaturas</h3>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-[0.25em] mt-1">Receitas e Despesas Recorrentes</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black text-zinc-500 dark:text-white/40 uppercase tracking-[0.3em] bg-zinc-50 dark:bg-white/[0.03] px-5 py-2.5 rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-sm">
                    <ShieldCheck className="h-3.5 w-3.5 text-zinc-900 dark:text-white" /> Ativo
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Invoices (Receitas) - Glass Obsidian */}
                <div className="rounded-[44px] bg-white dark:bg-[#050505] border border-zinc-200 dark:border-white/[0.08] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] overflow-hidden relative group min-h-[550px] transition-all duration-500 hover:-translate-y-1">
                    {/* Neutral Accent Glow */}
                    <div className="absolute top-[-5%] right-[-5%] w-[400px] h-[400px] bg-zinc-900/5 dark:bg-white/[0.03] blur-[120px] rounded-full pointer-events-none opacity-60" />
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] dark:opacity-[0.04] mix-blend-overlay pointer-events-none" />
                    <RecurringInvoicesList />
                </div>

                {/* Expenses (Despesas) - Glass Obsidian */}
                <div className="rounded-[44px] bg-white dark:bg-[#050505] border border-zinc-200 dark:border-white/[0.08] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] overflow-hidden relative group min-h-[550px] transition-all duration-500 hover:-translate-y-1">
                    {/* Neutral Accent Glow */}
                    <div className="absolute top-[-5%] right-[-5%] w-[400px] h-[400px] bg-zinc-900/5 dark:bg-white/[0.03] blur-[120px] rounded-full pointer-events-none opacity-60" />
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] dark:opacity-[0.04] mix-blend-overlay pointer-events-none" />
                    <RecurringExpensesPanel />
                </div>
            </div>
        </div>
    );
};
