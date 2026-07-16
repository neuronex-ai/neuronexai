"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  Check,
  FileText,
  GitBranch,
  HardDrive,
  MessageCircle,
  Mic2,
  Network,
  ScanText,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { ElementType } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type LandingIcon = ElementType<{ className?: string }>;

type ScreenshotSource = {
  dark: string;
  light?: string;
  alt: string;
};

type NeuroBoxTool = ScreenshotSource & {
  key: string;
  label: string;
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  icon: LandingIcon;
};

const tools: NeuroBoxTool[] = [
  {
    key: "neuroview",
    label: "NeuroView",
    title: "Grafo clínico 2D/3D Universe",
    eyebrow: "Mapeamento sistêmico",
    description:
      "Sintomas, notas, eventos, hipóteses e evolução do paciente ganham uma leitura visual para o psicólogo navegar relações complexas sem perder contexto.",
    bullets: ["Grafo 2D e 3D", "Nós clínicos rastreáveis", "Metadados para RAG"],
    icon: Network,
    dark: "/landing/screenshots/desktop/dark/17-neuroview-3d-dark.webp",
    light: "/landing/screenshots/desktop/light/17-neuroview-3d-white.webp",
    alt: "NeuroView exibindo grafo clínico em 3D",
  },
  {
    key: "neuropulse",
    label: "NeuroPulse",
    title: "Diagramas Mermaid a partir de notas",
    eyebrow: "Síntese clínica visual",
    description:
      "Textos clínicos podem virar diagramas de causa-efeito, fluxos e mapas de formulação para abordagens como TCC, Psicanálise e leitura psicodinâmica.",
    bullets: ["Mermaid clínico", "TCC e Psicanálise", "Formulação revisável"],
    icon: BrainCircuit,
    dark: "/landing/screenshots/desktop/light/18-neuropulse-sintetizando-white.webp",
    light: "/landing/screenshots/desktop/light/18-neuropulse-sintetizando-white.webp",
    alt: "NeuroPulse sintetizando informações clínicas",
  },
  {
    key: "neuroflow",
    label: "NeuroFlow",
    title: "Canvas para fluxos clínicos e operacionais",
    eyebrow: "Fluxos conectados",
    description:
      "A jornada do paciente, hipóteses, intervenções, cobrança e próximos passos podem ser organizados como um canvas vivo conectado ao prontuário.",
    bullets: ["Canvas visual", "Conexões clínicas", "Próximas ações"],
    icon: GitBranch,
    dark: "/landing/screenshots/desktop/dark/19-neuroflow--fluxo-aberto-e-conexoes-relevantes-dark.webp",
    alt: "NeuroFlow exibindo fluxo aberto com conexões relevantes",
  },
  {
    key: "neuroscan",
    label: "NeuroScan",
    title: "Anamnese e documentos viram dados revisáveis",
    eyebrow: "Estruturação assistida",
    description:
      "Fichas e documentos clínicos entram em uma etapa de extração assistida para reduzir digitação, manter revisão humana e enriquecer o prontuário.",
    bullets: ["OCR assistido", "Campos estruturados", "Revisão do psicólogo"],
    icon: ScanText,
    dark: "/landing/screenshots/desktop/dark/12-paciente-prontuario-historico-dark.webp",
    alt: "Prontuário com histórico do paciente usado como base do NeuroScan",
  },
  {
    key: "neurodrive",
    label: "NeuroDrive",
    title: "Arquivos clínicos com vínculo e finalidade",
    eyebrow: "Documentos organizados",
    description:
      "Arquivos próprios e arquivos de pacientes ficam separados, com busca, vínculo, prévia, download e links seguros para os fluxos autorizados.",
    bullets: ["Arquivos próprios", "Vínculo com paciente", "Acesso por finalidade"],
    icon: HardDrive,
    dark: "/landing/screenshots/desktop/dark/12-paciente-prontuario-historico-dark.webp",
    alt: "Prontuário e arquivos do paciente conectados ao NeuroDrive",
  },
  {
    key: "neurofinance",
    label: "NeuroFinance",
    title: "Metadados financeiros no raciocínio da clínica",
    eyebrow: "Core banking conectado",
    description:
      "Receita, inadimplência, PIX, boletos, NFS-e/RPS e capital de giro entram no contexto autorizado do Synapse sem misturar decisão clínica com operação financeira.",
    bullets: ["Pix e boletos", "Capital preditivo", "Confirmação por PIN"],
    icon: WalletCards,
    dark: "/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp",
    light: "/landing/screenshots/desktop/light/Nova remessa/08-neurofinance-conta-saldo-white.webp",
    alt: "Conta e saldo do NeuroFinance",
  },
  {
    key: "synapse",
    label: "Synapse",
    title: "Agente de voz e texto intermediando tudo",
    eyebrow: "Agência assistida",
    description:
      "O Synapse lê metadados autorizados, prepara comandos e exige confirmação para ações sensíveis em tempo real, no painel e por voz.",
    bullets: ["Voz e texto", "Contexto autorizado", "Auditoria de actions"],
    icon: Bot,
    dark: "/landing/screenshots/desktop/dark/16-synapse-voz-dark.webp",
    alt: "Synapse em modo de voz dentro da NeuroNex",
  },
];

const metadataRows = [
  "Paciente, sessão, nota e hipótese clínica",
  "Nós e arestas do NeuroView para busca semântica",
  "Diagramas Mermaid e fluxos gerados pelo NeuroPulse",
  "Canvas, origem, destino e estado do NeuroFlow",
  "Arquivos próprios e de pacientes no NeuroDrive",
  "Cobranças, Pix, NFS-e/RPS e risco financeiro",
  "Consentimento, plano, permissão, PIN e trilha de auditoria",
];

const agentModes = [
  { icon: MessageCircle, title: "Texto", text: "Comandos naturais para abrir superfícies, comparar contexto, gerar diagramas e preparar ações." },
  { icon: Mic2, title: "Voz", text: "Agência assistida em tempo real para navegar, resumir e revisar antes de confirmar." },
  { icon: ShieldCheck, title: "Confirmação", text: "Mutation clínica ou financeira sensível exige validação explícita, plano elegível e trilha operacional." },
];

const useResolvedScreenshot = (source: ScreenshotSource) => {
  const { theme } = useTheme();
  return theme === "light" ? source.light || source.dark : source.dark;
};

const BrowserFrame = ({
  source,
  label,
  eager = false,
}: {
  source: ScreenshotSource;
  label: string;
  eager?: boolean;
}) => {
  const src = useResolvedScreenshot(source);

  return (
    <div className="overflow-hidden rounded-[30px] border border-border/45 bg-card shadow-[0_34px_110px_-72px_rgba(0,0,0,0.72)] dark:border-white/10 dark:bg-[#08090b]">
      <div className="flex h-12 items-center gap-2 border-b border-border/40 bg-background/82 px-5 dark:border-white/10 dark:bg-white/[0.035]">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/24" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/16" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</span>
      </div>
      <img
        src={src}
        alt={source.alt}
        width={1280}
        height={720}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block aspect-video w-full object-cover"
      />
    </div>
  );
};

const NeuroBoxLanding = () => {
  const shouldReduceMotion = useReducedMotion();
  const [activeKey, setActiveKey] = useState(tools[0].key);
  const activeTool = tools.find((tool) => tool.key === activeKey) || tools[0];
  const heroImage = useResolvedScreenshot(tools[0]);

  const scrollToTools = () => {
    document.getElementById("neurobox-tools")?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/20">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />

      <main>
        <section className="relative min-h-[88vh] overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-24 md:pt-44">
          <img
            src={heroImage}
            alt="NeuroView como plano visual da landing NeuroBox"
            width={1280}
            height={720}
            loading="eager"
            decoding="async"
            className="absolute inset-x-0 bottom-0 mx-auto h-[56vh] w-full max-w-[1500px] object-cover opacity-28 dark:opacity-32"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background)/0.78)_38%,hsl(var(--background))_100%)]" />
          <div className="relative z-10 mx-auto max-w-[1180px] text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-background/70 px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-xl dark:border-white/10 dark:bg-black/35"
            >
              <Sparkles className="h-3.5 w-3.5" />
              NeuroBox
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mx-auto mt-8 max-w-5xl text-5xl font-black leading-none text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
            >
              A caixa de ferramentas de IA profunda da Clínica Autônoma.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/76 md:text-xl"
            >
              NeuroView, NeuroFlow, NeuroPulse, NeuroScan e NeuroFinance trabalham com o Synapse para transformar notas, sintomas, fluxos e finanças em decisões assistidas.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"
            >
              <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
                <Link to="/create-account">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-14 rounded-2xl bg-background/50 px-7 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-xl"
                onClick={scrollToTools}
              >
                Ver ferramentas
              </Button>
            </motion.div>
          </div>
        </section>

        <section id="neurobox-tools" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">NeuroBox Suite</p>
              <h2 className="mt-6 text-4xl font-black leading-none md:text-6xl lg:text-7xl">Ferramentas especializadas. Um mesmo contexto autorizado.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                Cada ferramenta tem função própria, mas todas expõem metadados estruturados para que o RAG do Synapse entenda origem, limite, permissão e estado.
              </p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="grid content-start gap-2 rounded-[30px] border border-border/40 bg-card/72 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                {tools.map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    onClick={() => setActiveKey(tool.key)}
                    className={cn(
                      "group flex min-h-12 items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-all duration-300",
                      activeKey === tool.key
                        ? "bg-foreground text-background shadow-[0_18px_60px_-38px_rgba(0,0,0,0.65)]"
                        : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                    )}
                  >
                    <tool.icon className="h-4 w-4 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">{tool.label}</span>
                    <ArrowRight className={cn("ml-auto h-3.5 w-3.5 transition-all", activeKey === tool.key ? "opacity-60" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-35")} />
                  </button>
                ))}
              </div>

              <div className="rounded-[40px] border border-border/45 bg-card/70 p-4 shadow-[0_42px_130px_-82px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.025] md:p-5">
                <BrowserFrame source={activeTool} label={activeTool.label} eager={activeTool.key === "neuroview"} />
                <div className="mt-5 grid gap-5 rounded-[30px] border border-border/40 bg-background/75 p-6 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[0.9fr_1.1fr] md:p-7">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{activeTool.eyebrow}</p>
                    <h3 className="mt-3 text-3xl font-black leading-none text-foreground md:text-4xl">{activeTool.title}</h3>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{activeTool.description}</p>
                  </div>
                  <div className="grid content-start gap-2 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                    {activeTool.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-foreground/[0.028] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
                        <Check className="h-4 w-4 shrink-0" />
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <FileText className="h-7 w-7 opacity-55" />
              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Contrato de metadados</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">O Synapse não adivinha. Ele consome superfícies bem descritas.</h2>
              <p className="mt-6 text-base font-medium leading-relaxed opacity-64">
                O valor do NeuroBox está em transformar cada ferramenta em fonte estruturada para busca, raciocínio e ação assistida.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {metadataRows.map((item) => (
                <article key={item} className="rounded-[28px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <Check className="h-5 w-5 opacity-55" />
                  <h3 className="mt-7 text-xl font-black leading-tight">{item}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Synapse no centro</p>
              <h2 className="mt-6 text-4xl font-black leading-none md:text-6xl lg:text-7xl">Voz, texto e confirmação para cada ação sensível.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                O Synapse atua como agente de interface: navega, resume, prepara e pede confirmação. O profissional mantém decisão, responsabilidade e autorização.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {agentModes.map((mode) => (
                <article key={mode.title} className="rounded-[30px] border border-border/40 bg-card/72 p-7 dark:border-white/10 dark:bg-white/[0.03]">
                  <mode.icon className="h-6 w-6 text-muted-foreground" />
                  <h3 className="mt-8 text-2xl font-black leading-tight">{mode.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{mode.text}</p>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              <BrowserFrame source={tools[1]} label="NeuroPulse" />
              <BrowserFrame source={tools[2]} label="NeuroFlow" />
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1180px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <BarChart3 className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-none md:text-6xl">Da nota clínica ao fluxo financeiro, tudo vira contexto acionável.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-64">
              A NeuroBox existe para que a IA da NeuroNex enxergue a clínica em mapas, fluxos, diagramas, documentos e dados financeiros, sempre com permissão e revisão humana.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                <Link to="/create-account">
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
                <Link to="/neurofinance">Ver NeuroFinance</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NeuroBoxLanding;
