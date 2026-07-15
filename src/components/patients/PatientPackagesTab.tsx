"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientData } from "@/hooks/use-patient-data";
import { usePatientPackages } from "@/hooks/use-patient-packages";
import { useProfile } from "@/hooks/use-profile";
import { useSessionNotes } from "@/hooks/use-session-notes";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, FileText, Loader2, Mail, MessageCircle, Package, Plus, Printer, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MonthlyReportTemplate } from "./MonthlyReportTemplate";
import { NewPackageModal } from "./NewPackageModal";
import { PackageCard } from "./PackageCard";
import { edgeFunctionUrl } from "@/lib/supabase-config";

interface PatientPackagesTabProps {
    patientId: string;
}

export const PatientPackagesTab = ({ patientId }: PatientPackagesTabProps) => {
    const { data: packages, isLoading: isLoadingPackages, error: packagesError } = usePatientPackages(patientId);
    const { data: notes } = useSessionNotes(patientId);
    const { data: profile } = useProfile();
    const { data: patient } = usePatientData(patientId);

    const { session } = useAuth();
    const [isSending, setIsSending] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const monthSessions = notes?.filter(n => {
        const d = new Date(n.created_at);
        return d >= currentMonthStart && d <= currentMonthEnd;
    }) || [];

    const activePkg = packages?.find(p => p.total_sessions > p.sessions_used + (p.sessions_reserved || 0));

    const isRunningLow = activePkg && (activePkg.total_sessions - activePkg.sessions_used - (activePkg.sessions_reserved || 0) <= 1);

    const reportData = {
        patientName: patient?.name || "Paciente",
        month: format(now, "MMMM 'de' yyyy", { locale: ptBR }),
        professionalName: profile ? `${profile.first_name} ${profile.last_name}` : "Seu Psicólogo",
        stats: {
            attended: monthSessions.length,
            cancelled: 0,
            next: null
        },
        financialSummary: activePkg ? {
            totalInvested: (activePkg.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            packagesActive: activePkg.description
        } : undefined,
        clinicalSummary: monthSessions.length > 0 && monthSessions[0].ai_summary
            ? `Foco recente: ${monthSessions[0].ai_summary.summary}`
            : undefined
    };

    const handlePrintReport = () => {
        const content = printRef.current;
        if (!content) return;
        const w = window.open('', '', 'height=900,width=800');
        w?.document.write('<html><head><title>Relatório</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-100 flex justify-center p-8">');
        w?.document.write(content.innerHTML);
        w?.document.write('</body></html>');
        w?.document.close();
        setTimeout(() => w?.print(), 1000);
    };

    const handleSendReportEmail = async () => {
        if (!patient?.email) {
            toast.error("Paciente sem e-mail.");
            return;
        }
        setIsSending(true);
        try {
            const html = printRef.current?.innerHTML || "";
            await fetch(edgeFunctionUrl("send-document-email"), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: patient.email,
                    subject: `Relatório Mensal - ${reportData.month}`,
                    htmlBody: html,
                    documentType: "Relatório de Progresso"
                })
            });
            toast.success("Relatório enviado!");
        } catch {
            toast.error("Erro ao enviar.");
        } finally {
            setIsSending(false);
        }
    };

    if (isLoadingPackages) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full bg-zinc-100/50 dark:bg-zinc-800/50 rounded-3xl" />
                <Skeleton className="h-40 w-full bg-zinc-100/50 dark:bg-zinc-800/50 rounded-3xl" />
            </div>
        );
    }

    if (packagesError) {
        return (
            <div className="text-center py-12 px-6">
                <div className="p-4 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 inline-block mb-4">
                    <AlertCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Erro ao carregar pacotes</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Tente recarregar a página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 animate-fade-in pb-10">

            {isRunningLow && (
                <section className="patient-record-card rounded-[26px] border p-5 md:p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md shrink-0">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-black uppercase tracking-wide text-foreground">Plano perto do fim</p>
                                <p className="mt-0.5 text-xs font-medium text-muted-foreground">Resta apenas <span className="font-black text-foreground">{activePkg.total_sessions - activePkg.sessions_used - (activePkg.sessions_reserved || 0)}</span> sessão disponível neste pacote.</p>
                            </div>
                        </div>
                        <NewPackageModal patientId={patientId}>
                            <Button size="sm" variant="outline" className="h-10 rounded-xl border-border/50 bg-transparent text-xs font-black uppercase tracking-wider text-foreground hover:bg-muted">
                                Renovar
                            </Button>
                        </NewPackageModal>
                    </div>
                </section>
            )}

            <div className="patient-record-panel flex flex-col items-center justify-between gap-3 rounded-[24px] border p-2 shadow-sm sm:flex-row sm:gap-0">
                <div className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 flex items-center gap-3 w-full sm:w-auto">
                    <Package className="h-4 w-4 opacity-50" />
                    Gestão de planos
                </div>
                <div className="flex gap-2 w-full sm:w-auto p-1">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-10 flex-1 gap-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex-none"
                            >
                                <FileText className="h-3.5 w-3.5" /> Relatório mensal
                            </Button>
                        </DialogTrigger>
                        <DialogContent
                            showCloseButton={false}
                            className="desktop-retina-modal z-[180] flex h-[min(920px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[960px] flex-col gap-0 overflow-hidden rounded-[32px] border border-border/70 bg-background/96 p-0 shadow-2xl"
                        >
                            <div className="flex items-center gap-4 border-b border-border/60 bg-background/82 px-5 py-4 backdrop-blur-2xl sm:px-7">
                                <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-foreground">
                                    <FileText className="h-5 w-5" aria-hidden="true" />
                                </div>
                                <DialogHeader className="min-w-0 flex-1 space-y-1 pr-0 text-left">
                                    <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Relatório mensal</DialogTitle>
                                    <DialogDescription className="truncate text-sm text-muted-foreground">
                                        Prévia de {reportData.month} para {reportData.patientName}.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogClose asChild>
                                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full border border-border/70 bg-background hover:bg-muted" aria-label="Fechar relatório">
                                        <X className="h-5 w-5" aria-hidden="true" />
                                    </Button>
                                </DialogClose>
                            </div>

                            <div className="custom-scrollbar flex flex-1 justify-center overflow-y-auto bg-muted/20 p-4 sm:p-7">
                                <div ref={printRef} className="w-full max-w-[620px] origin-top shadow-[0_28px_72px_-34px_rgba(0,0,0,0.45)]">
                                    <MonthlyReportTemplate {...reportData} />
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border/60 bg-background/90 p-4 backdrop-blur-2xl sm:px-7">
                                <Button variant="outline" onClick={handlePrintReport} className="h-11 gap-2 rounded-xl border-border/70 bg-background px-4 text-sm font-medium text-foreground hover:bg-muted active:scale-[0.98]">
                                    <Printer className="h-4 w-4" /> Imprimir
                                </Button>
                                <Button variant="outline" onClick={handleSendReportEmail} disabled={isSending} className="h-11 gap-2 rounded-xl border-border/70 bg-background px-4 text-sm font-medium text-foreground hover:bg-muted active:scale-[0.98]">
                                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} E-mail
                                </Button>
                                <Button disabled className="h-11 gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background shadow-none">
                                    <MessageCircle className="h-4 w-4" /> WhatsApp em breve
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <NewPackageModal patientId={patientId}>
                        <Button size="sm" className="gap-2 bg-zinc-900 dark:bg-white text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xl h-10 text-[10px] font-black uppercase tracking-widest px-6 rounded-xl transition-all hover:scale-105 flex-1 sm:flex-none">
                            <Plus className="h-3.5 w-3.5 stroke-[3]" />
                            Novo plano
                        </Button>
                    </NewPackageModal>
                </div>
            </div>

            {packages && packages.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                    {packages.map((pkg, index) => (
                        <div key={pkg.id} className="animate-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
                            <PackageCard pkg={pkg} patientId={patientId} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="patient-record-card flex flex-col items-center justify-center rounded-[36px] border border-dashed py-24 text-center md:py-32">
                    <h3 className="mb-3 text-2xl font-black leading-none tracking-tight text-foreground">Nenhum plano ativo</h3>
                </div>
            )}
        </div>
    );
};
