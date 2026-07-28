"use client";

import { FadeIn } from "@/components/animations/FadeIn";
import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import {
  MobileRealFinanceSection,
  MobileRealProductShowcase,
} from "@/components/landing/MobileProductScreenshots";
import { Button } from "@/components/ui/button";
import { PUBLIC_PLAN_CARDS } from "@/content/public-plan-catalog";
import { SYNAPSE_COMMAND_EXAMPLES } from "@/content/public-positioning";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  Mic2,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";

type IconComponent = ElementType<{ className?: string }>;

const MobileBadge = ({
  children,
  icon: Icon = Sparkles,
  inverted = false,
}: {
  children: ReactNode;
  icon?: IconComponent;
  inverted?: boolean;
}) => (
  <div
    className={cn(
      "inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.18em]",
      inverted
        ? "border-background/15 bg-background/[0.07] text-background/65 dark:border-zinc-950/10 dark:bg-zinc-950/[0.05] dark:text-zinc-950/60"
        : "border-border/45 bg-foreground/[0.035] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]",
    )}
  >
    <span aria-hidden="true">
      <Icon className="h-3.5 w-3.5" />
    </span>
    {children}
  </div>
);

const MobileSectionHeader = ({
  eyebrow,
  title,
  description,
  inverted = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  inverted?: boolean;
}) => (
  <div className="mx-auto max-w-sm text-center">
    <FadeIn>
      <MobileBadge inverted={inverted}>{eyebrow}</MobileBadge>
    </FadeIn>
    <FadeIn delay={0.08}>
      <h2
        className={cn(
          "mt-6 text-balance text-[2.65rem] font-black leading-[0.94] tracking-[-0.055em]",
          inverted ? "text-background dark:text-zinc-950" : "text-foreground",
        )}
      >
        {title}
      </h2>
    </FadeIn>
    {description ? (
      <FadeIn delay={0.14}>
        <p
          className={cn(
            "mx-auto mt-6 max-w-[22rem] text-[0.95rem] font-medium leading-relaxed",
            inverted
              ? "text-background/66 dark:text-zinc-950/66"
              : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </FadeIn>
    ) : null}
  </div>
);

const problemCards = [
  {
    icon: LayoutDashboard,
    title: "Sua clínica inteira em 1 só lugar.",
    text: "Agenda, prontuário e financeiro conversam entre si. Chega de alternar entre várias telas ou reescrever a mesma informação.",
  },
  {
    icon: Fingerprint,
    title: "Curva de aprendizado zero",
    text: "Uma interface limpa e intuitiva, feita para poupar sua energia mental. Você não precisa \"estudar\" o sistema para começar a usar.",
  },
  {
    icon: BrainCircuit,
    title: "Inteligência com controle total",
    text: "O Synapse cruza os dados e prepara as ações reais para você. Ele faz o trabalho pesado, mas você mantém a palavra final.",
  },
];

const systemModules = [
  { icon: CalendarDays, title: "Agenda", text: "Horários e confirmações" },
  { icon: Users, title: "Pacientes", text: "Contexto e histórico" },
  { icon: ClipboardList, title: "Prontuário", text: "Registros e evolução" },
  { icon: WalletCards, title: "Financeiro", text: "Cobranças e recebimentos" },
];

const beforeSteps = [
  "Abrir a agenda",
  "Procurar o paciente",
  "Consultar o prontuário",
  "Conferir o financeiro",
  "Repetir os dados em outra tela",
];

const controlSteps = [
  {
    icon: Search,
    number: "01",
    title: "Encontra o contexto",
    text: "Mostra quais informações foram localizadas e de onde elas vieram.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "Prepara a ação",
    text: "Organiza a tarefa e deixa visível o que pretende fazer no sistema.",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Aguarda sua confirmação",
    text: "Ações importantes só são concluídas depois da sua autorização.",
  },
];

const journeyItems = [
  {
    icon: CalendarDays,
    title: "Antes da sessão",
    text: "Agenda e Teleconsulta colocam horário, paciente, sala e consentimento no mesmo caminho.",
    href: "/agenda-para-psicologos",
    label: "Ver Agenda",
  },
  {
    icon: Users,
    title: "Entre sessões",
    text: "Pacientes e Portal sustentam humor, tarefas, progresso e vínculo sem abrir o prontuário profissional.",
    href: "/portal-do-paciente",
    label: "Ver Portal",
  },
  {
    icon: WalletCards,
    title: "Na hora de cobrar",
    text: "Financeiro e comunicação entram com contexto para reduzir cobrança desconfortável e baixa manual.",
    href: "/neurofinance",
    label: "Ver NeuroFinance",
  },
  {
    icon: BrainCircuit,
    title: "Quando o caso pede leitura",
    text: "Synapse e NeuroBox conectam sinais, relatos e decisões que antes ficavam espalhados.",
    href: "/synapse",
    label: "Ver Synapse",
  },
];

const faqs = [
  {
    q: "O NeuroNex substitui minha agenda e meu prontuário atual?",
    a: "A proposta é centralizar a operação clínica. Agenda, pacientes, prontuário, teleconsulta, portal, financeiro e IA passam a conversar no mesmo fluxo.",
  },
  {
    q: "O Synapse toma decisões clínicas?",
    a: "Não. O Synapse encontra informações e prepara ações. Registros clínicos, mensagens ou movimentações importantes só são concluídos depois da revisão e autorização do psicólogo.",
  },
  {
    q: "O NeuroFinance movimenta dinheiro real?",
    a: "Sim, quando a conta financeira é criada e aprovada. Pix, cobranças, boletos e saques operam dentro de um fluxo financeiro integrado.",
  },
  {
    q: "O plano Profissional tem teste grátis?",
    a: "Sim. Você pode iniciar o período gratuito informado no plano antes de decidir pela assinatura.",
  },
];

const HeroMobile = () => (
  <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-background px-5 pb-16 pt-32 text-center">
    <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col items-center">
      <MobileBadge>Sistema operacional para psicólogos</MobileBadge>
      <FadeIn delay={0.05}>
        <h1 className="mt-7 text-balance text-[3.45rem] font-black leading-[0.9] tracking-[-0.065em] text-foreground">
          Todo o seu consultório,
          <br />
          em uma única conversa.
        </h1>
      </FadeIn>
      <FadeIn delay={0.12}>
        <p className="mx-auto mt-6 max-w-[22rem] text-base font-medium leading-relaxed text-muted-foreground">
          A primeira plataforma AI-Native da psicologia brasileira. Esqueça a navegação por menus: um sistema inteiro projetado para entender sua intenção e fazer o trabalho pesado por você.
        </p>
      </FadeIn>
      <FadeIn delay={0.18} className="mt-8 grid w-full gap-3">
        <Button asChild className="min-h-14 w-full rounded-2xl bg-foreground text-[11px] font-bold text-background shadow-premium">
          <Link to="/create-account">
            Começar grátis <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-14 w-full rounded-2xl border-border/50 bg-background text-[11px] font-bold">
          <a href="#como-funciona">Ver como funciona</a>
        </Button>
      </FadeIn>
      <p className="mt-5 text-xs font-semibold leading-relaxed text-muted-foreground">
        Você continua no controle e confirma o que muda.
      </p>
    </div>
  </section>
);

const ProblemMobile = () => (
  <section id="como-funciona" className="relative scroll-mt-24 overflow-hidden bg-background px-5 py-20">
    <MobileSectionHeader
      eyebrow="O problema real"
      title={<>Se o sistema consome mais energia do que seus pacientes, <span className="text-muted-foreground">ele falhou.</span></>}
      description={<>Sua rotina não deveria ser um labirinto de cliques. O Synapse cruza os dados de todas as abas e faz o trabalho pesado por você em tempo real. Esqueça os formulários. <strong className="font-black text-foreground">Apenas converse.</strong></>}
    />
    <div className="mx-auto mt-12 grid max-w-sm gap-3">
      {problemCards.map((item, index) => (
        <FadeIn key={item.title} delay={index * 0.05}>
          <article className="rounded-[28px] border border-border/45 bg-card p-6 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
              <item.icon aria-hidden="true" className="h-5 w-5" />
            </div>
            <h3 className="mt-7 text-xl font-black leading-tight tracking-[-0.035em] text-foreground">{item.title}</h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">{item.text}</p>
          </article>
        </FadeIn>
      ))}
    </div>
  </section>
);

const OperatingSystemMobile = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="diferenciais" className="relative overflow-hidden bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950">
      <MobileSectionHeader
        eyebrow="Sistema operacional"
        title={<>O Synapse não é um chat de canto. Ele trabalha no sistema inteiro.</>}
        description="Um chat de IA genérica conhece apenas o que você digita — você pergunta, ela responde. O Synapse trabalha e executa ações dentro de todo o sistema: ele encontra pacientes, navega pelas abas em tempo real, cruza agenda, prontuário e financeiro, traz insights contextualizados e prepara tarefas reais."
        inverted
      />
      <FadeIn delay={0.16}>
        <figure className="relative mx-auto mt-12 max-w-sm overflow-hidden rounded-[34px] border border-background/12 bg-background/[0.06] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
          <div aria-hidden="true" className="absolute bottom-14 left-1/2 top-16 w-px -translate-x-1/2 bg-background/20 dark:bg-zinc-950/18">
            <motion.span
              className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-background shadow-[0_0_16px_currentColor] dark:bg-zinc-950"
              animate={shouldReduceMotion ? undefined : { top: ["0%", "96%"], opacity: [0, 1, 1, 0] }}
              transition={shouldReduceMotion ? undefined : { duration: 3.2, ease: "linear", repeat: Infinity }}
            />
          </div>
          <div className="relative z-10 mx-auto flex min-h-16 w-fit items-center gap-3 rounded-2xl bg-background px-5 text-foreground dark:bg-zinc-950 dark:text-white">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
            <strong className="text-base font-black">Synapse AI</strong>
          </div>
          <div className="relative z-10 mt-6 grid grid-cols-2 gap-3">
            {systemModules.map((module, index) => (
              <motion.article
                key={module.title}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.06, duration: 0.38 }}
                className="min-h-36 rounded-[22px] border border-zinc-800 bg-zinc-900 p-4 dark:border-zinc-200 dark:bg-zinc-100"
              >
                <module.icon aria-hidden="true" className="h-5 w-5 opacity-60" />
                <h3 className="mt-6 text-sm font-black">{module.title}</h3>
                <p className="mt-2 text-xs font-medium leading-relaxed opacity-60">{module.text}</p>
              </motion.article>
            ))}
          </div>
          <figcaption className="sr-only">Synapse AI conectado à agenda, aos pacientes, ao prontuário e ao financeiro.</figcaption>
        </figure>
      </FadeIn>
    </section>
  );
};

const WorkflowMobile = () => (
  <section className="relative overflow-hidden bg-background px-5 py-20">
    <MobileSectionHeader
      eyebrow="A mudança prática"
      title={<>De várias telas para uma simples conversa.</>}
      description="Para resolver uma pendência, o fluxo antigo obriga você a procurar a mesma informação em áreas diferentes. Na NeuroNex, o Synapse percorre esse caminho e organiza tudo para sua revisão."
    />
    <div className="mx-auto mt-12 grid max-w-sm gap-5">
      <FadeIn>
        <article className="rounded-[32px] border border-border/45 bg-card p-6 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Antes</p>
          <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-foreground">Você opera cada parte.</h3>
          <div className="mt-7 space-y-2">
            {beforeSteps.map((step, index) => (
              <div key={step} className="flex min-h-12 items-center gap-3 rounded-2xl border border-border/45 bg-background px-4 dark:border-white/10">
                <span className="font-mono text-[9px] font-black text-muted-foreground">0{index + 1}</span>
                <span className="text-sm font-bold text-foreground">{step}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs font-black text-muted-foreground">Cinco telas. A mesma informação repetida.</p>
        </article>
      </FadeIn>
      <div aria-hidden="true" className="flex justify-center text-muted-foreground"><ArrowDown className="h-5 w-5" /></div>
      <FadeIn>
        <article className="rounded-[32px] border border-foreground/15 bg-foreground/[0.04] p-6 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Com a NeuroNex</p>
          <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-foreground">Você conversa com o todo.</h3>
          <div className="mt-7 rounded-[24px] bg-foreground p-5 text-background dark:bg-white dark:text-zinc-950">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
            <p className="mt-5 text-lg font-black leading-snug">“Synapse, quem precisa da minha atenção hoje?”</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["Agenda", "Prontuário", "Financeiro"].map((module) => (
              <div key={module} className="flex min-h-14 items-center justify-center rounded-2xl border border-border/45 bg-background px-2 text-center text-[9px] font-black uppercase tracking-[0.08em] dark:border-white/10">{module}</div>
            ))}
          </div>
          <div className="mt-3 rounded-[22px] border border-border/45 bg-background p-4 dark:border-white/10">
            <p className="text-sm font-black text-foreground">Contexto cruzado. Ação preparada.</p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">Você revisa o que o Synapse encontrou e confirma o próximo passo.</p>
          </div>
          <p className="mt-6 text-center text-xs font-black text-foreground">Uma conversa. Tudo no mesmo contexto.</p>
        </article>
      </FadeIn>
    </div>
  </section>
);

const HumanControlMobile = () => (
  <section id="controle" className="relative overflow-hidden bg-background px-5 py-20">
    <MobileSectionHeader
      eyebrow="Controle humano, sempre"
      title={<>O Synapse prepara. Você decide.</>}
      description="Você vê quais informações foram encontradas, o que será preparado e o que vai mudar. Ações importantes só são concluídas depois da sua autorização."
    />
    <div className="mx-auto mt-12 grid max-w-sm gap-3">
      {controlSteps.map((step, index) => (
        <FadeIn key={step.title} delay={index * 0.05}>
          <article className={cn("rounded-[28px] border p-6", index === controlSteps.length - 1 ? "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950" : "border-border/45 bg-card text-foreground dark:border-white/10 dark:bg-white/[0.03]")}>
            <div className="flex items-center justify-between">
              <step.icon aria-hidden="true" className="h-5 w-5" />
              <span className="font-mono text-[9px] font-black opacity-45">{step.number}</span>
            </div>
            <h3 className="mt-8 text-xl font-black tracking-[-0.035em]">{step.title}</h3>
            <p className={cn("mt-3 text-sm font-medium leading-relaxed", index === controlSteps.length - 1 ? "opacity-65" : "text-muted-foreground")}>{step.text}</p>
          </article>
        </FadeIn>
      ))}
    </div>
    <div className="mx-auto mt-6 flex min-h-12 max-w-sm items-center justify-center gap-3 rounded-full border border-border/50 bg-background px-5 text-center text-xs font-black dark:border-white/10">
      <Check aria-hidden="true" className="h-4 w-4" /> Nada importante muda sem sua autorização.
    </div>
  </section>
);

const SynapseChannelsMobile = () => (
  <section id="synapse" className="relative overflow-hidden bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950">
    <MobileSectionHeader
      eyebrow="Synapse na NeuroNex"
      title={<>Converse com o Synapse. No WhatsApp ou no sistema, o cérebro é o mesmo.</>}
      description="Envie texto ou áudio como em qualquer conversa. O Synapse consulta o contexto da sua clínica no sistema e prepara uma ação ou te informa sobre ela — você não precisa abrir o notebook nem procurar por menus."
      inverted
    />
    <div className="mx-auto mt-12 max-w-sm">
      <h3 className="text-center text-[2.35rem] font-black leading-[0.94] tracking-[-0.05em]">O verdadeiro significado de “tanto faz”.</h3>
      <div className="mt-8 grid gap-3">
        {[
          { icon: LayoutDashboard, text: "Trabalhe pelo sistema." },
          { icon: Mic2, text: "Continue pelo celular." },
          { icon: MessageCircle, text: "Peça pelo WhatsApp." },
        ].map((item) => (
          <div key={item.text} className="flex min-h-16 items-center gap-4 rounded-[22px] border border-background/12 bg-background/[0.07] px-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
            <item.icon aria-hidden="true" className="h-5 w-5 opacity-55" />
            <strong className="text-sm">{item.text}</strong>
          </div>
        ))}
      </div>
      <p className="mt-7 text-center text-sm font-medium leading-relaxed opacity-68">
        Comece no sistema e continue no WhatsApp — ou faça o caminho inverso. <strong className="font-black opacity-100">Tanto faz, você decide.</strong> A conversa pode mudar de canal, mas o contexto sempre continua.
      </p>

      <div className="mt-16 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">Sua clínica, no seu bolso</p>
        <h3 className="mt-4 text-[2.35rem] font-black leading-[0.94] tracking-[-0.05em]">Converse com sua clínica, em linguagem natural.</h3>
      </div>
      <div className="mt-8 overflow-hidden rounded-[28px] border border-background/12 dark:border-zinc-950/10">
        {SYNAPSE_COMMAND_EXAMPLES.slice(0, 4).map((example, index) => (
          <details key={example.title} className="group border-b border-background/12 last:border-b-0 dark:border-zinc-950/10">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 px-5 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current">
              <span className="font-mono text-[9px] font-black opacity-45">0{index + 1}</span>
              <span className="flex-1 text-left text-sm font-black">{example.title}</span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 opacity-55 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="px-5 pb-5">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] opacity-45">{example.modules.join(" · ")}</p>
              <p className="mt-4 rounded-[20px] bg-background/[0.08] p-4 text-sm font-semibold leading-relaxed dark:bg-zinc-950/[0.06]">“{example.command}”</p>
            </div>
          </details>
        ))}
      </div>
      <Button asChild className="mt-6 min-h-14 w-full rounded-2xl bg-background text-[10px] font-black uppercase tracking-[0.16em] text-foreground dark:bg-zinc-950 dark:text-white">
        <Link to="/synapse">Conhecer o Synapse <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
      </Button>
    </div>
  </section>
);

const ContinuityMobile = () => (
  <section className="relative overflow-hidden bg-foreground px-5 py-20 text-center text-background dark:bg-white dark:text-zinc-950">
    <div className="mx-auto max-w-sm">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-45">Contexto preservado</p>
      <h2 className="mt-6 text-balance text-[2.65rem] font-black leading-[0.94] tracking-[-0.055em]">Seu prontuário profissional é seu. O paciente recebe apenas o que você decidir compartilhar.</h2>
      <p className="mt-6 text-sm font-medium leading-relaxed opacity-66">Mantenha resumo, sessões, anamneses, humor, metas, planos, financeiro e arquivos no seu prontuário. O paciente acessa somente o que foi destinado a ele, através do Portal do Paciente.</p>
      <div className="mt-8 grid gap-3">
        <Button asChild className="min-h-14 rounded-2xl bg-background text-[10px] font-black uppercase tracking-[0.16em] text-foreground dark:bg-zinc-950 dark:text-white">
          <Link to="/prontuario-para-psicologos">Ver Prontuário <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
        </Button>
        <Button asChild variant="outline" className="min-h-14 rounded-2xl border-background/20 bg-transparent text-[10px] font-black uppercase tracking-[0.16em] text-background dark:border-zinc-950/20 dark:text-zinc-950">
          <Link to="/portal-do-paciente">Ver Portal do Paciente</Link>
        </Button>
      </div>
    </div>
  </section>
);

const TrustFAQMobile = () => (
  <section id="seguranca" className="relative overflow-hidden bg-background px-5 py-20">
    <FadeIn>
      <article className="mx-auto max-w-sm rounded-[34px] border border-border/45 bg-card p-6 dark:border-white/10 dark:bg-white/[0.035]">
        <ShieldCheck aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
        <h2 className="mt-8 text-[2.55rem] font-black leading-[0.94] tracking-[-0.055em] text-foreground">Construído para uma rotina sensível.</h2>
        <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground">Psicologia exige responsabilidade. Segurança, controle de acesso, rastreabilidade e uso cuidadoso de IA precisam estar no centro.</p>
        <div className="mt-7 grid gap-2">
          {["LGPD e controle de acesso", "IA como apoio, não substituição", "Rastreabilidade de dados sensíveis"].map((item) => (
            <div key={item} className="flex min-h-12 items-center gap-3 rounded-2xl border border-border/45 bg-background px-4 text-xs font-bold text-foreground dark:border-white/10">
              <LockKeyhole aria-hidden="true" className="h-4 w-4" /> {item}
            </div>
          ))}
        </div>
      </article>
    </FadeIn>
    <div className="mx-auto mt-4 max-w-sm overflow-hidden rounded-[28px] border border-border/45 bg-card dark:border-white/10 dark:bg-white/[0.035]">
      {faqs.map((faq) => (
        <details key={faq.q} className="group border-b border-border/45 last:border-b-0 dark:border-white/10">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <span className="text-left text-sm font-black text-foreground">{faq.q}</span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <p className="px-5 pb-5 text-sm font-medium leading-relaxed text-muted-foreground">{faq.a}</p>
        </details>
      ))}
    </div>
  </section>
);

const ExploreMobile = () => (
  <section className="relative overflow-hidden bg-background px-5 py-20">
    <MobileSectionHeader eyebrow="Explore por módulo" title={<>Conheça cada parte da sua clínica.</>} description="Aprofunde-se na área que mais importa agora. Agenda, Portal, NeuroFinance e Synapse continuam ligados ao mesmo sistema." />
    <div className="mx-auto mt-12 grid max-w-sm gap-3">
      {journeyItems.map((item, index) => (
        <FadeIn key={item.title} delay={index * 0.04}>
          <article className="rounded-[28px] border border-border/45 bg-card p-6 dark:border-white/10 dark:bg-white/[0.03]">
            <item.icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            <h3 className="mt-7 text-xl font-black tracking-[-0.035em] text-foreground">{item.title}</h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">{item.text}</p>
            <Link to={item.href} className="mt-6 inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-[0.14em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {item.label} <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </Link>
          </article>
        </FadeIn>
      ))}
    </div>
  </section>
);

const PlansMobile = () => (
  <section id="pricing" className="relative overflow-hidden bg-background px-5 py-20">
    <MobileSectionHeader eyebrow="Planos NeuroNex" title={<>Comece no seu ritmo.</>} description="Escolha o Essential gratuito ou teste o plano Profissional para ampliar escala, contexto e operação financeira." />
    <div className="mx-auto mt-12 max-w-sm space-y-4">
      {PUBLIC_PLAN_CARDS.map((plan, index) => (
        <FadeIn key={plan.name} delay={index * 0.05}>
          <article className={cn("rounded-[34px] border p-6", plan.featured ? "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950" : "border-border/45 bg-card text-foreground dark:border-white/10 dark:bg-white/[0.035]")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn("text-[9px] font-black uppercase tracking-[0.18em]", plan.featured ? "opacity-50" : "text-muted-foreground")}>{plan.eyebrow}</p>
                <h3 className="mt-3 text-3xl font-black tracking-[-0.05em]">{plan.name}</h3>
              </div>
              {plan.featured ? <BadgeCheck aria-hidden="true" className="h-6 w-6" /> : <Sparkles aria-hidden="true" className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-[-0.055em]">{plan.price}</span><span className="pb-1 text-xs font-bold opacity-50">{plan.period}</span></div>
            <p className={cn("mt-4 text-sm font-medium leading-relaxed", plan.featured ? "opacity-65" : "text-muted-foreground")}>{plan.description}</p>
            <div className="mt-7 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 text-sm font-semibold leading-relaxed opacity-75"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>{feature}</span></div>
              ))}
            </div>
            <Button asChild className={cn("mt-8 min-h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.16em]", plan.featured ? "bg-background text-foreground dark:bg-zinc-950 dark:text-white" : "bg-foreground text-background")}>
              <Link to={plan.href}>{plan.cta} <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
            </Button>
          </article>
        </FadeIn>
      ))}
    </div>
  </section>
);

const FinalCTAMobile = () => (
  <section id="cta-final" className="relative overflow-hidden bg-background px-5 py-20">
    <div className="mx-auto max-w-sm rounded-[38px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-foreground dark:bg-zinc-950 dark:text-white"><Fingerprint aria-hidden="true" className="h-6 w-6" /></div>
      <h2 className="mt-8 text-[2.65rem] font-black leading-[0.94] tracking-[-0.055em]">Usar a NeuroNex pode ser perigosamente viciante.</h2>
      <p className="mt-6 text-sm font-medium leading-relaxed opacity-70">Não porque prende você à tela, mas porque facilmente tira você dela.</p>
      <div className="mt-8 grid gap-3">
        <Button asChild className="min-h-14 rounded-2xl bg-background text-[10px] font-black uppercase tracking-[0.16em] text-foreground dark:bg-zinc-950 dark:text-white"><Link to="/create-account">Começar grátis <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link></Button>
        <Button asChild variant="outline" className="min-h-14 rounded-2xl border-background/20 bg-transparent text-[10px] font-black uppercase tracking-[0.16em] text-background dark:border-zinc-950/20 dark:text-zinc-950"><Link to="/contato">Falar com suporte</Link></Button>
      </div>
    </div>
  </section>
);

const NeuroXMobile = () => (
  <section className="bg-background px-5 pb-20">
    <div className="mx-auto flex max-w-sm items-start gap-4 rounded-[28px] border border-border/45 bg-card p-6 dark:border-white/10 dark:bg-white/[0.03]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/45 bg-background dark:border-white/10"><BookOpen aria-hidden="true" className="h-5 w-5 text-muted-foreground" /></span>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">NeuroX</p>
        <h2 className="mt-2 text-xl font-black leading-tight text-foreground">Conteúdo claro para decisões melhores.</h2>
        <Link to="/blog" className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Explorar o NeuroX <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>
      </div>
    </div>
  </section>
);

export const MobileIndex = () => (
  <div className="public-home-page relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/30">
    <main>
      <HeroMobile />
      <ProblemMobile />
      <OperatingSystemMobile />
      <WorkflowMobile />
      <HumanControlMobile />
      <SynapseChannelsMobile />
      <MobileRealProductShowcase />
      <ContinuityMobile />
      <MobileRealFinanceSection />
      <TrustFAQMobile />
      <ExploreMobile />
      <PlansMobile />
      <FinalCTAMobile />
      <NeuroXMobile />
    </main>
    <Footer />
    <LandingMobileNav />
  </div>
);
