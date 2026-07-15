"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bell,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Mic,
  Network,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Video,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

type ProductScene = "dashboard" | "agenda" | "teleconsulta" | "synapse";
type ComparisonMode = "without" | "with";
type ScenarioId = "appointment" | "reschedule" | "teleconsultation" | "billing";

const productScenes: ProductScene[] = ["dashboard", "agenda", "teleconsulta", "synapse"];

const sceneLabels: Record<ProductScene, string> = {
  dashboard: "Visão do dia",
  agenda: "Agenda",
  teleconsulta: "Teleconsulta",
  synapse: "Synapse em ação",
};

const scenarioCopy: Record<
  ScenarioId,
  {
    label: string;
    without: string[];
    with: string[];
    active: string[];
  }
> = {
  appointment: {
    label: "Novo agendamento",
    active: ["whatsapp", "agenda", "email", "finance", "fiscal"],
    without: [
      "Você recebe o pedido e procura um horário.",
      "Depois cria a sessão, envia a confirmação e prepara a cobrança.",
      "Mais tarde, ainda precisa conferir pagamento e nota fiscal.",
    ],
    with: [
      "Você pede o agendamento ao Synapse.",
      "Ele verifica horário, comunicação, cobrança e fiscal.",
      "Você revisa uma vez. A NeuroNex executa e acompanha o restante.",
    ],
  },
  reschedule: {
    label: "Reagendamento",
    active: ["whatsapp", "agenda", "email"],
    without: [
      "O pedido chega no WhatsApp e a agenda está em outra tela.",
      "Você procura a sessão, troca o horário e avisa o paciente.",
      "Lembretes e pendências precisam ser conferidos de novo.",
    ],
    with: [
      "O Synapse encontra a sessão certa a partir da conversa.",
      "Ele mostra horários livres e prepara a alteração.",
      "Depois da sua confirmação, agenda e comunicação são atualizadas.",
    ],
  },
  teleconsultation: {
    label: "Teleconsulta",
    active: ["portal", "agenda", "email"],
    without: [
      "Você abre a chamada e procura o histórico em outra aba.",
      "Tenta lembrar o que mudou desde a última sessão.",
      "Depois decide onde registrar cada próximo passo.",
    ],
    with: [
      "A sessão já abre ligada ao contexto autorizado do paciente.",
      "O Synapse encontra relações e leva você até a informação certa.",
      "Registros e pendências continuam no mesmo fluxo depois da chamada.",
    ],
  },
  billing: {
    label: "Cobrança",
    active: ["whatsapp", "finance", "fiscal"],
    without: [
      "Você cria a cobrança e volta para avisar o paciente.",
      "Depois consulta o pagamento em outro lugar.",
      "A emissão fiscal vira mais uma tarefa para lembrar.",
    ],
    with: [
      "O Synapse prepara a cobrança com os dados da sessão.",
      "Você confere valor, vencimento e destinatário antes do envio.",
      "Pagamento e NFS-e seguem acompanhados no mesmo percurso.",
    ],
  },
};

const sidebarItems = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "patients", label: "Pacientes", icon: Users },
  { id: "teleconsulta", label: "Teleconsulta", icon: Video },
  { id: "neuroview", label: "NeuroView", icon: Network },
  { id: "finance", label: "NeuroFinance", icon: Wallet },
];

function SceneShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative h-full min-h-0 overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.025]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_5%,rgba(255,255,255,0.07),transparent_36%)]" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function DashboardScene() {
  return (
    <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-3 p-4">
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Sessões hoje", "6", "2 confirmadas agora"],
            ["Recebido no mês", "R$ 8.420", "+12% sobre junho"],
            ["Precisa de você", "3", "uma cobrança vencida"],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-[18px] border border-white/[0.07] bg-white/[0.035] p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/36">{label}</p>
              <strong className="mt-3 block text-xl tracking-[-0.04em] text-white">{value}</strong>
              <span className="mt-1 block text-[9px] font-medium text-white/42">{detail}</span>
            </div>
          ))}
        </div>
        <SceneShell>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.17em] text-white/36">Próximas sessões</p>
              <h3 className="mt-1 text-base font-black text-white">Sua tarde, já organizada</h3>
            </div>
            <CalendarDays className="h-4 w-4 text-white/42" />
          </div>
          <div className="space-y-2 p-3">
            {[
              ["13:30", "Mariana Silva", "Teleconsulta", "Confirmada"],
              ["15:00", "Carlos Rocha", "Presencial", "Aguardando"],
              ["16:20", "Ana Martins", "Teleconsulta", "Confirmada"],
            ].map(([time, name, type, status], index) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-[15px] border border-white/[0.06] bg-white/[0.025] px-3 py-3"
              >
                <span className="text-xs font-black text-white/72">{time}</span>
                <div>
                  <p className="text-xs font-bold text-white/88">{name}</p>
                  <p className="mt-0.5 text-[9px] font-medium text-white/38">{type}</p>
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.12em]", status === "Confirmada" ? "bg-white text-black" : "border border-white/10 text-white/48")}>{status}</span>
              </motion.div>
            ))}
          </div>
        </SceneShell>
      </div>
      <SceneShell className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.17em] text-white/36">Briefing do Synapse</p>
            <h3 className="mt-2 text-lg font-black leading-tight tracking-[-0.04em] text-white">O que merece sua atenção hoje.</h3>
          </div>
          <Sparkles className="h-5 w-5 text-white/72" />
        </div>
        <div className="mt-5 space-y-2.5">
          {[
            [Clock3, "Teleconsulta em 10 minutos", "O contexto da Mariana já está pronto."],
            [CircleDollarSign, "Uma cobrança venceu ontem", "Posso preparar uma mensagem antes do envio."],
            [FileCheck2, "Duas notas aguardam pagamento", "A emissão começa quando cada pagamento for confirmado."],
          ].map(([Icon, title, detail], index) => {
            const ItemIcon = Icon as typeof Clock3;
            return (
              <motion.div key={title as string} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + index * 0.09 }} className="rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-3.5">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white/[0.06]"><ItemIcon className="h-3.5 w-3.5 text-white/68" /></div>
                  <div>
                    <p className="text-[11px] font-bold text-white/86">{title as string}</p>
                    <p className="mt-1 text-[9px] font-medium leading-relaxed text-white/40">{detail as string}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SceneShell>
    </div>
  );
}

function AgendaScene() {
  const appointments = [
    [1, 1, "Mariana", "09:00"],
    [2, 2, "Carlos", "11:00"],
    [3, 1, "Ana", "14:00"],
    [4, 3, "Bruno", "15:30"],
    [5, 2, "Luiza", "17:00"],
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.17em] text-white/36">Agenda NeuroNex</p>
          <h3 className="mt-1 text-lg font-black text-white">Semana de 20 a 24 de julho</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-white/48">
          <CheckCircle2 className="h-3.5 w-3.5" /> Google sincronizado
        </div>
      </div>
      <SceneShell className="min-h-0 flex-1 p-3">
        <div className="grid h-full grid-cols-5 gap-2">
          {["Seg", "Ter", "Qua", "Qui", "Sex"].map((day, dayIndex) => (
            <div key={day} className="relative rounded-[16px] border border-white/[0.055] bg-white/[0.018] p-2.5">
              <div className="border-b border-white/[0.055] pb-2 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/36">{day}</p>
                <strong className="mt-1 block text-sm text-white/72">{20 + dayIndex}</strong>
              </div>
              <div className="mt-2 space-y-2">
                {appointments.filter(([column]) => column === dayIndex + 1).map(([, row, name, time]) => (
                  <motion.div key={name} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: dayIndex * 0.08 }} className={cn("rounded-[13px] border px-2.5 py-2.5", row === 2 ? "border-white/24 bg-white text-black" : "border-white/[0.07] bg-white/[0.035]") }>
                    <p className={cn("text-[9px] font-black", row === 2 ? "text-black" : "text-white/84")}>{time}</p>
                    <p className={cn("mt-1 truncate text-[9px] font-medium", row === 2 ? "text-black/55" : "text-white/42")}>{name}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SceneShell>
    </div>
  );
}

function TeleconsultaScene() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[1.35fr_0.65fr] gap-3 p-4">
      <SceneShell className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_46%_38%,rgba(255,255,255,0.18),transparent_20%),linear-gradient(135deg,#17171b,#050506_68%)]" />
        <div className="absolute left-[12%] top-[14%] h-[58%] w-[76%] rounded-[34px] border border-white/[0.08] bg-white/[0.025] shadow-[0_34px_90px_-44px_rgba(0,0,0,0.95)]">
          <div className="absolute left-1/2 top-[42%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.04]">
            <UserRound className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 text-white/32" />
          </div>
          <div className="absolute bottom-5 left-5">
            <p className="text-sm font-black text-white">Mariana Silva</p>
            <p className="mt-1 text-[9px] font-medium text-white/42">Sala pronta · começa em 10 minutos</p>
          </div>
        </div>
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/[0.08] bg-black/45 p-2 backdrop-blur-xl">
          {[Mic, Video, MessageCircle].map((Icon, index) => <div key={index} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08]"><Icon className="h-3.5 w-3.5 text-white/66" /></div>)}
        </div>
      </SceneShell>
      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
        <SceneShell className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]"><UserRound className="h-4 w-4 text-white/64" /></div>
            <div>
              <p className="text-xs font-black text-white">Mariana Silva</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.13em] text-white/34">Acompanhamento · 8ª sessão</p>
            </div>
          </div>
        </SceneShell>
        <SceneShell className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-black uppercase tracking-[0.17em] text-white/36">Contexto para revisar</p>
            <BrainCircuit className="h-4 w-4 text-white/56" />
          </div>
          <div className="mt-4 space-y-2">
            {["Trabalho apareceu em 4 registros recentes", "Sono mudou depois da última sessão", "Há uma mensagem no Portal para revisar"].map((text, index) => (
              <motion.div key={text} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex gap-2 rounded-[13px] border border-white/[0.06] bg-white/[0.025] p-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/56" />
                <p className="text-[9px] font-medium leading-relaxed text-white/52">{text}</p>
              </motion.div>
            ))}
          </div>
        </SceneShell>
      </div>
    </div>
  );
}

const graphNodes = [
  { id: "patient", label: "Mariana", x: 48, y: 48, size: 62, primary: true },
  { id: "work", label: "Trabalho", x: 24, y: 26, size: 42 },
  { id: "sleep", label: "Sono", x: 72, y: 25, size: 42 },
  { id: "anticipation", label: "Antecipação", x: 77, y: 62, size: 46 },
  { id: "family", label: "Família", x: 25, y: 69, size: 40 },
  { id: "portal", label: "Portal", x: 51, y: 81, size: 38 },
];

function NeuroViewScene({ step }: { step: number }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_290px] gap-3 p-4">
      <SceneShell className="relative">
        <div className="absolute left-5 top-5 z-20 flex h-9 w-[210px] items-center gap-2 rounded-[13px] border border-white/[0.08] bg-black/28 px-3 backdrop-blur-xl">
          <Search className="h-3.5 w-3.5 text-white/34" />
          <span className="text-[9px] font-medium text-white/38">Mariana Silva</span>
        </div>
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {graphNodes.slice(1).map((node, index) => (
            <motion.line
              key={node.id}
              x1="48"
              y1="48"
              x2={node.x}
              y2={node.y}
              stroke="rgba(255,255,255,.34)"
              strokeWidth={step >= 3 && ["work", "sleep", "anticipation"].includes(node.id) ? 0.7 : 0.32}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: step >= 2 ? 1 : 0.45 }}
              transition={{ delay: index * 0.08, duration: 0.8 }}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {graphNodes.map((node, index) => {
          const highlighted = step >= 3 && ["patient", "work", "sleep", "anticipation"].includes(node.id);
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: highlighted ? 1.08 : 1 }}
              transition={{ delay: index * 0.08, type: "spring", stiffness: 130, damping: 18 }}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%`, width: node.size, height: node.size }}
            >
              {highlighted ? <motion.span className="absolute -inset-2 rounded-full border border-white/18" animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.08, 0.35] }} transition={{ duration: 2.2, repeat: Infinity }} /> : null}
              <div className={cn("flex h-full w-full items-center justify-center rounded-full border text-center shadow-[0_18px_44px_-24px_rgba(0,0,0,0.95)]", node.primary ? "border-white/35 bg-white text-black" : highlighted ? "border-white/24 bg-white/[0.12] text-white" : "border-white/[0.09] bg-white/[0.045] text-white/58") }>
                <span className="px-1 text-[8px] font-black leading-tight">{node.label}</span>
              </div>
            </motion.div>
          );
        })}
        <div className="absolute bottom-5 left-5 rounded-full border border-white/[0.07] bg-black/24 px-3 py-2 text-[8px] font-bold text-white/36 backdrop-blur-xl">Relações do histórico autorizado</div>
      </SceneShell>
      <SceneShell className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.17em] text-white/36">Antes da sessão</p>
            <h3 className="mt-2 text-lg font-black leading-tight tracking-[-0.04em] text-white">Mariana entra em 10 minutos.</h3>
          </div>
          <Clock3 className="h-4 w-4 text-white/54" />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5">
            {step < 2 ? (
              <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="text-[10px] font-medium leading-relaxed text-white/48">O Synapse está abrindo o NeuroView e reunindo o contexto permitido para esta sessão.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {["Trabalho voltou a aparecer antes de momentos de ansiedade.", "Mudanças no sono foram registradas nas últimas semanas.", "Uma mensagem recente no Portal ainda não foi revisada."].map((text, index) => (
                  <motion.div key={text} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + index * 0.09 }} className="rounded-[15px] border border-white/[0.07] bg-white/[0.03] p-3.5">
                    <div className="flex gap-2.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/66" />
                      <p className="text-[9px] font-medium leading-relaxed text-white/52">{text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-5 bottom-5 rounded-[15px] border border-white/[0.08] bg-white/[0.035] p-3">
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/32">Controle preservado</p>
          <p className="mt-1.5 text-[9px] font-medium leading-relaxed text-white/48">O Synapse encontra e destaca. A leitura clínica continua sendo sua.</p>
        </div>
      </SceneShell>
    </div>
  );
}

function SynapseVoicePill({ active, step }: { active: boolean; step: number }) {
  const status = step === 0 ? "Ouvindo" : step === 1 ? "Entendendo o pedido" : step === 2 ? "Abrindo o NeuroView" : "Relações destacadas";

  return (
    <motion.div
      layout
      className={cn(
        "absolute bottom-5 left-1/2 z-40 -translate-x-1/2 overflow-hidden rounded-full border backdrop-blur-2xl",
        active ? "w-[min(640px,78%)] border-white/18 bg-black/76 shadow-[0_26px_90px_-32px_rgba(0,0,0,0.98)]" : "w-[250px] border-white/[0.08] bg-black/58",
      )}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex min-h-14 items-center gap-3 px-4">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
          <Mic className="h-4 w-4" />
          {active ? <motion.span className="absolute -inset-1 rounded-full border border-white/40" animate={{ scale: [1, 1.35], opacity: [0.5, 0] }} transition={{ duration: 1.4, repeat: Infinity }} /> : null}
        </div>
        {active ? (
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.p key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="truncate text-[11px] font-bold text-white/88">
                {step === 0 ? "“Mostre o NeuroView da Mariana.”" : step === 1 ? "Encontrei a paciente e a sessão das 13:30." : step === 2 ? "Abrindo o NeuroView e destacando relações..." : "Pronto. A sessão começa em 10 minutos."}
              </motion.p>
            </AnimatePresence>
            <p aria-live="polite" className="mt-1 text-[7px] font-black uppercase tracking-[0.15em] text-white/34">{status}</p>
          </div>
        ) : <p className="flex-1 text-[10px] font-bold text-white/42">Fale com o Synapse</p>}
        <div className="flex h-7 items-center gap-[3px] px-2">
          {[8, 15, 23, 12, 20, 10, 17].map((height, index) => (
            <motion.span key={index} className="w-[2px] rounded-full bg-white/58" animate={active ? { height: [4, height, 5] } : { height: 4 }} transition={{ duration: 0.65 + index * 0.06, repeat: active ? Infinity : 0, repeatType: "mirror" }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ProductFilm({ scene, onSceneChange }: { scene: ProductScene; onSceneChange: (scene: ProductScene) => void }) {
  const [synapseStep, setSynapseStep] = useState(0);
  const isSynapse = scene === "synapse";

  useEffect(() => {
    if (!isSynapse) {
      setSynapseStep(0);
      return;
    }

    setSynapseStep(0);
    const timers = [
      window.setTimeout(() => setSynapseStep(1), 950),
      window.setTimeout(() => setSynapseStep(2), 2100),
      window.setTimeout(() => setSynapseStep(3), 3450),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [isSynapse]);

  const activeSidebar = isSynapse && synapseStep >= 2 ? "neuroview" : scene === "dashboard" ? "dashboard" : scene;

  return (
    <div className="relative h-full overflow-hidden rounded-[30px] border border-white/[0.1] bg-[#070709] shadow-[0_70px_180px_-80px_rgba(0,0,0,1)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_-10%,rgba(255,255,255,0.11),transparent_32%)]" />
      <div className="grid h-full grid-cols-[152px_1fr]">
        <aside className="relative z-10 border-r border-white/[0.055] bg-black/18 p-3">
          <div className="flex items-center gap-2 px-2 py-2">
            <Logo className="h-5 w-5 text-white" />
            <span className="text-[9px] font-black uppercase tracking-[0.28em] text-white/82">NeuroNex</span>
          </div>
          <div className="mt-5 space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const selected = activeSidebar === item.id;
              return (
                <motion.div key={item.id} animate={{ backgroundColor: selected ? "rgba(255,255,255,.1)" : "rgba(255,255,255,0)" }} className={cn("flex h-9 items-center gap-2.5 rounded-[12px] px-2.5 text-[8px] font-black uppercase tracking-[0.11em]", selected ? "text-white" : "text-white/28") }>
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {selected ? <motion.span layoutId="landing-sidebar-active" className="ml-auto h-1.5 w-1.5 rounded-full bg-white" /> : null}
                </motion.div>
              );
            })}
          </div>
          <div className="absolute inset-x-3 bottom-4 rounded-[15px] border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[8px] font-black text-black">JS</div>
              <div>
                <p className="text-[8px] font-bold text-white/72">José Silva</p>
                <p className="mt-0.5 text-[7px] font-medium text-white/28">Psicólogo</p>
              </div>
            </div>
          </div>
        </aside>
        <div className="relative z-10 grid min-w-0 grid-rows-[54px_1fr]">
          <header className="flex items-center justify-between border-b border-white/[0.055] px-5">
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.18em] text-white/28">NeuroNex Desktop</p>
              <AnimatePresence mode="wait"><motion.p key={activeSidebar} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-0.5 text-[11px] font-black text-white/82">{activeSidebar === "neuroview" ? "NeuroView · Mariana Silva" : sceneLabels[scene]}</motion.p></AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 text-[8px] font-bold text-white/38"><Search className="h-3 w-3" /> Buscar</div>
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025]"><Bell className="h-3.5 w-3.5 text-white/46" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white" /></div>
            </div>
          </header>
          <div className="relative min-h-0 overflow-hidden p-1.5">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={isSynapse && synapseStep >= 2 ? "neuroview" : scene} initial={{ opacity: 0, scale: 0.985, filter: "blur(9px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 1.012, filter: "blur(8px)" }} transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }} className="h-full">
                {scene === "dashboard" ? <DashboardScene /> : null}
                {scene === "agenda" ? <AgendaScene /> : null}
                {scene === "teleconsulta" ? <TeleconsultaScene /> : null}
                {isSynapse ? (synapseStep >= 2 ? <NeuroViewScene step={synapseStep} /> : <TeleconsultaScene />) : null}
              </motion.div>
            </AnimatePresence>
            <SynapseVoicePill active={isSynapse} step={synapseStep} />
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 z-50 flex gap-1.5 rounded-full border border-white/[0.07] bg-black/45 p-1.5 backdrop-blur-xl">
        {productScenes.map((item) => <button key={item} type="button" aria-label={`Mostrar ${sceneLabels[item]}`} onClick={() => onSceneChange(item)} className={cn("h-1.5 rounded-full transition-all duration-500", scene === item ? "w-7 bg-white" : "w-1.5 bg-white/24 hover:bg-white/48") } />)}
      </div>
    </div>
  );
}

const leftFlowItems = [
  { id: "whatsapp", label: "WhatsApp", detail: "pedidos e áudios", icon: MessageCircle },
  { id: "agenda", label: "Agenda", detail: "sessões e horários", icon: CalendarDays },
  { id: "portal", label: "Portal", detail: "informações do paciente", icon: UserRound },
];

const rightFlowItems = [
  { id: "email", label: "Comunicação", detail: "confirmações e lembretes", icon: Mail },
  { id: "finance", label: "NeuroFinance", detail: "cobrança e pagamento", icon: CircleDollarSign },
  { id: "fiscal", label: "Fiscal", detail: "emissão de NFS-e", icon: ReceiptText },
];

function CompactFlowCard({ item, active, connected }: { item: (typeof leftFlowItems)[number]; active: boolean; connected: boolean }) {
  const Icon = item.icon;
  return (
    <motion.div layout className={cn("relative z-10 flex min-h-[78px] items-center gap-3 rounded-[18px] border px-3.5 py-3", connected ? "border-white/[0.11] bg-white/[0.045]" : "border-white/[0.07] bg-white/[0.025]", active ? "opacity-100" : "opacity-30") } animate={{ scale: active ? 1 : 0.96 }}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border", connected && active ? "border-white/20 bg-white text-black" : "border-white/[0.08] bg-white/[0.035] text-white/52") }><Icon className="h-4 w-4" /></div>
      <div>
        <p className="text-[10px] font-black text-white/86">{item.label}</p>
        <p className="mt-1 text-[8px] font-medium text-white/36">{item.detail}</p>
      </div>
    </motion.div>
  );
}

function FlowLines({ connected }: { connected: boolean }) {
  const paths = [
    "M170 58 C310 58 340 170 478 170",
    "M170 170 C320 170 350 170 478 170",
    "M170 282 C310 282 340 170 478 170",
    "M522 170 C660 170 690 58 830 58",
    "M522 170 C650 170 680 170 830 170",
    "M522 170 C660 170 690 282 830 282",
  ];

  return (
    <svg aria-hidden="true" viewBox="0 0 1000 340" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="cinematic-flow-gradient" x1="0" x2="1"><stop offset="0" stopColor="white" stopOpacity=".12" /><stop offset=".5" stopColor="white" stopOpacity={connected ? ".7" : ".22"} /><stop offset="1" stopColor="white" stopOpacity=".12" /></linearGradient>
      </defs>
      {paths.map((path, index) => (
        <motion.path key={`${connected}-${index}`} d={path} fill="none" stroke="url(#cinematic-flow-gradient)" strokeWidth={connected ? 1.5 : 1} strokeDasharray={connected ? "0" : "5 9"} initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.78, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }} />
      ))}
      {connected ? paths.map((path, index) => <motion.circle key={`pulse-${index}`} r="3" fill="white"><animateMotion dur={`${2.4 + index * 0.16}s`} repeatCount="indefinite" path={path} /></motion.circle>) : null}
    </svg>
  );
}

function CompactComparison({ mode, setMode }: { mode: ComparisonMode; setMode: (mode: ComparisonMode) => void }) {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("appointment");
  const scenario = scenarioCopy[scenarioId];
  const connected = mode === "with";

  return (
    <div className="mx-auto flex h-full w-full max-w-[1180px] flex-col justify-center px-5 pb-8 pt-24 md:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/34">O que muda na prática</p>
        <h2 className="mt-4 text-[clamp(2.25rem,4.3vw,4.7rem)] font-black leading-[0.92] tracking-[-0.062em] text-white">
          O mesmo trabalho. <span className="text-white/38">Outro jeito de fazer.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-relaxed text-white/46 md:text-base">Sem a NeuroNex, você transporta informação entre ferramentas. Com ela, o Synapse conecta o fluxo e espera sua confirmação antes de agir.</p>
      </div>

      <div className="mx-auto mt-6 grid w-full max-w-[660px] grid-cols-2 rounded-[18px] border border-white/[0.08] bg-white/[0.025] p-1.5">
        {(["without", "with"] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={cn("h-11 rounded-[13px] text-[9px] font-black uppercase tracking-[0.16em] transition-all duration-500", mode === item ? "bg-white text-black" : "text-white/38 hover:text-white/72")}>{item === "without" ? "Sem a NeuroNex" : "Com a NeuroNex"}</button>)}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {(Object.keys(scenarioCopy) as ScenarioId[]).map((id) => <button key={id} type="button" onClick={() => setScenarioId(id)} className={cn("rounded-full border px-3 py-2 text-[7px] font-black uppercase tracking-[0.13em] transition-colors", scenarioId === id ? "border-white/28 bg-white/[0.09] text-white" : "border-white/[0.07] text-white/28 hover:text-white/58")}>{scenarioCopy[id].label}</button>)}
      </div>

      <motion.div layout className="relative mx-auto mt-4 h-[340px] w-full max-w-[1000px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#08080a] p-4 shadow-[0_42px_130px_-72px_rgba(0,0,0,1)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08),transparent_28%)]" />
        <FlowLines connected={connected} />
        <div className="relative z-10 grid h-full grid-cols-[1fr_180px_1fr] gap-7">
          <div className="grid content-center gap-2.5">{leftFlowItems.map((item) => <CompactFlowCard key={item.id} item={item} connected={connected} active={scenario.active.includes(item.id)} />)}</div>
          <div className="flex items-center justify-center">
            <motion.div layout animate={{ scale: connected ? 1.05 : 0.96 }} className={cn("relative flex h-[176px] w-[160px] flex-col items-center justify-center rounded-[30px] border px-4 text-center", connected ? "border-white/24 bg-white/[0.1] shadow-[0_28px_80px_-46px_rgba(255,255,255,.55)]" : "border-white/[0.09] bg-white/[0.03]") }>
              {connected ? <BrainCircuit className="h-8 w-8 text-white" /> : <UserRound className="h-8 w-8 text-white/42" />}
              <strong className="mt-4 text-lg font-black text-white">{connected ? "Synapse" : "Você"}</strong>
              <span className="mt-2 text-[8px] font-medium leading-relaxed text-white/38">{connected ? "entende o contexto, prepara e acompanha" : "procura, copia, confere e lembra"}</span>
              {connected ? <motion.span className="absolute -inset-2 rounded-[36px] border border-white/[0.08]" animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.08, 0.3] }} transition={{ duration: 2.4, repeat: Infinity }} /> : null}
            </motion.div>
          </div>
          <div className="grid content-center gap-2.5">{rightFlowItems.map((item) => <CompactFlowCard key={item.id} item={item} connected={connected} active={scenario.active.includes(item.id)} />)}</div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${scenarioId}-${mode}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mx-auto mt-3 grid w-full max-w-[1000px] grid-cols-3 gap-2">
          {(connected ? scenario.with : scenario.without).map((step, index) => <div key={step} className="flex min-h-[58px] items-start gap-2.5 rounded-[15px] border border-white/[0.07] bg-white/[0.025] px-3 py-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-[7px] font-black text-white/42">{index + 1}</span><p className="text-[8px] font-medium leading-relaxed text-white/46">{step}</p></div>)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StaticIntro() {
  const [scene, setScene] = useState<ProductScene>("dashboard");
  const [mode, setMode] = useState<ComparisonMode>("without");
  return (
    <section id="diferenciais" className="bg-[#050506] text-white">
      <div className="flex min-h-screen flex-col items-center justify-center px-5 pb-16 pt-32 text-center">
        <p className="rounded-full border border-white/[0.07] bg-white/[0.025] px-5 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/52">Sistema operacional para psicólogos</p>
        <h1 className="mt-7 text-[clamp(2.6rem,6vw,5.8rem)] font-black leading-[0.92] tracking-[-0.065em]">Você não deveria conectar tudo sozinho.<br />A NeuroNex faz tudo trabalhar junto.</h1>
        <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-white/48">Agenda, pacientes, atendimentos, mensagens, cobranças e notas fiscais no mesmo fluxo — com o Synapse executando o que você autorizar.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild className="h-12 rounded-full bg-white px-7 text-[9px] font-black uppercase tracking-[0.16em] text-black"><Link to="/create-account">Começar grátis <ChevronRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-12 rounded-full border-white/10 bg-transparent px-7 text-[9px] font-black uppercase tracking-[0.16em] text-white"><Link to="/synapse">Ver o Synapse em ação</Link></Button></div>
        <div className="mt-12 aspect-[16/9] w-full max-w-[1120px]"><ProductFilm scene={scene} onSceneChange={setScene} /></div>
      </div>
      <div className="min-h-screen"><CompactComparison mode={mode} setMode={setMode} /></div>
    </section>
  );
}

export function CinematicLandingIntro() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [autoSceneIndex, setAutoSceneIndex] = useState(0);
  const [scrollScene, setScrollScene] = useState<ProductScene | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("without");
  const [manualScene, setManualScene] = useState<ProductScene | null>(null);

  const heroOpacity = useTransform(scrollYProgress, [0, 0.11, 0.205], [1, 1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.205], [0, -110]);
  const heroScale = useTransform(scrollYProgress, [0, 0.205], [1, 0.92]);
  const filmOpacity = useTransform(scrollYProgress, [0, 0.065, 0.18, 0.72, 0.79], [0.12, 0.45, 1, 1, 0]);
  const filmScale = useTransform(scrollYProgress, [0, 0.18, 0.53, 0.72], [0.72, 0.86, 1, 0.76]);
  const filmY = useTransform(scrollYProgress, [0, 0.17, 0.52, 0.72], [330, 105, 0, -34]);
  const filmRotateX = useTransform(scrollYProgress, [0, 0.23], [9, 0]);
  const filmRadius = useTransform(scrollYProgress, [0.18, 0.55], [38, 24]);
  const comparisonOpacity = useTransform(scrollYProgress, [0.72, 0.805, 1], [0, 1, 1]);
  const comparisonScale = useTransform(scrollYProgress, [0.72, 0.84], [0.91, 1]);
  const comparisonY = useTransform(scrollYProgress, [0.72, 0.84], [70, 0]);

  useEffect(() => {
    const duration = productScenes[autoSceneIndex] === "synapse" ? 8200 : 4600;
    const timer = window.setTimeout(() => setAutoSceneIndex((current) => (current + 1) % productScenes.length), duration);
    return () => window.clearTimeout(timer);
  }, [autoSceneIndex]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    if (value < 0.17) setScrollScene(null);
    else if (value < 0.31) setScrollScene("dashboard");
    else if (value < 0.43) setScrollScene("agenda");
    else if (value < 0.56) setScrollScene("teleconsulta");
    else setScrollScene("synapse");

    if (value > 0.885) setComparisonMode("with");
    else if (value > 0.73) setComparisonMode("without");
  });

  const activeScene = manualScene ?? scrollScene ?? productScenes[autoSceneIndex];
  const productLabel = useMemo(() => sceneLabels[activeScene], [activeScene]);

  if (reduceMotion) return <StaticIntro />;

  return (
    <section ref={sectionRef} id="diferenciais" className="relative h-[475vh] bg-[#050506] text-white">
      <div id="produto" className="pointer-events-none absolute top-[24%]" aria-hidden="true" />
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.065),transparent_32%),linear-gradient(#08080a,#050506)]" />
        <motion.div style={{ opacity: heroOpacity, y: heroY, scale: heroScale }} className="absolute inset-x-0 top-0 z-20 flex h-[56vh] flex-col items-center justify-center px-5 pt-24 text-center will-change-transform">
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="rounded-full border border-white/[0.07] bg-white/[0.025] px-5 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/52">Sistema operacional para psicólogos</motion.p>
          <h1 className="mt-7 font-black leading-[0.91] tracking-[-0.065em] text-white">
            <span className="block text-[clamp(2.55rem,4.8vw,5.2rem)] md:whitespace-nowrap">Você não deveria conectar tudo sozinho.</span>
            <span className="mt-1.5 block text-[clamp(2.35rem,4.45vw,4.8rem)] text-white/48 md:whitespace-nowrap">A NeuroNex faz tudo trabalhar junto.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-sm font-medium leading-relaxed text-white/46 md:text-lg">Agenda, pacientes, atendimentos, mensagens, cobranças e notas fiscais no mesmo fluxo — com o Synapse executando o que você autorizar.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-12 rounded-full bg-white px-7 text-[9px] font-black uppercase tracking-[0.16em] text-black hover:bg-white/90"><Link to="/create-account">Começar grátis <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" className="h-12 rounded-full border-white/10 bg-white/[0.015] px-7 text-[9px] font-black uppercase tracking-[0.16em] text-white hover:bg-white/[0.06]"><Link to="/synapse">Ver o Synapse em ação <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button>
          </div>
        </motion.div>

        <motion.div style={{ opacity: filmOpacity, y: filmY, scale: filmScale, rotateX: filmRotateX, borderRadius: filmRadius }} className="absolute left-1/2 top-1/2 z-30 aspect-[16/9] w-[min(1120px,88vw)] -translate-x-1/2 -translate-y-1/2 origin-center overflow-hidden will-change-transform [perspective:1600px]">
          <ProductFilm scene={activeScene} onSceneChange={(scene) => { setManualScene(scene); setAutoSceneIndex(productScenes.indexOf(scene)); }} />
          <div className="pointer-events-none absolute -bottom-11 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-[0.17em] text-white/28">{productLabel} · continue rolando</div>
        </motion.div>

        <motion.div style={{ opacity: comparisonOpacity, scale: comparisonScale, y: comparisonY }} className="absolute inset-0 z-40 will-change-transform">
          <CompactComparison mode={comparisonMode} setMode={setComparisonMode} />
        </motion.div>

        <div className="absolute bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/[0.06] bg-black/28 px-3 py-2 text-[7px] font-black uppercase tracking-[0.15em] text-white/28 backdrop-blur-xl">
          <Activity className="h-3 w-3" /> A experiência acompanha o seu scroll
        </div>
      </div>
    </section>
  );
}
