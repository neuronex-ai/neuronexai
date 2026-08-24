"use client";

import { ChevronRight, Crosshair, Maximize, Minimize, MoreHorizontal, Settings2, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { NeuroVisionLens } from "./clinical-evidence/evidence-types";

export interface NeuroConfig {
  repulsion: number;
  linkDistance: number;
  centerForce: number;
  performanceMode: boolean;
  showPatients: boolean;
  showNotes: boolean;
  showTags: boolean;
}

interface NeuroViewControlsProps {
  config: NeuroConfig;
  onConfigChange: (config: NeuroConfig) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onAnimate: () => void;
  lens: NeuroVisionLens;
  onLensChange: (lens: NeuroVisionLens) => void;
  darkMode: boolean;
  isSidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  portalContainer?: HTMLElement | null;
}

const LENS_OPTIONS: Array<{ value: NeuroVisionLens; label: string; description: string }> = [
  { value: "panorama", label: "Panorama", description: "Rede clínica completa" },
  { value: "session-prep", label: "Preparar sessão", description: "Movimentos recentes" },
  { value: "patterns", label: "Padrões", description: "Recorrências no tempo" },
  { value: "attention", label: "NeuroTrack", description: "Atenção objetiva registrada" },
];

const controlButtonClass = (darkMode: boolean) => cn(
  "h-11 w-11 shrink-0 rounded-2xl border shadow-xl backdrop-blur-2xl transition-[background-color,color,transform] duration-200 active:translate-y-px active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:active:transform-none",
  darkMode
    ? "border-white/10 bg-black/45 text-white/72 hover:bg-white/10 hover:text-white focus-visible:ring-white/45"
    : "border-black/[0.075] bg-white/88 text-zinc-600 shadow-[0_18px_42px_-30px_rgba(24,24,27,0.38),inset_0_1px_0_rgba(255,255,255,0.96)] hover:bg-white hover:text-zinc-950 focus-visible:ring-zinc-950/30",
);

const panelClass = (darkMode: boolean) => cn(
  "w-[360px] rounded-[22px] border p-4 shadow-2xl backdrop-blur-3xl",
  darkMode
    ? "border-white/10 bg-[#0c0c0f]/95 text-white"
    : "border-black/[0.08] bg-white/96 text-zinc-950",
);

export const NeuroViewControls = ({
  config, onConfigChange, isFullscreen, onToggleFullscreen, onZoomIn, onZoomOut, onCenter,
  onAnimate, lens, onLensChange, darkMode, isSidebarOpen, onSidebarOpenChange, portalContainer,
}: NeuroViewControlsProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const update = (key: keyof NeuroConfig, value: NeuroConfig[keyof NeuroConfig]) => onConfigChange({ ...config, [key]: value });

  return (
    <div className={cn(
      "pointer-events-auto absolute top-4 z-[120] flex items-center gap-2 transition-[left] duration-300 motion-reduce:transition-none lg:top-5",
      isSidebarOpen ? "left-[268px]" : "left-4 lg:left-5",
    )}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={controlButtonClass(darkMode)}
        onClick={() => onSidebarOpenChange(!isSidebarOpen)}
        aria-label={isSidebarOpen ? "Recolher pacientes e nós" : "Expandir pacientes e nós"}
        aria-expanded={isSidebarOpen}
        title={isSidebarOpen ? "Recolher pacientes e nós" : "Expandir pacientes e nós"}
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", isSidebarOpen && "rotate-180")} />
      </Button>

      <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="icon" variant="outline" className={cn(controlButtonClass(darkMode), settingsOpen && (darkMode ? "bg-white/14 text-white" : "bg-zinc-950 text-white"))} aria-label="Ajustar dinâmica espacial do NeuroVision 2D" title="Dinâmica espacial">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent portalContainer={portalContainer} align="start" sideOffset={10} className={panelClass(darkMode)}>
          <div className={cn("border-b pb-3", darkMode ? "border-white/8" : "border-black/[0.065]")}>
            <p className="text-xs font-semibold">Dinâmica espacial</p>
            <p className={cn("mt-1 text-[10px] leading-relaxed", darkMode ? "text-white/42" : "text-zinc-500")}>Muda somente a disposição visual. Densidade, atenção e risco não são recalculados.</p>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className={cn("flex justify-between text-[10px] font-semibold", darkMode ? "text-white/54" : "text-zinc-600")}><Label>Repulsão neural</Label><span className="tabular-nums">{Math.abs(config.repulsion).toFixed(0)}</span></div>
              <Slider value={[Math.abs(config.repulsion)]} min={120} max={1300} step={20} onValueChange={([value]) => update("repulsion", -value)} />
            </div>
            <div className="space-y-2">
              <div className={cn("flex justify-between text-[10px] font-semibold", darkMode ? "text-white/54" : "text-zinc-600")}><Label>Distância das conexões</Label><span className="tabular-nums">{config.linkDistance.toFixed(0)} px</span></div>
              <Slider value={[config.linkDistance]} min={45} max={210} step={5} onValueChange={([value]) => update("linkDistance", value)} />
            </div>
            <div className="space-y-2">
              <div className={cn("flex justify-between text-[10px] font-semibold", darkMode ? "text-white/54" : "text-zinc-600")}><Label>Gravidade central</Label><span className="tabular-nums">{(config.centerForce * 100).toFixed(0)}%</span></div>
              <Slider value={[config.centerForce * 100]} min={0} max={26} step={1} onValueChange={([value]) => update("centerForce", value / 100)} />
            </div>
          </div>
          <div className={cn("mt-4 grid grid-cols-3 gap-2 border-t pt-4", darkMode ? "border-white/8" : "border-black/[0.065]")}>
            {([["Pacientes", "showPatients"], ["Notas", "showNotes"], ["Tags", "showTags"]] as const).map(([label, key]) => (
              <label key={key} className={cn("flex min-h-11 items-center justify-between gap-2 rounded-xl border px-2.5 text-[9px] font-semibold", darkMode ? "border-white/8 bg-white/[0.035] text-white/54" : "border-black/[0.06] bg-black/[0.025] text-zinc-600")}>
                {label}<Switch checked={config[key]} onCheckedChange={(value) => update(key, value)} className="scale-[0.68]" />
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button type="button" size="icon" variant="outline" onClick={onToggleFullscreen} className={controlButtonClass(darkMode)} aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </Button>

      <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="outline" className={controlButtonClass(darkMode)} aria-label="Mais opções do NeuroVision 2D" title="Mais opções"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent portalContainer={portalContainer} align="start" sideOffset={10} className={cn(panelClass(darkMode), "w-[270px] p-2")}>
          <DropdownMenuLabel className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-50">Visualização</DropdownMenuLabel>
          <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={cn("min-h-11 rounded-xl px-3 text-xs", darkMode ? "focus:bg-white/10 data-[state=open]:bg-white/10" : "focus:bg-black/[0.055] data-[state=open]:bg-black/[0.055]")}>
              Lente clínica
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className={cn(panelClass(darkMode), "w-[270px] p-2")}>
              <DropdownMenuLabel className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-50">Lente clínica</DropdownMenuLabel>
              <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
              <DropdownMenuRadioGroup value={lens} onValueChange={(value) => onLensChange(value as NeuroVisionLens)}>
                {LENS_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} className={cn("my-0.5 min-h-12 rounded-xl pl-8 pr-3", darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950")}>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-semibold">{option.label}</span>
                      <span className={cn("text-[10px] font-normal", darkMode ? "text-white/42" : "text-zinc-500")}>{option.description}</span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
          <DropdownMenuItem onSelect={onAnimate} className={cn("min-h-11 gap-3 rounded-xl px-3 text-xs", darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950")}><Sparkles className="h-4 w-4" /> Animar surgimento da rede</DropdownMenuItem>
          <DropdownMenuItem onSelect={onCenter} className={cn("min-h-11 gap-3 rounded-xl px-3 text-xs", darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950")}><Crosshair className="h-4 w-4" /> Centralizar visualização</DropdownMenuItem>
          <DropdownMenuItem onSelect={onZoomOut} className={cn("min-h-11 gap-3 rounded-xl px-3 text-xs", darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950")}><ZoomOut className="h-4 w-4" /> Afastar</DropdownMenuItem>
          <DropdownMenuItem onSelect={onZoomIn} className={cn("min-h-11 gap-3 rounded-xl px-3 text-xs", darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950")}><ZoomIn className="h-4 w-4" /> Aproximar</DropdownMenuItem>
          <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); update("performanceMode", !config.performanceMode); }} className={cn("min-h-11 gap-3 rounded-xl px-3 text-xs", darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950")}>
            <Settings2 className={cn("h-4 w-4", config.performanceMode && (darkMode ? "text-emerald-300" : "text-emerald-700"))} /><span className="flex-1">Reduzir efeitos gráficos</span><span className={cn("text-[10px]", darkMode ? "text-white/42" : "text-zinc-500")}>{config.performanceMode ? "Ativo" : "Inativo"}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export const NeuroVisionControls = NeuroViewControls;
