"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  CreditCard,
  MonitorPlay,
  Sparkles,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const ROOT = "/landing/screenshots";

type MobileScreenshotSource = {
  dark: string;
  light?: string;
  alt: string;
};

type MobileModule = MobileScreenshotSource & {
  key: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  icon: ElementType<{ className?: string }>;
};

const mobileModules: MobileModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Central da Clínica",
    description: "Resumo do dia, radar de atenção, próxima sessão e ações rápidas em uma experiência realmente mobile-first.",
    bullets: ["Hoje", "Próxima sessão", "Pendências"],
    icon: BarChart3,
    dark: `${ROOT}/mobile/dark/20-mobile-dashboard-dark.webp`,
    light: `${ROOT}/mobile/light/20-mobile-dashboard-white.webp`,
    alt: "Dashboard mobile do NeuroNex",
  },
  {
    key: "agenda",
    label: "Agenda",
    title: "Agenda sempre à mão",
    description: "Consulte o mês, abra a agenda do dia e acesse compromissos sem depender do computador.",
    bullets: ["Mês e semana", "Agenda do dia", "Status"],
    icon: CalendarDays,
    dark: `${ROOT}/mobile/dark/21-mobile-agenda-view-mes-dark.webp`,
    light: `${ROOT}/mobile/light/21-mobile-agenda-semanal-white.webp`,
    alt: "Agenda mobile do NeuroNex",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    title: "Gestão Financeira mobile",
    description: "Resultado, receitas, despesas e visão da clínica disponíveis no celular sem misturar gestão com conta bancária.",
    bullets: ["Resultado", "Receitas", "Despesas"],
    icon: CreditCard,
    dark: `${ROOT}/mobile/dark/22-mobile-financeiro-dark.webp`,
    alt: "Gestão Financeira mobile do NeuroNex",
  },
  {
    key: "paciente",
    label: "Paciente",
    title: "Prontuário em continuidade",
    description: "Metas, histórico e informações relevantes do paciente organizadas para consulta rápida e segura.",
    bullets: ["Prontuário", "Metas", "Histórico"],
    icon: ClipboardList,
    dark: `${ROOT}/mobile/dark/23-mobile-paciente--prontuario-metas-dark.webp`,
    alt: "Prontuário mobile de paciente no NeuroNex",
  },
  {
    key: "synapse",
    label: "Synapse",
    title: "Synapse no celular",
    description: "Pergunte sobre a rotina, localize informações e receba respostas contextuais enquanto estiver fora do consultório.",
    bullets: ["Texto", "Contexto", "Rotina"],
    icon: Sparkles,
    dark: `${ROOT}/mobile/dark/24-mobile-synapse-dark-respondendo-agendamentos-do-dia.webp`,
    alt: "Synapse respondendo sobre os agendamentos do dia no celular",
  },
  {
    key: "teleconsulta",
    label: "Teleconsulta",
    title: "Teleconsulta mobile",
    description: "Entrada de sessão e atendimento em uma experiência preparada para acompanhar o profissional em qualquer tela.",
    bullets: ["Pré-entrada", "Sala online", "Mobilidade"],
    icon: MonitorPlay,
    dark: `${ROOT}/mobile/light/26-mobile-teleconsulta-prejoin-white.webp`,
    light: `${ROOT}/mobile/light/26-mobile-teleconsulta-prejoin-white.webp`,
    alt: "Pré-entrada da teleconsulta mobile do NeuroNex",
  },
];

const Badge = ({ children, inverted = false }: { children: ReactNode; inverted?: boolean }) => (
  <div
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[8px] font-black uppercase tracking-[0.22em]",
      inverted
        ? "border-background/15 bg-background/[0.08] text-background/62 dark:border-zinc-950/10 dark:bg-zinc-950/[0.05] dark:text-zinc-950/60"
        : "border-border/40 bg-foreground/[0.035] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045] dark:text-white/46",
    )}
  >
    <Sparkles className="h-3.5 w-3.5" />
    {children}
  </div>
);

const Heading = ({
  eyebrow,
  title,
  description,
  inverted = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  inverted?: boolean;
}) => (
  <div className="mx-auto max-w-sm text-center">
    <FadeIn><Badge inverted={inverted}>{eyebrow}</Badge></FadeIn>
    <FadeIn delay={0.08}>
      <h2 className={cn("mt-6 text-[2.55rem] font-black leading-[0.88] tracking-[-0.065em]", inverted ? "text-background dark:text-zinc-950" : "text-foreground")}>{title}</h2>
    </FadeIn>
    <FadeIn delay={0.16}>
      <p className={cn("mx-auto mt-5 max-w-[21rem] text-[0.92rem] font-medium leading-relaxed", inverted ? "text-background/60 dark:text-zinc-950/62" : "text-muted-foreground/70")}>{description}</p>
    </FadeIn>
  </div>
);

const MobileImage = ({ source }: { source: MobileScreenshotSource }) => {
  const { theme } = useTheme();
  const src = theme === "light" ? source.light || source.dark : source.dark;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.img
        key={src}
        src={src}
        alt={source.alt}
        width={750}
        height={1334}
        loading="lazy"
        decoding="async"
        initial={{ opacity: 0, scale: 0.988, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.988, filter: "blur(8px)" }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="block h-auto w-full"
      />
    </AnimatePresence>
  );
};

const DeviceFrame = ({ source, label }: { source: MobileScreenshotSource; label: string }) => (
  <div className="mx-auto w-full max-w-[330px] rounded-[48px] border border-border/45 bg-[#08090b] p-2.5 shadow-[0_38px_110px_-62px_rgba(0,0,0,0.88)] dark:border-white/10">
    <div className="relative overflow-hidden rounded-[39px] bg-background">
      <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black/85" />
      <MobileImage source={source} />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.05]" />
    </div>
    <p className="px-4 pb-2 pt-3 text-center text-[8px] font-black uppercase tracking-[0.2em] text-white/38">{label}</p>
  </div>
);

const LandscapeFrame = ({ source, label }: { source: MobileScreenshotSource; label: string }) => {
  const { theme } = useTheme();
  const src = theme === "light" ? source.light || source.dark : source.dark;

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/45 bg-card shadow-[0_28px_90px_-68px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-[#08090b]">
      <div className="flex h-11 items-center gap-2 border-b border-border/40 px-4 dark:border-white/10">
        <span className="h-2 w-2 rounded-full bg-foreground/22" />
        <span className="h-2 w-2 rounded-full bg-foreground/14" />
        <span className="h-2 w-2 rounded-full bg-foreground/8" />
        <span className="ml-auto text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/50">{label}</span>
      </div>
      <img src={src} alt={source.alt} width={1280} height={720} loading="lazy" decoding="async" className="block h-auto w-full" />
    </div>
  );
};

export const MobileRealProductShowcase = () => {
  const [activeKey, setActiveKey] = useState(mobileModules[0].key);
  const active = mobileModules.find((module) => module.key === activeKey) || mobileModules[0];

  return (
    <section id="produto" className="relative overflow-hidden bg-background px-5 py-16">
      <Heading
        eyebrow="Produto real"
        title={<>O NeuroNex no seu bolso.</>}
        description="Capturas reais das experiências mobile. Alterne entre as principais áreas e veja como o sistema acompanha a rotina fora do desktop."
      />

      <div className="-mx-5 mt-9 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {mobileModules.map((module) => (
            <button
              key={module.key}
              type="button"
              onClick={() => setActiveKey(module.key)}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition-all",
                activeKey === module.key
                  ? "bg-foreground text-background"
                  : "border border-border/40 bg-card text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]",
              )}
            >
              <module.icon className="h-4 w-4" />
              {module.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={active.key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="mt-7">
          <DeviceFrame source={active} label={active.label} />
          <div className="mt-5 rounded-[30px] border border-border/40 bg-card/78 p-6 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground">Experiência mobile</p>
            <h3 className="mt-3 text-[2rem] font-black leading-[0.9] tracking-[-0.06em] text-foreground">{active.title}</h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{active.description}</p>
            <div className="mt-6 grid gap-2">
              {active.bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.03] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-foreground/68 dark:border-white/10 dark:bg-white/[0.035]">
                  <Check className="h-4 w-4" />{bullet}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};

const mobileSynapse: MobileScreenshotSource = {
  dark: `${ROOT}/mobile/dark/24-mobile-synapse-dark-respondendo-agendamentos-do-dia.webp`,
  alt: "Synapse mobile respondendo sobre os atendimentos do dia",
};

export const MobileRealSynapseSection = () => (
  <section id="synapse" className="relative overflow-hidden bg-foreground px-5 py-16 text-background dark:bg-white dark:text-zinc-950">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_38%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(0,0,0,0.06),transparent_38%,rgba(0,0,0,0.02))]" />
    <div className="relative z-10">
      <Heading
        eyebrow="Synapse AI"
        title={<>Pergunte à sua clínica.</>}
        description="Texto e voz conectados ao contexto da rotina. O Synapse ajuda a localizar informações e organizar o trabalho sem substituir a decisão clínica."
        inverted
      />
      <FadeIn delay={0.15}>
        <div className="mt-10"><DeviceFrame source={mobileSynapse} label="Synapse · mobile" /></div>
      </FadeIn>
      <div className="mt-6 grid gap-2">
        {["Contexto da agenda", "Respostas operacionais", "Acesso em qualquer lugar"].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] opacity-72 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
            <Check className="h-4 w-4" />{item}
          </div>
        ))}
      </div>
      <Button asChild className="mt-6 h-14 w-full rounded-2xl bg-background text-[10px] font-black uppercase tracking-[0.2em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white">
        <Link to="/synapse">
          Conhecer o Synapse <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  </section>
);

const mobileFinance: MobileScreenshotSource = {
  dark: `${ROOT}/mobile/dark/22-mobile-financeiro-dark.webp`,
  alt: "Gestão Financeira mobile do NeuroNex",
};

const fiscalDesktop: MobileScreenshotSource = {
  dark: `${ROOT}/desktop/dark/13-fiscal-dados-nfse-dark.webp`,
  alt: "Dados fiscais e NFS-e no NeuroNex",
};

export const MobileRealFinanceSection = () => (
  <section id="financeiro" className="relative overflow-hidden bg-background px-5 py-16">
    <Heading
      eyebrow="Financeiro conectado"
      title={<>Gestão, conta e fiscal com papéis claros.</>}
      description="A Gestão Financeira ajuda a decidir. O NeuroFinance movimenta dinheiro real. O fiscal acompanha o fluxo sem virar uma tarefa isolada."
    />
    <FadeIn delay={0.12}>
      <div className="mt-10"><DeviceFrame source={mobileFinance} label="Gestão Financeira" /></div>
    </FadeIn>
    <div className="mt-5 grid gap-3">
      {[
        { title: "Gestão Financeira", text: "Resultado, receitas, despesas, fluxo e planejamento." },
        { title: "NeuroFinance", text: "Pix, boletos, pagamentos, transferências e saldo real." },
        { title: "Fiscal", text: "NFS-e e dados fiscais conectados à operação." },
      ].map((item, index) => (
        <FadeIn key={item.title} delay={0.04 * index}>
          <article className="rounded-[26px] border border-border/40 bg-card/76 p-5 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">0{index + 1}</p>
            <h3 className="mt-3 text-lg font-black tracking-[-0.035em] text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
          </article>
        </FadeIn>
      ))}
    </div>
    <FadeIn delay={0.2}>
      <div className="mt-5"><LandscapeFrame source={fiscalDesktop} label="Fiscal · NFS-e" /></div>
    </FadeIn>
    <div className="mt-6 grid gap-3">
      <Button asChild className="h-14 w-full rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.2em] text-background">
        <Link to="/neurofinance">
          Conhecer o NeuroFinance <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]">
        <Link to="/create-account">
          Começar grátis
        </Link>
      </Button>
    </div>
  </section>
);
