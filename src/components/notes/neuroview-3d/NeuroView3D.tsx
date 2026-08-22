"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, CircleDot, Crosshair, ListTree, Maximize, Minimize, Orbit, RotateCcw, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PersonalNote, Patient } from "@/types";
import type { GraphNode } from "../graph/graph-types";
import {
  getPatientSubgraphIds,
  getVisibleNodeIds,
  type GraphSnapshot,
  type NeuroView3DFilter,
} from "./model";
import {
  createNeuroViewScene,
  DEFAULT_NEUROVIEW_DYNAMICS,
  type NeuroViewDynamicsSettings,
  type NeuroViewSceneController,
  type NeuroViewSceneProfile,
} from "./three-scene";

type NeuroView3DProps = {
  onBack: () => void;
  graphData: GraphSnapshot;
  darkMode: boolean;
  profile: NeuroViewSceneProfile;
  reducedMotion: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  emphasizedNodeIds?: ReadonlySet<string>;
  detailsOpen?: boolean;
  onCloseDetails?: () => void;
  onSelectNote?: (note: PersonalNote) => void;
  onSelectPatient?: (patient: Patient) => void;
  onClearPatient?: () => void;
};

const FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "patients", label: "Pacientes" },
  { value: "recent", label: "Recentes" },
  { value: "risk", label: "Em risco" },
] as const;

const NODE_TYPE_LABEL: Record<GraphNode["type"], string> = {
  patient: "Paciente",
  flow: "Fluxo",
  note: "Nota",
  tag: "Tag",
};

const NODE_TYPE_ORDER: Record<GraphNode["type"], number> = {
  patient: 0,
  flow: 1,
  note: 2,
  tag: 3,
};

export const NeuroView3D = ({
  onBack,
  graphData,
  darkMode,
  profile,
  reducedMotion,
  isFullscreen,
  onToggleFullscreen,
  emphasizedNodeIds,
  detailsOpen = false,
  onCloseDetails,
  onSelectNote,
  onSelectPatient,
  onClearPatient,
}: NeuroView3DProps) => {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<NeuroViewSceneController | null>(null);
  const initialDarkModeRef = useRef(darkMode);
  const dynamicsRef = useRef<NeuroViewDynamicsSettings>({ ...DEFAULT_NEUROVIEW_DYNAMICS });
  const nodeButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [filter, setFilter] = useState<NeuroView3DFilter>("all");
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [dynamicsOpen, setDynamicsOpen] = useState(false);
  const [dynamics, setDynamicsState] = useState<NeuroViewDynamicsSettings>({ ...DEFAULT_NEUROVIEW_DYNAMICS });
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("NeuroView 3d pronto.");

  const nodeById = useMemo(
    () => new Map(graphData.nodes.map((node) => [node.id, node])),
    [graphData.nodes],
  );
  const visibleNodeIds = useMemo(() => {
    const ids = getVisibleNodeIds(graphData, filter);
    if (!focusedPatientId) return ids;
    const focusedIds = getPatientSubgraphIds(graphData, focusedPatientId);
    return new Set(Array.from(ids).filter((id) => focusedIds.has(id)).concat(focusedPatientId));
  }, [filter, focusedPatientId, graphData]);
  const visibleNodes = useMemo(
    () => graphData.nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .sort((left, right) => NODE_TYPE_ORDER[left.type] - NODE_TYPE_ORDER[right.type]
        || left.label.localeCompare(right.label, "pt-BR")),
    [graphData.nodes, visibleNodeIds],
  );
  const focusedPatient = focusedPatientId ? nodeById.get(focusedPatientId) : null;

  const activateNode = useCallback((node: GraphNode) => {
    if (node.type === "patient") {
      setFocusedPatientId(node.id);
      setAnnouncement(`${node.label} centralizado. O subgrafo clínico está em foco.`);
      onSelectPatient?.(node.data as Patient);
      return;
    }
    if (node.type === "note") {
      setAnnouncement(`Nota ${node.label} selecionada.`);
      onSelectNote?.(node.data as PersonalNote);
      return;
    }
    if (node.type === "flow") {
      setAnnouncement(`Fluxo ${node.label} selecionado.`);
      window.dispatchEvent(new CustomEvent("neuroflow:navigate", {
        detail: { flowId: node.data?.id },
      }));
      return;
    }
    controllerRef.current?.setHighlight(node.id);
    setAnnouncement(`Cadeia clínica de ${node.label} destacada.`);
  }, [onSelectNote, onSelectPatient]);

  useEffect(() => {
    const container = sceneContainerRef.current;
    if (!container) return;
    setSceneError(null);
    try {
      const controller = createNeuroViewScene({
        container,
        graph: graphData,
        darkMode: initialDarkModeRef.current,
        profile,
        reducedMotion,
        emphasizedNodeIds,
        onHoverNode: setHoveredNodeId,
        onActivateNode: activateNode,
        onSceneError: (message) => setSceneError(message),
      });
      controllerRef.current = controller;
      controller.setDynamics(dynamicsRef.current);
      return () => {
        controller.dispose();
        if (controllerRef.current === controller) controllerRef.current = null;
      };
    } catch (error) {
      setSceneError(error instanceof Error ? error.message : "Não foi possível iniciar o NeuroView 3d.");
      return undefined;
    }
  }, [activateNode, emphasizedNodeIds, graphData, profile, reducedMotion]);

  useEffect(() => {
    controllerRef.current?.setView(filter, focusedPatientId, darkMode);
  }, [darkMode, filter, focusedPatientId]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (navigatorOpen || dynamicsOpen) return;
      if (isFullscreen || document.fullscreenElement) return;
      if (detailsOpen) {
        event.preventDefault();
        onCloseDetails?.();
        return;
      }
      if (focusedPatientId) {
        event.preventDefault();
        setFocusedPatientId(null);
        onClearPatient?.();
        setAnnouncement("Panorama completo restaurado.");
        return;
      }
      event.preventDefault();
      onBack();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailsOpen, dynamicsOpen, focusedPatientId, isFullscreen, navigatorOpen, onBack, onClearPatient, onCloseDetails]);

  const handleFilterChange = (nextFilter: NeuroView3DFilter) => {
    setFilter(nextFilter);
    setFocusedPatientId(null);
    onClearPatient?.();
    setAnnouncement(`Filtro ${FILTER_OPTIONS.find((option) => option.value === nextFilter)?.label} aplicado.`);
  };

  const returnToPanorama = () => {
    setFocusedPatientId(null);
    onClearPatient?.();
    setAnnouncement("Panorama completo restaurado.");
  };

  const updateDynamics = (key: keyof NeuroViewDynamicsSettings, value: number) => {
    const next = { ...dynamicsRef.current, [key]: value };
    dynamicsRef.current = next;
    setDynamicsState(next);
    controllerRef.current?.setDynamics(next);
  };

  const restoreDynamics = () => {
    const defaults = { ...DEFAULT_NEUROVIEW_DYNAMICS };
    dynamicsRef.current = defaults;
    setDynamicsState(defaults);
    controllerRef.current?.setDynamics(defaults);
    controllerRef.current?.resetDynamics();
    setAnnouncement("Dinâmica e posições do NeuroView 3d restauradas.");
  };

  const handleNodeListKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let targetIndex: number | null = null;
    if (event.key === "ArrowDown") targetIndex = Math.min(visibleNodes.length - 1, index + 1);
    if (event.key === "ArrowUp") targetIndex = Math.max(0, index - 1);
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = visibleNodes.length - 1;
    if (targetIndex === null) return;
    event.preventDefault();
    const target = visibleNodes[targetIndex];
    if (target) nodeButtonRefs.current.get(target.id)?.focus();
  };

  return (
    <div
      className={cn(
        "absolute inset-0 isolate overflow-hidden",
        darkMode ? "bg-[#070709] text-white" : "bg-[#f3f1ec] text-zinc-950",
      )}
      data-neuroview-3d-profile={profile}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0",
          darkMode
            ? "bg-[radial-gradient(circle_at_50%_38%,rgba(73,99,116,0.17),transparent_38%),radial-gradient(circle_at_78%_20%,rgba(89,162,188,0.08),transparent_30%),linear-gradient(180deg,#09090b_0%,#050506_100%)]"
            : "bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.98),transparent_39%),radial-gradient(circle_at_76%_18%,rgba(92,158,174,0.12),transparent_28%),linear-gradient(180deg,#f8f7f3_0%,#e9e5dd_100%)]",
        )}
      />
      <div ref={sceneContainerRef} className="absolute inset-0 z-10" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-4 lg:p-5">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className={cn(
            "pointer-events-auto min-h-11 rounded-2xl border px-4 shadow-xl backdrop-blur-2xl",
            darkMode
              ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
              : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">NeuroView plano</span>
        </Button>

        <div
          className={cn(
            "pointer-events-auto rounded-[20px] border p-1 shadow-2xl backdrop-blur-2xl",
            darkMode ? "border-white/10 bg-black/46" : "border-black/10 bg-white/74",
          )}
        >
          <MagneticSegmentedControl
            value={filter}
            onValueChange={handleFilterChange}
            options={FILTER_OPTIONS}
            ariaLabel="Filtrar NeuroView 3d"
            behavior="single-select"
            className="min-h-11 bg-transparent"
            triggerClassName="min-h-10 px-3 text-xs lg:px-4"
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <Popover open={dynamicsOpen} onOpenChange={setDynamicsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Ajustar dinâmica do NeuroView 3d"
                className={cn(
                  "h-11 w-11 rounded-2xl border shadow-xl backdrop-blur-2xl",
                  darkMode
                    ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                    : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
                )}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={10}
              className={cn(
                "w-[310px] rounded-[24px] border p-0 shadow-2xl backdrop-blur-3xl",
                darkMode
                  ? "border-white/10 bg-[#0c0c0f]/94 text-white"
                  : "border-black/10 bg-white/92 text-zinc-950",
              )}
            >
              <div className={cn("border-b px-4 pb-3 pt-4", darkMode ? "border-white/8" : "border-black/8")}>
                <p className="text-sm font-semibold tracking-[-0.01em]">Dinâmica espacial</p>
                <p className={cn("mt-1 text-[11px] leading-relaxed", darkMode ? "text-white/48" : "text-zinc-500")}>
                  Arraste qualquer esfera para esticar seus filamentos e fixá-la no espaço.
                </p>
              </div>
              <div className="space-y-5 p-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">Gravidade central</span>
                    <output className={darkMode ? "text-white/52" : "text-zinc-500"}>{dynamics.centralGravity}%</output>
                  </div>
                  <Slider
                    value={[dynamics.centralGravity]}
                    min={0}
                    max={100}
                    step={1}
                    aria-label="Gravidade central"
                    aria-valuetext={`${dynamics.centralGravity} por cento`}
                    onValueChange={([value]) => updateDynamics("centralGravity", value)}
                    onValueCommit={() => setAnnouncement(`Gravidade central ajustada para ${dynamicsRef.current.centralGravity} por cento.`)}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-0"
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">Elasticidade</span>
                    <output className={darkMode ? "text-white/52" : "text-zinc-500"}>{dynamics.elasticity}%</output>
                  </div>
                  <Slider
                    value={[dynamics.elasticity]}
                    min={0}
                    max={100}
                    step={1}
                    aria-label="Elasticidade dos filamentos"
                    aria-valuetext={`${dynamics.elasticity} por cento`}
                    onValueChange={([value]) => updateDynamics("elasticity", value)}
                    onValueCommit={() => setAnnouncement(`Elasticidade ajustada para ${dynamicsRef.current.elasticity} por cento.`)}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-0"
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">Distância das conexões</span>
                    <output className={darkMode ? "text-white/52" : "text-zinc-500"}>
                      {(0.55 + dynamics.connectionDistance * 0.009).toFixed(2).replace(".", ",")}×
                    </output>
                  </div>
                  <Slider
                    value={[dynamics.connectionDistance]}
                    min={0}
                    max={100}
                    step={1}
                    aria-label="Distância entre as conexões"
                    aria-valuetext={`${(0.55 + dynamics.connectionDistance * 0.009).toFixed(2)} vezes`}
                    onValueChange={([value]) => updateDynamics("connectionDistance", value)}
                    onValueCommit={() => setAnnouncement("Distância entre as conexões ajustada.")}
                    className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-0"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={restoreDynamics}
                  className={cn(
                    "min-h-10 w-full rounded-xl text-xs",
                    darkMode ? "border-white/10 bg-white/[0.035] hover:bg-white/10" : "border-black/10 bg-black/[0.025] hover:bg-black/[0.06]",
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar dinâmica
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            className={cn(
              "h-11 w-11 rounded-2xl border shadow-xl backdrop-blur-2xl",
              darkMode
                ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
            )}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          {focusedPatientId ? (
            <Button
              type="button"
              variant="outline"
              onClick={returnToPanorama}
              className={cn(
                "min-h-11 rounded-2xl border px-4 shadow-xl backdrop-blur-2xl",
                darkMode
                  ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                  : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
              )}
            >
              <Orbit className="h-4 w-4" />
              <span className="hidden lg:inline">Voltar ao panorama</span>
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => controllerRef.current?.resetCamera()}
            aria-label="Reenquadrar visualização"
            className={cn(
              "h-11 w-11 rounded-2xl border shadow-xl backdrop-blur-2xl",
              darkMode
                ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
            )}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setNavigatorOpen(true)}
            aria-label="Abrir lista acessível de nós"
            className={cn(
              "h-11 w-11 rounded-2xl border shadow-xl backdrop-blur-2xl",
              darkMode
                ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
            )}
          >
            <ListTree className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-5">
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-2 text-[10px] font-semibold tracking-wide shadow-lg backdrop-blur-xl",
            darkMode ? "border-white/10 bg-black/38 text-white/58" : "border-black/8 bg-white/62 text-zinc-600",
          )}
        >
          {profile === "full" ? "Renderização completa" : "Renderização leve"}
        </div>
        <div
          className={cn(
            "hidden items-center gap-3 rounded-2xl border px-3.5 py-2 text-[10px] font-medium shadow-lg backdrop-blur-xl md:flex",
            darkMode ? "border-white/10 bg-black/38 text-white/58" : "border-black/8 bg-white/62 text-zinc-600",
          )}
          aria-hidden="true"
        >
          {(["patient", "flow", "note", "tag"] as const).map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <CircleDot className={cn(
                "h-3 w-3",
                type === "flow" ? "text-cyan-500" : type === "patient" ? "text-current" : "opacity-60",
              )} />
              {NODE_TYPE_LABEL[type]}
            </span>
          ))}
        </div>
      </div>

      {visibleNodes.length === 0 && !sceneError ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className={cn(
            "pointer-events-auto max-w-sm rounded-3xl border p-6 text-center shadow-2xl backdrop-blur-2xl",
            darkMode ? "border-white/10 bg-black/58" : "border-black/10 bg-white/82",
          )}>
            <p className="text-sm font-semibold">Nenhum nó corresponde a este filtro.</p>
            <p className="mt-1 text-xs opacity-60">A visualização não criou nenhuma inferência nova.</p>
            <Button className="mt-4 rounded-xl" onClick={() => handleFilterChange("all")}>Mostrar todos</Button>
          </div>
        </div>
      ) : null}

      {sceneError ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/92 p-6 backdrop-blur-xl">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold">NeuroView 3d indisponível</h2>
            <p className="mt-2 text-sm text-muted-foreground">A visualização plana foi preservada. {sceneError}</p>
            <Button className="mt-5 rounded-xl" onClick={onBack}>Voltar ao NeuroView plano</Button>
          </div>
        </div>
      ) : null}

      <Sheet open={navigatorOpen} onOpenChange={setNavigatorOpen}>
        <SheetContent
          side="right"
          className={cn(
            "z-[120] flex w-[min(92vw,420px)] max-w-[420px] flex-col border-l p-0",
            darkMode ? "border-white/10 bg-[#0b0b0e]/96 text-white" : "border-black/10 bg-[#f8f7f3]/96",
          )}
        >
          <SheetHeader className="border-b border-border/20 px-5 pb-4 pt-6">
            <SheetTitle className={darkMode ? "text-white" : undefined}>Nós do NeuroView 3d</SheetTitle>
            <SheetDescription>
              Use as setas para navegar, Enter para entrar e Escape para retornar.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="space-y-1 p-3" aria-label="Nós visíveis">
              {visibleNodes.map((node, index) => {
                const active = hoveredNodeId === node.id || focusedPatientId === node.id;
                return (
                  <li key={node.id}>
                    <button
                      ref={(element) => {
                        if (element) nodeButtonRefs.current.set(node.id, element);
                        else nodeButtonRefs.current.delete(node.id);
                      }}
                      type="button"
                      onClick={() => activateNode(node)}
                      onFocus={() => {
                        setHoveredNodeId(node.id);
                        controllerRef.current?.setHighlight(node.id);
                        setAnnouncement(`${NODE_TYPE_LABEL[node.type]} ${node.label} em foco.`);
                      }}
                      onBlur={() => {
                        setHoveredNodeId(null);
                        controllerRef.current?.setHighlight(null);
                      }}
                      onMouseEnter={() => controllerRef.current?.setHighlight(node.id)}
                      onMouseLeave={() => controllerRef.current?.setHighlight(null)}
                      onKeyDown={(event) => handleNodeListKeyDown(event, index)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        active
                          ? darkMode ? "border-white/16 bg-white/10" : "border-black/12 bg-black/[0.055]"
                          : darkMode ? "border-transparent hover:bg-white/[0.055]" : "border-transparent hover:bg-black/[0.035]",
                      )}
                    >
                      <span className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        node.type === "flow" ? "bg-cyan-400" : node.type === "patient" ? darkMode ? "bg-white" : "bg-zinc-800" : "bg-current opacity-45",
                      )} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{node.label || "Sem título"}</span>
                        <span className="block text-[10px] font-medium uppercase tracking-[0.14em] opacity-48">
                          {NODE_TYPE_LABEL[node.type]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      {focusedPatient ? (
        <p className="sr-only">Paciente em foco: {focusedPatient.label}.</p>
      ) : null}
    </div>
  );
};

export default NeuroView3D;
