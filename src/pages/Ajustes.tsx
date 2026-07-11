import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DesktopLumenBackdrop } from "@/components/ui/DesktopLumenBackdrop";
import { User, MessageSquare, Building, CreditCard, LogOut, Bell, CheckCircle2, ChevronRight, Monitor, Moon, Sun, Shield, Wallet, Settings, ArrowLeft, Sparkles, Link2 } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { TodoistIcon } from "@/components/icons/TodoistIcon";
import { NotionIcon } from "@/components/icons/NotionIcon";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

// Hooks
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useTodoistAuth } from "@/hooks/use-todoist-auth";
import { useNotionAuth } from "@/hooks/use-notion-auth";
import { useTheme } from "@/hooks/use-theme";
import { useProfile } from "@/hooks/use-profile";
import { useTour } from "@/components/onboarding/TourContext";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { useUserPreferences } from "@/hooks/use-user-preferences";

// Components
import { ProfessionalProfileForm } from "@/components/settings/ProfessionalProfileForm";
import { CommunicationSettings } from "@/components/settings/CommunicationSettings";
import { FiscalConfigPanel } from "@/components/settings/FiscalConfigPanel";
import { NeuroNexPayWizard } from "@/components/settings/NeuroNexPayWizard";
import { NeuroNexIDCard } from "@/components/settings/NeuroNexIDCard";

import { CallbackStatus } from "@/components/integrations/CallbackStatus";
import { supabase } from "@/integrations/supabase/client";

import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SecuritySettingsPanel } from "@/components/settings/SecuritySettingsPanel";

import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSettings } from "@/mobile/pages/MobileSettings";
import { useSubscription } from "@/context/SubscriptionContext";
import { UpgradePlanModal } from "@/components/dashboard/UpgradePlanModal";

const Ajustes = () => {
    const isMobile = useIsMobile();
    const { startTour } = useTour();
    const { isConnected: isGoogleConnected, isLoading: isLoadingGoogleAuth, connectGoogle, disconnectGoogle } = useGoogleAuth();
    const { isConnected: isTodoistConnected, isLoading: isLoadingTodoistAuth, connectTodoist, disconnectTodoist } = useTodoistAuth();
    const { isConnected: isNotionConnected, isLoading: isLoadingNotionAuth, connectNotion, disconnectNotion } = useNotionAuth();
    const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
    const { preferences, updatePreferences, isSaving: isSavingPreferences } = useUserPreferences();
    const { data: profile } = useProfile();
    const { canAccess, plan, status } = useSubscription();

    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [callbackStatus, setCallbackStatus] = useState<'success' | 'failure' | null>(null);
    const [callbackMessage, setCallbackMessage] = useState<string | undefined>(undefined);
    const [integrationSuggestion, setIntegrationSuggestion] = useState("");

    const params = new URLSearchParams(location.search);
    const getTabFromParams = () => {
        const requestedTab = params.get('tab') || 'profile';
        if (requestedTab === 'google') return 'integrations';
        if (requestedTab === 'reports' || requestedTab === 'organization') return 'profile';
        return requestedTab;
    };
    const [activeTab, setActiveTab] = useState(getTabFromParams);

    useEffect(() => {
        const status = params.get('status') as 'success' | 'failure' | null;

        if (status) {
            setCallbackStatus(status);
            setCallbackMessage(params.get('message') || undefined);
            window.history.replaceState({}, document.title, location.pathname);
        }
    }, [location, navigate, queryClient]);

    useEffect(() => {
        setActiveTab(getTabFromParams());
    }, [location.search]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/auth');
    };

    const handleReplayTour = () => {
        toast.info("Reiniciando tour...");
        setTimeout(() => {
            startTour();
        }, 300);
    };

    const handleIntegrationSuggestion = async () => {
        const suggestion = integrationSuggestion.trim();
        if (!suggestion) {
            toast.info("Digite o nome de um aplicativo para sugerir.");
            return;
        }
        if (!user) {
            toast.error("Entre na sua conta para registrar uma sugestão.");
            return;
        }

        const { error } = await supabase
            .from("integration_suggestions")
            .insert({ user_id: user.id, suggestion });

        if (error) {
            toast.error("Não foi possível registrar a sugestão agora.");
            return;
        }

        setIntegrationSuggestion("");
        toast.success("Sugestão registrada. Vamos considerar nas próximas integrações.");
    };

    const savePreferences = async (updates: Parameters<typeof updatePreferences>[0]) => {
        try {
            await updatePreferences(updates);
            toast.success("Preferência salva.");
        } catch {
            toast.error("Não foi possível salvar a preferência.");
        }
    };

    const menuItems = [
        { val: "profile", label: "Meu Perfil", icon: User },
        { val: "security", label: "Login e Segurança", icon: Shield },
        { val: "subscription", label: "Assinatura", icon: CreditCard },
        { val: "prefs", label: "Interface & Tour", icon: Monitor },
        // Only show Pagamentos for Professional/Enterprise
        ...(canAccess('advanced_finance') ? [
            { val: "payments", label: "Pagamentos", icon: Wallet },
        ] : []),
        { val: "notifications", label: "Notificações", icon: Bell },
        { val: "integrations", label: "Integrações", icon: Link2 },
        { val: "communication", label: "Comunicação", icon: MessageSquare },
        { val: "fiscal", label: "Dados Fiscais", icon: Building },
    ];

    if (isMobile) return <MobileSettings />;
    if (callbackStatus) return <CallbackStatus status={callbackStatus} message={callbackMessage} onClose={() => setCallbackStatus(null)} />;

    return (
        <div className="desktop-lumen-page w-full min-h-screen bg-background font-sans selection:bg-primary/20 flex">
            <DesktopLumenBackdrop />
            <div className="desktop-content-offset flex-1 pb-24 pt-24 relative space-y-10">
                <div className="max-w-[1600px] mx-auto px-6 lg:px-8 xl:px-10 relative z-10 space-y-10">
                    {/* Header - Floating Bar Style Polished */}
                    <div className="mb-12 relative z-40 w-full animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="desktop-retina-frame w-full flex items-center justify-between p-1.5 pl-3 bg-white/80 dark:bg-[#080808]/86 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 rounded-full ring-1 ring-black/5 dark:ring-white/[0.025] relative overflow-hidden group">

                            {/* Subtle Inner Glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

                            {/* Left Side: Back & Title */}
                            <div className="flex items-center gap-5 relative z-10">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/dashboard')}
                                    className="h-11 w-11 rounded-full bg-zinc-100 dark:bg-white/[0.03] hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-300 border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 active:scale-95 shadow-sm dark:shadow-inner"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>

                                <div className="flex flex-col justify-center h-full -space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                                        <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] leading-none">Configurações</span>
                                    </div>
                                    <h1 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none pt-1">Ajustes & Integrações</h1>
                                </div>
                            </div>

                            {/* Right Side: Quick Actions/Indicators */}
                            <div className="flex items-center gap-3 pr-2 relative z-10">
                                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-white/5 rounded-full border border-zinc-200 dark:border-white/5">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Plano {plan}</span>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-white to-zinc-100 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200 dark:border-white/10 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                                    <Settings className="h-4 w-4 text-zinc-500 dark:text-zinc-300" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="animate-fade-up">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col md:flex-row gap-12">

                            {/* Sidebar Menu */}
                            <div className="w-full md:w-64 shrink-0 space-y-8">
                                <TabsList className="flex flex-col h-auto bg-transparent gap-1 w-full items-stretch p-0">
                                    {menuItems.map(item => (
                                        <TabsTrigger
                                            key={item.val}
                                            value={item.val}
                                            className={cn(
                                                "desktop-retina-interactive group relative justify-between px-4 py-3.5 rounded-2xl text-xs font-semibold border border-transparent",
                                                "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-foreground data-[state=active]:border-zinc-200 dark:data-[state=active]:border-white/10 data-[state=active]:shadow-lg dark:data-[state=active]:shadow-[0_4px_12px_rgba(0,0,0,0.2)]",
                                                "text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/40"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 flex items-center justify-center group-data-[state=active]:bg-primary/10 group-data-[state=active]:border-primary/20 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none">
                                                    <item.icon className="h-3.5 w-3.5 text-zinc-400 dark:text-white/70 group-data-[state=active]:text-primary group-data-[state=active]:opacity-100" />
                                                </div>
                                                {item.label}
                                            </div>
                                            <ChevronRight className="h-3 w-3 opacity-0 group-data-[state=active]:opacity-100 -translate-x-2 group-data-[state=active]:translate-x-0 transition-all text-zinc-400 dark:text-muted-foreground" />
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                <div className="pt-6 border-t border-zinc-200/60 dark:border-white/5 px-2">
                                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11 rounded-2xl px-3 text-xs font-bold transition-all">
                                        <LogOut className="h-4 w-4" /> Sair da Conta
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <AnimatePresence mode="wait">
                                    <div className="desktop-retina-frame min-h-[700px] w-full bg-white/60 backdrop-blur-[40px] border border-zinc-200 rounded-[48px] p-8 md:p-12 relative overflow-hidden ring-1 ring-black/5 dark:ring-white/[0.025]">

                                        <TabsContent value="profile" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                <div className="order-2 lg:order-1">
                                                    <ProfessionalProfileForm />
                                                </div>
                                                <div className="desktop-retina-panel order-1 lg:order-2 bg-zinc-50/50 rounded-[40px] border border-zinc-200 flex items-center justify-center p-8 backdrop-blur-md">
                                                    <NeuroNexIDCard profile={profile} />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="security" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10"><SecuritySettingsPanel /></TabsContent>

                                        <TabsContent value="subscription" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                                            <div className="bg-zinc-50/50 dark:bg-zinc-900/40 rounded-[40px] border border-zinc-200 dark:border-white/10 p-12 text-center space-y-6 max-w-2xl mx-auto mt-8 shadow-2xl backdrop-blur-xl">
                                                <div className="w-20 h-20 bg-primary/10 rounded-[32px] border border-primary/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/10 ring-1 ring-white/5">
                                                    <CreditCard className="w-8 h-8 text-primary" />
                                                </div>
                                                <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Gerenciar Assinatura</h3>
                                                <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                                                    Você está no plano <span className="text-zinc-900 dark:text-white font-bold">{plan}</span>
                                                    {plan === 'Essential' && ' (Gratuito)'}.
                                                    {status === 'active' && plan !== 'Essential' && (
                                                        <span className="inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800/50">
                                                            <CheckCircle2 className="w-3 h-3" /> Ativo
                                                        </span>
                                                    )}
                                                    {status === 'past_due' && (
                                                        <span className="inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800/50">
                                                            Pagamento Pendente
                                                        </span>
                                                    )}
                                                    {status === 'canceled' && (
                                                        <span className="inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-800/50">
                                                            Cancelada
                                                        </span>
                                                    )}
                                                </p>

                                                {plan === 'Essential' ? (
                                                    <UpgradePlanModal currentPlan={plan}>
                                                        <Button className="rounded-full px-10 h-12 font-bold tracking-wide shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-1 bg-primary text-primary-foreground border border-white/10">
                                                            Ver Planos Upgrade
                                                        </Button>
                                                    </UpgradePlanModal>
                                                ) : plan === 'Professional' ? (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <UpgradePlanModal currentPlan={plan}>
                                                            <Button className="rounded-full px-10 h-12 font-bold tracking-wide shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-1 bg-primary text-primary-foreground border border-white/10">
                                                                Upgrade para Enterprise
                                                            </Button>
                                                        </UpgradePlanModal>
                                                        <button className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium transition-colors underline underline-offset-4">
                                                            Gerenciar assinatura
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-zinc-400 font-medium">Plano Enterprise — contate o suporte para alterações.</p>
                                                )}
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="prefs" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                                            <div className="space-y-12 max-w-2xl">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Monitor className="h-5 w-5 text-primary" />
                                                        <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Aparência</h3>
                                                    </div>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 font-medium">
                                                        Escolha o tema que melhor se adapta ao seu ambiente de trabalho.
                                                    </p>

                                                    <div className="theme-selector grid grid-cols-2 gap-6">
                                                        <button
                                                            onClick={() => theme !== 'dark' && toggleTheme()}
                                                            className={cn(
                                                                "relative group p-5 rounded-[32px] border transition-all duration-500 flex flex-col items-center gap-4 overflow-hidden shadow-2xl",
                                                                theme === 'dark'
                                                                    ? "bg-zinc-900/80 border-white/25 ring-1 ring-white/10"
                                                                    : "bg-zinc-900/20 border-white/10 hover:bg-zinc-900/40 hover:border-white/20"
                                                            )}
                                                        >
                                                            <div className="w-full aspect-video rounded-2xl bg-[#050505] border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl ring-1 ring-white/5">
                                                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-purple-500/10" />
                                                                <Moon className="w-8 h-8 text-white relative z-10 group-hover:scale-110 transition-transform duration-700 ease-out" />
                                                            </div>
                                                            <span className={cn("text-xs font-bold tracking-wider uppercase", theme === 'dark' ? "text-primary" : "text-zinc-500")}>Modo Escuro (Liquid Glass)</span>
                                                        </button>

                                                        <button
                                                            onClick={() => theme !== 'light' && toggleTheme()}
                                                            className={cn(
                                                                "relative group p-5 rounded-[32px] border transition-all duration-500 flex flex-col items-center gap-4 overflow-hidden shadow-2xl",
                                                                theme === 'light'
                                                                    ? "bg-zinc-100 border-zinc-300 ring-1 ring-zinc-200"
                                                                    : "bg-zinc-900/20 border-white/10 hover:bg-zinc-900/40 hover:border-white/20"
                                                            )}
                                                        >
                                                            <div className="w-full aspect-video rounded-2xl bg-[#fafafa] border border-zinc-200 flex items-center justify-center relative overflow-hidden shadow-2xl ring-1 ring-zinc-100">
                                                                <Sun className="w-8 h-8 text-zinc-900 relative z-10 group-hover:rotate-90 transition-transform duration-1000 ease-in-out" />
                                                            </div>
                                                            <span className={cn("text-xs font-bold tracking-wider uppercase", theme === 'light' ? "text-primary" : "text-zinc-500")}>Modo Claro (Ceramic)</span>
                                                        </button>
                                                    </div>

                                                    <div className="mt-8 grid gap-4 rounded-[32px] border border-zinc-200 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Densidade</p>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-500">Ajusta espaçamento geral da interface.</p>
                                                            </div>
                                                            <div className="flex rounded-2xl border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-zinc-950/50">
                                                                {[
                                                                    { value: 'comfortable', label: 'Confortável' },
                                                                    { value: 'compact', label: 'Compacta' },
                                                                ].map((option) => (
                                                                    <button
                                                                        key={option.value}
                                                                        type="button"
                                                                        disabled={isSavingPreferences || !preferences}
                                                                        onClick={() => void savePreferences({ density: option.value as 'comfortable' | 'compact' })}
                                                                        className={cn(
                                                                            "rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all",
                                                                            preferences?.density === option.value
                                                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                                                                                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                                                                        )}
                                                                    >
                                                                        {option.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-4 sm:grid-cols-2">
                                                            <label className="space-y-2">
                                                                <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Idioma</span>
                                                                <select
                                                                    value={preferences?.language || 'pt-BR'}
                                                                    disabled={isSavingPreferences || !preferences}
                                                                    onChange={(event) => void savePreferences({ language: event.target.value })}
                                                                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 outline-none dark:border-white/10 dark:bg-zinc-950/50 dark:text-white"
                                                                >
                                                                    <option value="pt-BR">Português (Brasil)</option>
                                                                    <option value="en-US">English (US)</option>
                                                                    <option value="es-ES">Español</option>
                                                                </select>
                                                            </label>

                                                            <label className="space-y-2">
                                                                <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Fuso horário</span>
                                                                <select
                                                                    value={preferences?.timezone || 'America/Sao_Paulo'}
                                                                    disabled={isSavingPreferences || !preferences}
                                                                    onChange={(event) => void savePreferences({ timezone: event.target.value })}
                                                                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 outline-none dark:border-white/10 dark:bg-zinc-950/50 dark:text-white"
                                                                >
                                                                    <option value="America/Sao_Paulo">São Paulo</option>
                                                                    <option value="America/Fortaleza">Fortaleza</option>
                                                                    <option value="America/Manaus">Manaus</option>
                                                                    <option value="America/Rio_Branco">Rio Branco</option>
                                                                </select>
                                                            </label>
                                                        </div>

                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Semana e movimento</p>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-500">Controla calendário e animações sensíveis.</p>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant={preferences?.week_starts_on === 1 ? "default" : "outline"}
                                                                    disabled={isSavingPreferences || !preferences}
                                                                    onClick={() => void savePreferences({ week_starts_on: 1 })}
                                                                    className="h-10 rounded-2xl px-4 text-[10px] font-black uppercase tracking-[0.14em]"
                                                                >
                                                                    Segunda
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant={preferences?.week_starts_on === 0 ? "default" : "outline"}
                                                                    disabled={isSavingPreferences || !preferences}
                                                                    onClick={() => void savePreferences({ week_starts_on: 0 })}
                                                                    className="h-10 rounded-2xl px-4 text-[10px] font-black uppercase tracking-[0.14em]"
                                                                >
                                                                    Domingo
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant={preferences?.reduced_motion ? "default" : "outline"}
                                                                    disabled={isSavingPreferences || !preferences}
                                                                    onClick={() => void savePreferences({ reduced_motion: !preferences?.reduced_motion })}
                                                                    className="h-10 rounded-2xl px-4 text-[10px] font-black uppercase tracking-[0.14em]"
                                                                >
                                                                    Reduzir movimento
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-white/5" />

                                                <div>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Sparkles className="h-5 w-5 text-primary" />
                                                        <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Onboarding & Tour</h3>
                                                    </div>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 font-medium">
                                                        Reveja o tour guiado ou reconfigure suas informações iniciais.
                                                    </p>

                                                    <Button
                                                        onClick={handleReplayTour}
                                                        variant="outline"
                                                        className="h-12 px-8 rounded-full bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/15 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/15 font-bold transition-all shadow-xl hover:-translate-y-0.5"
                                                    >
                                                        Reiniciar Tour do Aplicativo
                                                    </Button>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="communication" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10"><CommunicationSettings /></TabsContent>
                                        <TabsContent value="fiscal" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10"><FiscalConfigPanel /></TabsContent>

                                        <TabsContent value="notifications" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10"><NotificationSettings /></TabsContent>

                                        <TabsContent value="payments" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                                            <NeuroNexPayWizard />
                                        </TabsContent>

                                        <TabsContent value="integrations" className="mt-0 animate-in fade-in zoom-in-95 duration-500 relative z-10">
                                            <div className="flex flex-col gap-10 max-w-3xl">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Link2 className="h-5 w-5 text-primary" />
                                                        <h3 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Integrações</h3>
                                                    </div>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                                                        Conecte os aplicativos que fazem parte da rotina clínica e deixe o trabalho repetitivo rodar em segundo plano.
                                                    </p>
                                                </div>

                                                <div className="space-y-6">
                                                    {/* Google Workspace */}
                                                    <div className="p-8 rounded-[40px] bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 group shadow-2xl hover:shadow-primary/5 transition-all relative overflow-hidden backdrop-blur-lg">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl pointer-events-none opacity-40" />
                                                        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
                                                            <div className={cn(
                                                                "w-16 h-16 rounded-[24px] flex items-center justify-center border transition-all duration-700 shadow-xl shrink-0 ring-1 ring-inset",
                                                                isGoogleConnected
                                                                    ? "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/30 ring-primary/15"
                                                                    : "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 ring-transparent"
                                                            )}>
                                                                <GoogleIcon className="h-8 w-8" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Google Workspace</h4>
                                                                    {isGoogleConnected && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">Ativo</span>}
                                                                </div>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium max-w-[200px]">
                                                                    Gmail e Calendar funcionando no automático.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={() => {
                                                                void (isGoogleConnected ? disconnectGoogle() : connectGoogle());
                                                            }}
                                                            disabled={isLoadingGoogleAuth}
                                                            variant={isGoogleConnected ? "outline" : "default"}
                                                            className={cn(
                                                                "h-10 px-6 rounded-xl text-[10px] font-bold uppercase tracking-wider w-full md:w-auto transition-all",
                                                                isGoogleConnected
                                                                    ? "bg-transparent border-white/20 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 shadow-xl"
                                                                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/30 hover:-translate-y-0.5"
                                                            )}
                                                        >
                                                            {isGoogleConnected ? "Desconectar" : "Conectar"}
                                                        </Button>
                                                    </div>

                                                    {/* Todoist */}
                                                    <div className="p-8 rounded-[40px] bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 group shadow-2xl hover:shadow-red-500/5 transition-all relative overflow-hidden backdrop-blur-lg">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl pointer-events-none opacity-40" />
                                                        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
                                                            <div className={cn(
                                                                "w-16 h-16 rounded-[24px] flex items-center justify-center border transition-all duration-700 shadow-2xl shrink-0 ring-1 ring-inset",
                                                                isTodoistConnected
                                                                    ? "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/30 ring-red-500/15"
                                                                    : "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 ring-transparent"
                                                            )}>
                                                                <TodoistIcon className="h-8 w-8" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Todoist</h4>
                                                                    {isTodoistConnected && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">Ativo</span>}
                                                                </div>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium max-w-[200px]">
                                                                    Tarefas clínicas, lembretes e follow-ups no lugar certo.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={isTodoistConnected ? disconnectTodoist : connectTodoist}
                                                            disabled={isLoadingTodoistAuth}
                                                            variant={isTodoistConnected ? "outline" : "default"}
                                                            className={cn(
                                                                "h-10 px-6 rounded-xl text-[10px] font-bold uppercase tracking-wider w-full md:w-auto transition-all",
                                                                isTodoistConnected
                                                                    ? "bg-transparent border-white/20 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 shadow-xl"
                                                                    : "bg-zinc-100 hover:bg-white text-zinc-950 shadow-2xl hover:-translate-y-0.5"
                                                            )}
                                                        >
                                                            {isTodoistConnected ? "Desconectar" : "Conectar"}
                                                        </Button>
                                                    </div>

                                                    {/* Notion */}
                                                    <div className="p-8 rounded-[40px] bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/10 flex flex-col md:flex-row items-center justify-between gap-8 group shadow-2xl hover:shadow-stone-500/5 transition-all relative overflow-hidden backdrop-blur-lg">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-stone-500/10 blur-3xl pointer-events-none opacity-40" />
                                                        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
                                                            <div className={cn(
                                                                "w-16 h-16 rounded-[24px] flex items-center justify-center border transition-all duration-700 shadow-2xl shrink-0 ring-1 ring-inset",
                                                                isNotionConnected
                                                                    ? "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/30 ring-stone-500/15"
                                                                    : "bg-zinc-100 dark:bg-zinc-900/50 border-zinc-200 dark:border-white/10 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 ring-transparent"
                                                            )}>
                                                                <NotionIcon className="h-9 w-9 text-zinc-800 dark:text-white" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Notion</h4>
                                                                    {isNotionConnected && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">Ativo</span>}
                                                                </div>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium max-w-[200px]">
                                                                    Páginas, protocolos e bases clínicas sempre por perto.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={isNotionConnected ? disconnectNotion : connectNotion}
                                                            disabled={isLoadingNotionAuth}
                                                            variant={isNotionConnected ? "outline" : "default"}
                                                            className={cn(
                                                                "h-10 px-6 rounded-xl text-[10px] font-bold uppercase tracking-wider w-full md:w-auto transition-all",
                                                                isNotionConnected
                                                                    ? "bg-transparent border-white/20 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 shadow-xl"
                                                                    : "bg-stone-100 hover:bg-white text-stone-950 shadow-2xl hover:-translate-y-0.5"
                                                            )}
                                                        >
                                                            {isNotionConnected ? "Desconectar" : "Conectar"}
                                                        </Button>
                                                    </div>

                                                </div>

                                                <div className="relative overflow-hidden rounded-[40px] border border-zinc-200 dark:border-white/10 bg-white/70 dark:bg-zinc-950/60 p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.35)] dark:shadow-[0_32px_120px_-36px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.65),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.5),transparent_45%)] dark:bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.12),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_45%)] pointer-events-none" />
                                                    <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] items-center">
                                                        <div className="space-y-5">
                                                            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100/80 dark:bg-white/[0.04] px-3 py-1.5">
                                                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Em breve</span>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                                                                    Mais aplicativos essenciais para a clínica.
                                                                </h4>
                                                                <p className="mt-3 max-w-md text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                                                                    Estamos preparando novas conexões para prontuário, comunicação, documentos, tarefas e operações do dia a dia.
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col gap-3 sm:flex-row">
                                                                <input
                                                                    value={integrationSuggestion}
                                                                    onChange={(event) => setIntegrationSuggestion(event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") handleIntegrationSuggestion();
                                                                    }}
                                                                    placeholder="Qual app você quer ver aqui?"
                                                                    className="h-12 flex-1 rounded-2xl border border-zinc-200 bg-white/80 px-4 text-sm font-semibold text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-200/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-white/30 dark:focus:ring-white/10"
                                                                />
                                                                <Button
                                                                    onClick={handleIntegrationSuggestion}
                                                                    className="h-12 rounded-2xl px-6 text-[10px] font-black uppercase tracking-[0.16em] shadow-xl transition-all hover:-translate-y-0.5"
                                                                >
                                                                    Sugerir app
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="relative min-h-[240px] [perspective:900px]">
                                                            <motion.div
                                                                animate={{ rotateX: [58, 52, 58], rotateZ: [-12, -7, -12], y: [0, -8, 0] }}
                                                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                                                                className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[36px] border border-zinc-200 bg-gradient-to-br from-white via-zinc-100 to-zinc-300 shadow-[0_32px_80px_-28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:from-zinc-700 dark:via-zinc-900 dark:to-black dark:shadow-[0_42px_100px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.18)] [transform-style:preserve-3d]"
                                                            >
                                                                <div className="absolute inset-4 rounded-[28px] border border-white/60 bg-white/45 shadow-inner dark:border-white/10 dark:bg-white/[0.03]" />
                                                                <div className="absolute inset-x-10 top-9 h-4 rounded-full bg-zinc-300/80 dark:bg-white/15" />
                                                                <div className="absolute inset-x-12 bottom-11 h-3 rounded-full bg-zinc-400/70 dark:bg-white/10" />
                                                            </motion.div>

                                                            {[
                                                                { label: "CRM", x: "10%", y: "12%", delay: 0 },
                                                                { label: "Docs", x: "68%", y: "10%", delay: 0.6 },
                                                                { label: "Chat", x: "75%", y: "62%", delay: 1.1 },
                                                                { label: "Forms", x: "8%", y: "68%", delay: 1.7 },
                                                            ].map((item) => (
                                                                <motion.div
                                                                    key={item.label}
                                                                    animate={{ y: [0, -10, 0], rotate: [-2, 2, -2] }}
                                                                    transition={{ duration: 4.5, delay: item.delay, repeat: Infinity, ease: "easeInOut" }}
                                                                    className="absolute h-16 w-16 rounded-3xl border border-zinc-200 bg-white/85 p-3 text-center shadow-[0_18px_40px_-22px_rgba(0,0,0,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]"
                                                                    style={{ left: item.x, top: item.y }}
                                                                >
                                                                    <div className="mx-auto mb-2 h-5 w-5 rounded-lg bg-zinc-900/85 dark:bg-white/85" />
                                                                    <span className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{item.label}</span>
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                    </div>
                                </AnimatePresence>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ajustes;
