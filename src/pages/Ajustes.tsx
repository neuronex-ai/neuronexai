import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { User, MessageSquare, Building, CreditCard, LogOut, Bell, ChevronRight, Monitor, Moon, Sun, Shield, Wallet, ArrowLeft, Sparkles, Link2, Archive } from "lucide-react";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { NotionIcon } from "@/components/icons/NotionIcon";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Hooks
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useNotionAuth } from "@/hooks/use-notion-auth";
import { useTheme } from "@/hooks/use-theme";
import { useProfile } from "@/hooks/use-profile";
import { useTour } from "@/components/onboarding/TourContext";
import { useAuth } from "@/components/auth/SessionContextProvider";

// Components
import { ProfessionalProfileForm } from "@/components/settings/ProfessionalProfileForm";
import { CommunicationSettings } from "@/components/settings/CommunicationSettings";
import { DataManagementFoundation } from "@/components/settings/DataManagementFoundation";
import { FiscalConfigPanel } from "@/components/settings/FiscalConfigPanel";
import { NeuroNexIDCard } from "@/components/settings/NeuroNexIDCard";
import { NeuroFinanceSettingsPanel } from "@/components/settings/NeuroFinanceSettingsPanel";
import { SubscriptionManagementPanel } from "@/components/settings/SubscriptionManagementPanel";

import { CallbackStatus } from "@/components/integrations/CallbackStatus";
import { supabase } from "@/integrations/supabase/client";

import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SecuritySettingsPanel } from "@/components/settings/SecuritySettingsPanel";

import { useIsMobile } from "@/hooks/use-mobile";
import { MobileSettings } from "@/mobile/pages/MobileSettings";
import { useSubscription } from "@/context/SubscriptionContext";

const getSettingsTab = (search: string) => {
    const requestedTab = new URLSearchParams(search).get('tab') || 'profile';
    if (requestedTab === 'google') return 'integrations';
    if (requestedTab === 'reports' || requestedTab === 'organization') return 'profile';
    return requestedTab;
};

const getPlanLabel = (plan: string) => {
    if (plan === "Essential") return "Essencial";
    if (plan === "Professional") return "Profissional";
    return plan;
};

const Ajustes = () => {
    const isMobile = useIsMobile();
    const shouldReduceMotion = useReducedMotion();
    const { startTour } = useTour();
    const { isConnected: isGoogleConnected, isLoading: isLoadingGoogleAuth, connectGoogle, disconnectGoogle } = useGoogleAuth();
    const { isConnected: isNotionConnected, isLoading: isLoadingNotionAuth, connectNotion, disconnectNotion } = useNotionAuth();
    const { theme, transitionToTheme, isTransitioning } = useTheme();
    const { user } = useAuth();
    const { data: profile } = useProfile();
    const { plan } = useSubscription();

    const location = useLocation();
    const navigate = useNavigate();
    const [callbackStatus, setCallbackStatus] = useState<'success' | 'failure' | null>(null);
    const [callbackMessage, setCallbackMessage] = useState<string | undefined>(undefined);
    const [integrationSuggestion, setIntegrationSuggestion] = useState("");
    const sidebarScrollRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState(() => getSettingsTab(location.search));

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const status = params.get('status') as 'success' | 'failure' | null;

        if (status) {
            setCallbackStatus(status);
            setCallbackMessage(params.get('message') || undefined);
            window.history.replaceState({}, document.title, location.pathname);
        }
    }, [location.pathname, location.search]);

    useEffect(() => {
        setActiveTab(getSettingsTab(location.search));
    }, [location.search]);

    useEffect(() => {
        const keepSelectedVisible = () => {
            const sidebar = sidebarScrollRef.current;
            if (!sidebar) return;
            if (["profile", "security", "subscription"].includes(activeTab)) {
                sidebar.scrollTop = 0;
                return;
            }
            const selectedTab = sidebar.querySelector<HTMLElement>(
                `[data-settings-value="${activeTab}"]`,
            );
            selectedTab?.scrollIntoView({ block: "nearest" });
        };

        keepSelectedVisible();
        window.addEventListener("resize", keepSelectedVisible);
        return () => window.removeEventListener("resize", keepSelectedVisible);
    }, [activeTab]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/auth');
    };

    const handleReplayTour = () => {
        toast.info("Reiniciando apresentação guiada...");
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

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const params = new URLSearchParams(location.search);
        params.delete("status");
        params.delete("message");
        params.set("tab", value);
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    };

    const menuItems = [
        { val: "profile", label: "Meu Perfil", icon: User },
        { val: "security", label: "Login e Segurança", icon: Shield },
        { val: "subscription", label: "Assinatura", icon: CreditCard },
        { val: "prefs", label: "Interface e tour", icon: Monitor },
        { val: "payments", label: "NeuroFinance", icon: Wallet },
        { val: "notifications", label: "Notificações", icon: Bell },
        { val: "integrations", label: "Integrações", icon: Link2 },
        { val: "communication", label: "Comunicação", icon: MessageSquare },
        { val: "fiscal", label: "Dados Fiscais", icon: Building },
        { val: "data-control", label: "Dados e privacidade", icon: Archive },
    ];

    const menuSections = [
        {
            label: "Conta",
            items: menuItems.filter((item) => ["profile", "security", "subscription"].includes(item.val)),
        },
        {
            label: "Experiência",
            items: menuItems.filter((item) => ["prefs", "notifications", "communication"].includes(item.val)),
        },
        {
            label: "Operação",
            items: menuItems.filter((item) => ["payments", "integrations", "fiscal", "data-control"].includes(item.val)),
        },
    ].filter((section) => section.items.length > 0);

    if (isMobile) return <MobileSettings />;
    if (callbackStatus) return <CallbackStatus status={callbackStatus} message={callbackMessage} onClose={() => setCallbackStatus(null)} />;

    return (
        <div className="desktop-lumen-page w-full min-h-screen bg-transparent font-sans selection:bg-primary/20 flex">
            <div className="desktop-content-offset flex-1 pb-24 relative">
                <div className="max-w-[2200px] mx-auto px-5 md:px-7 lg:px-10 xl:px-14 2xl:px-16 relative z-10">
                    <div className="animate-fade-up">
                        <Tabs magnetic value={activeTab} onValueChange={handleTabChange} className="settings-desktop-shell desktop-retina-frame grid min-h-[720px] w-full overflow-hidden rounded-[38px] border border-border/45 md:h-[calc(100vh-var(--desktop-navbar-clearance)-1.5rem)] md:grid-cols-[280px_minmax(0,1fr)]">
                            {/* Sidebar Menu */}
                            <aside className="settings-sidebar-surface flex h-full w-full min-h-0 flex-col overflow-hidden border-b border-border/45 p-4 md:border-b-0 md:border-r md:p-5">
                                <div className="mb-5 border-b border-border/45 px-1 pb-5">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => navigate('/dashboard')}
                                            className="desktop-retina-inset h-10 w-10 shrink-0 rounded-2xl border border-border/45 text-muted-foreground hover:text-foreground"
                                            aria-label="Voltar ao painel"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/65">Configurações</p>
                                            <h1 className="mt-1 truncate text-base font-black tracking-[-0.025em] text-foreground">Ajustes</h1>
                                        </div>
                                    </div>
                                    <div className="desktop-retina-inset mt-4 flex items-center justify-between rounded-2xl border border-border/40 px-3 py-2.5">
                                        <span className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">Plano atual</span>
                                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-foreground">{getPlanLabel(plan)}</span>
                                    </div>
                                </div>
                                <div ref={sidebarScrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                                    <TabsList className="flex h-auto w-full flex-col items-stretch gap-4 overflow-visible bg-transparent p-0">
                                        {menuSections.map((section) => (
                                            <div key={section.label} className="space-y-1">
                                                <p className="px-3 pb-1 pt-2 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">{section.label}</p>
                                                {section.items.map((item) => (
                                                    <TabsTrigger
                                                        key={item.val}
                                                        value={item.val}
                                                        data-settings-value={item.val}
                                                        className={cn(
                                                            "desktop-retina-interactive group relative w-full justify-between px-3 py-2.5 rounded-2xl text-[11px] font-semibold border border-transparent",
                                                            "data-[state=active]:bg-white dark:data-[state=active]:bg-white/[0.075] data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:border-zinc-200 dark:data-[state=active]:border-white/[0.055]",
                                                            "text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.035]"
                                                        )}
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            <span className="desktop-retina-inset flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white dark:border-white/[0.04] dark:bg-black/20">
                                                                <item.icon className="h-3.5 w-3.5 text-zinc-400 dark:text-white/65 group-data-[state=active]:text-foreground" />
                                                            </span>
                                                            {item.label}
                                                        </span>
                                                        <ChevronRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-data-[state=active]:translate-x-0 group-data-[state=active]:opacity-65" />
                                                    </TabsTrigger>
                                                ))}
                                            </div>
                                        ))}
                                    </TabsList>
                                </div>
                                <div className="mt-4 border-t border-zinc-200/60 px-2 pt-4 dark:border-white/[0.045]">
                                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11 rounded-2xl px-3 text-xs font-bold transition-all">
                                        <LogOut className="h-4 w-4" /> Sair da conta
                                    </Button>
                                </div>
                            </aside>

                            <section className="custom-scrollbar h-full min-w-0 overflow-y-auto p-4 md:p-5 lg:p-6">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                                        transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                                        className="settings-detail-surface desktop-retina-panel desktop-retina-form relative min-h-full w-full overflow-hidden rounded-[32px] border border-border/45 bg-card/70 p-6 backdrop-blur-[40px] md:p-8 lg:p-9"
                                    >

                                        <TabsContent value="profile" className="relative z-10 mt-0">
                                            <div className="grid grid-cols-1 gap-7 xl:grid-cols-2 xl:gap-10">
                                                <div className="order-2 lg:order-1">
                                                    <ProfessionalProfileForm />
                                                </div>
                                                <div className="desktop-retina-panel order-1 flex items-center justify-center rounded-[32px] border border-border/45 bg-muted/30 p-5 backdrop-blur-md lg:order-2 md:p-7 dark:bg-white/[0.018]">
                                                    <NeuroNexIDCard profile={profile} />
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="security" className="relative z-10 mt-0"><SecuritySettingsPanel /></TabsContent>

                                        <TabsContent value="subscription" className="relative z-10 mt-0">
                                            <SubscriptionManagementPanel />
                                        </TabsContent>

                                        <TabsContent value="prefs" className="relative z-10 mt-0">
                                            <div className="mx-auto max-w-3xl space-y-8">
                                                <header>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/65">Interface</p>
                                                    <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-foreground">Aparência e apresentação guiada</h2>
                                                    <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
                                                        Escolha o tema da interface ou reveja a apresentação dos recursos principais.
                                                    </p>
                                                </header>

                                                <div className="theme-selector grid gap-4 sm:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        aria-pressed={theme === "dark"}
                                                        aria-busy={isTransitioning}
                                                        onClick={(event) => theme !== "dark" && transitionToTheme("dark", event)}
                                                        className={cn(
                                                            "desktop-retina-panel desktop-retina-interactive group rounded-[28px] border p-5 text-left",
                                                            theme === "dark"
                                                                ? "border-zinc-700 bg-zinc-950 text-white ring-1 ring-zinc-700/60"
                                                                : "border-border/45 bg-card/60 text-foreground",
                                                        )}
                                                    >
                                                        <div className="flex aspect-[1.8/1] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-800 via-zinc-950 to-black shadow-inner">
                                                            <Moon className="h-7 w-7 text-white" />
                                                        </div>
                                                        <p className="mt-4 text-sm font-black">Tema escuro</p>
                                                        <p className="mt-1 text-xs font-medium opacity-60">Contraste confortável para ambientes com pouca luz.</p>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        aria-pressed={theme === "light"}
                                                        aria-busy={isTransitioning}
                                                        onClick={(event) => theme !== "light" && transitionToTheme("light", event)}
                                                        className={cn(
                                                            "desktop-retina-panel desktop-retina-interactive group rounded-[28px] border p-5 text-left",
                                                            theme === "light"
                                                                ? "border-zinc-300 bg-white text-zinc-950 ring-1 ring-zinc-200"
                                                                : "border-border/45 bg-card/60 text-foreground",
                                                        )}
                                                    >
                                                        <div className="flex aspect-[1.8/1] items-center justify-center rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-200 shadow-inner">
                                                            <Sun className="h-7 w-7 text-zinc-950" />
                                                        </div>
                                                        <p className="mt-4 text-sm font-black">Tema claro</p>
                                                        <p className="mt-1 text-xs font-medium opacity-60">Leitura nítida para ambientes bem iluminados.</p>
                                                    </button>
                                                </div>

                                                <section className="desktop-retina-panel flex flex-col gap-5 rounded-[28px] border border-border/45 p-6 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-start gap-4">
                                                        <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/45">
                                                            <Sparkles className="h-4 w-4 text-foreground" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-black text-foreground">Apresentação guiada</h3>
                                                            <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                                                                Reveja os principais caminhos da plataforma quando quiser.
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button onClick={handleReplayTour} variant="outline" className="desktop-retina-interactive h-11 shrink-0 rounded-2xl px-5 font-bold">
                                                        Reiniciar apresentação
                                                    </Button>
                                                </section>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="communication" className="relative z-10 mt-0"><CommunicationSettings /></TabsContent>
                                        <TabsContent value="fiscal" className="relative z-10 mt-0"><FiscalConfigPanel /></TabsContent>

                                        <TabsContent value="notifications" className="relative z-10 mt-0"><NotificationSettings /></TabsContent>

                                        <TabsContent value="payments" className="relative z-10 mt-0">
                                            <NeuroFinanceSettingsPanel />
                                        </TabsContent>

                                        <TabsContent value="data-control" className="relative z-10 mt-0">
                                            <DataManagementFoundation />
                                        </TabsContent>

                                        <TabsContent value="integrations" className="relative z-10 mt-0">
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
                                                    <div className="desktop-retina-panel desktop-retina-interactive p-7 rounded-[30px] bg-zinc-50/50 border border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-8 group relative overflow-hidden backdrop-blur-lg">
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
                                                                    Agenda e e-mail conectados à sua rotina clínica.
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

                                                    {/* Notion */}
                                                    <div className="desktop-retina-panel desktop-retina-interactive p-7 rounded-[30px] bg-zinc-50/50 border border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-8 group relative overflow-hidden backdrop-blur-lg">
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

                                                <div className="desktop-retina-panel relative overflow-hidden rounded-[30px] border border-zinc-200 bg-white/70 p-8 backdrop-blur-2xl">
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
                                                                    placeholder="Qual aplicativo você quer ver aqui?"
                                                                    className="h-12 flex-1 rounded-2xl border border-zinc-200 bg-white/80 px-4 text-sm font-semibold text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-200/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-600 dark:focus:border-white/30 dark:focus:ring-white/10"
                                                                />
                                                                <Button
                                                                    onClick={handleIntegrationSuggestion}
                                                                    className="desktop-retina-interactive h-12 rounded-2xl px-6 text-[10px] font-black uppercase tracking-[0.16em]"
                                                                >
                                                                    Sugerir aplicativo
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="relative min-h-[240px] [perspective:900px]">
                                                            <motion.div
                                                                initial={{ rotateX: 56, rotateZ: -9 }}
                                                                className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[36px] border border-zinc-200 bg-gradient-to-br from-white via-zinc-100 to-zinc-300 shadow-[0_32px_80px_-28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:from-zinc-700 dark:via-zinc-900 dark:to-black dark:shadow-[0_42px_100px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.18)] [transform-style:preserve-3d]"
                                                            >
                                                                <div className="absolute inset-4 rounded-[28px] border border-white/60 bg-white/45 shadow-inner dark:border-white/10 dark:bg-white/[0.03]" />
                                                                <div className="absolute inset-x-10 top-9 h-4 rounded-full bg-zinc-300/80 dark:bg-white/15" />
                                                                <div className="absolute inset-x-12 bottom-11 h-3 rounded-full bg-zinc-400/70 dark:bg-white/10" />
                                                            </motion.div>

                                                            {[
                                                                { label: "Clínica", x: "10%", y: "12%", delay: 0 },
                                                                { label: "Agenda", x: "68%", y: "10%", delay: 0.6 },
                                                                { label: "Mensagens", x: "75%", y: "62%", delay: 1.1 },
                                                                { label: "Formulários", x: "8%", y: "68%", delay: 1.7 },
                                                            ].map((item) => (
                                                                <motion.div
                                                                    key={item.label}
                                                                    initial={{ y: item.delay * -2, rotate: item.delay - 1 }}
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

                                    </motion.div>
                                </AnimatePresence>
                            </section>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ajustes;
