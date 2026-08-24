import { CheckCircle2, Pin, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NEUROTIME_FONTES, type NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";

type NeuroTimeToolcardProps = {
  singularity: NeuroTimeSingularidade;
  pinned: boolean;
  onClose: () => void;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const sourceLabel = (value: NeuroTimeSingularidade["sourceCounts"][number]["fonte"]) =>
  NEUROTIME_FONTES.find((item) => item.value === value)?.shortLabel || value;

export const NeuroTimeToolcard = ({ singularity, pinned, onClose }: NeuroTimeToolcardProps) => (
  <div
    role={pinned ? "dialog" : "status"}
    aria-label={`Detalhes de ${singularity.label}`}
    className={cn(
      "w-[min(360px,calc(100vw-48px))] rounded-[24px] border border-white/[0.1] bg-[#0a0a0c]/94 p-4 text-white",
      "shadow-[0_30px_100px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl",
      "[.light_&]:border-black/[0.08] [.light_&]:bg-white/96 [.light_&]:text-zinc-900",
      "[.light_&]:shadow-[0_30px_90px_-38px_rgba(38,38,38,0.38),inset_0_1px_0_rgba(255,255,255,0.85)]",
    )}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/38 [.light_&]:text-zinc-400">{singularity.label}</p>
        <p className="mt-2 text-sm font-semibold leading-snug text-white/88 [.light_&]:text-zinc-900">{singularity.summary}</p>
      </div>
      {pinned ? (
        <Button type="button" size="icon" variant="ghost" className="-mr-1 -mt-1 h-9 w-9 rounded-full text-white/42 hover:bg-white/[0.08] hover:text-white [.light_&]:text-zinc-500 [.light_&]:hover:bg-black/[0.05] [.light_&]:hover:text-zinc-900" onClick={onClose} aria-label="Fechar detalhes do período">
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>

    <div className="mt-4 grid grid-cols-3 gap-2">
      {[
        ["Densidade", percent(singularity.density)],
        ["Atenção", percent(singularity.attention)],
        ["Registros", String(singularity.eventCount)],
      ].map(([label, value]) => (
        <div key={label} className="rounded-[15px] border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 [.light_&]:border-black/[0.055] [.light_&]:bg-black/[0.025]">
          <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-white/34 [.light_&]:text-zinc-400">{label}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-white/82 [.light_&]:text-zinc-800">{value}</p>
        </div>
      ))}
    </div>

    {singularity.recordedRisk ? (
      <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-red-400/20 bg-red-400/[0.055] px-3 py-2 text-[10px] font-semibold text-red-200 [.light_&]:border-red-500/18 [.light_&]:bg-red-500/[0.045] [.light_&]:text-red-700">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        Risco registrado: {singularity.recordedRisk.valor} de {singularity.recordedRisk.escala}
        {singularity.recordedRisk.origem === "substituido-pelo-profissional" ? " · definido pelo psicólogo" : ""}
      </div>
    ) : null}

    <div className="mt-3 flex flex-wrap gap-1.5">
      {singularity.sourceCounts.slice(0, 4).map((source) => (
        <span key={source.fonte} className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold text-white/48 [.light_&]:border-black/[0.055] [.light_&]:bg-black/[0.025] [.light_&]:text-zinc-500">
          {sourceLabel(source.fonte)} · {source.quantidade}
        </span>
      ))}
      {singularity.dominantThemes.slice(0, 3).map((theme) => (
        <span key={theme} className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] text-white/46 [.light_&]:border-black/[0.055] [.light_&]:text-zinc-500">#{theme}</span>
      ))}
    </div>

    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3 text-[9px] text-white/34 [.light_&]:border-black/[0.06] [.light_&]:text-zinc-400">
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        {singularity.reviewedCount} revisados
      </span>
      <span className="inline-flex items-center gap-1.5 font-semibold text-white/52 [.light_&]:text-zinc-500">
        <Pin className="h-3 w-3" /> {pinned ? "Período fixado" : "Clique para fixar"}
      </span>
    </div>
  </div>
);
