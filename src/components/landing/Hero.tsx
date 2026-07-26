"use client";

// [SWARM] Auditado pelo Agente 1 — Nenhum console.log encontrado
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/FadeIn";
import { TextReveal } from "@/components/animations/TextReveal";
import { Magnetic } from "@/components/animations/Magnetic";
import { HeroVisual } from "@/components/landing/HeroVisual";

export const Hero = () => {
    return (
        <section className="relative w-full flex flex-col items-center justify-start z-10 min-h-screen overflow-hidden bg-background">
            {/* --- IMMERSIVE BACKGROUND LAYER --- */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.12)_0%,transparent_70%)]" />
                <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-[4]" />
            </div>

            {/* --- MAIN CONTENT LAYER --- */}
            <div className="relative z-10 text-center flex flex-col items-center w-full max-w-6xl mx-auto pt-[16vh] md:pt-[20vh] lg:pt-[23vh] px-4">
                <FadeIn delay={0.3}>
                    <div className="inline-flex items-center gap-2 bg-foreground/[0.03] border border-border/10 rounded-full px-5 py-1.5 mb-8 backdrop-blur-sm">
                        <span className="text-[11px] uppercase tracking-[0.25em] font-black text-foreground/80">Sistema operacional para psicólogos</span>
                    </div>
                </FadeIn>

                <div className="mb-4 md:mb-6 pb-2">
                    <h1 className="text-balance text-[2.6rem] sm:text-[3.2rem] md:text-[4rem] lg:text-[5.8rem] xl:text-[6.2rem] font-bold tracking-tight text-foreground leading-[0.9] md:leading-[0.95] select-none text-center">
                        <TextReveal stagger={0.08}>
                            Sua clínica inteira, organizada por IA.
                        </TextReveal>
                    </h1>
                </div>

                <FadeIn delay={0.6}>
                    <p className="text-base md:text-xl lg:text-2xl text-muted-foreground/70 font-medium max-w-4xl mx-auto leading-relaxed md:leading-[1.5] tracking-tight mb-8 md:mb-10 lg:mb-12 px-2">
                        Prontuário, agenda, teleconsulta, financeiro, NFS-e, portal do paciente e Synapse em uma única experiência para psicólogos.
                    </p>
                </FadeIn>

                <FadeIn delay={0.8} className="w-full">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8 w-full">
                        <Magnetic strength={0.2} className="w-full sm:w-auto">
                            <Button asChild className="group relative overflow-hidden w-full sm:w-auto h-14 sm:h-16 px-8 sm:px-12 rounded-full bg-foreground text-background hover:bg-foreground/90 text-[11px] sm:text-[12px] font-black uppercase tracking-[0.3em] shadow-lg transition-all duration-500 hover:scale-105 active:scale-[0.98] border-0">
                                <Link to="/create-account">
                                    <span className="relative flex items-center">
                                        Começar grátis
                                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2.5 opacity-70 group-hover:translate-x-1.5 transition-transform duration-500 ease-out" />
                                    </span>
                                </Link>
                            </Button>
                        </Magnetic>

                        <Magnetic strength={0.2} className="w-full sm:w-auto">
                            <Button
                                asChild
                                variant="ghost"
                                className="w-full sm:w-auto h-14 sm:h-16 px-6 sm:px-10 rounded-full text-foreground/60 hover:text-foreground hover:bg-transparent text-[11px] sm:text-[12px] font-black uppercase tracking-[0.25em] transition-all duration-500 hover:scale-105 active:scale-[0.98]"
                            >
                                <Link to="/#comparativo">Ver planos</Link>
                            </Button>
                        </Magnetic>
                    </div>
                </FadeIn>
            </div>

            {/* --- 3D HERO VISUAL LAYER --- */}
            <div className="w-full relative z-20 mt-12 md:mt-20 lg:mt-24 xl:mt-32 flex flex-col items-center">
                <div className="w-full relative gpu-accelerated mb-32">
                    <FadeIn delay={0.5} direction="up" distance={80} duration={1.5}>
                        <HeroVisual />
                    </FadeIn>
                </div>
            </div>
        </section>
    );
};
