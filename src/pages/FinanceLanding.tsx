"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Check,
  ChevronDown,
  CreditCard,
  FileCheck2,
  Landmark,
  LockKeyhole,
  MessageCircle,
  Mic2,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { ElementType } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AsaasRegulatoryFooter } from "@/components/financeiro/AsaasRegulatoryFooter";
import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import {
  PublicProductHero,
  PublicRouteBreadcrumbs,
} from "@/components/public/PublicPageShell";
import { PublicProductShowcase } from "@/components/public/PublicProductShowcase";
import { getPublicPage } from "@/content/public-content";
import {
  getPublicMediaCollection,
  getPublicMediaImage,
} from "@/content/public-product-media";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type LandingIcon = ElementType<{ className?: string }>;

type Capability = {
  icon: LandingIcon;
  title: string;
  text: string;
};

type FlowStep = {
  title: string;
  text: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

const neurofinanceShowcaseImages = getPublicMediaCollection("neurofinance");

const capabilities: Capability[] = [
  {
    icon: Landmark,
    title: "Conta digital integrada",
    text: "Saldo, extrato, saques e movimentações reais ficam dentro da rotina clínica, sujeitos à aprovação cadastral e aos limites da conta.",
  },
  {
    icon: QrCode,
    title: "Área Pix própria",
    text: "Pix por chave, QR Code ou copia e cola, com contexto do paciente, cobrança e sessão no mesmo fluxo operacional.",
  },
  {
    icon: ReceiptText,
    title: "Boletos e cobranças",
    text: "Cobranças avulsas, recorrentes e parceladas reduzem baixa manual e aproximam atendimento, recebimento e conciliação.",
  },
  {
    icon: FileCheck2,
    title: "NFS-e e RPS perto da cobrança",
    text: "Dados fiscais, cobrança, emissão e histórico ficam no mesmo percurso, conforme elegibilidade e disponibilidade de cada fluxo.",
  },
  {
    icon: TrendingUp,
    title: "Recebíveis com status claro",
    text: "Acompanhe recebíveis e a elegibilidade da conta. Pontos de antecipação ainda estão em evolução e não aparecem como disponibilidade garantida.",
  },
  {
    icon: BarChart3,
    title: "Planejamento de caixa",
    text: "Consulte receita, agenda, inadimplência e compromissos autorizados para organizar decisões financeiras com mais contexto.",
  },
];

const flow: FlowStep[] = [
  { title: "Sessão", text: "Atendimento, paciente e agenda preservam o contexto financeiro correto." },
  { title: "Cobrança", text: "Pix, boleto ou link de pagamento saem do mesmo percurso operacional." },
  { title: "Fiscal", text: "NFS-e/RPS usa dados já conectados ao paciente e à cobrança." },
  { title: "Conciliação", text: "Recebimento, extrato e baixa reduzem conferências manuais." },
  { title: "Acompanhamento", text: "Gestão Financeira e Synapse ajudam a consultar atrasos e recebíveis autorizados antes da próxima decisão." },
];

const safetyItems = [
  "PIN para pagamentos, Pix, saques e outras movimentações sensíveis",
  "Validação de voz assistida quando o agente prepara ações críticas",
  "Elegibilidade por plano, status da conta, saldo, limites e auditoria",
  "Confirmação humana antes de qualquer movimentação real",
];

const faqs: FaqItem[] = [
  {
    question: "A NeuroNex é banco?",
    answer:
      "Não. A NeuroNex é a plataforma tecnológica. Os serviços financeiros e a infraestrutura regulada do NeuroFinance são operados por parceiro financeiro, com fluxos, limites, tarifas e aprovação conforme termos aplicáveis.",
  },
  {
    question: "O Synapse pode pagar ou transferir sozinho?",
    answer:
      "Não. O Synapse pode preparar uma ação, explicar o contexto e pedir confirmação. Pagamentos, PIX, saques, boletos e antecipações exigem validação por PIN ou validação de voz assistida quando aplicável.",
  },
  {
    question: "A gestão financeira depende da conta digital?",
    answer:
      "Não. A gestão registra, projeta e analisa a clínica mesmo sem conta ativa. O NeuroFinance adiciona a camada de movimentação real quando a conta está aprovada e elegível.",
  },
  {
    question: "Onde entram NeuroZap e no-show?",
    answer:
      "A conexão e a sincronização autorizadas do WhatsApp Business estão em validação no NeuroZap. Inbox, etiquetas e contexto avançado para confirmações ou cobranças continuam em evolução.",
  },
];

const BrowserFrame = ({
  src,
  alt,
  label,
  eager = false,
}: {
  src: string;
  alt: string;
  label: string;
  eager?: boolean;
}) => (
  <div className="overflow-hidden rounded-[32px] border border-border/45 bg-card shadow-[0_36px_110px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]">
    <div className="flex h-12 items-center gap-2 border-b border-border/40 bg-background/80 px-5 dark:border-white/10 dark:bg-white/[0.035]">
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/24" />
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/16" />
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
      <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</span>
    </div>
    <img
      src={src}
      alt={alt}
      width={1280}
      height={720}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className="block aspect-video w-full object-contain"
    />
  </div>
);

const FinanceLanding = () => {
  const page = getPublicPage("/neurofinance");
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [openFaq, setOpenFaq] = useState(0);
  const activeMediaTheme = theme === "light" ? "light" : "dark";
  const pixScreenshot = getPublicMediaImage(
    "neurofinance",
    activeMediaTheme,
    "area-pix",
  );
  const fiscalScreenshot = activeMediaTheme === "light"
    ? getPublicMediaImage("neurofinance", "light", "nfse")
    : getPublicMediaImage("prontuario", "dark", "fiscal--acoes");

  if (!page) return null;

  const scrollToCapabilities = () => {
    document.getElementById("core-banking-neurofinance")?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className="public-lumen-page min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/20">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />

      <main>
        <PublicRouteBreadcrumbs route="/neurofinance" />
        <PublicProductHero
          page={page}
          showImage={false}
          actions={
            <>
              <Button asChild className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase text-background">
                <Link to="/create-account">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="public-tactile h-14 rounded-full border-border/70 bg-background/38 px-7 font-mono text-[10px] font-black uppercase backdrop-blur-xl"
                onClick={scrollToCapabilities}
              >
                Ver recursos
              </Button>
            </>
          }
        />
        <PublicProductShowcase
          title="NeuroFinance por dentro"
          eyebrow="Conta e operação financeira"
          images={neurofinanceShowcaseImages}
          className="public-product-media-band"
          frameClassName="public-product-media-frame"
        />

        <section className="public-section-stage public-inverted-section border-y border-border/35 text-background dark:text-zinc-950">
          <div className="mx-auto grid max-w-[1380px] gap-px bg-background/10 md:grid-cols-3">
            {[
              { icon: WalletCards, label: "Gestão Financeira", title: "Planejar e decidir", text: "Receitas, despesas, inadimplência, recebíveis e fluxo projetado." },
              { icon: CreditCard, label: "NeuroFinance", title: "Movimentar dinheiro real", text: "Conta, Pix, boletos, pagamentos, saques e extrato." },
              { icon: Sparkles, label: "Synapse", title: "Consultar e preparar com confirmação", text: "Métricas, transações e próximos passos dentro do contexto autorizado." },
            ].map((item) => (
              <article key={item.label} className="bg-foreground p-8 dark:bg-white md:p-12">
                <item.icon className="h-6 w-6 opacity-55" />
                <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">{item.label}</p>
                <h2 className="mt-3 text-4xl font-black leading-none md:text-5xl">{item.title}</h2>
                <p className="mt-5 max-w-xl text-sm font-medium leading-relaxed opacity-62 md:text-base">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="core-banking-neurofinance" className="public-section-stage bg-background px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Financeiro conectado à rotina</p>
              <h2 className="mt-6 text-4xl font-black leading-[1.02] text-foreground md:text-6xl">
                Receba, cobre e acompanhe sem separar o financeiro da clínica.
              </h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                Cada recurso financeiro foi pensado para operar perto da sessão, da cobrança, do paciente e da decisão de caixa.
              </p>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.title} className="public-neurox-card rounded-[28px] p-6">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-xl font-black">{item.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/68">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section-stage px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto grid max-w-[1320px] gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950 md:p-10">
              <LockKeyhole className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Segurança financeira</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">Movimentar dinheiro exige uma confirmação visível.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed opacity-62 md:text-base">
                O Synapse pode preparar uma ação, mas pagamentos, PIX, saques, boletos e antecipações passam por confirmações rígidas antes de qualquer movimentação real.
              </p>
              <div className="mt-8 grid gap-2">
                {safetyItems.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                    <Check className="h-4 w-4 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <div className="grid gap-5">
              <BrowserFrame
                src={pixScreenshot.src}
                alt="Área Pix e cobranças do NeuroFinance com Synapse por voz"
                label="Área Pix + Synapse"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <article className="public-neurox-card rounded-[28px] p-6">
                  <Mic2 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-7 text-2xl font-black leading-tight">Voz assistida para revisar antes de confirmar.</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">Ação crítica passa por leitura de contexto, checagem de intenção e confirmação explícita.</p>
                </article>
                <article className="public-neurox-card rounded-[28px] p-6">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-7 text-2xl font-black leading-tight">PIN, plano, saldo e limites no mesmo portão.</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">A aprovação não depende só do comando: depende da elegibilidade operacional inteira.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="public-section-stage public-inverted-section px-5 py-20 text-background dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="max-w-4xl">
              <BadgeCheck className="h-7 w-7 opacity-55" />
              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Da sessão ao caixa</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">Cada recebimento continua ligado ao que aconteceu antes.</h2>
            </div>
            <div className="mt-12 grid gap-3 lg:grid-cols-5">
              {flow.map((item, index) => (
                <article key={item.title} className="rounded-[28px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-45">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-7 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed opacity-64">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section-stage px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <BrowserFrame
              src={fiscalScreenshot.src}
              alt="Dados fiscais e emissão de NFS-e/RPS no NeuroFinance"
              label="NFS-e e RPS"
            />
            <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03] md:p-10">
              <FileCheck2 className="h-7 w-7 text-muted-foreground" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Fiscal conectado</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">NFS-e/RPS perto da cobrança, não no fim do dia.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70 md:text-base">
                Dados fiscais, paciente, cobrança e histórico financeiro ficam no mesmo percurso para reduzir erro, retrabalho e esquecimento.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {["Dados do prestador", "Serviço municipal", "Cobrança vinculada", "Histórico fiscal"].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/40 bg-foreground/[0.03] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="public-section-stage px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto grid max-w-[1320px] gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950 md:p-10">
              <MessageCircle className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">NeuroZap em validação</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">WhatsApp conectado por etapas, com status claro.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed opacity-62 md:text-base">
                Conexão e sincronização autorizadas estão em validação. Inbox, etiquetas e contexto avançado com outras áreas continuam em evolução.
              </p>
            </article>
            <div className="rounded-[38px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Dúvidas frequentes</p>
              <div className="mt-5 divide-y divide-border/40 dark:divide-white/10">
                {faqs.map((faq, index) => (
                  <button
                    key={faq.question}
                    id={`finance-faq-trigger-${index}`}
                    type="button"
                    aria-expanded={openFaq === index}
                    aria-controls={`finance-faq-panel-${index}`}
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="block w-full py-5 text-left"
                  >
                    <div className="flex items-center justify-between gap-5">
                      <span className="text-sm font-black md:text-base">{faq.question}</span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", openFaq === index && "rotate-180")} />
                    </div>
                    <AnimatePresence initial={false}>
                      {openFaq === index ? (
                        <motion.p
                          id={`finance-faq-panel-${index}`}
                          role="region"
                          aria-labelledby={`finance-faq-trigger-${index}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pt-4 text-sm font-medium leading-relaxed text-muted-foreground/72"
                        >
                          {faq.answer}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="public-section-stage px-5 pb-20 md:px-8 md:pb-28">
          <div className="public-closing-neutral mx-auto max-w-[1200px] rounded-[42px] p-8 text-center md:p-12">
            <h2 className="mx-auto max-w-4xl text-4xl font-black leading-none md:text-6xl">Organize na Gestão Financeira. Movimente no NeuroFinance.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/70">
              Ative recursos bancários conforme plano, aprovação cadastral, elegibilidade da conta e validações de segurança.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-background">
                <Link to="/create-account">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="public-tactile h-14 rounded-full px-7 font-mono text-[10px] font-black uppercase tracking-[0.18em]">
                <Link to="/contato">Falar com a equipe</Link>
              </Button>
            </div>
            <div className="mt-10 opacity-70">
              <AsaasRegulatoryFooter />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FinanceLanding;
