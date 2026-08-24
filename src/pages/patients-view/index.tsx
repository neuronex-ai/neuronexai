"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { DesktopPatientsList, DesktopPatientsListSkeleton } from "@/components/patients/DesktopPatientsList";
import { UpsellModal } from "@/components/subscription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent, DialogDescription, DialogTitle
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSubscription } from "@/context/SubscriptionContext";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { useDeletePatient } from "@/hooks/use-delete-patient";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePatients } from "@/hooks/use-patients";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import {
    SYNAPSE_PAGE_ACTION_EVENT,
    type SynapseInterfaceAction,
} from "@/lib/synapse-interface-actions";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, Bell, Calendar, Crown, DollarSign, Grid2X2, LayoutDashboard, List, LogOut, Menu, NotebookPen, Plus, Search, Settings, Sparkles, Trash2, Users, Video, Zap, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type PatientsViewMode = 'cards' | 'list';

const PATIENTS_VIEW_STORAGE_KEY = 'neuronex:patients:desktop-view';
const PATIENTS_VIEW_OPTIONS = [
    { value: 'cards', label: <><Grid2X2 className="h-4 w-4" aria-hidden="true" /> Cards</>, ariaLabel: 'Visualizar pacientes em cards' },
    { value: 'list', label: <><List className="h-4 w-4" aria-hidden="true" /> Lista</>, ariaLabel: 'Visualizar pacientes em lista' },
] as const;

const initialPatientsView = (): PatientsViewMode => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(PATIENTS_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'cards';
};

export default function Pacientes() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showUpsellModal, setShowUpsellModal] = useState(false);
    const [viewMode, setViewMode] = useState<PatientsViewMode>(initialPatientsView);
    const { data: patients, isLoading } = usePatients();
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile();
    const { user } = useAuth();
    const { data: profile } = useProfile();
    const { theme } = useTheme();
    const { data: alerts } = useDashboardAlerts();
    const hasAlerts = alerts && alerts.length > 0;
    const { canAddPatient, plan, features } = useSubscription();
    const deletePatientMutation = useDeletePatient();

    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [exportOnDelete, setExportOnDelete] = useState(true);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [agentPatientModalOpen, setAgentPatientModalOpen] = useState(false);

    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Usuário';
    const initials = fullName.substring(0, 2).toUpperCase();

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            toast.success("Até logo.");
            navigate('/auth');
        }
    };

    const sideMenuItems = [
        { label: "Painel", href: "/dashboard", icon: LayoutDashboard },
        { label: "Agenda", href: "/agenda", icon: Calendar },
        { label: "Pacientes", href: "/pacientes", icon: Users },
        { label: "Teleconsulta", href: "/teleconsulta", icon: Video },
        { label: "Notas", href: "/notas", icon: NotebookPen },
        { label: "Financeiro", href: "/financeiro", icon: DollarSign },
        { label: "Synapse AI", href: "/synapse-ai", icon: Sparkles },
        { label: "Integrações", href: "/ajustes?tab=integrations", icon: Zap },
        { label: "Configurações", href: "/ajustes", icon: Settings },
    ];

    const patientCount = patients?.length || 0;
    const canAdd = canAddPatient(patientCount);
    const isAtLimit = !canAdd && plan === 'Essential';
    const maxPatients = features.maxPatients;
    const activeView = isMobile ? 'cards' : viewMode;

    useEffect(() => {
        if (isMobile) return;
        window.localStorage.setItem(PATIENTS_VIEW_STORAGE_KEY, viewMode);
    }, [isMobile, viewMode]);

    useEffect(() => {
        const handleSynapseAction = (event: Event) => {
            const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
            if (action?.action === "filter_patients_directory") {
                setSearchTerm(action.query || "");
                return;
            }

            if (action?.action !== "open_modal" || action.modal !== "new_patient") return;

            if (canAdd) setAgentPatientModalOpen(true);
            else setShowUpsellModal(true);
        };

        window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
        return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    }, [canAdd]);

    useEffect(() => {
        const synapseQuery = location.state?.synapseQuery;
        if (typeof synapseQuery === "string") setSearchTerm(synapseQuery);
        if (location.state?.synapseDestination === "patients.new") {
            if (canAdd) setAgentPatientModalOpen(true);
            else setShowUpsellModal(true);
            window.history.replaceState({}, document.title, location.pathname);
        }
    }, [canAdd, location.pathname, location.state]);

    const filteredPatients = (patients || []).filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const requestPatientDeletion = (patientId: string, patientName: string) => {
        setDeleteTarget({ id: patientId, name: patientName });
    };

    const handleDeleteClick = (e: React.MouseEvent, patientId: string, patientName: string) => {
        e.stopPropagation();
        requestPatientDeletion(patientId, patientName);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        deletePatientMutation.mutate({
            patientId: deleteTarget.id,
            patientName: deleteTarget.name,
            exportBeforeDelete: exportOnDelete,
        });
        setDeleteTarget(null);
    };

    return (
        <div className={cn(
            "desktop-lumen-page desktop-content-offset relative min-h-screen w-full bg-transparent pb-24 font-sans selection:bg-zinc-900/10 selection:text-zinc-900 dark:selection:bg-white/10 dark:selection:text-white",
            !isMobile && "patients-desktop-shell",
        )}>
            <NewPatientModal
                open={agentPatientModalOpen}
                onOpenChange={setAgentPatientModalOpen}
                showTrigger={false}
            />

            {/* --- MOBILE TOP BAR --- */}
            {isMobile && (
                <>
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="fixed top-0 left-0 right-0 z-[60] pt-safe-top"
                    >
                        <div className="flex items-center justify-between px-6 py-4">
                            <Link to="/dashboard">
                                <button className="relative w-11 h-11 rounded-[14px] bg-foreground/5 dark:bg-white/5 backdrop-blur-2xl border border-foreground/5 dark:border-white/10 flex items-center justify-center shadow-sm transition-all duration-300 hover:bg-foreground/10 dark:hover:bg-white/10 active:scale-90 group">
                                    <img
                                        src={theme === 'dark' ? "/favicon-S-FUNDO-BRANCA.ico" : "/favicon-S-FUNDO-PRETA.ico"}
                                        alt="NeuronEx"
                                        className="w-[18px] h-[18px] group-hover:scale-110 transition-transform object-contain opacity-80 group-hover:opacity-100"
                                    />
                                </button>
                            </Link>

                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={() => setNotificationsOpen(true)}
                                    className="relative w-11 h-11 rounded-[14px] bg-foreground/5 dark:bg-white/5 backdrop-blur-2xl border border-foreground/5 dark:border-white/10 flex items-center justify-center shadow-sm transition-all duration-300 hover:bg-foreground/10 dark:hover:bg-white/10 active:scale-90"
                                >
                                    <Bell className="w-[18px] h-[18px] text-foreground/70 dark:text-white/70" strokeWidth={1.5} />
                                    {hasAlerts && (
                                        <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
                                    )}
                                </button>

                                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                                    <SheetTrigger asChild>
                                        <button className="relative w-11 h-11 rounded-[14px] bg-foreground/5 dark:bg-white/5 backdrop-blur-2xl border border-foreground/5 dark:border-white/10 flex items-center justify-center shadow-sm transition-all duration-300 hover:bg-foreground/10 dark:hover:bg-white/10 active:scale-90">
                                            <Menu className="w-[18px] h-[18px] text-foreground/70 dark:text-white/70" strokeWidth={1.5} />
                                        </button>
                                    </SheetTrigger>
                                    <SheetContent side="right" className="w-full border-none bg-transparent p-0 shadow-none focus:outline-none z-[110]">
                                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 40 }} className="h-full flex flex-col bg-background/95 backdrop-blur-3xl overflow-hidden">
                                            <div className="px-8 pt-16 pb-10">
                                                <div className="flex items-center gap-5">
                                                    <Avatar className="h-14 w-14 border border-border shadow-2xl">
                                                        <AvatarImage src={profile?.avatar_url || ''} />
                                                        <AvatarFallback className="bg-muted text-foreground text-base font-bold">{initials}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="text-xl font-bold text-foreground tracking-tight truncate">{fullName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
                                                {sideMenuItems.map((item) => {
                                                    const isActive = location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                                                    return (
                                                        <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)} className={cn("flex items-center gap-5 px-6 py-4 rounded-[24px] transition-all duration-300 active:scale-[0.97] group", isActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]")}>
                                                            <item.icon className={cn("w-5 h-5", isActive ? "text-background" : "text-muted-foreground")} strokeWidth={1.5} />
                                                            <span className="text-sm font-bold tracking-tight">{item.label}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                            <div className="p-8 space-y-2">
                                                <button onClick={handleLogout} className="w-full h-14 rounded-[20px] bg-muted/40 border border-border/50 flex items-center justify-center gap-3 text-muted-foreground font-bold active:scale-95 transition-all">
                                                    <LogOut className="w-4 h-4" strokeWidth={2} />
                                                    <span>Sair da Conta</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        </div>
                    </motion.div>

                    <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                        <SheetContent side="bottom" className="h-[90vh] bg-background border-t border-border/20 p-0 flex flex-col rounded-t-[40px] focus:outline-none z-[110]">
                            <div className="py-4 flex justify-center"><div className="w-12 h-1 bg-muted rounded-full" /></div>
                            <div className="px-8 pb-6">
                                <SheetHeader className="text-left">
                                    <SheetTitle className="text-2xl font-black text-foreground tracking-tighter">Notificações</SheetTitle>
                                </SheetHeader>
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar"><AlertsPanel /></div>
                        </SheetContent>
                    </Sheet>
                </>
            )}

            {/* ─── Header Bar ─── */}
            <div className={cn(
                isMobile
                    ? "relative z-40 mb-8 w-full animate-fade-in px-4 pt-6"
                    : "relative z-40 mb-6 w-full animate-fade-in md:mb-7",
            )}>
                <div className={cn("mx-auto", isMobile ? "max-w-[1920px]" : "max-w-[1760px] md:px-7 lg:px-10 xl:px-12 2xl:px-16")}>
                    <div className={cn(
                        isMobile
                            ? "desktop-retina-frame group flex w-full flex-col items-center justify-between gap-6 rounded-[30px] border border-border/45 bg-card/78 p-5"
                            : "patients-directory-header group flex w-full flex-col items-stretch gap-5 rounded-[28px] px-6 py-5 sm:px-7 xl:flex-row xl:items-center xl:justify-between xl:px-8",
                    )}>
                        {/* Title Section */}
                        <div className="flex items-center justify-between w-full md:w-auto">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "flex items-center justify-center rounded-[15px] text-foreground",
                                    isMobile
                                        ? "desktop-retina-inset h-10 w-10 border border-border/45 bg-muted/30 shadow-sm"
                                        : "patients-directory-inset h-11 w-11",
                                )}>
                                    <Users className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-black leading-none tracking-[-0.04em] text-foreground md:text-2xl">
                                        Pacientes
                                    </h1>
                                    <div className={cn(
                                        "inline-flex items-center rounded-full px-3 text-[10px] font-black tabular-nums md:text-[11px]",
                                        isMobile
                                            ? "min-h-6 border border-white/10 bg-zinc-900 text-white shadow-lg dark:bg-white dark:text-zinc-900"
                                            : "patients-directory-count min-h-7 text-foreground",
                                    )}>
                                        {patients?.length || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Info Tag */}
                            {isMobile && isAtLimit && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                                    <Crown className="h-3 w-3" />
                                    <span>{patientCount}/{maxPatients}</span>
                                </div>
                            )}
                        </div>

                        {/* Actions Section */}
                        <div className={cn("flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center xl:w-auto", isMobile && "flex-col md:flex-row")}>
                            {/* Unified Search & Actions Container (Mobile) */}
                            <div className="flex min-w-0 flex-1 items-center gap-3 xl:flex-none">
                                <div className="group/search relative min-w-0 flex-1 xl:w-[min(32vw,410px)]" data-synapse-target="patients-search">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within/search:text-zinc-900 dark:group-focus-within/search:text-zinc-300 transition-colors" />
                                    <Input
                                        placeholder="Buscar prontuário..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={cn(
                                            isMobile
                                                ? "desktop-retina-inset h-11 w-full rounded-2xl border-border/40 bg-muted/30 pl-11 pr-10 text-xs font-bold tracking-tight shadow-none placeholder:text-muted-foreground/65"
                                                : "patients-directory-inset h-12 w-full rounded-[16px] border-0 pl-11 pr-11 text-xs font-bold tracking-tight shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-2 focus-visible:ring-ring",
                                        )}
                                    />
                                    <AnimatePresence>
                                        {searchTerm && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                onClick={() => setSearchTerm("")}
                                                type="button"
                                                aria-label="Limpar busca de pacientes"
                                                className={cn(
                                                    "absolute top-1/2 flex -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors",
                                                    isMobile
                                                        ? "right-3 h-6 w-6 rounded-full bg-zinc-200 hover:text-foreground dark:bg-white/10"
                                                        : "right-2.5 h-11 w-11 rounded-[14px] hover:bg-foreground hover:text-background",
                                                )}
                                            >
                                                <X className="w-3 h-3" strokeWidth={3} />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {!isMobile ? (
                                    <MagneticSegmentedControl
                                        id="patients-view"
                                        indicatorId="patients-view-indicator"
                                        value={viewMode}
                                        onValueChange={setViewMode}
                                        options={PATIENTS_VIEW_OPTIONS}
                                        ariaLabel="Visualização dos pacientes"
                                        className="patients-view-control min-h-12 shrink-0 rounded-[16px] p-0.5"
                                        triggerClassName="min-h-11 rounded-[13px] px-3.5 text-[10px] font-black uppercase tracking-[0.11em]"
                                    />
                                ) : null}

                                {/* Add Button */}
                                {canAdd ? (
                                    <NewPatientModal>
                                        <Button
                                            className={cn(
                                                "rounded-[16px] bg-foreground text-background shadow-none transition-colors hover:bg-foreground/88",
                                                isMobile ? "w-11 h-11 p-0 flex-shrink-0" : "h-11 px-6 text-[10px] font-black uppercase tracking-widest"
                                            )}
                                        >
                                            <Plus className="stroke-[4] h-5 w-5" />
                                            {!isMobile && <span className="ml-2">Novo Paciente</span>}
                                        </Button>
                                    </NewPatientModal>
                                ) : (
                                    <Button
                                        onClick={() => setShowUpsellModal(true)}
                                        className={cn(
                                            "rounded-[16px] bg-foreground text-background shadow-none transition-colors hover:bg-foreground/88",
                                            isMobile ? "w-11 h-11 p-0 flex-shrink-0" : "h-11 px-6 text-[10px] font-black uppercase tracking-widest"
                                        )}
                                    >
                                        <Crown className="h-5 w-5" />
                                        {!isMobile && <span className="ml-2">Upgrade</span>}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Directory Content ─── */}
            {isMobile ? (
                <div className="relative z-10 mx-auto max-w-[1920px] space-y-12 px-4">
                    <div data-synapse-target="patients-grid" className="grid grid-cols-1 gap-6">
                        {isLoading ? (
                            Array.from({ length: 8 }).map((_, index) => (
                                <GlassCard key={index} className="h-[240px] animate-pulse rounded-[32px] motion-reduce:animate-none"><></></GlassCard>
                            ))
                        ) : filteredPatients?.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-40 text-center">
                                <GlassCard className="mx-auto flex max-w-lg flex-col items-center rounded-[48px] border-dashed p-16">
                                    <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-100 shadow-inner ring-1 ring-zinc-200 dark:bg-white/5 dark:ring-white/10">
                                        <Users className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                                    </div>
                                    <h3 className="mb-3 text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Nenhum paciente encontrado</h3>
                                    <p className="max-w-[280px] text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">Tente ajustar sua busca ou adicione um novo prontuário.</p>
                                </GlassCard>
                            </div>
                        ) : filteredPatients?.map((patient, index) => (
                            <GlassCard
                                key={patient.id}
                                data-synapse-patient-id={patient.id}
                                className="desktop-retina-panel desktop-retina-interactive group h-full min-h-[240px] cursor-pointer rounded-[32px] border-border/45 bg-card/72"
                                innerClassName="p-0 flex flex-col h-full"
                                onClick={() => navigate(`/pacientes/${patient.id}`)}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        navigate(`/pacientes/${patient.id}`);
                                    }
                                }}
                                role="link"
                                tabIndex={0}
                                aria-label={`Abrir prontuário de ${patient.name}`}
                                delay={Math.min(index, 5) * 20}
                            >
                                <div className="relative z-10 flex h-full flex-col justify-between p-6">
                                    <button
                                        type="button"
                                        onClick={(event) => handleDeleteClick(event, patient.id, patient.name)}
                                        className="desktop-retina-inset absolute right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted/40 opacity-0 shadow-sm transition-[opacity,background-color,color,transform] duration-200 hover:bg-rose-500 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                                        aria-label={`Excluir ${patient.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                    <div className="flex items-start gap-4">
                                        <Avatar className="h-14 w-14 rounded-2xl border-[3px] border-white shadow-2xl dark:border-[#0c0c0c]">
                                            <AvatarImage src={patient.avatar_url || undefined} alt="" />
                                            <AvatarFallback className="bg-zinc-900 text-base font-black uppercase tracking-widest text-white dark:bg-white dark:text-zinc-900">
                                                {patient.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1 pt-1">
                                            <h3 className="mb-1.5 truncate pr-8 text-base font-black tracking-tighter text-zinc-900 dark:text-zinc-100">{patient.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={cn('h-1.5 w-1.5 rounded-full', patient.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-700')} />
                                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{patient.status === 'active' ? 'Ativo' : 'Pendente'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-2.5">
                                        <div className="desktop-retina-inset flex items-center gap-3.5 rounded-xl border border-border/45 bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
                                            <Activity className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                            <span className="truncate font-bold tracking-tight">{patient.diagnosis || 'Sem diagnóstico definido'}</span>
                                        </div>
                                        <div className="desktop-retina-inset flex items-center gap-3.5 rounded-xl border border-border/45 bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
                                            <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                                            <span className="truncate font-bold tracking-tight">{patient.next_session ? `Próxima: ${format(new Date(patient.next_session), 'dd/MM HH:mm')}` : 'Aguardando agendamento'}</span>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            ) : (
            <div className="relative z-10 mx-auto max-w-[1760px] px-4 md:px-7 lg:px-10 xl:px-12 2xl:px-16">
                {isLoading ? (
                    activeView === 'cards' ? (
                        <div
                            id="patients-view-panel-cards"
                            role={!isMobile ? 'tabpanel' : undefined}
                            aria-labelledby={!isMobile ? 'patients-view-tab-cards' : undefined}
                            className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 xl:gap-6"
                        >
                            {Array.from({ length: 8 }).map((_, index) => (
                                <div key={index} className="patients-directory-card h-[236px] animate-pulse rounded-[28px] motion-reduce:animate-none" />
                            ))}
                        </div>
                    ) : (
                        <div id="patients-view-panel-list" role="tabpanel" aria-labelledby="patients-view-tab-list">
                            <DesktopPatientsListSkeleton />
                        </div>
                    )
                ) : filteredPatients?.length === 0 ? (
                    <section className="patients-directory-empty mx-auto flex max-w-xl flex-col items-center rounded-[30px] px-8 py-14 text-center sm:px-12 sm:py-16" aria-live="polite">
                        <div className="patients-directory-inset mb-6 flex h-16 w-16 items-center justify-center rounded-[20px]">
                            <Users className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <h2 className="text-xl font-black tracking-[-0.035em] text-foreground">Nenhum paciente encontrado</h2>
                        <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">Tente ajustar sua busca ou adicione um novo prontuário.</p>
                    </section>
                ) : activeView === 'list' ? (
                    <div id="patients-view-panel-list" role="tabpanel" aria-labelledby="patients-view-tab-list" data-synapse-target="patients-list">
                        <DesktopPatientsList
                            patients={filteredPatients}
                            onDelete={(patient) => requestPatientDeletion(patient.id, patient.name)}
                        />
                    </div>
                ) : (
                    <div
                        id="patients-view-panel-cards"
                        role={!isMobile ? 'tabpanel' : undefined}
                        aria-labelledby={!isMobile ? 'patients-view-tab-cards' : undefined}
                        data-synapse-target="patients-grid"
                        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 xl:gap-6"
                    >
                        {filteredPatients?.map((patient) => (
                            <div
                                key={patient.id}
                                data-synapse-patient-id={patient.id}
                                className="patients-directory-card desktop-retina-interactive group relative min-h-[236px] cursor-pointer overflow-hidden rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                onClick={() => navigate(`/pacientes/${patient.id}`)}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        navigate(`/pacientes/${patient.id}`);
                                    }
                                }}
                                role="link"
                                tabIndex={0}
                                aria-label={`Abrir prontuário de ${patient.name}`}
                            >
                                <div className="relative z-10 flex h-full min-h-[236px] flex-col justify-between p-6 sm:p-7">
                                    <button
                                        type="button"
                                        onClick={(event) => handleDeleteClick(event, patient.id, patient.name)}
                                        className="patients-directory-inset absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-[14px] text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 hover:bg-destructive hover:text-destructive-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                                        aria-label={`Excluir ${patient.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <div className="flex items-start gap-[18px] pr-11">
                                        <Avatar className="h-14 w-14 shrink-0 rounded-[18px] border border-border/55 bg-background shadow-sm">
                                            <AvatarImage src={patient.avatar_url || undefined} alt="" />
                                            <AvatarFallback className="rounded-[18px] bg-foreground text-sm font-black uppercase tracking-[0.12em] text-background">
                                                {patient.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <h3 className="truncate text-base font-black tracking-[-0.035em] text-foreground md:text-lg">{patient.name}</h3>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={cn('patients-status-dot h-1.5 w-1.5 rounded-full', patient.status === 'active' ? 'is-active' : 'is-pending')} aria-hidden="true" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                                                    {patient.status === 'active' ? 'Ativo' : 'Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-7 space-y-2.5">
                                        <div className="patients-directory-inset flex min-h-11 items-center gap-3.5 rounded-[15px] px-4 text-[11px] text-muted-foreground md:text-xs">
                                            <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <span className="truncate font-bold tracking-tight">{patient.diagnosis || 'Sem diagnóstico definido'}</span>
                                        </div>
                                        <div className="patients-directory-inset flex min-h-11 items-center gap-3.5 rounded-[15px] px-4 text-[11px] text-muted-foreground md:text-xs">
                                            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <span className="truncate font-bold tracking-tight">
                                                {patient.next_session
                                                    ? `Próxima: ${format(new Date(patient.next_session), 'dd/MM HH:mm')}`
                                                    : 'Aguardando agendamento'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="patients-directory-dialog desktop-retina-form z-[9999] overflow-hidden rounded-[30px] p-0 sm:max-w-[480px]">
                    <div className="relative p-7 text-center sm:p-9">
                        <div className="patients-directory-inset mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[18px] text-destructive">
                            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                        </div>

                        <DialogTitle className="mb-3 text-2xl font-black tracking-[-0.04em] text-foreground">
                            Excluir paciente?
                        </DialogTitle>
                        <DialogDescription className="mx-auto max-w-[340px] text-sm font-medium leading-relaxed text-muted-foreground">
                            Esta ação removerá <span className="font-black text-foreground">{deleteTarget?.name}</span> permanentemente.
                        </DialogDescription>

                        <label htmlFor="export-before-patient-delete" className="patients-directory-inset my-7 flex min-h-[72px] cursor-pointer items-center gap-4 rounded-[18px] px-5 py-4 text-left">
                            <Checkbox
                                id="export-before-patient-delete"
                                checked={exportOnDelete}
                                onCheckedChange={(checked) => setExportOnDelete(checked === true)}
                                className="h-5 w-5 rounded-md border-border data-[state=checked]:bg-foreground data-[state=checked]:text-background"
                            />
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-foreground">Exportar dados antes</p>
                                <p className="mt-1 text-[11px] font-medium text-muted-foreground">Baixar uma cópia do prontuário completo.</p>
                                </div>
                        </label>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={confirmDelete}
                                disabled={deletePatientMutation.isPending}
                                className="h-12 w-full rounded-[16px] bg-destructive text-[10px] font-black uppercase tracking-[0.16em] text-destructive-foreground shadow-none hover:bg-destructive/90"
                            >
                                {deletePatientMutation.isPending ? "Processando..." : "Confirmar exclusão"}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setDeleteTarget(null)}
                                className="h-11 w-full rounded-[14px] text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                Manter registro
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <UpsellModal
                feature="unlimited_patients"
                open={showUpsellModal}
                onOpenChange={setShowUpsellModal}
            />
        </div>
    );
}
