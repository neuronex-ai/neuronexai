"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BrainCircuit, Pause, Play } from "lucide-react";
import {
  type ElementType,
  type FocusEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export type ReflectionSlide = {
  eyebrow: string;
  title: string;
  description: string;
};

type ReflectionCarouselProps = {
  slides: readonly ReflectionSlide[];
  ariaLabel?: string;
  intervalMs?: number;
  autoplay?: boolean;
  reducedMotionBehavior?: "manual" | "instant";
  icon?: ElementType<{ className?: string }>;
  leadingVisual?: ReactNode;
  className?: string;
};

export const ReflectionCarousel = ({
  slides,
  ariaLabel = "Reflexões",
  intervalMs = 5_200,
  autoplay = true,
  reducedMotionBehavior = "manual",
  icon: Icon = BrainCircuit,
  leadingVisual,
  className,
}: ReflectionCarouselProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeSlide, setActiveSlide] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  const safeSlides = useMemo(() => slides.filter(Boolean), [slides]);
  const canAutoplay =
    autoplay &&
    safeSlides.length > 1 &&
    !manualPaused &&
    !interactionPaused &&
    documentVisible &&
    !(prefersReducedMotion && reducedMotionBehavior === "manual");
  const showAutoplayControl =
    autoplay &&
    safeSlides.length > 1 &&
    !(prefersReducedMotion && reducedMotionBehavior === "manual");

  useEffect(() => {
    if (activeSlide < safeSlides.length) return;
    setActiveSlide(0);
  }, [activeSlide, safeSlides.length]);

  useEffect(() => {
    const handleVisibilityChange = () => setDocumentVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!canAutoplay) return;
    const timer = window.setTimeout(
      () => setActiveSlide((current) => (current + 1) % safeSlides.length),
      intervalMs,
    );
    return () => window.clearTimeout(timer);
  }, [activeSlide, canAutoplay, intervalMs, safeSlides.length]);

  if (!safeSlides.length) return null;

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setInteractionPaused(false);
    }
  };

  return (
    <section
      aria-label={ariaLabel}
      aria-roledescription="carrossel"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={handleBlur}
      className={cn(
        "relative overflow-hidden rounded-[42px] border border-border/45 bg-foreground p-6 text-center text-background",
        "shadow-[0_32px_110px_-78px_rgba(0,0,0,0.9)] dark:border-white/[0.08] dark:bg-white dark:text-zinc-950 md:p-10",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_42%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(0,0,0,0.055),transparent_42%,rgba(0,0,0,0.02))]"
      />

      <div className="relative z-10 mx-auto max-w-5xl overflow-hidden">
        <motion.div
          className="flex"
          animate={{ x: `${activeSlide * -100}%` }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
          }
        >
          {safeSlides.map((slide, index) => (
            <div
              key={`${slide.eyebrow}-${index}`}
              aria-hidden={activeSlide !== index}
              className="flex min-h-[220px] min-w-full flex-col items-center justify-center px-4 md:min-h-[260px]"
            >
              {leadingVisual ?? (
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-foreground shadow-sm dark:bg-zinc-950 dark:text-white">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
              )}
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-55">{slide.eyebrow}</p>
              <h2 className="mt-5 max-w-4xl text-3xl font-black leading-[0.96] tracking-tight md:text-5xl">{slide.title}</h2>
              <p className="mx-auto mt-5 max-w-3xl text-sm font-medium leading-relaxed opacity-62 md:text-base">{slide.description}</p>
            </div>
          ))}
        </motion.div>

        <div className="mt-2 flex items-center justify-center gap-1" aria-label="Controles das reflexões">
          {safeSlides.map((slide, index) => (
            <button
              key={`${slide.eyebrow}-control-${index}`}
              type="button"
              onClick={() => setActiveSlide(index)}
              aria-label={`Ir para ${slide.eyebrow}`}
              aria-pressed={activeSlide === index}
              className="group inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/80 dark:focus-visible:ring-zinc-950/80"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none",
                  activeSlide === index
                    ? "w-8 bg-background dark:bg-zinc-950"
                    : "w-2 bg-background/25 group-hover:bg-background/45 dark:bg-zinc-950/25 dark:group-hover:bg-zinc-950/45",
                )}
              />
            </button>
          ))}

          {showAutoplayControl ? (
            <button
              type="button"
              onClick={() => setManualPaused((current) => !current)}
              aria-label={manualPaused ? "Retomar rotação automática" : "Pausar rotação automática"}
              aria-pressed={manualPaused}
              className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-background/10 transition-colors hover:bg-background/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/80 dark:bg-zinc-950/10 dark:hover:bg-zinc-950/18 dark:focus-visible:ring-zinc-950/80"
            >
              {manualPaused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};
