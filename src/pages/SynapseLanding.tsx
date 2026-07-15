"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Check, ChevronDown, ClipboardList, LockKeyhole, MessageSquare, Mic, Sparkles, WalletCards } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modes = [
  { key: "text", label: "Texto", icon: MessageSquare, image: "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp", title: "Converse com a rotina.", text: "Localize informações e organize o trabalho em uma interface de conversa." },
  { key: "voice", label: "Voz", icon: Mic, image: "/landing/screenshots/desktop/dark/16-synapse-voz-dark.webp", title: "Use a voz.", text: "Consulte o dia e abra contextos sem interromper o fluxo." },
];

const questions = [
  ["O que o Synapse faz?", "Ele ajuda a consultar agenda, informações operacionais e recursos disponíveis no NeuroNex."],
  ["Texto e voz funcionam juntos?", "Os dois canais foram desenhados para reduzir navegação e facilitar consultas rápidas."],
  ["Ele acessa qualquer informação?", "Não. O acesso respeita as permissões e o contexto disponível ao usuário."],
];

const SynapseLanding = () => {
  const [mode, setMode] = useState(modes[0]);
  const [open, setOpen] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block"><Navbar /></div>
      <LandingMobileNav />
      <main>
        <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-48">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-foreground/[0.045] blur-[170px] dark:bg-white/[0.035]" />
          <div className="relative z-10 mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <motion.div initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"><Sparkles className="h-3.5 w-3.5" />Synapse AI</motion.div>
              <motion.h1 initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-8 text-[clamp(3.4rem,7.5vw,7.8rem)] font-black leading-[0.84] tracking-[-0.075em]">A inteligência operacional <span className="text-muted-foreground/35">da sua rotina.</span></motion.h1>
              <motion.p initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">Use texto ou voz para localizar informações, revisar o dia e reduzir tarefas repetitivas.</motion.p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background"><Link to="/create-account">Experimentar <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]" onClick={() => document.getElementById("synapse-demo")?.scrollIntoView({ behavior: shouldReduceMotion ? "auto" : "smooth" })}>Ver como funciona</Button></div>
            </div>
            <motion.div initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mt-16 overflow-hidden rounded-[34px] border border-border/45 bg-card shadow-[0_36px_120px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]"><img src="/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp" alt="Synapse AI no NeuroNex" width={1280} height={720} className="block aspect-video w-full object-cover" /></motion.div>
          </div>
        </section>

        <section id="synapse-demo" className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1380px]">
            <div className="max-w-5xl"><p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">Texto e voz</p><h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">Pergunte. <span className="opacity-35">O Synapse organiza a resposta.</span></h2></div>
            <div className="mt-12 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
              <div className="grid content-start gap-2 rounded-[28px] border border-background/10 bg-background/[0.07] p-3 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">{modes.map((item) => <button key={item.key} type="button" onClick={() => setMode(item)} className={cn("flex items-center gap-3 rounded-[18px] px-4 py-4 text-left", mode.key === item.key ? "bg-background text-foreground dark:bg-zinc-950 dark:text-white" : "opacity-55")}><item.icon className="h-4 w-4" /><span className="text-[9px] font-black uppercase tracking-[0.16em]">{item.label}</span></button>)}</div>
              <div className="rounded-[38px] border border-background/10 bg-background/[0.07] p-4 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]"><div className="overflow-hidden rounded-[28px] bg-black"><AnimatePresence mode="wait"><motion.img key={mode.key} src={mode.image} alt={`Synapse por ${mode.label}`} width={1280} height={720} initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={shouldReduceMotion ? undefined : { opacity: 0 }} className="block aspect-video w-full object-cover" /></AnimatePresence></div><div className="p-5"><h3 className="text-3xl font-black tracking-[-0.05em]">{mode.title}</h3><p className="mt-3 text-sm font-medium opacity-62">{mode.text}</p></div></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28"><div className="mx-auto max-w-[1380px]"><div className="mx-auto max-w-5xl text-center"><p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">No dia a dia</p><h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">Menos navegação. <span className="text-muted-foreground/35">Mais continuidade.</span></h2></div><div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          { icon: CalendarDays, title: "Agenda", text: "Consulte compromissos e mudanças do dia." },
          { icon: ClipboardList, title: "Contexto", text: "Encontre informações permitidas rapidamente." },
          { icon: Sparkles, title: "Organização", text: "Transforme perguntas em próximos passos." },
          { icon: WalletCards, title: "Financeiro", text: "Consulte indicadores conforme permissões." },
        ].map((item) => <article key={item.title} className="rounded-[28px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]"><item.icon className="h-5 w-5 text-muted-foreground" /><h3 className="mt-8 text-xl font-black">{item.title}</h3><p className="mt-3 text-sm font-medium text-muted-foreground/68">{item.text}</p></article>)}</div></div></section>

        <section className="px-5 pb-20 md:px-8 md:pb-28"><div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-2"><article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950"><LockKeyhole className="h-7 w-7 opacity-55" /><h2 className="mt-9 text-4xl font-black leading-[0.9] tracking-[-0.06em]">Contexto dentro das permissões.</h2><div className="mt-7 grid gap-2">{["Acesso condicionado ao usuário", "Informações dentro do escopo disponível", "Controle e rastreabilidade", "Uso responsável da inteligência"].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-sm font-semibold dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]"><Check className="h-4 w-4" />{item}</div>)}</div></article><article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Dúvidas frequentes</p><div className="mt-4 divide-y divide-border/40 dark:divide-white/10">{questions.map(([question, answer], index) => <button key={question} id={`synapse-faq-trigger-${index}`} type="button" aria-expanded={open === index} aria-controls={`synapse-faq-panel-${index}`} onClick={() => setOpen(open === index ? -1 : index)} className="block w-full py-5 text-left"><div className="flex items-center justify-between gap-4"><span className="text-sm font-black">{question}</span><ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", open === index && "rotate-180")} /></div><AnimatePresence initial={false}>{open === index ? <motion.p id={`synapse-faq-panel-${index}`} role="region" aria-labelledby={`synapse-faq-trigger-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: shouldReduceMotion ? 0 : 0.2 }} className="overflow-hidden pt-4 text-sm font-medium leading-relaxed text-muted-foreground/72">{answer}</motion.p> : null}</AnimatePresence></button>)}</div></article></div></section>

        <section className="px-5 pb-20 md:px-8 md:pb-28"><div className="mx-auto max-w-[1200px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12"><h2 className="mx-auto max-w-4xl text-4xl font-black leading-[0.88] tracking-[-0.065em] md:text-6xl">Sua rotina já tem contexto. Agora ela pode responder.</h2><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white"><Link to="/create-account">Começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-transparent px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background dark:border-zinc-950/20 dark:text-zinc-950"><Link to="/contato">Falar com a equipe</Link></Button></div></div></section>
      </main>
      <Footer />
    </div>
  );
};

export default SynapseLanding;
