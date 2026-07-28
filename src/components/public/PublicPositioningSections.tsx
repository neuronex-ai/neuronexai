"use client";

import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FlaskConical,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from "lucide-react";
import type { ElementType } from "react";
import { Link } from "react-router-dom";

import {
  ILLUSTRATIVE_WORKFLOW,
  SYNAPSE_COMMAND_EXAMPLES,
  TIME_GAIN_DISCLOSURE,
  TIME_GAIN_ESTIMATES,
  type SynapseCommandExample,
} from "@/content/public-positioning";
import { cn } from "@/lib/utils";

const statusIcons: Record<SynapseCommandExample["status"], ElementType<{ className?: string }>> = {
  Disponível: CheckCircle2,
  Beta: FlaskConical,
  "Em evolução": CircleDashed,
};

const synapseChannels = [
  {
    icon: LayoutDashboard,
    title: "Trabalhe pelo sistema.",
  },
  {
    icon: Smartphone,
    title: "Continue pelo celular.",
  },
  {
    icon: MessageCircle,
    title: "Peça pelo WhatsApp.",
  },
];

const synapseStarterQuestions = [
  "Tenho algum paciente sem confirmação para amanhã?",
  "Crie um lembrete para eu finalizar o documento da Júlia.",
  "Qual foi a última cobrança enviada para o Carlos?",
  "Prepare um agendamento para sexta-feira às 10h.",
];

const operatingPrinciples = [
  {
    title: "Um contexto, não várias ilhas",
    text: "Agenda, paciente, atendimento, prontuário e financeiro preservam a continuidade da rotina.",
  },
  {
    title: "Menos energia para operar",
    text: "Hierarquia clara, cores com função e estados previsíveis reduzem a necessidade de estudar a interface.",
  },
  {
    title: "IA com consequência visível",
    text: "O Synapse consulta e navega; quando prepara uma mudança, mostra o que depende da sua confirmação.",
  },
];

export const PublicOperatingModelBridge = ({ className }: { className?: string }) => (
  <section
    aria-labelledby="public-operating-model-title"
    className={cn(
      "public-section-stage public-solid-subtle px-5 py-20 md:px-8 md:py-24",
      className,
    )}
  >
    <div className="mx-auto max-w-[1180px] text-center">
      <div className="mx-auto max-w-5xl">
        <LayoutDashboard aria-hidden="true" className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-7 text-xs font-bold text-muted-foreground">
          Sistema operacional para psicólogos
        </p>
        <h2
          id="public-operating-model-title"
          className="mx-auto mt-6 max-w-[20ch] text-balance text-4xl font-black leading-[1.02] md:text-6xl"
        >
          Mais recursos não deveriam significar mais sistema para administrar.
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-lg">
          Quando cada função exige um novo menu, uma nova regra e mais copiar e colar,
          “completo” vira carga mental. A NeuroNex foi desenhada como o sistema
          operacional do consultório: os produtos compartilham contexto e o Synapse
          ajuda a conduzir o fluxo sem esconder limites ou decisões.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-[1080px] gap-4 md:grid-cols-3">
        {operatingPrinciples.map((principle) => (
          <article
            key={principle.title}
            className="rounded-[26px] border border-border bg-card p-6 text-center"
          >
            <h3 className="text-xl font-black leading-tight">{principle.title}</h3>
            <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
              {principle.text}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export function PublicWorkflowComparisonSection({
  competitor,
  className,
}: {
  competitor?: string;
  className?: string;
}) {
  const scopeDisclosure = competitor
    ? `Ele é ilustrativo e não descreve nem mede o funcionamento do ${competitor}.`
    : "Ele é ilustrativo e não descreve nem mede o funcionamento de um concorrente específico.";

  return (
    <section
      aria-labelledby="workflow-story-title"
      className={cn(
        "public-section-stage public-solid-subtle px-5 py-20 md:px-8 md:py-24",
        className,
      )}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <Clock3 aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
            <p className="mt-7 text-xs font-bold text-muted-foreground">
              Terça-feira do Dr. Lucas
            </p>
          </div>
          <div>
            <h2
              id="workflow-story-title"
              className="max-w-[20ch] text-balance text-4xl font-black leading-[1.02] md:text-6xl"
            >
              IA textual responde. Uma operação agêntica conecta o próximo passo.
            </h2>
            <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-lg">
              O cenário abaixo compara um fluxo manual ou apoiado por IA textual com
              o modelo operacional governado da NeuroNex. {scopeDisclosure}
            </p>
          </div>
        </div>

        <div
          role="region"
          aria-label="Comparação da rotina ilustrativa do Dr. Lucas"
          tabIndex={0}
          className="mt-12 overflow-x-auto rounded-[28px] border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <table className="w-full min-w-[820px] border-collapse text-left">
            <caption className="sr-only">
              Rotina ilustrativa do Dr. Lucas em um fluxo manual ou de IA textual e na NeuroNex
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-32 p-5 text-sm font-black">Horário</th>
                <th scope="col" className="p-5 text-sm font-black">Fluxo manual ou IA textual</th>
                <th scope="col" className="p-5 text-sm font-black">NeuroNex · IA operacional governada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ILLUSTRATIVE_WORKFLOW.map((moment) => (
                <tr key={moment.time}>
                  <th scope="row" className="p-5 align-top">
                    <span className="block text-lg font-black">{moment.time}</span>
                    <span className="mt-1 block text-xs font-semibold text-muted-foreground">{moment.title}</span>
                  </th>
                  <td className="p-5 align-top text-sm font-medium leading-relaxed text-muted-foreground">
                    {moment.manualFlow}
                  </td>
                  <td className="border-l border-border p-5 align-top text-sm font-semibold leading-relaxed">
                    {moment.neuroNexFlow}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 max-w-3xl text-sm font-medium leading-relaxed text-muted-foreground">
          Uma IA agêntica deve reduzir etapas sem apagar autoria: consultas podem ser
          diretas; registros, comunicações e dinheiro seguem revisão, elegibilidade e confirmação.
        </p>
      </div>
    </section>
  );
}

export const PublicTimeGainSection = ({ className }: { className?: string }) => (
  <section
    aria-labelledby="time-gain-title"
    className={cn(
      "public-section-stage bg-background px-5 py-20 md:px-8 md:py-24",
      className,
    )}
  >
    <div className="mx-auto max-w-[1180px]">
      <div className="max-w-4xl">
        <p className="text-xs font-bold text-muted-foreground">Cenário hipotético de tempo</p>
        <h2 id="time-gain-title" className="mt-4 text-balance text-4xl font-black leading-[1.02] md:text-6xl">
          Simule o que muda se você recuperar minutos de tarefas repetitivas.
        </h2>
        <p className="mt-6 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-lg">
          {TIME_GAIN_DISCLOSURE}
        </p>
      </div>

      <div
        role="region"
        aria-label="Projeção do cenário hipotético de tempo"
        tabIndex={0}
        className="mt-12 overflow-x-auto rounded-[28px] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Projeção hipotética de tempo a partir de uma premissa escolhida</caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="w-44 p-5 text-sm font-black">Período</th>
              <th scope="col" className="w-72 p-5 text-sm font-black">Entrada do cenário</th>
              <th scope="col" className="p-5 text-sm font-black">Como interpretar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TIME_GAIN_ESTIMATES.map((row) => (
              <tr key={row.period}>
                <th scope="row" className="p-5 text-sm font-black uppercase">{row.period}</th>
                <td className="p-5 text-2xl font-black">{row.estimate}</td>
                <td className="p-5">
                  <ul className="space-y-2 text-sm font-medium leading-relaxed text-muted-foreground">
                    {row.effects.map((effect) => <li key={effect}>• {effect}</li>)}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export function PublicSynapseCommandSection({
  variant = "full",
  tone = "inverted",
  className,
}: {
  variant?: "full" | "compact";
  tone?: "base" | "inverted";
  className?: string;
}) {
  const commands = variant === "full" ? SYNAPSE_COMMAND_EXAMPLES : SYNAPSE_COMMAND_EXAMPLES.slice(0, 4);
  const inverted = tone === "inverted";

  return (
    <section
      aria-labelledby="synapse-command-title"
      className={cn(
        "public-section-stage px-5 py-20 md:px-8 md:py-24",
        inverted
          ? "public-inverted-section text-background dark:text-zinc-950"
          : "bg-background text-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mx-auto max-w-5xl text-center">
          <MessageCircle aria-hidden="true" className={cn("mx-auto h-7 w-7", inverted ? "opacity-60" : "text-muted-foreground")} />
          <p className={cn("mt-7 text-xs font-bold", inverted ? "opacity-65" : "text-muted-foreground")}>
            Synapse na NeuroNex
          </p>
          <span
            className={cn(
              "mt-4 inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
              inverted
                ? "border-background/20 dark:border-zinc-950/20"
                : "border-border text-muted-foreground",
            )}
          >
            <FlaskConical aria-hidden="true" className="h-4 w-4" />
            WhatsApp/NeuroZap · Beta
          </span>
          <h2
            id="synapse-command-title"
            className="mx-auto mt-8 max-w-[20ch] text-balance text-4xl font-black leading-[1.02] md:text-6xl"
          >
            Converse com o Synapse. No WhatsApp ou no sistema, o cérebro é o mesmo.
          </h2>

          <div className="mx-auto mt-10 grid max-w-[960px] gap-3 sm:grid-cols-3">
            {synapseChannels.map((channel) => (
              <article
                key={channel.title}
                className={cn(
                  "rounded-[24px] border px-5 py-6 text-center",
                  inverted
                    ? "border-background/15 bg-background/[0.06] dark:border-zinc-950/15 dark:bg-zinc-950/[0.05]"
                    : "border-border bg-card",
                )}
              >
                <channel.icon aria-hidden="true" className="mx-auto h-5 w-5 opacity-60" />
                <h3 className="mt-4 text-lg font-black leading-tight">
                  {channel.title}
                </h3>
              </article>
            ))}
          </div>

          <p className={cn("mx-auto mt-8 max-w-3xl text-base font-medium leading-relaxed md:text-lg", inverted ? "opacity-75" : "text-muted-foreground")}>
            Envie texto ou áudio como em qualquer conversa. O Synapse consulta o
            contexto autorizado da sua clínica e prepara o próximo passo — sem abrir
            o notebook nem procurar por menus.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base font-black leading-relaxed md:text-lg">
            Comece no WhatsApp e continue no sistema — ou faça o caminho inverso.
          </p>

          <div className="mx-auto mt-8 grid max-w-[960px] gap-3 text-left md:grid-cols-2">
            {synapseStarterQuestions.map((question) => (
              <blockquote
                key={question}
                className={cn(
                  "rounded-[22px] border px-5 py-4 text-sm font-bold leading-relaxed",
                  inverted
                    ? "border-background/15 bg-background/[0.045] dark:border-zinc-950/15 dark:bg-zinc-950/[0.04]"
                    : "border-border bg-card",
                )}
              >
                “{question}”
              </blockquote>
            ))}
          </div>

          <p className="mx-auto mt-9 max-w-3xl text-balance text-2xl font-black leading-tight md:text-3xl">
            A conversa pode mudar de canal. O contexto continua.
          </p>
          <p className={cn("mx-auto mt-4 max-w-2xl text-xs font-semibold leading-relaxed md:text-sm", inverted ? "opacity-60" : "text-muted-foreground")}>
            Texto e voz já estão disponíveis na NeuroNex. No WhatsApp, o NeuroZap está
            em Beta e libera cada fluxo por etapas, sempre com as confirmações necessárias.
          </p>
          <Link
            to="/neurozap-para-psicologos"
            className={cn(
              "public-tactile mx-auto mt-7 inline-flex min-h-12 items-center gap-2 rounded-full border px-6 text-sm font-black",
              inverted
                ? "border-background/20 bg-background text-foreground dark:border-zinc-950/20 dark:bg-zinc-950 dark:text-white"
                : "border-foreground bg-foreground text-background",
            )}
          >
            Conhecer o Synapse no WhatsApp
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <div className={cn("mx-auto mt-16 max-w-[1080px] border-t pt-14 text-center", inverted ? "border-background/15 dark:border-zinc-950/15" : "border-border")}>
          <p className={cn("text-xs font-bold", inverted ? "opacity-60" : "text-muted-foreground")}>
            Sua clínica, no seu bolso.
          </p>
          <h3 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-black leading-tight md:text-5xl">
            Converse com sua clínica, em linguagem natural.
          </h3>
          <p className={cn("mx-auto mt-5 max-w-2xl text-sm font-medium leading-relaxed md:text-base", inverted ? "opacity-65" : "text-muted-foreground")}>
            Abra um exemplo e veja o contexto, os módulos envolvidos e o que depende da sua confirmação.
          </p>
        </div>

        <div className={cn("mx-auto mt-10 max-w-[1080px] divide-y border-y", inverted ? "divide-background/15 border-background/15 dark:divide-zinc-950/15 dark:border-zinc-950/15" : "divide-border border-border")}>
          {commands.map((item, index) => {
            const StatusIcon = statusIcons[item.status];
            return (
              <details key={item.title} className="group">
                <summary className={cn("public-tactile flex min-h-16 cursor-pointer list-none items-center gap-4 rounded-2xl px-3 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2", inverted ? "hover:bg-background/10 focus-visible:ring-background dark:hover:bg-zinc-950/10 dark:focus-visible:ring-zinc-950" : "hover:bg-muted focus-visible:ring-ring")}>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-black", inverted ? "border-background/20 dark:border-zinc-950/20" : "border-border")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <strong className="block text-base font-black leading-tight">{item.title}</strong>
                    <span className={cn("mt-1 block text-xs font-medium", inverted ? "opacity-60" : "text-muted-foreground")}>
                      {item.modules.join(" · ")}
                    </span>
                    <span className={cn("mt-2 inline-flex items-center gap-2 text-xs font-bold", inverted ? "opacity-70" : "text-muted-foreground")}>
                      <StatusIcon aria-hidden="true" className="h-4 w-4" />
                      Na NeuroNex: {item.status}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <div className="grid gap-4 px-3 pb-7 pl-16 lg:grid-cols-[1.2fr_0.8fr]">
                  <blockquote className={cn("rounded-[22px] border p-5 text-sm font-semibold leading-relaxed", inverted ? "border-background/15 bg-background/[0.07] dark:border-zinc-950/15 dark:bg-zinc-950/[0.06]" : "border-border bg-card")}>
                    “{item.command}”
                  </blockquote>
                  <div className={cn("flex gap-3 rounded-[22px] border p-5 text-sm font-medium leading-relaxed", inverted ? "border-background/15 dark:border-zinc-950/15" : "border-border text-muted-foreground")}>
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>
                      <strong className="block font-black">Limite visível</strong>
                      <span className={cn(inverted ? "opacity-70" : undefined)}>{item.guardrail}</span>
                    </p>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        {variant === "compact" ? (
          <Link
            to="/synapse"
            className={cn("public-tactile mx-auto mt-8 flex min-h-12 w-fit items-center gap-2 rounded-full border px-5 text-sm font-black", inverted ? "border-background/20 dark:border-zinc-950/20" : "border-border")}
          >
            Ver os 10 exemplos e os estados de cada fluxo
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : (
          <div className={cn("mx-auto mt-8 flex max-w-[1080px] items-start justify-center gap-3 text-sm font-medium leading-relaxed", inverted ? "opacity-68" : "text-muted-foreground")}>
            <BrainCircuit aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Cada exemplo mostra o estágio atual e as confirmações necessárias antes
              de qualquer efeito sensível.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export const PublicAgenticTagline = ({ inverted = false }: { inverted?: boolean }) => (
  <div className={cn("inline-flex items-center gap-2 text-sm font-black", inverted ? "opacity-75" : "text-muted-foreground")}>
    <Sparkles aria-hidden="true" className="h-4 w-4" />
    IA agêntica reduz etapas; controle humano reduz risco.
  </div>
);
