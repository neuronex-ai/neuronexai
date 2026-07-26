"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  Maximize2,
  MessageCircle,
  Mic2,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const SCREENSHOT_ROOT = "/landing/screenshots";
const DARK_NEW_BATCH = `${SCREENSHOT_ROOT}/desktop/dark/nova remessa`;
const LIGHT_NEW_BATCH = `${SCREENSHOT_ROOT}/desktop/light/Nova remessa`;

type ScreenshotSource = {
  dark: string;
  light?: string;
  alt: string;
};

type ProductModule = ScreenshotSource & {
  key: string;
  label: string;
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  icon: ElementType<{ className?: string }>;
};

const productModules: ProductModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Central da Clínica",
    eyebrow: "Command Center",
    description: "Agenda, pacientes, pendências, Synapse e saúde operacional organizados para começar o dia com clareza.",
    bullets: ["Radar diário", "Próxima sessão", "Fila de trabalho"],
    icon: LayoutDashboard,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/01-dashboard-command-center-dark.webp`,
    alt: "Dashboard desktop do NeuroNex com a Central da Clínica",
  },
  {
    key: "agenda",
    label: "Agenda",
    title: "Agenda Inteligente",
    eyebrow: "Rotina clínica",
    description: "Visões diária e mensal, compromissos, status e ações rápidas em uma agenda conectada ao restante da operação.",
    bullets: ["Dia e mês", "Status em tempo real", "Acesso ao paciente"],
    icon: CalendarDays,
    dark: `${DARK_NEW_BATCH}/9-agenda-mensal-dark.webp`,
    light: `${SCREENSHOT_ROOT}/desktop/light/9-agenda-mensal-white.webp`,
    alt: "Visualização mensal da agenda clínica do NeuroNex",
  },
  {
    key: "prontuario",
    label: "Prontuário",
    title: "Prontuário Vivo",
    eyebrow: "Continuidade clínica",
    description: "Histórico, metas, evolução e tendências de humor aparecem no contexto do paciente, sem espalhar informação.",
    bullets: ["Linha do tempo", "Metas e evolução", "Tendência de humor"],
    icon: ClipboardList,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/12-paciente-prontuario-grafico-tendencia-humor-minicards-dark.webp`,
    alt: "Prontuário de paciente com tendência de humor no NeuroNex",
  },
  {
    key: "gestao-financeira",
    label: "Gestão",
    title: "Gestão Financeira",
    eyebrow: "Decisão gerencial",
    description: "Resultado, receitas, despesas, recebíveis e planejamento da clínica em uma camada separada da conta bancária.",
    bullets: ["Visão geral", "Fluxo projetado", "Inadimplência"],
    icon: BarChart3,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/04-financeiro-visao-geral-dark.webp`,
    alt: "Visão geral da Gestão Financeira do NeuroNex",
  },
  {
    key: "neurofinance",
    label: "NeuroFinance",
    title: "Financeiro ligado à clínica",
    eyebrow: "Movimentações reais",
    description: "Conta, Área Pix, boletos, pagamentos e saques ficam próximos da agenda e das cobranças, conforme elegibilidade da conta.",
    bullets: ["Conta e saldo", "Pix e boletos", "Confirmação humana"],
    icon: CreditCard,
    dark: `${DARK_NEW_BATCH}/08-neurofinance-conta-saldo-dark.webp`,
    light: `${LIGHT_NEW_BATCH}/08-neurofinance-conta-saldo-white.webp`,
    alt: "Conta e saldo do NeuroFinance",
  },
  {
    key: "synapse",
    label: "Synapse",
    title: "Synapse AI",
    eyebrow: "Inteligência contextual",
    description: "A IA conversa com a rotina da clínica e ajuda a localizar informações, organizar tarefas e reduzir trabalho repetitivo.",
    bullets: ["Texto", "Voz", "Contexto da clínica"],
    icon: Sparkles,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/15-synapse-chat-dark.webp`,
    alt: "Synapse AI aberto no NeuroNex",
  },
  {
    key: "neuroview",
    label: "NeuroView",
    title: "NeuroView",
    eyebrow: "Visão sistêmica",
    description: "Conexões clínicas e informações relevantes ganham uma representação visual para apoiar leitura e organização.",
    bullets: ["Mapa 2D e 3D", "Conexões relevantes", "Notas contextuais"],
    icon: BrainCircuit,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/17-neuroview-2d-visao-de-todas-conexoes-dark.webp`,
    light: `${SCREENSHOT_ROOT}/desktop/light/17-neuroview-3d-white.webp`,
    alt: "Visualização das conexões clínicas no NeuroView",
  },
  {
    key: "neuropulse",
    label: "NeuroPulse",
    title: "NeuroPulse",
    eyebrow: "Síntese clínica",
    description: "Sinais, registros e informações do acompanhamento são sintetizados para facilitar leitura e continuidade.",
    bullets: ["Síntese visual", "Sinais relevantes", "Apoio ao acompanhamento"],
    icon: Users,
    dark: `${SCREENSHOT_ROOT}/desktop/light/18-neuropulse-sintetizando-white.webp`,
    light: `${SCREENSHOT_ROOT}/desktop/light/18-neuropulse-sintetizando-white.webp`,
    alt: "NeuroPulse sintetizando informações clínicas",
  },
  {
    key: "neuroflow",
    label: "NeuroFlow",
    title: "NeuroFlow",
    eyebrow: "Fluxos conectados",
    description: "Jornadas e conexões relevantes podem ser visualizadas como fluxos para organizar processos e próximos passos.",
    bullets: ["Fluxos visuais", "Conexões", "Próximas ações"],
    icon: GitBranch,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/19-neuroflow--fluxo-aberto-e-conexoes-relevantes-dark.webp`,
    alt: "Fluxo e conexões relevantes no NeuroFlow",
  },
];

const FeatureBadge = ({ children, icon: Icon = Sparkles }: { children: ReactNode; icon?: ElementType<{ className?: string }> }) => (
  <div className="inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-foreground/[0.035] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.045] dark:text-white/42">
    <Icon className="h-3.5 w-3.5" />
    {children}
  </div>
);

const SectionHeading = ({ eyebrow, title, description, align = "center" }: { eyebrow: string; title: ReactNode; description: string; align?: "center" | "left" }) => (
  <div className={cn("max-w-5xl", align === "center" && "mx-auto text-center")}>
    <FadeIn><FeatureBadge>{eyebrow}</FeatureBadge></FadeIn>
    <FadeIn delay={0.1}>
      <h2 className="mt-8 text-4xl font-black leading-[0.9] tracking-[-0.06em] text-foreground md:text-6xl lg:text-7xl">{title}</h2>
    </FadeIn>
    <FadeIn delay={0.18}>
      <p className={cn("mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/70 md:text-xl", align === "center" && "mx-auto")}>{description}</p>
    </FadeIn>
  </div>
);

const useResolvedScreenshot = (source: ScreenshotSource) => {
  const { theme } = useTheme();
  return theme === "light" ? source.light || source.dark : source.dark;
};

const ScreenshotImage = ({ source, eager = false, className }: { source: ScreenshotSource; eager?: boolean; className?: string }) => {
  const src = useResolvedScreenshot(source);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.img
        key={src}
        src={src}
        alt={source.alt}
        width={1280}
        height={720}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        initial={{ opacity: 0, scale: 0.992, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.992, filter: "blur(8px)" }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        className={cn("block h-auto w-full", className)}
      />
    </AnimatePresence>
  );
};

const ScreenshotLightbox = ({ source, label, open, onClose }: { source: ScreenshotSource; label: string; open: boolean; onClose: () => void }) => {
  const src = useResolvedScreenshot(source);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/88 p-5 backdrop-blur-xl md:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Imagem ampliada: ${label}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.965, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.975, y: 10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#09090b] shadow-[0_50px_180px_-50px_rgba(0,0,0,1)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-5 text-white">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/26" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/16" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              </div>
              <span className="ml-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">{label}</span>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                aria-label="Fechar imagem ampliada"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black p-3 md:p-5">
              <img src={src} alt={source.alt} width={1280} height={720} className="max-h-[calc(100vh-9rem)] w-auto max-w-full rounded-xl object-contain" />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};

const BrowserFrame = ({ source, label, eager = false, compact = false }: { source: ScreenshotSource; label: string; eager?: boolean; compact?: boolean }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-[30px] border border-border/45 bg-card shadow-[0_34px_110px_-72px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-[#08090b]">
        <div className={cn("flex items-center gap-2 border-b border-border/40 bg-background/82 px-5 dark:border-white/10 dark:bg-white/[0.035]", compact ? "h-11" : "h-14")}>
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/24" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/16" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
          <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group relative block aspect-video w-full overflow-hidden bg-[#050506] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
          aria-label={`Ampliar imagem: ${label}`}
        >
          <ScreenshotImage source={source} eager={eager} />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.035]" />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/22 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md">
              <Maximize2 className="h-3.5 w-3.5" /> Ampliar
            </span>
          </div>
        </button>
      </div>
      <ScreenshotLightbox source={source} label={label} open={expanded} onClose={() => setExpanded(false)} />
    </>
  );
};

export const LandingRealProductShowcase = () => {
  const [activeKey, setActiveKey] = useState(productModules[0].key);
  const active = productModules.find((module) => module.key === activeKey) || productModules[0];

  return (
    <section id="produto" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-[160px] dark:bg-white/[0.025]" />
      </div>
      <div className="relative z-10 mx-auto max-w-[1380px]">
        <SectionHeading
          eyebrow="Produto real"
          title={<>Veja o NeuroNex <span className="text-muted-foreground/35">por dentro.</span></>}
          description="Capturas reais das principais áreas do sistema. Alterne entre gestão clínica, financeiro, IA e módulos visuais para conhecer a experiência completa."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[292px_minmax(0,1fr)]">
          <div className="grid content-start gap-2 rounded-[30px] border border-border/40 bg-card/72 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            {productModules.map((module) => (
              <button
                key={module.key}
                type="button"
                onClick={() => setActiveKey(module.key)}
                className={cn(
                  "group flex min-h-12 items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-all duration-300",
                  activeKey === module.key
                    ? "bg-foreground text-background shadow-[0_18px_60px_-38px_rgba(0,0,0,0.65)]"
                    : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                )}
              >
                <module.icon className="h-4 w-4 shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-[0.16em]">{module.label}</span>
                <ArrowRight className={cn("ml-auto h-3.5 w-3.5 transition-all", activeKey === module.key ? "opacity-60" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-35")} />
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-[40px] border border-border/45 bg-card/70 p-4 shadow-[0_42px_130px_-82px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.025] md:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <BrowserFrame source={active} label={active.label} eager={active.key === "dashboard"} />
                <div className="mt-5 grid gap-5 rounded-[30px] border border-border/40 bg-background/75 p-6 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[0.88fr_1.12fr] md:p-7">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{active.eyebrow}</p>
                    <h3 className="mt-3 text-3xl font-black leading-[0.92] tracking-[-0.055em] text-foreground md:text-4xl">{active.title}</h3>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{active.description}</p>
                  </div>
                  <div className="grid content-start gap-2 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                    {active.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.028] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
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

const synapseModes = [
  {
    key: "text",
    label: "Texto",
    icon: MessageCircle,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/15-synapse-chat-dark.webp`,
    alt: "Synapse AI respondendo por texto no NeuroNex",
  },
  {
    key: "voice",
    label: "Voz",
    icon: Mic2,
    dark: `${SCREENSHOT_ROOT}/desktop/dark/16-synapse-voz-dark.webp`,
    alt: "Modo de voz do Synapse AI no NeuroNex",
  },
];

export const LandingRealSynapseSection = () => {
  const [mode, setMode] = useState(synapseModes[0]);

  return (
    <section id="synapse" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
      <div className="relative z-10 mx-auto max-w-[1320px]">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Synapse AI"
              title={<>A IA prepara. <span className="text-muted-foreground/35">Você revisa e decide.</span></>}
              description="Texto e voz usam somente o contexto autorizado para localizar informações, organizar a rotina e preparar ações com limites visíveis."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {synapseModes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item)}
                  className={cn(
                    "flex items-center gap-3 rounded-[22px] border px-5 py-4 text-left transition-all",
                    mode.key === item.key
                      ? "border-foreground bg-foreground text-background dark:border-white dark:bg-white dark:text-zinc-950"
                      : "border-border/45 bg-card/72 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.035]",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">Synapse por {item.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-2">
              {["Contexto da agenda e dos pacientes", "Acesso rápido por texto ou voz", "Apoio operacional — não substitui decisão clínica"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.025] px-4 py-3 text-xs font-bold text-foreground/68 dark:border-white/10 dark:bg-white/[0.035]">
                  <Check className="h-4 w-4 shrink-0" />{item}
                </div>
              ))}
            </div>
          </div>
          <FadeIn delay={0.15}>
            <BrowserFrame source={mode} label={`Synapse · ${mode.label}`} />
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

const financeCards: Array<ScreenshotSource & { title: string; eyebrow: string; description: string; icon: ElementType<{ className?: string }>; items: string[] }> = [
  {
    title: "Gestão Financeira",
    eyebrow: "Planejar e decidir",
    description: "Resultado, receitas, despesas, recebíveis, inadimplência, capital de giro e planejamento sem depender de uma conta bancária ativa.",
    icon: BarChart3,
    items: ["Fluxo de caixa", "Planejamento", "Relatórios"],
    dark: `${SCREENSHOT_ROOT}/desktop/dark/04-financeiro-visao-geral-dark.webp`,
    alt: "Visão geral da Gestão Financeira",
  },
  {
    title: "NeuroFinance",
    eyebrow: "Movimentar dinheiro real",
    description: "Conta, saldo, Área Pix, boletos, pagamentos, transferências e saques ficam em uma área financeira própria. Pontos de antecipação seguem em evolução.",
    icon: WalletCards,
    items: ["Conta e saldo", "Pix e boletos", "Pagamentos"],
    dark: `${DARK_NEW_BATCH}/08-neurofinance-conta-saldo-dark.webp`,
    light: `${LIGHT_NEW_BATCH}/08-neurofinance-conta-saldo-white.webp`,
    alt: "Conta e saldo do NeuroFinance",
  },
  {
    title: "Preparação fiscal",
    eyebrow: "Dados fiscais e evolução da NFS-e",
    description: "Dados fiscais, paciente, cobrança, RPS e emissão de NFS-e permanecem conectados ao mesmo fluxo financeiro.",
    icon: FileCheck2,
    items: ["Dados fiscais", "Emissão de NFS-e", "Automação fiscal"],
    dark: `${SCREENSHOT_ROOT}/desktop/dark/13-fiscal-dados-nfse-dark.webp`,
    light: `${LIGHT_NEW_BATCH}/13-fiscal-dados-nfse-white.webp`,
    alt: "Tela de dados fiscais e preparação para NFS-e no NeuroNex",
  },
];

export const LandingRealFinanceFiscalSection = () => (
  <section id="financeiro" className="public-section-stage relative overflow-hidden bg-background px-6 py-20 md:py-28">
    <div className="relative z-10 mx-auto max-w-[1380px]">
      <SectionHeading
        eyebrow="Financeiro sem confusão"
        title={<>Gestão para decidir. <span className="text-muted-foreground/35">NeuroFinance para movimentar.</span></>}
        description="Duas áreas com papéis claros: gestão para organizar e decidir, NeuroFinance para movimentar e recursos fiscais ligados ao consultório."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {financeCards.map((card, index) => (
          <FadeIn key={card.title} delay={index * 0.06}>
            <article className="h-full overflow-hidden rounded-[36px] border border-border/45 bg-card/76 p-4 shadow-[0_28px_90px_-72px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-white/[0.03]">
              <BrowserFrame source={card} label={card.eyebrow} compact />
              <div className="p-3 pb-4 pt-7 md:p-5 md:pt-8">
                <card.icon className="h-6 w-6 text-muted-foreground" />
                <h3 className="mt-7 text-3xl font-black leading-[0.92] tracking-[-0.055em] text-foreground">{card.title}</h3>
                <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{card.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {card.items.map((item) => (
                    <span key={item} className="rounded-full border border-border/40 bg-foreground/[0.03] px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] text-foreground/62 dark:border-white/10 dark:bg-white/[0.035]">{item}</span>
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
            <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">Uma operação conectada</p>
            <p className="mt-2 text-lg font-black tracking-[-0.035em]">A sessão conecta gestão e cobrança e prepara a base fiscal sem transformar o psicólogo em operador financeiro.</p>
          </div>
          <Button asChild className="h-12 shrink-0 rounded-2xl bg-background px-6 text-[9px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white">
            <Link to="/create-account">
              Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </FadeIn>
    </div>
  </section>
);
