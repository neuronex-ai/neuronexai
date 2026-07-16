"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CalendarCheck,
  Captions,
  ClipboardList,
  LockKeyhole,
  Mic2,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import type { ElementType } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";

type LandingIcon = ElementType<{ className?: string }>;

type Capability = {
  icon: LandingIcon;
  title: string;
  text: string;
};

type FlowStep = {
  title: string;
  text: string;
};

const teleconsultaImage = "/landing/screenshots/mobile/light/26-mobile-teleconsulta-white.webp";
const prejoinImage = "/landing/screenshots/mobile/light/26-mobile-teleconsulta-prejoin-white.webp";

const capabilities: Capability[] = [
  {
    icon: CalendarCheck,
    title: "Agenda, sala e paciente no mesmo caminho",
    text: "A sessao online nasce do compromisso agendado, preserva paciente, horario, status e proximos passos sem criar uma ilha fora do prontuario.",
  },
  {
    icon: Captions,
    title: "Transcricao incremental com Deepgram",
    text: "Audio autorizado pode alimentar transcricao incremental, resumo assistido e trilha de revisao para reduzir retrabalho depois da chamada.",
  },
  {
    icon: BrainCircuit,
    title: "Synapse transforma sessao em contexto",
    text: "O agente organiza pontos-chave, pendencias e sugerencias operacionais, sempre com revisao do psicologo antes de virar registro.",
  },
  {
    icon: ClipboardList,
    title: "Prontuario conectado",
    text: "Notas, anexos, evolucao, diario do paciente e proximos atendimentos ficam proximos, com finalidades e permissoes separadas.",
  },
  {
    icon: LockKeyhole,
    title: "Limites por plano visiveis",
    text: "A interface pode travar minutos, sessoes ou transcricoes quando o plano ou a elegibilidade nao comporta o uso.",
  },
  {
    icon: ShieldCheck,
    title: "Privacidade operacional",
    text: "Estados de espera, erro, sala vazia, permissao e encerramento sao tratados como parte do fluxo, nao como excecao improvisada.",
  },
];

const flow: FlowStep[] = [
  {
    title: "1. Agenda",
    text: "A sessao comeca vinculada ao paciente, horario e tipo de atendimento.",
  },
  {
    title: "2. Pre-sala",
    text: "O paciente entra por um acesso orientado, enquanto o profissional revisa contexto e permissao.",
  },
  {
    title: "3. Atendimento",
    text: "Video, anotacoes e sinais operacionais ficam no mesmo workspace clinico.",
  },
  {
    title: "4. Transcricao",
    text: "Quando autorizada, a captura de audio gera material incremental para revisao.",
  },
  {
    title: "5. Registro",
    text: "O Synapse prepara resumo, pendencias e proximos passos para aprovacao humana.",
  },
];

const statusCards = [
  { title: "Sala vazia", text: "Estado claro quando o paciente ainda nao entrou, com retorno para agenda e orientacao de espera." },
  { title: "Carregando audio", text: "Indicadores de captura e processamento evitam a sensacao de sistema travado." },
  { title: "Transcricao indisponivel", text: "Fallback honesto quando permissao, plano, rede ou minutos bloqueiam a captura." },
  { title: "Limite atingido", text: "Trava de plano mostra o que esta bloqueado e qual caminho resolve a pendencia." },
];

const PhoneFrame = ({
  src,
  alt,
  label,
  eager = false,
}: {
  src: string;
  alt: string;
  label: string;
  eager?: boolean;
}) => (
  <div className="w-full max-w-[330px] rounded-[36px] border border-border/45 bg-card p-3 shadow-[0_34px_120px_-78px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-[#08090b]">
    <div className="rounded-[28px] border border-border/35 bg-background p-2 dark:border-white/10 dark:bg-white/[0.035]">
      <img
        src={src}
        alt={alt}
        width={390}
        height={844}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block aspect-[390/844] w-full rounded-[22px] object-cover"
      />
    </div>
    <p className="px-3 pt-4 text-center text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
  </div>
);

const TeleconsultaLanding = () => {
  const shouldReduceMotion = useReducedMotion();

  const scrollToWorkspace = () => {
    document.getElementById("workspace-teleconsulta")?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/20">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />

      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-44">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.08),transparent_42%)] dark:bg-[radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.06),transparent_42%)]" />
          <div className="relative z-10 mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Teleconsulta NeuroNex
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-8 max-w-4xl text-5xl font-black leading-none text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
              >
                A sessao online dentro do sistema operacional clinico.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl"
              >
                A teleconsulta deixa de ser uma chamada solta: agenda, paciente, video, transcricao, prontuario e Synapse AI compartilham o mesmo contexto autorizado.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row"
              >
                <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
                  <Link to="/create-account">
                    Comecar gratis <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]"
                  onClick={scrollToWorkspace}
                >
                  Ver workspace
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 }}
              className="grid justify-items-center gap-5 sm:grid-cols-2 lg:justify-items-end"
            >
              <PhoneFrame src={prejoinImage} alt="Tela de pre-entrada da teleconsulta NeuroNex" label="Pre-sala" eager />
              <div className="sm:mt-16">
                <PhoneFrame src={teleconsultaImage} alt="Tela de teleconsulta mobile da NeuroNex" label="Sessao ativa" eager />
              </div>
            </motion.div>
          </div>
        </section>

        <section id="workspace-teleconsulta" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1320px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Workspace clinico</p>
              <h2 className="mt-6 text-4xl font-black leading-none md:text-6xl lg:text-7xl">Video, transcricao e prontuario no mesmo ambiente.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                O objetivo nao e competir com chamada generica; e transformar a sessao online em continuidade clinica, com captura autorizada e revisao profissional.
              </p>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.title} className="rounded-[28px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/68">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="max-w-4xl">
              <BadgeCheck className="h-7 w-7 opacity-55" />
              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Da agenda ao registro</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">A sessao vira dado util sem tirar o psicologo do comando.</h2>
            </div>
            <div className="mt-12 grid gap-3 lg:grid-cols-5">
              {flow.map((item) => (
                <article key={item.title} className="rounded-[28px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <h3 className="text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed opacity-64">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03] md:p-10">
              <Mic2 className="h-7 w-7 text-muted-foreground" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Deepgram + Synapse</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">Transcricao assistida para reduzir o pos-sessao manual.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70 md:text-base">
                O audio autorizado pode alimentar transcricao incremental. O Synapse organiza o material em resumo, pendencias e pontos de revisao, sem substituir julgamento clinico.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {["Captura autorizada", "Resumo revisavel", "Metadados para NeuroPulse", "Registro sob controle humano"].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/40 bg-foreground/[0.03] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
                    {item}
                  </div>
                ))}
              </div>
            </article>
            <div className="grid gap-3 sm:grid-cols-2">
              {statusCards.map((item) => (
                <article key={item.title} className="rounded-[30px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <Video className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1180px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <MonitorPlay className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-none md:text-6xl">Atender online, registrar melhor e manter o caso em continuidade.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-64">
              Teleconsulta, agenda, Portal do Paciente e prontuario trabalham juntos para que a sessao remota faca parte da clinica, nao de uma aba perdida.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                <Link to="/create-account">
                  Comecar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
                <Link to="/pacientes-para-psicologos">Ver Pacientes</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TeleconsultaLanding;
