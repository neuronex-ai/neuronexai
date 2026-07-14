import { usePatientById } from "@/hooks/use-patient-by-id";
import { useSessionNotes } from "@/hooks/use-session-notes";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { addWeeks, format } from "date-fns";
import { motion } from "framer-motion";
import {
    ArrowLeft, Bell, Cake, Calendar, DollarSign, Edit2, FileOutput, FileText, LayoutDashboard, Loader2, LogOut, MailPlus, Menu, NotebookPen, Phone, RotateCw, Settings, Smile, Sparkles, Target, Users,
    Video, Zap
} from "lucide-react";
import { toast } from "sonner";

// Components
import { ClinicalSummaryCard } from "@/components/patients/ClinicalSummaryCard";
import { EditPatientModal } from "@/components/patients/EditPatientModal";
import { InvitePatientModal } from "@/components/patients/InvitePatientModal";
import { PatientDocumentsTab } from "@/components/patients/PatientDocumentsTab";
import { PatientFinanceTab } from "@/components/patients/PatientFinanceTab";
import { PatientGoalsTab } from "@/components/patients/PatientGoalsTab";
import { PatientHistoryTab } from "@/components/patients/PatientHistoryTab";
import { PatientMoodTab } from "@/components/patients/PatientMoodTab"; // Verify import
import { useAddAppointment } from "@/hooks/use-add-appointment";
import { usePatientAppointments } from "@/hooks/use-patient-appointments";
import { useSubscription } from "@/context/SubscriptionContext";


export const MobilePatientDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Data Fetching
    const { data: patient, isLoading: isLoadingPatient } = usePatientById(id || "");
    const { data: notes } = useSessionNotes(id || "");
    const { data: appointments } = usePatientAppointments();
    const { mutate: addAppointment, isPending: isScheduling } = useAddAppointment();

    // Global Nav State
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const location = useLocation();
    const { user } = useAuth();
    const { theme } = useTheme();
    const { data: profile } = useProfile();
    const { data: alerts } = useDashboardAlerts();
    const { features, hasPaidAccess, accessState, isDevAccount } = useSubscription();
    const hasAlerts = alerts && alerts.length > 0;
    const canInvitePatientPortal = Boolean(features.hasPatientPortal && (hasPaidAccess || accessState === "admin_override" || isDevAccount));

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
        { label: "Integrações", href: "/integracoes", icon: Zap },
        { label: "Configurações", href: "/ajustes", icon: Settings },
    ];

    const latestNote = notes?.[0];

    const handleRepeatLastAppointment = () => {
        if (!appointments || appointments.length === 0) {
            toast.error("Nenhum agendamento anterior.");
            return;
        }
        const lastAppt = appointments
            .filter(a => a.patient_id === id)
            .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];

        if (!lastAppt) {
            toast.error("Nenhum agendamento encontrado.");
            return;
        }

        const lastDate = new Date(lastAppt.start_time);
        const nextDate = addWeeks(lastDate, 1);
        const durationMs = new Date(lastAppt.end_time).getTime() - lastDate.getTime();
        const nextEndTime = new Date(nextDate.getTime() + durationMs);

        addAppointment({
            patient_id: id!,
            start_time: nextDate,
            end_time: nextEndTime,
            type: lastAppt.type,
            notes: "Repetição rápida",
            location: lastAppt.location
        }, {
            onSuccess: () => toast.success("Agendado!")
        });
    };


    if (isLoadingPatient || !patient) {
        return (
            <div className="flex flex-col min-h-screen bg-background items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background overflow-hidden font-sans relative">
            {/* Texture */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03] bg-[url('/noise.png')]" />

            {/* --- GLOBAL TOP BAR --- */}
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
                                <motion.div
                                    initial={{ x: "100%" }}
                                    animate={{ x: 0 }}
                                    exit={{ x: "100%" }}
                                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                                    className="h-full flex flex-col bg-background/95 backdrop-blur-3xl overflow-hidden"
                                >
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
                                                <Link
                                                    key={item.href}
                                                    to={item.href}
                                                    onClick={() => setSidebarOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-5 px-6 py-4 rounded-[24px] transition-all duration-300 active:scale-[0.97] group",
                                                        isActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                                                    )}
                                                >
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

            {/* --- NOTIFICATIONS --- */}
            <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                <SheetContent side="bottom" className="h-[90vh] bg-background border-t border-border/20 p-0 flex flex-col rounded-t-[40px] focus:outline-none z-[110]">
                    <div className="py-4 flex justify-center">
                        <div className="w-12 h-1 bg-muted rounded-full" />
                    </div>
                    <div className="px-8 pb-6">
                        <SheetHeader className="text-left">
                            <SheetTitle className="text-2xl font-black text-foreground tracking-tighter">Notificações</SheetTitle>
                        </SheetHeader>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar">
                        <AlertsPanel />
                    </div>
                </SheetContent>
            </Sheet>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 overflow-y-auto pt-[6.5rem] pb-32 custom-scrollbar">

                {/* Header Section (Verticalized) */}
                <div className="px-6 mb-8 relative">
                    <div className="absolute left-6 top-1 z-10">
                        <button
                            onClick={() => navigate('/pacientes')}
                            className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center active:scale-90 transition-all hover:bg-foreground/10"
                        >
                            <ArrowLeft className="w-5 h-5 text-foreground" />
                        </button>
                    </div>

                    <div className="flex flex-col items-center text-center pt-2">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mb-5 relative"
                        >
                            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-foreground/10 to-transparent relative z-10">
                                <Avatar className="w-full h-full border-[3px] border-background shadow-2xl">
                                    <AvatarImage src="" />
                                    <AvatarFallback className="bg-muted text-foreground text-2xl font-black">
                                        {patient.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-20 pointer-events-none" />
                        </motion.div>

                        <h1 className="text-2xl font-black text-foreground tracking-tight leading-none mb-3 max-w-[80%]">{patient.name}</h1>

                        <div className="mb-6 flex items-center justify-center gap-2">
                            {canInvitePatientPortal && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setInviteModalOpen(true)}
                                    className="h-9 rounded-full border-foreground/10 bg-background/80 px-4 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
                                >
                                    <MailPlus className="mr-2 h-3.5 w-3.5" />
                                    Convidar
                                </Button>
                            )}
                            <div className="flex items-center gap-2 rounded-full border border-foreground/5 bg-foreground/5 px-3 py-1">
                                <span className={cn("w-1.5 h-1.5 rounded-full", patient.status === 'active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-500")} />
                                <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-widest">{patient.status === 'active' ? 'Em Tratamento' : 'Inativo'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full justify-center mb-8">
                            <Button
                                onClick={handleRepeatLastAppointment}
                                disabled={isScheduling}
                                className="h-11 px-8 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 active:scale-95 transition-all"
                            >
                                {isScheduling ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RotateCw className="w-3 h-3 mr-2" />}
                                Reagendar
                            </Button>
                            <EditPatientModal patient={patient}>
                                <Button variant="outline" className="h-11 w-11 rounded-full p-0 border-foreground/10 bg-transparent active:scale-90 hover:bg-foreground/5">
                                    <Edit2 className="w-4 h-4 text-foreground" />
                                </Button>
                            </EditPatientModal>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <div className="p-4 rounded-[24px] bg-card border border-border/50 shadow-sm flex flex-col items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] font-bold text-foreground truncate max-w-full">{patient.phone || "--"}</p>
                            </div>
                            <div className="p-4 rounded-[24px] bg-card border border-border/50 shadow-sm flex flex-col items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                    <Cake className="w-3.5 h-3.5 text-muted-foreground" />
                                </div>
                                <p className="text-[11px] font-bold text-foreground truncate max-w-full">
                                    {patient.birth_date ? format(new Date(patient.birth_date), 'dd/MM/yyyy') : "--"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs & Content */}
                <div className="px-1">
                    <Tabs defaultValue="history" className="w-full">
                        <div className="px-5 mb-6">
                            <TabsList className="bg-transparent h-auto p-0 flex items-center justify-start gap-2.5 w-full overflow-x-auto no-scrollbar snap-x px-1 pb-1">
                                {[
                                    { val: "history", label: "Histórico", icon: FileText },
                                    { val: "mood", label: "Humor", icon: Smile },
                                    { val: "goals", label: "Metas", icon: Target },
                                    { val: "documents", label: "Arquivos", icon: FileOutput },
                                    { val: "finance", label: "Financeiro", icon: DollarSign },
                                ].map((tab) => (
                                    <TabsTrigger
                                        key={tab.val}
                                        value={tab.val}
                                        className="relative h-10 px-4 rounded-xl flex items-center gap-2 border border-border/10 bg-card/50 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-transparent transition-all active:scale-95 hover:bg-secondary/50 shrink-0 snap-center"
                                    >
                                        <tab.icon className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                                    </TabsTrigger>
                                ))}

                            </TabsList>
                        </div>

                        <div className="px-6 pb-10 min-h-[500px]">
                            <TabsContent value="history" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-6">
                                    <ClinicalSummaryCard latestNote={latestNote} patient={patient} />
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Sessões Anteriores</h3>
                                    <PatientHistoryTab patientId={id!} />
                                </div>
                            </TabsContent>
                            <TabsContent value="mood" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <PatientMoodTab patientId={id!} />
                            </TabsContent>
                            <TabsContent value="goals" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <PatientGoalsTab patientId={id!} />
                            </TabsContent>
                            <TabsContent value="documents" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <PatientDocumentsTab patientId={id!} />
                            </TabsContent>
                            <TabsContent value="finance" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <PatientFinanceTab patientId={id!} />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div >

            <InvitePatientModal
                isOpen={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                patient={patient}
            />
        </div >
    );
};
