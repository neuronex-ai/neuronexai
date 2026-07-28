"use client";

// [SWARM] Auditado pelo Agente 1 — Nenhum console.log encontrado
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroVisual } from "@/components/landing/HeroVisual";

export const Hero = () => {
    return (
        <section className="relative w-full flex flex-col items-center justify-start z-10 min-h-screen overflow-hidden bg-background">
            {/* --- MAIN CONTENT LAYER --- */}
            <div className="relative z-10 text-center flex flex-col items-center w-full max-w-6xl mx-auto pt-[16vh] md:pt-[20vh] lg:pt-[23vh] px-4">
                <div className="mb-8 inline-flex min-h-8 items-center gap-2 rounded-full border border-border/35 bg-foreground/[0.03] px-5 py-1.5 backdrop-blur-sm">
                    <span className="text-[11px] font-bold tracking-[0.08em] text-foreground/80">Sistema operacional para psicólogos</span>
                </div>

                <div className="mb-4 md:mb-6 pb-2">
                    <h1 className="text-balance text-[2.6rem] font-bold leading-[1.02] tracking-tight text-foreground sm:text-[3.2rem] md:text-[4rem] lg:text-[5rem]">
                        Todo o seu consultório,
                        <br />
                        em uma única conversa.
                    </h1>
                </div>

                <p className="mb-8 max-w-4xl px-2 text-base font-medium leading-relaxed text-muted-foreground md:mb-10 md:text-xl md:leading-[1.5] lg:mb-12 lg:text-2xl">
                    A primeira plataforma AI-Native da psicologia brasileira. Esqueça a navegação por menus: um sistema inteiro projetado para entender sua intenção e fazer o trabalho pesado por você.
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
                <p className="mt-6 max-w-2xl text-sm font-semibold leading-relaxed text-muted-foreground">
                    Você continua no controle e confirma o que muda.
                </p>
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
