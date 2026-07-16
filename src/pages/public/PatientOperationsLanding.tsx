"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  ClipboardList,
  FileText,
  HeartPulse,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Network,
  ScanText,
  ShieldCheck,
  Sparkles,
  Users,
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

type JourneyStep = {
  title: string;
  text: string;
};

const patientListImage = "/landing/screenshots/desktop/dark/11-pacientes-lista-dark.webp";
const patientChartImage = "/landing/screenshots/desktop/dark/12-paciente-prontuario-grafico-tendencia-humor-minicards-dark.webp";
const mobilePatientImage = "/landing/screenshots/mobile/dark/23-mobile-paciente-dark.webp";

const capabilities: Capability[] = [
  {
    icon: Users,
    title: "Cadastro como nucleo operacional",
    text: "Paciente, contatos, historico, agenda, documentos e financeiro partem de uma identidade unica, com permissoes e contexto rastreaveis.",
  },
  {
    icon: ClipboardList,
    title: "Prontuario vivo",
    text: "Registros, evolucao, anexos e observacoes ficam proximos da jornada do paciente e prontos para revisao profissional.",
  },
  {
    icon: HeartPulse,
    title: "Humor e continuidade",
    text: "Dados compartilhados pelo paciente, como diario e indicadores de humor, podem enriquecer a leitura entre sessoes.",
  },
  {
    icon: ScanText,
    title: "NeuroScan",
    text: "Anamnese e documentos entram em estruturacao assistida para reduzir digitacao e manter revisao humana.",
  },
  {
    icon: Network,
    title: "NeuroView",
    text: "Sintomas, eventos, notas e hipoteses podem alimentar grafos 2D/3D para leitura clinica sistemica.",
  },
  {
    icon: LockKeyhole,
    title: "Separacao de acessos",
    text: "Interface profissional, Portal do Paciente e dados administrativos preservam finalidades, limites e superficies diferentes.",
  },
];

const journey: JourneyStep[] = [
  {
    title: "Entrada",
    text: "Cadastro, anamnese, documentos e consentimentos estruturam o comeco do acompanhamento.",
  },
  {
    title: "Agenda",
    text: "Cada compromisso preserva paciente, contexto e proximos passos operacionais.",
  },
  {
    title: "Atendimento",
    text: "Teleconsulta, prontuario e notas se conectam sem misturar canal de paciente com area profissional.",
  },
  {
    title: "Entre sessoes",
    text: "Portal, diario e humor criam continuidade autorizada para o acompanhamento.",
  },
  {
    title: "IA clinica",
    text: "Synapse, NeuroView, NeuroPulse e NeuroFlow consomem metadados claros para apoiar revisao e planejamento.",
  },
];

const operationalStates = [
  { title: "Sem pacientes ainda", text: "Empty state orienta primeiro cadastro, convite ao portal e criacao do fluxo inicial." },
  { title: "Carregando historico", text: "Skeletons preservam dimensoes para evitar saltos enquanto prontuario e graficos carregam." },
  { title: "Erro de permissao", text: "A interface explica limite de acesso em vez de expor dado parcial ou confuso." },
  { title: "Plano atingido", text: "Travamento de vinculos ou recursos mostra caminho de upgrade sem quebrar a rotina." },
];

const BrowserFrame = ({
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
  <div className="overflow-hidden rounded-[32px] border border-border/45 bg-card shadow-[0_36px_110px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]">
    <div className="flex h-12 items-center gap-2 border-b border-border/40 bg-background/80 px-5 dark:border-white/10 dark:bg-white/[0.035]">
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/24" />
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/16" />
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
      <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</span>
    </div>
    <img
      src={src}
      alt={alt}
      width={1280}
      height={720}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className="block aspect-video w-full object-cover"
    />
  </div>
);

const PatientOperationsLanding = () => {
  const shouldReduceMotion = useReducedMotion();

  const scrollToContinuity = () => {
    document.getElementById("pacientes-continuity")?.scrollIntoView({
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
          <div className="relative z-10 mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Pacientes NeuroNex
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-8 text-5xl font-black leading-none text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
              >
                O paciente como centro da operacao clinica.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl"
              >
                Cadastro, prontuario, agenda, teleconsulta, portal, diario, humor, documentos, financeiro e Synapse AI se conectam sem transformar o paciente em uma ficha isolada.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"
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
                  onClick={scrollToContinuity}
                >
                  Ver continuidade
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="mt-16 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start"
            >
              <BrowserFrame src={patientListImage} alt="Lista de pacientes na NeuroNex" label="Lista de pacientes" eager />
              <BrowserFrame src={patientChartImage} alt="Prontuario com grafico de tendencia de humor" label="Prontuario e humor" eager />
            </motion.div>
          </div>
        </section>

        <section id="pacientes-continuity" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1320px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Continuidade do cuidado</p>
              <h2 className="mt-6 text-4xl font-black leading-none md:text-6xl lg:text-7xl">Cada paciente carrega uma rede de contexto.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                A NeuroNex organiza o que costuma se espalhar por agenda, mensagens, documentos, planilhas e anotacoes soltas.
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
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <BadgeCheck className="h-7 w-7 opacity-55" />
              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Jornada conectada</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">Do primeiro contato ao grafo clinico.</h2>
              <p className="mt-6 text-base font-medium leading-relaxed opacity-64">
                Pacientes e prontuario sao a base para que NeuroView, NeuroPulse, NeuroFlow e Synapse raciocinem com origem, permissao e finalidade.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {journey.map((item) => (
                <article key={item.title} className="rounded-[28px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <Layers3 className="h-5 w-5 opacity-55" />
                  <h3 className="mt-7 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed opacity-64">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="mx-auto w-full max-w-[330px] rounded-[36px] border border-border/45 bg-card p-3 shadow-[0_34px_120px_-78px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-[#08090b]">
              <img
                src={mobilePatientImage}
                alt="Detalhe mobile de paciente na NeuroNex"
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                className="block aspect-[390/844] w-full rounded-[24px] object-cover"
              />
            </div>
            <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03] md:p-10">
              <MessageCircle className="h-7 w-7 text-muted-foreground" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Portal do Paciente</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">A continuidade entre sessoes ganha um canal proprio.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70 md:text-base">
                O Portal do Paciente e uma superficie separada da area profissional. Ele aproxima diario, humor, orientacoes e acompanhamento sem abrir o workspace clinico do psicologo.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {["Diario autorizado", "Humor e tendencias", "Convites e vinculos", "Experiencia mobile"].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/40 bg-foreground/[0.03] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950 md:p-10">
              <ShieldCheck className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Estados e limites</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">Paciente completo tambem significa estados claros.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed opacity-62 md:text-base">
                A experiencia precisa explicar ausencia de dados, carregamento, erro, permissao e travas de plano com o mesmo cuidado da tela principal.
              </p>
            </article>
            <div className="grid gap-3 sm:grid-cols-2">
              {operationalStates.map((item) => (
                <article key={item.title} className="rounded-[30px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1180px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <BrainCircuit className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-none md:text-6xl">Quando o paciente vira contexto, a clinica deixa de operar no escuro.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-64">
              Cadastre, acompanhe, convide para o portal, atenda online e alimente a inteligencia clinica com dados revisaveis.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                <Link to="/create-account">
                  Comecar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
                <Link to="/teleconsulta-para-psicologos">Ver Teleconsulta</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PatientOperationsLanding;
