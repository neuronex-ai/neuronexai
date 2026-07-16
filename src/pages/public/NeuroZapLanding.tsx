"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CalendarClock,
  Check,
  ClipboardCheck,
  CreditCard,
  LockKeyhole,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards,
} from "lucide-react";
import type { ElementType } from "react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";

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

const synapseImage = "/landing/screenshots/desktop/dark/15-synapse-chat-dark.webp";

const capabilities: Capability[] = [
  {
    icon: ReceiptText,
    title: "Reguas de cobranca com contexto",
    text: "Sessao realizada, valor, vencimento, paciente e historico financeiro entram no rascunho antes de qualquer envio.",
  },
  {
    icon: CalendarClock,
    title: "No-show com resposta operacional",
    text: "Faltas, atrasos e reagendamentos podem gerar lembretes, follow-ups e proximos passos sem depender de memoria manual.",
  },
  {
    icon: BrainCircuit,
    title: "Synapse prepara, o profissional aprova",
    text: "O agente sugere mensagem, tom, contexto e acao associada. O psicologo mantem controle e responsabilidade.",
  },
  {
    icon: WalletCards,
    title: "NeuroFinance no mesmo fluxo",
    text: "Cobrancas, Pix, boletos, recibos e conciliacao ficam proximos das mensagens operacionais.",
  },
  {
    icon: LockKeyhole,
    title: "Travas por plano e permissao",
    text: "Automacoes avancadas, volume, canais e acoes sensiveis podem exigir plano elegivel, configuracao ativa e confirmacao.",
  },
  {
    icon: ShieldCheck,
    title: "Historico e auditoria",
    text: "Cada rascunho, aprovacao, envio e bloqueio precisa deixar rastro compreensivel para a operacao da clinica.",
  },
];

const flow: FlowStep[] = [
  {
    title: "NeuroNex entende o evento",
    text: "Agenda, paciente, financeiro e status da sessao indicam o que precisa de acao.",
  },
  {
    title: "Synapse monta o rascunho",
    text: "O agente cria mensagem, contexto, valor, prazo ou proposta de reagendamento.",
  },
  {
    title: "Psicologo aprova",
    text: "A mensagem e revisada antes do envio, com travas para situacoes sensiveis.",
  },
  {
    title: "WhatsApp Business envia",
    text: "A conversa acontece pelo canal do consultorio, preservando o fluxo operacional.",
  },
  {
    title: "Retorno vira proximo passo",
    text: "Pagamento, reagendamento, resposta ou silencio alimentam a proxima decisao da clinica.",
  },
];

const conversation = [
  {
    from: "Synapse AI",
    text: "Sessao de hoje esta pendente. Posso preparar uma cobranca cordial com Pix e prazo para aprovacao?",
  },
  {
    from: "Psicologo",
    text: "Prepare a mensagem, mas mantenha tom acolhedor e sem expor dado clinico.",
  },
  {
    from: "NeuroZap",
    text: "Rascunho pronto. Valor, vencimento e link financeiro conferidos. Aguardando sua aprovacao.",
  },
];

const safetyStates = [
  { title: "Rascunho", text: "Mensagem criada sem envio automatico." },
  { title: "Aprovacao", text: "Revisao humana antes de tocar o paciente." },
  { title: "Bloqueio", text: "Plano, canal, permissao ou dado sensivel podem interromper o fluxo." },
  { title: "Auditoria", text: "Historico de acao para rastrear o que foi preparado, aprovado e enviado." },
];

const BrowserFrame = ({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
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
      loading="lazy"
      decoding="async"
      className="block aspect-video w-full object-cover"
    />
  </div>
);

const ConversationMock = () => (
  <div className="rounded-[38px] border border-border/45 bg-card/78 p-5 shadow-[0_38px_120px_-78px_rgba(0,0,0,0.78)] dark:border-white/10 dark:bg-white/[0.03]">
    <div className="rounded-[30px] bg-foreground p-6 text-background dark:bg-white dark:text-zinc-950">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/whatsapp-business-logo.png" alt="WhatsApp Business" width={38} height={38} className="h-10 w-10 rounded-xl object-contain" loading="eager" decoding="async" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] opacity-45">WhatsApp Business</p>
            <p className="text-base font-black">NeuroZap + Synapse AI</p>
          </div>
        </div>
        <span className="rounded-full border border-background/10 bg-background/[0.08] px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] opacity-70 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">Aprovacao humana</span>
      </div>

      <div className="mt-8 grid gap-3">
        {conversation.map((message, index) => (
          <article key={message.from} className="rounded-2xl border border-background/10 bg-background/[0.07] p-4 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-45">{message.from}</p>
            <p className="mt-2 text-sm font-medium leading-relaxed opacity-72">{message.text}</p>
            {index === conversation.length - 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {["Aprovar", "Editar", "Bloquear"].map((label) => (
                  <span key={label} className="rounded-full border border-background/10 bg-background/[0.08] px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] opacity-70 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  </div>
);

const NeuroZapLanding = () => {
  const shouldReduceMotion = useReducedMotion();

  const scrollToFlow = () => {
    document.getElementById("neurozap-flow")?.scrollIntoView({
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
        <section className="relative overflow-hidden px-5 pb-20 pt-32 md:px-8 md:pb-28 md:pt-44">
          <div className="relative z-10 mx-auto grid max-w-[1320px] gap-12 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-foreground/[0.035] px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                NeuroZap Desktop Beta
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-8 max-w-5xl text-5xl font-black leading-none text-foreground sm:text-6xl md:text-7xl lg:text-8xl"
              >
                WhatsApp Business com contexto, cobranca e aprovacao humana.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mt-7 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl"
              >
                NeuroZap conecta WhatsApp Business, NeuroNex, Synapse AI e NeuroFinance para reduzir inadimplencia, no-show e follow-up manual sem automatizar conversas sensiveis no escuro.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row"
              >
                <Button asChild className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background">
                  <Link to="/create-account">
                    Comecar gratis <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.2em]"
                  onClick={scrollToFlow}
                >
                  Ver fluxo
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
            >
              <ConversationMock />
            </motion.div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1320px]">
            <div className="mx-auto max-w-5xl text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">Automacao com responsabilidade</p>
              <h2 className="mt-6 text-4xl font-black leading-none md:text-6xl lg:text-7xl">Cobranca, lembrete e no-show no mesmo raciocinio da clinica.</h2>
              <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">
                O NeuroZap nasce para resolver uma dor objetiva: comunicar o que precisa ser comunicado sem perder tom, contexto, permissao e supervisao.
              </p>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.title} className="rounded-[28px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground/68">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="neurozap-flow" className="bg-foreground px-5 py-20 text-background dark:bg-white dark:text-zinc-950 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="max-w-4xl">
              <BadgeCheck className="h-7 w-7 opacity-55" />
              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Fluxo NeuroZap</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl">Do evento clinico-financeiro ate a conversa aprovada.</h2>
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

        <section className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <BrowserFrame src={synapseImage} alt="Synapse AI em conversa operacional" label="Synapse AI" />
            <article className="rounded-[38px] border border-border/40 bg-card/75 p-8 dark:border-white/10 dark:bg-white/[0.03] md:p-10">
              <MessageCircle className="h-7 w-7 text-muted-foreground" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">WhatsApp Business + NeuroNex</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">O canal conversa com a operacao, nao apenas com uma lista de contatos.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed text-muted-foreground/70 md:text-base">
                O diferencial esta no contexto: agenda, paciente, financeiro e historico operacional ajudam o Synapse a preparar a mensagem certa para revisao.
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {["Cobranca cordial", "Reagendamento", "Lembretes", "Follow-up supervisionado"].map((item) => (
                  <div key={item} className="rounded-2xl border border-border/40 bg-foreground/[0.03] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/70 dark:border-white/10 dark:bg-white/[0.035]">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto grid max-w-[1280px] gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[38px] bg-foreground p-8 text-background dark:bg-white dark:text-zinc-950 md:p-10">
              <UserCheck className="h-7 w-7 opacity-55" />
              <p className="mt-10 text-[9px] font-black uppercase tracking-[0.22em] opacity-45">Seguranca e tom</p>
              <h2 className="mt-4 text-4xl font-black leading-none md:text-5xl">Automacao sensivel precisa parecer assistida, nao escondida.</h2>
              <p className="mt-5 text-sm font-medium leading-relaxed opacity-62 md:text-base">
                Mensagens passam por rascunho, aprovacao, bloqueio quando necessario e historico. O objetivo e reduzir atrito sem apagar o julgamento humano.
              </p>
            </article>
            <div className="grid gap-3 sm:grid-cols-2">
              {safetyStates.map((item) => (
                <article key={item.title} className="rounded-[30px] border border-border/40 bg-card/72 p-6 dark:border-white/10 dark:bg-white/[0.03]">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-8 text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground/70">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 md:px-8 md:pb-28">
          <div className="mx-auto max-w-[1180px] rounded-[42px] bg-foreground p-8 text-center text-background dark:bg-white dark:text-zinc-950 md:p-12">
            <CreditCard className="mx-auto h-7 w-7 opacity-55" />
            <h2 className="mx-auto mt-8 max-w-4xl text-4xl font-black leading-none md:text-6xl">O jeito menos desgastante de cobrar, lembrar e recuperar presenca.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed opacity-64">
              WhatsApp Business, Synapse AI, NeuroFinance e NeuroNex trabalham juntos para transformar comunicacao operacional em fluxo seguro.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-14 rounded-2xl bg-background px-7 text-[10px] font-black uppercase tracking-[0.2em] text-foreground dark:bg-zinc-950 dark:text-white">
                <Link to="/create-account">
                  Comecar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-14 rounded-2xl border-background/20 bg-background/5 px-7 text-[10px] font-black uppercase tracking-[0.2em] text-background hover:bg-background/10 dark:border-zinc-950/20 dark:text-zinc-950">
                <Link to="/neurofinance">Ver NeuroFinance</Link>
              </Button>
            </div>
            <div className="mx-auto mt-8 grid max-w-3xl gap-2 sm:grid-cols-3">
              {["WhatsApp Business", "Synapse AI", "NeuroFinance"].map((item) => (
                <div key={item} className="flex items-center justify-center gap-2 rounded-2xl border border-background/10 bg-background/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] opacity-72 dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]">
                  <Check className="h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NeuroZapLanding;
