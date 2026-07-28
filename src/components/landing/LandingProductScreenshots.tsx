"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  ClipboardList,
  CreditCard,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  MessageCircle,
  Mic2,
  Sparkles,
  Users,
  WalletCards,
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
  eyebrow: string;
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
    key: "neuroview",
    label: "NeuroView",
    title: "NeuroView",
    eyebrow: "Visão sistêmica",
    description:
      "Conexões clínicas e informações relevantes ganham uma representação visual para apoiar leitura e organização.",
    bullets: ["Mapa 2D e 3D", "Conexões relevantes", "Notas contextuais"],
    icon: BrainCircuit,
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
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  align?: "center" | "left";
}) => (
  <div className={cn("max-w-5xl", align === "center" && "mx-auto text-center")}>
    <FadeIn>
      <FeatureBadge>{eyebrow}</FeatureBadge>
    </FadeIn>
    <FadeIn delay={0.1}>
      <h2 className="mt-8 text-4xl font-black leading-[1.02] tracking-tight text-foreground md:text-6xl">
        {title}
      </h2>
    </FadeIn>
    <FadeIn delay={0.18}>
      <p
        className={cn(
          "mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl",
          align === "center" && "mx-auto",
        )}
      >
        {description}
      </p>
    </FadeIn>
  </div>
);

const EmbeddedProductMedia = ({ module }: { module: ProductModule }) => {
  return (
    <PublicProductShowcase
      hideHeader
      title={module.title}
      images={getPublicMediaCollection(module.mediaKey ?? "produto")}
      className="!bg-transparent !px-0 !py-0"
      frameClassName="!max-w-none"
    />
  );
};

export const LandingRealProductShowcase = () => {
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
                    ? "bg-foreground text-background shadow-[0_18px_60px_-38px_rgba(0,0,0,0.65)]"
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
                exit={
                  shouldReduceMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: -10 }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
                }
              >
                <EmbeddedProductMedia module={active} />
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

export const LandingRealSynapseSection = () => (
  <section
    id="synapse"
    className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28"
  >
    <div className="relative z-10 mx-auto max-w-[1320px]">
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Synapse AI"
            title={
              <>
                Uma IA realmente agêntica{" "}
                <span className="text-muted-foreground">
                  não empurra retrabalho para você.
                </span>
              </>
            }
            description="Texto e voz consultam o contexto autorizado, navegam pela operação e preparam o próximo passo. Alterações sensíveis continuam visíveis para sua revisão e confirmação."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { icon: MessageCircle, label: "Synapse por texto" },
              { icon: Mic2, label: "Synapse por voz" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-[22px] border border-border/45 bg-card/72 px-5 py-4 text-muted-foreground dark:border-white/10 dark:bg-white/[0.035]"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2">
            {[
              "Contexto da agenda e dos pacientes",
              "Acesso rápido por texto ou voz",
              "Apoio operacional — não substitui decisão clínica",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.025] px-4 py-3 text-xs font-bold text-foreground/68 dark:border-white/10 dark:bg-white/[0.035]"
              >
                <Check className="h-4 w-4 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <FadeIn delay={0.15}>
          <PublicProductShowcase
            hideHeader
            title="Synapse AI em ação"
            images={getPublicMediaCollection("synapse")}
            className="!bg-transparent !px-0 !py-0"
            frameClassName="!max-w-none"
          />
        </FadeIn>
      </div>
    </div>
  </section>
);

type FinanceCard = {
  title: string;
  eyebrow: string;
  description: string;
  icon: ElementType<{ className?: string }>;
  items: string[];
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

const financeCards: FinanceCard[] = [
  {
    title: "Gestão Financeira",
    eyebrow: "Planejar e decidir",
    description:
      "Resultado, receitas, despesas, recebíveis, inadimplência, capital de giro e planejamento sem depender de uma conta bancária ativa.",
    icon: BarChart3,
    items: ["Fluxo de caixa", "Planejamento", "Relatórios"],
    media: getPublicMediaCollection("gestao-financeira"),
  },
  {
    title: "NeuroFinance",
    eyebrow: "Movimentar dinheiro real",
    description:
      "Conta, saldo, Área Pix, boletos, pagamentos, transferências e saques ficam em uma área financeira própria, conectada à operação da clínica.",
    icon: WalletCards,
    items: ["Conta e saldo", "Pix e boletos", "Pagamentos"],
    media: neurofinanceMedia,
  },
  {
    title: "Preparação fiscal",
    eyebrow: "Dados fiscais e evolução da NFS-e",
    description:
      "Dados fiscais, paciente, cobrança, RPS e emissão de NFS-e permanecem conectados ao mesmo fluxo financeiro.",
    icon: FileCheck2,
    items: ["Dados fiscais", "Emissão de NFS-e", "Automação fiscal"],
    media: fiscalMedia,
  },
];

export const LandingRealFinanceFiscalSection = () => (
  <section
    id="financeiro"
    className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28"
  >
    <div className="relative z-10 mx-auto max-w-[1380px]">
      <SectionHeading
        eyebrow="Financeiro sem confusão"
        title={
          <>
            Gestão para decidir.
            <br />
            <span className="text-muted-foreground">NeuroFinance para movimentar.</span>
          </>
        }
        description="Duas áreas com papéis claros: gestão para organizar e decidir, NeuroFinance para movimentar e recursos fiscais ligados ao consultório."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {financeCards.map((card, index) => (
          <FadeIn key={card.title} delay={index * 0.06}>
            <article className="h-full overflow-hidden rounded-[36px] border border-border/45 bg-card/76 p-4 shadow-[0_28px_90px_-72px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-white/[0.03]">
              <PublicProductShowcase
                hideHeader
                title={card.eyebrow}
                images={card.media}
                className="!bg-transparent !px-0 !py-0"
                frameClassName="!max-w-none"
              />
              <div className="p-3 pb-4 pt-7 md:p-5 md:pt-8">
                <card.icon className="h-6 w-6 text-muted-foreground" />
                <h3 className="mt-7 text-3xl font-black leading-[0.92] tracking-[-0.055em] text-foreground">
                  {card.title}
                </h3>
                <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">
                  {card.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {card.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border/40 bg-foreground/[0.03] px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] text-foreground/62 dark:border-white/10 dark:bg-white/[0.035]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </FadeIn>
        ))}
      </div>
      <FadeIn delay={0.22}>
        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-[30px] border border-border/45 bg-foreground p-6 text-background dark:bg-white dark:text-zinc-950 md:flex-row md:px-8">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">
              Uma operação conectada
            </p>
            <p className="mt-2 text-lg font-black tracking-[-0.035em]">
              A sessão conecta gestão e cobrança e prepara a base fiscal sem transformar o psicólogo em operador financeiro.
            </p>
          </div>
          <Button
            asChild
            className="h-12 shrink-0 rounded-2xl bg-background px-6 text-[9px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white"
          >
            <Link to="/create-account">
              Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </FadeIn>
    </div>
  </section>
);
