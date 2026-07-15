import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  MessageCircle,
  Mic,
  Monitor,
  Network,
  UserRound,
  Video,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type ComparisonMode = "without" | "with";
type ComparisonVariant = "ecosystem" | "synapse";

type FlowItem = {
  icon: typeof CalendarDays;
  label: string;
  detail: string;
};

const ecosystemItems: FlowItem[] = [
  { icon: CalendarDays, label: "Agenda", detail: "Horários e confirmações" },
  { icon: ClipboardList, label: "Prontuário", detail: "Registros e documentos" },
  { icon: MessageCircle, label: "WhatsApp", detail: "Mensagens e lembretes" },
  { icon: Video, label: "Teleconsulta", detail: "Atendimento e continuidade" },
  { icon: CircleDollarSign, label: "Financeiro", detail: "Cobranças e recebimentos" },
  { icon: FileCheck2, label: "Fiscal", detail: "Dados e documentos fiscais" },
];

const synapseItems: FlowItem[] = [
  { icon: MessageCircle, label: "WhatsApp", detail: "Áudio, texto e solicitações" },
  { icon: Monitor, label: "Painel", detail: "Conversa e ações no sistema" },
  { icon: Mic, label: "Voz", detail: "Acesso rápido durante a rotina" },
  { icon: ClipboardList, label: "Contexto autorizado", detail: "Agenda, pacientes e registros" },
];

const copy = {
  ecosystem: {
    eyebrow: "Antes e depois",
    title: "Da rotina fragmentada a uma operação conectada.",
    description:
      "Compare o trabalho de fazer pontes entre ferramentas com uma rotina organizada pela NeuroNex.",
    withoutTitle: "Você vira a ponte entre tudo",
    withoutText:
      "Cada ferramenta guarda uma parte da rotina. Conferir, copiar, lembrar e atualizar continua dependendo de você.",
    withTitle: "A NeuroNex conecta o fluxo",
    withText:
      "Agenda, atendimento, registros, comunicação e financeiro passam a compartilhar uma linha operacional, com o Synapse apoiando o próximo passo.",
    centerWithout: "Trabalho manual",
    centerWith: "NeuroNex + Synapse",
  },
  synapse: {
    eyebrow: "Contexto contínuo",
    title: "Uma conversa que não recomeça a cada canal.",
    description:
      "Veja como painel, voz e WhatsApp podem alimentar a mesma linha de contexto autorizado.",
    withoutTitle: "Conversas isoladas perdem contexto",
    withoutText:
      "Cada canal começa do zero. Informações precisam ser repetidas e ações ficam difíceis de acompanhar.",
    withTitle: "O mesmo Synapse acompanha a rotina",
    withText:
      "O canal muda, mas a identidade, o histórico e as permissões permanecem. Ações com efeito real continuam sob confirmação.",
    centerWithout: "Contexto disperso",
    centerWith: "Synapse",
  },
} as const;

const FlowCard = ({ item, connected }: { item: FlowItem; connected: boolean }) => {
  const Icon = item.icon;

  return (
    <div
      className={cn(
        "relative flex min-h-[108px] items-start gap-3 rounded-[22px] border p-4 text-left",
        connected
          ? "border-background/12 bg-background/[0.08] dark:border-zinc-950/10 dark:bg-zinc-950/[0.045]"
          : "border-border/45 bg-card/80 dark:border-white/10 dark:bg-white/[0.035]",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]",
          connected
            ? "bg-background text-foreground dark:bg-zinc-950 dark:text-white"
            : "bg-foreground/[0.06] text-muted-foreground",
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-black tracking-[-0.025em]">{item.label}</h3>
        <p className={cn("mt-1 text-xs font-medium leading-relaxed", connected ? "opacity-60" : "text-muted-foreground/68")}>{item.detail}</p>
      </div>
    </div>
  );
};

export const PublicFlowComparison = ({ variant = "ecosystem" }: { variant?: ComparisonVariant }) => {
  const [mode, setMode] = useState<ComparisonMode>("without");
  const content = copy[variant];
  const items = variant === "ecosystem" ? ecosystemItems : synapseItems;
  const connected = mode === "with";
  const CenterIcon = connected ? (variant === "ecosystem" ? Network : BrainCircuit) : UserRound;

  return (
    <section
      id={variant === "ecosystem" ? "diferenciais" : "synapse-continuity"}
      className="relative overflow-hidden bg-background px-5 py-16 md:px-8 md:py-28"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-[160px]" />
      <div className="relative z-10 mx-auto max-w-[1240px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{content.eyebrow}</p>
          <h2 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-0.06em] text-foreground md:text-7xl">{content.title}</h2>
          <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground/70 md:text-xl">{content.description}</p>
        </div>

        <div
          role="group"
          aria-label="Escolha o cenário da comparação"
          className="mx-auto mt-10 grid max-w-[540px] grid-cols-2 rounded-[18px] border border-border/50 bg-card/80 p-1.5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]"
        >
          <button
            type="button"
            aria-pressed={mode === "without"}
            onClick={() => setMode("without")}
            className={cn(
              "min-h-11 rounded-[13px] px-4 text-[10px] font-black uppercase tracking-[0.16em] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              mode === "without" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Sem a NeuroNex
          </button>
          <button
            type="button"
            aria-pressed={mode === "with"}
            onClick={() => setMode("with")}
            className={cn(
              "min-h-11 rounded-[13px] px-4 text-[10px] font-black uppercase tracking-[0.16em] outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              mode === "with" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Com a NeuroNex
          </button>
        </div>

        <div
          aria-live="polite"
          className={cn(
            "mt-8 overflow-hidden rounded-[34px] border p-5 shadow-premium transition-colors motion-reduce:transition-none md:p-8",
            connected
              ? "border-foreground/15 bg-foreground text-background dark:bg-white dark:text-zinc-950"
              : "border-border/45 bg-card/75 dark:border-white/10 dark:bg-[#09090b]",
          )}
        >
          <div className="flex flex-col justify-between gap-4 border-b border-current/10 pb-6 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
                {connected ? <Check aria-hidden="true" className="h-4 w-4" /> : <X aria-hidden="true" className="h-4 w-4" />}
                {connected ? "Fluxo conectado" : "Fluxo fragmentado"}
              </div>
              <h3 className="mt-4 text-3xl font-black leading-[0.92] tracking-[-0.05em] md:text-5xl">
                {connected ? content.withTitle : content.withoutTitle}
              </h3>
              <p className={cn("mt-4 max-w-2xl text-sm font-medium leading-relaxed md:text-base", connected ? "opacity-62" : "text-muted-foreground/70")}>{connected ? content.withText : content.withoutText}</p>
            </div>
            <p className="shrink-0 text-[9px] font-black uppercase tracking-[0.18em] opacity-45">Selecione os cenários acima</p>
          </div>

          <div className="relative mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_170px_minmax(0,1fr)] lg:items-center">
            <div className="grid gap-3 sm:grid-cols-2">
              {items.slice(0, Math.ceil(items.length / 2)).map((item) => <FlowCard key={item.label} item={item} connected={connected} />)}
            </div>

            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <ArrowDown aria-hidden="true" className="h-5 w-5 opacity-30 lg:hidden" />
              <div className={cn("flex min-h-[148px] w-full flex-col items-center justify-center rounded-[26px] border px-5 text-center", connected ? "border-background/15 bg-background/[0.09] dark:border-zinc-950/10 dark:bg-zinc-950/[0.05]" : "border-border/50 bg-foreground/[0.045] dark:border-white/10 dark:bg-white/[0.04]") }>
                <CenterIcon aria-hidden="true" className="h-7 w-7 opacity-65" />
                <strong className="mt-4 text-sm font-black tracking-[-0.02em]">{connected ? content.centerWith : content.centerWithout}</strong>
                <span className="mt-2 text-[10px] font-semibold leading-relaxed opacity-50">
                  {connected ? "Contexto, permissões e próximos passos" : "Conferência, cópia e atualização"}
                </span>
              </div>
              <ArrowDown aria-hidden="true" className="h-5 w-5 opacity-30 lg:hidden" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {items.slice(Math.ceil(items.length / 2)).map((item) => <FlowCard key={item.label} item={item} connected={connected} />)}
            </div>

            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[30%] top-1/2 hidden -translate-y-1/2 items-center justify-between text-current opacity-20 lg:flex">
              <ArrowRight className="h-5 w-5" />
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
