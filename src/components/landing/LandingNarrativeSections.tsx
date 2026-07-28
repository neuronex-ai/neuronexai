"use client";

import type { ElementType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";

type FlowIcon = ElementType<{ className?: string }>;

type FlowNodeProps = {
  icon: FlowIcon;
  title: string;
  text: string;
  delay: number;
  shouldReduceMotion: boolean;
  emphasized?: boolean;
};

const beforeSteps = [
  {
    icon: CalendarDays,
    title: "Abrir a agenda",
    text: "Encontrar o horário e identificar quem precisa de atenção.",
  },
  {
    icon: Users,
    title: "Encontrar o paciente",
    text: "Localizar o cadastro correto antes de consultar o histórico.",
  },
  {
    icon: ClipboardList,
    title: "Consultar o prontuário",
    text: "Relembrar o contexto e conferir o que ficou pendente.",
  },
  {
    icon: WalletCards,
    title: "Conferir o financeiro",
    text: "Abrir outra área para verificar cobranças e pagamentos.",
  },
  {
    icon: FileText,
    title: "Preencher e enviar",
    text: "Reescrever a informação, copiar a mensagem e concluir a tarefa.",
  },
];

const connectedModules = [
  { icon: CalendarDays, label: "Agenda" },
  { icon: ClipboardList, label: "Prontuário" },
  { icon: WalletCards, label: "Financeiro" },
];

const FlowNode = ({
  icon: Icon,
  title,
  text,
  delay,
  shouldReduceMotion,
  emphasized = false,
}: FlowNodeProps) => (
  <motion.article
    initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true, amount: 0.45 }}
    transition={
      shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }
    }
    className={
      emphasized
        ? "relative z-10 rounded-[26px] border border-foreground bg-foreground p-5 text-background shadow-[0_28px_80px_-48px_rgba(0,0,0,0.82)] dark:border-white dark:bg-white dark:text-zinc-950"
        : "relative z-10 rounded-[26px] border border-border/55 bg-background/92 p-5 shadow-[0_24px_74px_-58px_rgba(0,0,0,0.62)] dark:border-white/10 dark:bg-white/[0.045]"
    }
  >
    <div className="flex items-start gap-4">
      <span
        className={
          emphasized
            ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-background text-foreground dark:bg-zinc-950 dark:text-white"
            : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/45 bg-foreground/[0.045] text-foreground dark:border-white/10 dark:bg-white/[0.055]"
        }
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-lg font-black leading-tight tracking-[-0.025em]">
          {title}
        </h3>
        <p className={emphasized ? "mt-2 text-sm font-medium leading-relaxed opacity-68" : "mt-2 text-sm font-medium leading-relaxed text-muted-foreground/72"}>
          {text}
        </p>
      </div>
    </div>
  </motion.article>
);

const FlowConnector = ({
  delay,
  shouldReduceMotion,
  emphasized = false,
}: {
  delay: number;
  shouldReduceMotion: boolean;
  emphasized?: boolean;
}) => (
  <div aria-hidden="true" className="relative mx-auto h-10 w-5 overflow-hidden">
    <motion.span
      initial={shouldReduceMotion ? false : { scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay }}
      className={emphasized ? "absolute inset-y-0 w-px bg-foreground/65" : "absolute inset-y-0 w-px bg-border"}
      style={{ left: "calc(50% - 0.5px)", transformOrigin: "top" }}
    />
    {!shouldReduceMotion ? (
      <motion.span
        initial={{ y: 1, opacity: 0 }}
        whileInView={{ y: [1, 30], opacity: [0, 1, 0] }}
        viewport={{ once: false, amount: 0.8 }}
        transition={{
          duration: 1.45,
          delay: delay + 0.2,
          repeat: Number.POSITIVE_INFINITY,
          repeatDelay: 1.1,
          ease: "easeInOut",
        }}
        className={emphasized ? "absolute top-0 h-2 w-2 rounded-full bg-foreground" : "absolute top-0 h-2 w-2 rounded-full bg-muted-foreground"}
        style={{ left: "calc(50% - 4px)" }}
      />
    ) : null}
  </div>
);

const BranchLines = ({
  merge = false,
  delay,
  shouldReduceMotion,
}: {
  merge?: boolean;
  delay: number;
  shouldReduceMotion: boolean;
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 600 64"
    preserveAspectRatio="none"
    className="h-16 w-full overflow-visible text-border dark:text-white/16"
  >
    <motion.path
      d={
        merge
          ? "M80 0V42 M300 0V42 M520 0V42 M80 42H520 M300 42V64"
          : "M300 0V22 M80 22H520 M80 22V64 M300 22V64 M520 22V64"
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
      initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.7 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    />
  </svg>
);

const ConnectedModuleFork = ({ shouldReduceMotion }: { shouldReduceMotion: boolean }) => (
  <div className="relative">
    <BranchLines delay={0.34} shouldReduceMotion={shouldReduceMotion} />
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {connectedModules.map((module, index) => (
        <motion.article
          key={module.label}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.48 + index * 0.08 }}
          className="relative z-10 flex min-h-24 flex-col items-center justify-center rounded-[20px] border border-border/55 bg-background/95 px-2 py-4 text-center dark:border-white/10 dark:bg-white/[0.045]"
        >
          <module.icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          <h4 className="mt-3 text-xs font-black sm:text-sm">{module.label}</h4>
        </motion.article>
      ))}
    </div>
    <BranchLines merge delay={0.72} shouldReduceMotion={shouldReduceMotion} />
  </div>
);

export const LandingWorkflowDiagramSection = () => {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <section className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto max-w-[1320px]">
        <FadeIn>
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-bold text-muted-foreground">Uma rotina, dois caminhos</p>
            <h2 className="mx-auto mt-7 max-w-[18ch] text-balance text-4xl font-black leading-[1.02] tracking-tight md:text-6xl">
              De várias telas para uma simples conversa.
            </h2>
            <p className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl">
              Para resolver uma pendência, o fluxo antigo obriga você a procurar a mesma informação em áreas diferentes. Na NeuroNex, o Synapse percorre esse caminho e organiza tudo para sua revisão.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="rounded-[40px] border border-border/50 bg-card/80 p-5 shadow-[0_36px_120px_-86px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-white/[0.025] sm:p-7 lg:p-8">
            <div className="mb-9 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Antes</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">Você opera cada parte.</h3>
              </div>
              <span className="rounded-full border border-border/55 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground dark:border-white/10">
                Fluxo fragmentado
              </span>
            </div>

            <FlowNode
              icon={Search}
              title="Uma pendência aparece"
              text="Você precisa descobrir onde estão as informações antes de agir."
              delay={0.05}
              shouldReduceMotion={shouldReduceMotion}
            />
            {beforeSteps.map((step, index) => (
              <div key={step.title}>
                <FlowConnector delay={0.12 + index * 0.11} shouldReduceMotion={shouldReduceMotion} />
                <FlowNode
                  {...step}
                  delay={0.18 + index * 0.11}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </div>
            ))}
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.85 }}
              className="mx-auto mt-7 w-fit rounded-full border border-border/55 bg-foreground/[0.035] px-4 py-2 text-center text-xs font-black text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"
            >
              Cinco telas. A mesma informação repetida.
            </motion.p>
          </div>

          <div className="rounded-[40px] border border-foreground/15 bg-foreground/[0.035] p-5 shadow-[0_36px_120px_-82px_rgba(0,0,0,0.76)] dark:border-white/10 dark:bg-white/[0.035] sm:p-7 lg:p-8">
            <div className="mb-9 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Com a NeuroNex</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">Você conversa com o todo.</h3>
              </div>
              <span className="rounded-full bg-foreground px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-background dark:bg-white dark:text-zinc-950">
                Contexto conectado
              </span>
            </div>

            <FlowNode
              icon={Sparkles}
              title="“Synapse, quem precisa da minha atenção hoje?”"
              text="Um pedido em linguagem natural inicia o fluxo inteiro."
              delay={0.08}
              shouldReduceMotion={shouldReduceMotion}
              emphasized
            />
            <FlowConnector delay={0.2} shouldReduceMotion={shouldReduceMotion} emphasized />
            <ConnectedModuleFork shouldReduceMotion={shouldReduceMotion} />
            <FlowNode
              icon={Search}
              title="Contexto cruzado"
              text="O Synapse encontra pacientes e reúne agenda, histórico e financeiro no mesmo raciocínio."
              delay={0.82}
              shouldReduceMotion={shouldReduceMotion}
            />
            <FlowConnector delay={0.88} shouldReduceMotion={shouldReduceMotion} emphasized />
            <FlowNode
              icon={Sparkles}
              title="Ação preparada"
              text="Pendências e próximos passos chegam organizados, sem copiar e colar entre abas."
              delay={0.94}
              shouldReduceMotion={shouldReduceMotion}
            />
            <FlowConnector delay={1} shouldReduceMotion={shouldReduceMotion} emphasized />
            <FlowNode
              icon={ShieldCheck}
              title="Você revisa e confirma"
              text="O trabalho pesado fica pronto, mas a palavra final continua sendo sua."
              delay={1.06}
              shouldReduceMotion={shouldReduceMotion}
              emphasized
            />
            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, delay: 1.14 }}
              className="mx-auto mt-7 w-fit rounded-full bg-foreground px-4 py-2 text-center text-xs font-black text-background dark:bg-white dark:text-zinc-950"
            >
              Uma conversa. Tudo no mesmo contexto.
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
};

const controlSteps = [
  {
    icon: Search,
    eyebrow: "01",
    title: "Encontra o contexto",
    text: "Mostra quais informações foram localizadas e de onde elas vieram.",
  },
  {
    icon: Sparkles,
    eyebrow: "02",
    title: "Prepara a ação",
    text: "Organiza a tarefa e deixa visível o que pretende fazer no sistema.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "03",
    title: "Aguarda sua confirmação",
    text: "Ações importantes só são concluídas depois da sua autorização.",
  },
];

export const LandingHumanControlSection = () => (
  <section id="controle" className="public-sensitive-section public-section-stage relative overflow-hidden px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <FadeIn>
        <div className="mx-auto max-w-5xl text-center">
          <ShieldCheck aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-7 text-xs font-bold text-muted-foreground">Controle humano, sempre</p>
          <h2 className="mx-auto mt-7 max-w-[18ch] text-balance text-4xl font-black leading-[1.02] tracking-tight md:text-6xl">
            O Synapse prepara. Você decide.
          </h2>
          <p className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl">
            Você vê quais informações foram encontradas, o que será preparado e o que vai mudar. Ações importantes só são concluídas depois da sua autorização.
          </p>
        </div>
      </FadeIn>

      <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-5">
        {controlSteps.map((step, index) => (
          <div key={step.title} className="contents">
            <FadeIn delay={0.1 + index * 0.08}>
              <article className={index === controlSteps.length - 1 ? "public-sensitive-card h-full rounded-[30px] border border-foreground bg-foreground p-7 text-background shadow-[0_30px_90px_-58px_rgba(0,0,0,0.8)] dark:border-white dark:bg-white dark:text-zinc-950" : "public-sensitive-card h-full rounded-[30px] border p-7"}>
                <div className="flex items-center justify-between gap-4">
                  <step.icon aria-hidden="true" className="h-6 w-6" />
                  <span className="font-mono text-[10px] font-black opacity-48">{step.eyebrow}</span>
                </div>
                <h3 className="mt-10 text-2xl font-black leading-tight tracking-[-0.035em]">{step.title}</h3>
                <p className={index === controlSteps.length - 1 ? "mt-4 text-sm font-medium leading-relaxed opacity-66" : "mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72"}>
                  {step.text}
                </p>
              </article>
            </FadeIn>
            {index < controlSteps.length - 1 ? (
              <div aria-hidden="true" className="hidden items-center justify-center lg:flex">
                <ArrowRight className="h-5 w-5 text-muted-foreground/45" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <FadeIn delay={0.34}>
        <div className="mx-auto mt-10 flex w-fit items-center gap-3 rounded-full border border-border/60 bg-background/72 px-5 py-3 text-sm font-black dark:border-white/10 dark:bg-white/[0.045]">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          Nada importante muda sem sua autorização.
        </div>
      </FadeIn>
    </div>
  </section>
);
