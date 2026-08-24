"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, Crosshair, Info, Keyboard, Maximize, Minimize, MoreHorizontal, Orbit, Pause, Play, RotateCcw, Settings2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { PersonalNote, Patient } from "@/types";
import type { EvidenceNode, EvidenceSource, NeuroVisionLens } from "../clinical-evidence/evidence-types";
import type { GraphNode } from "../graph/graph-types";
import { NeuroVisionFilterBar, NEUROVISION_FILTER_OPTIONS } from "../desktop/neurovision/NeuroVisionFilterBar";
import { NeuroVisionSidebar } from "../NeuroViewSidebar";
import {
  getPatientSubgraphIds,
  getNodeEvidence,
  getVisibleNodeIds,
  type GraphSnapshot,
  type NeuroView3DFilter,
} from "./model";
import {
  createNeuroVisionScene,
  DEFAULT_NEUROVISION_DYNAMICS,
  type NeuroVisionCameraAction,
  type NeuroVisionDynamicsSettings,
  type NeuroVisionSceneController,
  type NeuroVisionSceneProfile,
} from "./three-scene";
import { getNeuroVisionCameraAction } from "./keyboard-navigation";
import { NeuroVisionInsightsPanel } from "./NeuroViewInsightsPanel";
import {
  neuroViewSceneCommands,
  type NeuroViewSceneCommand,
  type NeuroViewCommandResult,
} from "./scene-command-controller";

type NeuroVision3DProps = {
  onBack: () => void;
  graphData: GraphSnapshot;
  darkMode: boolean;
  profile: NeuroVisionSceneProfile;
  reducedMotion: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  portalContainer?: HTMLElement | null;
  emphasizedNodeIds?: ReadonlySet<string>;
  focusNodeId?: string | null;
  detailsOpen?: boolean;
  onCloseDetails?: () => void;
  onSelectNote?: (note: PersonalNote) => void;
  onSelectPatient?: (patient: Patient) => void;
  onClearPatient?: () => void;
  evidence?: EvidenceNode[];
  evidenceAvailable?: boolean;
  onUpdateEvidenceOverride?: (update: {
    sourceType: EvidenceSource;
    sourceId: string;
    priority?: number;
    isPinned?: boolean;
    isHidden?: boolean;
    themeOverride?: string | null;
  }) => Promise<void>;
};

const LENS_OPTIONS = [
  { value: "panorama", label: "Panorama", description: "Visão espacial completa" },
  { value: "session-prep", label: "Preparar sessão", description: "Mudanças e próximos passos" },
  { value: "patterns", label: "Padrões", description: "Trajetória clínica no tempo" },
  { value: "attention", label: "NeuroTrack", description: "Radar vivo de atenção objetiva" },
] as const;

const CAMERA_ACTION_ANNOUNCEMENT: Record<NeuroVisionCameraAction, string> = {
  "orbit-left": "rotação para a esquerda",
  "orbit-right": "rotação para a direita",
  "orbit-up": "rotação para cima",
  "orbit-down": "rotação para baixo",
  "dolly-in": "aproximação",
  "dolly-out": "afastamento",
  "strafe-left": "deslocamento para a esquerda",
  "strafe-right": "deslocamento para a direita",
  "elevate-up": "elevação da câmera",
  "elevate-down": "descida da câmera",
};

export const NeuroVision3D = ({
  onBack,
  graphData,
  darkMode,
  profile,
  reducedMotion,
  isFullscreen,
  onToggleFullscreen,
  portalContainer,
  emphasizedNodeIds,
  focusNodeId = null,
  detailsOpen = false,
  onCloseDetails,
  onSelectNote,
  onSelectPatient,
  onClearPatient,
  evidence = [],
  evidenceAvailable = false,
  onUpdateEvidenceOverride,
}: NeuroVision3DProps) => {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<NeuroVisionSceneController | null>(null);
  const initialDarkModeRef = useRef(darkMode);
  const dynamicsRef = useRef<NeuroVisionDynamicsSettings>({ ...DEFAULT_NEUROVISION_DYNAMICS });
  const autoRotateRef = useRef(!reducedMotion);
  const emphasizedNodeIdsRef = useRef<ReadonlySet<string>>(emphasizedNodeIds || new Set());
  const focusNodeIdRef = useRef<string | null>(focusNodeId);
  const [filter, setFilter] = useState<NeuroView3DFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lens, setLens] = useState<NeuroVisionLens>("panorama");
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [timeProgress, setTimeProgress] = useState(100);
  const [isPatientSidebarOpen, setIsPatientSidebarOpen] = useState(false);
  const [priorityInfoOpen, setPriorityInfoOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [autoRotate, setAutoRotateState] = useState(!reducedMotion);
  const [dynamicsOpen, setDynamicsOpen] = useState(false);
  const [dynamics, setDynamicsState] = useState<NeuroVisionDynamicsSettings>({ ...DEFAULT_NEUROVISION_DYNAMICS });
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("NeuroVision 3d pronto.");

  const nodeById = useMemo(
    () => new Map(graphData.nodes.map((node) => [node.id, node])),
    [graphData.nodes],
  );
  const evidenceTimeExtent = useMemo(() => {
    const timestamps = evidence
      .map((item) => new Date(item.occurredAt).getTime())
      .filter(Number.isFinite);
    return timestamps.length
      ? { min: Math.min(...timestamps), max: Math.max(...timestamps) }
      : null;
  }, [evidence]);
  const timeEnd = useMemo(() => {
    if (lens !== "patterns" || !evidenceTimeExtent) return null;
    return evidenceTimeExtent.min
      + (evidenceTimeExtent.max - evidenceTimeExtent.min) * (timeProgress / 100);
  }, [evidenceTimeExtent, lens, timeProgress]);
  const visibleNodeIds = useMemo(() => {
    const ids = getVisibleNodeIds(graphData, filter);
    const focusedIds = focusedPatientId ? getPatientSubgraphIds(graphData, focusedPatientId) : null;
    const scoped = focusedIds
      ? new Set(Array.from(ids).filter((id) => focusedIds.has(id)).concat(focusedPatientId as string))
      : ids;
    if (timeEnd === null) return scoped;
    return new Set(Array.from(scoped).filter((id) => {
      const node = nodeById.get(id);
      const item = node ? getNodeEvidence(node) : null;
      return !item || new Date(item.occurredAt).getTime() <= timeEnd;
    }));
  }, [filter, focusedPatientId, graphData, nodeById, timeEnd]);
  const searchMatchIds = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return new Set<string>();
    return new Set(graphData.nodes
      .filter((node) => `${node.label} ${node.type}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
      .map((node) => node.id));
  }, [graphData.nodes, searchQuery]);
  const focusedPatient = focusedPatientId ? nodeById.get(focusedPatientId) : null;
  const inspectedNode = (hoveredNodeId ? nodeById.get(hoveredNodeId) : null)
    || (selectedNodeId ? nodeById.get(selectedNodeId) : null)
    || null;
  emphasizedNodeIdsRef.current = emphasizedNodeIds || new Set();
  focusNodeIdRef.current = focusNodeId;

  const activateNode = useCallback((node: GraphNode) => {
    setSelectedNodeId(node.id);
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
    if (node.type === "evidence") {
      controllerRef.current?.focusNode(node.id);
      setAnnouncement(`Evidência ${node.label} enquadrada. Abra Por que está aqui para ver a composição da gravidade.`);
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
      const controller = createNeuroVisionScene({
        container,
        graph: graphData,
        darkMode: initialDarkModeRef.current,
        profile,
        reducedMotion,
        emphasizedNodeIds: emphasizedNodeIdsRef.current,
        onHoverNode: setHoveredNodeId,
        onActivateNode: activateNode,
        onSceneError: (message) => setSceneError(message),
      });
      controllerRef.current = controller;
      controller.setDynamics(dynamicsRef.current);
      controller.setAutoRotate(autoRotateRef.current && !reducedMotion);
      controller.setHighlightSelection(emphasizedNodeIdsRef.current);
      if (focusNodeIdRef.current) controller.frameNode(focusNodeIdRef.current);
      return () => {
        controller.dispose();
        if (controllerRef.current === controller) controllerRef.current = null;
      };
    } catch (error) {
      setSceneError(error instanceof Error ? error.message : "Não foi possível iniciar o NeuroVision 3d.");
      return undefined;
    }
  }, [activateNode, graphData, profile, reducedMotion]);

  useEffect(() => {
    const highlightedIds = searchQuery.trim()
      ? searchMatchIds
      : emphasizedNodeIds || new Set<string>();
    controllerRef.current?.setHighlightSelection(highlightedIds);
    if (searchQuery.trim() && searchMatchIds.size > 0) {
      const firstId = searchMatchIds.values().next().value as string | undefined;
      if (firstId) controllerRef.current?.frameNode(firstId);
    }
  }, [emphasizedNodeIds, searchMatchIds, searchQuery]);

  useEffect(() => {
    if (focusNodeId) controllerRef.current?.frameNode(focusNodeId);
  }, [focusNodeId]);

  useEffect(() => {
    controllerRef.current?.setView(filter, focusedPatientId, darkMode);
  }, [darkMode, filter, focusedPatientId]);

  useEffect(() => {
    controllerRef.current?.setLens(lens);
  }, [lens]);

  useEffect(() => {
    controllerRef.current?.setTimeWindow(lens === "patterns" ? { end: timeEnd } : {});
  }, [lens, timeEnd]);

  useEffect(() => {
    if (!reducedMotion) return;
    autoRotateRef.current = false;
    setAutoRotateState(false);
    controllerRef.current?.setAutoRotate(false);
  }, [reducedMotion]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (dynamicsOpen || moreMenuOpen || priorityInfoOpen) return;
      if (isFullscreen || document.fullscreenElement) return;
      if (isPatientSidebarOpen) {
        event.preventDefault();
        setIsPatientSidebarOpen(false);
        return;
      }
      if (detailsOpen) {
        event.preventDefault();
        onCloseDetails?.();
        return;
      }
      if (selectedNodeId) {
        event.preventDefault();
        setSelectedNodeId(null);
        controllerRef.current?.setHighlight(null);
        setAnnouncement("Inspetor clínico fechado.");
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
  }, [detailsOpen, dynamicsOpen, focusedPatientId, isFullscreen, isPatientSidebarOpen, moreMenuOpen, onBack, onClearPatient, onCloseDetails, priorityInfoOpen, selectedNodeId]);

  const handleFilterChange = (nextFilter: NeuroView3DFilter) => {
    setFilter(nextFilter);
    setFocusedPatientId(null);
    onClearPatient?.();
    setAnnouncement(`Filtro ${NEUROVISION_FILTER_OPTIONS.find((option) => option.value === nextFilter)?.label} aplicado.`);
  };

  const handleLensChange = useCallback((nextLens: NeuroVisionLens) => {
    setLens(nextLens);
    setSelectedNodeId(null);
    if (nextLens === "attention") {
      setFocusedPatientId(null);
      onClearPatient?.();
      setAnnouncement("NeuroTrack aberto. Os halos mostram somente sinais objetivos de atenção.");
      return;
    }
    if ((nextLens === "session-prep" || nextLens === "patterns") && !focusedPatientId) {
      setIsPatientSidebarOpen(true);
      setAnnouncement("Escolha um paciente para abrir esta lente clínica.");
      return;
    }
    const label = LENS_OPTIONS.find((option) => option.value === nextLens)?.label || "Panorama";
    setAnnouncement(`Lente ${label} aplicada.`);
  }, [focusedPatientId, onClearPatient]);

  const returnToPanorama = () => {
    setFocusedPatientId(null);
    onClearPatient?.();
    setAnnouncement("Panorama completo restaurado.");
  };

  const updateDynamics = (key: keyof NeuroVisionDynamicsSettings, value: number) => {
    const next = { ...dynamicsRef.current, [key]: value };
    dynamicsRef.current = next;
    setDynamicsState(next);
    controllerRef.current?.setDynamics(next);
  };

  const restoreDynamics = () => {
    const defaults = { ...DEFAULT_NEUROVISION_DYNAMICS };
    dynamicsRef.current = defaults;
    setDynamicsState(defaults);
    controllerRef.current?.setDynamics(defaults);
    controllerRef.current?.resetDynamics();
    setAnnouncement("Dinâmica e posições do NeuroVision 3d restauradas.");
  };

  const toggleAutoRotate = () => {
    if (reducedMotion) {
      setAnnouncement("A rotação automática permanece pausada pela preferência de movimento reduzido.");
      return;
    }
    const next = !autoRotateRef.current;
    autoRotateRef.current = next;
    setAutoRotateState(next);
    controllerRef.current?.setAutoRotate(next);
    setAnnouncement(next ? "Rotação automática iniciada." : "Rotação automática pausada.");
  };

  const playEmergence = () => {
    controllerRef.current?.playEmergence();
    setAnnouncement(reducedMotion
      ? "Rede neural reorganizada sem animação."
      : "A rede neural está emergindo progressivamente a partir dos pacientes.");
  };

  const handleSceneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = getNeuroVisionCameraAction(event);
    if (!action) return;
    event.preventDefault();
    controllerRef.current?.moveCamera(action);
    if (!event.repeat) setAnnouncement(`Câmera em ${CAMERA_ACTION_ANNOUNCEMENT[action]}.`);
  };

  const focusSceneForKeyboard = () => {
    setMoreMenuOpen(false);
    requestAnimationFrame(() => {
      sceneContainerRef.current?.focus({ preventScroll: true });
      setAnnouncement("Navegação da câmera ativa. Use as setas e W A S D.");
    });
  };

  const inspectNode = useCallback((nodeId: string) => {
    const node = nodeById.get(nodeId)
      || graphData.nodes.find((candidate) => getNodeEvidence(candidate)?.id === nodeId);
    if (!node) return;
    activateNode(node);
    controllerRef.current?.setHighlight(node.id);
  }, [activateNode, graphData.nodes, nodeById]);

  useEffect(() => neuroViewSceneCommands.attach({
    execute: async (command: NeuroViewSceneCommand): Promise<NeuroViewCommandResult> => {
      const scene = controllerRef.current;
      if (!scene) throw new Error("A cena do NeuroView 3d ainda não está pronta.");
      const ok = (message: string, gravity?: NeuroViewCommandResult["gravity"]): NeuroViewCommandResult => ({
        ok: true,
        command: command.type,
        message,
        gravity,
      });
      if (command.type === "prepare-session" || command.type === "select-patient") {
        const node = nodeById.get(`pat-${command.patientId}`);
        if (!node) throw new Error("Paciente não encontrado no NeuroView.");
        if (command.type === "prepare-session") setLens("session-prep");
        setFocusedPatientId(node.id);
        setSelectedNodeId(node.id);
        onSelectPatient?.(node.data as Patient);
        scene.focusNode(node.id);
        return ok(command.type === "prepare-session" ? "Preparação de sessão aberta." : "Paciente centralizado.");
      }
      if (command.type === "focus-evidence") {
        const node = nodeById.get(command.nodeId)
          || graphData.nodes.find((candidate) => getNodeEvidence(candidate)?.id === command.nodeId);
        if (!node) throw new Error("Evidência não encontrada no NeuroView.");
        setSelectedNodeId(node.id);
        scene.focusNode(node.id);
        scene.setHighlight(node.id);
        return ok("Evidência enquadrada.");
      }
      if (command.type === "set-lens") {
        handleLensChange(command.lens);
        scene.setLens(command.lens);
        return ok("Lente clínica atualizada.");
      }
      if (command.type === "set-time-window") {
        scene.setTimeWindow(command.window);
        return ok("Janela temporal atualizada.");
      }
      if (command.type === "highlight-path") {
        scene.setHighlight(command.nodeId);
        return ok("Caminho clínico atualizado.");
      }
      if (command.type === "highlight-nodes") {
        scene.setHighlightSelection(command.nodeIds);
        if (command.focusNodeId) scene.frameNode(command.focusNodeId);
        return ok(`${command.nodeIds.length} entidades clínicas ressaltadas no NeuroView 3d.`);
      }
      if (command.type === "set-physics") {
        dynamicsRef.current = command.settings;
        setDynamicsState(command.settings);
        scene.setDynamics(command.settings);
        return ok("Física exclusiva da cena 3D atualizada.");
      }
      if (command.type === "explain-gravity") {
        const node = nodeById.get(command.nodeId)
          || graphData.nodes.find((candidate) => getNodeEvidence(candidate)?.id === command.nodeId);
        if (!node) throw new Error("Esta entidade não foi encontrada na cena atual.");
        const item = getNodeEvidence(node);
        if (!item) throw new Error("Esta entidade não possui composição de gravidade.");
        setSelectedNodeId(node.id);
        return ok("Composição de gravidade aberta.", item.gravity);
      }
      if (command.type === "enter-fullscreen") {
        if (!isFullscreen && !document.fullscreenElement) onToggleFullscreen();
        return ok("NeuroView 3d em tela cheia.");
      }
      setLens("panorama");
      setFocusedPatientId(null);
      setSelectedNodeId(null);
      onClearPatient?.();
      scene.resetCamera();
      return ok("Panorama completo restaurado.");
    },
  }), [graphData.nodes, handleLensChange, isFullscreen, nodeById, onClearPatient, onSelectPatient, onToggleFullscreen]);

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
      <div
        ref={sceneContainerRef}
        tabIndex={0}
        role="region"
        aria-label="Grafo clínico tridimensional interativo"
        aria-describedby="neuroview-3d-keyboard-instructions"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown W A S D Shift+W Shift+S"
        onKeyDown={handleSceneKeyDown}
        onPointerDownCapture={(event) => event.currentTarget.focus({ preventScroll: true })}
        className={cn(
          "absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          darkMode ? "focus-visible:ring-cyan-100/72" : "focus-visible:ring-cyan-800/58",
        )}
      />
      <p id="neuroview-3d-keyboard-instructions" className="sr-only">
        Use as setas para rotacionar, W e S para aproximar ou afastar, A e D para deslocar lateralmente e Shift com W ou S para subir ou descer a câmera.
      </p>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-[120] flex items-start justify-between gap-3 p-4 lg:p-5">
        <div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 lg:top-5">
          <NeuroVisionFilterBar
            value={filter}
            onValueChange={handleFilterChange}
            ariaLabel="Filtrar NeuroVision 3D"
            darkMode={darkMode}
          />
          <Popover open={priorityInfoOpen} onOpenChange={setPriorityInfoOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Como a priorização do NeuroVision é calculada"
                title="Como a priorização é calculada"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full border shadow-lg backdrop-blur-2xl",
                  darkMode
                    ? "border-white/10 bg-black/42 text-white/66 hover:bg-white/10 hover:text-white"
                    : "border-black/10 bg-white/72 text-zinc-600 hover:bg-white hover:text-zinc-950",
                )}
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              portalContainer={portalContainer}
              align="center"
              sideOffset={10}
              className={cn(
                "w-[320px] rounded-[22px] border p-4 shadow-2xl backdrop-blur-3xl",
                darkMode
                  ? "border-white/10 bg-[#0c0c0f]/94 text-white"
                  : "border-black/10 bg-white/94 text-zinc-950",
              )}
            >
              <p className="text-sm font-semibold tracking-[-0.01em]">Como a priorização é calculada</p>
              <p className={cn("mt-1.5 text-[11px] leading-relaxed", darkMode ? "text-white/50" : "text-zinc-500")}>
                A posição e a aparência organizam apenas dados rastreáveis, sem criar novas inferências clínicas.
              </p>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[11px]">
                {[
                  ["Densidade", "30%"],
                  ["Tensão", "25%"],
                  ["Recência", "20%"],
                  ["Próxima ação", "15%"],
                  ["Prioridade do psicólogo", "10%"],
                ].map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className={darkMode ? "text-white/68" : "text-zinc-700"}>{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className={cn("mt-3 border-t pt-3 text-[10px] leading-relaxed", darkMode ? "border-white/8 text-white/42" : "border-black/8 text-zinc-500")}>
                Perto significa mais atenção; tamanho, mais densidade; pulso, mais tensão. Profundidade representa tempo e direção representa o tema revisado. Densidade combina recorrência (45%), variedade de fontes (35%) e vínculo revisado (20%). Risco permanece independente.
              </p>
            </PopoverContent>
          </Popover>
        </div>

        <div className={cn(
          "pointer-events-auto flex items-center gap-2 transition-[margin] duration-300 motion-reduce:transition-none",
          isPatientSidebarOpen && "ml-[248px]",
        )}>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setIsPatientSidebarOpen((open) => !open)}
            aria-label={isPatientSidebarOpen ? "Recolher pacientes e nós" : "Expandir pacientes e nós"}
            aria-expanded={isPatientSidebarOpen}
            title={isPatientSidebarOpen ? "Recolher pacientes e nós" : "Expandir pacientes e nós"}
            className={cn(
              "h-11 w-11 rounded-2xl border shadow-xl backdrop-blur-2xl",
              darkMode
                ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                : "border-black/10 bg-white/88 text-zinc-700 hover:bg-white",
            )}
          >
            <ChevronRight className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", isPatientSidebarOpen && "rotate-180")} />
          </Button>
          <Popover open={dynamicsOpen} onOpenChange={setDynamicsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Ajustar dinâmica do NeuroVision 3d"
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
              portalContainer={portalContainer}
              align="start"
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
                  Arraste esferas e ajuste o campo apenas para visualizar melhor. Nenhum valor clínico é recalculado.
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
          <DropdownMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Mais opções do NeuroVision 3d"
                title="Mais opções"
                className={cn(
                  "h-11 w-11 rounded-2xl border shadow-xl backdrop-blur-2xl",
                  darkMode
                    ? "border-white/10 bg-black/45 text-white hover:bg-white/10"
                    : "border-black/10 bg-white/72 text-zinc-900 hover:bg-white",
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              portalContainer={portalContainer}
              align="start"
              sideOffset={10}
              className={cn(
                "w-[270px] rounded-[20px] border p-2 shadow-2xl backdrop-blur-3xl",
                darkMode
                  ? "border-white/10 bg-[#0c0c0f]/94 text-white"
                  : "border-black/10 bg-white/94 text-zinc-950",
              )}
            >
              <DropdownMenuLabel className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-50">
                Visualização
              </DropdownMenuLabel>
              <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={cn(
                  "min-h-11 gap-3 rounded-xl px-3 text-xs",
                  darkMode ? "data-[state=open]:bg-white/10 focus:bg-white/10" : "data-[state=open]:bg-black/[0.055] focus:bg-black/[0.055]",
                )}>
                  <Orbit className="h-4 w-4" />
                  Lente clínica
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className={cn(
                  "w-[270px] rounded-[20px] border p-2 shadow-2xl backdrop-blur-3xl",
                  darkMode ? "border-white/10 bg-[#0c0c0f]/96 text-white" : "border-black/10 bg-white/96 text-zinc-950",
                )}>
                  <DropdownMenuLabel className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-50">Lente clínica</DropdownMenuLabel>
                  <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
                  <DropdownMenuRadioGroup value={lens} onValueChange={(value) => handleLensChange(value as NeuroVisionLens)}>
                    {LENS_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value} className={cn(
                        "my-0.5 min-h-12 rounded-xl pl-8 pr-3",
                        darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950",
                      )}>
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
              <DropdownMenuItem
                onSelect={() => toggleAutoRotate()}
                className={cn(
                  "min-h-11 gap-3 rounded-xl px-3 text-xs",
                  darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950",
                )}
              >
                {autoRotate ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="flex-1">{autoRotate ? "Pausar rotação" : "Iniciar rotação"}</span>
                <span className={cn("text-[10px]", darkMode ? "text-white/42" : "text-zinc-500")}>
                  {reducedMotion ? "Indisponível" : autoRotate ? "Ativa" : "Pausada"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => playEmergence()}
                className={cn(
                  "min-h-11 gap-3 rounded-xl px-3 text-xs",
                  darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950",
                )}
              >
                <Sparkles className="h-4 w-4" />
                Animar surgimento da rede
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => controllerRef.current?.resetCamera()}
                className={cn(
                  "min-h-11 gap-3 rounded-xl px-3 text-xs",
                  darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950",
                )}
              >
                <Crosshair className="h-4 w-4" />
                Reenquadrar visualização
              </DropdownMenuItem>
              {focusedPatientId ? (
                <DropdownMenuItem
                  onSelect={() => returnToPanorama()}
                  className={cn(
                    "min-h-11 gap-3 rounded-xl px-3 text-xs",
                    darkMode ? "focus:bg-white/10 focus:text-white" : "focus:bg-black/[0.055] focus:text-zinc-950",
                  )}
                >
                  <Orbit className="h-4 w-4" />
                  Voltar ao panorama
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator className={darkMode ? "bg-white/8" : "bg-black/8"} />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className={cn(
                  "min-h-11 gap-3 rounded-xl px-3 text-xs",
                  darkMode ? "data-[state=open]:bg-white/10 focus:bg-white/10" : "data-[state=open]:bg-black/[0.055] focus:bg-black/[0.055]",
                )}>
                  <Keyboard className="h-4 w-4" />
                  Navegação por teclado
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className={cn(
                  "w-[300px] rounded-[18px] border p-3 shadow-2xl backdrop-blur-3xl",
                  darkMode
                    ? "border-white/10 bg-[#0c0c0f]/96 text-white"
                    : "border-black/10 bg-white/96 text-zinc-950",
                )}>
                  <dl className="space-y-2.5 text-[11px]">
                    {[
                      ["←  →  ↑  ↓", "Rotacionar"],
                      ["W  S", "Aproximar ou afastar"],
                      ["A  D", "Mover para os lados"],
                      ["Shift + W  S", "Subir ou descer"],
                    ].map(([keys, description]) => (
                      <div key={keys} className="flex items-center justify-between gap-4">
                        <dt><kbd className={cn(
                          "inline-flex min-h-7 items-center rounded-lg border px-2 font-mono text-[10px] font-semibold",
                          darkMode ? "border-white/12 bg-white/[0.055]" : "border-black/10 bg-black/[0.035]",
                        )}>{keys}</kbd></dt>
                        <dd className={darkMode ? "text-white/62" : "text-zinc-600"}>{description}</dd>
                      </div>
                    ))}
                  </dl>
                  <DropdownMenuSeparator className={cn("my-3", darkMode ? "bg-white/8" : "bg-black/8")} />
                  <DropdownMenuItem
                    onSelect={() => focusSceneForKeyboard()}
                    className={cn(
                      "min-h-10 justify-center rounded-xl text-xs font-semibold",
                      darkMode ? "bg-white text-black focus:bg-white/90" : "bg-zinc-950 text-white focus:bg-zinc-800",
                    )}
                  >
                    Focar visualização
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <NeuroVisionSidebar
        patients={graphData.nodes
          .filter((node) => node.type === "patient")
          .map((node) => node.data as Patient)}
        graphData={graphData}
        darkMode={darkMode}
        searchValue={searchQuery}
        onSearchValueChange={setSearchQuery}
        isOpen={isPatientSidebarOpen}
        onOpenChange={setIsPatientSidebarOpen}
        onHoverNode={(nodeId) => {
          setHoveredNodeId(nodeId);
          controllerRef.current?.setHighlight(nodeId);
        }}
        onSelectPatient={(patient) => {
          const node = nodeById.get(`pat-${patient.id}`);
          if (node) activateNode(node);
        }}
        onSelectNode={activateNode}
      />

      <div className="pointer-events-none absolute right-5 top-[88px] z-30">
        <NeuroVisionInsightsPanel
          darkMode={darkMode}
          lens={lens}
          focusedPatient={focusedPatient || null}
          inspectedNode={inspectedNode}
          graphNodes={graphData.nodes}
          evidence={evidence}
          timeEnd={timeEnd}
          evidenceAvailable={evidenceAvailable}
          onInspectNode={inspectNode}
          onUpdateOverride={onUpdateEvidenceOverride}
          onAnnounce={setAnnouncement}
        />
      </div>

      {lens === "patterns" && evidenceTimeExtent ? (
        <div className={cn(
          "absolute bottom-[72px] left-1/2 z-30 w-[min(520px,calc(100%-3rem))] -translate-x-1/2 rounded-[22px] border px-4 py-3 shadow-2xl backdrop-blur-3xl",
          darkMode ? "border-white/10 bg-black/58" : "border-black/10 bg-white/82",
        )}>
          <div className="mb-2 flex items-center justify-between gap-4 text-[10px] font-medium">
            <span className={darkMode ? "text-white/52" : "text-zinc-500"}>História clínica</span>
            <output className="font-semibold">
              Até {new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(timeEnd || evidenceTimeExtent.max))}
            </output>
          </div>
          <Slider
            value={[timeProgress]}
            min={0}
            max={100}
            step={1}
            aria-label="Percorrer a história clínica no tempo"
            onValueChange={([value]) => setTimeProgress(value)}
            onValueCommit={() => setAnnouncement("Linha do tempo clínica atualizada.")}
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end p-5">
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-2 text-[10px] font-semibold tracking-wide shadow-lg backdrop-blur-xl",
            darkMode ? "border-white/10 bg-black/38 text-white/58" : "border-black/8 bg-white/62 text-zinc-600",
          )}
        >
          {profile === "full" ? "Renderização completa" : "Renderização leve"}
        </div>
      </div>

      {visibleNodeIds.size === 0 && !sceneError ? (
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
            <h2 className="text-lg font-semibold">NeuroVision 3d indisponível</h2>
            <p className="mt-2 text-sm text-muted-foreground">A visualização plana foi preservada. {sceneError}</p>
            <Button className="mt-5 rounded-xl" onClick={onBack}>Voltar ao NeuroVision plano</Button>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      {focusedPatient ? (
        <p className="sr-only">Paciente em foco: {focusedPatient.label}.</p>
      ) : null}
    </div>
  );
};

export const NeuroView3D = NeuroVision3D;
export default NeuroVision3D;
