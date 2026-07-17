"use client";

import { BadgeCheck, ExternalLink, MonitorDown, RefreshCw, ShieldCheck } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/button";

const storeBenefits = [
    { icon: MonitorDown, label: "Instalação pela Microsoft Store" },
    { icon: RefreshCw, label: "Versão sincronizada com a NeuroNex" },
    { icon: ShieldCheck, label: "Acesso com sua conta NeuroNex" },
];

export const DesktopAppCTA = () => {
    return (
        <section id="downloads" className="public-section-stage relative overflow-hidden bg-background px-6 py-24 md:py-32">
            <div className="pointer-events-none absolute inset-0 premium-noise opacity-[0.03]" />

            <div className="relative z-10 mx-auto max-w-[1120px]">
                <div className="overflow-hidden rounded-[48px] border border-border/50 bg-card/40 px-8 py-14 text-center shadow-premium backdrop-blur-xl md:px-20 md:py-24">
                    <FadeIn delay={0.1}>
                        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-foreground/[0.04] px-4 py-2">
                            <BadgeCheck aria-hidden="true" className="h-4 w-4 text-foreground/65" />
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-foreground/60">
                                Disponível na Microsoft Store
                            </span>
                        </div>
                    </FadeIn>

                    <FadeIn delay={0.15}>
                        <h2 className="mx-auto max-w-4xl text-5xl font-bold leading-[0.9] tracking-[-0.055em] text-foreground md:text-8xl">
                            NeuroNex AI no Windows.
                        </h2>
                    </FadeIn>

                    <FadeIn delay={0.2}>
                        <p className="mx-auto mt-8 max-w-2xl text-lg font-medium leading-relaxed text-muted-foreground md:text-xl">
                            A NeuroNex AI já está disponível para instalação pela Microsoft Store. Instale o aplicativo e acesse sua rotina clínica com sua conta e seus dados sincronizados.
                        </p>
                    </FadeIn>

                    <div className="mx-auto mt-12 grid max-w-4xl gap-3 text-left md:grid-cols-3">
                        {storeBenefits.map(({ icon: Icon, label }, index) => (
                            <FadeIn key={label} delay={0.25 + index * 0.05}>
                                <div className="flex min-h-20 items-center gap-3 rounded-2xl border border-border/50 bg-foreground/[0.025] px-5 py-4">
                                    <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-foreground/65" />
                                    <span className="text-sm font-semibold leading-snug text-foreground/75">{label}</span>
                                </div>
                            </FadeIn>
                        ))}
                    </div>

                    <FadeIn delay={0.45} className="mt-10 flex flex-col items-center gap-3">
                        <Button asChild size="lg" className="public-tactile h-14 rounded-full px-7 text-sm font-bold">
                            <a
                                href="https://apps.microsoft.com/detail/9PKGGSPS44CD?hl=pt-BR&gl=BR"
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Encontrar NeuroNex AI na Microsoft Store"
                            >
                                Encontrar na Microsoft Store
                                <ExternalLink aria-hidden="true" className="ml-2 h-4 w-4" />
                            </a>
                        </Button>
                        <p className="text-xs font-medium text-muted-foreground/65">
                            Na loja, procure por “NeuroNex AI”.
                        </p>
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};
