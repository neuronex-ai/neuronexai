"use client";

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/hooks/use-theme";

export const LandingMobileNav = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { theme } = useTheme();
    const shouldReduceMotion = useReducedMotion();

    const faviconSrc = theme === "dark" ? "/favicon-light.png" : "/favicon-dark.png";

    // Eagerly prefetch public pages for instant load on mobile
    useEffect(() => {
        const prefetchPages = () => {
            const prefetchQueue = [
                () => import("@/pages/Index"),
                () => import("@/pages/FinanceLanding"),
                () => import("@/pages/public/NeuroZapLanding"),
            ];
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => {
                    prefetchQueue.forEach((prefetch) => prefetch());
                });
            } else {
                setTimeout(() => {
                    prefetchQueue.forEach((prefetch) => prefetch());
                }, 1000);
            }
        };

        prefetchPages();
    }, []);

    const handleAnchorClick = (target: string) => {
        setIsMenuOpen(false);
        const scrollToTarget = () => document.getElementById(target)?.scrollIntoView({
            behavior: shouldReduceMotion ? "auto" : "smooth",
            block: "start",
        });
        if (location.pathname !== "/") {
            navigate({ pathname: "/", hash: `#${target}` });
            return;
        }
        requestAnimationFrame(() => requestAnimationFrame(scrollToTarget));
    };

    const extendedNavItems = [
        { label: "Início", type: "route", path: "/" },
        { label: "Diferenciais", type: "anchor", target: "diferenciais" },
        { label: "Produto", type: "route", path: "/produto" },
        { label: "Comparar sistemas", type: "route", path: "/comparar" },
        { label: "NeuroFinance", type: "route", path: "/neurofinance" },
        { label: "NeuroZap", type: "route", path: "/neurozap-para-psicologos" },
        { label: "Teleconsulta", type: "route", path: "/teleconsulta-para-psicologos" },
        { label: "Download", type: "route", path: "/download" },
        { label: "Segurança", type: "route", path: "/seguranca-e-etica" },
        { label: "NeuroX", type: "route", path: "/blog" },
        { label: "Novidades", type: "route", path: "/novidades" },
    ];

    return (
        <Dialog open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <motion.header
                initial={shouldReduceMotion ? false : { y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={shouldReduceMotion ? { duration: 0 } : undefined}
                className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-between bg-transparent px-5 py-5 md:hidden"
            >
                <Link to="/" className="flex items-center gap-2.5 rounded-2xl border border-border/20 bg-background/55 px-3 py-2 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.7)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-black/25">
                    <img src={faviconSrc} className="h-7 w-7 object-contain" alt="" aria-hidden="true" />
                    <span className="text-[11px] font-black uppercase tracking-[0.32em] opacity-60">NeuroNex</span>
                </Link>

                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/20 bg-background/55 text-foreground shadow-[0_18px_50px_-38px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all active:scale-95 dark:border-white/10 dark:bg-black/25"
                            aria-label="Abrir menu"
                        >
                            <Menu className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </DialogTrigger>
                </div>
            </motion.header>

            <DialogContent
                showCloseButton={false}
                overlayClassName="bg-transparent backdrop-blur-none md:hidden"
                className="!inset-0 !left-0 !top-0 z-[111] !flex !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-y-auto !rounded-none !border-0 bg-background !p-0 !shadow-none md:hidden motion-reduce:duration-0 motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
            >
                <DialogTitle className="sr-only">Menu de navegação</DialogTitle>
                <DialogDescription className="sr-only">
                    Acesse as áreas públicas da NeuroNex ou entre na plataforma.
                </DialogDescription>

                <div className="relative z-10 flex items-center justify-between border-b border-border/10 p-5 pb-3 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                        <img src={faviconSrc} className="h-7 w-7 object-contain" alt="" aria-hidden="true" />
                        <span className="text-[11px] font-black uppercase tracking-[0.32em] opacity-55">NeuroNex</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <DialogClose asChild>
                            <button
                                type="button"
                                className="flex h-11 w-11 items-center justify-center rounded-full border border-border/20 bg-foreground/[0.035] text-foreground transition-all hover:bg-foreground/[0.05] active:scale-95 dark:border-white/10 dark:bg-white/[0.045]"
                                aria-label="Fechar menu"
                            >
                                <X className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </DialogClose>
                    </div>
                </div>

                <nav aria-label="Navegação principal" className="relative z-10 flex flex-1 flex-col justify-center gap-6 p-8">
                    {extendedNavItems.map((item, i) => (
                        <motion.div
                            key={item.label}
                            initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { delay: i * 0.05 + 0.1, duration: 0.4 }}
                        >
                            {item.type === "anchor" ? (
                                <button
                                    type="button"
                                    onClick={() => handleAnchorClick(item.target!)}
                                    className="block min-h-11 text-left text-4xl font-black leading-none tracking-normal text-foreground/82 transition-all hover:text-foreground active:scale-[0.98]"
                                >
                                    {item.label}
                                </button>
                            ) : (
                                <Link
                                    to={item.path!}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex min-h-11 items-center text-4xl font-black leading-none tracking-normal text-foreground/82 transition-all hover:text-foreground active:scale-[0.98]"
                                >
                                    {item.label}
                                </Link>
                            )}
                        </motion.div>
                    ))}
                </nav>

                <div className="relative z-10 mt-auto space-y-4 border-t border-border/10 p-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] dark:border-white/10">
                    <Button asChild className="h-14 w-full rounded-2xl bg-foreground font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-background shadow-none transition-all active:scale-[0.985]">
                        <Link to="/create-account" onClick={() => setIsMenuOpen(false)}>
                            Começar grátis <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="h-14 w-full rounded-2xl border border-border/30 bg-foreground/[0.035] font-sans text-[10px] font-black uppercase tracking-[0.22em] text-foreground/72 transition-all active:scale-[0.985] dark:border-white/10 dark:bg-white/[0.045]">
                        <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                            Entrar no NeuroNex
                        </Link>
                    </Button>
                    <p className="mt-4 text-center text-[10px] font-semibold uppercase leading-relaxed tracking-[0.1em] text-muted-foreground/55">
                        Seu consultório inteiro, trabalhando junto.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
