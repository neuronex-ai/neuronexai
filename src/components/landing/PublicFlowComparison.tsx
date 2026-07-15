import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MotionConfig,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileCheck2,
  History,
  MessageCircle,
  Network,
  Send,
  ShieldCheck,
  UserRound,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ComparisonMode = "without" | "with";
type ComparisonVariant = "ecosystem" | "synapse";

type FlowNode = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
};

type FlowScenario = {
  id: string;
  label: string;
  active: string[];
  without: string[];
  with: string[];
};

type VariantContent = {
  eyebrow: string;
  title: string;
  description: string;
  withoutTitle: string;
  withoutText: string;
  withTitle: string;
  withText: string;
  centerWithout: string;
  centerWith: string;
  nodes: FlowNode[];
  scenarios: FlowScenario[];
};

type ConnectionPath = {
  id: string;
  active: boolean;
  d: string;
  start: { x: number; y: number };
  mid: { x: number; y: number };
  end: { x: number; y: number };
};

const ecosystemNodes: FlowNode[] = [
  { id: "agenda", label: "Agenda", detail: "horários, remarcações e status", icon: CalendarDays },
  { id: "whatsapp", label: "WhatsApp", detail: "pedidos, mensagens e áudios", icon: MessageCircle },
  { id: "prontuario", label: "Prontuário", detail: "histórico, notas e documentos", icon: ClipboardList },
  { id: "teleconsulta", label: "Teleconsulta", detail: "sessão online e continuidade", icon: Video },
  { id: "financeiro", label: "Financeiro", detail: "cobrança, pagamento e saldo", icon: CircleDollarSign },
  { id: "fiscal", label: "Fiscal", detail: "dados, recibos e NFS-e", icon: FileCheck2 },
];

const synapseNodes: FlowNode[] = [
  { id: "pedido", label: "Pedido", detail: "texto, voz ou WhatsApp", icon: Send },
  { id: "compreensao", label: "Compreensão", detail: "intenção e limites do pedido", icon: Bot },
  { id: "contexto", label: "Contexto", detail: "histórico autorizado", icon: Network },
  { id: "confirmacao", label: "Confirmação", detail: "revisão antes do efeito real", icon: ShieldCheck },
  { id: "execucao", label: "Execução", detail: "ação no painel certo", icon: CheckCircle2 },
  { id: "historico", label: "Histórico", detail: "continuidade da conversa", icon: History },
];

const ecosystemScenarios: FlowScenario[] = [
  {
    id: "appointment",
    label: "Novo agendamento",
    active: ["whatsapp", "agenda", "financeiro", "fiscal"],
    without: ["O pedido chega por mensagem.", "Você confere agenda, responde, cobra e depois revisa fiscal.", "Cada ferramenta registra só um pedaço."],
    with: ["O Synapse entende o pedido.", "Agenda, cobrança e dados fiscais entram no mesmo caminho.", "Você confirma antes de qualquer ação externa."],
  },
  {
    id: "reschedule",
    label: "Reagendamento",
    active: ["whatsapp", "agenda", "prontuario"],
    without: ["A conversa está em um lugar e a sessão em outro.", "Você procura o paciente e ajusta manualmente.", "O histórico depende da sua conferência."],
    with: ["O contexto da sessão é localizado.", "A mudança é preparada no fluxo certo.", "A conversa e a agenda ficam alinhadas após confirmação."],
  },
  {
    id: "teleconsultation",
    label: "Teleconsulta",
    active: ["agenda", "teleconsulta", "prontuario"],
    without: ["Você abre a sala e procura o histórico em outra tela.", "Depois registra notas e pendências manualmente.", "O atendimento vira uma sequência de alternâncias."],
    with: ["A sessão abre ligada à agenda e ao prontuário.", "O Synapse aponta o contexto permitido.", "Registros e próximas ações continuam no mesmo percurso."],
  },
  {
    id: "billing",
    label: "Cobrança",
    active: ["financeiro", "whatsapp", "fiscal"],
    without: ["Cobrança, mensagem, baixa e fiscal viram tarefas separadas.", "Você precisa lembrar o que falta.", "O dinheiro aparece antes do contexto operacional."],
    with: ["A cobrança é preparada com o contexto da sessão.", "Comunicação, pagamento e fiscal aparecem conectados.", "A ação só segue depois da sua revisão."],
  },
  {
    id: "patient-message",
    label: "Mensagem de paciente",
    active: ["whatsapp", "prontuario", "agenda"],
    without: ["Uma informação clínica chega fora do prontuário.", "Você tenta reconstruir o contexto.", "O próximo passo pode ficar solto."],
    with: ["A conversa é relacionada ao paciente certo.", "O Synapse mostra o contexto autorizado.", "Você decide o que registrar ou revisar."],
  },
];

const synapseScenarios: FlowScenario[] = ecosystemScenarios.map((scenario) => ({
  ...scenario,
  active: ["pedido", "compreensao", "contexto", "confirmacao", "execucao", "historico"],
  without: ["Você repete o pedido em cada canal.", "Procura o contexto e decide onde agir.", "A conversa perde continuidade."],
  with: ["O pedido entra por texto, voz ou WhatsApp.", "O Synapse entende, reúne contexto e pede confirmação.", "A execução e o histórico voltam para o painel."],
}));

const contentByVariant: Record<ComparisonVariant, VariantContent> = {
  ecosystem: {
    eyebrow: "Sem / Com a NeuroNex",
    title: "A rotina deixa de ser um conjunto de ferramentas soltas.",
    description: "O quadro permanece no viewport enquanto agenda, mensagens, prontuário, teleconsulta, financeiro e fiscal deixam de depender de caminhos manuais.",
    withoutTitle: "Ferramentas separadas. Psicólogo no centro.",
    withoutText: "Cada núcleo guarda uma parte da rotina, mas a ligação entre elas depende de conferência, memória e retrabalho.",
    withTitle: "Módulos conectados. Synapse no centro.",
    withText: "O contexto flui entre os módulos, ações são preparadas no lugar certo e o controle permanece com o profissional.",
    centerWithout: "Você conecta tudo",
    centerWith: "Synapse coordena o contexto",
    nodes: ecosystemNodes,
    scenarios: ecosystemScenarios,
  },
  synapse: {
    eyebrow: "Continuidade do Synapse",
    title: "O canal muda, mas o cérebro continua o mesmo.",
    description: "O comparativo acompanha o caminho pedido, compreensão, contexto, confirmação, execução e histórico, sem tratar NeuroZap, NeuroView ou NeuroBox como produtos desconectados.",
    withoutTitle: "O pedido recomeça em cada lugar.",
    withoutText: "Texto, voz e WhatsApp exigem repetição quando não existe uma camada comum de contexto e confirmação.",
    withTitle: "O Synapse mantém o caminho inteiro.",
    withText: "NeuroZap conecta e supervisiona o WhatsApp Business; NeuroView, NeuroFlow, NeuroPulse e NeuroScan são acionados pelo mesmo cérebro.",
    centerWithout: "Você reconstrói",
    centerWith: "Synapse acompanha",
    nodes: synapseNodes,
    scenarios: synapseScenarios,
  },
};

function getNarrativeMoment(progress: number) {
  if (progress < 0.25) return 0;
  if (progress < 0.48) return 1;
  if (progress < 0.72) return 2;
  return 3;
}

function getEdgePoint(from: DOMRect, to: DOMRect, scene: DOMRect) {
  const fromCenter = {
    x: from.left + from.width / 2 - scene.left,
    y: from.top + from.height / 2 - scene.top,
  };
  const toCenter = {
    x: to.left + to.width / 2 - scene.left,
    y: to.top + to.height / 2 - scene.top,
  };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: (dx > 0 ? from.right : from.left) - scene.left,
      y: fromCenter.y,
    };
  }

  return {
    x: fromCenter.x,
    y: (dy > 0 ? from.bottom : from.top) - scene.top,
  };
}

function buildPath(from: DOMRect, to: DOMRect, scene: DOMRect, active: boolean, id: string): ConnectionPath {
  const start = getEdgePoint(from, to, scene);
  const end = getEdgePoint(to, from, scene);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const curve = Math.max(36, Math.min(140, Math.abs(end.x - start.x) * 0.26));
  const controlOne = { x: start.x + (end.x >= start.x ? curve : -curve), y: start.y };
  const controlTwo = { x: end.x - (end.x >= start.x ? curve : -curve), y: end.y };

  return {
    id,
    active,
    d: `M ${start.x} ${start.y} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${end.x} ${end.y}`,
    start,
    mid,
    end,
  };
}

function FlowCard({
  item,
  active,
  connected,
  narrativeMoment,
  setNodeRef,
}: {
  item: FlowNode;
  active: boolean;
  connected: boolean;
  narrativeMoment: number;
  setNodeRef: (id: string) => (node: HTMLDivElement | null) => void;
}) {
  const Icon = item.icon;
  const muted = narrativeMoment === 1 && !active;

  return (
    <motion.article
      ref={setNodeRef(item.id)}
      layout
      className={cn(
        "relative z-10 min-h-[112px] rounded-[24px] border p-4 text-left transition-colors duration-300 motion-reduce:transition-none",
        connected
          ? "border-white/16 bg-white/[0.075] text-white shadow-[0_24px_70px_-56px_rgba(255,255,255,0.62)]"
          : "border-white/10 bg-white/[0.035] text-white/88",
        active ? "ring-1 ring-white/36" : "opacity-58",
        muted && "opacity-34",
      )}
      animate={{
        scale: active && connected ? 1.025 : active ? 1 : 0.985,
        y: narrativeMoment >= 2 && active ? -2 : 0,
      }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border", active && connected ? "border-white/20 bg-white text-zinc-950" : "border-white/10 bg-white/[0.08] text-white/70")}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black tracking-[-0.02em]">{item.label}</h4>
          <p className="mt-1 text-xs font-medium leading-relaxed text-white/54">{item.detail}</p>
        </div>
      </div>
      <p className="mt-4 text-[8px] font-black uppercase tracking-[0.16em] text-white/36">
        {connected ? "contexto compartilhado" : "núcleo isolado"}
      </p>
    </motion.article>
  );
}

function ScenarioSteps({ scenario, mode }: { scenario: FlowScenario; mode: ComparisonMode }) {
  const steps = mode === "with" ? scenario.with : scenario.without;

  return (
    <div className="grid gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[9px] font-black text-white/58">{index + 1}</span>
          <p className="text-sm font-medium leading-relaxed text-white/68">{step}</p>
        </div>
      ))}
    </div>
  );
}

export const PublicFlowComparison = ({ variant = "ecosystem" }: { variant?: ComparisonVariant }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [paths, setPaths] = useState<ConnectionPath[]>([]);
  const [scenarioId, setScenarioId] = useState("appointment");
  const [manualMode, setManualMode] = useState<ComparisonMode | null>(null);
  const [scrollMoment, setScrollMoment] = useState(0);
  const reduceMotion = useReducedMotion();
  const sectionId = useId();
  const content = contentByVariant[variant];
  const scenario = content.scenarios.find((item) => item.id === scenarioId) ?? content.scenarios[0];

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextMoment = getNarrativeMoment(latest);
    setScrollMoment((current) => (current === nextMoment ? current : nextMoment));
  });

  const narrativeMoment = reduceMotion
    ? manualMode === "with"
      ? 3
      : 0
    : manualMode === "with"
      ? 3
      : manualMode === "without"
        ? 0
        : scrollMoment;
  const connected = narrativeMoment >= 2;
  const currentMode: ComparisonMode = connected ? "with" : "without";

  const manualPathOpacity = useTransform(scrollYProgress, [0.08, 0.36, 0.56], [1, 0.64, 0]);
  const connectedPathOpacity = useTransform(scrollYProgress, [0.42, 0.66, 1], [0, 0.82, 1]);
  const synapseScale = useTransform(scrollYProgress, [0.42, 0.68], [0.88, 1]);
  const sceneScale = useTransform(scrollYProgress, [0, 0.16, 0.86, 1], [0.975, 1, 1, 0.985]);

  const setNodeRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) {
        nodeRefs.current.set(id, node);
      } else {
        nodeRefs.current.delete(id);
      }
    },
    [],
  );

  const updatePaths = useCallback(() => {
    const scene = sceneRef.current;
    const center = centerRef.current;
    if (!scene || !center) return;

    const sceneRect = scene.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    const nextPaths = content.nodes
      .map((node) => {
        const element = nodeRefs.current.get(node.id);
        if (!element) return null;
        return buildPath(element.getBoundingClientRect(), centerRect, sceneRect, scenario.active.includes(node.id), node.id);
      })
      .filter(Boolean) as ConnectionPath[];

    setPaths(nextPaths);
  }, [content.nodes, scenario.active]);

  useLayoutEffect(() => {
    updatePaths();

    const observedNodes = [sceneRef.current, centerRef.current, ...Array.from(nodeRefs.current.values())].filter(Boolean) as Element[];
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePaths) : null;
    observedNodes.forEach((node) => observer?.observe(node));
    window.addEventListener("resize", updatePaths);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updatePaths);
    };
  }, [updatePaths]);

  const nodeColumns = useMemo(() => {
    const left = content.nodes.filter((_, index) => index % 2 === 0);
    const right = content.nodes.filter((_, index) => index % 2 === 1);
    return { left, right };
  }, [content.nodes]);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        id={variant === "ecosystem" ? "diferenciais" : "synapse-continuity"}
        aria-labelledby={`${sectionId}-title`}
        className={cn("relative overflow-clip bg-background px-5 py-20 md:px-8", reduceMotion ? "md:py-28" : "lg:min-h-[238vh] lg:py-0")}
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-[620px] w-[960px] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-[170px] dark:bg-white/[0.028]" />
        <div className={cn("relative z-10 mx-auto flex w-full max-w-[1360px] flex-col justify-center", reduceMotion ? "" : "lg:sticky lg:top-0 lg:min-h-screen lg:py-20")}>
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{content.eyebrow}</p>
              <h2 id={`${sectionId}-title`} className="mt-4 max-w-4xl text-4xl font-black leading-[0.9] tracking-[-0.058em] text-foreground md:text-6xl">
                {content.title}
              </h2>
            </div>
            <p className="max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground/72 md:text-base lg:justify-self-end">
              {content.description}
            </p>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="grid content-start gap-4">
              <div role="tablist" aria-label="Comparar sem ou com a NeuroNex" className="grid grid-cols-2 rounded-[20px] border border-border/45 bg-card/75 p-1.5 dark:border-white/10 dark:bg-white/[0.035]">
                {(["without", "with"] as const).map((mode) => {
                  const selected = currentMode === mode;
                  return (
                    <button
                      key={mode}
                      id={`${sectionId}-${mode}-tab`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`${sectionId}-panel`}
                      onClick={() => setManualMode(mode)}
                      className={cn(
                        "min-h-11 rounded-[14px] px-3 text-[9px] font-black uppercase tracking-[0.15em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode === "without" ? "Sem" : "Com"}
                    </button>
                  );
                })}
              </div>

              {manualMode ? (
                <button
                  type="button"
                  onClick={() => setManualMode(null)}
                  className="min-h-10 rounded-2xl border border-border/45 bg-card/60 px-4 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/[0.025]"
                >
                  Acompanhar rolagem
                </button>
              ) : null}

              <div className="rounded-[26px] border border-border/45 bg-card/68 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Cenários</p>
                <div className="grid gap-1.5">
                  {content.scenarios.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={scenario.id === item.id}
                      onClick={() => setScenarioId(item.id)}
                      className={cn(
                        "min-h-10 rounded-[16px] px-3 text-left text-[9px] font-black uppercase tracking-[0.13em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        scenario.id === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-border/45 bg-foreground p-4 text-background dark:bg-white dark:text-zinc-950">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
                  {currentMode === "with" ? "Estado com NeuroNex" : "Estado sem NeuroNex"}
                </p>
                <h3 className="mt-3 text-xl font-black leading-[0.96] tracking-[-0.045em]">
                  {currentMode === "with" ? content.withTitle : content.withoutTitle}
                </h3>
                <p className="mt-3 text-xs font-medium leading-relaxed opacity-66">
                  {currentMode === "with" ? content.withText : content.withoutText}
                </p>
              </div>
            </aside>

            <article
              id={`${sectionId}-panel`}
              role="tabpanel"
              aria-labelledby={`${sectionId}-${currentMode}-tab`}
              className="relative overflow-hidden rounded-[38px] border border-white/10 bg-[#08080a] p-4 text-white shadow-[0_42px_150px_-88px_rgba(0,0,0,0.96)] md:p-5"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.1),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.045),transparent_35%,rgba(255,255,255,0.015))]" />
              <motion.div
                ref={sceneRef}
                style={reduceMotion ? undefined : { scale: sceneScale, willChange: "transform" }}
                className="relative z-10 min-h-[580px] overflow-hidden rounded-[30px] border border-white/10 bg-black/18 p-4 lg:min-h-[62vh]"
              >
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
                  {paths.map((path) => (
                    <motion.path
                      key={`manual-${path.id}`}
                      d={path.d}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeDasharray="5 10"
                      className="text-white"
                      style={{ opacity: manualMode ? (connected ? 0 : 0.5) : manualPathOpacity }}
                    />
                  ))}
                  {paths.map((path) => (
                    <motion.path
                      key={`connected-${path.id}`}
                      d={path.d}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={path.active ? 1.8 : 1}
                      className={path.active ? "text-white" : "text-white/30"}
                      style={{ opacity: manualMode ? (connected ? (path.active ? 0.8 : 0.18) : 0) : connectedPathOpacity }}
                    />
                  ))}
                  {connected && !reduceMotion
                    ? paths
                        .filter((path) => path.active)
                        .map((path, index) => (
                          <motion.circle
                            key={`signal-${path.id}-${scenario.id}-${manualMode ?? "scroll"}`}
                            r="3.5"
                            fill="currentColor"
                            className="text-white"
                            initial={{ cx: path.start.x, cy: path.start.y, opacity: 0 }}
                            animate={{
                              cx: [path.start.x, path.mid.x, path.end.x],
                              cy: [path.start.y, path.mid.y, path.end.y],
                              opacity: [0, 1, 0],
                            }}
                            transition={{ duration: 0.85, delay: index * 0.08, ease: "easeInOut" }}
                          />
                        ))
                    : null}
                </svg>

                <div className="relative z-10 grid min-h-[548px] gap-4 lg:min-h-[calc(62vh-2rem)] lg:grid-cols-[minmax(0,1fr)_230px_minmax(0,1fr)] lg:items-center">
                  <div className="grid gap-3">
                    {nodeColumns.left.map((node) => (
                      <FlowCard
                        key={node.id}
                        item={node}
                        active={scenario.active.includes(node.id)}
                        connected={connected}
                        narrativeMoment={narrativeMoment}
                        setNodeRef={setNodeRef}
                      />
                    ))}
                  </div>

                  <motion.div
                    ref={centerRef}
                    layout
                    style={reduceMotion ? undefined : { scale: synapseScale }}
                    className={cn(
                      "relative z-20 flex min-h-[228px] flex-col items-center justify-center rounded-[32px] border px-5 text-center",
                      connected ? "border-white/26 bg-white/[0.12] shadow-[0_26px_90px_-54px_rgba(255,255,255,0.72)]" : "border-white/12 bg-white/[0.045]",
                    )}
                  >
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-[20px]", connected ? "bg-white text-zinc-950" : "bg-white/[0.08] text-white/76")}>
                      {connected ? <Bot aria-hidden="true" className="h-6 w-6" /> : <UserRound aria-hidden="true" className="h-6 w-6" />}
                    </div>
                    <strong className="mt-5 text-2xl font-black leading-none tracking-[-0.045em]">
                      {connected ? "Synapse" : "Psicólogo"}
                    </strong>
                    <span className="mt-3 max-w-[170px] text-xs font-medium leading-relaxed text-white/58">
                      {connected ? content.centerWith : content.centerWithout}
                    </span>
                    {connected ? (
                      <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-white/70">
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        confirmação preservada
                      </span>
                    ) : (
                      <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-white/42">
                        <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                        caminhos manuais
                      </span>
                    )}
                  </motion.div>

                  <div className="grid gap-3">
                    {nodeColumns.right.map((node) => (
                      <FlowCard
                        key={node.id}
                        item={node}
                        active={scenario.active.includes(node.id)}
                        connected={connected}
                        narrativeMoment={narrativeMoment}
                        setNodeRef={setNodeRef}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              <div className="relative z-10 mt-4 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Momento narrativo</p>
                  <h4 className="mt-3 text-xl font-black leading-[0.96] tracking-[-0.04em]">
                    {[
                      "Ferramentas separadas e psicólogo no centro.",
                      "Caminhos manuais começam a se retrair.",
                      "Módulos se reorganizam ao redor do Synapse.",
                      "Contexto e ações fluem entre os módulos.",
                    ][narrativeMoment]}
                  </h4>
                  <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/42">
                    <span>{variant === "synapse" ? "NeuroZap supervisiona WhatsApp Business" : `Cenário: ${scenario.label}`}</span>
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </div>
                </div>
                <ScenarioSteps scenario={scenario} mode={currentMode} />
              </div>
            </article>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
};
