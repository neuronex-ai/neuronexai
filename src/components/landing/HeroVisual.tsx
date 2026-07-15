"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Mic,
  Network,
  Pause,
  Play,
  ReceiptText,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const SCREENSHOT_ROOT = "/landing/screenshots/desktop/dark";
const NEW_BATCH = `${SCREENSHOT_ROOT}/nova remessa`;
const AUTOPLAY_MS = 6200;

export type ProductDemoSlide = {
  key: string;
  label: string;
  title: string;
  description: string;
  src: string;
  alt: string;
  icon: ElementType<{ className?: string }>;
  voiceAction?: boolean;
};

export const productDemoSlides: ProductDemoSlide[] = [
  {
    key: "clinic-center",
    label: "Central",
    title: "Central da Clínica",
    description: "O dia começa com agenda, pacientes, pendências e sinais operacionais no mesmo ponto de partida.",
    src: `${SCREENSHOT_ROOT}/01-dashboard-command-center-dark.webp`,
    alt: "Central da Clínica da NeuroNex em desktop",
    icon: LayoutDashboard,
  },
  {
    key: "agenda",
    label: "Agenda",
    title: "Agenda",
    description: "Horários, status e mudanças de rotina seguem conectados aos pacientes e próximos passos.",
    src: `${NEW_BATCH}/9-agenda-mensal-dark.webp`,
    alt: "Agenda mensal da NeuroNex",
    icon: CalendarDays,
  },
  {
    key: "patients",
    label: "Pacientes",
    title: "Pacientes e prontuário",
    description: "Histórico, evolução e informações clínicas aparecem sem separar acompanhamento e contexto.",
    src: `${SCREENSHOT_ROOT}/12-paciente-prontuario-historico-dark.webp`,
    alt: "Prontuário de paciente na NeuroNex",
    icon: ClipboardList,
  },
  {
    key: "neuroview",
    label: "NeuroView",
    title: "NeuroView e NeuroBox",
    description: "Mapas e ferramentas visuais ajudam a ler conexões, padrões e fluxos sem sair da rotina.",
    src: `${SCREENSHOT_ROOT}/17-neuroview-2d-visao-de-todas-conexoes-dark.webp`,
    alt: "NeuroView com conexões clínicas",
    icon: Network,
  },
  {
    key: "finance-fiscal",
    label: "Financeiro",
    title: "NeuroFinance e fiscal",
    description: "Cobranças, conta, saldo e dados fiscais permanecem próximos do percurso da sessão.",
    src: `${NEW_BATCH}/08-neurofinance-conta-saldo-dark.webp`,
    alt: "Conta e saldo do NeuroFinance",
    icon: WalletCards,
  },
  {
    key: "synapse-text",
    label: "Texto",
    title: "Synapse por texto",
    description: "A conversa encontra o contexto autorizado e deixa a próxima ação pronta para revisão.",
    src: `${SCREENSHOT_ROOT}/15-synapse-chat-dark.webp`,
    alt: "Synapse por texto na NeuroNex",
    icon: Sparkles,
  },
  {
    key: "synapse-voice",
    label: "Voz",
    title: "Synapse por voz executando uma ação",
    description: "A fala vira navegação visível, contexto encontrado e ação registrada no painel correto.",
    src: `${SCREENSHOT_ROOT}/16-synapse-voz-dark.webp`,
    alt: "Synapse por voz na NeuroNex",
    icon: Mic,
    voiceAction: true,
  },
];

const voiceTranscript = "Synapse, abra o NeuroView da Mariana e destaque o que devo revisar antes da sessão.";

function VoiceActionOverlay({ active }: { active: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-4 sm:p-6">
      <AnimatePresence>
        {active ? (
          <motion.div
            key="voice-action"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[390px] rounded-[26px] border border-white/14 bg-black/72 p-4 text-white shadow-[0_26px_80px_-36px_rgba(0,0,0,1)] backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white text-zinc-950">
                <Mic aria-hidden="true" className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/46">Synapse ouvindo</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-white/82">{voiceTranscript}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                "Pedido compreendido",
                "Notas › NeuroView aberto",
                "Mariana destacada no grafo",
                "Painel de revisão atualizado",
              ].map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 + index * 0.08, duration: 0.28 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2"
                >
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-white/72" />
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/68">{item}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function HeroVisual() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [userPaused, setUserPaused] = useState(false);
  const [windowPaused, setWindowPaused] = useState(false);
  const activeSlide = productDemoSlides[activeIndex];
  const previousIndex = useRef(activeIndex);

  const autoplayPaused = Boolean(reduceMotion) || userPaused || windowPaused;

  const selectSlide = (index: number, pause = true) => {
    setDirection(index >= previousIndex.current ? 1 : -1);
    previousIndex.current = index;
    setActiveIndex(index);
    if (pause) setUserPaused(true);
  };

  useEffect(() => {
    const setPausedFromDocument = () => setWindowPaused(document.hidden);
    const pauseOnBlur = () => setWindowPaused(true);
    const resumeOnFocus = () => setWindowPaused(document.hidden);

    setPausedFromDocument();
    document.addEventListener("visibilitychange", setPausedFromDocument);
    window.addEventListener("blur", pauseOnBlur);
    window.addEventListener("focus", resumeOnFocus);

    return () => {
      document.removeEventListener("visibilitychange", setPausedFromDocument);
      window.removeEventListener("blur", pauseOnBlur);
      window.removeEventListener("focus", resumeOnFocus);
    };
  }, []);

  useEffect(() => {
    if (autoplayPaused) return;

    const timer = window.setTimeout(() => {
      const nextIndex = (activeIndex + 1) % productDemoSlides.length;
      setDirection(1);
      previousIndex.current = nextIndex;
      setActiveIndex(nextIndex);
    }, AUTOPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplayPaused]);

  return (
    <section
      aria-labelledby="product-demo-title"
      className="mx-auto w-full max-w-[1320px] px-4 sm:px-6"
      onPointerDown={() => setUserPaused(true)}
      onFocusCapture={() => setUserPaused(true)}
    >
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-stretch">
        <div className="rounded-[28px] border border-border/45 bg-card/72 p-3 shadow-[0_24px_80px_-70px_rgba(0,0,0,0.74)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <div className="flex items-center justify-between gap-3 px-2 py-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Produto real</p>
              <h2 id="product-demo-title" className="mt-1 text-xl font-black tracking-[-0.045em] text-foreground">
                Uma rotina contínua
              </h2>
            </div>
            <button
              type="button"
              aria-label={userPaused ? "Retomar avanço automático" : "Pausar avanço automático"}
              aria-pressed={userPaused}
              onClick={() => setUserPaused((value) => !value)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-border/45 bg-background text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.045]"
            >
              {userPaused || reduceMotion ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>

          <div role="tablist" aria-label="Demonstrações reais da NeuroNex" className="grid gap-1.5">
            {productDemoSlides.map((slide, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={slide.key}
                  id={`product-demo-tab-${slide.key}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="product-demo-panel"
                  onClick={() => selectSlide(index)}
                  className={cn(
                    "group flex min-h-12 items-center gap-3 rounded-[18px] px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                  )}
                >
                  <slide.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]">{slide.label}</span>
                  {selected ? <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-current opacity-65" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <article
          id="product-demo-panel"
          role="tabpanel"
          aria-labelledby={`product-demo-tab-${activeSlide.key}`}
          className="relative overflow-hidden rounded-[34px] border border-border/45 bg-[#050506] shadow-[0_46px_150px_-78px_rgba(0,0,0,0.92)] dark:border-white/10"
        >
          <div className="flex h-12 items-center gap-2 border-b border-white/10 bg-white/[0.035] px-5 text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-white/26" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/16" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-white/48">{activeSlide.title}</span>
          </div>

          <div className="relative aspect-video overflow-hidden">
            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
              <motion.img
                key={activeSlide.key}
                src={activeSlide.src}
                alt={activeSlide.alt}
                width={1280}
                height={720}
                loading={activeIndex === 0 ? "eager" : "lazy"}
                decoding="async"
                custom={direction}
                initial={reduceMotion ? false : { opacity: 0, x: direction * 56, scale: 1.018 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: direction * -44, scale: 0.992 }}
                transition={{ duration: reduceMotion ? 0 : 0.56, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),transparent_34%,rgba(0,0,0,0.28))]" />
            <VoiceActionOverlay active={Boolean(activeSlide.voiceAction)} />
          </div>

          <div className="grid gap-4 border-t border-white/10 bg-[#08080a] p-5 text-white md:grid-cols-[0.86fr_1.14fr] md:p-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/42">Capítulo {String(activeIndex + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-3xl font-black leading-[0.92] tracking-[-0.055em]">{activeSlide.title}</h3>
            </div>
            <div>
              <p className="text-sm font-medium leading-relaxed text-white/62">{activeSlide.description}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <motion.div
                  key={`${activeSlide.key}-${autoplayPaused}`}
                  className="h-full origin-left rounded-full bg-white"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: autoplayPaused ? 0 : 1 }}
                  transition={{ duration: autoplayPaused ? 0 : AUTOPLAY_MS / 1000, ease: "linear" }}
                />
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
