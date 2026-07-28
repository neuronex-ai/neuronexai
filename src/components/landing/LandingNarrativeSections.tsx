"use client";

import { useState, type ElementType, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftRight,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Copy,
  CreditCard,
  Landmark,
  MessageCircle,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { cn } from "@/lib/utils";

type FlowIcon = ElementType<{ className?: string }>;
type WorkflowMode = "without" | "with";

type WorkflowStep = {
  icon: FlowIcon;
  title: string;
  text: string;
};

type WorkflowContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: WorkflowStep[];
  footer: string;
  prompt?: string;
};

const workflowTabs: Array<{ id: WorkflowMode; label: string }> = [
  { id: "without", label: "Sem a NeuroNex" },
  { id: "with", label: "Com a NeuroNex" },
];

const workflowContent: Record<WorkflowMode, WorkflowContent> = {
  without: {
    eyebrow: "O caos manual",
    title: "O custo invisível de operar cada parte manualmente.",
    subtitle:
      "Alternar entre vários sistemas, agenda, aplicativos e bancos esgota sua energia mental antes mesmo do atendimento começar.",
    steps: [
      {
        icon: ArrowLeftRight,
        title: "Troca constante de aplicativos",
        text: "Alternar entre WhatsApp, agenda e gerenciador para tentar descobrir o status de um paciente.",
      },
      {
        icon: Landmark,
        title: "Conferência manual no app do banco",
        text: "Sair do sistema, abrir o aplicativo do banco e procurar no extrato se o Pix da sessão caiu.",
      },
      {
        icon: CreditCard,
        title: "Cobrança em outro sistema",
        text: "Abrir outra plataforma de pagamentos, gerar o link ou comprovante e enviar manualmente.",
      },
      {
        icon: BrainCircuit,
        title: "Extração de padrões “de cabeça”",
        text: "Forçar a memória para lembrar o contexto das sessões anteriores e cruzar os relatos sem histórico conectado.",
      },
      {
        icon: Copy,
        title: "Reescrita e “copia e cola”",
        text: "Preencher formulários repetitivos, colar mensagens em abas diferentes e torcer para não esquecer nada. Alguns sistemas têm prontuário com IA, mas você sabe que isso não resolve tudo.",
      },
    ],
    footer: "5 aplicativos. Mais de 10 cliques. Nenhuma integração.",
  },
  with: {
    eyebrow: "Synapse em ação",
    title: "Tudo acontece no intervalo entre uma pergunta e uma resposta.",
    subtitle:
      "Você não navega pelo sistema. O Synapse percorre a estrutura, cruza os dados e traz a ação pronta. Ele alterna abas na sua tela para ilustrar sobre o que está falando: pode mencionar a agenda, levar você até ela e mostrar os detalhes de um agendamento. Você assiste e o contexto não se perde.",
    prompt:
      "Synapse, a Maria pagou a sessão de ontem? Aproveita e resuma os gatilhos de ansiedade que ela citou.",
    steps: [
      {
        icon: MessageCircle,
        title: "Uma pergunta em linguagem natural",
        text: "Você fala ou digita exatamente como pensa, sem precisar saber em qual aba o dado está.",
      },
      {
        icon: Network,
        title: "Navegação e cruzamento invisível",
        text: "Entre sua pergunta e a resposta, o Synapse lê a agenda, checa o financeiro, busca os relatos do prontuário em tempo real e segue as normativas do CFP nesse processo.",
      },
      {
        icon: Sparkles,
        title: "Ação preparada na tela",
        text: "O status do pagamento é verificado, o padrão do paciente é extraído e o próximo passo surge organizado para você.",
      },
      {
        icon: ShieldCheck,
        title: "Revisão e confirmação rápida",
        text: "A inteligência faz o trabalho pesado de buscar e organizar. Você apenas revisa e dá a palavra final.",
      },
    ],
    footer: "1 conversa. Zero cliques manuais. Você no controle.",
  },
};

const WorkflowStepCard = ({
  step,
  index,
  total,
  mode,
  shouldReduceMotion,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  mode: WorkflowMode;
  shouldReduceMotion: boolean;
}) => {
  const Icon = step.icon;
  const isConnected = mode === "with";

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }
      }
      className="relative grid grid-cols-[48px_minmax(0,1fr)] gap-4"
    >
      {index < total - 1 ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-[-16px] left-[23px] top-12",
            isConnected
              ? "w-px bg-foreground/[0.28] dark:bg-white/[0.24]"
              : "border-l border-dashed border-border/80 dark:border-white/14",
          )}
        />
      ) : null}
      <span
        className={cn(
          "relative z-10 flex h-12 w-12 items-center justify-center rounded-[17px] border",
          isConnected
            ? "border-foreground bg-foreground text-background shadow-[0_14px_36px_-22px_rgba(0,0,0,0.8)] dark:border-white dark:bg-white dark:text-zinc-950"
            : "border-border/65 bg-background/72 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]",
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <article
        className={cn(
          "rounded-[24px] border p-5 backdrop-blur-2xl",
          isConnected
            ? "border-foreground/[0.14] bg-background/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.64),0_24px_64px_-50px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_26px_70px_-48px_rgba(0,0,0,0.9)]"
            : "border-border/50 bg-card/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] dark:border-white/[0.07] dark:bg-white/[0.025]",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h4 className="text-base font-black leading-tight tracking-[-0.025em] text-foreground">
            {step.title}
          </h4>
          <span className="shrink-0 font-mono text-[9px] font-black text-muted-foreground/55">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground/75">
          {step.text}
        </p>
      </article>
    </motion.div>
  );
};

const WorkflowPanel = ({
  mode,
  shouldReduceMotion,
}: {
  mode: WorkflowMode;
  shouldReduceMotion: boolean;
}) => {
  const content = workflowContent[mode];
  const isConnected = mode === "with";

  return (
    <motion.div
      id={`workflow-panel-${mode}`}
      role="tabpanel"
      aria-labelledby={`workflow-tab-${mode}`}
      tabIndex={0}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 14, filter: "blur(7px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10, filter: "blur(5px)" }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
      }
      className={cn(
        "public-glass-surface relative overflow-hidden rounded-[44px] p-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background md:p-8 lg:p-10",
        isConnected
          ? "border-foreground/[0.14] bg-background/70"
          : "border-border/55 bg-card/50",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl",
          isConnected ? "bg-foreground/[0.075] dark:bg-white/[0.065]" : "bg-muted-foreground/[0.045]",
        )}
      />
      <div className="relative z-10 grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            {content.eyebrow}
          </p>
          <h3 className="mt-5 text-balance text-3xl font-black leading-[1.02] tracking-[-0.045em] text-foreground md:text-4xl">
            {content.title}
          </h3>
          <p className="mt-5 text-base font-medium leading-relaxed text-muted-foreground/75">
            {content.subtitle}
          </p>

          {content.prompt ? (
            <div className="mt-8 rounded-[26px] border border-foreground bg-foreground p-5 text-background shadow-[0_28px_74px_-48px_rgba(0,0,0,0.86)] dark:border-white dark:bg-white dark:text-zinc-950">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-background text-foreground dark:bg-zinc-950 dark:text-white">
                  <MessageCircle aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-52">
                  Exemplo de uso
                </p>
              </div>
              <blockquote className="mt-5 text-lg font-black leading-snug tracking-[-0.025em]">
                “{content.prompt}”
              </blockquote>
            </div>
          ) : null}

          <div
            className={cn(
              "mt-8 inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-xs font-black",
              isConnected
                ? "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950"
                : "border-border/60 bg-background/50 text-muted-foreground backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]",
            )}
          >
            {content.footer}
          </div>
        </div>

        <div className="space-y-4">
          <p className="pl-16 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {isConnected ? "O que acontece em milissegundos" : "Fluxo cronológico"}
          </p>
          {content.steps.map((step, index) => (
            <WorkflowStepCard
              key={step.title}
              step={step}
              index={index}
              total={content.steps.length}
              mode={mode}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export const LandingWorkflowDiagramSection = () => {
  const [activeMode, setActiveMode] = useState<WorkflowMode>("without");
  const shouldReduceMotion = Boolean(useReducedMotion());

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + workflowTabs.length) % workflowTabs.length;
    const nextTab = workflowTabs[nextIndex];
    setActiveMode(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`workflow-tab-${nextTab.id}`)?.focus());
  };

  return (
    <section className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto max-w-[1240px]">
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

        <FadeIn delay={0.14}>
          <div
            role="tablist"
            aria-label="Comparar a rotina sem e com a NeuroNex"
            className="public-glass-capsule relative isolate mx-auto mt-12 grid w-full max-w-[520px] grid-cols-2 rounded-[24px] p-1.5"
          >
            {workflowTabs.map((tab, index) => {
              const isActive = activeMode === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`workflow-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`workflow-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveMode(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "public-tactile relative min-h-12 rounded-[19px] px-5 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
                    isActive ? "text-background dark:text-zinc-950" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="workflow-active-tab"
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-[19px] border border-foreground/90 bg-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_14px_34px_-22px_rgba(0,0,0,0.72)] dark:border-white dark:bg-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_16px_38px_-22px_rgba(0,0,0,0.86)]"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 430, damping: 36, mass: 0.72 }
                      }
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </FadeIn>

        <div className="mt-8">
          <AnimatePresence mode="wait" initial={false}>
            <WorkflowPanel
              key={activeMode}
              mode={activeMode}
              shouldReduceMotion={shouldReduceMotion}
            />
          </AnimatePresence>
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
