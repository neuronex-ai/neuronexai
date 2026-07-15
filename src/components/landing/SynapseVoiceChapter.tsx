"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { CheckCircle2, MessageCircle, Mic, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

const SCREENSHOT_ROOT = "/landing/screenshots/desktop/dark";
const transcript = "Synapse, abra o NeuroView da Mariana e destaque o que devo revisar antes da sessão.";

type SynapseVoiceChapterProps = {
  id?: string;
  variant?: "compact" | "detailed";
};

const manualSteps = [
  { key: "request", label: "Pedido" },
  { key: "graph", label: "NeuroView" },
  { key: "action", label: "Ação" },
] as const;

export function SynapseVoiceChapter({ id = "synapse-voice-demo", variant = "compact" }: SynapseVoiceChapterProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [manualStep, setManualStep] = useState<(typeof manualSteps)[number]["key"]>("request");
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const pillY = useTransform(scrollYProgress, [0, 0.2, 0.45], [42, 0, -8]);
  const pillScale = useTransform(scrollYProgress, [0, 0.24], [0.92, 1]);
  const transcriptOpacity = useTransform(scrollYProgress, [0.08, 0.2, 0.42], [0, 1, 1]);
  const understoodOpacity = useTransform(scrollYProgress, [0.28, 0.4], [0, 1]);
  const navX = useTransform(scrollYProgress, [0.36, 0.56], [64, 0]);
  const navOpacity = useTransform(scrollYProgress, [0.34, 0.48], [0, 1]);
  const graphScale = useTransform(scrollYProgress, [0.42, 0.68], [0.94, 1]);
  const graphOpacity = useTransform(scrollYProgress, [0.4, 0.56], [0.34, 1]);
  const highlightOpacity = useTransform(scrollYProgress, [0.58, 0.72], [0, 1]);
  const panelX = useTransform(scrollYProgress, [0.64, 0.82], [48, 0]);
  const panelOpacity = useTransform(scrollYProgress, [0.62, 0.78], [0, 1]);
  const whatsappOpacity = useTransform(scrollYProgress, [0.78, 0.94], [0, 1]);

  const showAll = Boolean(reduceMotion);
  const showRequest = showAll ? manualStep === "request" : true;
  const showGraph = showAll ? manualStep === "graph" : true;
  const showAction = showAll ? manualStep === "action" : true;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("relative overflow-clip bg-background px-5 py-20 md:px-8", reduceMotion ? "md:py-28" : "lg:min-h-[220vh] lg:py-0")}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[680px] w-[1020px] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-[180px] dark:bg-white/[0.032]" />
      <div className={cn("relative z-10 mx-auto grid w-full max-w-[1360px] gap-8 lg:grid-cols-[0.52fr_1.48fr] lg:items-center", reduceMotion ? "" : "lg:sticky lg:top-0 lg:min-h-screen lg:py-20")}>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Synapse por voz</p>
          <h2 id={`${id}-title`} className="mt-5 text-4xl font-black leading-[0.9] tracking-[-0.06em] text-foreground md:text-6xl">
            A voz vira caminho visível, não mágica.
          </h2>
          <p className="mt-6 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground/72 md:text-base">
            O Synapse entende o pedido, navega para Notas › NeuroView, destaca Mariana no grafo e deixa a revisão pronta no painel. A pill continua disponível para a próxima conversa.
          </p>
          {reduceMotion ? (
            <div role="tablist" aria-label="Etapas da demonstração por voz" className="mt-7 grid grid-cols-3 gap-2">
              {manualSteps.map((step) => (
                <button
                  key={step.key}
                  type="button"
                  role="tab"
                  aria-selected={manualStep === step.key}
                  onClick={() => setManualStep(step.key)}
                  className={cn(
                    "min-h-11 rounded-2xl border px-3 text-[9px] font-black uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    manualStep === step.key ? "border-foreground bg-foreground text-background" : "border-border/45 text-muted-foreground",
                  )}
                >
                  {step.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative overflow-hidden rounded-[38px] border border-white/10 bg-[#070708] p-4 text-white shadow-[0_42px_150px_-86px_rgba(0,0,0,0.96)] md:p-5">
          <div className="flex h-12 items-center gap-2 border-b border-white/10 bg-white/[0.035] px-5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/26" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/16" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-white/48">Notas › NeuroView</span>
          </div>

          <div className="relative aspect-[16/9] overflow-hidden rounded-b-[28px] bg-black">
            <img
              src={`${SCREENSHOT_ROOT}/16-synapse-voz-dark.webp`}
              alt="Synapse por voz aberto no painel da NeuroNex"
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />

            {showGraph ? (
              <motion.img
                src={`${SCREENSHOT_ROOT}/17-neuroview-2d-com-nota-aberta-dark.webp`}
                alt="NeuroView com grafo real de paciente"
                width={1280}
                height={720}
                loading="lazy"
                decoding="async"
                style={reduceMotion ? undefined : { opacity: graphOpacity, scale: graphScale }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            {showRequest ? (
              <motion.div
                style={reduceMotion ? undefined : { y: pillY, scale: pillScale }}
                className="absolute bottom-5 left-5 max-w-[520px] rounded-[28px] border border-white/14 bg-black/72 p-4 shadow-[0_24px_90px_-44px_rgba(0,0,0,1)] backdrop-blur-2xl"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-white text-zinc-950">
                    <Mic aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/48">Transcrevendo</p>
                    <motion.p style={reduceMotion ? undefined : { opacity: transcriptOpacity }} className="mt-1 text-sm font-semibold leading-relaxed text-white/84">
                      {transcript}
                    </motion.p>
                  </div>
                </div>
                <motion.div style={reduceMotion ? undefined : { opacity: understoodOpacity }} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/70">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    Entendi: abrir NeuroView de Mariana e destacar pontos de revisão.
                  </p>
                </motion.div>
              </motion.div>
            ) : null}

            {showGraph ? (
              <>
                <motion.div
                  aria-hidden="true"
                  style={reduceMotion ? undefined : { opacity: highlightOpacity }}
                  className="absolute left-[43%] top-[38%] h-20 w-20 rounded-full border-2 border-white bg-white/10 shadow-[0_0_0_18px_rgba(255,255,255,0.08),0_0_70px_rgba(255,255,255,0.72)]"
                />
                <motion.div
                  style={reduceMotion ? undefined : { x: navX, opacity: navOpacity }}
                  className="absolute left-5 top-5 rounded-full border border-white/12 bg-black/58 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl"
                >
                  Navegando: Notas › NeuroView › Mariana
                </motion.div>
              </>
            ) : null}

            {showAction ? (
              <motion.aside
                style={reduceMotion ? undefined : { x: panelX, opacity: panelOpacity }}
                className="absolute right-5 top-5 w-[330px] rounded-[26px] border border-white/14 bg-black/74 p-4 shadow-[0_24px_90px_-42px_rgba(0,0,0,1)] backdrop-blur-2xl"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/46">Painel contextual</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.04em]">Revisar antes da sessão</h3>
                <div className="mt-4 grid gap-2">
                  {[
                    "Teleconsulta em 10 minutos",
                    "Relações e padrões encontrados",
                    "Histórico considerado",
                    "Ação executada no painel",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2">
                      <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-white/72" />
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/68">{item}</span>
                    </div>
                  ))}
                </div>
              </motion.aside>
            ) : null}

            {variant === "detailed" ? (
              <motion.div
                style={reduceMotion ? undefined : { opacity: whatsappOpacity }}
                className="absolute bottom-5 right-5 w-[300px] rounded-[24px] border border-white/14 bg-white text-zinc-950 p-4 shadow-[0_24px_90px_-42px_rgba(0,0,0,1)]"
              >
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  Continuidade WhatsApp
                </p>
                <p className="mt-3 text-sm font-bold leading-relaxed">NeuroZap supervisiona o WhatsApp Business; o Synapse mantém o mesmo histórico autorizado.</p>
              </motion.div>
            ) : null}

            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/12 bg-black/58 px-4 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/62 backdrop-blur-xl">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              Pill disponível para continuar
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
