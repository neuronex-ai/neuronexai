"use client";

import { DocumentGeneratorModal } from "@/components/patients/DocumentGeneratorModal";
import { EditPatientModal } from "@/components/patients/EditPatientModal";
import { InvitePatientModal } from "@/components/patients/InvitePatientModal";
import { PatientRecordSummaryTab } from "@/components/patients/PatientRecordSummaryTab";
import { PatientSessionsTab } from "@/components/patients/PatientSessionsTab";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePatientById } from "@/hooks/use-patient-by-id";
import { useSessionNotes } from "@/hooks/use-session-notes";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
    ArrowLeft, Cake, ClipboardList, Edit, Edit2, FileOutput, Gauge, Layers3, MailPlus, MapPin, Package, Phone, Pill, Shield,
    Smile, Target, Wallet
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";


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
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { useSubscription } from "@/context/SubscriptionContext";
import { useIsMobile } from "@/hooks/use-mobile";

const MobilePatientDetail = lazy(() =>
    import("@/mobile/pages/MobilePatientDetail").then((module) => ({ default: module.MobilePatientDetail })),
);
const loadAnamnesisTab = () => import("@/components/patients/anamnesis/AnamnesisTab").then((module) => ({ default: module.AnamnesisTab }));
const loadPatientDocumentsTab = () => import("@/components/patients/PatientDocumentsTab").then((module) => ({ default: module.PatientDocumentsTab }));
const loadPatientFinanceTab = () => import("@/components/patients/PatientFinanceTab").then((module) => ({ default: module.PatientFinanceTab }));
const loadPatientGoalsTab = () => import("@/components/patients/PatientGoalsTab").then((module) => ({ default: module.PatientGoalsTab }));
const loadPatientMoodTab = () => import("@/components/patients/PatientMoodTab").then((module) => ({ default: module.PatientMoodTab }));
const loadPatientPackagesTab = () => import("@/components/patients/PatientPackagesTab").then((module) => ({ default: module.PatientPackagesTab }));

const AnamnesisTab = lazy(loadAnamnesisTab);
const PatientDocumentsTab = lazy(loadPatientDocumentsTab);
const PatientFinanceTab = lazy(loadPatientFinanceTab);
const PatientGoalsTab = lazy(loadPatientGoalsTab);
const PatientMoodTab = lazy(loadPatientMoodTab);
const PatientPackagesTab = lazy(loadPatientPackagesTab);

const PatientTabFallback = () => (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando seção do prontuário">
        <Skeleton className="h-28 w-full rounded-[24px]" />
        <Skeleton className="h-64 w-full rounded-[28px]" />
    </div>
);

const PatientDetail = () => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Suspense fallback={<PatientTabFallback />}>
                <MobilePatientDetail />
            </Suspense>
        );
    }

    return <DesktopPatientDetail />;
};

export default PatientDetail;

function DesktopPatientDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState("summary");
    const [sessionView, setSessionView] = useState<"history" | "pending">("history");
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const shouldReduceMotion = useReducedMotion();
    const { features, hasPaidAccess, accessState, isDevAccount } = useSubscription();
    const canInvitePatientPortal = Boolean(features.hasPatientPortal && (hasPaidAccess || accessState === "admin_override" || isDevAccount));

    useEffect(() => {
        const requestedTab = searchParams.get("tab");
        const requestedSessionView = searchParams.get("sessionView");
        const compatibilityTab = requestedTab === "history" || requestedTab === "pending_reviews"
            ? "sessions"
            : requestedTab;

        if (["summary", "sessions", "anamnesis", "mood", "goals", "packages", "finance", "documents"].includes(compatibilityTab || "")) {
            setActiveTab(compatibilityTab!);
        } else {
            setActiveTab("summary");
        }

        if (requestedTab === "pending_reviews" || requestedSessionView === "pending") {
            setSessionView("pending");
        } else {
            setSessionView("history");
        }

        if (requestedTab === "history" || requestedTab === "pending_reviews") {
            const canonicalParams = new URLSearchParams(searchParams);
            canonicalParams.set("tab", "sessions");
            canonicalParams.set("sessionView", requestedTab === "pending_reviews" ? "pending" : "history");
            setSearchParams(canonicalParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        const preload = () => {
            void Promise.allSettled([
                loadAnamnesisTab(),
                loadPatientDocumentsTab(),
                loadPatientFinanceTab(),
                loadPatientGoalsTab(),
                loadPatientMoodTab(),
                loadPatientPackagesTab(),
            ]);
        };

        if ("requestIdleCallback" in window) {
            const idleId = window.requestIdleCallback(preload, { timeout: 1800 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = globalThis.setTimeout(preload, 650);
        return () => globalThis.clearTimeout(timeoutId);
    }, []);

    const handleTabChange = (tab: string, requestedSessionView?: "history" | "pending") => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", tab);

        if (tab === "sessions") {
            const nextView = requestedSessionView || sessionView;
            setSessionView(nextView);
            nextParams.set("sessionView", nextView);
        } else {
            nextParams.delete("sessionView");
        }

        setActiveTab(tab);
        setSearchParams(nextParams, { replace: true });
    };

    const handleSessionViewChange = (view: "history" | "pending") => {
        setSessionView(view);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", "sessions");
        nextParams.set("sessionView", view);
        setSearchParams(nextParams, { replace: true });
    };

    const { data: patient, isLoading: isLoadingPatient } = usePatientById(id || "");
    const { data: notes, isLoading: isLoadingNotes } = useSessionNotes(id || "", { limit: 1 });
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
            <div className="desktop-lumen-page desktop-content-offset mx-auto min-h-screen w-full max-w-[1800px] space-y-8 p-6 md:p-8">
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
        { val: "summary", label: "Resumo", icon: Gauge },
        { val: "sessions", label: "Sessões", icon: Layers3 },
        { val: "anamnesis", label: "Anamneses", icon: ClipboardList },
        { val: "mood", label: "Humor", icon: Smile },
        { val: "goals", label: "Metas", icon: Target },
        { val: "packages", label: "Planos", icon: Package },
        { val: "finance", label: "Financeiro", icon: Wallet },
        { val: "documents", label: "Arquivos", icon: FileOutput },
    ];

    return (
        <div className="desktop-lumen-page desktop-content-offset relative h-dvh w-full overflow-hidden bg-transparent pb-3 font-sans text-foreground selection:bg-zinc-900/10 selection:text-zinc-900 dark:selection:bg-white/10 dark:selection:text-white">
            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[2200px] flex-col px-4 md:px-6 lg:px-8 xl:px-10">

            {/* ─── Header Top Bar ─── */}
            <motion.div
                data-synapse-target="patient-header"
                data-synapse-patient-id={patient.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                className="patient-record-header desktop-retina-frame relative z-40 shrink-0 rounded-[30px] border border-border/50 bg-background/88 px-3 py-2.5 backdrop-blur-xl"
            >
                <div className="flex w-full items-center gap-4">

                        {/* Left Side: Back & Title */}
                        <div className="flex min-w-[190px] max-w-[270px] flex-[0_1_250px] items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/pacientes')}
                                aria-label="Voltar para pacientes"
                                className="h-11 w-11 shrink-0 rounded-full border border-border/55 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>

                            <div className="flex min-w-0 flex-col justify-center">
                                <span className="text-[8px] font-black uppercase tracking-[0.28em] text-zinc-400 dark:text-zinc-600">Prontuário clínico</span>
                                <h1 className="truncate text-base font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-100 md:text-lg">{patient.name}</h1>
                            </div>
                        </div>

                    <TooltipProvider delayDuration={220}>
                    <div
                        ref={scrollContainerRef}
                        role="tablist"
                        aria-label="Áreas do prontuário"
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeaveOrUp}
                        onMouseUp={handleMouseLeaveOrUp}
                        onMouseMove={handleMouseMove}
                        className={cn(
                            "patient-record-tabbar desktop-retina-inset flex min-w-0 flex-1 select-none items-center overflow-x-auto rounded-[20px] border border-border/55 bg-muted/30 p-1 backdrop-blur-xl",
                            isDragging ? "cursor-grabbing" : "cursor-grab",
                            "custom-premium-scrollbar"
                        )}
                    >
                        <div className="flex min-w-max flex-1 items-center justify-center gap-1">
                            {patientTabs.map((tab, index) => {
                                const isActive = activeTab === tab.val;
                                return (
                                    <Tooltip key={tab.val}>
                                        <TooltipTrigger asChild>
                                            <motion.button
                                                layout={!shouldReduceMotion}
                                                data-patient-record-tab
                                                type="button"
                                                id={`patient-record-tab-${tab.val}`}
                                                role="tab"
                                                tabIndex={isActive ? 0 : -1}
                                                onClick={() => handleTabChange(tab.val)}
                                                onKeyDown={(event) => {
                                                    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                                                    event.preventDefault();
                                                    const buttons = Array.from(scrollContainerRef.current?.querySelectorAll<HTMLButtonElement>("[data-patient-record-tab]") || []);
                                                    const targetIndex = event.key === "Home"
                                                        ? 0
                                                        : event.key === "End"
                                                            ? buttons.length - 1
                                                            : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
                                                    buttons[targetIndex]?.focus();
                                                    handleTabChange(patientTabs[targetIndex].val);
                                                }}
                                                aria-selected={isActive}
                                                aria-controls={`patient-record-panel-${tab.val}`}
                                                aria-label={tab.label}
                                                className={cn(
                                                    "desktop-retina-interactive relative flex h-11 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-[15px] text-[9px] font-black uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                                    isActive ? "px-4 text-background" : "w-11 px-0 text-muted-foreground hover:bg-background hover:text-foreground",
                                                )}
                                                transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 38, mass: 0.68 }}
                                            >
                                                {isActive ? (
                                                    <motion.span
                                                        layoutId="patient-record-active-tab"
                                                        aria-hidden="true"
                                                        className="absolute inset-0 rounded-[15px] bg-foreground"
                                                        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 38, mass: 0.68 }}
                                                    />
                                                ) : null}
                                                <tab.icon className="relative z-10 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                {isActive ? (
                                                    <motion.span
                                                        initial={shouldReduceMotion ? false : { opacity: 0, x: -3 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="relative z-10"
                                                    >
                                                        {tab.label}
                                                    </motion.span>
                                                ) : null}
                                            </motion.button>
                                        </TooltipTrigger>
                                        {!isActive ? <TooltipContent side="bottom">{tab.label}</TooltipContent> : null}
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                    </TooltipProvider>

                        {/* Right Side: Actions */}
                        <div className="flex shrink-0 items-center gap-2">
                            {canInvitePatientPortal && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setInviteModalOpen(true)}
                                    className="h-11 rounded-xl border-border/55 bg-background px-3 text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background"
                                >
                                    <MailPlus className="h-3.5 w-3.5 2xl:mr-2" />
                                    <span className="hidden 2xl:inline">Convidar</span>
                                </Button>
                            )}
                            <Select value={patient.status || ""} onValueChange={handleStatusChange}>
                                <SelectTrigger aria-label="Alterar status do paciente" className="h-11 w-auto gap-2 rounded-xl border border-border/55 bg-background px-3 text-[9px] font-black uppercase tracking-[0.17em] text-muted-foreground shadow-sm ring-0 transition-colors hover:bg-muted focus:ring-0">
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
            <div className="patient-record-shell desktop-retina-frame relative z-10 mt-3 min-h-0 flex-1 overflow-hidden rounded-[36px] border border-border/45 bg-background/45 p-3 shadow-[0_28px_82px_-64px_hsl(var(--foreground)/0.4)] dark:bg-black/20">
                <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:grid-cols-[230px_minmax(0,1fr)] lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">

                    {/* LEFT COLUMN: Patient Info */}
                    <aside className="patient-record-scrollbar z-20 min-h-0 w-full overflow-y-auto overscroll-contain border-b border-border/45 pr-1 md:border-b-0">
                        <section className="patient-record-panel w-full overflow-hidden rounded-[24px] border">
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
                                        <Button variant="ghost" aria-label="Editar paciente" className="h-11 w-full rounded-xl bg-muted text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background">
                                            <Edit className="h-4 w-4 xl:mr-2" /><span className="hidden xl:inline">Editar</span>
                                        </Button>
                                    </EditPatientModal>
                                    {canInvitePatientPortal && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setInviteModalOpen(true)}
                                            aria-label="Convidar paciente"
                                            className="h-11 w-full rounded-xl bg-muted text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background"
                                        >
                                            <MailPlus className="h-4 w-4 xl:mr-2" /><span className="hidden xl:inline">Convidar</span>
                                        </Button>
                                    )}
                                    <DocumentGeneratorModal patient={patient}>
                                        <Button variant="ghost" aria-label="Gerar documentos" className="h-11 w-full rounded-xl bg-muted text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background">
                                            <FileOutput className="h-4 w-4 xl:mr-2" /><span className="hidden xl:inline">Docs</span>
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
                                            <Button variant="ghost" size="icon" aria-label="Editar medicações" className="h-11 w-11 rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
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
                                            <div className="clinical-inset-surface rounded-2xl border border-dashed p-6 text-center">
                                                <Pill className="h-5 w-5 text-zinc-300 dark:text-zinc-800 mx-auto mb-3 opacity-30" />
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest italic">Nenhuma medicação</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                    </aside>

                    {/* RIGHT COLUMN: Content Area */}
                    <main className="patient-record-content desktop-retina-frame min-h-0 min-w-0 overflow-hidden rounded-[30px] border border-border/45 bg-card/62">

                        <div className="patient-record-scrollbar relative h-full min-h-0 w-full overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable] md:p-6 lg:p-7">
                            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex min-h-full w-full flex-col">

                                <div className="min-h-full">
                                    <TabsContent data-synapse-target="patient-summary" id="patient-record-panel-summary" aria-labelledby="patient-record-tab-summary" value="summary" className="mt-0 focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientRecordSummaryTab patient={patient} patientId={id!} onNavigate={handleTabChange} />
                                    </TabsContent>
                                    <TabsContent data-synapse-target="patient-sessions" id="patient-record-panel-sessions" aria-labelledby="patient-record-tab-sessions" value="sessions" className="mt-0 focus-visible:outline-none data-[state=inactive]:hidden">
                                        <PatientSessionsTab
                                            patient={patient}
                                            patientId={id!}
                                            latestNote={latestNote}
                                            view={sessionView}
                                            onViewChange={handleSessionViewChange}
                                        />
                                    </TabsContent>
                                    <TabsContent id="patient-record-panel-anamnesis" aria-labelledby="patient-record-tab-anamnesis" value="anamnesis" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <Suspense fallback={<PatientTabFallback />}><AnamnesisTab /></Suspense>
                                    </TabsContent>
                                    <TabsContent id="patient-record-panel-mood" aria-labelledby="patient-record-tab-mood" value="mood" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <Suspense fallback={<PatientTabFallback />}><PatientMoodTab patientId={id!} /></Suspense>
                                    </TabsContent>
                                    <TabsContent id="patient-record-panel-goals" aria-labelledby="patient-record-tab-goals" value="goals" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <Suspense fallback={<PatientTabFallback />}><PatientGoalsTab patientId={id!} /></Suspense>
                                    </TabsContent>
                                    <TabsContent id="patient-record-panel-packages" aria-labelledby="patient-record-tab-packages" value="packages" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <Suspense fallback={<PatientTabFallback />}><PatientPackagesTab patientId={id!} /></Suspense>
                                    </TabsContent>
                                    <TabsContent data-synapse-target="patient-finance" id="patient-record-panel-finance" aria-labelledby="patient-record-tab-finance" value="finance" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <Suspense fallback={<PatientTabFallback />}><PatientFinanceTab patientId={id!} /></Suspense>
                                    </TabsContent>
                                    <TabsContent data-synapse-target="patient-files" id="patient-record-panel-documents" aria-labelledby="patient-record-tab-documents" value="documents" className="mt-0 h-full focus-visible:outline-none data-[state=inactive]:hidden">
                                        <Suspense fallback={<PatientTabFallback />}><PatientDocumentsTab patientId={id!} /></Suspense>
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
