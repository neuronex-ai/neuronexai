"use client";

import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRef } from "react";

import { HeroVisual } from "@/components/landing/HeroVisual";
import { Button } from "@/components/ui/button";

export const HERO_HEADLINE_LINES = [
  "Você cuida dos pacientes.",
  "A NeuroNex organiza o resto.",
] as const;

const scrollToPlans = () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("waitlist")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
};

export const Hero = () => {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 0.42, 0.72], [0, -86, -142]);
  const textScale = useTransform(scrollYProgress, [0, 0.52], [1, 0.84]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.48, 0.72], [1, 0.86, 0]);
  const visualY = useTransform(scrollYProgress, [0, 0.44, 0.86], [34, -42, -86]);
  const visualScale = useTransform(scrollYProgress, [0, 0.5, 0.92], [0.94, 1, 1.035]);
  const visualOpacity = useTransform(scrollYProgress, [0, 0.16], [0.84, 1]);
  const backdropScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <section
      ref={heroRef}
      id="hero"
      aria-labelledby="landing-hero-title"
      className="relative min-h-[168vh] overflow-clip bg-background"
    >
      <div className="sticky top-0 flex min-h-screen flex-col justify-start overflow-hidden pt-24 md:pt-28">
        <motion.div
          aria-hidden="true"
          style={reduceMotion ? undefined : { scale: backdropScale }}
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute left-1/2 top-[-18%] h-[560px] w-[980px] -translate-x-1/2 rounded-full bg-foreground/[0.05] blur-[180px] dark:bg-white/[0.035]" />
          <div className="absolute inset-x-0 bottom-0 h-[34vh] bg-gradient-to-t from-background via-background/88 to-transparent" />
        </motion.div>

        <motion.div
          style={reduceMotion ? undefined : { y: textY, scale: textScale, opacity: textOpacity, willChange: "transform, opacity" }}
          className="relative z-10 mx-auto flex w-full max-w-[1220px] flex-col items-center px-4 text-center sm:px-6"
        >
          <div className="inline-flex min-h-9 items-center rounded-full border border-border/40 bg-foreground/[0.035] px-4 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.045]">
            Sistema operacional para psicólogos
          </div>

          <h1
            id="landing-hero-title"
            className="mt-6 w-[min(94vw,1180px)] text-center font-black tracking-[-0.055em] text-foreground"
          >
            <span className="block whitespace-nowrap text-[clamp(2.55rem,6.05vw,6.15rem)] leading-[0.9]">
              {HERO_HEADLINE_LINES[0]}
            </span>
            <span className="mt-1.5 block whitespace-nowrap text-[clamp(2.05rem,4.95vw,5rem)] leading-[0.92] text-muted-foreground/62">
              {HERO_HEADLINE_LINES[1]}
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-3xl px-2 text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
            Agenda, pacientes, conversas, atendimentos, financeiro, fiscal e as tarefas entre uma consulta e outra passam a se organizar no mesmo lugar, com o Synapse ajudando você a seguir o próximo passo.
          </p>

          <div className="mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild className="h-14 w-full rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-foreground/90 sm:w-auto">
              <Link to="/create-account">
                Começar grátis
                <ChevronRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={scrollToPlans}
              className="h-14 w-full rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em] sm:w-auto"
            >
              Ver planos
            </Button>
          </div>
        </motion.div>

        <motion.div
          style={reduceMotion ? undefined : { y: visualY, scale: visualScale, opacity: visualOpacity, willChange: "transform, opacity" }}
          className="relative z-20 mt-10 pb-12 md:mt-12"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
};
