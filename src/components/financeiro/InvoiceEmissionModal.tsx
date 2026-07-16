import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Download, FileCheck, ScrollText, Zap } from "lucide-react";
import { useState } from "react";
import { GenerateRPSForm } from "./invoice/GenerateRPSForm";
import { InvoicesHistoryList } from "./invoice/InvoicesHistoryList";
import { RegisterExternalInvoiceForm } from "./invoice/RegisterExternalInvoiceForm";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFiscalSettings } from "@/hooks/use-fiscal-settings";
import { useFinancialAccount } from "@/hooks/use-financial-account";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type ViewState = 'menu' | 'register' | 'rps';

interface InvoiceEmissionModalProps {
    children?: React.ReactNode;
    initialPatientId?: string;
}

export const InvoiceEmissionModal = ({ children, initialPatientId }: InvoiceEmissionModalProps) => {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<ViewState>('menu');
    // NeuroFinance: check Asaas BaaS approval
    const { isConnected: isPaymentConnected } = useFinancialAccount();
    const { settings: fiscalSettings } = useFiscalSettings();
    const navigate = useNavigate();

    const isFiscalConfigured = Boolean(fiscalSettings?.asaas_municipal_service_id || fiscalSettings?.service_code);
    const isAutoEmissionActive = isPaymentConnected && isFiscalConfigured;

    const resetView = () => setTimeout(() => setView('menu'), 300);

    const TriggerButton = children || (
        <Button variant="ghost" size="sm" className="h-9 px-3 rounded-full hover:bg-white/5 text-muted-foreground hover:text-white border border-transparent hover:border-white/10 transition-all gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Emitir Nota</span>
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetView(); }}>
            <DialogTrigger asChild>
                {TriggerButton}
            </DialogTrigger>
            <DialogContent className="finance-modal-surface sm:max-w-[700px] bg-card dark:bg-[#0A0A0B] border-border/10 dark:border-white/10 shadow-2xl p-0 overflow-hidden rounded-[32px] gap-0 outline-none">

                <AnimatePresence mode="wait">
                    {view === 'menu' && (
                        <motion.div
                            key="menu"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col"
                        >
                            <div className="relative p-8 border-b border-border/5 dark:border-white/5 bg-secondary/5 dark:bg-zinc-950">
                                <DialogHeader className="relative z-10">
                                    <DialogTitle className="text-xl font-bold text-foreground dark:text-white flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-background/50 dark:bg-zinc-900 border border-border/10 dark:border-white/10 shadow-sm">
                                            <ScrollText className="h-5 w-5 text-muted-foreground dark:text-zinc-300" />
                                        </div>
                                        Gestão Fiscal
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground dark:text-zinc-500 pt-1 pl-1 font-medium uppercase tracking-wide">
                                        Emissão e controle de notas fiscais
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <Tabs defaultValue="actions" className="flex-1">
                                <div className="px-8 pt-4">
                                    <TabsList className="bg-secondary/10 dark:bg-zinc-900/50 p-1 rounded-lg border border-border/5 dark:border-white/5 w-full justify-start">
                                        <TabsTrigger value="actions" className="text-xs font-medium px-4 data-[state=active]:bg-background dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground dark:data-[state=active]:text-white text-muted-foreground dark:text-zinc-500 shadow-sm">Ações</TabsTrigger>
                                        <TabsTrigger value="history" className="text-xs font-medium px-4 data-[state=active]:bg-background dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground dark:data-[state=active]:text-white text-muted-foreground dark:text-zinc-500 shadow-sm">Histórico</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="actions" className="p-8 space-y-4 pt-4 mt-0">
                                    <button
                                        onClick={() => isAutoEmissionActive ? toast.info("A emissão automática já está ativa.") : navigate('/ajustes?tab=fiscal')}
                                        className={cn(
                                            "w-full p-4 rounded-xl border flex items-center gap-4 text-left transition-all duration-300 group shadow-sm",
                                            isAutoEmissionActive
                                                ? "bg-emerald-500/5 dark:bg-zinc-900/30 border-emerald-500/20 dark:border-emerald-500/10 cursor-default"
                                                : "bg-card dark:bg-zinc-900/30 border-border/10 dark:border-amber-500/10 hover:bg-secondary/10 dark:hover:bg-zinc-900/50 hover:border-border/20"
                                        )}
                                    >
                                        <div className={cn("p-2 rounded-lg shrink-0", isAutoEmissionActive ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                            <Zap className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={cn("text-sm font-bold mb-0.5", isAutoEmissionActive ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500")}>
                                                {isAutoEmissionActive ? "Configuração Automática Ativa" : "Configurar Emissão Automática"}
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground dark:text-zinc-500 leading-relaxed">
                                                {isAutoEmissionActive
                                                    ? "Suas notas são emitidas após o pagamento."
                                                    : "Conecte seus dados fiscais para automação."}
                                            </p>
                                        </div>
                                        {!isAutoEmissionActive && <ArrowRight className="h-4 w-4 text-muted-foreground dark:text-zinc-600 group-hover:text-foreground dark:group-hover:text-zinc-400 transition-colors" />}
                                    </button>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setView('rps')}
                                            className="group relative h-28 rounded-[20px] border border-border/10 dark:border-white/5 bg-secondary/5 dark:bg-zinc-900/20 hover:bg-secondary/10 dark:hover:bg-zinc-900/40 hover:border-border/20 dark:hover:border-white/10 transition-all flex flex-col items-start justify-center p-5 gap-3 overflow-hidden text-left shadow-sm"
                                        >
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 dark:text-blue-400 mb-1 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                                                <Download className="h-4 w-4" />
                                            </div>
                                            <div className="relative z-10">
                                                <span className="text-sm font-bold text-foreground dark:text-zinc-200 block mb-0.5">Emitir NFS-e</span>
                                                <span className="text-[10px] text-muted-foreground dark:text-zinc-500 block">Emissão Manual Avulsa</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setView('register')}
                                            className="group relative h-28 rounded-[20px] border border-border/10 dark:border-white/5 bg-secondary/5 dark:bg-zinc-900/20 hover:bg-secondary/10 dark:hover:bg-zinc-900/40 hover:border-border/20 dark:hover:border-white/10 transition-all flex flex-col items-start justify-center p-5 gap-3 overflow-hidden text-left shadow-sm"
                                        >
                                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 dark:text-emerald-400 mb-1 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                                                <FileCheck className="h-4 w-4" />
                                            </div>
                                            <div className="relative z-10">
                                                <span className="text-sm font-bold text-foreground dark:text-zinc-200 block mb-0.5">Arquivar Externa</span>
                                                <span className="text-[10px] text-muted-foreground dark:text-zinc-500 block">Upload de nota existente</span>
                                            </div>
                                        </button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="p-8 pt-4 mt-0">
                                    <InvoicesHistoryList patientId={initialPatientId} allowDelete={false} />
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    )}

                    {view === 'register' && (
                        <motion.div
                            key="register"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="p-8"
                        >
                            <RegisterExternalInvoiceForm onBack={() => setView('menu')} onSuccess={() => setOpen(false)} initialPatientId={initialPatientId} />
                        </motion.div>
                    )}

                    {view === 'rps' && (
                        <motion.div
                            key="rps"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col h-full"
                        >
                            <GenerateRPSForm onBack={() => setView('menu')} onSuccess={() => setOpen(false)} initialPatientId={initialPatientId} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};
