import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { AnimatePresence, motion } from "framer-motion";
import { Landmark, Loader2, Lock, Plus, Shield, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const itemTransition = {
    initial: { opacity: 0, y: 20, scale: 0.98 },
    animate: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            delay: i * 0.05,
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1] as any as any
        }
    }),
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.4 } }
};

export const BankAccountsManager = () => {
    // NeuroFinance: fetch linked account info
    const { account, isLoading, hasAccount } = useFinancialAccount();
    const accounts: any[] = hasAccount && account ? [{
        id: account.id,
        holder_name: account.bank_holder_name || account.holder_name || 'Conta NeuroFinance',
        bank_code: account.bank_code || account.bank_name || '',
        bank_name: account.bank_name || account.bank_code || '',
        agency: account.bank_agency || '',
        account_number: account.bank_account_last4 ? `****${account.bank_account_last4}` : '',
        last4: account.bank_account_last4 || '',
        default_for_currency: true,
    }] : [];
    const addAccount = (_data: any, _opts?: any) => toast.info('Novas contas serão vinculadas via onboarding NeuroFinance.');
    const isAdding = false;
    const deleteAccount = (_id: string) => toast.info('Contate o suporte para desvincular sua conta bancária.');
    const isDeleting = false;
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Form State
    const [holderName, setHolderName] = useState("");
    const [bankCode, setBankCode] = useState("");
    const [agency, setAgency] = useState("");
    const [accountBody, setAccountBody] = useState("");
    const [accountDigit, setAccountDigit] = useState("");

    const handleAdd = () => {
        if (!holderName || !bankCode || !agency || !accountBody || !accountDigit) {
            toast.error("Preencha todos os campos para continuar.");
            return;
        }

        const fullAccountNumber = `${accountBody}${accountDigit}`;
        const routingNumber = bankCode;

        addAccount({
            holderName,
            routingNumber,
            accountNumber: fullAccountNumber
        }, {
            onSuccess: () => {
                setIsAddOpen(false);
                setHolderName("");
                setBankCode("");
                setAgency("");
                setAccountBody("");
                setAccountDigit("");
                toast.success("Conta bancária vinculada com sucesso.");
            }
        });
    };

    const handleBankCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
        setBankCode(val);
    };

    const handleAgencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setAgency(val);
    };

    const handleAccountBodyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 12);
        setAccountBody(val);
    };

    const handleAccountDigitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.toUpperCase().slice(0, 1);
        setAccountDigit(val);
    };

    return (
        <div className="space-y-12 animate-fade-in relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-2xl relative group overflow-hidden">
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Landmark className="h-7 w-7 relative z-10" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-1.5">Contas Bancárias</h3>
                        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em]">Gerenciamento de Recebimentos e Repasses</p>
                    </div>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="h-14 px-8 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg hover:opacity-90 transition-all flex items-center gap-4 group"
                        >
                            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                            <span>Vincular Nova Conta</span>
                            <Sparkles className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
                        </motion.button>
                    </DialogTrigger>
                    <DialogContent showCloseButton={false} className="finance-modal-surface bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-[120px] border border-zinc-200 dark:border-white/5 rounded-[64px] p-0 shadow-[0_80px_160px_-40px_rgba(0,0,0,0.8)] overflow-hidden sm:max-w-2xl z-[10000] outline-none">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

                        <DialogHeader className="p-10 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xl">
                                        <Landmark className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                            Vincular Conta
                                        </DialogTitle>
                                        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em] mt-1.5 opacity-70">Conexão Segura e Criptografada</p>
                                    </div>
                                </div>
                                <DialogClose asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"><X className="h-5 w-5" /></Button>
                                </DialogClose>
                            </div>
                        </DialogHeader>

                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <Label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.2em] pl-1">Nome do Titular</Label>
                                <Input
                                    value={holderName}
                                    onChange={e => setHolderName(e.target.value)}
                                    placeholder="NOME COMPLETO"
                                    className="bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 h-14 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] px-6 focus-visible:ring-zinc-900 dark:focus-visible:ring-white transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.2em] pl-1">Código do Banco</Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Sparkles className="h-3 w-3 text-zinc-300 cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-black text-white text-[8px] uppercase tracking-widest font-black p-2 rounded-lg border-white/10">EX: 341 (Itaú), 001 (BB)</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Input
                                        value={bankCode}
                                        onChange={handleBankCodeChange}
                                        placeholder="000"
                                        className="bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 h-14 rounded-xl font-mono text-lg font-black text-center focus-visible:ring-zinc-900 dark:focus-visible:ring-white shadow-sm"
                                        maxLength={3}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.2em] pl-1">Agência</Label>
                                    <Input
                                        value={agency}
                                        onChange={handleAgencyChange}
                                        placeholder="0000"
                                        className="bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 h-14 rounded-xl font-mono text-lg font-black text-center focus-visible:ring-zinc-900 dark:focus-visible:ring-white shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.2em] pl-1">Número da Conta</Label>
                                <div className="flex gap-3 items-center">
                                    <Input
                                        value={accountBody}
                                        onChange={handleAccountBodyChange}
                                        placeholder="NÚMERO"
                                        className="bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 h-14 rounded-xl flex-1 font-mono text-lg font-black tracking-widest px-6 focus-visible:ring-zinc-900 dark:focus-visible:ring-white shadow-sm"
                                    />
                                    <div className="h-px w-4 bg-zinc-200 dark:bg-white/10 shrink-0" />
                                    <Input
                                        value={accountDigit}
                                        onChange={handleAccountDigitChange}
                                        placeholder="X"
                                        className="bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-white/5 h-14 w-20 rounded-xl text-center font-mono text-lg font-black focus-visible:ring-zinc-900 dark:focus-visible:ring-white shadow-sm"
                                        maxLength={1}
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleAdd}
                                disabled={isAdding}
                                className="w-full h-16 bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-4 group mt-4"
                            >
                                {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                                    <>
                                        <span>Confirmar Dados</span>
                                        <Lock className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                <AnimatePresence mode="popLayout">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-[280px] rounded-[56px] bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/5 animate-pulse" />
                        ))
                    ) : accounts?.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="col-span-full py-32 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-white/[0.02] rounded-[40px] border border-dashed border-zinc-200 dark:border-white/5 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                            <div className="w-20 h-20 rounded-3xl bg-white dark:bg-zinc-900 flex items-center justify-center border border-zinc-100 dark:border-white/5 mb-8 shadow-sm">
                                <Landmark className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                            </div>
                            <h4 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Nenhuma conta vinculada</h4>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.3em] mt-4 max-w-sm px-6 opacity-60">Vincule uma conta para receber seus repasses de forma automática e segura.</p>
                        </motion.div>
                    ) : (
                        accounts?.map((acc, idx) => (
                            <motion.div
                                key={acc.id}
                                custom={idx}
                                initial="initial"
                                animate="animate"
                                exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                                variants={itemTransition}
                                whileHover={{ y: -6 }}
                                className="group relative p-10 h-[280px] flex flex-col justify-between rounded-[48px] bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/5 hover:border-zinc-900 dark:hover:border-white/20 transition-all duration-700 shadow-sm overflow-hidden"
                            >
                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

                                <div className="flex items-start justify-between relative z-10">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                                        <Landmark className="h-7 w-7 text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="flex gap-2">
                                        {acc.default_for_currency && (
                                            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/10 dark:bg-white/10 text-zinc-900 dark:text-white text-[8px] font-black uppercase tracking-[0.2em] border border-zinc-900/10 dark:border-white/10">
                                                <ShieldCheck className="w-3.5 h-3.5" /> Padrão
                                            </div>
                                        )}
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => deleteAccount(acc.id)}
                                                        disabled={isDeleting}
                                                        className="h-10 w-10 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 border border-zinc-100 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4.5 w-4.5" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-rose-600 text-white text-[9px] font-black tracking-widest uppercase p-2 rounded-lg border-none">Remover Conta</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>

                                <div className="relative z-10 space-y-5">
                                    <div>
                                        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em] mb-2 opacity-60">Banco</p>
                                        <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tight uppercase group-hover:translate-x-1 transition-transform">{acc.bank_name || 'Instituição Bancária'}</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.3em] mb-2 opacity-60">Número da Conta</p>
                                            <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-[0.2em] font-mono select-none">•••• {acc.last4}</p>
                                        </div>
                                        <div className="h-12 w-12 rounded-2xl bg-zinc-50 dark:bg-white/5 flex items-center justify-center text-zinc-200 dark:text-zinc-800 opacity-40 group-hover:opacity-100 transition-all">
                                            <Shield className="h-6 w-6" />
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 h-1 bg-zinc-900 dark:bg-white w-0 group-hover:w-full transition-all duration-700 ease-in-out" />
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>

                {/* Empty State / Call to action */}
                {accounts && accounts.length > 0 && accounts.length < 3 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ y: -4 }}
                        className="h-[280px] rounded-[48px] border-2 border-dashed border-zinc-100 dark:border-white/5 flex flex-col items-center justify-center text-center p-12 group cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.01] transition-all duration-400"
                        onClick={() => setIsAddOpen(true)}
                    >
                        <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-all">
                            <Plus className="h-6 w-6 text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-white" />
                        </div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.3em] opacity-60 group-hover:opacity-100">Adicionar Conta</p>
                    </motion.div>
                )}
            </div>

            {/* Security Notice */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="p-10 lg:p-12 rounded-[48px] bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-white/5 flex flex-col md:flex-row items-center gap-10 overflow-hidden relative"
            >
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

                <div className="w-20 h-20 rounded-3xl bg-zinc-900/5 dark:bg-white/5 flex items-center justify-center text-zinc-900 dark:text-white border border-zinc-900/10 dark:border-white/10 shrink-0">
                    <ShieldCheck className="h-10 w-10" />
                </div>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <p className="text-[9px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.4em]">Segurança de Nível Bancário</p>
                        <div className="px-3 py-1 bg-zinc-900/10 dark:bg-white/10 text-zinc-900 dark:text-white text-[8px] font-black uppercase rounded-full border border-zinc-900/10 dark:border-white/10 flex items-center gap-2">
                            <Lock className="w-3 h-3" /> Proteção server-side
                        </div>
                    </div>
                    <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-relaxed max-w-4xl">
                        Seus dados bancários são fragmentados e protegidos por múltiplas camadas de segurança.
                        A NeuroNex utiliza infraestrutura segura para garantir que dados sensíveis nunca sejam expostos.
                    </p>
                    <div className="flex items-center gap-8 opacity-40">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Controles do provedor</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">HTTPS/TLS</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Isolamento Lógico</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
