"use client";

// [SWARM] Auditado pelo Agente 1 — Nenhum console.log encontrado
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/FadeIn";
import { Magnetic } from "@/components/animations/Magnetic";
import { HeroVisual } from "@/components/landing/HeroVisual";

export const Hero = () => {
    const heroRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"],
    });
    const reduceMotion = useReducedMotion();

    const heroTextY = useTransform(scrollYProgress, [0, 0.32, 0.68], [0, -12, -92]);
    const heroTextScale = useTransform(scrollYProgress, [0, 0.34, 0.7], [1, 0.995, 0.965]);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.36, 0.68], [1, 1, 0]);
    const visualY = useTransform(scrollYProgress, [0, 0.34, 0.72, 1], [54, 0, -38, -88]);
    const visualScale = useTransform(scrollYProgress, [0, 0.36, 0.72, 1], [0.94, 1, 0.88, 0.78]);
    const visualOpacity = useTransform(scrollYProgress, [0, 0.7, 0.92, 1], [1, 1, 0.72, 0.16]);
    const bgScale = useTransform(scrollYProgress, [0, 1], [1.04, 1.14]);

    return (
        <section ref={heroRef} className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start overflow-hidden bg-background">
            {/* --- IMMERSIVE BACKGROUND LAYER --- */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <motion.div
                    style={reduceMotion ? undefined : { scale: bgScale }}
                    className="relative w-full h-full will-change-transform"
                >
                </motion.div>

                <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_40%,hsl(var(--primary)/0.12)_0%,transparent_70%)]" />
                <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.05)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none z-[4]" />
            </div>

            {/* --- MAIN CONTENT LAYER --- */}
            <motion.div
                style={reduceMotion ? undefined : { y: heroTextY, scale: heroTextScale, opacity: heroOpacity, willChange: "transform, opacity" }}
                className="relative z-10 mx-auto flex w-full max-w-[94vw] flex-col items-center px-4 pt-[13vh] text-center md:pt-[15vh] lg:pt-[17vh]"
            >
                <FadeIn delay={0.3}>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/10 bg-foreground/[0.03] px-5 py-1.5 backdrop-blur-sm md:mb-6">
                        <span className="text-[11px] uppercase tracking-[0.25em] font-black text-foreground/80">Sistema operacional para psicólogos</span>
                    </div>
                </FadeIn>

                <motion.h1
                    initial={reduceMotion ? false : { opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-4 text-center text-[clamp(2.6rem,6vw,5.6rem)] font-bold leading-[0.94] tracking-[-0.06em] text-foreground"
                >
                    <span className="block md:whitespace-nowrap">Você cuida dos pacientes.</span>
                    <span className="mt-1 block text-muted-foreground/52 md:whitespace-nowrap">A NeuroNex organiza o resto.</span>
                </motion.h1>

                <FadeIn delay={0.6}>
                    <p className="mx-auto mb-6 max-w-3xl px-2 text-sm font-medium leading-relaxed tracking-tight text-muted-foreground/70 sm:text-base md:mb-7 md:text-lg lg:text-xl">
                        Agenda, pacientes, conversas, atendimentos, financeiro, fiscal e as tarefas entre uma consulta e outra passam a se organizar no mesmo lugar, com o Synapse ajudando você a seguir o próximo passo.
                    </p>
                </FadeIn>

                <FadeIn delay={0.8} className="w-full">
                    <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
                        <Magnetic strength={0.2} className="w-full sm:w-auto">
                            <Button asChild className="group relative h-12 w-full overflow-hidden rounded-full border-0 bg-foreground px-8 text-[10px] font-black uppercase tracking-[0.27em] text-background shadow-lg transition-all duration-500 hover:scale-[1.03] hover:bg-foreground/90 active:scale-[0.98] sm:h-14 sm:w-auto sm:px-10 sm:text-[11px]">
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
                                type="button"
                                variant="ghost"
                                onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
                                className="h-12 w-full rounded-full border border-border/10 px-7 text-[10px] font-black uppercase tracking-[0.23em] text-foreground/70 backdrop-blur-xl transition-all duration-500 hover:scale-[1.03] hover:border-primary/20 hover:bg-foreground/5 hover:text-foreground active:scale-[0.98] sm:h-14 sm:w-auto sm:px-9 sm:text-[11px]"
                            >
                                Ver planos
                            </Button>
                        </Magnetic>
                    </div>
                </FadeIn>
            </motion.div>

            {/* --- 3D HERO VISUAL LAYER --- */}
            <div className="relative z-20 mt-8 flex w-full flex-col items-center md:mt-10 lg:mt-12">
                <motion.div style={reduceMotion ? undefined : { y: visualY, scale: visualScale, opacity: visualOpacity }} className="gpu-accelerated relative mb-24 w-full origin-top md:mb-28">
                    <FadeIn delay={0.5} direction="up" distance={80} duration={1.5}>
                        <HeroVisual />
                    </FadeIn>
                </motion.div>
            </div>
        </section>
    );
};
