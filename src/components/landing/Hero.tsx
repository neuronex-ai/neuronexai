"use client";

// [SWARM] Auditado pelo Agente 1 — Nenhum console.log encontrado
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
                <div className="mb-8 inline-flex min-h-8 items-center gap-2 rounded-full border border-border/35 bg-foreground/[0.03] px-5 py-1.5 backdrop-blur-sm">
                    <span className="text-[11px] font-bold tracking-[0.08em] text-foreground/80">Sistema operacional para psicólogos</span>
                </div>

                <div className="mb-4 md:mb-6 pb-2">
                    <h1 className="text-balance text-[2.6rem] sm:text-[3.2rem] md:text-[4rem] lg:text-[5.8rem] xl:text-[6.2rem] font-bold tracking-tight text-foreground leading-[0.9] md:leading-[0.95] select-none text-center">
                        Seu consultório inteiro, trabalhando junto.
                    </h1>
                </div>

                <p className="mb-8 max-w-4xl px-2 text-base font-medium leading-relaxed tracking-tight text-muted-foreground/75 md:mb-10 md:text-xl md:leading-[1.5] lg:mb-12 lg:text-2xl">
                    Agenda, prontuário, pacientes, atendimento, cobranças e inteligência artificial conectados em uma única operação.
                </p>

                <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
                    <Button asChild className="group h-14 w-full rounded-full border-0 bg-foreground px-8 text-[12px] font-bold text-background shadow-lg hover:bg-foreground/90 sm:h-16 sm:w-auto sm:px-12">
                        <Link to="/create-account">
                            Começar grátis
                            <ChevronRight aria-hidden="true" className="ml-2.5 h-5 w-5 opacity-70" />
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="h-14 w-full rounded-full border-border/55 bg-background/45 px-8 text-[12px] font-bold text-foreground backdrop-blur-sm sm:h-16 sm:w-auto sm:px-10"
                    >
                        <a href="#como-funciona">Ver como funciona</a>
                    </Button>
                </div>
            </div>

            {/* --- 3D HERO VISUAL LAYER --- */}
            <div className="w-full relative z-20 mt-12 md:mt-20 lg:mt-24 xl:mt-32 flex flex-col items-center">
                <div className="w-full relative gpu-accelerated mb-32">
                    <HeroVisual />
                </div>
            </div>
        </section>
    );
};
