import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const NeuroTimeLegend = () => (
  <div className="flex items-center gap-2 text-[10px] font-semibold text-white/40 [.light_&]:text-zinc-500" aria-label="Legenda do NeuroTime">
    <span>Menor peso</span>
    <span
      aria-hidden="true"
      className="h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,#5143b8_0%,#4169c1_28%,#d7a927_55%,#dc6c2d_76%,#de4b4b_100%)] shadow-[0_0_16px_rgba(114,91,212,0.16)] [.light_&]:bg-[linear-gradient(90deg,#5b4fc1_0%,#3570c9_28%,#c49000_55%,#d75c1f_76%,#cf3f46_100%)]"
    />
    <span>Maior atenção</span>
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-1 h-9 w-9 rounded-full border border-white/[0.08] text-white/42 hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/40 [.light_&]:border-black/[0.07] [.light_&]:text-zinc-500 [.light_&]:hover:bg-black/[0.04] [.light_&]:hover:text-zinc-900 [.light_&]:focus-visible:ring-zinc-950/30"
          aria-label="Entender o campo temporal"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "z-[190] w-[330px] rounded-[20px] border-white/[0.09] bg-[#0c0c0e]/94 p-4 text-white shadow-[0_28px_90px_-38px_rgba(0,0,0,0.92)] backdrop-blur-3xl",
          "[.light_&]:border-black/[0.08] [.light_&]:bg-white/96 [.light_&]:text-zinc-900",
        )}
      >
        <p className="text-sm font-semibold">Como ler o horizonte</p>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-white/58 [.light_&]:text-zinc-600">
          <p><span className="font-semibold text-white/82 [.light_&]:text-zinc-900">Cor</span> mostra a temperatura de atenção do período.</p>
          <p><span className="font-semibold text-white/82 [.light_&]:text-zinc-900">Espessura</span> mostra a densidade de evidências.</p>
          <p><span className="font-semibold text-white/82 [.light_&]:text-zinc-900">Brilho</span> preserva a noção de recência.</p>
          <p><span className="font-semibold text-white/82 [.light_&]:text-zinc-900">Contorno de risco</span> aparece somente quando existe risco registrado.</p>
        </div>
      </PopoverContent>
    </Popover>
  </div>
);
