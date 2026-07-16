"use client";

import type { ElementType } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  Fingerprint,
  LockKeyhole,
  MessageCircle,
  Mic2,
  MonitorPlay,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
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

const SectionHeader = ({ eyebrow, title, description, align = "center" }: { eyebrow: string; title: React.ReactNode; description?: string; align?: "center" | "left" }) => (
  <div className={cn("mx-auto max-w-5xl", align === "center" ? "text-center" : "text-left")}> 
    <FadeIn>
      <SectionBadge>{eyebrow}</SectionBadge>
    </FadeIn>
    <FadeIn delay={0.12}>
      <h2 className="mt-8 text-4xl font-bold leading-[0.92] tracking-[-0.055em] text-foreground md:text-6xl lg:text-7xl">
        {title}
      </h2>
    </FadeIn>
    {description ? (
      <FadeIn delay={0.2}>
        <p className={cn("mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/68 md:text-xl", align === "center" && "mx-auto")}>{description}</p>
      </FadeIn>
    ) : null}
  </div>
);

const painPoints = [
  { icon: CalendarDays, title: "Agenda em um lugar, prontuário em outro", text: "A rotina vira alternância de abas, lembretes manuais e informações soltas." },
  { icon: WalletCards, title: "Cobrança manual e financeiro sem visão real", text: "Pix, boletos, recebíveis e inadimplência ficam separados da operação clínica." },
  { icon: ReceiptText, title: "Fiscal e Receita Saúde como tarefas extras", text: "O que deveria acompanhar a cobrança vira um processo repetitivo no fim do dia." },
  { icon: MessageCircle, title: "Paciente sem continuidade entre sessões", text: "Diário, humor, orientações e vínculo pós-consulta raramente entram no fluxo." },
  { icon: BrainCircuit, title: "IA genérica, sem contexto clínico", text: "Chatbots ajudam no texto, mas não entendem prontuário, agenda, financeiro e paciente." },
  { icon: BarChart3, title: "Decisões sem dados consolidados", text: "Relatórios, evolução, receita, despesas e operação não conversam entre si." },
];

export const LandingProblemSection = () => (
  <section id="problem" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute left-[5%] top-[10%] h-[440px] w-[620px] rounded-full bg-foreground/[0.035] blur-[150px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.02),transparent)] dark:bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.018),transparent)]" />
    </div>
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <SectionHeader
        eyebrow="O problema real"
        title={<>O que consome tempo não é a psicologia. <span className="text-muted-foreground/35">É o operacional.</span></>}
        description="A maioria das clínicas cresce juntando ferramentas. O NeuroNex nasce para substituir esse mosaico por uma operação única, inteligente e conectada."
      />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {painPoints.map((item, index) => (
          <FadeIn key={item.title} delay={index * 0.05}>
            <article className="group relative h-full overflow-hidden rounded-[30px] border border-border/40 bg-card/58 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-foreground/18 hover:bg-card dark:border-white/8 dark:bg-white/[0.032]">
              <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.055] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
    old: "IA genérica, sem memória operacional e sem conexão com a rotina do consultório.",
    neo: "Synapse com texto, voz, NeuroBox, política de risco e contexto real da clínica.",
    bold: "IA operacional",
  },
];

export const LandingDifferentiatorTable = () => (
  <section id="diferenciais" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1280px]">
      <SectionHeader
        eyebrow="O diferencial"
        title={<>Da clínica fragmentada à <span className="text-muted-foreground/35">operação inteligente.</span></>}
        description="Uma comparação direta entre o jeito comum de administrar um consultório e a experiência NeuroNex."
      />

      <FadeIn delay={0.22}>
        <div className="mt-16 overflow-hidden rounded-[36px] border border-border/50 bg-card shadow-[0_34px_120px_-80px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-[#0b0b0d]">
          <div className="grid grid-cols-[0.88fr_1fr_1.05fr] border-b border-border/50 dark:border-white/10">
            <div className="bg-foreground/[0.045] p-7 dark:bg-white/[0.025]" />
            <div className="bg-foreground/[0.055] p-7 text-center dark:bg-white/[0.04]">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">O jeito comum</p>
            </div>
            <div className="bg-foreground p-7 text-center text-background dark:bg-white dark:text-zinc-950">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]">O jeito NeuroNex</p>
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
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),transparent_34%,rgba(255,255,255,0.025))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_34%,rgba(255,255,255,0.015))]" />
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
    <section id="produto" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto max-w-[1280px]">
        <SectionHeader
          eyebrow="Por dentro do NeuroNex"
          title={<>Um produto real para operar <span className="text-muted-foreground/35">a clínica inteira.</span></>}
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

const systemCards = [
  { icon: Stethoscope, title: "Gestão clínica", text: "Agenda, pacientes, prontuário, documentos, teleconsulta e evolução clínica." },
  { icon: BrainCircuit, title: "Inteligência artificial", text: "Synapse, voz, texto, NeuroBox e apoio operacional contextualizado." },
  { icon: MessageCircle, title: "Comunicação", text: "Portal do Paciente, NeuroZap Desktop Beta e continuidade entre sessões." },
  { icon: CreditCard, title: "Financeiro", text: "Cobranças, Pix, boletos, QR Code, extrato, saques e saúde da conta." },
  { icon: FileCheck2, title: "Preparação fiscal", text: "Dados fiscais próximos do financeiro, com emissão e automações ainda em evolução." },
  { icon: BarChart3, title: "Relatórios", text: "Visão clínica, financeira e operacional em uma camada de decisão." },
];

export const LandingOperatingSystemSection = () => (
  <section id="sistema" className="relative overflow-hidden bg-foreground px-6 py-20 text-background md:py-28 dark:bg-white dark:text-zinc-950">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_36%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(0,0,0,0.06),transparent_36%,rgba(0,0,0,0.02))]" />
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <SectionBadge icon={BadgeCheck}>Sistema operacional</SectionBadge>
          <h2 className="mt-8 text-5xl font-bold leading-[0.9] tracking-[-0.06em] md:text-7xl">Um único sistema para operar a clínica inteira.</h2>
          <p className="mt-7 max-w-xl text-base font-medium leading-relaxed opacity-62 md:text-xl">O NeuroNex não é só uma agenda, um prontuário ou um financeiro. É uma camada operacional que conecta cada parte da rotina.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {systemCards.map((card) => (
            <article key={card.title} className="rounded-[28px] border border-background/10 bg-background/[0.06] p-5 backdrop-blur-sm dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
              <card.icon className="h-5 w-5 opacity-55" />
              <h3 className="mt-7 text-lg font-black tracking-[-0.03em]">{card.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed opacity-62">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const synapseFeatures = [
  { icon: FileText, title: "Texto", text: "Apoio para escrita, organização, resumos, registros e documentação clínica." },
  { icon: Mic2, title: "Voz", text: "Comandos naturais para acelerar rotinas e reduzir cliques em tarefas repetitivas." },
  { icon: MessageCircle, title: "WhatsApp", text: "NeuroZap conecta e sincroniza o WhatsApp Business em Beta; ações com Synapse seguem em evolução." },
  { icon: BrainCircuit, title: "NeuroBox", text: "NeuroView, NeuroPulse, NeuroFlow, NeuroScan e NeuroFinance expõem contexto estruturado para o agente." },
];

export const LandingSynapseSection = () => (
  <section id="synapse" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.88fr] lg:items-center">
        <SectionHeader
          align="left"
          eyebrow="Synapse AI"
          title={<>Não é um chat. <span className="text-muted-foreground/35">É a inteligência operacional da clínica.</span></>}
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
    title: "Conexão em Beta",
    text: "O consultório autoriza o WhatsApp Business e valida a sincronização com a superfície Desktop Beta.",
  },
  {
    title: "Inbox em evolução",
    text: "Conversas, etiquetas, histórico e resolução segura de identidade avançam como próxima etapa.",
  },
  {
    title: "Synapse em evolução",
    text: "Resumos e ações contextuais só entram depois de consentimento, auditoria e revisão humana estarem validados.",
  },
];

export const LandingNeuroZapSection = () => (
  <section id="neurozap" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <FadeIn>
        <div>
          <SectionBadge icon={MessageCircle}>NeuroZap Desktop Beta</SectionBadge>
          <h2 className="mt-8 text-5xl font-black leading-[0.9] text-foreground md:text-7xl">WhatsApp Business conectado à NeuroNex, com evolução por etapas.</h2>
          <p className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/70 md:text-xl">
            Conexão e sincronização estão em Beta. Inbox, identidade do paciente, consentimento, auditoria e ações com Synapse permanecem em evolução.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
              <Link to="/neurozap-para-psicologos">
                Ver NeuroZap <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]">
              <Link to="/neurofinance">Ver NeuroFinance</Link>
            </Button>
          </div>
        </div>
      </FadeIn>
      <FadeIn delay={0.12}>
        <div className="rounded-[40px] border border-border/40 bg-card/80 p-5 shadow-[0_38px_120px_-78px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.03]">
          <div className="rounded-[30px] bg-foreground p-6 text-background dark:bg-white dark:text-zinc-950">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/whatsapp-business-logo.png" alt="WhatsApp Business" width={36} height={36} className="h-9 w-9 rounded-xl object-contain" loading="lazy" decoding="async" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">WhatsApp Business</p>
                  <p className="text-base font-black">NeuroZap Desktop Beta</p>
                </div>
              </div>
              <span className="rounded-full border border-background/10 bg-background/[0.08] px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] opacity-70 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">Beta explícito</span>
            </div>
            <div className="mt-8 grid gap-3">
              {neuroZapFlows.map((flow) => (
                <article key={flow.title} className="rounded-2xl border border-background/10 bg-background/[0.07] p-4 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
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
  <section id="financeiro" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
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
  <section id="comparativo" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px]">
      <SectionHeader eyebrow="Comparativo" title={<>Veja o que muda <span className="text-muted-foreground/35">em cada plano.</span></>} description="O Essential organiza o começo da prática. O Profissional amplia escala, contexto, automação e operação financeira." />
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

const publicLandingCarouselItems = [
  {
    eyebrow: "NeuroZap",
    title: "WhatsApp Business conectado à NeuroNex em Desktop Beta.",
    description: "Conexão e sincronização disponíveis em Beta; inbox, auditoria e ações contextuais seguem em evolução.",
    href: "/neurozap-para-psicologos",
    image: "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp",
    accent: "Comunicação",
    icon: MessageCircle,
  },
  {
    eyebrow: "Teleconsulta",
    title: "Sessão online dentro do sistema operacional clínico.",
    description: "Agenda, pré-sala, vídeo, prontuário, transcrição autorizada e resumo revisável pelo Synapse.",
    href: "/teleconsulta-para-psicologos",
    image: "/landing/screenshots/mobile/light/26-mobile-teleconsulta-white.webp",
    accent: "Atendimento",
    icon: MonitorPlay,
  },
  {
    eyebrow: "Pacientes",
    title: "Cadastro, prontuário, portal e IA clínica no mesmo contexto.",
    description: "A jornada do paciente vira base operacional para NeuroScan, NeuroView, NeuroPulse e continuidade entre sessões.",
    href: "/pacientes-para-psicologos",
    image: "/landing/screenshots/desktop/dark/12-paciente-prontuario-grafico-tendencia-humor-minicards-dark.webp",
    accent: "Continuidade",
    icon: Users,
  },
  {
    eyebrow: "NeuroBox",
    title: "NeuroView, Flow, Pulse, Scan e Finance intermediados pelo Synapse.",
    description: "Ferramentas de IA profunda para transformar notas, sintomas, fluxos e finanças em metadados acionáveis.",
    href: "/neurobox",
    image: "/landing/screenshots/desktop/dark/17-neuroview-3d-dark.webp",
    accent: "IA profunda",
    icon: BrainCircuit,
  },
  {
    eyebrow: "NeuroFinance",
    title: "Core banking e previsibilidade financeira para psicólogos.",
    description: "Conta digital, Área Pix, boletos, NFS-e/RPS, recebíveis e capital de giro preditivo no fluxo da clínica.",
    href: "/neurofinance",
    image: "/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp",
    accent: "Financeiro",
    icon: WalletCards,
  },
  {
    eyebrow: "Agenda",
    title: "A agenda como início do fluxo, não como calendário isolado.",
    description: "Compromissos conectam pacientes, teleconsulta, confirmações, no-show, cobrança e próximos passos.",
    href: "/agenda-para-psicologos",
    image: "/landing/screenshots/desktop/dark/nova remessa/9-agenda-mensal-dark.webp",
    accent: "Operação",
    icon: CalendarDays,
  },
];

const wrapIndex = (index: number, total: number) => (index + total) % total;

export const LandingPublicPagesCarouselSection = () => {
  const shouldReduceMotion = useReducedMotion();
  const [[activeIndex, direction], setActive] = useState<[number, number]>([0, 1]);
  const activeItem = publicLandingCarouselItems[activeIndex];

  const navigate = (nextDirection: number) => {
    setActive(([current]) => [
      wrapIndex(current + nextDirection, publicLandingCarouselItems.length),
      nextDirection,
    ]);
  };

  const goTo = (index: number) => {
    if (index === activeIndex) return;
    setActive([index, index > activeIndex ? 1 : -1]);
  };

  return (
    <section id="landings-publicas" className="relative overflow-hidden bg-background px-5 py-20 md:px-8 md:py-28">
      <div className="relative z-10 mx-auto max-w-[1320px]">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <SectionHeader
            align="left"
            eyebrow="Páginas públicas"
            title={<>Uma vitrine viva para cada parte da <span className="text-muted-foreground/35">Clínica Autônoma.</span></>}
            description="Cada landing agora explica uma camada do ecossistema: comunicação, teleconsulta, pacientes, IA profunda, financeiro e operação."
          />
          <div className="flex items-center justify-start gap-3 lg:justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-card/75 text-foreground transition hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white dark:hover:text-zinc-950"
              aria-label="Ver landing anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-foreground text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white dark:text-zinc-950"
              aria-label="Ver próxima landing"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="relative min-h-[620px] overflow-hidden rounded-[36px] border border-border/45 bg-card shadow-[0_38px_120px_-86px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b] md:min-h-[560px]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--foreground)/0.06),transparent_32%,hsl(var(--foreground)/0.025))]" />
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.article
                key={activeItem.href}
                custom={direction}
                drag={shouldReduceMotion ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={(_, info) => {
                  const swipe = info.offset.x + info.velocity.x * 0.18;
                  if (swipe < -90) navigate(1);
                  if (swipe > 90) navigate(-1);
                }}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? 120 : -120 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -120 : 120 }}
                transition={{ duration: shouldReduceMotion ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 grid h-full min-h-[620px] cursor-grab grid-rows-[minmax(0,1fr)_auto] active:cursor-grabbing md:min-h-[560px] lg:grid-cols-[1fr_0.74fr] lg:grid-rows-1"
                aria-live="polite"
              >
                <div className="relative min-h-[310px] overflow-hidden lg:min-h-full">
                  <img
                    src={activeItem.image}
                    alt={`Prévia da landing ${activeItem.eyebrow}`}
                    width={1280}
                    height={720}
                    loading={activeIndex === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,hsl(var(--background)/0.86)_100%)] lg:bg-[linear-gradient(90deg,transparent_45%,hsl(var(--card))_100%)] dark:lg:bg-[linear-gradient(90deg,transparent_45%,#08090b_100%)]" />
                  <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-xl">
                    {activeItem.accent}
                  </div>
                </div>

                <div className="flex min-h-[310px] flex-col justify-between p-7 md:p-9 lg:min-h-full lg:p-10">
                  <div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background dark:bg-white dark:text-zinc-950">
                      <activeItem.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-8 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{activeItem.eyebrow}</p>
                    <h3 className="mt-4 text-balance text-4xl font-black leading-[0.92] tracking-[-0.055em] text-foreground md:text-5xl">
                      {activeItem.title}
                    </h3>
                    <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/72 md:text-base">
                      {activeItem.description}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button asChild className="h-14 rounded-2xl bg-foreground px-6 text-[10px] font-black uppercase tracking-[0.18em] text-background dark:bg-white dark:text-zinc-950">
                      <Link to={activeItem.href}>
                        Abrir landing <ExternalLink className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/58">
                      Arraste para navegar
                    </p>
                  </div>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>

          <div className="grid content-start gap-2">
            {publicLandingCarouselItems.map((item, index) => (
              <button
                key={item.href}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  "group flex min-h-16 items-center gap-4 rounded-[22px] border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  index === activeIndex
                    ? "border-foreground/20 bg-foreground text-background shadow-[0_20px_70px_-48px_rgba(0,0,0,0.8)] dark:bg-white dark:text-zinc-950"
                    : "border-border/42 bg-card/68 text-muted-foreground hover:border-foreground/18 hover:bg-foreground/[0.045] hover:text-foreground dark:border-white/10 dark:bg-white/[0.03]",
                )}
                aria-current={index === activeIndex ? "true" : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0">
                  <span className="block text-[9px] font-black uppercase tracking-[0.18em]">{item.eyebrow}</span>
                  <span className={cn("mt-1 block truncate text-xs font-bold", index === activeIndex ? "opacity-70" : "opacity-60")}>{item.accent}</span>
                </span>
                <ArrowRight className={cn("ml-auto h-3.5 w-3.5 transition", index === activeIndex ? "opacity-60" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-35")} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const faqs = [
  { q: "O NeuroNex substitui minha agenda e meu prontuário atual?", a: "A proposta é centralizar a operação clínica. Agenda, pacientes, prontuário, teleconsulta, portal, financeiro e IA passam a conversar no mesmo fluxo." },
  { q: "O Synapse toma decisões clínicas?", a: "Não. O Synapse é uma camada de apoio operacional, documentação, organização e inteligência contextual. A decisão clínica continua sempre com o psicólogo." },
  { q: "O NeuroFinance movimenta dinheiro real?", a: "Sim, quando a conta financeira é criada e aprovada. As funcionalidades de Pix, cobranças, boletos e saques operam dentro de um fluxo financeiro integrado." },
  { q: "O plano Profissional tem teste grátis?", a: "Sim. A condição de pré-lançamento prevê 7 dias grátis para o plano Profissional, além dos benefícios Founder." },
];

export const LandingTrustAndFAQSection = () => {
  const [open, setOpen] = useState(0);

  return (
    <section id="seguranca" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <FadeIn>
          <div className="rounded-[42px] border border-border/40 bg-card/80 p-8 dark:border-white/10 dark:bg-white/[0.035] md:p-10">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <h2 className="mt-10 text-5xl font-black leading-[0.9] tracking-[-0.06em] text-foreground">Construído para uma rotina sensível.</h2>
            <p className="mt-6 text-base font-medium leading-relaxed text-muted-foreground/70">Psicologia exige responsabilidade. O NeuroNex deve tratar dados clínicos com segurança, controle de acesso, rastreabilidade e postura cuidadosa no uso de IA.</p>
            <div className="mt-8 grid gap-3">
              {["LGPD e controle de acesso", "IA como apoio, não substituição", "Rastreabilidade de dados sensíveis"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.035] px-4 py-3 text-sm font-bold text-foreground/72 dark:border-white/10 dark:bg-white/[0.04]"><LockKeyhole className="h-4 w-4" />{item}</div>
              ))}
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="rounded-[42px] border border-border/40 bg-card/80 p-5 dark:border-white/10 dark:bg-white/[0.035] md:p-6">
            {faqs.map((faq, index) => (
              <div key={faq.q} className="border-b border-border/35 last:border-b-0 dark:border-white/10">
                <button
                  id={`landing-faq-trigger-${index}`}
                  type="button"
                  aria-expanded={open === index}
                  aria-controls={`landing-faq-panel-${index}`}
                  onClick={() => setOpen(open === index ? -1 : index)}
                  className="block w-full px-3 py-5 text-left"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-black tracking-[-0.025em] text-foreground">{faq.q}</h3>
                    <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open === index && "rotate-180")} />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {open === index && (
                    <motion.p id={`landing-faq-panel-${index}`} role="region" aria-labelledby={`landing-faq-trigger-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden px-3 pb-5 text-sm font-medium leading-relaxed text-muted-foreground/70">
                      {faq.a}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
};

export const LandingFinalCTASection = () => (
  <section id="cta-final" className="relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1240px] overflow-hidden rounded-[52px] border border-border/45 bg-foreground p-10 text-center text-background shadow-[0_40px_150px_-82px_rgba(0,0,0,0.9)] dark:bg-white dark:text-zinc-950 md:p-20">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_42%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(0,0,0,0.055),transparent_42%,rgba(0,0,0,0.02))]" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-foreground dark:bg-zinc-950 dark:text-white"><Fingerprint className="h-6 w-6" /></div>
        <h2 className="mt-9 text-5xl font-black leading-[0.88] tracking-[-0.065em] md:text-7xl">A próxima versão da sua clínica começa aqui.</h2>
        <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed opacity-62 md:text-xl">Entre agora, garanta benefícios Founder e evolua sua operação clínica com IA, financeiro e gestão em um único lugar.</p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild className="h-14 rounded-2xl bg-background px-8 text-[10px] font-black uppercase tracking-[0.22em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white">
            <Link to="/create-account">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 px-8 text-[10px] font-black uppercase tracking-[0.22em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
            <Link to="/contato">Falar com suporte</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
);
