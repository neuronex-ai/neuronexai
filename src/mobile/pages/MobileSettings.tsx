"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { useTour } from "@/components/onboarding/TourContext";
import { FiscalConfigPanel } from "@/components/settings/FiscalConfigPanel";
import { MobileNeuroFinanceAccountStatusPanel } from "@/apps/professional-mobile/neurofinance/components/MobileNeuroFinanceAccountStatusPanel";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ProfessionalProfileForm } from "@/components/settings/ProfessionalProfileForm";
import { SecuritySettingsPanel } from "@/components/settings/SecuritySettingsPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSubscription } from "@/context/SubscriptionContext";
import { useGoogleAuth } from "@/hooks/use-google-auth";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
    ArrowLeft,
    Bell,
    Building,
    ChevronRight,
    CreditCard,
    Loader2,
    LogOut,
    Mail,
    MessageSquare,
    Monitor,
    Moon,
    Shield,
    Smartphone,
    Sparkles,
    Sun,
    User,
    Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import "@/styles/mobile-settings-premium.css";
import {
    MobileActionListItem,
    MobilePageScaffold,
    MobileSectionHeader,
    MobileStatusBanner,
} from "../components/MobilePagePrimitives";

type SettingsView =
    | "main"
    | "profile"
    | "security"
    | "subscription"
    | "prefs"
    | "payments"
    | "notifications"
    | "google"
    | "communication"
    | "fiscal";

type MenuItem = {
    value: SettingsView;
    label: string;
    description: string;
    icon?: LucideIcon;
    customIcon?: ReactNode;
};

const VARIABLE_MAP = {
    "{{patientName}}": "[Nome]",
    "{{date}}": "[Data]",
    "{{time}}": "[Hora]",
    "{{confirmationLink}}": "[Link]",
    "{{amount}}": "[Valor]",
    "{{therapistName}}": "[Terapeuta]",
};

const REVERSE_VARIABLE_MAP = Object.fromEntries(
    Object.entries(VARIABLE_MAP).map(([full, short]) => [short, full]),
);

const VARIABLES = ["[Nome]", "[Data]", "[Hora]", "[Link]", "[Valor]", "[Terapeuta]"];

const PRESETS: Record<string, Record<string, string>> = {
    whatsapp: {
        appointment_reminder: "Olá [Nome]!\n\nLembrete da sua consulta em [Data], às [Hora].\n\nConfirme aqui: [Link]",
        payment_reminder: "Olá [Nome]!\n\nExiste uma sessão pendente de pagamento.\nValor: R$ [Valor]\nData: [Data]",
    },
    email: {
        appointment_reminder: "Olá [Nome],\n\nEste é um lembrete do seu agendamento em [Data], às [Hora].\nLink: [Link]\n\nAtenciosamente,\n[Terapeuta]",
        payment_reminder: "Olá [Nome],\n\nIdentificamos uma sessão pendente.\nData: [Data]\nValor: R$ [Valor]\n\nAtenciosamente,\n[Terapeuta]",
    },
    marketing: {
        appointment_reminder: "Olá [Nome]! Sua consulta será em [Data], às [Hora].",
        payment_reminder: "Olá [Nome]! Há um pagamento pendente no valor de R$ [Valor].",
    },
};

const toEditorTemplate = (body: string) => {
    let result = body;
    Object.entries(VARIABLE_MAP).forEach(([full, short]) => {
        result = result.split(full).join(short);
    });
    return result;
};

const premiumSurfaceClass = "border border-black/[0.055] bg-[#f8f8f6] shadow-[0_24px_72px_-52px_rgba(0,0,0,0.58)] dark:border-black/80 dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.13),transparent_34%),linear-gradient(145deg,#050505_0%,#171717_48%,#030303_100%)] dark:shadow-[0_28px_84px_-58px_rgba(255,255,255,0.22)]";
const premiumPanelClass = "border border-black/[0.045] bg-[linear-gradient(160deg,#ffffff_0%,#f4f3ef_52%,#ebe9e3_100%)] text-[#171514] dark:border-white/[0.06] dark:bg-[linear-gradient(160deg,#2a2727_0%,#201e1e_52%,#161414_100%)] dark:text-white";

const SettingsPanel = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={cn("mobile-settings-embedded min-w-0 overflow-hidden rounded-[30px] p-3", premiumPanelClass, className)}>
        {children}
    </div>
);

const SettingsHero = ({ logoSrc, profileName }: { logoSrc: string; profileName?: string | null }) => (
    <section className={cn("relative overflow-hidden rounded-[34px] px-6 pb-7 pt-6 text-center", premiumSurfaceClass)}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-white/82 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.8)] dark:bg-black/34">
            <img src={logoSrc} alt="NeuroNex" className="h-10 w-10 object-contain" />
        </div>
        <p className="mt-6 text-[8px] font-black uppercase tracking-[0.24em] text-current/42">Centro NeuroNex</p>
        <h1 className="mx-auto mt-2 max-w-[14rem] text-[2.35rem] font-black leading-[0.88] tracking-[-0.06em] text-current">
            Ajustes
        </h1>
        <p className="mx-auto mt-4 max-w-[17rem] text-[11px] font-semibold leading-relaxed text-current/55">
            {profileName ? `${profileName}, organize conta, seguranca e integracoes em um unico lugar.` : "Conta, seguranca e integracoes com uma experiencia mais limpa."}
        </p>
    </section>
);

const SubviewHeader = ({ title, description, onBack, logoSrc }: { title: string; description?: string; onBack: () => void; logoSrc?: string }) => (
    <header className={cn("relative mb-4 overflow-hidden rounded-[32px] px-5 pb-6 pt-5 text-center", premiumSurfaceClass)}>
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onBack}
            className="absolute left-4 top-4 h-11 w-11 rounded-[16px] border-black/[0.065] bg-white/72 text-current shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.055]"
        >
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Voltar</span>
        </Button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[21px] bg-white/82 dark:bg-black/34">
            <img
                src={logoSrc || (typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "/favicon-light.png" : "/favicon-dark.png")}
                alt="NeuroNex"
                className="h-8 w-8 object-contain"
            />
        </div>
        <p className="mt-5 text-[8px] font-black uppercase tracking-[0.22em] text-current/42">Ajustes</p>
        <h1 className="mx-auto mt-2 max-w-[16rem] text-[2rem] font-black leading-[0.9] tracking-[-0.055em] text-current">
            {title}
        </h1>
        {description ? (
            <p className="mx-auto mt-3 max-w-[18rem] text-[11px] font-semibold leading-relaxed text-current/55">
                {description}
            </p>
        ) : null}
    </header>
);

const CustomMenuItem = ({ item, onClick }: { item: MenuItem; onClick: () => void }) => {
    const rowClass = "group flex min-h-[76px] w-full items-center gap-3 px-4 py-3.5 text-left transition duration-200 active:scale-[0.992] active:bg-black/[0.035] dark:active:bg-white/[0.045]";

    if (item.icon) {
        const Icon = item.icon;
        return (
            <button type="button" onClick={onClick} className={rowClass}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-black/[0.045] text-current transition group-active:scale-95 dark:bg-white/[0.075]">
                    <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black tracking-[-0.012em] text-current">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-relaxed text-current/48">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-current/24 transition group-active:translate-x-0.5" />
            </button>
        );
    }

    return (
        <button type="button" onClick={onClick} className={rowClass}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-white shadow-sm transition group-active:scale-95">
                {item.customIcon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black tracking-[-0.012em] text-current">{item.label}</p>
                <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-relaxed text-current/48">{item.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-current/24 transition group-active:translate-x-0.5" />
        </button>
    );
};

export const MobileSettings = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme, transitionToTheme, isTransitioning } = useTheme();
    const { startTour } = useTour();
    const { canAccess } = useSubscription();
    const { data: profile } = useProfile();
    const { isConnected: isGoogleConnected, isLoading: googleLoading, connectGoogle, disconnectGoogle } = useGoogleAuth();
    const { preferences, updatePreferences, isSaving: preferencesSaving } = useUserPreferences();

    const [view, setView] = useState<SettingsView>("main");
    const [communicationChannel, setCommunicationChannel] = useState("whatsapp");
    const [communicationType, setCommunicationType] = useState("appointment_reminder");
    const [communicationTemplate, setCommunicationTemplate] = useState("");
    const [communicationLoading, setCommunicationLoading] = useState(false);

    const professionalPlan = canAccess("advanced_finance");
    const isDarkTheme = theme === "dark";
    const logoSrc = isDarkTheme ? "/favicon-light.png" : "/favicon-dark.png";
    const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    const reducedMotion = Boolean(preferences?.reduced_motion);
    const pageTransition = reducedMotion
        ? { duration: 0.01 }
        : { type: "spring" as const, stiffness: 330, damping: 34, mass: 0.82 };

    useEffect(() => {
        if (!user || view !== "communication") return;
        let cancelled = false;

        const loadTemplate = async () => {
            setCommunicationLoading(true);
            const fallback = PRESETS[communicationChannel]?.[communicationType] || "";
            const { data, error } = await supabase
                .from("communication_templates")
                .select("body_html")
                .eq("user_id", user.id)
                .eq("template_key", `${communicationChannel}_${communicationType}`)
                .maybeSingle();

            if (cancelled) return;
            setCommunicationTemplate(error || !data?.body_html ? fallback : toEditorTemplate(data.body_html));
            setCommunicationLoading(false);
        };

        void loadTemplate();
        return () => {
            cancelled = true;
        };
    }, [communicationChannel, communicationType, user, view]);

    const savePreferences = async (updates: Parameters<typeof updatePreferences>[0]) => {
        try {
            await updatePreferences(updates);
            toast.success("Preferência salva.");
        } catch {
            toast.error("Não foi possível salvar a preferência.");
        }
    };

    const saveCommunication = async () => {
        if (!user) return;
        setCommunicationLoading(true);
        let databaseBody = communicationTemplate;
        Object.entries(REVERSE_VARIABLE_MAP).forEach(([short, full]) => {
            databaseBody = databaseBody.split(short).join(full);
        });

        try {
            const { error } = await supabase.from("communication_templates").upsert({
                user_id: user.id,
                template_key: `${communicationChannel}_${communicationType}`,
                subject: "Mensagem",
                body_html: databaseBody,
            }, { onConflict: "user_id, template_key" });
            if (error) throw error;
            toast.success("Modelo salvo.");
        } catch {
            toast.error("Não foi possível salvar o modelo.");
        } finally {
            setCommunicationLoading(false);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        navigate("/auth");
    };

    /* Removed legacy menuGroups; refinedMenuGroups is the active settings navigation.
    const menuGroups: Array<{ title: string; items: MenuItem[] }> = [
        {
            title: "Conta",
            items: [
                { value: "profile", label: "Perfil profissional", description: "Dados pessoais, registro e apresentação.", icon: User },
                { value: "security", label: "Segurança e privacidade", description: "Senha, sessões e controles de acesso.", icon: Shield },
                { value: "subscription", label: "Plano e assinatura", description: "Recursos disponíveis no plano atual.", icon: CreditCard },
            ],
        },
        {
            title: "Sistema",
            items: [
                { value: "prefs", label: "Aparência e interface", description: "Tema, densidade, idioma e movimento.", icon: Monitor },
                { value: "notifications", label: "Alertas e notificações", description: "Escolha quais avisos deseja receber.", icon: Bell },
                { value: "google", label: "Google Sync", description: "Sincronização de agenda e serviços Google.", customIcon: <GoogleIcon className="h-5 w-5" /> },
                { value: "communication", label: "Modelos de mensagem", description: "Lembretes e cobranças reutilizáveis.", icon: MessageSquare },
            ],
        },
        {
            title: "Clínica e financeiro",
            items: [
                { value: "payments", label: "NeuroFinance", description: "Status da conta e acesso às operações.", icon: Wallet },
                { value: "fiscal", label: "Configuração fiscal", description: "Dados utilizados na emissão fiscal.", icon: Building },
            ],
        },
    ];

    */
    const refinedMenuGroups: Array<{ title: string; items: MenuItem[] }> = [
        {
            title: "Conta",
            items: [
                { value: "profile", label: "Perfil profissional", description: "Identidade, CRP e dados publicos.", icon: User },
                { value: "security", label: "Login e seguranca", description: "Biometria, senha, MFA e PIN.", icon: Shield },
                { value: "subscription", label: "Plano", description: "Assinatura e recursos ativos.", icon: CreditCard },
            ],
        },
        {
            title: "Sistema",
            items: [
                { value: "prefs", label: "Interface", description: "Tema, idioma, fuso e movimento.", icon: Monitor },
                { value: "notifications", label: "Notificacoes", description: "E-mail, app e push nativo.", icon: Bell },
                { value: "google", label: "Google Sync", description: "Agenda e servicos conectados.", customIcon: <GoogleIcon className="h-5 w-5" /> },
                { value: "communication", label: "Mensagens", description: "Modelos para lembretes e cobrancas.", icon: MessageSquare },
            ],
        },
        {
            title: "Clinica e financeiro",
            items: [
                { value: "payments", label: "NeuroFinance", description: "Conta, status e operacoes.", icon: Wallet },
                { value: "fiscal", label: "Fiscal", description: "Dados para emissao fiscal.", icon: Building },
            ],
        },
    ];
    const MobilePageHeader = (_props: { eyebrow?: string; title: string; description?: string }) => (
        <SettingsHero logoSrc={logoSrc} profileName={profileName} />
    );

    return (
        <MobilePageScaffold
            showBottomNavigation={view === "main"}
            className="mobile-settings-premium-shell"
            contentClassName="mobile-settings-premium-content pt-3"
        >
            <AnimatePresence mode="wait" initial={false}>
                {view === "main" ? (
                    <motion.div
                        key="settings-main"
                        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                        transition={pageTransition}
                        className="mobile-settings-main space-y-5"
                    >
                        <MobilePageHeader
                            eyebrow="Centro de controle"
                            title="Ajustes"
                            description="Preferências da conta, da clínica e das integrações."
                        />

                        <div className="space-y-5 pb-2">
                            {refinedMenuGroups.map((group) => (
                                <section key={group.title} className="space-y-2">
                                    <div className="px-2 text-center">
                                        <MobileSectionHeader title={group.title} className="justify-center text-center [&>div]:mx-auto" />
                                    </div>
                                    <div className={cn("mobile-settings-group overflow-hidden rounded-[28px]", premiumPanelClass)}>
                                        {group.items.map((item) => (
                                            <CustomMenuItem key={item.value} item={item} onClick={() => setView(item.value)} />
                                        ))}
                                    </div>
                                </section>
                            ))}

                            <section className="space-y-2.5">
                                <MobileSectionHeader title="Sessão" />
                                <MobileActionListItem
                                    icon={LogOut}
                                    title="Encerrar sessão"
                                    description="Sair desta conta neste dispositivo."
                                    onClick={logout}
                                    destructive
                                />
                            </section>

                            <p className="pb-2 text-center text-[7px] font-black uppercase tracking-[0.18em] text-muted-foreground/35">NeuroNex Professional</p>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key={view}
                        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: 0.985 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -12, scale: 0.99 }}
                        transition={pageTransition}
                        className="mobile-settings-subview pb-2"
                    >
                        {view === "profile" ? (
                            <>
                                <SubviewHeader title="Perfil profissional" description="Dados usados na sua conta e documentos." onBack={() => setView("main")} logoSrc={logoSrc} />
                                <SettingsPanel><ProfessionalProfileForm /></SettingsPanel>
                            </>
                        ) : null}

                        {view === "security" ? (
                            <>
                                <SubviewHeader title="Segurança" description="Proteção da conta e sessões conectadas." onBack={() => setView("main")} />
                                <SettingsPanel><SecuritySettingsPanel /></SettingsPanel>
                            </>
                        ) : null}

                        {view === "notifications" ? (
                            <>
                                <SubviewHeader title="Notificações" description="Configure os alertas que fazem sentido para sua rotina." onBack={() => setView("main")} />
                                <SettingsPanel><NotificationSettings /></SettingsPanel>
                            </>
                        ) : null}

                        {view === "fiscal" ? (
                            <>
                                <SubviewHeader title="Fiscal" description="Dados usados em documentos e emissões fiscais." onBack={() => setView("main")} />
                                <SettingsPanel><FiscalConfigPanel /></SettingsPanel>
                            </>
                        ) : null}

                        {view === "subscription" ? (
                            <>
                                <SubviewHeader title="Plano e assinatura" description="Resumo dos recursos disponíveis para esta conta." onBack={() => setView("main")} />
                                <div className="space-y-3">
                                    <section className="rounded-[22px] border border-foreground bg-foreground p-5 text-background">
                                        <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-50">Plano atual</p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.045em]">{professionalPlan ? "Profissional" : "Essencial"}</h2>
                                        <p className="mt-3 text-xs font-medium leading-relaxed opacity-65">
                                            {professionalPlan ? "Recursos financeiros e avançados estão habilitados para esta conta." : "Os recursos essenciais de gestão clínica permanecem disponíveis."}
                                        </p>
                                    </section>
                                    <MobileStatusBanner variant="info" title="Cobrança protegida" description="Alterações de pagamento não são simuladas no aplicativo. Consulte o suporte ou o portal de cobrança quando precisar mudar o plano." />
                                </div>
                            </>
                        ) : null}

                        {view === "payments" ? (
                            <>
                                <SubviewHeader title="NeuroFinance" description="Status da conta financeira e acesso às operações." onBack={() => setView("main")} />
                                <MobileNeuroFinanceAccountStatusPanel onOpenNeuroFinance={() => navigate("/financeiro/neurofinance")} />
                            </>
                        ) : null}

                        {view === "prefs" ? (
                            <>
                                <SubviewHeader title="Aparência" description="Tema, densidade e preferências de navegação." onBack={() => setView("main")} />
                                <div className="space-y-4">
                                    <section className="space-y-2">
                                        <MobileSectionHeader title="Tema" />
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {[
                                                { value: "dark", label: "Escuro", icon: Moon },
                                                { value: "light", label: "Claro", icon: Sun },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    aria-pressed={theme === option.value}
                                                    aria-busy={isTransitioning}
                                                    onClick={(event) => theme !== option.value && transitionToTheme(option.value, event)}
                                                    className={cn(
                                                        "rounded-[18px] border p-4 text-left transition-colors",
                                                        theme === option.value
                                                            ? "border-foreground bg-foreground text-background"
                                                            : "border-border/40 bg-card/65 text-foreground dark:border-white/10 dark:bg-white/[0.025]",
                                                    )}
                                                >
                                                    <option.icon className="h-5 w-5" />
                                                    <p className="mt-4 text-[12px] font-black">{option.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="space-y-3 rounded-[20px] border border-border/40 bg-card/65 p-4 dark:border-white/10 dark:bg-white/[0.025]">
                                        <MobileSectionHeader title="Interface" />
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: "comfortable", label: "Normal" },
                                                { value: "compact", label: "Compacta" },
                                            ].map((option) => (
                                                <Button
                                                    key={option.value}
                                                    type="button"
                                                    variant={preferences?.density === option.value ? "default" : "outline"}
                                                    disabled={preferencesSaving || !preferences}
                                                    onClick={() => void savePreferences({ density: option.value as "comfortable" | "compact" })}
                                                    className="h-10 rounded-xl text-[8px] font-black uppercase tracking-[0.11em]"
                                                >
                                                    {option.label}
                                                </Button>
                                            ))}
                                        </div>

                                        <select
                                            value={preferences?.language || "pt-BR"}
                                            disabled={preferencesSaving || !preferences}
                                            onChange={(event) => void savePreferences({ language: event.target.value })}
                                            className="h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm font-bold text-foreground outline-none"
                                        >
                                            <option value="pt-BR">Português (Brasil)</option>
                                            <option value="en-US">English (US)</option>
                                            <option value="es-ES">Español</option>
                                        </select>

                                        <select
                                            value={preferences?.timezone || "America/Sao_Paulo"}
                                            disabled={preferencesSaving || !preferences}
                                            onChange={(event) => void savePreferences({ timezone: event.target.value })}
                                            className="h-11 w-full rounded-xl border border-border/40 bg-background px-3 text-sm font-bold text-foreground outline-none"
                                        >
                                            <option value="America/Sao_Paulo">Fuso: São Paulo</option>
                                            <option value="America/Fortaleza">Fuso: Fortaleza</option>
                                            <option value="America/Manaus">Fuso: Manaus</option>
                                            <option value="America/Rio_Branco">Fuso: Rio Branco</option>
                                        </select>

                                        <div className="grid grid-cols-3 gap-2">
                                            <Button type="button" variant={preferences?.week_starts_on === 1 ? "default" : "outline"} disabled={preferencesSaving || !preferences} onClick={() => void savePreferences({ week_starts_on: 1 })} className="h-10 rounded-xl text-[7px] font-black uppercase">Segunda</Button>
                                            <Button type="button" variant={preferences?.week_starts_on === 0 ? "default" : "outline"} disabled={preferencesSaving || !preferences} onClick={() => void savePreferences({ week_starts_on: 0 })} className="h-10 rounded-xl text-[7px] font-black uppercase">Domingo</Button>
                                            <Button type="button" variant={preferences?.reduced_motion ? "default" : "outline"} disabled={preferencesSaving || !preferences} onClick={() => void savePreferences({ reduced_motion: !preferences?.reduced_motion })} className="h-10 rounded-xl text-[7px] font-black uppercase">Reduzir motion</Button>
                                        </div>
                                    </section>

                                    <Button type="button" variant="outline" onClick={() => { toast.info("Reiniciando tour..."); window.setTimeout(startTour, 250); }} className="h-11 w-full rounded-xl text-[8px] font-black uppercase tracking-[0.11em]">
                                        <Sparkles className="mr-2 h-4 w-4" /> Reiniciar tour
                                    </Button>
                                </div>
                            </>
                        ) : null}

                        {view === "communication" ? (
                            <>
                                <SubviewHeader title="Modelos de mensagem" description="Edite textos reutilizáveis sem enviar nada automaticamente." onBack={() => setView("main")} />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-border/40 bg-foreground/[0.025] p-1 dark:border-white/10">
                                        {[
                                            { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                                            { value: "email", label: "E-mail", icon: Mail },
                                            { value: "marketing", label: "SMS", icon: Smartphone },
                                        ].map((option) => (
                                            <button key={option.value} type="button" onClick={() => setCommunicationChannel(option.value)} className={cn("flex min-h-10 items-center justify-center gap-1 rounded-[12px] text-[7px] font-black uppercase tracking-[0.08em]", communicationChannel === option.value ? "bg-foreground text-background" : "text-muted-foreground")}>
                                                <option.icon className="h-3.5 w-3.5" /> {option.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: "appointment_reminder", label: "Lembrete" },
                                            { value: "payment_reminder", label: "Cobrança" },
                                        ].map((option) => (
                                            <Button key={option.value} type="button" variant={communicationType === option.value ? "default" : "outline"} onClick={() => setCommunicationType(option.value)} className="h-10 rounded-xl text-[8px] font-black uppercase tracking-[0.1em]">
                                                {option.label}
                                            </Button>
                                        ))}
                                    </div>

                                    <Textarea
                                        value={communicationTemplate}
                                        onChange={(event) => setCommunicationTemplate(event.target.value)}
                                        disabled={communicationLoading}
                                        className="min-h-[210px] resize-none rounded-[18px] border-border/40 bg-card/65 p-4 text-sm leading-relaxed dark:border-white/10 dark:bg-white/[0.025]"
                                        placeholder="Escreva o modelo de mensagem..."
                                    />

                                    <div className="flex flex-wrap gap-1.5">
                                        {VARIABLES.map((variable) => (
                                            <button key={variable} type="button" onClick={() => setCommunicationTemplate((current) => `${current}${current ? " " : ""}${variable}`)} className="rounded-full border border-border/40 bg-card/65 px-3 py-2 text-[8px] font-black text-muted-foreground dark:border-white/10 dark:bg-white/[0.025]">
                                                {variable}
                                            </button>
                                        ))}
                                    </div>

                                    <Button type="button" onClick={saveCommunication} disabled={communicationLoading} className="h-12 w-full rounded-[15px] text-[8px] font-black uppercase tracking-[0.12em]">
                                        {communicationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar modelo"}
                                    </Button>
                                </div>
                            </>
                        ) : null}

                        {view === "google" ? (
                            <>
                                <SubviewHeader title="Google Sync" description="Sincronização da agenda com sua conta Google." onBack={() => setView("main")} />
                                <div className="space-y-3">
                                    <section className="rounded-[22px] border border-border/40 bg-card/68 p-5 text-center dark:border-white/10 dark:bg-white/[0.025]">
                                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-white shadow-sm">
                                            <GoogleIcon className="h-6 w-6" />
                                        </div>
                                        <h2 className="mt-4 text-lg font-black text-foreground">{isGoogleConnected ? "Google conectado" : "Conectar Google"}</h2>
                                        <p className="mt-2 text-[10px] font-medium leading-relaxed text-muted-foreground/68">
                                            {isGoogleConnected ? "A agenda pode ser sincronizada com os serviços autorizados." : "Autorize a integração para sincronizar sua agenda profissional."}
                                        </p>
                                    </section>
                                    {isGoogleConnected ? (
                                        <Button type="button" variant="outline" onClick={() => disconnectGoogle()} disabled={googleLoading} className="h-12 w-full rounded-[15px] text-[8px] font-black uppercase tracking-[0.12em] text-rose-500">
                                            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desconectar Google"}
                                        </Button>
                                    ) : (
                                        <Button type="button" onClick={() => void connectGoogle()} disabled={googleLoading} className="h-12 w-full rounded-[15px] text-[8px] font-black uppercase tracking-[0.12em]">
                                            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar Google"}
                                        </Button>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </motion.div>
                )}
            </AnimatePresence>
        </MobilePageScaffold>
    );
};
