"use client";

import {
  ArrowRight,
  CalendarCheck,
  Captions,
  ClipboardList,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
import type { ElementType } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  PublicPageShell,
  PublicProductHero,
} from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { getPublicPage } from "@/content/public-content";

type FlowStep = {
  id: string;
  icon: ElementType<{ className?: string }>;
  title: string;
  text: string;
  detail: string;
};

const flow: FlowStep[] = [
  {
    id: "pre-entrada",
    icon: CalendarCheck,
    title: "Pré-entrada",
    text: "A sessão já chega com paciente, horário e modalidade.",
    detail:
      "Você abre o atendimento sabendo de onde ele veio e para onde ele precisa voltar depois.",
  },
  {
    id: "consentimento",
    icon: ShieldCheck,
    title: "Consentimento",
    text: "Antes de qualquer captura, limites e permissões ficam explícitos.",
    detail:
      "A NeuroNex mantém a autorização dentro do fluxo e preserva a decisão clínica com você.",
  },
  {
    id: "sessao",
    icon: MonitorPlay,
    title: "Sessão",
    text: "Vídeo, notas e contexto do paciente ficam no mesmo ambiente.",
    detail:
      "Você atende sem alternar entre chamada, agenda, documento, lembrete e prontuário.",
  },
  {
    id: "revisao",
    icon: Captions,
    title: "Revisão",
    text: "Quando autorizado, o conteúdo vira base de revisão e não registro automático.",
    detail:
      "O pós-sessão fica mais leve porque o ponto de partida já está organizado.",
  },
  {
    id: "prontuario",
    icon: ClipboardList,
    title: "Prontuário",
    text: "Você revisa, ajusta e só então leva o que importa ao registro.",
    detail:
      "Paciente, sessão e próximos passos continuam conectados na mesma linha do caso.",
  },
];

const TeleconsultaFlow = () => {
  const [activeId, setActiveId] = useState(flow[0].id);
  const options = flow.map((step) => ({
    value: step.id,
    label: step.title,
  }));

  return (
    <section
      id="sessao-vira-contexto"
      className="public-section-stage px-5 py-20 md:px-8 md:py-28"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono text-[9px] font-black uppercase text-muted-foreground">
            Uma etapa continua a outra
          </p>
          <h2 className="mt-5 text-balance text-4xl font-black leading-[0.96] md:text-6xl">
            Da agenda ao prontuário, com revisão no caminho.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground/72 md:text-lg">
            Cada etapa tem um lugar claro. Você sabe o que foi autorizado, o que
            está em revisão e o que realmente entrou no prontuário.
          </p>
        </div>

        <div className="public-teleconsulta-workspace mx-auto mt-12 overflow-hidden rounded-[32px]">
          <div className="border-b border-zinc-200 px-3 py-3 md:px-5">
            <MagneticSegmentedControl
              id="teleconsulta-flow"
              indicatorId="teleconsulta-flow-indicator"
              value={activeId}
              onValueChange={setActiveId}
              options={options}
              ariaLabel="Etapas da teleconsulta"
              className="public-teleconsulta-segments grid w-full grid-cols-5 rounded-[18px] p-1"
              triggerClassName="w-full rounded-[14px] px-3 text-[11px] font-bold text-zinc-500 hover:text-zinc-950 data-[state=active]:text-zinc-950"
            />
          </div>

          <div className="min-h-[390px] px-8 py-12 md:px-12 md:py-14">
            {flow.map((step, index) => (
              <div
                key={step.id}
                id={`teleconsulta-flow-panel-${step.id}`}
                role="tabpanel"
                aria-labelledby={`teleconsulta-flow-tab-${step.id}`}
                hidden={activeId !== step.id}
                className="mx-auto flex min-h-[280px] max-w-4xl flex-col items-center justify-center text-center text-zinc-950"
              >
                <step.icon aria-hidden="true" className="h-7 w-7 text-zinc-500" />
                <p className="mt-6 font-mono text-[9px] font-black uppercase text-zinc-500">
                  {String(index + 1).padStart(2, "0")} / {String(flow.length).padStart(2, "0")}
                </p>
                <h3 className="mx-auto mt-8 max-w-[17ch] text-balance text-4xl font-black leading-[0.96] md:text-6xl">
                  {step.text}
                </h3>
                <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-zinc-600 md:text-lg">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const TeleconsultaLanding = () => {
  const page = getPublicPage("/teleconsulta-para-psicologos");
  if (!page) return null;

  return (
    <PublicPageShell
      page={page}
      hero={
        <PublicProductHero
          page={page}
          actions={
            <>
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase text-background"
              >
                <Link to="/create-account">
                  Começar grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-border/70 bg-background/38 px-7 font-mono text-[10px] font-black uppercase backdrop-blur-xl"
              >
                <a href="#sessao-vira-contexto">Ver o fluxo</a>
              </Button>
            </>
          }
        />
      }
    >
      <TeleconsultaFlow />
    </PublicPageShell>
  );
};

export default TeleconsultaLanding;
