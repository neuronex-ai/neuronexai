"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BarChart3, Check, ChevronDown, CreditCard, FileCheck2, Landmark, LockKeyhole, QrCode, ReceiptText, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { AsaasRegulatoryFooter } from "@/components/financeiro/AsaasRegulatoryFooter";
import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const accountImage = {
  dark: "/landing/screenshots/desktop/dark/nova remessa/08-neurofinance-conta-saldo-dark.webp",
  light: "/landing/screenshots/desktop/light/Nova remessa/08-neurofinance-conta-saldo-white.webp",
};

const capabilities = [
  { icon: QrCode, title: "Pix", text: "Receba, pague e transfira usando chaves, QR Code ou copia e cola." },
  { icon: ReceiptText, title: "Boletos", text: "Crie cobranças e pague contas dentro do fluxo financeiro." },
  { icon: CreditCard, title: "Cobranças", text: "Organize recebimentos avulsos, parcelados e recorrentes." },
  { icon: Send, title: "Transferências", text: "Movimente recursos para contas cadastradas com segurança." },
  { icon: FileCheck2, title: "Preparação fiscal", text: "Organize os dados necessários; emissão de NFS-e e automações ainda estão em evolução." },
  { icon: ShieldCheck, title: "Saúde da conta", text: "Acompanhe análise cadastral, documentos, limites e requisitos." },
];

const faqs = [
  ["Preciso ativar o NeuroFinance para usar a Gestão Financeira?", "Não. A Gestão Financeira é a camada gerencial da clínica. O NeuroFinance é a camada bancária para conta, Pix, boletos, pagamentos, transferências e saldo real."],
  ["A conta é liberada imediatamente?", "A criação depende do envio de dados e da análise do parceiro financeiro. O status e as pendências ficam disponíveis em Saúde da Conta."],
  ["Operações sensíveis usam PIN?", "Pagamentos, transferências e outras ações podem exigir PIN, saldo disponível, conta aprovada e validações adicionais."],
  ["Existem tarifas?", "Algumas operações podem ter custos e prazos próprios. As informações aplicáveis são apresentadas no sistema."],
];

const FinanceLanding = () => {
  const { theme } = useTheme();
  const [openFaq, setOpenFaq] = useState(0);
  const screenshot = theme === "light" ? accountImage.light : accountImage.dark;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground selection:bg-primary/20">
      <div className="hidden md:block"><Navbar /></div>
      <LandingMobileNav />

      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-48">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-foreground/[0.045] blur-[170px] dark:bg-white/[0.035]" />
          <div className="relative z-10 mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"><Sparkles className="h-3.5 w-3.5" />NeuroFinance</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-8 text-[clamp(3.3rem,7.3vw,7.6rem)] font-black leading-[0.84] tracking-[-0.075em]">Sua conta financeira, <span className="text-muted-foreground/35">conectada à clínica.</span></motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">Receba, cobre, pague e acompanhe o dinheiro do consultório sem separar a operação financeira dos atendimentos.</motion.p>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background"><Link to="/create-account">Começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]" onClick={() => document.getElementById("recursos-neurofinance")?.scrollIntoView({ behavior: "smooth" })}>Conhecer os recursos</Button>
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="mt-16 overflow-hidden rounded-[34px] border border-border/45 bg-card shadow-[0_36px_120px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]">
              <div className="flex h-12 items-center gap-2 border-b border-border/40 px-5 dark:border-white/10"><span className="h-2.5 w-2.5 rounded-full bg-foreground/22" /><span className="h-2.5 w-2.5 rounded-full bg-foreground/14" /><span className="h-2.5 w-2.5 rounded-full bg-foreground/8" /><span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Conta e Saldo</span></div>
              <AnimatePresence mode="wait" initial={false}><motion.img key={screenshot} src={screenshot} alt="Conta e saldo do NeuroFinance" width={1280} height={720} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="block aspect-video w-full object-cover" /></AnimatePresence>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-border/35 bg-foreground text-background dark:bg-white dark:text-zinc-950">
          <div className="mx-auto grid max-w-[1380px] gap-px bg-background/10 md:grid-cols-2">
            <article className="bg-foreground p-8 dark:bg-white md:p-12"><BarChart3 className="h-6 w-6 opacity-55" /><p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Gestão Financeira</p><h2 className="mt-3 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-5xl">Planejar, analisar e decidir.</h2><p className="mt-5 max-w-xl text-sm font-medium leading-relaxed opacity-62 md:text-base">Receitas, despesas, resultado, fluxo e planejamento funcionam sem depender de conta bancária ativa.</p></article>
            <article className="bg-foreground p-8 dark:bg-white md:p-12"><Landmark className="h-6 w-6 opacity-55" /><p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">NeuroFinance</p><h2 className="mt-3 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-5xl">Receber, pagar e movimentar.</h2><p className="mt-5 max-w-xl text-sm font-medium leading-relaxed opacity-62 md:text-base">Conta, saldo, Pix, boletos, pagamentos e transferências em uma camada bancária protegida.</p></article>
          </div>
        </section>

        <section id="recursos-neurofinance" className="bg-background px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center"><p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Capacidades</p><h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">Uma conta preparada para <span className="text-muted-foreground/35">a operação real.</span></h2><p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">Recursos bancários e fiscais organizados para a rotina do consultório.</p></div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{capabilities.map((item) => <article key={item.title} className="rounded-[28px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]"><item.icon className="h-5 w-5 text-muted-foreground" /><h3 className="mt-8 text-xl font-black tracking-[-0.035em]">{item.title}</h3><p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/68">{item.text}</p></article>)}</div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950 md:p-10"><LockKeyhole className="h-7 w-7 opacity-55" /><h2 className="mt-10 text-4xl font-black leading-[0.9] tracking-[-0.06em]">Segurança antes da movimentação.</h2><p className="mt-5 text-sm font-medium leading-relaxed opacity-62 md:text-base">Plano elegível, criação da conta, análise cadastral, saldo, limites e PIN são verificados conforme a operação.</p><div className="mt-8 grid gap-2">{["Análise e documentação", "PIN para ações sensíveis", "Limites e status da conta", "Custos apresentados quando aplicáveis"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.13em] dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]"><Check className="h-4 w-4" />{item}</div>)}</div></article>
            <div className="rounded-[38px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Dúvidas frequentes</p><div className="mt-5 divide-y divide-border/40 dark:divide-white/10">{faqs.map(([question, answer], index) => <button key={question} type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="block w-full py-5 text-left"><div className="flex items-center justify-between gap-5"><span className="text-sm font-black md:text-base">{question}</span><ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", openFaq === index && "rotate-180")} /></div><AnimatePresence initial={false}>{openFaq === index ? <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{answer}</motion.p> : null}</AnimatePresence></button>)}</div></div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28"><div className="mx-auto max-w-[1200px] rounded-[42px] border border-border/40 bg-card/75 p-8 text-center dark:border-white/10 dark:bg-white/[0.03] md:p-12"><h2 className="mx-auto max-w-4xl text-4xl font-black leading-[0.88] tracking-[-0.065em] md:text-6xl">Gestão para decidir. NeuroFinance para movimentar.</h2><p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/70">Ative os recursos bancários conforme seu plano e a aprovação da conta.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background"><Link to="/create-account">Começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]"><Link to="/contato">Falar com a equipe</Link></Button></div><div className="mt-10 opacity-70"><AsaasRegulatoryFooter /></div></div></section>
      </main>

      <Footer />
    </div>
  );
};

export default FinanceLanding;
