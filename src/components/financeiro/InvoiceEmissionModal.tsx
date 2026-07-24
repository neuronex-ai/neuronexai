import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    const shouldReduceMotion = useReducedMotion();
    // NeuroFinance: check Asaas BaaS approval
    const { isConnected: isPaymentConnected } = useFinancialAccount();
    const { settings: fiscalSettings } = useFiscalSettings();
    const navigate = useNavigate();

    const isFiscalConfigured = Boolean(fiscalSettings?.asaas_municipal_service_id || fiscalSettings?.service_code);
    const isAutoEmissionActive = isPaymentConnected && isFiscalConfigured;

    const resetView = () => setTimeout(() => setView('menu'), 300);

    const TriggerButton = children || (
        <Button variant="ghost" size="sm" className="h-9 gap-2 rounded-xl px-3 text-muted-foreground hover:bg-muted hover:text-foreground">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Emitir Nota</span>
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetView(); }}>
            <DialogTrigger asChild>
                {TriggerButton}
            </DialogTrigger>
            <DialogContent className="finance-modal-surface desktop-retina-modal max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden rounded-[32px] border border-border/55 bg-background/96 p-0 shadow-2xl outline-none sm:max-w-[700px]">

                <AnimatePresence mode="wait">
                    {view === 'menu' && (
                        <motion.div
                            key="menu"
                            initial={shouldReduceMotion ? false : { opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                            className="flex flex-col"
                        >
                            <div className="relative border-b border-border/45 bg-muted/18 px-8 py-6">
                                <DialogHeader className="relative z-10 flex flex-col items-center text-center">
                                    <div className="finance-modal-icon flex h-12 w-12 items-center justify-center rounded-[17px] bg-muted/65 text-foreground">
                                        <ScrollText className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <DialogTitle className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                                        Gestão fiscal
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        Emita uma NFS-e ou arquive um documento fiscal já existente.
                                    </DialogDescription>
                                </DialogHeader>
                            </div>

                            <Tabs magnetic defaultValue="actions" className="flex-1">
                                <div className="px-6 pt-4 sm:px-8">
                                    <TabsList className="desktop-retina-inset grid h-11 w-full grid-cols-2 rounded-[15px] border border-border/45 bg-muted/30 p-1">
                                        <TabsTrigger value="actions" className="rounded-xl text-xs font-medium text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background">Ações</TabsTrigger>
                                        <TabsTrigger value="history" className="rounded-xl text-xs font-medium text-muted-foreground data-[state=active]:bg-foreground data-[state=active]:text-background">Histórico</TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="actions" className="mt-0 space-y-4 p-6 pt-4 sm:p-8 sm:pt-4">
                                    <button
                                        onClick={() => isAutoEmissionActive ? toast.info("A emissão automática já está ativa.") : navigate('/ajustes?tab=fiscal')}
                                        className={cn(
                                            "desktop-retina-inset desktop-retina-interactive group flex w-full items-center gap-4 rounded-[18px] border border-border/45 bg-background/58 p-4 text-left",
                                            isAutoEmissionActive
                                                ? "cursor-default"
                                                : "hover:bg-muted/55"
                                        )}
                                    >
                                        <div className="shrink-0 rounded-[13px] bg-muted/70 p-2.5 text-foreground">
                                            <Zap className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="mb-0.5 text-sm font-semibold text-foreground">
                                                {isAutoEmissionActive ? "Configuração Automática Ativa" : "Configurar Emissão Automática"}
                                            </h4>
                                            <p className="text-[10px] leading-relaxed text-muted-foreground">
                                                {isAutoEmissionActive
                                                    ? "Suas notas são emitidas após o pagamento."
                                                    : "Conecte seus dados fiscais para automação."}
                                            </p>
                                        </div>
                                        {!isAutoEmissionActive && <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />}
                                    </button>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setView('rps')}
                                            className="desktop-retina-inset desktop-retina-interactive group relative flex h-32 flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border border-border/45 bg-background/58 p-5 text-center hover:bg-muted/55"
                                        >
                                            <div className="mb-1 rounded-[13px] bg-muted/70 p-2.5 text-foreground">
                                                <Download className="h-4 w-4" />
                                            </div>
                                            <div className="relative z-10">
                                                <span className="mb-0.5 block text-sm font-semibold text-foreground">Emitir NFS-e</span>
                                                <span className="block text-[10px] text-muted-foreground">Emissão manual avulsa</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setView('register')}
                                            className="desktop-retina-inset desktop-retina-interactive group relative flex h-32 flex-col items-center justify-center gap-3 overflow-hidden rounded-[20px] border border-border/45 bg-background/58 p-5 text-center hover:bg-muted/55"
                                        >
                                            <div className="mb-1 rounded-[13px] bg-muted/70 p-2.5 text-foreground">
                                                <FileCheck className="h-4 w-4" />
                                            </div>
                                            <div className="relative z-10">
                                                <span className="mb-0.5 block text-sm font-semibold text-foreground">Arquivar externa</span>
                                                <span className="block text-[10px] text-muted-foreground">Documento fiscal existente</span>
                                            </div>
                                        </button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="mt-0 p-6 pt-4 sm:p-8 sm:pt-4">
                                    <InvoicesHistoryList patientId={initialPatientId} allowDelete={false} />
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    )}

                    {view === 'register' && (
                        <motion.div
                            key="register"
                            initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                            className="p-6 sm:p-8"
                        >
                            <RegisterExternalInvoiceForm onBack={() => setView('menu')} onSuccess={() => setOpen(false)} initialPatientId={initialPatientId} />
                        </motion.div>
                    )}

                    {view === 'rps' && (
                        <motion.div
                            key="rps"
                            initial={shouldReduceMotion ? false : { opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
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
