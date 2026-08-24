import { CheckCircle2, Pin, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NEUROTIME_FONTES, type NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";

type NeuroTimeToolcardProps = {
  singularity: NeuroTimeSingularidade;
  pinned: boolean;
  darkMode: boolean;
  onClose: () => void;
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const sourceLabel = (value: NeuroTimeSingularidade["sourceCounts"][number]["fonte"]) =>
  NEUROTIME_FONTES.find((item) => item.value === value)?.shortLabel || value;

export const NeuroTimeToolcard = ({ singularity, pinned, darkMode, onClose }: NeuroTimeToolcardProps) => (
  <div
    role={pinned ? "dialog" : "tooltip"}
    aria-label={`Detalhes de ${singularity.label}`}
    className={cn(
      "relative isolate w-[min(360px,calc(100vw-48px))] overflow-hidden rounded-[24px] border p-4 backdrop-blur-3xl",
      darkMode
        ? "border-white/[0.105] bg-[#09090b]/88 text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.095)]"
        : "border-black/[0.075] bg-white/88 text-zinc-900 shadow-[0_30px_90px_-38px_rgba(38,38,38,0.34),inset_0_1px_0_rgba(255,255,255,0.98)]",
    )}
  >
    <div className={cn("pointer-events-none absolute inset-0", darkMode ? "bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.085),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.025),transparent_58%)]" : "bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.96),transparent_42%),linear-gradient(145deg,rgba(255,255,255,0.52),transparent_62%)]")} aria-hidden="true" />
    <div className={cn("notes-retina-texture pointer-events-none absolute inset-0", darkMode ? "opacity-[0.2]" : "opacity-[0.1]")} aria-hidden="true" />
    <div className="relative flex items-start justify-between gap-4">
      <div>
        <p className={cn("text-[9px] font-bold uppercase tracking-[0.18em]", darkMode ? "text-white/38" : "text-zinc-400")}>{singularity.label}</p>
        <p className={cn("mt-2 text-sm font-semibold leading-snug", darkMode ? "text-white/88" : "text-zinc-900")}>{singularity.summary}</p>
      </div>
      {pinned ? (
        <Button type="button" size="icon" variant="ghost" className={cn("-mr-1 -mt-1 h-9 w-9 rounded-full", darkMode ? "text-white/42 hover:bg-white/[0.08] hover:text-white" : "text-zinc-500 hover:bg-black/[0.05] hover:text-zinc-900")} onClick={onClose} aria-label="Fechar detalhes do período">
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>

    <div className="relative mt-4 grid grid-cols-3 gap-2">
      {[
        ["Densidade", percent(singularity.density)],
        ["Atenção", percent(singularity.attention)],
        ["Registros", String(singularity.eventCount)],
      ].map(([label, value]) => (
        <div key={label} className={cn("rounded-[15px] border px-3 py-2.5", darkMode ? "border-white/[0.07] bg-white/[0.035]" : "border-black/[0.05] bg-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]")}>
          <p className={cn("text-[8px] font-bold uppercase tracking-[0.13em]", darkMode ? "text-white/34" : "text-zinc-400")}>{label}</p>
          <p className={cn("mt-1 text-sm font-semibold tabular-nums", darkMode ? "text-white/82" : "text-zinc-800")}>{value}</p>
        </div>
      ))}
    </div>

    {singularity.recordedRisk ? (
      <div className={cn("relative mt-3 flex items-center gap-2 rounded-[14px] border px-3 py-2 text-[10px] font-semibold", darkMode ? "border-red-400/20 bg-red-400/[0.055] text-red-200" : "border-red-500/18 bg-red-500/[0.045] text-red-700")}>
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        Risco registrado: {singularity.recordedRisk.valor} de {singularity.recordedRisk.escala}
        {singularity.recordedRisk.origem === "substituido-pelo-profissional" ? " · definido pelo psicólogo" : ""}
      </div>
    ) : null}

    <div className="relative mt-3 flex flex-wrap gap-1.5">
      {singularity.sourceCounts.slice(0, 4).map((source) => (
        <span key={source.fonte} className={cn("rounded-full border px-2.5 py-1 text-[9px] font-semibold", darkMode ? "border-white/[0.07] bg-white/[0.035] text-white/48" : "border-black/[0.05] bg-white/58 text-zinc-500")}>
          {sourceLabel(source.fonte)} · {source.quantidade}
        </span>
      ))}
      {singularity.dominantThemes.slice(0, 3).map((theme) => (
        <span key={theme} className={cn("rounded-full border px-2.5 py-1 text-[9px]", darkMode ? "border-white/[0.07] text-white/46" : "border-black/[0.05] text-zinc-500")}>#{theme}</span>
      ))}
    </div>

    <div className={cn("relative mt-3 flex items-center justify-between gap-3 border-t pt-3 text-[9px]", darkMode ? "border-white/[0.07] text-white/34" : "border-black/[0.055] text-zinc-400")}>
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        {singularity.reviewedCount} revisados
      </span>
      <span className={cn("inline-flex items-center gap-1.5 font-semibold", darkMode ? "text-white/52" : "text-zinc-500")}>
        <Pin className="h-3 w-3" /> {pinned ? "Período fixado" : "Clique para fixar"}
      </span>
    </div>
  </div>
);
