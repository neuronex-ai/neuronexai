import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  MotionConfig,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  BellRing,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  Mail,
  MessageCircle,
  Mic2,
  Monitor,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ComparisonMode = "without" | "with";
type ComparisonVariant = "ecosystem" | "synapse";
type StoryPhase = "fragmented" | "retracting" | "synapse" | "connected";
type NodeSide = "left" | "right";

type FlowNode = {
  id: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  side: NodeSide;
};

type FlowScenario = {
  id: string;
  label: string;
  active: string[];
  without: [string, string, string];
  with: [string, string, string];
};

type ComparisonContent = {
  eyebrow: string;
  title: string;
  description: string;
  withoutTitle: string;
  withoutText: string;
  withTitle: string;
  withText: string;
  nodes: [FlowNode, FlowNode, FlowNode, FlowNode, FlowNode, FlowNode];
  scenarios: FlowScenario[];
};

type ConnectionGeometry = {
  id: string;
  side: NodeSide;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const ecosystemContent: ComparisonContent = {
  eyebrow: "O que muda na prática",
  title: "Hoje, você ainda precisa conectar tudo sozinho.",
  description:
    "Agenda, mensagens, prontuário, atendimentos e cobranças vivem separados. No fim, é você quem precisa conferir e atualizar cada parte.",
  withoutTitle: "As ferramentas guardam informações. Você ainda faz as conexões.",
  withoutText:
    "Cada parte registra um pedaço da rotina, mas é o psicólogo quem procura, transporta e reorganiza o contexto.",
  withTitle: "Com a NeuroNex, a rotina passa a trabalhar em conjunto.",
  withText:
    "O Synapse relaciona o contexto, prepara a próxima etapa e pede sua confirmação sempre que uma decisão depende de você.",
  nodes: [
    { id: "agenda", icon: CalendarDays, label: "Agenda", detail: "horários, sessões e mudanças", side: "left" },
    { id: "whatsapp", icon: MessageCircle, label: "WhatsApp", detail: "pedidos, mensagens e áudios", side: "left" },
    { id: "prontuario", icon: ClipboardList, label: "Prontuário", detail: "histórico e registros clínicos", side: "left" },
    { id: "teleconsulta", icon: Video, label: "Teleconsulta", detail: "atendimento e continuidade", side: "right" },
    { id: "financeiro", icon: CircleDollarSign, label: "NeuroFinance", detail: "cobrança, pagamento e saldo", side: "right" },
    { id: "fiscal", icon: FileCheck2, label: "Fiscal", detail: "dados e emissão de NFS-e", side: "right" },
  ],
  scenarios: [
    {
      id: "appointment",
      label: "Novo agendamento",
      active: ["agenda", "whatsapp", "financeiro", "fiscal"],
      without: [
        "O pedido chega e você abre a agenda.",
        "Você cria a sessão e volta para enviar a confirmação.",
        "Depois prepara cobrança, acompanha pagamento e confere o fiscal.",
      ],
      with: [
        "Você pede o agendamento ao Synapse.",
        "Ele confere o contexto e mostra um resumo para sua validação.",
        "Agenda, comunicação, financeiro e fiscal seguem o mesmo percurso.",
      ],
    },
    {
      id: "reschedule",
      label: "Reagendamento",
      active: ["agenda", "whatsapp"],
      without: [
        "A mudança chega por mensagem e a agenda está em outra tela.",
        "Você procura a sessão, troca o horário e responde novamente.",
        "Lembretes e pendências precisam ser conferidos à parte.",
      ],
      with: [
        "O Synapse localiza a sessão a partir da conversa.",
        "Ele apresenta horários possíveis e espera sua confirmação.",
        "A alteração atualiza a agenda e preserva o histórico do pedido.",
      ],
    },
    {
      id: "teleconsultation",
      label: "Teleconsulta",
      active: ["agenda", "prontuario", "teleconsulta"],
      without: [
        "Você confere o horário e procura o histórico em outra tela.",
        "Abre a sala e alterna entre o atendimento e os registros.",
        "Depois volta para organizar o que precisa acontecer.",
      ],
      with: [
        "A sessão já aparece ligada à agenda e ao paciente certo.",
        "O Synapse reúne o contexto autorizado para sua leitura.",
        "Registros e próximos passos continuam no mesmo ambiente.",
      ],
    },
    {
      id: "billing",
      label: "Cobrança",
      active: ["financeiro", "fiscal", "whatsapp"],
      without: [
        "Você cria a cobrança e prepara a mensagem em etapas separadas.",
        "Depois precisa lembrar de conferir o pagamento.",
        "Recibo, nota e pendências continuam dependendo de outra revisão.",
      ],
      with: [
        "O Synapse prepara a cobrança com o contexto da sessão.",
        "Você revisa antes de qualquer envio ou alteração externa.",
        "Pagamento, comunicação e fiscal aparecem como um único percurso.",
      ],
    },
    {
      id: "patient-message",
      label: "Mensagem de paciente",
      active: ["whatsapp", "prontuario", "agenda"],
      without: [
        "Uma informação importante chega fora do prontuário.",
        "Você procura o contexto e decide onde registrar.",
        "A continuidade depende da sua memória e do tempo disponível.",
      ],
      with: [
        "O Synapse relaciona a conversa ao contexto autorizado.",
        "Ele destaca o que merece atenção e prepara a área certa.",
        "A leitura clínica e a decisão continuam sob seu controle.",
      ],
    },
  ],
};

const synapseContent: ComparisonContent = {
  eyebrow: "Um contexto, em todos os canais",
  title: "A conversa continua, mesmo quando o canal muda.",
  description:
    "Voz, painel e WhatsApp passam a compartilhar o histórico autorizado, sem obrigar você a reconstruir o pedido em cada lugar.",
  withoutTitle: "Cada canal conhece apenas a conversa que aconteceu ali.",
  withoutText:
    "Você repete o pedido, procura o histórico e volta a explicar o que estava fazendo antes de avançar.",
  withTitle: "O Synapse acompanha a conversa e movimenta o painel.",
  withText:
    "Ele entende o pedido, encontra o contexto permitido e prepara a ação na área correta da NeuroNex.",
  nodes: [
    { id: "whatsapp", icon: MessageCircle, label: "WhatsApp", detail: "áudio, texto e pedidos do dia", side: "left" },
    { id: "voice", icon: Mic2, label: "Voz", detail: "comandos enquanto você trabalha", side: "left" },
    { id: "panel", icon: Monitor, label: "Painel", detail: "conversa e ações no sistema", side: "left" },
    { id: "agenda", icon: CalendarDays, label: "Agenda", detail: "o que acontece agora", side: "right" },
    { id: "prontuario", icon: ClipboardList, label: "Prontuário", detail: "histórico que você autorizou", side: "right" },
    { id: "actions", icon: BellRing, label: "Próxima ação", detail: "o que fica pronto para você", side: "right" },
  ],
  scenarios: [
    {
      id: "appointment",
      label: "Novo agendamento",
      active: ["whatsapp", "panel", "agenda", "actions"],
      without: [
        "O pedido chega no WhatsApp.",
        "Você abre outras telas para entender o dia.",
        "A conversa e a ação terminam separadas.",
      ],
      with: [
        "Você continua o pedido por voz, painel ou WhatsApp.",
        "O Synapse encontra o contexto permitido e prepara o agendamento.",
        "A ação só avança depois da confirmação necessária.",
      ],
    },
    {
      id: "reschedule",
      label: "Reagendamento",
      active: ["whatsapp", "panel", "agenda", "actions"],
      without: [
        "A conversa não sabe qual sessão você procura.",
        "Você encontra o nome, o horário e o histórico manualmente.",
        "Depois volta ao primeiro canal para responder.",
      ],
      with: [
        "O Synapse localiza a sessão dentro da conversa.",
        "Ele apresenta opções no painel e mantém o mesmo histórico.",
        "Você valida a mudança antes de ela acontecer.",
      ],
    },
    {
      id: "teleconsultation",
      label: "Teleconsulta",
      active: ["voice", "panel", "agenda", "prontuario"],
      without: [
        "O contexto da próxima sessão está espalhado por abas.",
        "Você interrompe a preparação para procurar informações.",
        "Depois decide sozinho o que merece atenção.",
      ],
      with: [
        "Você pede por voz para abrir o contexto da próxima sessão.",
        "O Synapse leva o painel à área correta e destaca as relações.",
        "Você recebe o resumo sem entregar a decisão clínica ao sistema.",
      ],
    },
    {
      id: "billing",
      label: "Cobrança",
      active: ["whatsapp", "panel", "actions"],
      without: [
        "A conversa sobre pagamento fica longe da rotina do paciente.",
        "Você procura os dados e prepara cada etapa.",
        "Uma nova conferência será necessária depois.",
      ],
      with: [
        "O Synapse reúne o contexto permitido da cobrança.",
        "Ele prepara a ação e explica o que vai acontecer.",
        "Você confirma antes de qualquer envio ou alteração.",
      ],
    },
    {
      id: "patient-message",
      label: "Mensagem de paciente",
      active: ["whatsapp", "panel", "prontuario", "actions"],
      without: [
        "A mensagem chega sem o histórico das outras conversas.",
        "Você tenta lembrar o contexto e procura os registros.",
        "O que importa pode permanecer perdido em outro canal.",
      ],
      with: [
        "A mensagem continua uma conversa iniciada no painel.",
        "O Synapse relaciona o histórico dentro das permissões.",
        "Ele mostra o próximo passo sem substituir sua decisão.",
      ],
    },
  ],
};

const contentByVariant: Record<ComparisonVariant, ComparisonContent> = {
  ecosystem: ecosystemContent,
  synapse: synapseContent,
};

const phaseFromProgress = (progress: number): StoryPhase => {
  if (progress < 0.28) return "fragmented";
  if (progress < 0.48) return "retracting";
  if (progress < 0.68) return "synapse";
  return "connected";
};

const modeFromProgress = (progress: number): ComparisonMode =>
  progress < 0.56 ? "without" : "with";

const phaseLabels: Record<StoryPhase, string> = {
  fragmented: "Ferramentas separadas",
  retracting: "O trabalho manual perde espaço",
  synapse: "O contexto encontra um núcleo",
  connected: "Uma rotina coordenada",
};

function ModeTabs({
  id,
  mode,
  onChange,
}: {
  id: string;
  mode: ComparisonMode;
  onChange: (mode: ComparisonMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Comparar a rotina com e sem a NeuroNex"
      className="grid min-w-[284px] grid-cols-2 rounded-2xl border border-border/55 bg-card/80 p-1 dark:border-white/10 dark:bg-white/[0.04]"
    >
      {(["without", "with"] as const).map((item) => {
        const selected = mode === item;
        return (
          <button
            key={item}
            id={`${id}-${item}-tab`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item)}
            className={cn(
              "min-h-10 rounded-xl px-3 text-[9px] font-black uppercase tracking-[0.15em] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item === "without" ? "Sem a NeuroNex" : "Com a NeuroNex"}
          </button>
        );
      })}
    </div>
  );
}

function ScenarioTabs({
  scenarios,
  selectedId,
  onChange,
}: {
  scenarios: FlowScenario[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-end"
      aria-label="Escolha uma situação comum da rotina"
    >
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          aria-pressed={selectedId === scenario.id}
          onClick={() => onChange(scenario.id)}
          className={cn(
            "min-h-9 rounded-full border px-3 text-[8px] font-black uppercase tracking-[0.11em] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring",
            selectedId === scenario.id
              ? "border-foreground bg-foreground text-background"
              : "border-border/55 bg-card/70 text-muted-foreground hover:border-foreground/35 hover:text-foreground dark:border-white/10 dark:bg-white/[0.025]",
          )}
        >
          {scenario.label}
        </button>
      ))}
    </div>
  );
}

function FlowNodeCard({
  item,
  index,
  active,
  progress,
  nodeRef,
}: {
  item: FlowNode;
  index: number;
  active: boolean;
  progress: MotionValue<number>;
  nodeRef: (node: HTMLElement | null) => void;
}) {
  const Icon = item.icon;
  const manualOffset = index % 3 === 0 ? -5 : index % 3 === 1 ? 4 : 7;
  const y = useTransform(progress, [0, 0.28, 0.5], [manualOffset, manualOffset / 2, 0]);
  const scale = useTransform(progress, [0, 0.38, 0.62, 1], [0.975, 0.955, 1, 1]);
  const nodeOpacity = useTransform(progress, [0, 0.34, 0.5, 0.72], [1, 0.62, 0.72, 1]);

  return (
    <motion.article
      ref={nodeRef}
      style={{
        y,
        scale,
        opacity: nodeOpacity,
        gridColumn: item.side === "left" ? 1 : 3,
        gridRow: (index % 3) + 1,
      }}
      className={cn(
        "relative z-10 flex min-h-0 items-center gap-3 self-stretch overflow-hidden rounded-[18px] border bg-[#111114]/95 px-3.5 py-2.5 shadow-[0_14px_38px_-30px_rgba(0,0,0,0.95)]",
        active ? "border-white/28" : "border-white/10",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          active
            ? "border-white/18 bg-white text-black"
            : "border-white/10 bg-white/[0.06] text-white/52",
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-[13px] font-black tracking-[-0.02em] text-white">
          {item.label}
        </strong>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-white/48">
          {item.detail}
        </span>
      </span>
    </motion.article>
  );
}

function CentralCore({ progress }: { progress: MotionValue<number> }) {
  const userOpacity = useTransform(progress, [0, 0.25, 0.43], [1, 1, 0]);
  const userScale = useTransform(progress, [0, 0.32, 0.45], [1, 0.96, 0.86]);
  const synapseOpacity = useTransform(progress, [0.38, 0.55, 1], [0, 1, 1]);
  const synapseScale = useTransform(progress, [0.38, 0.58, 0.76, 1], [0.84, 0.96, 1, 1]);
  const coreScale = useTransform(progress, [0, 0.38, 0.6, 1], [1, 0.91, 1.03, 1]);
  const glowOpacity = useTransform(progress, [0.35, 0.62, 1], [0, 0.7, 0.32]);

  return (
    <motion.div
      style={{ scale: coreScale, gridColumn: 2, gridRow: "1 / span 3" }}
      className="relative z-20 flex min-h-0 items-center justify-center"
    >
      <motion.div
        aria-hidden="true"
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute h-48 w-48 rounded-full bg-white/15 blur-[58px]"
      />
      <div className="relative h-[156px] w-full max-w-[188px] overflow-hidden rounded-[30px] border border-white/18 bg-[#141417]/95 shadow-[0_28px_85px_-55px_rgba(255,255,255,0.75)]">
        <motion.div
          style={{ opacity: userOpacity, scale: userScale }}
          className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
        >
          <UserRound aria-hidden="true" className="h-7 w-7 text-white/68" />
          <strong className="mt-3 text-lg font-black tracking-[-0.04em] text-white">Você</strong>
          <span className="mt-2 text-[10px] font-medium leading-relaxed text-white/48">
            confere, copia e decide cada próximo passo
          </span>
        </motion.div>
        <motion.div
          style={{ opacity: synapseOpacity, scale: synapseScale }}
          className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
        >
          <BrainCircuit aria-hidden="true" className="h-8 w-8 text-white" />
          <strong className="mt-3 text-xl font-black tracking-[-0.04em] text-white">Synapse</strong>
          <span className="mt-2 text-[10px] font-medium leading-relaxed text-white/52">
            relaciona o contexto e prepara a ação
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/[0.06] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-white/64">
            <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
            você confirma
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

const createConnectionPath = (connection: ConnectionGeometry) => {
  const direction = connection.side === "left" ? 1 : -1;
  const distance = Math.abs(connection.endX - connection.startX);
  const bend = Math.max(34, distance * 0.46);

  return [
    `M ${connection.startX} ${connection.startY}`,
    `C ${connection.startX + bend * direction} ${connection.startY}`,
    `${connection.endX - bend * direction} ${connection.endY}`,
    `${connection.endX} ${connection.endY}`,
  ].join(" ");
};

function FlowConnection({
  connection,
  progress,
  active,
}: {
  connection: ConnectionGeometry;
  progress: MotionValue<number>;
  active: boolean;
}) {
  const manualLength = useTransform(progress, [0, 0.12, 0.31, 0.44], [0.78, 1, 0.38, 0]);
  const manualOpacity = useTransform(progress, [0, 0.22, 0.44], [active ? 0.52 : 0.2, active ? 0.58 : 0.22, 0]);
  const connectedLength = useTransform(progress, [0.5, 0.66, 0.86, 1], [0, 0.18, 1, 1]);
  const connectedOpacity = useTransform(progress, [0.5, 0.64, 0.82, 1], [0, 0, active ? 0.78 : 0.24, active ? 0.62 : 0.18]);
  const d = createConnectionPath(connection);

  return (
    <>
      <motion.path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1"
        strokeDasharray="5 8"
        style={{ pathLength: manualLength, opacity: manualOpacity }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke={active ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.3)"}
        strokeWidth={active ? 1.5 : 1}
        style={{ pathLength: connectedLength, opacity: connectedOpacity }}
      />
    </>
  );
}

function ConnectionLayer({
  connections,
  progress,
  activeIds,
}: {
  connections: ConnectionGeometry[];
  progress: MotionValue<number>;
  activeIds: string[];
}) {
  if (connections.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
    >
      {connections.map((connection) => (
        <FlowConnection
          key={connection.id}
          connection={connection}
          progress={progress}
          active={activeIds.includes(connection.id)}
        />
      ))}
    </svg>
  );
}

function ScenarioSummary({
  scenario,
  mode,
}: {
  scenario: FlowScenario;
  mode: ComparisonMode;
}) {
  const steps = mode === "with" ? scenario.with : scenario.without;

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={`Etapas do cenário ${scenario.label}`}>
      {steps.map((step, index) => (
        <li
          key={step}
          className="flex min-w-0 items-start gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/14 text-[7px] font-black text-white/52">
            {index + 1}
          </span>
          <span className="line-clamp-2 text-[9px] font-medium leading-relaxed text-white/54">
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CompactComparison({
  id,
  content,
  scenario,
  mode,
  onModeChange,
  onScenarioChange,
}: {
  id: string;
  content: ComparisonContent;
  scenario: FlowScenario;
  mode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
  onScenarioChange: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl lg:hidden">
      <div className="text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {content.eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-black leading-[0.95] tracking-[-0.055em] text-foreground sm:text-4xl">
          {content.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
          {content.description}
        </p>
      </div>

      <div className="mt-7 grid gap-3">
        <ModeTabs id={`${id}-compact`} mode={mode} onChange={onModeChange} />
        <ScenarioTabs scenarios={content.scenarios} selectedId={scenario.id} onChange={onScenarioChange} />
      </div>

      <article
        id={`${id}-compact-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-compact-${mode}-tab`}
        className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#09090b] p-4 text-white"
      >
        <h3 className="text-2xl font-black leading-tight tracking-[-0.045em]">
          {mode === "with" ? content.withTitle : content.withoutTitle}
        </h3>
        <p className="mt-3 text-sm font-medium leading-relaxed text-white/56">
          {mode === "with" ? content.withText : content.withoutText}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {content.nodes.map((node) => {
            const Icon = node.icon;
            const active = scenario.active.includes(node.id);
            return (
              <div
                key={node.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-white/[0.035] p-3",
                  active ? "border-white/25" : "border-white/8 opacity-55",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span>
                  <strong className="block text-sm font-black">{node.label}</strong>
                  <span className="mt-0.5 block text-[10px] text-white/48">{node.detail}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-5 space-y-2">
          {(mode === "with" ? scenario.with : scenario.without).map((step, index) => (
            <div key={step} className="flex items-start gap-3 rounded-xl border border-white/8 px-3 py-2.5">
              <span className="text-[9px] font-black text-white/42">0{index + 1}</span>
              <p className="text-xs font-medium leading-relaxed text-white/62">{step}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export const PublicFlowComparison = ({
  variant = "ecosystem",
}: {
  variant?: ComparisonVariant;
}) => {
  const content = contentByVariant[variant];
  const sectionId = useId();
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [scenarioId, setScenarioId] = useState("appointment");
  const [scrollMode, setScrollMode] = useState<ComparisonMode>("without");
  const [manualMode, setManualMode] = useState<ComparisonMode>("without");
  const [phase, setPhase] = useState<StoryPhase>("fragmented");
  const [connections, setConnections] = useState<ConnectionGeometry[]>([]);
  const reduceMotion = useReducedMotion();
  const staticProgress = useMotionValue(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const storyProgress = reduceMotion ? staticProgress : scrollYProgress;
  const scenario = content.scenarios.find((item) => item.id === scenarioId) ?? content.scenarios[0];
  const mode = reduceMotion ? manualMode : scrollMode;

  useEffect(() => {
    if (!reduceMotion) return;
    staticProgress.set(manualMode === "with" ? 1 : 0);
    setPhase(manualMode === "with" ? "connected" : "fragmented");
  }, [manualMode, reduceMotion, staticProgress]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (reduceMotion) return;
    const nextMode = modeFromProgress(latest);
    const nextPhase = phaseFromProgress(latest);
    setScrollMode((current) => (current === nextMode ? current : nextMode));
    setPhase((current) => (current === nextPhase ? current : nextPhase));
  });

  const registerNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const core = coreRef.current;
    if (!canvas || !core) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return;

        const coreLeft = core.offsetLeft;
        const coreRight = core.offsetLeft + core.offsetWidth;
        const coreCenterY = core.offsetTop + core.offsetHeight / 2;
        const nextConnections = content.nodes.flatMap((node) => {
          const element = nodeRefs.current.get(node.id);
          if (!element) return [];

          const nodeCenterY = element.offsetTop + element.offsetHeight / 2;
          return [{
            id: node.id,
            side: node.side,
            startX: node.side === "left" ? element.offsetLeft + element.offsetWidth : coreRight,
            startY: node.side === "left" ? nodeCenterY : coreCenterY,
            endX: node.side === "left" ? coreLeft : element.offsetLeft,
            endY: node.side === "left" ? coreCenterY : nodeCenterY,
          } satisfies ConnectionGeometry];
        });

        setConnections(nextConnections);
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(core);
    nodeRefs.current.forEach((node) => observer.observe(node));
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [content]);

  const changeDesktopMode = useCallback((nextMode: ComparisonMode) => {
    if (reduceMotion) {
      setManualMode(nextMode);
      return;
    }

    const section = sectionRef.current;
    if (!section) return;
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const availableTravel = Math.max(0, section.offsetHeight - window.innerHeight);
    const targetProgress = nextMode === "without" ? 0.06 : 0.82;
    window.scrollTo({
      top: sectionTop + availableTravel * targetProgress,
      behavior: "smooth",
    });
  }, [reduceMotion]);

  const activeTitle = mode === "with" ? content.withTitle : content.withoutTitle;
  const activeText = mode === "with" ? content.withText : content.withoutText;
  const sceneTitleOpacity = useTransform(storyProgress, [0, 0.32, 0.5, 0.68, 1], [1, 0.74, 0.42, 0.82, 1]);
  const sceneScale = useTransform(storyProgress, [0, 0.34, 0.56, 0.76, 1], [1, 0.985, 0.965, 1, 1]);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        id={variant === "ecosystem" ? "diferenciais" : "synapse-continuity"}
        aria-label={content.title}
        className={cn(
          "relative bg-background px-5 py-20 md:px-8",
          reduceMotion ? "lg:py-28" : "lg:h-[360svh] lg:px-6 lg:py-0",
        )}
      >
        <CompactComparison
          id={sectionId}
          content={content}
          scenario={scenario}
          mode={manualMode}
          onModeChange={setManualMode}
          onScenarioChange={setScenarioId}
        />

        <div className={cn("hidden lg:block", reduceMotion ? "" : "sticky top-0 h-svh overflow-hidden")}>
          <div className="mx-auto grid h-full max-w-[1260px] grid-rows-[auto_auto_minmax(0,1fr)] pb-4 pt-[112px] xl:pt-[116px]">
            <header className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] items-end gap-8">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  {content.eyebrow}
                </p>
                <h2 className="mt-2 max-w-[760px] text-[clamp(2rem,3.6vw,3.9rem)] font-black leading-[0.91] tracking-[-0.06em] text-foreground">
                  {content.title}
                </h2>
              </div>
              <p className="max-w-[470px] pb-1 text-sm font-medium leading-relaxed text-muted-foreground">
                {content.description}
              </p>
            </header>

            <div className="mt-3 flex items-center justify-between gap-4">
              <ModeTabs id={`${sectionId}-desktop`} mode={mode} onChange={changeDesktopMode} />
              <ScenarioTabs scenarios={content.scenarios} selectedId={scenario.id} onChange={setScenarioId} />
            </div>

            <motion.article
              id={`${sectionId}-desktop-panel`}
              role="tabpanel"
              aria-labelledby={`${sectionId}-desktop-${mode}-tab`}
              style={{ scale: sceneScale }}
              className="relative mt-3 grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[30px] border border-white/10 bg-[#09090b] p-4 text-white shadow-[0_38px_120px_-78px_rgba(0,0,0,0.95)] xl:p-5"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_51%,rgba(255,255,255,0.085),transparent_23%),linear-gradient(135deg,rgba(255,255,255,0.035),transparent_36%)]" />
              <div className="relative z-20 flex items-start justify-between gap-6 border-b border-white/8 pb-3">
                <motion.div style={{ opacity: sceneTitleOpacity }} className="min-w-0 max-w-[840px]">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/75" />
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/44">
                      {phaseLabels[phase]}
                    </p>
                  </div>
                  <h3 className="mt-2 truncate text-[clamp(1.25rem,2vw,2rem)] font-black tracking-[-0.045em]">
                    {activeTitle}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-[11px] font-medium text-white/48">
                    {activeText}
                  </p>
                </motion.div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.14em] text-white/48">
                  {scenario.label}
                </span>
              </div>

              <div
                ref={canvasRef}
                className="relative z-10 grid min-h-0 grid-cols-[minmax(0,1fr)_188px_minmax(0,1fr)] grid-rows-3 gap-x-[clamp(3rem,7vw,7.5rem)] gap-y-2 py-3 xl:grid-cols-[minmax(0,1fr)_208px_minmax(0,1fr)]"
              >
                <ConnectionLayer connections={connections} progress={storyProgress} activeIds={scenario.active} />
                {content.nodes.map((node, index) => (
                  <FlowNodeCard
                    key={node.id}
                    item={node}
                    index={index}
                    active={scenario.active.includes(node.id)}
                    progress={storyProgress}
                    nodeRef={(element) => registerNode(node.id, element)}
                  />
                ))}
                <div ref={coreRef} style={{ gridColumn: 2, gridRow: "1 / span 3" }} className="pointer-events-none invisible min-h-0" aria-hidden="true" />
                <CentralCore progress={storyProgress} />
              </div>

              <div className="relative z-20 border-t border-white/8 pt-3">
                <ScenarioSummary scenario={scenario} mode={mode} />
              </div>
              <p className="sr-only" aria-live="polite">
                {phaseLabels[phase]}. Cenário selecionado: {scenario.label}.
              </p>
            </motion.article>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
};
