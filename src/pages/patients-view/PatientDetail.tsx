"use client";

import { AnamnesisTab } from "@/components/patients/anamnesis/AnamnesisTab";
import { DocumentGeneratorModal } from "@/components/patients/DocumentGeneratorModal";
import { EditPatientModal } from "@/components/patients/EditPatientModal";
import { InvitePatientModal } from "@/components/patients/InvitePatientModal";
import { PatientDocumentsTab } from "@/components/patients/PatientDocumentsTab";
import { PatientFinanceTab } from "@/components/patients/PatientFinanceTab";
import { PatientGoalsTab } from "@/components/patients/PatientGoalsTab";
import { PatientHistoryTab } from "@/components/patients/PatientHistoryTab";
import { PatientMoodTab } from "@/components/patients/PatientMoodTab";
import { PatientPackagesTab } from "@/components/patients/PatientPackagesTab";
import { PatientPendingSessionReviewsTab } from "@/components/patients/PatientPendingSessionReviewsTab";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientById } from "@/hooks/use-patient-by-id";
import { useSessionNotes } from "@/hooks/use-session-notes";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
    ArrowLeft, Cake, ClipboardList, Clock3, Edit, Edit2, FileOutput, FileText, MailPlus, MapPin, Package, Phone, Pill, Shield,
    Smile, Target,
    Wallet
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";


import { BiofeedbackWidget } from "@/components/patients/BiofeedbackWidget";
import { ClinicalSummaryCard } from "@/components/patients/ClinicalSummaryCard";
import { MedicationUpdateModal } from "@/components/patients/MedicationUpdateModal";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { GlassCard } from "@/components/ui/GlassCard";
import { DesktopLumenBackdrop } from "@/components/ui/DesktopLumenBackdrop";
import { useSubscription } from "@/context/SubscriptionContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobilePatientDetail } from "@/mobile/pages/MobilePatientDetail";

export default function PatientDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState("history");
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const { features, hasPaidAccess, accessState, isDevAccount } = useSubscription();
    const canInvitePatientPortal = Boolean(features.hasPatientPortal && (hasPaidAccess || accessState === "admin_override" || isDevAccount));

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ["history", "pending_reviews", "anamnesis", "mood", "goals", "packages", "finance", "documents"].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const { data: patient, isLoading: isLoadingPatient } = usePatientById(id || "");
    const { data: notes, isLoading: isLoadingNotes } = useSessionNotes(id || "");
    const queryClient = useQueryClient();

    const handleStatusChange = async (newStatus: string) => {
        try {
            const { error } = await supabase
                .from('patients')
                .update({ status: newStatus })
                .eq('id', id!);

            if (error) throw error;

            toast.success("Status atualizado com sucesso");
            queryClient.invalidateQueries({ queryKey: ['patient', id] });
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar status");
        }
    };

    // Drag to scroll functionality
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    };

    const handleMouseLeaveOrUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };


    if (isMobile) {
        return <MobilePatientDetail />;
    }



    const isLoading = isLoadingPatient || isLoadingNotes;

    const riskScore = patient?.risk_score || 0;
    if (riskScore >= 4 && riskScore <= 7) {
        // Atenção (Medium risk)
    } else if (riskScore >= 8) {
        // Alto Risco (High risk)
    }

    const latestNote = notes?.[0];

    if (isLoading) {
        return (
            <div className="min-h-screen w-full p-6 md:p-8 space-y-8 max-w-[1800px] mx-auto pt-32">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
                    <Skeleton className="h-8 w-48 bg-white/5 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8">
                    <Skeleton className="h-[700px] w-full rounded-[32px] bg-white/5" />
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <Skeleton className="h-24 rounded-[20px] bg-white/5" />
                            <Skeleton className="h-24 rounded-[20px] bg-white/5" />
                            <Skeleton className="h-24 rounded-[20px] bg-white/5" />
                        </div>
                        <Skeleton className="h-[500px] w-full rounded-[32px] bg-white/5" />
                    </div>
                </div>
            </div>
        );
    }

    if (!patient) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-24 h-24 rounded-3xl bg-secondary/10 flex items-center justify-center mb-6 border border-border/10">
                    <Shield className="h-10 w-10 opacity-20" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Paciente não encontrado</h2>
                <Button variant="outline" onClick={() => navigate('/pacientes')} className="rounded-full h-12 px-8 border-border/10 hover:bg-secondary/10">
                    Voltar para Lista
                </Button>
            </div>
        );
    }

    const patientTabs = [
        { val: "history", label: "Histórico", icon: FileText },
        { val: "pending_reviews", label: "Revisões pendentes", icon: Clock3 },
        { val: "anamnesis", label: "Anamneses", icon: ClipboardList },
        { val: "mood", label: "Humor", icon: Smile },
        { val: "goals", label: "Metas", icon: Target },
        { val: "packages", label: "Planos", icon: Package },
        { val: "finance", label: "Financeiro", icon: Wallet },
        { val: "documents", label: "Arquivos", icon: FileOutput },
    ];

    return (
        <div className="desktop-lumen-page desktop-content-offset relative min-h-screen w-full pb-28 pt-24 font-sans text-foreground selection:bg-zinc-900/10 selection:text-zinc-900 dark:selection:bg-white/10 dark:selection:text-white">
            <DesktopLumenBackdrop />
            <div className="relative z-10 mx-auto w-full max-w-[2200px] px-5">

            {/* ─── Header Top Bar ─── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="desktop-retina-frame sticky top-[calc(var(--desktop-navbar-clearance)-1.5rem)] z-40 rounded-[26px] border border-border/60 bg-background/88 px-4 py-3 backdrop-blur-xl"
            >
                <div className="flex w-full items-center gap-4">

                        {/* Left Side: Back & Title */}
                        <div className="flex min-w-[220px] max-w-[320px] flex-[0_1_300px] items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/pacientes')}
                                className="h-10 w-10 shrink-0 rounded-full border border-border/55 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>

                            <div className="flex min-w-0 flex-col justify-center">
                                <span className="text-[8px] font-black uppercase tracking-[0.28em] text-zinc-400 dark:text-zinc-600">Prontuário clínico</span>
                                <h1 className="truncate text-base font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-100 md:text-lg">{patient.name}</h1>
                            </div>
                        </div>

                    <div
                        ref={scrollContainerRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeaveOrUp}
                        onMouseUp={handleMouseLeaveOrUp}
                        onMouseMove={handleMouseMove}
                        className={cn(
                            "desktop-retina-inset flex min-w-0 flex-1 select-none items-center overflow-x-auto rounded-[20px] border border-border/55 bg-muted/30 p-1.5 backdrop-blur-xl",
                            isDragging ? "cursor-grabbing" : "cursor-grab",
                            "custom-premium-scrollbar"
                        )}
                    >
                        <div className="flex min-w-max flex-1 items-center justify-between gap-1">
                            {patientTabs.map((tab) => (
                                <button
                                    key={tab.val}
                                    type="button"
                                    onClick={() => setActiveTab(tab.val)}
                                    className={cn(
                                        "desktop-retina-interactive relative flex h-10 items-center gap-2 whitespace-nowrap rounded-[15px] px-4 text-[9px] font-black uppercase tracking-[0.16em]",
                                        activeTab === tab.val
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:bg-background hover:text-foreground"
                                    )}
                                >
                                    <tab.icon className="h-3.5 w-3.5" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                        {/* Right Side: Actions */}
                        <div className="flex shrink-0 items-center gap-2">
                            {canInvitePatientPortal && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setInviteModalOpen(true)}
                                    className="h-10 rounded-xl border-border/55 bg-background px-4 text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background"
                                >
                                    <MailPlus className="mr-2 h-3.5 w-3.5" />
                                    Convidar
                                </Button>
                            )}
                            <Select value={patient.status || ""} onValueChange={handleStatusChange}>
                                <SelectTrigger className="h-10 w-auto gap-2 rounded-xl border border-border/55 bg-background px-4 text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground shadow-sm ring-0 transition-colors hover:bg-muted focus:ring-0">
                                    <div className="flex items-center gap-3">
                                        <span className={cn("h-1.5 w-1.5 rounded-full shadow-lg",
                                            patient.status === 'active' ? "bg-emerald-500 shadow-emerald-500/20" :
                                                patient.status === 'archived' ? "bg-orange-500" : "bg-zinc-400")}
                                        />
                                        <SelectValue placeholder="Status" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent align="end" className="w-[200px] rounded-3xl border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-xl">
                                    <SelectItem value="active" className="rounded-2xl font-black text-[10px] uppercase tracking-widest py-3">Paciente Ativo</SelectItem>
                                    <SelectItem value="inactive" className="rounded-2xl font-black text-[10px] uppercase tracking-widest py-3">Inativo</SelectItem>
                                    <SelectItem value="archived" className="rounded-2xl font-black text-[10px] uppercase tracking-widest py-3 text-orange-500">Arquivado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                </div>
            </motion.div>


            {/* ─── Main Layout Grid ─── */}
            <div className="relative z-10">
                <div className="grid grid-cols-1 items-start xl:grid-cols-[310px_minmax(0,1fr)]">

                    {/* LEFT COLUMN: Patient Info */}
                    <aside className="z-20 w-full space-y-5 border-b border-border/55 py-5 pr-5 dark:border-white/[0.085] xl:sticky xl:top-[86px] xl:border-b-0 xl:border-r">
                        <GlassCard
                            className="desktop-retina-panel w-full !rounded-[24px] !border-border/60 !bg-card/70 !backdrop-blur-xl"
                            innerClassName="p-0"
                        >
                            <div className="relative overflow-hidden p-5">
                                <div className="relative z-10 mb-6 flex flex-col items-center text-center">
                                    <div className="relative mb-4">
                                        <Avatar className="relative z-10 h-24 w-24 rounded-[24px] border border-border/60 shadow-sm">
                                            <AvatarFallback className="bg-muted text-3xl font-black text-foreground">
                                                {patient.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <h3 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white">{patient.name}</h3>
                                    <p className="mt-1.5 max-w-full truncate text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">{patient.email}</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="desktop-retina-inset desktop-retina-interactive flex items-center gap-3 rounded-xl border border-border/55 bg-muted/35 p-3 hover:bg-muted/55">
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] font-bold tracking-tight text-zinc-700 dark:text-zinc-300">{patient.phone || "Não informado"}</span>
                                    </div>
                                    <div className="desktop-retina-inset desktop-retina-interactive flex items-center gap-3 rounded-xl border border-border/55 bg-muted/35 p-3 hover:bg-muted/55">
                                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="truncate text-[11px] font-bold tracking-tight text-zinc-700 dark:text-zinc-300">{patient.address || "Endereço ausente"}</span>
                                    </div>
                                    <div className="desktop-retina-inset desktop-retina-interactive flex items-center gap-3 rounded-xl border border-border/55 bg-muted/35 p-3 hover:bg-muted/55">
                                        <Cake className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[11px] font-bold tracking-tight text-zinc-700 dark:text-zinc-300">
                                            {patient.birth_date ? format(new Date(patient.birth_date), 'dd/MM/yyyy') : "Nascimento ausente"}
                                        </span>
                                    </div>
                                </div>

                                <div className={cn(
                                    "mt-6 grid gap-2 border-t border-border/55 pt-5",
                                    canInvitePatientPortal ? "grid-cols-3" : "grid-cols-2"
                                )}>
                                    <EditPatientModal patient={patient}>
                                        <Button variant="ghost" className="h-11 w-full rounded-xl bg-muted text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background">
                                            <Edit className="h-4 w-4 mr-2" /> Editar
                                        </Button>
                                    </EditPatientModal>
                                    {canInvitePatientPortal && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setInviteModalOpen(true)}
                                            className="h-11 w-full rounded-xl bg-muted text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background"
                                        >
                                            <MailPlus className="h-4 w-4 mr-2" /> Convidar
                                        </Button>
                                    )}
                                    <DocumentGeneratorModal patient={patient}>
                                        <Button variant="ghost" className="h-11 w-full rounded-xl bg-muted text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background">
                                            <FileOutput className="h-4 w-4 mr-2" /> Docs
                                        </Button>
                                    </DocumentGeneratorModal>
                                </div>

                                <InvitePatientModal
                                    isOpen={inviteModalOpen}
                                    onClose={() => setInviteModalOpen(false)}
                                    patient={patient}
                                />

                                {/* Medications Block in Sidebar */}
                                <div className="mt-6 border-t border-border/55 pt-5">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500">Medicações</h4>
                                        <MedicationUpdateModal patient={patient}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </MedicationUpdateModal>
                                    </div>

                                    <div className="space-y-3">
                                        {patient.medications && patient.medications.length > 0 ? (
                                            patient.medications.map((med, idx) => (
                                                <div key={idx} className="desktop-retina-inset group relative overflow-hidden rounded-2xl border border-border/55 bg-muted/35 p-4 transition-colors hover:bg-muted/55">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{med.name}</span>
                                                        {med.dosage && (
                                                            <span className="rounded-lg border border-border/55 bg-background px-2 py-0.5 text-[10px] font-black text-muted-foreground shadow-sm">
                                                                {med.dosage}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-6 rounded-2xl border-2 border-dashed border-zinc-100 dark:border-white/[0.075] bg-zinc-50/50 dark:bg-[#080809] text-center">
                                                <Pill className="h-5 w-5 text-zinc-300 dark:text-zinc-800 mx-auto mb-3 opacity-30" />
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic">Nenhuma medicação</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                    </aside>

                    {/* RIGHT COLUMN: Content Area */}
                    <main className="desktop-retina-frame min-w-0 space-y-7 rounded-[32px] border border-border/45 p-5 pb-16 md:p-7 lg:p-8">

                        <div className="relative flex min-h-[760px] w-full flex-col">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full">

                                <div className="hidden">
                                    <div
                                        className={cn(
                                            "flex w-full select-none items-center overflow-x-auto rounded-2xl border border-border/60 bg-background/88 p-1.5 shadow-sm backdrop-blur-xl transition-colors",
                                            isDragging ? "cursor-grabbing" : "cursor-grab",
                                            "custom-premium-scrollbar"
                                        )}
                                    >
                                        <TabsList className="h-auto w-full min-w-max justify-between gap-1 bg-transparent p-0">
                                            {[
                                                { val: "history", label: "Histórico", icon: FileText },
                                                { val: "pending_reviews", label: "Revisões pendentes", icon: Clock3 },
                                                { val: "anamnesis", label: "Anamneses", icon: ClipboardList },
                                                { val: "mood", label: "Humor", icon: Smile },
                                                { val: "goals", label: "Metas", icon: Target },
                                                { val: "packages", label: "Planos", icon: Package },
                                                { val: "finance", label: "Financeiro", icon: Wallet },
                                                { val: "documents", label: "Arquivos", icon: FileOutput }
                                            ].map((tab) => (
                                                <TabsTrigger
                                                    key={tab.val}
                                                    value={tab.val}
                                                    className={cn(
                                                        "relative flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-[9px] font-black uppercase tracking-[0.16em] transition-colors duration-200 active:scale-95",
                                                        "data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-lg dark:data-[state=active]:bg-white dark:data-[state=active]:text-black",
                                                        "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                >
                                                    <tab.icon className="h-3.5 w-3.5" />
                                                    {tab.label}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </div>

                                    {/* Premium Scrollbar Indicator Styling (Injecting CSS via style tag for simplicity in this component) */}
                                    <style>{`
                                        .custom-premium-scrollbar::-webkit-scrollbar {
                                            height: 4px;
                                        }
                                        .custom-premium-scrollbar::-webkit-scrollbar-track {
                                            background: transparent;
                                            margin: 0 40px;
                                        }
                                        .custom-premium-scrollbar::-webkit-scrollbar-thumb {
                                            background: rgba(0, 0, 0, 0.05);
                                            border-radius: 20px;
                                            transition: all 0.3s;
                                        }
                                        .dark .custom-premium-scrollbar::-webkit-scrollbar-thumb {
                                            background: rgba(255, 255, 255, 0.05);
                                        }
                                        .custom-premium-scrollbar:hover::-webkit-scrollbar-thumb {
                                            background: rgba(0, 0, 0, 0.1);
                                        }
                                        .dark .custom-premium-scrollbar:hover::-webkit-scrollbar-thumb {
                                            background: rgba(255, 255, 255, 0.1);
                                        }
                                    `}</style>
                                </div>

                                <div className="h-full">
                                    <TabsContent value="history" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <motion.div
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.22, ease: "easeOut" }}
                                            className="space-y-7"
                                        >
                                            <ClinicalSummaryCard latestNote={latestNote} patient={patient} />
                                            <PatientHistoryTab patientId={id!} />
                                        </motion.div>
                                    </TabsContent>
                                    <TabsContent value="pending_reviews" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientPendingSessionReviewsTab patientId={id!} />
                                    </TabsContent>
                                    <TabsContent value="anamnesis" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <AnamnesisTab />
                                    </TabsContent>
                                    <TabsContent value="mood" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientMoodTab patientId={id!} />
                                    </TabsContent>
                                    <TabsContent value="biofeedback" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <BiofeedbackWidget patientId={id!} />
                                    </TabsContent>
                                    <TabsContent value="goals" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientGoalsTab patientId={id!} />
                                    </TabsContent>
                                    <TabsContent value="packages" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientPackagesTab patientId={id!} />
                                    </TabsContent>
                                    <TabsContent value="finance" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientFinanceTab patientId={id!} />
                                    </TabsContent>
                                    <TabsContent value="documents" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientDocumentsTab patientId={id!} />
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>
                    </main>
                </div>
            </div>
        </div>
        </div>
    );
}
