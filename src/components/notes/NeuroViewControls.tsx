import { useState } from "react";
import {
  Settings2,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Target,
  ChevronDown,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onAnimate: () => void;
}

const controlButtonClass =
  "h-10 w-10 shrink-0 rounded-2xl border border-white/[0.085] bg-white/[0.055] text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_44px_-32px_rgba(0,0,0,0.75)] transition-all duration-300 hover:bg-white/[0.105] hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] motion-reduce:transition-none motion-reduce:active:scale-100 [.light_&]:border-black/[0.06] [.light_&]:bg-white/62 [.light_&]:text-zinc-500 [.light_&]:hover:bg-white/86 [.light_&]:hover:text-zinc-950 [.light_&]:focus-visible:ring-zinc-950/35 [.light_&]:focus-visible:ring-offset-white [.light_&]:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_44px_-32px_rgba(0,0,0,0.55)]";

export const NeuroViewControls = ({
  config,
  onConfigChange,
  searchQuery,
  onSearchChange,
  isFullscreen,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onCenter,
  onAnimate,
}: NeuroViewControlsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const update = (key: keyof NeuroConfig, value: NeuroConfig[keyof NeuroConfig]) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="absolute inset-x-0 bottom-5 z-50 flex justify-center px-5 pointer-events-none">
      <div className="relative flex w-full max-w-[760px] flex-col items-center gap-3 pointer-events-auto">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(8px)" }}
              transition={{ type: "spring", damping: 28, stiffness: 360 }}
              className={cn(
                "w-full max-w-[430px] p-4 space-y-4",
                "rounded-[28px] bg-[#070708]/76 backdrop-blur-3xl [.light_&]:bg-white/78",
                "border border-white/[0.085] [.light_&]:border-black/[0.07]",
                "shadow-[0_34px_110px_-48px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.08)] [.light_&]:shadow-[0_34px_110px_-48px_rgba(0,0,0,0.64),inset_0_1px_0_rgba(255,255,255,0.18)]",
              )}
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 [.light_&]:border-black/[0.06]">
                <div>
                  <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/72 [.light_&]:text-zinc-700">
                    <Settings2 className="h-3.5 w-3.5" /> Física do NeuroVision
                  </span>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-white/30 [.light_&]:text-zinc-400">
                    Salvo automaticamente
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsExpanded(false)}
                  className="h-7 w-7 rounded-xl text-white/45 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 [.light_&]:text-zinc-400 [.light_&]:hover:bg-black/5 [.light_&]:hover:text-zinc-900 [.light_&]:focus-visible:ring-zinc-950/35"
                  aria-label="Recolher ajustes do NeuroVision"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 [.light_&]:border-black/[0.055] [.light_&]:bg-black/[0.025]">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-white/72 [.light_&]:text-zinc-700">Otimizacao dinamica</Label>
                    <p className="text-[10px] leading-relaxed text-white/42 [.light_&]:text-zinc-500">
                      Reduz detalhes enquanto a rede esta em movimento intenso.
                    </p>
                  </div>
                  <Switch
                    checked={config.performanceMode}
                    onCheckedChange={(value) => update("performanceMode", value)}
                    className="scale-75 data-[state=checked]:bg-white/80 [.light_&]:data-[state=checked]:bg-zinc-950"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/44 [.light_&]:text-zinc-500">
                  <span>Repulsao neural</span>
                  <span className="tabular-nums">{Math.abs(config.repulsion).toFixed(0)}</span>
                </div>
                <Slider
                  value={[Math.abs(config.repulsion)]}
                  min={120}
                  max={1300}
                  step={20}
                  onValueChange={([value]) => update("repulsion", -value)}
                  className="[&>span:first-child]:bg-white/10 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [.light_&]:[&>span:first-child]:bg-zinc-200 [.light_&]:[&_[role=slider]]:bg-zinc-950"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/44 [.light_&]:text-zinc-500">
                  <span>Comprimento dos elos</span>
                  <span className="tabular-nums">{config.linkDistance.toFixed(0)}px</span>
                </div>
                <Slider
                  value={[config.linkDistance]}
                  min={45}
                  max={210}
                  step={5}
                  onValueChange={([value]) => update("linkDistance", value)}
                  className="[&>span:first-child]:bg-white/10 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [.light_&]:[&>span:first-child]:bg-zinc-200 [.light_&]:[&_[role=slider]]:bg-zinc-950"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/44 [.light_&]:text-zinc-500">
                  <span>Gravidade central</span>
                  <span className="tabular-nums">{(config.centerForce * 100).toFixed(1)}%</span>
                </div>
                <Slider
                  value={[config.centerForce * 100]}
                  min={0}
                  max={26}
                  step={1}
                  onValueChange={([value]) => update("centerForce", value / 100)}
                  className="[&>span:first-child]:bg-white/10 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [.light_&]:[&>span:first-child]:bg-zinc-200 [.light_&]:[&_[role=slider]]:bg-zinc-950"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3 [.light_&]:border-black/[0.06]">
                {[
                  ["Pacientes", "showPatients"],
                  ["Notas", "showNotes"],
                  ["Tags", "showTags"],
                ].map(([label, key]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/48 [.light_&]:border-black/[0.055] [.light_&]:bg-black/[0.025] [.light_&]:text-zinc-500"
                  >
                    {label}
                    <Switch
                      checked={Boolean(config[key as keyof NeuroConfig])}
                      onCheckedChange={(value) => update(key as keyof NeuroConfig, value)}
                      className="scale-[0.68] data-[state=checked]:bg-white/80 [.light_&]:data-[state=checked]:bg-zinc-950"
                    />
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full items-center gap-2 rounded-[28px] border border-white/[0.09] bg-[#070708]/72 px-2.5 py-2.5 shadow-[0_30px_90px_-42px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl [.light_&]:border-black/[0.08] [.light_&]:bg-white/72 [.light_&]:shadow-[0_30px_90px_-42px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.42)]">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/36 [.light_&]:text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar notas..."
              className={cn(
                "h-10 rounded-2xl border-transparent bg-white/[0.055] pl-10 pr-3 text-sm text-white shadow-none outline-none transition-all",
                "placeholder:text-white/36 focus-visible:border-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/25 motion-reduce:transition-none",
                "[.light_&]:bg-black/[0.035] [.light_&]:text-zinc-900 [.light_&]:placeholder:text-zinc-400 [.light_&]:focus-visible:border-black/[0.08] [.light_&]:focus-visible:ring-zinc-950/15",
              )}
            />
          </div>

          <div className="hidden h-8 w-px bg-white/[0.09] [.light_&]:bg-black/[0.08] sm:block" />

          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={onAnimate} className={controlButtonClass} title="Brotar rede neural" aria-label="Animar rede neural">
              <Play className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onZoomOut} className={controlButtonClass} title="Visão panorâmica" aria-label="Afastar NeuroVision">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onZoomIn} className={controlButtonClass} title="Foco de leitura" aria-label="Aproximar NeuroVision">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onCenter} className={controlButtonClass} title="Centralizar rede" aria-label="Centralizar rede">
              <Target className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => update("performanceMode", !config.performanceMode)}
              className={cn(
                controlButtonClass,
                config.performanceMode && "bg-amber-500/18 text-amber-300 [.light_&]:bg-amber-500/16 [.light_&]:text-amber-600"
              )}
              title={config.performanceMode ? "Desativar modo performance" : "Ativar modo performance"}
              aria-label={config.performanceMode ? "Desativar modo performance" : "Ativar modo performance"}
            >
              <Settings2 className={cn("h-4 w-4", config.performanceMode && "animate-pulse")} />
            </Button>
            <Button size="icon" variant="ghost" onClick={onToggleFullscreen} className={controlButtonClass} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"} aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(controlButtonClass, isExpanded && "bg-white text-black [.light_&]:bg-zinc-950 [.light_&]:text-white")}
              title="Ajustar fisica"
              aria-label={isExpanded ? "Fechar ajustes de fisica" : "Abrir ajustes de fisica"}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const NeuroVisionControls = NeuroViewControls;
