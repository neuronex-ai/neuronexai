"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { UpsellModal } from "@/components/subscription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent, DialogDescription, DialogTitle
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { DesktopLumenBackdrop } from "@/components/ui/DesktopLumenBackdrop";
import { Input } from "@/components/ui/input";
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
import { Activity, AlertTriangle, Bell, Calendar, Crown, DollarSign, Download, LayoutDashboard, LogOut, Menu, NotebookPen, Plus, Search, Settings, Sparkles, Trash2, Users, Video, Zap, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Pacientes() {
    const [searchTerm, setSearchTerm] = useState("");
    const [showUpsellModal, setShowUpsellModal] = useState(false);
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

    useEffect(() => {
        const handleSynapseAction = (event: Event) => {
            const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
            if (action?.action !== "open_modal" || action.modal !== "new_patient") return;

            if (canAdd) setAgentPatientModalOpen(true);
            else setShowUpsellModal(true);
        };

        window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
        return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    }, [canAdd]);

    const filteredPatients = patients?.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteClick = (e: React.MouseEvent, patientId: string, patientName: string) => {
        e.stopPropagation();
        setDeleteTarget({ id: patientId, name: patientName });
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
        <div className="desktop-lumen-page desktop-content-offset w-full min-h-screen pt-24 pb-24 relative font-sans bg-transparent selection:bg-zinc-900/10 dark:selection:bg-white/10 selection:text-zinc-900 dark:selection:text-white">
            <DesktopLumenBackdrop />
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
                "relative z-40 w-full animate-fade-in mb-8",
                isMobile && "pt-6 px-4"
            )}>
                <div className="max-w-[1920px] mx-auto md:px-10 lg:px-16 xl:px-24">
                    <div className={cn(
                        "desktop-retina-frame w-full flex items-center justify-between py-4 px-8 md:px-10 bg-white/90 dark:bg-[#0c0c0c]/90 backdrop-blur-3xl border border-black/[0.04] dark:border-white/[0.08] rounded-[28px] group transition-all duration-500 ease-apple hover:border-black/[0.08] dark:hover:border-white/[0.12]",
                        isMobile && "p-5 flex-col gap-6"
                    )}>
                        {/* Title Section */}
                        <div className="flex items-center justify-between w-full md:w-auto">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-900 dark:text-white shadow-sm transition-transform duration-500 group-hover:scale-110">
                                    <Users className="w-4 h-4 md:w-5 md:h-5" strokeWidth={2} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tighter leading-none">
                                        Pacientes
                                    </h1>
                                    <div className="px-2.5 py-0.5 md:px-3 md:py-1 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[10px] md:text-[11px] font-black tabular-nums shadow-lg border border-white/10">
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
                        <div className={cn("flex items-center gap-3 w-full md:w-auto", isMobile && "flex-col md:flex-row")}>
                            {/* Unified Search & Actions Container (Mobile) */}
                            <div className="flex items-center gap-3 w-full">
                                <div className="relative flex-1 group/search">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within/search:text-zinc-900 dark:group-focus-within/search:text-zinc-300 transition-colors" />
                                    <Input
                                        placeholder="Buscar prontuário..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={cn(
                                            "pl-11 h-12 bg-zinc-100/50 dark:bg-white/[0.04] border-transparent focus:bg-white dark:focus:bg-white/[0.1] hover:bg-white dark:hover:bg-white/[0.06] rounded-2xl text-xs font-bold tracking-tight transition-all duration-500 placeholder:text-zinc-400 shadow-sm w-full",
                                            isMobile && "h-11 rounded-2xl"
                                        )}
                                    />
                                    <AnimatePresence>
                                        {searchTerm && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                onClick={() => setSearchTerm("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-200 dark:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                            >
                                                <X className="w-3 h-3" strokeWidth={3} />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Add Button */}
                                {canAdd ? (
                                    <NewPatientModal>
                                        <Button
                                            className={cn(
                                                "rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 shadow-xl transition-all duration-500 active:scale-90",
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
                                            "rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 shadow-xl transition-all duration-500 active:scale-90",
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

            {/* ─── Main Grid Content ─── */}
            <div className="max-w-[1920px] mx-auto px-4 md:px-10 lg:px-16 xl:px-24 relative z-10 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-8">
                    {isLoading ? (
                        [...Array(8)].map((_, i) => (
                            <GlassCard key={i} className="h-[240px] animate-pulse rounded-[32px]">
                                <></>
                            </GlassCard>
                        ))
                    ) : filteredPatients?.length === 0 ? (
                        <div className="col-span-full py-40 flex flex-col items-center justify-center text-center">
                            <GlassCard className="p-16 flex flex-col items-center max-w-lg mx-auto rounded-[48px] border-dashed">
                                <div className="w-20 h-20 rounded-3xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center mb-8 shadow-inner ring-1 ring-zinc-200 dark:ring-white/10">
                                    <Users className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                                </div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-3 tracking-tight">Nenhum paciente encontrado</h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-[280px]">Tente ajustar sua busca ou adicione um novo prontuário.</p>
                            </GlassCard>
                        </div>
                    ) : (
                        filteredPatients?.map((patient, i) => (
                            <GlassCard
                                key={patient.id}
                                className="desktop-retina-panel desktop-retina-interactive h-full min-h-[240px] group cursor-pointer rounded-[32px]"
                                innerClassName="p-0 flex flex-col h-full"
                                onClick={() => navigate(`/pacientes/${patient.id}`)}
                                delay={i * 40}
                            >
                                <div className="p-6 md:p-8 flex flex-col justify-between h-full relative z-10">
                                    {/* Delete Button (Visible on hover) */}
                                    <button
                                        onClick={(e) => handleDeleteClick(e, patient.id, patient.name)}
                                        className="absolute top-6 right-6 z-20 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-zinc-50 dark:bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 hover:bg-rose-500 hover:text-white shadow-sm"
                                        title="Excluir paciente"
                                    >
                                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>

                                    {/* Top Section */}
                                    <div className="flex items-start gap-4 md:gap-5">
                                        <Avatar className="h-14 w-14 md:h-16 md:w-16 border-[3px] border-white dark:border-[#0c0c0c] shadow-2xl rounded-2xl transition-all duration-700 group-hover:scale-105">
                                            <AvatarFallback className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-base md:text-lg uppercase tracking-widest">
                                                {patient.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1 pt-1">
                                            <h3 className="font-black text-base md:text-lg text-zinc-900 dark:text-zinc-100 truncate pr-8 mb-1.5 tracking-tighter group-hover:text-black dark:group-hover:text-white transition-colors">{patient.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    patient.status === 'active'
                                                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"
                                                        : "bg-zinc-400 dark:bg-zinc-700 shadow-sm"
                                                )} />
                                                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-widest">
                                                    {patient.status === 'active' ? 'Ativo' : 'Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Info */}
                                    <div className="space-y-2.5 mt-6 md:mt-8">
                                        <div className="desktop-retina-inset flex items-center gap-3.5 text-[11px] md:text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100/50 px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border border-zinc-200/50 transition-all group-hover:bg-white">
                                            <Activity className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                            <span className="truncate font-bold tracking-tight">{patient.diagnosis || "Sem diagnóstico definido"}</span>
                                        </div>
                                        <div className="desktop-retina-inset flex items-center gap-3.5 text-[11px] md:text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100/50 px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl border border-zinc-200/50 transition-all group-hover:bg-white">
                                            <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                            <span className="font-bold tracking-tight">
                                                {patient.next_session
                                                    ? `Próxima: ${format(new Date(patient.next_session), "dd/MM HH:mm")}`
                                                    : "Aguardando agendamento"
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        ))
                    )}
                </div>
            </div>

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="desktop-retina-modal desktop-retina-form z-[9999] sm:max-w-[480px] p-0 bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-3xl border border-zinc-200 dark:border-white/[0.08] rounded-[38px] overflow-hidden">
                    <div className="p-12 text-center relative">
                        <div className="absolute top-0 right-0 p-32 bg-rose-500/5 rounded-full blur-[80px] pointer-events-none" />

                        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 flex items-center justify-center mx-auto mb-8 shadow-2xl">
                            <AlertTriangle className="w-10 h-10 text-rose-500" />
                        </div>

                        <DialogTitle className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-3 tracking-tighter">
                            Excluir Paciente?
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-base leading-relaxed max-w-[320px] mx-auto font-medium">
                            Esta ação removerá <span className="text-zinc-900 dark:text-zinc-100 font-black">{deleteTarget?.name}</span> permanentemente.
                        </DialogDescription>

                        <div className="mt-10 mb-8">
                            <button
                                onClick={() => setExportOnDelete(!exportOnDelete)}
                                className={cn(
                                    "w-full flex items-center gap-5 p-5 rounded-2xl border transition-all duration-500 text-left group",
                                    exportOnDelete
                                        ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white shadow-xl"
                                        : "bg-zinc-50 dark:bg-white/[0.02] border-zinc-200 dark:border-white/10 hover:border-zinc-300"
                                )}
                            >
                                <div className={cn(
                                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0",
                                    exportOnDelete ? "bg-white dark:bg-zinc-900 border-white dark:border-zinc-900 text-zinc-900 dark:text-white" : "border-zinc-300 dark:border-zinc-700 bg-white/50"
                                )}>
                                    {exportOnDelete && <Download className="w-4 h-4 stroke-[3]" />}
                                </div>
                                <div>
                                    <p className={cn("text-sm font-black uppercase tracking-widest", exportOnDelete ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-zinc-100")}>Exportar dados</p>
                                    <p className={cn("text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70", exportOnDelete ? "text-white dark:text-zinc-900" : "text-zinc-500")}>Baixar prontuário completo</p>
                                </div>
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Button
                                onClick={confirmDelete}
                                disabled={deletePatientMutation.isPending}
                                className="w-full h-16 rounded-[24px] bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {deletePatientMutation.isPending ? "PROCESSANDO..." : "CONFIRMAR EXCLUSÃO"}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setDeleteTarget(null)}
                                className="w-full h-14 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 uppercase tracking-[0.2em] text-[10px] font-black"
                            >
                                MANTER REGISTRO
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
