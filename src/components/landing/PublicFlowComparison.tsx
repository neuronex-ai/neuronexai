import { useId, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  BellRing,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  FileText,
  Mail,
  MessageCircle,
  Monitor,
  Network,
  UserRound,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ComparisonMode = "without" | "with";
type ComparisonVariant = "ecosystem" | "synapse";

type FlowItem = {
  id: string;
  icon: typeof CalendarDays;
  label: string;
  detail: string;
};

type FlowScenario = {
  id: string;
  label: string;
  without: string[];
  with: string[];
  active: string[];
};

type ComparisonContent = {
  eyebrow: string;
  title: string;
  description: string;
  withoutTitle: string;
  withoutText: string;
  withTitle: string;
  withText: string;
  inputs: FlowItem[];
  outputs: FlowItem[];
  scenarios: FlowScenario[];
};

const ecosystemContent: ComparisonContent = {
  eyebrow: "O que muda na prática",
  title: "Hoje, você ainda precisa conectar tudo sozinho.",
  description:
    "Agenda, mensagens, prontuário, cobranças e documentos vivem separados. No fim, é você quem precisa lembrar, conferir e atualizar cada parte.",
  withoutTitle: "As informações estão guardadas. O trabalho ainda fica com você.",
  withoutText:
    "Ferramentas diferentes registram pedaços da rotina, mas não entendem o que aconteceu antes nem o que precisa acontecer depois.",
  withTitle: "Com a NeuroNex, tudo passa a trabalhar junto.",
  withText:
    "O Synapse reúne o contexto que você autorizou, prepara o próximo passo e coordena a rotina. Você continua decidindo o que precisa da sua confirmação.",
  inputs: [
    { id: "agenda", icon: CalendarDays, label: "Agenda", detail: "horários, sessões e mudanças" },
    { id: "whatsapp", icon: MessageCircle, label: "WhatsApp", detail: "pedidos, mensagens e áudios" },
    { id: "portal", icon: UserRound, label: "Portal do Paciente", detail: "informações entre sessões" },
    { id: "teleconsulta", icon: Video, label: "Teleconsulta", detail: "atendimento e continuidade" },
    { id: "prontuario", icon: ClipboardList, label: "Prontuário", detail: "histórico e registros clínicos" },
  ],
  outputs: [
    { id: "comunicacao", icon: Mail, label: "Comunicação", detail: "confirmações e lembretes" },
    { id: "financeiro", icon: CircleDollarSign, label: "NeuroFinance", detail: "cobrança, pagamento e saldo" },
    { id: "fiscal", icon: FileCheck2, label: "Fiscal", detail: "dados e emissão de NFS-e" },
    { id: "documentos", icon: FileText, label: "Documentos", detail: "arquivos e anexos no contexto certo" },
    { id: "notificacoes", icon: BellRing, label: "Próximos passos", detail: "o que pede sua atenção" },
  ],
  scenarios: [
    {
      id: "appointment",
      label: "Novo agendamento",
      active: ["whatsapp", "agenda", "comunicacao", "financeiro", "fiscal", "notificacoes"],
      without: [
        "Você recebe o pedido e abre a agenda.",
        "Cria a sessão e volta para enviar a confirmação.",
        "Prepara a cobrança e, depois, precisa conferir pagamento e fiscal.",
      ],
      with: [
        "Você pede o agendamento ao Synapse.",
        "Ele verifica as informações e mostra um resumo do que vai acontecer.",
        "Depois da sua confirmação, agenda, comunicação e os próximos fluxos ficam alinhados.",
      ],
    },
    {
      id: "reschedule",
      label: "Reagendamento",
      active: ["whatsapp", "agenda", "comunicacao", "notificacoes"],
      without: [
        "A mensagem chega em um canal e a agenda está em outro.",
        "Você procura a sessão, troca o horário e avisa novamente.",
        "Qualquer lembrete ou pendência precisa ser revisado por você.",
      ],
      with: [
        "O Synapse localiza a sessão certa a partir da conversa.",
        "Ele apresenta as opções disponíveis e espera sua confirmação.",
        "A mudança atualiza os pontos relacionados e deixa o histórico organizado.",
      ],
    },
    {
      id: "teleconsultation",
      label: "Teleconsulta",
      active: ["agenda", "teleconsulta", "prontuario", "documentos", "notificacoes"],
      without: [
        "Você confere o horário, abre a sala e procura o histórico em outra tela.",
        "Depois do atendimento, registra o que precisa e volta para atualizar a rotina.",
        "O contexto fica repartido entre chamada, notas e próximos passos.",
      ],
      with: [
        "A sessão já nasce ligada à agenda e ao contexto disponível do paciente.",
        "O Synapse ajuda a encontrar o que importa durante o fluxo, sem tomar decisão clínica.",
        "Ao terminar, os registros e pendências continuam no mesmo ambiente.",
      ],
    },
    {
      id: "billing",
      label: "Cobrança",
      active: ["financeiro", "comunicacao", "notificacoes", "fiscal"],
      without: [
        "Você cria a cobrança, envia a mensagem e acompanha o pagamento em etapas separadas.",
        "Depois precisa lembrar se existe nota, recibo ou uma pendência para resolver.",
        "O dinheiro até pode estar registrado, mas o próximo passo continua escondido.",
      ],
      with: [
        "O Synapse prepara a cobrança com o contexto da sessão e do paciente.",
        "Você revisa antes de qualquer ação externa.",
        "Pagamento, comunicação e fiscal passam a aparecer como partes do mesmo percurso.",
      ],
    },
    {
      id: "patient-message",
      label: "Mensagem de paciente",
      active: ["whatsapp", "portal", "prontuario", "agenda", "notificacoes"],
      without: [
        "Uma informação importante chega por mensagem, fora do prontuário.",
        "Você tenta lembrar o contexto, procura dados e decide onde registrar.",
        "A continuidade depende da sua memória e do tempo disponível.",
      ],
      with: [
        "O Synapse relaciona a conversa ao contexto que você autorizou.",
        "Ele aponta o que merece atenção e prepara o caminho para a área certa.",
        "Você preserva o controle da leitura clínica e da decisão.",
      ],
    },
  ],
};

const synapseContent: ComparisonContent = {
  eyebrow: "A mesma conversa, em mais de um lugar",
  title: "Você não precisa recomeçar o contexto a cada canal.",
  description:
    "Uma conversa por voz, no painel ou no WhatsApp pode continuar de onde parou — sempre dentro do que você autorizou o Synapse a acessar.",
  withoutTitle: "Cada conversa começa quase do zero.",
  withoutText:
    "Você repete informações, procura o histórico e reconstrói o que estava acontecendo antes de pedir uma ajuda de verdade.",
  withTitle: "O Synapse acompanha a sua rotina.",
  withText:
    "O canal muda, mas a conversa, o histórico autorizado e as regras continuam. Ações que alteram, enviam ou registram algo esperam a sua confirmação.",
  inputs: [
    { id: "whatsapp", icon: MessageCircle, label: "WhatsApp", detail: "áudio, texto e pedidos do dia" },
    { id: "voice", icon: Bot, label: "Voz", detail: "uma pergunta durante a rotina" },
    { id: "panel", icon: Monitor, label: "Painel", detail: "conversa e ações no sistema" },
    { id: "agenda", icon: CalendarDays, label: "Agenda", detail: "o que está acontecendo hoje" },
    { id: "prontuario", icon: ClipboardList, label: "Prontuário", detail: "histórico que você autorizou" },
  ],
  outputs: [
    { id: "comunicacao", icon: Mail, label: "Resposta preparada", detail: "o que dizer e onde continuar" },
    { id: "notificacoes", icon: BellRing, label: "Pendências visíveis", detail: "o que pede atenção agora" },
    { id: "agenda", icon: CalendarDays, label: "Próximo horário", detail: "a sessão certa, no momento certo" },
    { id: "documentos", icon: FileText, label: "Contexto organizado", detail: "referências reunidas para você" },
    { id: "panel", icon: Monitor, label: "Histórico contínuo", detail: "a conversa volta para o painel" },
  ],
  scenarios: [
    {
      id: "appointment",
      label: "Novo agendamento",
      active: ["whatsapp", "panel", "agenda", "comunicacao", "notificacoes"],
      without: ["O pedido chega no WhatsApp.", "Você abre outras telas para entender o dia e responder.", "A conversa e a ação ficam separadas."],
      with: ["Você pede ou continua a conversa em qualquer canal.", "O Synapse consulta o contexto permitido e prepara o próximo passo.", "A confirmação acontece antes de uma ação com efeito real."],
    },
    {
      id: "reschedule",
      label: "Reagendamento",
      active: ["whatsapp", "agenda", "panel", "notificacoes"],
      without: ["A conversa não sabe qual sessão você está procurando.", "Você procura o nome, o horário e o histórico manualmente.", "Depois ainda precisa voltar para responder."],
      with: ["O Synapse localiza o contexto da sessão.", "Ele apresenta opções e mantém a conversa no mesmo histórico.", "Você valida a alteração antes de ela acontecer."],
    },
    {
      id: "teleconsultation",
      label: "Teleconsulta",
      active: ["voice", "panel", "agenda", "prontuario", "documentos"],
      without: ["Durante a sessão, o contexto está espalhado por abas.", "Você pausa para procurar o que precisa.", "Depois decide onde cada informação deve ficar."],
      with: ["Você pergunta por voz ou texto sem abandonar a tela.", "O Synapse mostra apenas o contexto permitido para aquela situação.", "As referências ficam prontas para sua leitura e decisão."],
    },
    {
      id: "billing",
      label: "Cobrança",
      active: ["panel", "whatsapp", "comunicacao", "notificacoes"],
      without: ["A conversa sobre pagamento fica separada do restante da rotina.", "Você procura dados, prepara a ação e volta para responder.", "O acompanhamento depende de uma nova conferência."],
      with: ["O Synapse reúne o contexto que você autorizou.", "Ele prepara a ação e explica o que vai acontecer.", "Você confirma antes de qualquer envio ou alteração."],
    },
    {
      id: "patient-message",
      label: "Mensagem de paciente",
      active: ["whatsapp", "prontuario", "panel", "documentos", "notificacoes"],
      without: ["Você recebe uma mensagem e tenta lembrar o contexto da pessoa.", "O histórico não acompanha automaticamente a conversa.", "O que importa pode ficar perdido em outro canal."],
      with: ["A mensagem pode continuar uma conversa já iniciada no painel.", "O Synapse relaciona as informações dentro das permissões.", "Ele mostra o próximo passo sem substituir a sua decisão clínica."],
    },
  ],
};

const contentByVariant: Record<ComparisonVariant, ComparisonContent> = {
  ecosystem: ecosystemContent,
  synapse: synapseContent,
};

const motionTransition = { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const };

function FlowCard({ item, connected, active, side }: { item: FlowItem; connected: boolean; active: boolean; side: "input" | "output" }) {
  const Icon = item.icon;

  return (
    <motion.article
      layout
      transition={motionTransition}
      className={cn(
        "relative z-10 min-h-[96px] rounded-[22px] border p-4 text-left transition-colors duration-500 motion-reduce:transition-none",
        connected
          ? "border-white/12 bg-white/[0.055] text-white shadow-[0_18px_42px_-34px_rgba(0,0,0,0.95)]"
          : "border-white/10 bg-white/[0.03] text-white/90",
        active
          ? connected
            ? "ring-1 ring-white/45"
            : "border-white/25 bg-white/[0.075]"
          : "opacity-54",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border",
            connected && active ? "border-white/20 bg-white text-zinc-950" : "border-white/10 bg-white/[0.08] text-white/72",
          )}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black tracking-[-0.025em]">{item.label}</h4>
          <p className="mt-1 text-xs font-medium leading-relaxed text-white/54">{item.detail}</p>
        </div>
      </div>
      <span className="mt-3 block text-[8px] font-black uppercase tracking-[0.16em] text-white/38">
        {connected ? side === "input" ? "alimenta o contexto" : "recebe o próximo passo" : "ferramenta isolada"}
      </span>
    </motion.article>
  );
}

function ConnectionLayer({ connected, reduceMotion }: { connected: boolean; reduceMotion: boolean | null }) {
  const paths = connected
    ? ["M42 55 C380 55 420 166 570 210", "M42 125 C360 125 425 185 570 210", "M42 210 C360 210 425 210 570 210", "M42 295 C360 295 425 235 570 210", "M42 365 C380 365 420 255 570 210", "M630 210 C790 210 835 55 1160 55", "M630 210 C790 210 835 125 1160 125", "M630 210 C790 210 835 210 1160 210", "M630 210 C790 210 835 295 1160 295", "M630 210 C790 210 835 365 1160 365"]
    : ["M42 55 C300 55 430 135 570 210", "M42 125 C290 125 420 160 570 210", "M42 210 C300 210 430 210 570 210", "M42 295 C300 295 420 260 570 210", "M42 365 C300 365 430 285 570 210", "M630 210 C790 210 875 55 1160 55", "M630 210 C790 210 875 125 1160 125", "M630 210 C790 210 875 210 1160 210", "M630 210 C790 210 875 295 1160 295", "M630 210 C790 210 875 365 1160 365"];

  return (
    <svg aria-hidden="true" viewBox="0 0 1200 420" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
      <defs>
        <linearGradient id={connected ? "neuronex-connected-flow" : "neuronex-manual-flow"} x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity={connected ? "0.16" : "0.08"} />
          <stop offset="0.5" stopColor="currentColor" stopOpacity={connected ? "0.62" : "0.38"} />
          <stop offset="1" stopColor="currentColor" stopOpacity={connected ? "0.16" : "0.08"} />
        </linearGradient>
      </defs>
      {paths.map((d, index) => (
        <motion.path
          key={`${connected}-${index}`}
          d={d}
          fill="none"
          stroke={`url(#${connected ? "neuronex-connected-flow" : "neuronex-manual-flow"})`}
          strokeWidth={connected ? 1.6 : 1}
          strokeDasharray={connected ? "0" : "5 9"}
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : index * 0.035, ease: "easeOut" }}
        />
      ))}
    </svg>
  );
}

function ScenarioSteps({ scenario, mode }: { scenario: FlowScenario; mode: ComparisonMode }) {
  const steps = mode === "with" ? scenario.with : scenario.without;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${scenario.id}-${mode}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={motionTransition}
        className="grid gap-2"
      >
        {steps.map((step, index) => (
          <div key={step} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[9px] font-black text-white/58">{index + 1}</span>
            <p className="text-sm font-medium leading-relaxed text-white/72">{step}</p>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

function MobileFlow({ content, mode, scenario }: { content: ComparisonContent; mode: ComparisonMode; scenario: FlowScenario }) {
  const connected = mode === "with";
  const visibleInputs = content.inputs.filter((item) => scenario.active.includes(item.id)).slice(0, 3);
  const visibleOutputs = content.outputs.filter((item) => scenario.active.includes(item.id)).slice(0, 3);

  return (
    <div className="space-y-3 lg:hidden">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">De onde vem a informação</p>
      <div className="grid gap-2 sm:grid-cols-2">{visibleInputs.map((item) => <FlowCard key={`${item.id}-mobile-input`} item={item} connected={connected} active side="input" />)}</div>
      <div className="flex flex-col items-center gap-2 py-1 text-white/46"><ArrowDown aria-hidden="true" className="h-5 w-5" /><span className="text-[8px] font-black uppercase tracking-[0.16em]">{connected ? "o Synapse relaciona o contexto" : "você precisa ligar os pontos"}</span><ArrowDown aria-hidden="true" className="h-5 w-5" /></div>
      <div className={cn("rounded-[28px] border p-6 text-center", connected ? "border-white/22 bg-white/[0.09]" : "border-white/12 bg-white/[0.045]") }>
        {connected ? <BrainCircuit aria-hidden="true" className="mx-auto h-7 w-7 text-white" /> : <UserRound aria-hidden="true" className="mx-auto h-7 w-7 text-white/72" />}
        <h4 className="mt-4 text-xl font-black tracking-[-0.04em]">{connected ? "Synapse" : "Você"}</h4>
        <p className="mt-2 text-sm font-medium leading-relaxed text-white/56">{connected ? "entende o contexto e prepara a próxima ação" : "confere, procura, copia e decide o próximo passo"}</p>
      </div>
      <div className="flex flex-col items-center gap-2 py-1 text-white/46"><ArrowDown aria-hidden="true" className="h-5 w-5" /></div>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">O que precisa acontecer depois</p>
      <div className="grid gap-2 sm:grid-cols-2">{visibleOutputs.map((item) => <FlowCard key={`${item.id}-mobile-output`} item={item} connected={connected} active side="output" />)}</div>
    </div>
  );
}

export const PublicFlowComparison = ({ variant = "ecosystem" }: { variant?: ComparisonVariant }) => {
  const [mode, setMode] = useState<ComparisonMode>("without");
  const [scenarioId, setScenarioId] = useState("appointment");
  const reduceMotion = useReducedMotion();
  const sectionId = useId();
  const content = contentByVariant[variant];
  const scenario = content.scenarios.find((item) => item.id === scenarioId) ?? content.scenarios[0];
  const connected = mode === "with";

  return (
    <MotionConfig reducedMotion="user">
      <section id={variant === "ecosystem" ? "diferenciais" : "synapse-continuity"} aria-labelledby={`${sectionId}-title`} className="relative overflow-hidden bg-background px-5 py-20 md:px-8 md:py-32">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[960px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-[170px]" />
        <div className="relative z-10 mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{content.eyebrow}</p>
            <h2 id={`${sectionId}-title`} className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.065em] text-foreground md:text-7xl">{content.title}</h2>
            <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-xl">{content.description}</p>
          </div>

          <div className="mx-auto mt-10 max-w-[620px]">
            <div role="tablist" aria-label="Comparar a rotina com e sem a NeuroNex" className="grid grid-cols-2 rounded-[20px] border border-border/45 bg-card/75 p-1.5 dark:border-white/10 dark:bg-white/[0.035]">
              {(["without", "with"] as const).map((item) => {
                const selected = mode === item;
                return (
                  <button
                    key={item}
                    id={`${sectionId}-${item}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${sectionId}-panel`}
                    onClick={() => setMode(item)}
                    className={cn("min-h-12 rounded-[14px] px-4 text-[10px] font-black uppercase tracking-[0.16em] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  >
                    {item === "without" ? "Sem a NeuroNex" : "Com a NeuroNex"}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Escolha uma situação comum da rotina">
              {content.scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={scenarioId === item.id}
                  onClick={() => setScenarioId(item.id)}
                  className={cn("min-h-10 rounded-full border px-3.5 text-[9px] font-black uppercase tracking-[0.13em] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", scenarioId === item.id ? "border-foreground bg-foreground text-background" : "border-border/45 bg-card/55 text-muted-foreground hover:border-foreground/35 hover:text-foreground dark:border-white/10 dark:bg-white/[0.025]")}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <motion.article id={`${sectionId}-panel`} role="tabpanel" aria-labelledby={`${sectionId}-${mode}-tab`} layout layoutDependency={`${mode}-${scenario.id}`} className="relative mt-8 overflow-hidden rounded-[38px] border border-white/10 bg-[#09090b] p-5 text-white shadow-[0_42px_150px_-88px_rgba(0,0,0,0.96)] md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_47%,rgba(255,255,255,0.09),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.045),transparent_35%,rgba(255,255,255,0.015))]" />
            <div className="relative z-10 flex flex-col justify-between gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={mode} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={motionTransition} className="max-w-3xl">
                  <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/48">
                    {connected ? <Check aria-hidden="true" className="h-4 w-4" /> : <UserRound aria-hidden="true" className="h-4 w-4" />}
                    {connected ? "rotina coordenada" : "rotina fragmentada"}
                  </p>
                  <h3 className="mt-4 text-3xl font-black leading-[0.92] tracking-[-0.05em] md:text-5xl">{connected ? content.withTitle : content.withoutTitle}</h3>
                  <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/62 md:text-base">{connected ? content.withText : content.withoutText}</p>
                </motion.div>
              </AnimatePresence>
              <div className="rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-[9px] font-black uppercase tracking-[0.15em] text-white/55">Cenário: {scenario.label}</div>
            </div>

            <div className="relative mt-7 hidden min-h-[420px] grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] gap-8 lg:grid">
              <ConnectionLayer connected={connected} reduceMotion={reduceMotion} />
              <div className="relative z-10 grid content-center gap-3">{content.inputs.map((item) => <FlowCard key={`input-${item.id}`} item={item} connected={connected} active={scenario.active.includes(item.id)} side="input" />)}</div>
              <motion.div layout transition={motionTransition} className="relative z-10 flex flex-col items-center justify-center px-2 text-center">
                <motion.div animate={connected && !reduceMotion ? { scale: [1, 1.035, 1], opacity: [0.9, 1, 0.9] } : { scale: 1, opacity: 1 }} transition={{ duration: 0.72, ease: "easeOut" }} className={cn("flex min-h-[222px] w-full flex-col items-center justify-center rounded-[32px] border px-5", connected ? "border-white/25 bg-white/[0.11] shadow-[0_28px_90px_-54px_rgba(255,255,255,0.7)]" : "border-white/12 bg-white/[0.045]") }>
                  {connected ? <BrainCircuit aria-hidden="true" className="h-9 w-9" /> : <UserRound aria-hidden="true" className="h-9 w-9 text-white/68" />}
                  <strong className="mt-5 text-2xl font-black tracking-[-0.04em]">{connected ? "Synapse" : "Você"}</strong>
                  <span className="mt-3 max-w-[170px] text-xs font-medium leading-relaxed text-white/56">{connected ? "recebe o contexto, prepara a ação e pede confirmação" : "confere, lembra, transporta informações e decide o próximo passo"}</span>
                  {connected ? <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-white/70"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />controle preservado</span> : null}
                </motion.div>
              </motion.div>
              <div className="relative z-10 grid content-center gap-3">{content.outputs.map((item) => <FlowCard key={`output-${item.id}`} item={item} connected={connected} active={scenario.active.includes(item.id)} side="output" />)}</div>
            </div>

            <div className="mt-7"><MobileFlow content={content} mode={mode} scenario={scenario} /></div>

            <div className="relative z-10 mt-7 grid gap-4 border-t border-white/10 pt-7 lg:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">{connected ? "O que muda" : "O ponto de atrito"}</p>
                <h4 className="mt-3 text-xl font-black tracking-[-0.04em]">{connected ? "A NeuroNex vira o painel de trabalho do Synapse." : "O sistema registra. Você ainda precisa operar cada parte."}</h4>
                <p className="mt-3 text-sm font-medium leading-relaxed text-white/58">{connected ? "O profissional continua podendo inserir e editar informações. A diferença é não depender só de trabalho manual para manter a rotina em movimento." : "Mesmo quando um sistema guarda agenda, prontuário e financeiro, interpretar o contexto e descobrir a próxima ação ainda costuma ficar por sua conta."}</p>
              </div>
              <div>
                <p className="mb-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/42">{connected ? "Como esse cenário fica com a NeuroNex" : "Como esse cenário costuma acontecer hoje"}</p>
                <ScenarioSteps scenario={scenario} mode={mode} />
              </div>
            </div>
          </motion.article>
        </div>
      </section>
    </MotionConfig>
  );
};
