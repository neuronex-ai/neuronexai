"use client";

import { ArrowRight, CreditCard, LifeBuoy, Mail, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";

const channels = [
  { icon: LifeBuoy, title: "Suporte técnico", text: "Erros, acesso, configuração e uso do sistema.", subject: "Suporte técnico NeuroNex" },
  { icon: CreditCard, title: "NeuroFinance", text: "Conta, análise, Pix, boletos, pagamentos e saques.", subject: "Atendimento NeuroFinance" },
  { icon: Sparkles, title: "Comercial e planos", text: "Planos, implantação, clínicas e parcerias.", subject: "Comercial NeuroNex" },
  { icon: ShieldCheck, title: "Privacidade e LGPD", text: "Solicitações relacionadas a dados e privacidade.", subject: "Privacidade e LGPD" },
];

const Contact = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="hidden md:block"><Navbar /></div>
    <LandingMobileNav />
    <main className="px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-48">
      <section className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/45 px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground"><MessageSquare className="h-4 w-4" />Contato NeuroNex</div>
        <h1 className="mt-8 text-[clamp(3.2rem,7vw,7rem)] font-black leading-[0.86] tracking-[-0.075em]">Fale com uma equipe <span className="text-muted-foreground/35">que conhece o produto.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/70 md:text-xl">Escolha o assunto e use o canal oficial. Sem formulários que simulam envio ou confirmações falsas.</p>
      </section>

      <section className="mx-auto mt-12 grid max-w-[1100px] gap-4 md:grid-cols-2">
        {channels.map((channel) => (
          <article key={channel.title} className="rounded-[30px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]">
            <channel.icon className="h-6 w-6 text-muted-foreground" />
            <h2 className="mt-8 text-2xl font-black tracking-[-0.045em]">{channel.title}</h2>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/70">{channel.text}</p>
            <a href={`mailto:contato@neuronexai.com.br?subject=${encodeURIComponent(channel.subject)}`} className="mt-7 inline-flex items-center text-[9px] font-black uppercase tracking-[0.18em] hover:underline">Enviar e-mail <ArrowRight className="ml-2 h-4 w-4" /></a>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-6 grid max-w-[1100px] gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-[30px] bg-foreground p-7 text-background dark:bg-white dark:text-zinc-950"><LifeBuoy className="h-6 w-6 opacity-55" /><h2 className="mt-8 text-3xl font-black leading-[0.92] tracking-[-0.05em]">Talvez a resposta já esteja pronta.</h2><p className="mt-4 text-sm font-medium leading-relaxed opacity-62">Consulte orientações sobre agenda, pacientes, financeiro e Synapse.</p><Button asChild className="mt-7 h-12 w-full rounded-2xl bg-background text-[9px] font-black uppercase tracking-[0.18em] text-foreground dark:bg-zinc-950 dark:text-white"><Link to="/ajuda">Abrir Central de Ajuda <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></article>
        <article className="rounded-[30px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]"><Mail className="h-6 w-6 text-muted-foreground" /><p className="mt-8 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Canal oficial</p><a href="mailto:contato@neuronexai.com.br" className="mt-3 block text-2xl font-black tracking-[-0.04em] hover:underline">contato@neuronexai.com.br</a><p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70">Inclua no e-mail o assunto, a tela envolvida, o comportamento observado e, quando possível, uma captura sem dados sensíveis.</p></article>
      </section>
    </main>
    <Footer />
  </div>
);

export default Contact;
