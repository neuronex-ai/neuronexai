"use client";

import { ArrowRight, Cookie, FileText, LockKeyhole, Mail, Scale, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";

const legalDocuments = [
  {
    icon: Scale,
    eyebrow: "Condições de uso",
    title: "Termos de Uso",
    description: "Regras de acesso, responsabilidades, planos, pagamentos, recursos clínicos e serviços financeiros.",
    href: "/termos-de-uso",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Proteção de dados",
    title: "Política de Privacidade",
    description: "Como a NeuroNex coleta, utiliza, armazena e protege dados pessoais e informações de integrações.",
    href: "/politica-de-privacidade",
  },
  {
    icon: Cookie,
    eyebrow: "Preferências digitais",
    title: "Política de Cookies",
    description: "Quais categorias de cookies podem ser utilizadas e como gerenciar as preferências no navegador.",
    href: "/configuracoes-de-cookies",
  },
];

const principles = [
  "Finalidade e necessidade no tratamento de dados.",
  "Transparência sobre integrações e provedores.",
  "Controles de acesso para informações sensíveis.",
  "IA como apoio operacional, não substituição clínica.",
  "Canal para solicitações de privacidade e LGPD.",
];

const Legal = () => (
  <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
    <div className="hidden md:block"><Navbar /></div>
    <LandingMobileNav />

    <main>
      <section className="relative overflow-hidden px-5 pb-20 pt-32 text-center md:px-8 md:pb-28 md:pt-48">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[580px] w-[920px] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-[170px] dark:bg-white/[0.03]" />
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"><LockKeyhole className="h-4 w-4" />Central Jurídica</div>
          <h1 className="mt-8 text-[clamp(3.4rem,7.4vw,7.5rem)] font-black leading-[0.85] tracking-[-0.075em]">Transparência para uma rotina <span className="text-muted-foreground/35">que exige confiança.</span></h1>
          <p className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">Consulte os documentos canônicos sobre uso da plataforma, privacidade e cookies. Cada tema possui uma página própria para evitar versões duplicadas.</p>
        </div>
      </section>

      <section className="px-5 pb-20 md:px-8 md:pb-28">
        <div className="mx-auto grid max-w-[1260px] gap-4 lg:grid-cols-3">
          {legalDocuments.map((document) => (
            <article key={document.title} className="flex min-h-[350px] flex-col rounded-[34px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03] md:p-8">
              <document.icon className="h-7 w-7 text-muted-foreground" />
              <p className="mt-9 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">{document.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-black leading-[0.92] tracking-[-0.055em]">{document.title}</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70">{document.description}</p>
              <Link to={document.href} className="mt-auto inline-flex items-center pt-8 text-[9px] font-black uppercase tracking-[0.18em] hover:underline">Abrir documento <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <FileText className="h-7 w-7 opacity-55" />
            <p className="mt-9 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Princípios públicos</p>
            <h2 className="mt-4 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-6xl">Documentos claros, sem promessas técnicas decorativas.</h2>
          </div>
          <div className="grid gap-3">
            {principles.map((principle, index) => (
              <div key={principle} className="flex items-start gap-4 rounded-[24px] border border-background/10 bg-background/[0.07] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                <span className="font-mono text-xs opacity-45">0{index + 1}</span>
                <p className="text-sm font-semibold leading-relaxed opacity-78 md:text-base">{principle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-8 rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03] md:flex-row md:p-10">
          <div>
            <Mail className="h-6 w-6 text-muted-foreground" />
            <h2 className="mt-7 text-3xl font-black tracking-[-0.05em]">Solicitação de privacidade ou LGPD?</h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground/70">Utilize o canal oficial e identifique o assunto para que a solicitação seja direcionada corretamente.</p>
          </div>
          <Button asChild className="h-14 shrink-0 rounded-2xl bg-foreground px-7 text-[9px] font-black uppercase tracking-[0.18em] text-background"><Link to="/contato">Entrar em contato <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </section>
    </main>

    <Footer />
  </div>
);

export default Legal;
