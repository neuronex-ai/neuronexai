"use client";

import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const SENSITIVE_ROUTE_ROOTS = [
    "/confirmar-agendamento",
    "/join",
    "/portal",
    "/anamnese-externa",
    "/payment",
] as const;

const isSensitiveRoute = (pathname: string) => SENSITIVE_ROUTE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
);

// Preferences recorded by the current banner. They do not yet provide
// category-by-category technical control over third-party scripts.
interface CookiePreferences {
    essential: boolean;  // Always true because the choice itself must be stored
    analytics: boolean;
    marketing: boolean;
    functional: boolean;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
    essential: true,
    analytics: false,
    marketing: false,
    functional: true,
};

// Helper to set a cookie
const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

// Helper to get a cookie
const getCookie = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
};

// Technical enforcement for third-party tags is a separate integration that
// is still under review. This helper only reports the saved preference.
const reportRecordedPreferences = (preferences: CookiePreferences) => {
    if (preferences.analytics && typeof window !== 'undefined') {
        console.log('[Cookies] Analytics preference recorded');
    }

    if (preferences.marketing && typeof window !== 'undefined') {
        console.log('[Cookies] Marketing preference recorded');
    }

    if (preferences.functional && typeof window !== 'undefined') {
        console.log('[Cookies] Functional preference recorded');
    }
};

export const CookieConsent = () => {
    const { pathname } = useLocation();
    const [isVisible, setIsVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [_preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);

    useEffect(() => {
        // Check if user has already consented
        const consent = getCookie("neuronex-cookie-consent");
        const savedPrefs = getCookie("neuronex-cookie-preferences");

        if (!consent) {
            // Show banner after a short delay
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 2500);
            return () => clearTimeout(timer);
        } else {
            // User has consented before, load their preferences
            if (savedPrefs) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(savedPrefs));
                    setPreferences(parsed);
                    reportRecordedPreferences(parsed);
                } catch (e) {
                    console.error('[Cookies] Failed to parse preferences');
                }
            } else if (consent === "accepted") {
                // Legacy: full acceptance
                const fullPrefs = { essential: true, analytics: true, marketing: true, functional: true };
                setPreferences(fullPrefs);
                reportRecordedPreferences(fullPrefs);
            }
        }
    }, []);

    const handleAcceptAll = () => {
        const fullPrefs: CookiePreferences = {
            essential: true,
            analytics: true,
            marketing: true,
            functional: true,
        };

        // Save consent and preferences
        setCookie("neuronex-cookie-consent", "accepted", 365);
        setCookie("neuronex-cookie-preferences", encodeURIComponent(JSON.stringify(fullPrefs)), 365);

        reportRecordedPreferences(fullPrefs);

        setPreferences(fullPrefs);
        setIsVisible(false);
    };


    const handleDecline = () => {
        const minimalPrefs: CookiePreferences = {
            essential: true,
            analytics: false,
            marketing: false,
            functional: false,
        };

        setCookie("neuronex-cookie-consent", "declined", 365);
        setCookie("neuronex-cookie-preferences", encodeURIComponent(JSON.stringify(minimalPrefs)), 365);

        setPreferences(minimalPrefs);
        setIsVisible(false);
    };

    if (isSensitiveRoute(pathname)) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed bottom-6 left-6 right-6 md:left-auto md:right-10 md:bottom-10 md:max-w-md z-[100] pointer-events-none"
                >
                    <div className="bg-white/95 dark:bg-[#080809]/95 backdrop-blur-3xl border border-zinc-200 dark:border-white/[0.08] rounded-[32px] p-6 md:p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] pointer-events-auto relative overflow-hidden group ring-1 ring-black/5 dark:ring-white/5">
                        <div className="premium-noise opacity-[0.03]" />

                        {/* Top Accent Line */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/20 to-transparent" />

                        <div className="flex flex-col gap-6 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border border-transparent flex items-center justify-center shrink-0 shadow-2xl">
                                    <Cookie className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-widest">Proteção & Dados</h4>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-[0.3em]">Preferências do navegador</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                                    Este aviso registra sua escolha sobre recursos opcionais no navegador. Ele ainda não controla individualmente integrações Google nem garante, por si só, o bloqueio técnico de tags de terceiros; essa gestão está em revisão.
                                </p>

                                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                    <Link to="/politica-de-privacidade" className="hover:text-zinc-900 dark:hover:text-white transition-colors underline decoration-zinc-200 dark:decoration-zinc-800 underline-offset-4">Privacidade</Link>
                                    <span>•</span>
                                    <Link to="/configuracoes-de-cookies" className="hover:text-zinc-900 dark:hover:text-white transition-colors underline decoration-zinc-200 dark:decoration-zinc-800 underline-offset-4">Cookies</Link>
                                </div>

                                {/* Expandable details */}
                                <AnimatePresence>
                                    {showDetails && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.5, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-3 py-6 border-t border-zinc-100 dark:border-white/5">
                                                <div className="flex items-start gap-3">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                        <strong className="text-zinc-900 dark:text-zinc-300">Registro da escolha:</strong> dois cookies da NeuroNex guardam se você aceitou ou recusou e o conjunto de preferências correspondente.
                                                    </p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                        <strong className="text-zinc-900 dark:text-zinc-300">Preferências:</strong> o app também usa armazenamento local para tema e outras escolhas de interface, independentemente deste aviso.
                                                    </p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                        <strong className="text-zinc-900 dark:text-zinc-300">Categorias opcionais:</strong> aceitar ou recusar grava a preferência, mas a aplicação técnica por categoria ainda não é feita por este componente.
                                                    </p>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                                                        <strong className="text-zinc-900 dark:text-zinc-300">Tags de terceiros:</strong> configurações como Google Ads dependem de consentimento e de integração técnica própria, atualmente em revisão.
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="grid gap-2 pt-2 sm:grid-cols-2">
                                    <Button
                                        onClick={handleAcceptAll}
                                        className="h-12 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:scale-[1.02] active:scale-95 font-black text-[10px] uppercase tracking-widest transition-all shadow-xl"
                                    >
                                        Aceitar Tudo
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleDecline}
                                        className="h-12 rounded-2xl border-zinc-200/70 bg-transparent text-zinc-600 dark:border-white/10 dark:text-zinc-300 font-black text-[10px] uppercase tracking-widest"
                                    >
                                        Recusar opcionais
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setShowDetails(!showDetails)}
                                        className="h-11 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-black text-[10px] uppercase tracking-widest transition-all border border-zinc-200/50 dark:border-white/5 sm:col-span-2"
                                        aria-expanded={showDetails}
                                    >
                                        {showDetails ? "Ocultar" : "Detalhes"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
