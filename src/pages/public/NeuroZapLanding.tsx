"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  Check,
  ClipboardCheck,
  CreditCard,
  LockKeyhole,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards,
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

const synapseImage = "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp";

const capabilities: Capability[] = [
  {
    icon: ReceiptText,
    title: "Conexão autorizada em Beta",
    text: "A fase atual conecta o WhatsApp Business à NeuroNex e sincroniza os estados necessários para validar a superfície Desktop Beta.",
  },
  {
    icon: CalendarClock,
    title: "Inbox e etiquetas em evolução",
    text: "Organização de conversas, etiquetas, histórico e resolução segura da identidade do paciente avançam por etapas.",
  },
  {
    icon: BrainCircuit,
    title: "Synapse em evolução",
    text: "Resumos, sugestões e ações assistidas com contexto são uma próxima camada do produto e continuam sujeitas a revisão humana.",
  },
  {
    icon: WalletCards,
    title: "Contexto financeiro em evolução",
    text: "A ligação entre conversa, cobrança e retorno financeiro será liberada apenas quando identidade, permissão e auditoria estiverem validadas.",
  },
  {
    icon: LockKeyhole,
    title: "Travas por plano e permissão",
    text: "Automações avançadas, volume, canais e ações sensíveis podem exigir plano elegível, configuração ativa e confirmação.",
  },
  {
    icon: ShieldCheck,
    title: "Histórico e auditoria",
    text: "Cada rascunho, aprovação, envio e bloqueio precisa deixar rastro compreensível para a operação da clínica.",
  },
];

const flow: FlowStep[] = [
  {
    title: "Conexão autorizada",
    text: "O consultório conecta seu WhatsApp Business à superfície Desktop Beta.",
  },
  {
    title: "Sincronização",
    text: "Conversas e estados necessários são sincronizados para validação operacional.",
  },
  {
    title: "Identidade segura",
    text: "O vínculo entre conversa e paciente precisa ser resolvido sem associação ambígua.",
  },
  {
    title: "Inbox em evolução",
    text: "Etiquetas, histórico, consentimento e auditoria avançam como próxima etapa.",
  },
  {
    title: "Synapse em evolução",
    text: "Resumos e ações assistidas entram somente depois das proteções anteriores.",
  },
];

const conversation = [
  {
    from: "Synapse AI",
    text: "Visão de evolução: uma conversa poderá receber contexto operacional somente depois da resolução segura de identidade.",
  },
  {
    from: "Psicólogo",
    text: "O profissional continuará responsável por revisar tom, finalidade e qualquer ação sugerida.",
  },
  {
    from: "NeuroZap",
    text: "Conexão e sincronização estão em Beta. Inbox, etiquetas e ações contextuais permanecem em evolução.",
  },
];

const safetyStates = [
  { title: "Beta", text: "Conexão e sincronização autorizadas formam o escopo público atual." },
  { title: "Em evolução", text: "Inbox, etiquetas, identidade e ações contextuais ainda estão sendo validadas." },
  { title: "Bloqueio", text: "Plano, canal, permissão ou identidade ambígua devem interromper o fluxo." },
  { title: "Auditoria", text: "O histórico precisa existir antes de qualquer ampliação de automação." },
];

const BrowserFrame = ({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
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
      loading="lazy"
      decoding="async"
      className="block aspect-video w-full object-cover"
    />
  </div>
);

const ConversationMock = () => (
  <div className="rounded-[38px] border border-border/45 bg-card/78 p-5 shadow-[0_38px_120px_-78px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.03]">
    <div className="rounded-[30px] bg-foreground p-6 text-background dark:bg-white dark:text-zinc-950">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/whatsapp-business-logo.png" alt="WhatsApp Business" width={38} height={38} className="h-10 w-10 rounded-xl object-contain" loading="eager" decoding="async" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">WhatsApp Business</p>
            <p className="text-base font-black">NeuroZap Desktop Beta</p>
          </div>
        </div>
        <span className="rounded-full border border-background/10 bg-background/[0.08] px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] opacity-70 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">Visão em evolução</span>
      </div>

      <div className="mt-8 grid gap-3">
        {conversation.map((message, index) => (
          <article key={message.from} className="rounded-2xl border border-background/10 bg-background/[0.07] p-4 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-45">{message.from}</p>
            <p className="mt-2 text-sm font-medium leading-relaxed opacity-72">{message.text}</p>
            {index === conversation.length - 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {["Beta", "Em evolução", "Revisão humana"].map((label) => (
                  <span key={label} className="rounded-full border border-background/10 bg-background/[0.08] px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] opacity-70 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  </div>
);

const NeuroZapLanding = () => {
  const shouldReduceMotion = useReducedMotion();

  const scrollToFlow = () => {
    document.getElementById("neurozap-flow")?.scrollIntoView({
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
          <div className="relative z-10 mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                NeuroZap Desktop Beta
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-8 max-w-5xl text-balance text-[2.75rem] font-black leading-[0.9] tracking-[-0.055em] text-foreground sm:text-[3.45rem] md:text-[4.45rem] md:leading-[0.94] lg:text-[5.3rem] xl:text-[5.85rem]"
              >
                WhatsApp Business conectado à operação da clínica.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl"
              >
                A fase Beta cobre conexão autorizada e sincronização. Inbox, etiquetas, consentimento, auditoria e ações contextuais com o Synapse avançam por etapas.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row"
              >
                <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
                  <Link to="/create-account">
                    Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]"
                  onClick={scrollToFlow}
                >
                  Ver fluxo
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
            >
              <ConversationMock />
            </motion.div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1320px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Beta com responsabilidade</p>
              <h2 className="mt-6 text-4xl font-black leading-none md:text-6xl lg:text-7xl">Conectar primeiro. Contextualizar somente com segurança.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                A evolução do NeuroZap parte da conexão e da identidade correta antes de qualquer automação, resumo ou ação assistida.
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

        <section id="neurozap-flow" className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="max-w-4xl">
              <BadgeCheck className="h-7 w-7 opacity-55" />
              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Fluxo NeuroZap</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">Da conexão Beta até uma operação contextual e auditável.</h2>
            </div>
            <div className="mt-12 grid gap-3 lg:grid-cols-5">
              {flow.map((item, index) => (
                <article key={item.title} className="rounded-[28px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-45">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-7 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed opacity-64">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <BrowserFrame src={synapseImage} alt="Synapse AI em conversa operacional" label="Synapse AI" />
            <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03] md:p-10">
              <MessageCircle className="h-7 w-7 text-muted-foreground" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">WhatsApp Business + NeuroNex</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">A conexão prepara a base para uma inbox operacional.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70 md:text-base">
                Identidade do paciente, consentimento, histórico, etiquetas e auditoria precisam estar corretos antes que o Synapse participe de qualquer ação contextual.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {["Conexão autorizada", "Sincronização", "Identidade segura", "Inbox em evolução"].map((item) => (
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
              <UserCheck className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Segurança e tom</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">Evolução sensível precisa ser explícita, não escondida.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed opacity-62 md:text-base">
                A página separa o que já está em Beta do que ainda está em evolução. O objetivo é validar cada proteção antes de ampliar o escopo.
              </p>
            </article>
            <div className="grid gap-3 sm:grid-cols-2">
              {safetyStates.map((item) => (
                <article key={item.title} className="rounded-[30px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1180px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <CreditCard className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-none md:text-6xl">Uma base segura para comunicação operacional conectada.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-64">
              Conexão e sincronização estão em Beta. Inbox, consentimento, auditoria e ações assistidas continuam em evolução.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                <Link to="/create-account">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
                <Link to="/neurofinance">Ver NeuroFinance</Link>
              </Button>
            </div>
            <div className="mx-auto mt-8 grid max-w-3xl gap-2 sm:grid-cols-3">
              {["WhatsApp Business", "NeuroNex", "Desktop Beta"].map((item) => (
                <div key={item} className="flex items-center justify-center gap-2 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] opacity-72 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <Check className="h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NeuroZapLanding;
