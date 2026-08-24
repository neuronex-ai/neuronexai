import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NeuroTimeLegendProps = {
  darkMode: boolean;
  portalContainer?: HTMLElement | null;
};

export const NeuroTimeLegend = ({ darkMode, portalContainer }: NeuroTimeLegendProps) => (
  <div className={cn("flex items-center gap-2 text-[9px] font-semibold", darkMode ? "text-white/38" : "text-zinc-500")} aria-label="Legenda do NeuroTime">
    <span>Menor peso</span>
    <span
      aria-hidden="true"
      className={cn(
        "h-1.5 w-24 rounded-full shadow-[0_0_16px_rgba(114,91,212,0.16)]",
        darkMode
          ? "bg-[linear-gradient(90deg,#5143b8_0%,#4169c1_28%,#d7a927_55%,#dc6c2d_76%,#de4b4b_100%)]"
          : "bg-[linear-gradient(90deg,#5b4fc1_0%,#3570c9_28%,#c49000_55%,#d75c1f_76%,#cf3f46_100%)]",
      )}
    />
    <span>Maior atenção</span>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "ml-1 h-9 w-9 rounded-full border focus-visible:ring-2",
            darkMode
              ? "border-white/[0.08] text-white/42 hover:bg-white/[0.07] hover:text-white focus-visible:ring-white/40"
              : "border-black/[0.07] text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-900 focus-visible:ring-zinc-950/30",
          )}
          aria-label="Entender o campo temporal"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalContainer={portalContainer}
        align="end"
        sideOffset={8}
        className={cn(
          "z-[250] w-[330px] rounded-[20px] border p-4 shadow-[0_28px_90px_-38px_rgba(0,0,0,0.92)] backdrop-blur-3xl",
          darkMode ? "border-white/[0.09] bg-[#0c0c0e]/96 text-white" : "border-black/[0.08] bg-white/96 text-zinc-900",
        )}
      >
        <p className="text-sm font-semibold">Como ler o horizonte</p>
        <div className={cn("mt-3 space-y-2 text-xs leading-relaxed", darkMode ? "text-white/58" : "text-zinc-600")}>
          {[
            ["Cor", "mostra a temperatura de atenção do período."],
            ["Espessura", "mostra a densidade de evidências."],
            ["Brilho", "preserva a noção de recência."],
            ["Marcador de risco", "aparece somente quando existe risco registrado."],
          ].map(([label, description]) => (
            <p key={label}><span className={cn("font-semibold", darkMode ? "text-white/82" : "text-zinc-900")}>{label}</span> {description}</p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  </div>
);
