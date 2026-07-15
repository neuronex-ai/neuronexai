"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  LockKeyhole,
  MessageCircle,
  MessageSquare,
  Mic,
  Network,
  ScanLine,
  Sparkles,
  WalletCards,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { PublicFlowComparison } from "@/components/landing/PublicFlowComparison";
import { LandingSectionStage } from "@/components/landing/LandingSectionStage";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const modes = [
  { key: "text", label: "Texto", icon: MessageSquare, image: "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp", title: "Converse com a sua prática.", text: "Pergunte, revise o que foi encontrado e deixe uma ação pronta para confirmar." },
  { key: "voice", label: "Voz", icon: Mic, image: "/landing/screenshots/desktop/dark/16-synapse-voz-dark.webp", title: "Fale sem sair do ritmo.", text: "Consulte o dia, encontre uma informação e abra a área certa sem interromper o atendimento." },
];

const questions = [
  ["O que o Synapse faz?", "Ele ajuda a encontrar o contexto que você autorizou, organiza o que importa e deixa o próximo passo pronto. Se uma ação envia, altera ou registra algo, ele pede a confirmação prevista para aquele caso."],
  ["Texto, voz e WhatsApp usam o mesmo Synapse?", "Sim. A conversa pode continuar entre painel, voz e WhatsApp sem perder o histórico autorizado. O NeuroZap faz a conexão e a supervisão do WhatsApp Business; ele não é outro assistente."],
  ["Ele pode executar tarefas?", "Ele pode reunir etapas, encontrar a ferramenta certa e preparar uma ação. Acesso, limites do plano e confirmações continuam valendo em cada parte do caminho."],
  ["O que é o NeuroBox?", "É o conjunto de ferramentas NeuroView, NeuroFlow, NeuroPulse e NeuroScan. O NeuroScan já ajuda a transcrever fichas de anamnese no prontuário."],
  ["Ele acessa qualquer informação?", "Não. O Synapse só trabalha com o contexto e as permissões disponíveis para aquela pessoa e situação."],
];

const channels = [
  {
    icon: MessageSquare,
    title: "Texto",
    eyebrow: "Para pensar e revisar",
    text: "Pergunte, revise a resposta e acompanhe cada ação preparada antes de confirmar.",
  },
  {
    icon: Mic,
    title: "Voz",
    eyebrow: "Para não perder o ritmo",
    text: "Consulte e navegue sem interromper a rotina, com as mesmas regras de segurança do texto.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    eyebrow: "A conversa continua",
    text: "O psicólogo fala com o Synapse por texto ou áudio. O histórico também fica disponível no painel da NeuroNex.",
  },
];

const neuroBoxTools = [
  {
    icon: Network,
    name: "NeuroView",
    text: "Ajuda a visualizar conexões e padrões do histórico disponível, mantendo a leitura clínica sob responsabilidade profissional.",
  },
  {
    icon: Workflow,
    name: "NeuroFlow",
    text: "Organiza processos e percursos em fluxos visuais que podem ser revisados antes de serem salvos.",
  },
  {
    icon: Activity,
    name: "NeuroPulse",
    text: "Estrutura relações de causa e efeito a partir do contexto selecionado, com confirmação para persistir resultados.",
  },
  {
    icon: ScanLine,
    name: "NeuroScan",
    text: "Auxilia a transcrever fichas de anamnese para o prontuário. Outras aplicações serão apresentadas somente depois de definidas.",
  },
];

const scrollToSection = (id: string) => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
};

const SynapseLanding = () => {
  const [mode, setMode] = useState(modes[0].key);
  const [open, setOpen] = useState(0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="hidden md:block"><Navbar /></div>
      <LandingMobileNav />
      <main>
        <LandingSectionStage index={0} effect="none">
        <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-48">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-foreground/[0.045] blur-[170px] dark:bg-white/[0.035]" />
          <div className="relative z-10 mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"><Sparkles className="h-3.5 w-3.5" />Synapse AI</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-8 text-[clamp(3.4rem,7.5vw,7.8rem)] font-black leading-[0.84] tracking-[-0.075em]">Você conversa. <span className="text-muted-foreground/35">O Synapse acompanha.</span></motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mx-auto mt-7 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">No painel, por voz ou pelo WhatsApp, o Synapse entende o contexto que você autorizou, encontra o que importa e deixa o próximo passo pronto para sua confirmação.</motion.p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background"><Link to="/create-account">Experimentar <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button variant="outline" className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]" onClick={() => scrollToSection("synapse-demo")}>Ver como funciona</Button></div>
            </div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mt-16 overflow-hidden rounded-[34px] border border-border/45 bg-card shadow-[0_36px_120px_-76px_rgba(0,0,0,0.8)] dark:border-white/10 dark:bg-[#08090b]"><img src="/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp" alt="Synapse AI no NeuroNex" width={1280} height={720} className="block aspect-video w-full object-cover" /></motion.div>
          </div>
        </section>
        </LandingSectionStage>

        <LandingSectionStage index={1} progressLinked effect="focus-in">
        <section id="synapse-demo" className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1380px]">
            <div className="max-w-5xl"><p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">Texto e voz</p><h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">Pergunte do seu jeito. <span className="opacity-35">O Synapse encontra o fio da rotina.</span></h2></div>
            <Tabs value={mode} onValueChange={setMode} orientation="vertical" className="mt-12 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
              <TabsList aria-label="Formas de conversar com o Synapse" className="grid h-auto content-start gap-2 rounded-[28px] border-background/10 bg-background/[0.07] p-3 text-background/60 shadow-none dark:border-zinc-950/10 dark:bg-zinc-950/[0.045] dark:text-zinc-950/60">
                {modes.map((item) => (
                  <TabsTrigger key={item.key} value={item.key} className="min-h-12 justify-start gap-3 rounded-[18px] px-4 py-4 text-left text-current data-[state=active]:border-transparent data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:bg-zinc-950 dark:data-[state=active]:text-white">
                    <item.icon aria-hidden="true" className="h-4 w-4" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">{item.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <div>
                {modes.map((item) => (
                  <TabsContent key={item.key} value={item.key} className="mt-0 rounded-[38px] border border-background/10 bg-background/[0.07] p-4 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                    <div className="overflow-hidden rounded-[28px] bg-black">
                      <motion.img src={item.image} alt={`Interface do Synapse por ${item.label.toLowerCase()}`} width={1280} height={720} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block aspect-video w-full object-cover" />
                    </div>
                    <div className="p-5"><h3 className="text-3xl font-black tracking-[-0.05em]">{item.title}</h3><p className="mt-3 text-sm font-medium opacity-62">{item.text}</p></div>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
        </section>
        </LandingSectionStage>

        <LandingSectionStage index={2} progressLinked effect="handoff">
        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Uma conversa, três canais</p>
              <h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">O que você falou antes <span className="text-muted-foreground/35">não precisa ficar para trás.</span></h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">O canal muda, mas a conversa e o histórico autorizado continuam. O NeuroZap conecta e supervisiona o WhatsApp Business; o Synapse continua sendo a inteligência que entende a sua rotina.</p>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {channels.map((channel) => (
                <article key={channel.title} className="rounded-[32px] border border-border/40 bg-card/75 p-7 dark:border-white/10 dark:bg-white/[0.03]">
                  <channel.icon aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-9 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{channel.eyebrow}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-[-0.05em]">{channel.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{channel.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        </LandingSectionStage>

        <LandingSectionStage index={3} progressLinked effect="zoom-out"><PublicFlowComparison variant="synapse" /></LandingSectionStage>

        <LandingSectionStage index={4} progressLinked effect="focus-in">
        <section className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1380px] gap-6 lg:grid-cols-[0.82fr_1.18fr]">
            <article className="rounded-[38px] border border-background/10 bg-background/[0.07] p-8 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045] md:p-10">
              <Bot aria-hidden="true" className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Quando você pede uma ação</p>
              <h2 className="mt-4 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-6xl">Ele não para na resposta. <span className="opacity-35">Deixa a próxima etapa pronta.</span></h2>
              <p className="mt-6 text-sm font-medium leading-relaxed opacity-65 md:text-base">O Synapse encontra o contexto, abre o caminho certo e prepara uma ação para você revisar. Permissões, limites do plano e confirmações continuam valendo em cada etapa.</p>
              <div className="mt-8 grid gap-2">
                {["Entende o que você precisa", "Encontra o contexto permitido", "Prepara ou abre a próxima ação", "Pede confirmação quando existe efeito real"].map((step, index) => (
                  <div key={step} className="flex items-center gap-4 rounded-2xl border border-background/10 bg-background/[0.06] px-4 py-3 dark:border-zinc-950/10 dark:bg-zinc-950/[0.04]">
                    <span className="font-mono text-xs opacity-40">0{index + 1}</span>
                    <span className="text-sm font-semibold">{step}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[38px] border border-background/10 bg-background/[0.07] p-8 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045] md:p-10">
              <BrainCircuit aria-hidden="true" className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">NeuroBox</p>
              <h2 className="mt-4 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-6xl">Ferramentas diferentes, <span className="opacity-35">o mesmo contexto.</span></h2>
              <div className="mt-8 grid gap-3">
                {neuroBoxTools.map((tool) => (
                  <div key={tool.name} className="rounded-[24px] border border-background/10 bg-background/[0.06] p-5 dark:border-zinc-950/10 dark:bg-zinc-950/[0.04]">
                    <div className="flex items-center gap-3"><tool.icon aria-hidden="true" className="h-5 w-5 opacity-55" /><h3 className="text-lg font-black">{tool.name}</h3></div>
                    <p className="mt-3 text-sm font-medium leading-relaxed opacity-62">{tool.text}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
        </LandingSectionStage>

        <LandingSectionStage index={5}>
          <section className="px-5 py-20 md:px-8 md:py-28">
            <div className="mx-auto max-w-[1380px]">
              <div className="mx-auto max-w-5xl text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">No dia a dia</p>
                <h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] md:text-7xl">
                  Menos procura. <span className="text-muted-foreground/35">Mais continuidade.</span>
                </h2>
                <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                  Quando a rotina não fica espalhada, sobra menos tempo procurando a informação certa e mais espaço para estar presente no atendimento.
                </p>
              </div>
              <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { icon: CalendarDays, title: "Agenda", text: "Veja o que mudou no dia sem conferir várias telas." },
                  { icon: ClipboardList, title: "Contexto", text: "Encontre o histórico permitido quando ele realmente faz falta." },
                  { icon: Sparkles, title: "Próximo passo", text: "Transforme uma pergunta em um caminho claro para revisar." },
                  { icon: WalletCards, title: "Financeiro", text: "Acompanhe o que pede atenção sem separar a rotina em planilhas." },
                ].map((item) => (
                  <article key={item.title} className="rounded-[28px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                    <item.icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
                    <h3 className="mt-8 text-xl font-black">{item.title}</h3>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/68">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </LandingSectionStage>

        <LandingSectionStage index={6}>
          <section className="px-5 pb-20 md:px-8 md:pb-28">
            <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-2">
              <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950">
                <LockKeyhole aria-hidden="true" className="h-7 w-7 opacity-55" />
                <h2 className="mt-9 text-4xl font-black leading-[0.9] tracking-[-0.06em]">Contexto só onde ele faz sentido.</h2>
                <p className="mt-5 text-sm font-medium leading-relaxed opacity-65">
                  O Synapse não é uma porta aberta para todos os dados. Ele trabalha dentro do acesso disponível, registra o caminho e respeita as confirmações necessárias.
                </p>
                <div className="mt-7 grid gap-2">
                  {[
                    "Acesso ligado à pessoa e ao seu papel",
                    "Informações dentro do que foi autorizado",
                    "Histórico das ações que precisaram ser registradas",
                    "Uso de IA com responsabilidade",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-sm font-semibold dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                      <Check aria-hidden="true" className="h-4 w-4" />
                      {item}
                    </div>
                  ))}
                </div>
              </article>
              <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Dúvidas frequentes</p>
                <div className="mt-4 divide-y divide-border/40 dark:divide-white/10">
                  {questions.map(([question, answer], index) => {
                    const isOpen = open === index;

                    return (
                      <div key={question}>
                        <button
                          id={`synapse-faq-trigger-${index}`}
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`synapse-faq-panel-${index}`}
                          onClick={() => setOpen(isOpen ? -1 : index)}
                          className="block min-h-12 w-full py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex items-center justify-between gap-4">
                            <span className="text-sm font-black">{question}</span>
                            <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen ? (
                            <motion.p
                              id={`synapse-faq-panel-${index}`}
                              role="region"
                              aria-labelledby={`synapse-faq-trigger-${index}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden pb-5 text-sm font-medium leading-relaxed text-muted-foreground/72"
                            >
                              {answer}
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>
          </section>
        </LandingSectionStage>

        <LandingSectionStage index={7}>
          <section className="px-5 pb-20 md:px-8 md:pb-28">
            <div className="mx-auto max-w-[1200px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
              <h2 className="mx-auto max-w-4xl text-4xl font-black leading-[0.88] tracking-[-0.065em] md:text-6xl">
                Sua prática já tem contexto. Agora ele pode trabalhar a seu favor.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-sm font-medium leading-relaxed opacity-65 md:text-base">
                Conheça um sistema para psicólogos que aproxima agenda, prontuário, comunicação, financeiro e as tarefas que hoje dependem de você lembrar de tudo.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                  <Link to="/create-account">Começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-transparent px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background dark:border-zinc-950/20 dark:text-zinc-950">
                  <Link to="/contato">Falar com a equipe</Link>
                </Button>
              </div>
            </div>
          </section>
        </LandingSectionStage>
      </main>
      <Footer />
    </div>
  );
};

export default SynapseLanding;
