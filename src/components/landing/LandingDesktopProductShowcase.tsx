"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  CreditCard,
  GitBranch,
  LayoutDashboard,
  Sparkles,
  Users,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useState } from "react";

import { FadeIn } from "@/components/animations/FadeIn";
import { PublicProductShowcase } from "@/components/public/PublicProductShowcase";
import {
  getPublicMediaCollection,
  type PublicMediaKey,
} from "@/content/public-product-media";
import { cn } from "@/lib/utils";

type ProductModule = {
  key: string;
  label: string;
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  icon: ElementType<{ className?: string }>;
  mediaKey: PublicMediaKey;
};

const productModules: ProductModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Central da Clínica",
    eyebrow: "Command Center",
    description:
      "Agenda, pacientes, pendências, Synapse e saúde operacional organizados para começar o dia com clareza.",
    bullets: ["Radar diário", "Próxima sessão", "Fila de trabalho"],
    icon: LayoutDashboard,
    mediaKey: "dashboard",
  },
  {
    key: "agenda",
    label: "Agenda",
    title: "Agenda Inteligente",
    eyebrow: "Rotina clínica",
    description:
      "Visões diária e mensal, compromissos, status e ações rápidas em uma agenda conectada ao restante da operação.",
    bullets: ["Dia e mês", "Status em tempo real", "Acesso ao paciente"],
    icon: CalendarDays,
    mediaKey: "agenda",
  },
  {
    key: "prontuario",
    label: "Prontuário",
    title: "Prontuário Vivo",
    eyebrow: "Continuidade clínica",
    description:
      "Histórico, metas, evolução e tendências de humor aparecem no contexto do paciente, sem espalhar informação.",
    bullets: ["Linha do tempo", "Metas e evolução", "Tendência de humor"],
    icon: ClipboardList,
    mediaKey: "prontuario",
  },
  {
    key: "gestao-financeira",
    label: "Gestão",
    title: "Gestão Financeira",
    eyebrow: "Decisão gerencial",
    description:
      "Resultado, receitas, despesas, recebíveis e planejamento da clínica em uma camada separada da conta bancária.",
    bullets: ["Visão geral", "Fluxo projetado", "Inadimplência"],
    icon: BarChart3,
    mediaKey: "gestao-financeira",
  },
  {
    key: "neurofinance",
    label: "NeuroFinance",
    title: "Financeiro ligado à clínica",
    eyebrow: "Movimentações reais",
    description:
      "Conta, Área Pix, boletos, pagamentos e saques ficam próximos da agenda, dos pacientes e das cobranças.",
    bullets: ["Conta e saldo", "Pix e boletos", "Confirmação humana"],
    icon: CreditCard,
    mediaKey: "neurofinance",
  },
  {
    key: "synapse",
    label: "Synapse",
    title: "Synapse AI",
    eyebrow: "Inteligência contextual",
    description:
      "A inteligência encontra pacientes, cruza informações entre módulos e prepara tarefas dentro da rotina da clínica.",
    bullets: ["Texto", "Voz", "Contexto da clínica"],
    icon: Sparkles,
    mediaKey: "synapse",
  },
  {
    key: "neurovision",
    label: "NeuroVision",
    title: "NeuroVision",
    eyebrow: "Visão sistêmica",
    description:
      "Conexões clínicas e informações relevantes ganham uma representação visual em 2D e 3D para apoiar leitura e organização.",
    bullets: ["Mapa 2D e 3D", "Conexões relevantes", "Notas contextuais"],
    icon: BrainCircuit,
    // O catálogo de screenshots ainda usa a chave técnica legada `neuroview`.
    mediaKey: "neuroview",
  },
  {
    key: "neuropulse",
    label: "NeuroPulse",
    title: "NeuroPulse",
    eyebrow: "Síntese clínica",
    description:
      "Sinais, registros e informações do acompanhamento são sintetizados para facilitar leitura e continuidade.",
    bullets: ["Síntese visual", "Sinais relevantes", "Apoio ao acompanhamento"],
    icon: Users,
    mediaKey: "neuropulse",
  },
  {
    key: "neuroflow",
    label: "NeuroFlow",
    title: "NeuroFlow",
    eyebrow: "Fluxos conectados",
    description:
      "Jornadas e conexões relevantes podem ser visualizadas como fluxos para organizar processos e próximos passos.",
    bullets: ["Fluxos visuais", "Conexões", "Próximas ações"],
    icon: GitBranch,
    mediaKey: "neuroflow",
  },
];

const FeatureBadge = ({
  children,
  icon: Icon = Sparkles,
}: {
  children: ReactNode;
  icon?: ElementType<{ className?: string }>;
}) => (
  <div className="inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-foreground/[0.035] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.045] dark:text-white/42">
    <Icon className="h-3.5 w-3.5" />
    {children}
  </div>
);

const SectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) => (
  <div className="mx-auto max-w-5xl text-center">
    <FadeIn>
      <FeatureBadge>{eyebrow}</FeatureBadge>
    </FadeIn>
    <FadeIn delay={0.1}>
      <h2 className="mt-8 text-4xl font-black leading-[1.02] tracking-tight text-foreground md:text-6xl">
        {title}
      </h2>
    </FadeIn>
    <FadeIn delay={0.18}>
      <p className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl">
        {description}
      </p>
    </FadeIn>
  </div>
);

export const LandingDesktopProductShowcase = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState(productModules[0].key);
  const active =
    productModules.find((module) => module.key === activeKey) ?? productModules[0];

  return (
    <section
      id="produto"
      className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28"
    >
      <div className="relative z-10 mx-auto max-w-[1380px]">
        <SectionHeading
          eyebrow="Produto real"
          title={
            <>
              Veja o NeuroNex <span className="text-muted-foreground">por dentro.</span>
            </>
          }
          description="Uma interface visual intuitiva: hierarquia antes de decoração, cores apenas quando comunicam estado e o mesmo contexto atravessando gestão clínica, financeiro e IA."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[292px_minmax(0,1fr)]">
          <div className="grid content-start gap-2 rounded-[30px] border border-border/40 bg-card/72 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            {productModules.map((module) => (
              <button
                key={module.key}
                type="button"
                aria-pressed={activeKey === module.key}
                onClick={() => setActiveKey(module.key)}
                className={cn(
                  "group flex min-h-12 items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-all duration-300 motion-reduce:transition-none",
                  activeKey === module.key
                    ? "bg-foreground text-background shadow-[0_18px_60px_-38px_rgba(0,0,0,0.65)] dark:bg-white dark:text-zinc-950"
                    : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                )}
              >
                <module.icon className="h-4 w-4 shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-[0.16em]">
                  {module.label}
                </span>
                <ArrowRight
                  className={cn(
                    "ml-auto h-3.5 w-3.5 transition-all motion-reduce:transition-none",
                    activeKey === module.key
                      ? "opacity-60"
                      : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-35",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-[40px] border border-border/45 bg-card/70 p-4 shadow-[0_42px_130px_-82px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.025] md:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
                }
              >
                <PublicProductShowcase
                  hideHeader
                  title={active.title}
                  images={getPublicMediaCollection(active.mediaKey)}
                  className="!bg-transparent !px-0 !py-0"
                  frameClassName="!max-w-none"
                />
                <div className="mt-5 grid gap-5 rounded-[30px] border border-border/40 bg-background/75 p-6 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[0.88fr_1.12fr] md:p-7">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                      {active.eyebrow}
                    </p>
                    <h3 className="mt-3 text-3xl font-black leading-[0.92] tracking-[-0.055em] text-foreground md:text-4xl">
                      {active.title}
                    </h3>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">
                      {active.description}
                    </p>
                  </div>
                  <div className="grid content-start gap-2 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                    {active.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.028] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]"
                      >
                        <Check className="h-4 w-4 shrink-0" />
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

const neuroTimeSources = ["Prontuário", "NeuroFlow", "Resumos", "Humor", "Agenda", "Financeiro", "Lembretes"];

export const LandingNeuroTimeSection = () => (
  <section
    id="neurotime"
    className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28"
  >
    <div className="relative z-10 mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
      <FadeIn>
        <div>
          <FeatureBadge icon={Clock3}>Novo · NeuroTime</FeatureBadge>
          <h2 className="mt-8 text-4xl font-black leading-[1.02] tracking-tight text-foreground md:text-6xl">
            A história clínica ganha <span className="text-muted-foreground">dimensão temporal.</span>
          </h2>
          <p className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl">
            O NeuroTime organiza registros do acompanhamento em um horizonte de eventos. Em vez de enxergar cada informação isoladamente, o psicólogo pode percorrer períodos, fontes e pacientes no mesmo campo temporal.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Horizonte de eventos",
              "Campo temporal por paciente",
              "Filtros por período e fonte",
              "Risco somente quando já registrado pelo profissional",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-[22px] border border-border/40 bg-card/70 px-4 py-4 text-xs font-bold text-foreground/72 dark:border-white/10 dark:bg-white/[0.035]"
              >
                <Check className="h-4 w-4 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.12}>
        <div className="overflow-hidden rounded-[40px] border border-border/45 bg-card/75 p-5 shadow-[0_42px_130px_-82px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.025] md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">NeuroTime</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.045em] text-foreground">Horizonte de eventos</h3>
            </div>
            <span className="rounded-full border border-border/40 bg-foreground/[0.035] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
              Campo temporal
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {neuroTimeSources.map((source) => (
              <span
                key={source}
                className="rounded-full border border-border/40 bg-background/80 px-3 py-2 text-[9px] font-bold text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]"
              >
                {source}
              </span>
            ))}
          </div>

          <div className="relative mt-10 h-44 overflow-hidden rounded-[28px] border border-border/40 bg-background/80 px-6 dark:border-white/10 dark:bg-[#070708]">
            <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
            {[14, 31, 49, 68, 86].map((left, index) => (
              <motion.div
                key={left}
                initial={{ opacity: 0, scale: 0.72 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: index * 0.08, duration: 0.35 }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/15 bg-foreground shadow-[0_0_0_8px_rgba(127,127,127,0.06)]"
                style={{ left: `${left}%`, width: `${18 + index * 4}px`, height: `${18 + index * 4}px` }}
                aria-hidden="true"
              />
            ))}
            <span className="absolute bottom-5 left-6 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">mais antigo</span>
            <span className="absolute bottom-5 right-6 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">mais recente</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["90 dias", "6 meses", "1 ano"].map((period) => (
              <div
                key={period}
                className="rounded-2xl border border-border/40 bg-foreground/[0.025] px-4 py-3 text-center text-[9px] font-black uppercase tracking-[0.14em] text-foreground/65 dark:border-white/10 dark:bg-white/[0.035]"
              >
                {period}
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </div>
  </section>
);
