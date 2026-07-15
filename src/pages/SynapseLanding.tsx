"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  FileText,
  LockKeyhole,
  MessageCircle,
  MessageSquare,
  Mic,
  Network,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { LandingSectionStage } from "@/components/landing/LandingSectionStage";
import { Navbar } from "@/components/landing/Navbar";
import { PublicFlowComparison } from "@/components/landing/PublicFlowComparison";
import { SynapseVoiceChapter } from "@/components/landing/SynapseVoiceChapter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const questions = [
  ["O que o Synapse faz?", "Ele ajuda a encontrar o contexto que você autorizou, organiza o que importa e deixa o próximo passo pronto. Se uma ação envia, altera ou registra algo, ele pede a confirmação prevista para aquele caso."],
  ["Texto, voz e WhatsApp usam o mesmo Synapse?", "Sim. A conversa pode continuar entre painel, voz e WhatsApp sem perder o histórico autorizado. O NeuroZap faz a conexão e a supervisão do WhatsApp Business; ele não é outro assistente."],
  ["Ele pode executar tarefas?", "Ele pode reunir etapas, encontrar a ferramenta certa e preparar uma ação. Acesso, limites do plano e confirmações continuam valendo em cada parte do caminho."],
  ["O que é o NeuroBox?", "É o conjunto de ferramentas NeuroView, NeuroFlow, NeuroPulse e NeuroScan. O NeuroScan já ajuda a transcrever fichas de anamnese no prontuário."],
  ["Ele acessa qualquer informação?", "Não. O Synapse só trabalha com o contexto e as permissões disponíveis para aquela pessoa e situação."],
];

const channels = [
  { icon: MessageSquare, title: "Texto", eyebrow: "Painel", text: "A conversa estrutura o pedido, mostra o contexto usado e preserva revisão antes de qualquer efeito real." },
  { icon: Mic, title: "Voz", eyebrow: "Durante a rotina", text: "Você pede sem quebrar o fluxo. O Synapse transforma fala em caminho visível dentro do produto." },
  { icon: MessageCircle, title: "WhatsApp", eyebrow: "NeuroZap", text: "NeuroZap é a ponte de conexão e supervisão do WhatsApp Business; o cérebro continua sendo o Synapse." },
];

const neuroBoxTools = [
  { icon: Network, name: "NeuroView", text: "Visualiza conexões e padrões do histórico permitido para apoiar leitura e organização clínica." },
  { icon: Workflow, name: "NeuroFlow", text: "Organiza processos e percursos em fluxos revisáveis antes de serem salvos." },
  { icon: Activity, name: "NeuroPulse", text: "Estrutura relações e sinais a partir do contexto selecionado, com confirmação para persistir resultados." },
  { icon: ScanLine, name: "NeuroScan", text: "Auxilia a transcrever fichas de anamnese para o prontuário e alimentar o mesmo contexto." },
];

const pathSteps = [
  "Pedido",
  "Compreensão",
  "Contexto",
  "Confirmação",
  "Execução",
  "Histórico",
];

const scrollToSection = (id: string) => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
};

const SynapseHero = () => {
  const heroRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 0.78], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.62, 0.92], [1, 0.82, 0]);
  const cardY = useTransform(scrollYProgress, [0, 0.72], [52, -42]);
  const cardScale = useTransform(scrollYProgress, [0, 0.72], [0.94, 1.02]);

  return (
    <section ref={heroRef} aria-labelledby="synapse-hero-title" className="relative min-h-[142vh] overflow-clip bg-background">
      <div className="sticky top-0 flex min-h-screen flex-col justify-center overflow-hidden px-5 py-24 md:px-8">
        <div className="pointer-events-none absolute left-1/2 top-[-18%] h-[620px] w-[1040px] -translate-x-1/2 rounded-full bg-foreground/[0.052] blur-[180px] dark:bg-white/[0.036]" />
        <motion.div
          style={reduceMotion ? undefined : { y: textY, opacity: textOpacity }}
          className="relative z-10 mx-auto max-w-5xl text-center"
        >
          <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Synapse AI
          </div>
          <h1 id="synapse-hero-title" className="mt-7 text-[clamp(3rem,7vw,7rem)] font-black leading-[0.86] tracking-[-0.065em] text-foreground">
            Você conversa. <span className="text-muted-foreground/42">O Synapse acompanha.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
            No painel, por voz ou pelo WhatsApp, o Synapse entende o contexto autorizado, encontra o que importa e deixa o próximo passo pronto para sua confirmação.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
              <Link to="/create-account">
                Experimentar
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]" onClick={() => scrollToSection("synapse-voice-demo")}>
              Ver voz em ação
            </Button>
          </div>
        </motion.div>

        <motion.div
          style={reduceMotion ? undefined : { y: cardY, scale: cardScale }}
          className="relative z-20 mx-auto mt-12 w-full max-w-[980px] rounded-[34px] border border-white/10 bg-[#070708] p-4 text-white shadow-[0_42px_150px_-86px_rgba(0,0,0,0.96)]"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-white/26" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/16" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="ml-auto text-[9px] font-black uppercase tracking-[0.18em] text-white/46">pedido › contexto › ação</span>
          </div>
          <div className="grid gap-2 pt-4 sm:grid-cols-6">
            {pathSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-4 text-center">
                <p className="font-mono text-[10px] text-white/36">{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/68">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const SynapseContinuitySection = () => (
  <section className="relative overflow-hidden bg-background px-5 py-20 md:px-8 md:py-28">
    <div className="mx-auto max-w-[1320px]">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Uma conversa, três entradas</p>
        <h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">
          Texto, voz e WhatsApp <span className="text-muted-foreground/35">continuam o mesmo raciocínio.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
          O canal muda, mas o histórico autorizado, as permissões e as confirmações seguem no mesmo percurso.
        </p>
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {channels.map((channel) => (
          <article key={channel.title} className="rounded-[32px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]">
            <channel.icon aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
            <p className="mt-9 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{channel.eyebrow}</p>
            <h3 className="mt-3 text-3xl font-black tracking-[-0.05em]">{channel.title}</h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{channel.text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const SynapseToolsSection = () => (
  <section className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
    <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <article className="rounded-[38px] border border-background/10 bg-background/[0.07] p-8 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045] md:p-10">
        <Bot aria-hidden="true" className="h-7 w-7 opacity-55" />
        <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Quando você pede uma ação</p>
        <h2 className="mt-4 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-6xl">
          O Synapse prepara o caminho. <span className="opacity-35">Você confirma o efeito.</span>
        </h2>
        <div className="mt-8 grid gap-2">
          {pathSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-4 rounded-2xl border border-background/10 bg-background/[0.06] px-4 py-3 dark:border-zinc-950/10 dark:bg-zinc-950/[0.04]">
              <span className="font-mono text-xs opacity-40">0{index + 1}</span>
              <span className="text-sm font-semibold">{step}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-[38px] border border-background/10 bg-background/[0.07] p-8 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045] md:p-10">
        <BrainCircuit aria-hidden="true" className="h-7 w-7 opacity-55" />
        <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">NeuroBox</p>
        <h2 className="mt-4 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-6xl">
          Ferramentas diferentes, <span className="opacity-35">o mesmo cérebro.</span>
        </h2>
        <div className="mt-8 grid gap-3">
          {neuroBoxTools.map((tool) => (
            <div key={tool.name} className="rounded-[24px] border border-background/10 bg-background/[0.06] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.04]">
              <div className="flex items-center gap-3">
                <tool.icon aria-hidden="true" className="h-5 w-5 opacity-55" />
                <h3 className="text-lg font-black">{tool.name}</h3>
              </div>
              <p className="mt-3 text-sm font-medium leading-relaxed opacity-62">{tool.text}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  </section>
);

const SynapseFAQSection = () => {
  const [open, setOpen] = useState(0);

  return (
    <section className="px-5 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-2">
        <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950">
          <LockKeyhole aria-hidden="true" className="h-7 w-7 opacity-55" />
          <h2 className="mt-9 text-4xl font-black leading-[0.9] tracking-[-0.06em]">Contexto só onde ele faz sentido.</h2>
          <p className="mt-5 text-sm font-medium leading-relaxed opacity-65">
            O Synapse não é uma porta aberta para todos os dados. Ele trabalha dentro do acesso disponível, registra o caminho e respeita confirmações necessárias.
          </p>
          <div className="mt-7 grid gap-2">
            {["Acesso ligado à pessoa e ao seu papel", "Informações dentro do que foi autorizado", "Histórico das ações registradas", "IA como apoio, não decisão clínica"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-sm font-semibold dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                <Check aria-hidden="true" className="h-4 w-4" />
                {item}
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Dúvidas frequentes</p>
          <div className="mt-4 divide-y divide-border/40 dark:divide-white/10">
            {questions.map(([question, answer], index) => {
              const isOpen = open === index;

              return (
                <div key={question}>
                  <button
                    id={`synapse-faq-trigger-${index}`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`synapse-faq-panel-${index}`}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    className="block min-h-12 w-full py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span className="text-sm font-black">{question}</span>
                      <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.p
                        id={`synapse-faq-panel-${index}`}
                        role="region"
                        aria-labelledby={`synapse-faq-trigger-${index}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pb-5 text-sm font-medium leading-relaxed text-muted-foreground/72"
                      >
                        {answer}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
};

const SynapseLanding = () => (
  <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
    <div className="hidden md:block">
      <Navbar />
    </div>
    <LandingMobileNav />
    <main>
      <SynapseHero />
      <SynapseVoiceChapter id="synapse-voice-demo" variant="detailed" />
      <LandingSectionStage index={1}>
        <SynapseContinuitySection />
      </LandingSectionStage>
      <PublicFlowComparison variant="synapse" />
      <LandingSectionStage index={2}>
        <SynapseToolsSection />
      </LandingSectionStage>
      <LandingSectionStage index={3}>
        <SynapseFAQSection />
      </LandingSectionStage>
      <LandingSectionStage index={4}>
        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1200px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <ShieldCheck aria-hidden="true" className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-[0.88] tracking-[-0.065em] md:text-6xl">
              Sua prática já tem contexto. Agora ele pode trabalhar a seu favor.
            </h2>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                <Link to="/create-account">
                  Começar agora
                  <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-transparent px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background dark:border-zinc-950/20 dark:text-zinc-950">
                <Link to="/contato">Falar com a equipe</Link>
              </Button>
            </div>
          </div>
        </section>
      </LandingSectionStage>
    </main>
    <Footer />
  </div>
);

export default SynapseLanding;
