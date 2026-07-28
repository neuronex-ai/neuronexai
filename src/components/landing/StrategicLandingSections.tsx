"use client";

import type { ElementType } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  Fingerprint,
  LockKeyhole,
  MessageCircle,
  Mic2,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/FadeIn";
import { PUBLIC_PLAN_COMPARISON } from "@/content/public-plan-catalog";
import { cn } from "@/lib/utils";

const SectionBadge = ({ children, icon: Icon = Sparkles }: { children: React.ReactNode; icon?: ElementType<{ className?: string }> }) => (
  <div className="inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-foreground/[0.035] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.26em] text-muted-foreground backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.045] dark:text-white/42">
    <Icon className="h-3.5 w-3.5" />
    {children}
  </div>
);

const SectionHeader = ({ eyebrow, title, description, align = "center" }: { eyebrow: string; title: React.ReactNode; description?: React.ReactNode; align?: "center" | "left" }) => (
  <div className={cn("mx-auto max-w-5xl", align === "center" ? "text-center" : "text-left")}> 
    <FadeIn>
      <SectionBadge>{eyebrow}</SectionBadge>
    </FadeIn>
    <FadeIn delay={0.12}>
      <h2 className="mt-8 text-4xl font-bold leading-[1.02] tracking-tight text-foreground md:text-6xl">
        {title}
      </h2>
    </FadeIn>
    {description ? (
      <FadeIn delay={0.2}>
        <p className={cn("mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl", align === "center" && "mx-auto")}>{description}</p>
      </FadeIn>
    ) : null}
  </div>
);

const painPoints = [
  {
    icon: ClipboardList,
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

export const LandingProblemSection = () => (
  <section id="como-funciona" className="public-section-stage relative scroll-mt-24 overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <SectionHeader
        eyebrow="O problema real"
        title={
          <>
            Se o sistema consome mais
            <br />
            energia do que seus pacientes,
            <br />
            <span className="text-muted-foreground">ele falhou.</span>
          </>
        }
        description={(
          <>
            Sua rotina não deveria ser um labirinto de cliques. O Synapse cruza os dados de todas as abas e faz o trabalho pesado por você em tempo real. Esqueça os formulários. <strong className="font-black text-foreground">Apenas converse.</strong>
          </>
        )}
      />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {painPoints.map((item, index) => (
          <FadeIn key={item.title} delay={index * 0.05}>
            <article className="group relative h-full overflow-hidden rounded-[30px] border border-border bg-card p-6 transition-colors duration-200 hover:border-foreground/25">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-border/40 bg-foreground/[0.045] text-foreground dark:border-white/10 dark:bg-white/[0.055]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="relative z-10 mt-7 text-lg font-black tracking-[-0.03em] text-foreground">{item.title}</h3>
              <p className="relative z-10 mt-3 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
            </article>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

const comparisonRows = [
  {
    title: "Registrar atendimentos",
    old: "Prontuário preenchido manualmente, anotações dispersas e pouca continuidade entre sessões.",
    neo: "Prontuário inteligente com histórico, evolução, resumos e contexto clínico acessível.",
    bold: "Prontuário vivo",
  },
  {
    title: "Acompanhar o paciente",
    old: "O paciente some entre sessões e dados importantes ficam fora do acompanhamento.",
    neo: "Portal do Paciente com diário, rastreio de humor e continuidade clínica estruturada.",
    bold: "Acompanhamento contínuo",
  },
  {
    title: "Fazer teleconsulta",
    old: "Reunião online sem registro estruturado e com retrabalho para documentar depois.",
    neo: "Teleconsulta HD com transcrição, resumo por IA e dados conectados ao prontuário.",
    bold: "Sessão vira dado útil",
  },
  {
    title: "Cobrar e receber",
    old: "Pix manual, boleto externo, planilha, baixa manual e visão financeira incompleta.",
    neo: "NeuroFinance com cobranças, Pix, QR Code, boletos, extrato e gestão integrada.",
    bold: "Financeiro nativo",
  },
  {
    title: "Preparar dados e rotinas fiscais",
    old: "NFS-e, recibos e obrigações fiscais ficam separados da rotina clínica e financeira.",
    neo: "Dados fiscais organizados junto da cobrança, enquanto as automações de emissão evoluem.",
    bold: "Preparação fiscal",
  },
  {
    title: "Usar inteligência artificial",
    old: "Uma resposta textual isolada ainda exige localizar a tela, copiar o resultado e concluir cada ação manualmente.",
    neo: "O Synapse consulta contexto autorizado e prepara o próximo passo, deixando revisão, confirmação e resultado visíveis.",
    bold: "IA operacional governada",
  },
];

export const LandingDifferentiatorTable = () => (
  <section id="diferenciais" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1280px]">
      <SectionHeader
        eyebrow="O diferencial"
        title={
          <>
            Na NeuroNex, cada etapa
            <br />
            <span className="text-muted-foreground">continua a anterior.</span>
          </>
        }
        description="O paciente agenda, a sessão acontece, o registro é revisado e a cobrança continua ligada ao atendimento."
      />

      <FadeIn delay={0.22}>
        <div className="mt-16 overflow-hidden rounded-[36px] border border-border/50 bg-card shadow-[0_34px_120px_-80px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-[#0b0b0d]">
          <div className="grid grid-cols-[0.88fr_1fr_1.05fr] border-b border-border/50 dark:border-white/10">
            <div className="bg-foreground/[0.045] p-7 dark:bg-white/[0.025]" />
            <div className="bg-foreground/[0.055] p-7 text-center dark:bg-white/[0.04]">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Fluxo fragmentado</p>
            </div>
            <div className="bg-foreground p-7 text-center text-background dark:bg-white dark:text-zinc-950">
              <p className="text-[11px] font-black uppercase tracking-[0.16em]">Operação NeuroNex</p>
            </div>
          </div>
          {comparisonRows.map((row, index) => (
            <div key={row.title} className="grid grid-cols-[0.88fr_1fr_1.05fr] border-b border-border/45 last:border-b-0 dark:border-white/10">
              <div className="flex items-center bg-foreground/[0.045] p-7 dark:bg-white/[0.025]">
                <h3 className="text-lg font-black leading-snug tracking-[-0.03em] text-foreground"><span className="mr-2 text-muted-foreground/40">{index + 1}.</span>{row.title}</h3>
              </div>
              <div className="flex items-start gap-4 bg-foreground/[0.025] p-7 dark:bg-white/[0.018]">
                <X className="mt-1 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm font-medium leading-relaxed text-muted-foreground/78">{row.old}</p>
              </div>
              <div className="flex items-start gap-4 bg-foreground p-7 text-background dark:bg-white dark:text-zinc-950">
                <Check className="mt-1 h-4 w-4 shrink-0" />
                <p className="text-sm font-medium leading-relaxed opacity-85"><strong className="opacity-100">{row.bold}.</strong> {row.neo}</p>
              </div>
            </div>
          ))}
        </div>
      </FadeIn>
    </div>
  </section>
);

const productModules = [
  {
    key: "agenda",
    label: "Agenda",
    title: "Agenda Inteligente",
    icon: CalendarDays,
    subtitle: "Horários, confirmações, salas e visão operacional do dia em um fluxo único.",
    bullets: ["Visão diária e mensal", "Confirmações e lembretes", "Base para receita e comparecimento"],
  },
  {
    key: "prontuario",
    label: "Prontuário",
    title: "Prontuário Vivo",
    icon: ClipboardList,
    subtitle: "Histórico clínico, evolução, documentos e resumos com uma experiência segura e fluida.",
    bullets: ["Linha do tempo do paciente", "Resumo por IA", "Documentos e registros integrados"],
  },
  {
    key: "teleconsulta",
    label: "Teleconsulta",
    title: "Teleconsulta HD",
    icon: MonitorPlay,
    subtitle: "Atendimento online com transcrição e resumo para reduzir retrabalho após a sessão.",
    bullets: ["Sala online integrada", "Transcrição assistida", "Resumo conectado ao prontuário"],
  },
  {
    key: "portal",
    label: "Portal",
    title: "Portal do Paciente",
    icon: Users,
    subtitle: "Um espaço para o paciente acompanhar sua jornada com diário, humor e vínculo entre sessões.",
    bullets: ["Diário do paciente", "Rastreio de humor", "Experiência mobile"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    title: "NeuroFinance",
    icon: CreditCard,
    subtitle: "Cobranças, Pix, boletos, saques, extrato e saúde da conta no mesmo painel.",
    bullets: ["Pix e QR Code", "Boletos e cobranças", "Extrato e gestão financeira"],
  },
  {
    key: "fiscal",
    label: "Fiscal",
    title: "Dados fiscais e evolução da NFS-e",
    icon: FileCheck2,
    subtitle: "A base fiscal acompanha a clínica; emissão e automações ainda estão em evolução.",
    bullets: ["Emissão no fluxo", "Dados conectados", "Menos tarefas repetitivas"],
  },
];

const ProductMock = ({ active }: { active: typeof productModules[number] }) => {
  const rows = useMemo(() => [
    ["Paciente", "Status", "Próxima ação"],
    ["Maria P.", "Sessão confirmada", "Resumo pendente"],
    ["Roberto A.", "Cobrança enviada", "Acompanhar pagamento"],
    ["Carlos M.", "Diário atualizado", "Revisar humor"],
  ], []);

  return (
    <div className="relative min-h-[460px] overflow-hidden rounded-[38px] border border-border/40 bg-card/80 p-5 shadow-[0_40px_120px_-72px_rgba(0,0,0,0.7)] dark:border-white/10 dark:bg-[#0a0a0c]">
      <div className="relative z-10 flex items-center justify-between rounded-[24px] border border-border/40 bg-background/80 px-5 py-4 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background"><active.icon className="h-5 w-5" /></div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-muted-foreground">NeuroNex</p>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-foreground">{active.title}</p>
          </div>
        </div>
        <div className="hidden h-9 items-center gap-2 rounded-full border border-border/40 bg-foreground/[0.035] px-4 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground md:flex">
          Produto real
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.key}
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mt-5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]"
        >
          <div className="rounded-[28px] border border-border/40 bg-background/70 p-5 dark:border-white/10 dark:bg-white/[0.035]">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Módulo</p>
            <h3 className="mt-3 text-4xl font-black tracking-[-0.06em] text-foreground">{active.title}</h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{active.subtitle}</p>
            <div className="mt-7 space-y-3">
              {active.bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-border/35 bg-foreground/[0.025] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
                  <Check className="h-4 w-4" />
                  {bullet}
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-border/40 bg-background dark:border-white/10 dark:bg-[#050506]">
            <div className="flex items-center gap-2 border-b border-border/40 px-5 py-4 dark:border-white/10">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/18" />
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/12" />
              <span className="ml-auto text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Preview</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3">
                {rows[0].map((head) => <div key={head} className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">{head}</div>)}
              </div>
              <div className="mt-3 space-y-2">
                {rows.slice(1).map((row) => (
                  <div key={row[0]} className="grid grid-cols-3 gap-3 rounded-2xl border border-border/35 bg-foreground/[0.025] px-4 py-3 text-[11px] font-bold text-foreground/80 dark:border-white/10 dark:bg-white/[0.035]">
                    {row.map((cell) => <div key={cell} className="truncate">{cell}</div>)}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[26px] bg-foreground p-5 text-background dark:bg-white dark:text-zinc-950">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] opacity-55">Próximo refinamento</p>
                <p className="mt-3 text-xl font-black tracking-[-0.04em]">Aqui entram os prints reais do Drive.</p>
                <p className="mt-2 text-xs font-medium leading-relaxed opacity-60">Quando você enviar o link, substituímos este mock por galerias reais das abas internas.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export const LandingProductShowcase = () => {
  const [activeKey, setActiveKey] = useState(productModules[0].key);
  const active = productModules.find((item) => item.key === activeKey) || productModules[0];

  return (
    <section id="produto" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto max-w-[1280px]">
        <SectionHeader
          eyebrow="Por dentro do NeuroNex"
          title={<>Um produto real para operar <span className="text-muted-foreground">a clínica inteira.</span></>}
          description="A próxima versão desta seção receberá os prints reais do sistema. A estrutura já está preparada para alternar entre as principais abas do NeuroNex."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="grid gap-2 self-start rounded-[30px] border border-border/40 bg-card/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            {productModules.map((module) => (
              <button
                key={module.key}
                type="button"
                onClick={() => setActiveKey(module.key)}
                className={cn(
                  "group flex items-center gap-3 rounded-[22px] px-4 py-4 text-left transition-all duration-300",
                  activeKey === module.key ? "bg-foreground text-background shadow-[0_18px_60px_-38px_rgba(0,0,0,0.55)]" : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground"
                )}
              >
                <module.icon className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">{module.label}</span>
              </button>
            ))}
          </div>
          <ProductMock active={active} />
        </div>
      </div>
    </section>
  );
};

type CubicCurve = readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
];

const getCubicPath = (curve: CubicCurve) => {
  const [start, controlA, controlB, end] = curve;
  return `M ${start[0]} ${start[1]} C ${controlA[0]} ${controlA[1]}, ${controlB[0]} ${controlB[1]}, ${end[0]} ${end[1]}`;
};

const sampleCubicCurve = (curve: CubicCurve, sampleCount = 49) => {
  const [start, controlA, controlB, end] = curve;

  return Array.from({ length: sampleCount }, (_, index) => {
    const t = index / (sampleCount - 1);
    const inverseT = 1 - t;
    const inverseTSquared = inverseT * inverseT;
    const tSquared = t * t;

    return {
      x:
        inverseTSquared * inverseT * start[0]
        + 3 * inverseTSquared * t * controlA[0]
        + 3 * inverseT * tSquared * controlB[0]
        + tSquared * t * end[0],
      y:
        inverseTSquared * inverseT * start[1]
        + 3 * inverseTSquared * t * controlA[1]
        + 3 * inverseT * tSquared * controlB[1]
        + tSquared * t * end[1],
    };
  });
};

const systemCards = [
  {
    icon: CalendarDays,
    title: "Agenda e pacientes",
    text: "Horários, confirmações e contexto do paciente seguem juntos.",
    x: 150,
    y: 105,
    curve: [[500, 310], [390, 310], [350, 105], [150, 105]] as const,
  },
  {
    icon: ClipboardList,
    title: "Prontuário clínico",
    text: "Registros, evolução e documentos preservam a continuidade clínica.",
    x: 125,
    y: 310,
    curve: [[500, 310], [365, 310], [285, 310], [125, 310]] as const,
  },
  {
    icon: MonitorPlay,
    title: "Teleconsulta",
    text: "Atendimento e documentação permanecem no mesmo fluxo.",
    x: 150,
    y: 515,
    curve: [[500, 310], [390, 310], [350, 515], [150, 515]] as const,
  },
  {
    icon: MessageCircle,
    title: "Comunicação",
    text: "Portal do Paciente e NeuroZap conectam as conversas autorizadas.",
    x: 850,
    y: 105,
    curve: [[500, 310], [610, 310], [650, 105], [850, 105]] as const,
  },
  {
    icon: CreditCard,
    title: "NeuroFinance",
    text: "Cobranças, Pix, boletos e extrato acompanham o atendimento.",
    x: 875,
    y: 310,
    curve: [[500, 310], [635, 310], [715, 310], [875, 310]] as const,
  },
  {
    icon: FileCheck2,
    title: "Preparação fiscal",
    text: "Dados financeiros e fiscais permanecem próximos e organizados.",
    x: 850,
    y: 515,
    curve: [[500, 310], [610, 310], [650, 515], [850, 515]] as const,
  },
];

const SynapseConnectionMap = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <figure className="mt-14" aria-labelledby="synapse-connection-caption">
      <figcaption id="synapse-connection-caption" className="sr-only">
        Synapse conectado à agenda, aos pacientes, ao prontuário, à teleconsulta, à comunicação, ao financeiro e à preparação fiscal.
      </figcaption>
      <div className="relative mx-auto hidden h-[620px] max-w-[1100px] md:block">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/55 dark:border-zinc-200/70" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/70 dark:border-zinc-200/85" />

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-zinc-600 dark:text-zinc-300"
          viewBox="0 0 1000 620"
          fill="none"
        >
          {systemCards.map((card, index) => {
            const path = getCubicPath(card.curve);
            const pulsePoints = sampleCubicCurve(card.curve);

            return (
              <g key={card.title}>
                <path
                  d={path}
                  stroke="currentColor"
                  strokeDasharray="3 8"
                  strokeLinecap="round"
                  strokeWidth="1"
                  className="opacity-20"
                />
                <motion.path
                  d={path}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.7"
                  initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.56 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ duration: 0.9, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
                {!shouldReduceMotion ? (
                  <motion.circle
                    r="3.5"
                    fill="currentColor"
                    initial={{ opacity: 0 }}
                    animate={{
                      cx: pulsePoints.map((point) => point.x),
                      cy: pulsePoints.map((point) => point.y),
                      opacity: [0, 0.9, 0.9, 0],
                      scale: [0.7, 1, 1, 0.7],
                    }}
                    transition={{
                      duration: 2.4,
                      delay: 0.8 + index * 0.42,
                      ease: "linear",
                      repeat: Infinity,
                      repeatDelay: 1.9,
                    }}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.86 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ type: "spring", stiffness: 165, damping: 18 }}
            className="relative flex h-[190px] w-[190px] items-center justify-center rounded-full border border-zinc-800 bg-background text-center text-foreground shadow-[0_32px_90px_-38px_rgba(0,0,0,0.72)] dark:border-zinc-200 dark:bg-zinc-950 dark:text-white"
          >
            {!shouldReduceMotion ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-[-14px] rounded-full border border-zinc-800 dark:border-zinc-200"
                animate={{ scale: [0.94, 1.07, 0.94], opacity: [0.24, 0.65, 0.24] }}
                transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
              />
            ) : null}
            <strong className="text-2xl font-black tracking-[-0.05em]">Synapse AI</strong>
          </motion.div>
        </div>

        {systemCards.map((card, index) => (
          <div
            key={card.title}
            className="absolute z-10 w-[250px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${card.x / 10}%`, top: `${(card.y / 620) * 100}%` }}
          >
            <motion.article
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.012 }}
              viewport={{ once: true, amount: 0.55 }}
              transition={{ duration: 0.48, delay: 0.15 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-[132px] rounded-[28px] border border-zinc-800/90 bg-zinc-900/90 p-5 text-left shadow-[0_28px_70px_-50px_rgba(0,0,0,0.7)] backdrop-blur-xl dark:border-zinc-200/90 dark:bg-zinc-100/90"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-zinc-700/75 bg-zinc-800/80 dark:border-zinc-200 dark:bg-zinc-200/75">
                <card.icon className="h-[18px] w-[18px] opacity-65" />
              </span>
              <h3 className="mt-4 text-base font-black tracking-[-0.03em]">{card.title}</h3>
              <p className="mt-2 text-xs font-medium leading-relaxed opacity-60">{card.text}</p>
            </motion.article>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:hidden">
        <div className="mb-2 flex items-center justify-center rounded-[24px] bg-background px-5 py-4 text-foreground dark:bg-zinc-950 dark:text-white">
          <strong className="text-lg font-black">Synapse AI</strong>
        </div>
        {systemCards.map((card) => (
          <article key={card.title} className="rounded-[24px] border border-zinc-800/90 bg-zinc-900/90 p-5 dark:border-zinc-200/90 dark:bg-zinc-100/90">
            <div className="flex items-center gap-3">
              <card.icon className="h-5 w-5 opacity-65" />
              <h3 className="text-base font-black">{card.title}</h3>
            </div>
            <p className="mt-3 text-sm font-medium leading-relaxed opacity-62">{card.text}</p>
          </article>
        ))}
      </div>
    </figure>
  );
};

export const LandingOperatingSystemSection = () => (
  <section id="diferenciais" className="public-section-stage public-inverted-section relative scroll-mt-24 overflow-hidden px-6 py-20 text-background md:py-28 dark:text-zinc-950">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <div className="mx-auto max-w-5xl text-center">
        <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-zinc-800 px-4 py-1.5 text-xs font-black dark:border-zinc-200">
          <BadgeCheck className="h-4 w-4" /> Sistema operacional
        </span>
        <h2 className="mt-8 text-balance text-4xl font-bold leading-[1.02] tracking-tight md:text-6xl">
          O Synapse não é um chat de canto.
          <br />
          Ele trabalha no sistema inteiro.
        </h2>
        <p className="mx-auto mt-7 max-w-4xl text-base font-medium leading-relaxed opacity-75 md:text-xl">
          Um chat de IA genérica conhece apenas o que você digita — você pergunta, ela responde. O Synapse trabalha e executa ações dentro de todo o sistema: ele encontra pacientes, navega pelas abas em tempo real, cruza agenda, prontuário e financeiro, traz insights contextualizados e prepara tarefas reais.
        </p>
      </div>
      <SynapseConnectionMap />
    </div>
  </section>
);

const synapseFeatures = [
  { icon: FileText, title: "Texto", text: "Apoio para escrita, organização, resumos, registros e documentação clínica." },
  { icon: Mic2, title: "Voz", text: "Comandos naturais para acelerar rotinas e reduzir cliques em tarefas repetitivas." },
  { icon: MessageCircle, title: "WhatsApp", text: "A conexão e a sincronização autorizadas do NeuroZap estão em validação; contexto avançado continua em evolução." },
  { icon: BrainCircuit, title: "NeuroBox", text: "NeuroView, NeuroPulse, NeuroFlow, NeuroScan e NeuroFinance expõem contexto estruturado para o agente." },
];

export const LandingSynapseSection = () => (
  <section id="synapse" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.88fr] lg:items-center">
        <SectionHeader
          align="left"
          eyebrow="Synapse AI"
          title={<>A IA prepara. <span className="text-muted-foreground">Você revisa e decide.</span></>}
          description="O Synapse apoia documentação, organização, comunicação e tomada de decisão operacional. A atuação clínica continua sempre sob responsabilidade do profissional."
        />
        <FadeIn delay={0.2}>
          <div className="rounded-[38px] border border-border/40 bg-card/80 p-5 shadow-premium dark:border-white/10 dark:bg-white/[0.035]">
            <div className="rounded-[30px] bg-foreground p-6 text-background dark:bg-white dark:text-zinc-950">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-foreground dark:bg-zinc-950 dark:text-white"><Sparkles className="h-5 w-5" /></div>
                <span className="text-[9px] font-black uppercase tracking-[0.22em] opacity-50">contexto ativo</span>
              </div>
              <p className="mt-12 text-3xl font-black leading-[0.95] tracking-[-0.06em]">Agenda, prontuário, paciente e financeiro no mesmo raciocínio.</p>
              <div className="mt-8 grid gap-2">
                {synapseFeatures.map((feature) => (
                  <div key={feature.title} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                    <feature.icon className="h-4 w-4 opacity-60" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-72">{feature.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {synapseFeatures.map((feature, index) => (
          <FadeIn key={feature.title} delay={index * 0.05}>
            <article className="h-full rounded-[28px] border border-border/40 bg-card/65 p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <feature.icon className="h-5 w-5 text-muted-foreground" />
              <h3 className="mt-7 text-lg font-black tracking-[-0.03em] text-foreground">{feature.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/70">{feature.text}</p>
            </article>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

const neuroZapFlows = [
  {
    title: "Conexão autorizada",
    text: "O canal da clínica só entra na NeuroNex depois de um fluxo de autorização próprio.",
  },
  {
    title: "Sincronização em validação",
    text: "A base de sincronização e tempo real é validada antes de ampliar o papel do canal na rotina.",
  },
  {
    title: "Próximas etapas visíveis",
    text: "Inbox, etiquetas e contexto avançado serão comunicados conforme cada fluxo estiver pronto.",
  },
];

export const LandingNeuroZapSection = ({ inverted = false }: { inverted?: boolean }) => (
  <section
    id="neurozap"
    className={cn(
      "public-section-stage relative overflow-hidden px-6 py-20 md:py-28",
      inverted
        ? "public-inverted-section text-background dark:text-zinc-950"
        : "bg-background",
    )}
  >
    <div className="relative z-10 mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <FadeIn>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {inverted ? (
              <span className="inline-flex items-center gap-2.5 font-mono text-[9px] font-black uppercase opacity-58">
                <MessageCircle className="h-4 w-4" /> NeuroZap
              </span>
            ) : (
              <SectionBadge icon={MessageCircle}>NeuroZap</SectionBadge>
            )}
            <span
              className={cn(
                "font-mono text-[8px] font-bold uppercase",
                inverted ? "opacity-48" : "text-muted-foreground",
              )}
            >
              Versão beta
            </span>
          </div>
          <h2
            className={cn(
              "mt-8 text-5xl font-black leading-[1.02] md:text-6xl",
              !inverted && "text-foreground",
            )}
          >
            WhatsApp Business conectado com autorização, por etapas.
          </h2>
          <p
            className={cn(
              "mt-7 max-w-2xl text-base font-medium leading-relaxed md:text-xl",
              inverted ? "opacity-68" : "text-muted-foreground/70",
            )}
          >
            O NeuroZap valida conexão e sincronização do canal da clínica. Inbox, etiquetas e ações contextuais avançadas ainda estão em evolução.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className={cn(
                "public-tactile h-14 rounded-full px-7 font-mono text-[10px] font-black uppercase",
                inverted
                  ? "bg-background text-foreground dark:bg-zinc-950 dark:text-white"
                  : "bg-foreground text-background",
              )}
            >
              <Link to="/neurozap-para-psicologos">
                Ver NeuroZap <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={cn(
                "public-tactile h-14 rounded-full bg-transparent px-7 font-mono text-[10px] font-black uppercase",
                inverted &&
                  "border-background/20 text-background dark:border-zinc-950/20 dark:text-zinc-950",
              )}
            >
              <Link to="/novidades">Ver status do produto</Link>
            </Button>
          </div>
        </div>
      </FadeIn>
      <FadeIn delay={0.12}>
        <div
          className={cn(
            "rounded-[40px] border p-5 shadow-[0_38px_120px_-78px_rgba(0,0,0,0.78)]",
            inverted
              ? "border-background/12 bg-background/[0.06] dark:border-zinc-950/12 dark:bg-zinc-950/[0.045]"
              : "border-border/40 bg-card/80 dark:border-white/10 dark:bg-white/[0.03]",
          )}
        >
          <div
            className={cn(
              "rounded-[30px] p-6",
              inverted
                ? "bg-background text-foreground dark:bg-zinc-950 dark:text-white"
                : "bg-foreground text-background dark:bg-white dark:text-zinc-950",
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/whatsapp-business-logo.png" alt="WhatsApp Business" width={36} height={36} className="h-9 w-9 rounded-xl object-contain" loading="lazy" decoding="async" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">WhatsApp Business</p>
                  <p className="text-base font-black">NeuroZap</p>
                </div>
              </div>
              <ShieldCheck aria-label="Conexão autorizada e status controlado" className="h-5 w-5 opacity-45" />
            </div>
            <div className="mt-8 grid gap-3">
              {neuroZapFlows.map((flow) => (
                <article
                  key={flow.title}
                  className={cn(
                    "rounded-2xl border p-4",
                    inverted
                      ? "border-foreground/10 bg-foreground/[0.04] dark:border-white/10 dark:bg-white/[0.04]"
                      : "border-background/10 bg-background/[0.07] dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]",
                  )}
                >
                  <h3 className="text-lg font-black leading-tight">{flow.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed opacity-64">{flow.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  </section>
);

export const LandingFinanceFiscalSection = () => (
  <section id="financeiro" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <div className="grid gap-8 lg:grid-cols-2">
        <FadeIn>
          <article className="relative h-full overflow-hidden rounded-[42px] border border-border/40 bg-card/80 p-8 shadow-premium dark:border-white/10 dark:bg-white/[0.035] md:p-10">
            <WalletCards className="h-8 w-8 text-muted-foreground" />
            <h2 className="mt-10 text-5xl font-black leading-[0.9] tracking-[-0.06em] text-foreground">NeuroFinance para receber, cobrar e decidir.</h2>
            <p className="mt-6 text-base font-medium leading-relaxed text-muted-foreground/70">Pix, QR Code, boletos, cobranças, saques e extrato em um painel financeiro feito para a rotina do consultório.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["Pix e QR Code", "Boletos e cobranças", "Extrato e repasses", "Saúde da conta"].map((item) => <div key={item} className="rounded-2xl border border-border/40 bg-foreground/[0.035] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.045]">{item}</div>)}
            </div>
          </article>
        </FadeIn>
        <FadeIn delay={0.1}>
          <article className="relative h-full overflow-hidden rounded-[42px] border border-border/40 bg-foreground p-8 text-background shadow-[0_34px_120px_-80px_rgba(0,0,0,0.86)] dark:bg-white dark:text-zinc-950 md:p-10">
            <FileCheck2 className="h-8 w-8 opacity-60" />
            <h2 className="mt-10 text-5xl font-black leading-[0.9] tracking-[-0.06em]">Dados fiscais no fluxo. Automação em evolução.</h2>
            <p className="mt-6 text-base font-medium leading-relaxed opacity-62">A NeuroNex já organiza a base fiscal perto da cobrança. Emissão de NFS-e e automações fiscais serão liberadas conforme cada fluxo for validado.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["Dados fiscais", "Recibos", "Base para NFS-e", "Automação em evolução"].map((item) => <div key={item} className="rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] opacity-72 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">{item}</div>)}
            </div>
          </article>
        </FadeIn>
      </div>
    </div>
  </section>
);

export const LandingPlanComparisonSection = () => (
  <section id="comparativo" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <SectionHeader eyebrow="Comparativo" title={<>Veja o que muda <span className="text-muted-foreground">em cada plano.</span></>} description="O Essential organiza o começo da prática. O Profissional amplia escala, contexto, automação e operação financeira." />
      <FadeIn delay={0.2}>
        <div className="mt-14 overflow-x-auto rounded-[34px] border border-border/45 bg-card shadow-premium dark:border-white/10 dark:bg-[#0b0b0d]">
          <div className="grid min-w-[760px] grid-cols-[1.25fr_repeat(2,0.9fr)] border-b border-border/45 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground dark:border-white/10">
            <div className="p-5">Recurso</div>
            <div className="p-5 text-center">Essential</div>
            <div className="bg-foreground p-5 text-center text-background dark:bg-white dark:text-zinc-950">Profissional</div>
          </div>
          {PUBLIC_PLAN_COMPARISON.map((row) => (
            <div key={row[0]} className="grid min-w-[760px] grid-cols-[1.25fr_repeat(2,0.9fr)] border-b border-border/40 last:border-b-0 dark:border-white/10">
              <div className="p-5 text-sm font-bold text-foreground">{row[0]}</div>
              {row.slice(1).map((cell, index) => (
                <div key={`${row[0]}-${index}`} className={cn("p-5 text-center text-sm font-semibold text-muted-foreground/76", index === 1 && "bg-foreground text-background dark:bg-white dark:text-zinc-950")}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      </FadeIn>
    </div>
  </section>
);

const publicJourneyItems = [
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
    title: "Quando chega a hora de cobrar",
    text: "Financeiro e comunicação entram com contexto para reduzir cobrança desconfortável e baixa manual.",
    href: "/neurofinance",
    label: "Ver NeuroFinance",
  },
  {
    icon: BrainCircuit,
    title: "Quando o caso precisa de leitura",
    text: "Synapse e NeuroBox conectam sinais, relatos e decisões que antes ficavam espalhados.",
    href: "/synapse",
    label: "Ver Synapse",
  },
];

export const LandingPublicPagesCarouselSection = () => (
  <section id="landings-publicas" className="public-section-stage relative overflow-hidden bg-background px-5 py-20 md:px-8 md:py-28">
    <div className="public-neurox-hero mx-auto max-w-[1480px] px-5 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Explore por módulo
        </p>
        <h2 className="public-neurox-title mt-7 text-balance text-[clamp(2.8rem,6vw,4.8rem)] font-black leading-[1.02] tracking-tight">
          Conheça cada parte<br />da sua clínica.
        </h2>
        <p className="mx-auto mt-8 max-w-3xl text-base font-semibold leading-relaxed text-muted-foreground/78 md:text-2xl">
          Aprofunde-se na área que mais importa agora. Agenda, Portal, NeuroFinance e Synapse continuam ligados ao mesmo sistema.
        </p>
      </div>

      <div className="mt-14 grid overflow-hidden rounded-[36px] border border-border/45 dark:border-white/10 md:grid-cols-2 xl:grid-cols-4">
        {publicJourneyItems.map((item, index) => (
          <motion.article
            key={item.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: index * 0.05, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="public-ecosystem-node group h-full min-h-[286px] px-6 py-8 md:px-7 md:py-9"
          >
            <item.icon aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
            <h3 className="mt-10 text-2xl font-black leading-tight text-foreground">{item.title}</h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
            <Link
              to={item.href}
              className="public-tactile mt-8 inline-flex min-h-11 items-center font-mono text-[9px] font-black uppercase tracking-[0.16em] text-foreground"
            >
              {item.label} <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

const faqs = [
  { q: "O NeuroNex substitui minha agenda e meu prontuário atual?", a: "A proposta é centralizar a operação clínica. Agenda, pacientes, prontuário, teleconsulta, portal, financeiro e IA passam a conversar no mesmo fluxo." },
  { q: "O Synapse toma decisões clínicas?", a: "Não. O Synapse encontra informações e prepara ações. Registros clínicos, mensagens ou movimentações importantes só são concluídos depois da revisão e autorização do psicólogo." },
  { q: "O NeuroFinance movimenta dinheiro real?", a: "Sim, quando a conta financeira é criada e aprovada. As funcionalidades de Pix, cobranças, boletos e saques operam dentro de um fluxo financeiro integrado." },
  { q: "O plano Profissional tem teste grátis?", a: "Sim. A condição de pré-lançamento prevê 7 dias grátis para o plano Profissional, além dos benefícios Founder." },
];

export const LandingTrustAndFAQSection = () => {
  return (
    <section id="seguranca" className="public-sensitive-section public-section-stage relative overflow-hidden px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <FadeIn>
          <div className="public-sensitive-card rounded-[42px] border p-8 md:p-10">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <h2 className="mt-10 text-5xl font-black leading-[0.9] tracking-[-0.06em] text-foreground">Construído para uma rotina sensível.</h2>
            <p className="mt-6 text-base font-medium leading-relaxed text-muted-foreground/70">Psicologia exige responsabilidade. O NeuroNex deve tratar dados clínicos com segurança, controle de acesso, rastreabilidade e postura cuidadosa no uso de IA.</p>
            <div className="mt-8 grid gap-3">
              {["LGPD e controle de acesso", "IA como apoio, não substituição", "Rastreabilidade de dados sensíveis"].map((item) => (
                <div key={item} className="public-sensitive-item flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold text-foreground/72"><LockKeyhole className="h-4 w-4" />{item}</div>
              ))}
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="public-sensitive-card rounded-[42px] border p-5 md:p-6">
            {faqs.map((faq) => (
              <details key={faq.q} className="public-sensitive-faq-row group border-b last:border-b-0">
                <summary className="public-tactile flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-3 py-5 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="text-base font-black text-foreground">{faq.q}</span>
                  <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <p className="px-3 pb-5 text-sm font-medium leading-relaxed text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

export const LandingFinalCTASection = () => (
  <section id="cta-final" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px] overflow-hidden rounded-[52px] border border-border/45 bg-foreground p-10 text-center text-background shadow-[0_40px_150px_-82px_rgba(0,0,0,0.9)] dark:bg-white dark:text-zinc-950 md:p-20">
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-foreground dark:bg-zinc-950 dark:text-white"><Fingerprint className="h-6 w-6" /></div>
        <h2 className="mt-9 text-5xl font-black leading-[1.02] tracking-tight md:text-6xl">Usar a NeuroNex pode ser perigosamente viciante.</h2>
        <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed opacity-75 md:text-xl">Não porque prende você à tela, mas porque facilmente tira você dela.</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild className="public-tactile h-14 rounded-full bg-background px-8 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white">
            <Link to="/create-account">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" className="public-tactile h-14 rounded-full border-background/20 bg-background/5 px-8 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
            <Link to="/contato">Falar com suporte</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);
