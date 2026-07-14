"use client";

import { FadeIn } from "@/components/animations/FadeIn";
import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import {
  MobileRealFinanceSection,
  MobileRealProductShowcase,
  MobileRealSynapseSection,
} from "@/components/landing/MobileProductScreenshots";
import { Button } from "@/components/ui/button";
import { PROFESSIONAL_PLAN_PERIOD, PROFESSIONAL_PLAN_PRICE, PROFESSIONAL_TRIAL_DAYS } from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  CreditCard,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { useState, type ElementType, type ReactNode } from "react";
import { Link } from "react-router-dom";

const MobileBadge = ({ children, icon: Icon = Sparkles, inverted = false }: { children: ReactNode; icon?: ElementType<{ className?: string }>; inverted?: boolean }) => (
  <div
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[8px] font-black uppercase tracking-[0.22em] backdrop-blur-sm",
      inverted
        ? "border-background/15 bg-background/[0.08] text-background/62 dark:border-zinc-950/10 dark:bg-zinc-950/[0.055] dark:text-zinc-950/60"
        : "border-border/40 bg-foreground/[0.035] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045] dark:text-white/48"
    )}
  >
    <Icon className="h-3.5 w-3.5" />
    {children}
  </div>
);

const MobileSectionHeader = ({ eyebrow, title, description, inverted = false }: { eyebrow: string; title: ReactNode; description?: string; inverted?: boolean }) => (
  <div className="mx-auto max-w-sm text-center">
    <FadeIn>
      <MobileBadge inverted={inverted}>{eyebrow}</MobileBadge>
    </FadeIn>
    <FadeIn delay={0.1}>
      <h2 className={cn("mt-6 text-[2.55rem] font-black leading-[0.88] tracking-[-0.065em]", inverted ? "text-background dark:text-zinc-950" : "text-foreground")}>{title}</h2>
    </FadeIn>
    {description ? (
      <FadeIn delay={0.18}>
        <p className={cn("mx-auto mt-5 max-w-[21rem] text-[0.92rem] font-medium leading-relaxed", inverted ? "text-background/60 dark:text-zinc-950/62" : "text-muted-foreground/70")}>{description}</p>
      </FadeIn>
    ) : null}
  </div>
);

const painPoints = [
  { icon: CalendarDays, title: "Ferramentas soltas", text: "Agenda, prontuário, cobrança e paciente em lugares diferentes." },
  { icon: CreditCard, title: "Financeiro manual", text: "Pix, boletos, repasses e inadimplência fora da operação clínica." },
  { icon: ReceiptText, title: "Fiscal repetitivo", text: "NFS-e, recibos e Receita Saúde viram tarefas extras no fim do dia." },
  { icon: MessageCircle, title: "Paciente sem continuidade", text: "Diário, humor e vínculo entre sessões raramente entram no fluxo." },
];

const diffRows = [
  { title: "Atendimento", old: "Registro manual e histórico disperso.", neo: "Prontuário vivo com evolução, contexto e resumos." },
  { title: "Paciente", old: "Acompanhamento para na sessão.", neo: "Portal com diário, rastreio de humor e continuidade." },
  { title: "Teleconsulta", old: "Vídeo sem documentação estruturada.", neo: "Sala HD com transcrição e resumo por IA." },
  { title: "Financeiro", old: "Pix, boleto e planilha separados.", neo: "Gestão Financeira e NeuroFinance com papéis claros." },
  { title: "Fiscal", old: "NFS-e e recibos fora do fluxo.", neo: "Rotinas fiscais conectadas à cobrança." },
  { title: "IA", old: "Chat genérico, sem contexto.", neo: "Synapse com texto, voz, WhatsApp e NeuroBox." },
];

const operatingCards = [
  { icon: Stethoscope, title: "Gestão clínica", text: "Agenda, pacientes, prontuário, documentos e teleconsulta." },
  { icon: BrainCircuit, title: "IA contextual", text: "Synapse, voz, texto, NeuroBox e apoio operacional." },
  { icon: MessageCircle, title: "Comunicação", text: "Portal do Paciente, WhatsApp, lembretes e continuidade." },
  { icon: CreditCard, title: "Financeiro", text: "Gestão, cobranças, Pix, boletos, extrato e saques." },
  { icon: FileCheck2, title: "Fiscal", text: "NFS-e, Receita Saúde e rotinas fiscais conectadas." },
  { icon: BarChart3, title: "Relatórios", text: "Visão clínica, financeira e operacional para decisão." },
];

const plans = [
  {
    name: "Essential",
    eyebrow: "Founder incluso",
    price: "R$ 0",
    period: "/mês",
    featured: false,
    href: "/create-account?plan=essential",
    cta: "Criar grátis",
    features: [
      "Selo Founder + benefícios VIP",
      "Gestão do consultório completa",
      "Synapse texto com acesso limitado",
      "Teleconsulta HD com transcrição e resumo por IA",
      "Portal do Paciente + diário e rastreio de humor",
      "Relatórios completos essenciais",
    ],
  },
  {
    name: "Profissional",
    eyebrow: `${PROFESSIONAL_TRIAL_DAYS} dias grátis`,
    price: PROFESSIONAL_PLAN_PRICE,
    period: PROFESSIONAL_PLAN_PERIOD,
    featured: true,
    href: "/create-account?plan=professional",
    cta: "Testar grátis",
    features: [
      "Tudo do Essential",
      "Synapse texto e voz com limites maiores",
      "Synapse no WhatsApp incluso",
      "NeuroBox com IAs NeuroNex",
      "Gestão Financeira + NeuroFinance",
      "NFS-e no automático e cobranças",
    ],
  },
  {
    name: "Enterprise",
    eyebrow: "Sob medida",
    price: "Personalizado",
    period: "",
    featured: false,
    href: "/help",
    cta: "Contatar suporte",
    features: [
      "Implantação personalizada",
      "Multi-profissionais e permissões",
      "Relatórios consolidados",
      "Treinamento e configuração assistida",
      "Condições comerciais por volume",
    ],
  },
];

const comparisonFeatures = [
  ["Agenda e pacientes", "Essencial", "Completo", "Completo"],
  ["Prontuário", "Completo", "Completo", "Completo"],
  ["Portal do Paciente", "Incluído", "Incluído", "Incluído"],
  ["Teleconsulta HD", "Limite inicial", "Limites maiores", "Sob medida"],
  ["Synapse texto", "Limitado", "Maior limite", "Dedicado"],
  ["Synapse voz", "—", "Incluído", "Dedicado"],
  ["WhatsApp", "—", "Incluído", "Sob medida"],
  ["NeuroFinance", "—", "Completo", "Operação"],
  ["NFS-e", "—", "Incluído", "Sob medida"],
  ["Suporte", "Comunidade", "Prioritário", "Dedicado"],
];

const faqs = [
  { q: "O NeuroNex substitui meu sistema atual?", a: "A proposta é centralizar a rotina clínica. Agenda, pacientes, prontuário, teleconsulta, portal, financeiro e IA passam a conversar no mesmo fluxo." },
  { q: "O Synapse toma decisões clínicas?", a: "Não. O Synapse apoia documentação, organização e operação. A decisão clínica continua sempre com o psicólogo." },
  { q: "Qual a diferença entre Gestão Financeira e NeuroFinance?", a: "A Gestão Financeira organiza receitas, despesas, previsão e planejamento. O NeuroFinance movimenta dinheiro real por meio de conta, Pix, boletos, pagamentos e saques." },
  { q: "O Profissional tem teste grátis?", a: "Sim. A condição de pré-lançamento prevê 7 dias grátis e benefícios Founder." },
];

const HeroMobile = () => (
  <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-10 pt-28 text-center">
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-foreground/[0.05] blur-[110px] dark:bg-white/[0.06]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background to-transparent" />
    </div>

    <div className="relative z-10 mx-auto flex max-w-sm flex-col items-center">
      <FadeIn><MobileBadge>Sistema operacional para psicólogos</MobileBadge></FadeIn>
      <FadeIn delay={0.1}>
        <h1 className="mt-7 text-[3.65rem] font-black leading-[0.86] tracking-[-0.075em] text-foreground">Sua clínica inteira, organizada por IA.</h1>
      </FadeIn>
      <FadeIn delay={0.2}>
        <p className="mt-6 max-w-[21rem] text-base font-medium leading-relaxed text-muted-foreground/72">Prontuário, agenda, teleconsulta, financeiro, NFS-e, portal do paciente e Synapse em uma única experiência.</p>
      </FadeIn>
      <FadeIn delay={0.3} className="mt-9 w-full">
        <div className="grid gap-3">
          <Button asChild className="h-14 w-full rounded-2xl bg-foreground text-[10px] font-black uppercase tracking-[0.22em] text-background shadow-premium active:scale-[0.98]">
            <Link to="/create-account">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
            className="h-14 w-full rounded-2xl border border-border/35 bg-foreground/[0.035] text-[10px] font-black uppercase tracking-[0.22em] text-foreground/75 active:scale-[0.98] dark:border-white/10 dark:bg-white/[0.045]"
          >
            Ver planos
          </Button>
        </div>
      </FadeIn>
    </div>

    <FadeIn delay={0.55}>
      <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 mt-12 flex flex-col items-center gap-2 text-foreground/28">
        <span className="text-[8px] font-black uppercase tracking-[0.38em]">Deslize</span>
        <ChevronDown className="h-4 w-4" />
      </motion.div>
    </FadeIn>
  </section>
);

const ProblemMobile = () => (
  <section id="problem" className="relative overflow-hidden bg-background px-5 py-16">
    <MobileSectionHeader eyebrow="O problema real" title={<>O que consome tempo é o operacional.</>} description="A clínica cresce, mas as ferramentas ficam espalhadas. O NeuroNex conecta tudo em um único fluxo." />
    <div className="mt-10 grid gap-3">
      {painPoints.map((item, index) => (
        <FadeIn key={item.title} delay={index * 0.04}>
          <article className="rounded-[28px] border border-border/40 bg-card/70 p-5 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background"><item.icon className="h-5 w-5" /></div>
              <div><h3 className="text-base font-black tracking-[-0.03em] text-foreground">{item.title}</h3><p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p></div>
            </div>
          </article>
        </FadeIn>
      ))}
    </div>
  </section>
);

const DifferentiatorMobile = () => (
  <section id="diferenciais" className="relative overflow-hidden bg-background px-5 py-16">
    <MobileSectionHeader eyebrow="O diferencial" title={<>Do jeito comum ao jeito NeuroNex.</>} description="A mesma rotina, mas sem fragmentação, retrabalho e decisões sem dados." />
    <div className="mt-10 space-y-4">
      {diffRows.map((row, index) => (
        <FadeIn key={row.title} delay={index * 0.04}>
          <article className="overflow-hidden rounded-[30px] border border-border/40 bg-card dark:border-white/10 dark:bg-[#0b0b0d]">
            <div className="border-b border-border/40 bg-foreground/[0.04] p-5 dark:border-white/10 dark:bg-white/[0.035]"><p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</p><h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">{row.title}</h3></div>
            <div className="grid divide-y divide-border/40 dark:divide-white/10">
              <div className="flex items-start gap-3 p-5"><X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Jeito comum</p><p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground/75">{row.old}</p></div></div>
              <div className="flex items-start gap-3 bg-foreground p-5 text-background dark:bg-white dark:text-zinc-950"><Check className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-[9px] font-black uppercase tracking-[0.18em] opacity-55">Jeito NeuroNex</p><p className="mt-2 text-sm font-semibold leading-relaxed opacity-82">{row.neo}</p></div></div>
            </div>
          </article>
        </FadeIn>
      ))}
    </div>
  </section>
);

const OperatingSystemMobile = () => (
  <section id="sistema" className="relative overflow-hidden bg-foreground px-5 py-16 text-background dark:bg-white dark:text-zinc-950">
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_38%,rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(0,0,0,0.06),transparent_38%,rgba(0,0,0,0.02))]" />
    <div className="relative z-10">
      <MobileSectionHeader eyebrow="Sistema operacional" title={<>Um único sistema para a clínica inteira.</>} description="Não é só agenda, prontuário ou financeiro. É uma camada operacional conectada." inverted />
      <div className="mt-10 grid gap-3">
        {operatingCards.map((card, index) => (
          <FadeIn key={card.title} delay={index * 0.04}>
            <article className="rounded-[26px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]"><card.icon className="h-5 w-5 opacity-58" /><h3 className="mt-6 text-lg font-black tracking-[-0.03em]">{card.title}</h3><p className="mt-2 text-sm font-medium leading-relaxed opacity-62">{card.text}</p></article>
          </FadeIn>
        ))}
      </div>
    </div>
  </section>
);

const PlansMobile = () => (
  <section id="waitlist" className="relative overflow-hidden bg-background px-5 py-16">
    <MobileSectionHeader eyebrow="Planos NeuroNex" title={<>Escolha o plano ideal para a sua clínica.</>} description="Comece com o Essential, evolua para o Profissional ou fale com suporte para uma estrutura personalizada." />
    <div className="mt-10 space-y-4">
      {plans.map((plan, index) => (
        <FadeIn key={plan.name} delay={index * 0.05}>
          <article className={cn("relative overflow-hidden rounded-[34px] border p-6 shadow-premium", plan.featured ? "border-foreground/20 bg-foreground text-background dark:bg-white dark:text-zinc-950" : "border-border/40 bg-card/80 dark:border-white/10 dark:bg-white/[0.035]") }>
            <div className="flex items-start justify-between gap-4"><div><p className={cn("text-[9px] font-black uppercase tracking-[0.22em]", plan.featured ? "opacity-55" : "text-muted-foreground")}>{plan.eyebrow}</p><h3 className={cn("mt-3 text-3xl font-black tracking-[-0.055em]", !plan.featured && "text-foreground")}>{plan.name}</h3></div>{plan.featured ? <BadgeCheck className="h-6 w-6 opacity-72" /> : <Sparkles className="h-6 w-6 text-muted-foreground" />}</div>
            <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-[-0.06em]">{plan.price}</span>{plan.period ? <span className={cn("pb-1 text-xs font-bold", plan.featured ? "opacity-45" : "text-muted-foreground/60")}>{plan.period}</span> : null}</div>
            <div className="mt-7 space-y-3">{plan.features.map((feature) => <div key={feature} className={cn("flex items-start gap-3 text-sm font-semibold leading-relaxed", plan.featured ? "opacity-75" : "text-muted-foreground/76") }><Check className="mt-0.5 h-4 w-4 shrink-0" /><span>{feature}</span></div>)}</div>
            <Button asChild className={cn("mt-8 h-14 w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.2em]", plan.featured ? "bg-background text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white" : "bg-foreground text-background hover:bg-foreground/90") }><Link to={plan.href}>{plan.cta} <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </article>
        </FadeIn>
      ))}
    </div>
  </section>
);

const ComparisonMobile = () => (
  <section id="comparativo" className="relative overflow-hidden bg-background px-5 py-16">
    <MobileSectionHeader eyebrow="Comparativo" title={<>Veja o que muda em cada plano.</>} description="O Profissional é o plano principal para operar a clínica com IA, NeuroFinance e automações." />
    <FadeIn delay={0.15}>
      <div className="mt-10 overflow-hidden rounded-[30px] border border-border/40 bg-card dark:border-white/10 dark:bg-[#0b0b0d]">
        <div className="grid grid-cols-[1.05fr_0.85fr_0.9fr] border-b border-border/40 text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10"><div className="p-4">Recurso</div><div className="p-4 text-center">Essential</div><div className="bg-foreground p-4 text-center text-background dark:bg-white dark:text-zinc-950">Pro</div></div>
        {comparisonFeatures.slice(0, 10).map((row) => <div key={row[0]} className="grid grid-cols-[1.05fr_0.85fr_0.9fr] border-b border-border/35 last:border-b-0 dark:border-white/10"><div className="p-4 text-xs font-bold text-foreground">{row[0]}</div><div className="p-4 text-center text-[11px] font-semibold text-muted-foreground/75">{row[1]}</div><div className="bg-foreground p-4 text-center text-[11px] font-semibold text-background dark:bg-white dark:text-zinc-950">{row[2]}</div></div>)}
      </div>
    </FadeIn>
  </section>
);

const TrustFAQMobile = () => {
  const [open, setOpen] = useState(0);
  return (
    <section id="seguranca" className="relative overflow-hidden bg-background px-5 py-16">
      <FadeIn>
        <article className="rounded-[36px] border border-border/40 bg-card/80 p-6 dark:border-white/10 dark:bg-white/[0.035]"><ShieldCheck className="h-7 w-7 text-muted-foreground" /><h2 className="mt-8 text-[2.45rem] font-black leading-[0.88] tracking-[-0.065em] text-foreground">Construído para uma rotina sensível.</h2><p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70">Psicologia exige responsabilidade. Segurança, controle de acesso, rastreabilidade e uso cuidadoso de IA precisam estar no centro.</p><div className="mt-7 space-y-2">{["LGPD e controle de acesso", "IA como apoio, não substituição", "Rastreabilidade de dados sensíveis"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.035] px-4 py-3 text-xs font-bold text-foreground/75 dark:border-white/10 dark:bg-white/[0.04]"><LockKeyhole className="h-4 w-4" />{item}</div>)}</div></article>
      </FadeIn>
      <div className="mt-4 overflow-hidden rounded-[30px] border border-border/40 bg-card/80 dark:border-white/10 dark:bg-white/[0.035]">
        {faqs.map((faq, index) => (
          <div key={faq.q} className="border-b border-border/35 last:border-b-0 dark:border-white/10">
            <button
              id={`mobile-landing-faq-trigger-${index}`}
              type="button"
              aria-expanded={open === index}
              aria-controls={`mobile-landing-faq-panel-${index}`}
              onClick={() => setOpen(open === index ? -1 : index)}
              className="block w-full px-5 py-5 text-left"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-black tracking-[-0.02em] text-foreground">{faq.q}</h3>
                <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open === index && "rotate-180")} />
              </div>
            </button>
            <AnimatePresence initial={false}>
              {open === index && (
                <motion.p
                  id={`mobile-landing-faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`mobile-landing-faq-trigger-${index}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden px-5 pb-5 text-sm font-medium leading-relaxed text-muted-foreground/70"
                >
                  {faq.a}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
};

const NativeExperienceMobile = () => (
  <section id="downloads" className="relative overflow-hidden bg-background px-5 py-16">
    <div className="rounded-[38px] border border-border/40 bg-card/70 p-6 text-center shadow-premium dark:border-white/10 dark:bg-white/[0.035]"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background"><BadgeCheck className="h-6 w-6" aria-hidden="true" /></div><h2 className="mt-8 text-[2.35rem] font-black leading-[0.9] tracking-[-0.06em] text-foreground">NeuroNex no Windows e na web.</h2><p className="mx-auto mt-5 max-w-xs text-sm font-medium leading-relaxed text-muted-foreground/66">No Windows, instale pela Microsoft Store. Em outros dispositivos compatíveis, acesse a NeuroNex com segurança pelo navegador.</p><div className="mt-7 grid grid-cols-2 gap-2">{["Microsoft Store", "Acesso pela web"].map((item) => <div key={item} className="rounded-2xl border border-border/40 bg-foreground/[0.035] px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]">{item}</div>)}</div></div>
  </section>
);

const FinalCTAMobile = () => (
  <section id="cta-final" className="relative overflow-hidden bg-background px-5 py-16">
    <div className="overflow-hidden rounded-[40px] bg-foreground p-8 text-center text-background shadow-premium dark:bg-white dark:text-zinc-950"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-background text-foreground dark:bg-zinc-950 dark:text-white"><Fingerprint className="h-6 w-6" /></div><h2 className="mt-8 text-[2.65rem] font-black leading-[0.86] tracking-[-0.07em]">A próxima versão da sua clínica começa aqui.</h2><p className="mt-6 text-sm font-medium leading-relaxed opacity-62">Entre agora, garanta benefícios Founder e evolua sua operação com IA, financeiro e gestão em um único lugar.</p><div className="mt-8 grid gap-3"><Button asChild className="h-14 rounded-2xl bg-background text-[10px] font-black uppercase tracking-[0.22em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white"><Link to="/create-account">Começar grátis <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 text-[10px] font-black uppercase tracking-[0.22em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950"><Link to="/help">Falar com suporte</Link></Button></div></div>
  </section>
);

export const MobileIndex = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/30">
      <main>
        <HeroMobile />
        <ProblemMobile />
        <DifferentiatorMobile />
        <MobileRealProductShowcase />
        <OperatingSystemMobile />
        <MobileRealSynapseSection />
        <MobileRealFinanceSection />
        <PlansMobile />
        <ComparisonMobile />
        <TrustFAQMobile />
        <NativeExperienceMobile />
        <FinalCTAMobile />
      </main>
      <Footer />
      <LandingMobileNav />
    </div>
  );
};
