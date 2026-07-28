"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { PublicProductShowcase } from "@/components/public/PublicProductShowcase";
import { Button } from "@/components/ui/button";
import {
  getPublicMediaCollection,
  type PublicMediaCollection,
  type PublicMediaKey,
} from "@/content/public-product-media";
import { cn } from "@/lib/utils";

type ProductModule = {
  key: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  icon: ElementType<{ className?: string }>;
  mediaKey?: PublicMediaKey;
};

const productModules: ProductModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Central da Clínica",
    description:
      "Resumo do dia, radar de atenção, próxima sessão e ações rápidas organizados em um único ponto de partida.",
    bullets: ["Hoje", "Próxima sessão", "Pendências"],
    icon: BarChart3,
    mediaKey: "dashboard",
  },
  {
    key: "agenda",
    label: "Agenda",
    title: "Agenda sempre à mão",
    description:
      "Consulte o mês, abra a agenda do dia e acesse compromissos com o contexto da clínica preservado.",
    bullets: ["Mês e semana", "Agenda do dia", "Status"],
    icon: CalendarDays,
    mediaKey: "agenda",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    title: "Gestão Financeira conectada",
    description:
      "Resultado, receitas, despesas e visão da clínica sem misturar gestão com movimentação da conta.",
    bullets: ["Resultado", "Receitas", "Despesas"],
    icon: CreditCard,
    mediaKey: "gestao-financeira",
  },
  {
    key: "paciente",
    label: "Paciente",
    title: "Prontuário em continuidade",
    description:
      "Metas, histórico e informações relevantes do paciente organizadas para consulta rápida e segura.",
    bullets: ["Prontuário", "Metas", "Histórico"],
    icon: ClipboardList,
    mediaKey: "prontuario",
  },
  {
    key: "synapse",
    label: "Synapse",
    title: "Synapse AI",
    description:
      "Pergunte sobre a rotina, localize informações e veja como o Synapse trabalha com o contexto autorizado da clínica.",
    bullets: ["Texto", "Contexto", "Rotina"],
    icon: Sparkles,
    mediaKey: "synapse",
  },
  {
    key: "teleconsulta",
    label: "Teleconsulta",
    title: "Teleconsulta conectada",
    description:
      "Pré-entrada, atendimento e revisão seguem um fluxo ligado à agenda, ao paciente e ao prontuário.",
    bullets: ["Pré-entrada", "Sala online", "Revisão"],
    icon: MonitorPlay,
    mediaKey: "teleconsulta",
  },
];

const Badge = ({
  children,
  inverted = false,
}: {
  children: ReactNode;
  inverted?: boolean;
}) => (
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
    <FadeIn>
      <Badge inverted={inverted}>{eyebrow}</Badge>
    </FadeIn>
    <FadeIn delay={0.08}>
      <h2
        className={cn(
          "mt-6 text-[2.55rem] font-black leading-[0.88] tracking-[-0.065em]",
          inverted ? "text-background dark:text-zinc-950" : "text-foreground",
        )}
      >
        {title}
      </h2>
    </FadeIn>
    <FadeIn delay={0.16}>
      <p
        className={cn(
          "mx-auto mt-5 max-w-[21rem] text-[0.92rem] font-medium leading-relaxed",
          inverted
            ? "text-background/60 dark:text-zinc-950/62"
            : "text-muted-foreground/70",
        )}
      >
        {description}
      </p>
    </FadeIn>
  </div>
);

const LandscapeProductMedia = ({
  module,
  inverted = false,
}: {
  module: ProductModule;
  inverted?: boolean;
}) => {
  const sharedClasses = cn(
    "!bg-transparent !px-0 !py-0",
    inverted && "text-foreground",
  );

  return (
    <PublicProductShowcase
      hideHeader
      title={module.title}
      images={getPublicMediaCollection(module.mediaKey ?? "produto")}
      className={sharedClasses}
      frameClassName="!max-w-none"
    />
  );
};

export const MobileRealProductShowcase = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState(productModules[0].key);
  const active =
    productModules.find((module) => module.key === activeKey) ?? productModules[0];

  return (
    <section id="produto" className="relative overflow-hidden bg-background px-5 py-16">
      <Heading
        eyebrow="Produto real"
        title={<>O NeuroNex por dentro.</>}
        description="Capturas reais das principais áreas da operação. Alterne entre os módulos e veja como o mesmo contexto percorre o sistema."
      />

      <div className="-mx-5 mt-9 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2">
          {productModules.map((module) => (
            <button
              key={module.key}
              type="button"
              aria-pressed={activeKey === module.key}
              onClick={() => setActiveKey(module.key)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-2xl px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition-all motion-reduce:transition-none",
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
        <motion.div
          key={active.key}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: -10 }
          }
          transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
          className="mt-7"
        >
          <LandscapeProductMedia module={active} />
          <div className="mt-5 rounded-[30px] border border-border/40 bg-card/78 p-6 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Operação conectada
            </p>
            <h3 className="mt-3 text-[2rem] font-black leading-[0.9] tracking-[-0.06em] text-foreground">
              {active.title}
            </h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">
              {active.description}
            </p>
            <div className="mt-6 grid gap-2">
              {active.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.03] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-foreground/68 dark:border-white/10 dark:bg-white/[0.035]"
                >
                  <Check className="h-4 w-4" />
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
};

const synapseModule = productModules.find((module) => module.key === "synapse") ??
  productModules[0];

export const MobileRealSynapseSection = () => (
  <section
    id="synapse"
    className="relative overflow-hidden bg-foreground px-5 py-16 text-background dark:bg-white dark:text-zinc-950"
  >
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_38%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(0,0,0,0.06),transparent_38%,rgba(0,0,0,0.02))]" />
    <div className="relative z-10">
      <Heading
        eyebrow="Synapse AI"
        title={<>Pergunte à sua clínica.</>}
        description="Texto e voz conectados ao contexto da rotina. O Synapse ajuda a localizar informações e organizar o trabalho sem substituir a decisão clínica."
        inverted
      />
      <FadeIn delay={0.15}>
        <div className="mt-10">
          <LandscapeProductMedia module={synapseModule} inverted />
        </div>
      </FadeIn>
      <div className="mt-6 grid gap-2">
        {[
          "Contexto da agenda",
          "Respostas operacionais",
          "Acesso em qualquer lugar",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] opacity-72 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]"
          >
            <Check className="h-4 w-4" />
            {item}
          </div>
        ))}
      </div>
      <Button
        asChild
        className="mt-6 h-14 w-full rounded-2xl bg-background text-[10px] font-black uppercase tracking-[0.2em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white"
      >
        <Link to="/synapse">
          Conhecer o Synapse <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  </section>
);

type FinanceModule = {
  key: string;
  label: string;
  media: PublicMediaCollection;
};

const neurofinanceMedia = getPublicMediaCollection("neurofinance");
const prontuarioMedia = getPublicMediaCollection("prontuario");
const fiscalMedia: PublicMediaCollection = {
  light: [
    ...neurofinanceMedia.light.filter((image) => image.name.includes("nfse")),
    ...prontuarioMedia.light.filter((image) => image.name.includes("fiscal")),
  ],
  dark: [
    ...neurofinanceMedia.dark.filter((image) => image.name.includes("nfse")),
    ...prontuarioMedia.dark.filter((image) => image.name.includes("fiscal")),
  ],
};

const financeModules: FinanceModule[] = [
  {
    key: "gestao",
    label: "Gestão",
    media: getPublicMediaCollection("gestao-financeira"),
  },
  { key: "neurofinance", label: "NeuroFinance", media: neurofinanceMedia },
  { key: "fiscal", label: "Fiscal", media: fiscalMedia },
];

export const MobileRealFinanceSection = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState(financeModules[0].key);
  const active =
    financeModules.find((module) => module.key === activeKey) ?? financeModules[0];

  return (
    <section id="financeiro" className="relative overflow-hidden bg-background px-5 py-16">
      <Heading
        eyebrow="Financeiro conectado"
        title={<>Gestão, conta e preparação fiscal com papéis claros.</>}
        description="A Gestão Financeira ajuda a decidir. O NeuroFinance movimenta dinheiro real. Dados fiscais, cobrança e emissão permanecem no mesmo percurso operacional."
      />

      <div className="mt-9 grid grid-cols-3 gap-2 rounded-[22px] border border-border/40 bg-card/70 p-1.5 dark:border-white/10 dark:bg-white/[0.035]">
        {financeModules.map((module) => (
          <button
            key={module.key}
            type="button"
            aria-pressed={active.key === module.key}
            onClick={() => setActiveKey(module.key)}
            className={cn(
              "min-h-11 rounded-[16px] px-2 text-[8px] font-black uppercase tracking-[0.12em] transition-colors motion-reduce:transition-none",
              active.key === module.key
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            {module.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.key}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: -8 }
          }
          transition={{ duration: shouldReduceMotion ? 0 : 0.28 }}
          className="mt-5"
        >
          <PublicProductShowcase
            hideHeader
            title={active.label}
            images={active.media}
            className="!bg-transparent !px-0 !py-0"
            frameClassName="!max-w-none"
          />
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 grid gap-3">
        {[
          {
            title: "Gestão Financeira",
            text: "Resultado, receitas, despesas, fluxo e planejamento.",
          },
          {
            title: "NeuroFinance",
            text: "Pix, boletos, pagamentos, transferências e saldo real.",
          },
          {
            title: "Fluxo fiscal",
            text: "Dados fiscais, cobrança e emissão de NFS-e no mesmo percurso operacional.",
          },
        ].map((item, index) => (
          <FadeIn key={item.title} delay={0.04 * index}>
            <article className="rounded-[26px] border border-border/40 bg-card/76 p-5 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                0{index + 1}
              </p>
              <h3 className="mt-3 text-lg font-black tracking-[-0.035em] text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground/70">
                {item.text}
              </p>
            </article>
          </FadeIn>
        ))}
      </div>

      <div className="mt-6 grid gap-3">
        <Button
          asChild
          className="h-14 w-full rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.2em] text-background"
        >
          <Link to="/neurofinance">
            Conhecer o NeuroFinance <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]"
        >
          <Link to="/create-account">Começar grátis</Link>
        </Button>
      </div>
    </section>
  );
};
