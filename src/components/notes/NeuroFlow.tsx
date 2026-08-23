"use client";

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/integrations/supabase/client';
import {
    deserializeNeuroFlowWorkflow,
    emptyNeuroFlowWorkflow,
    parseStoredNeuroFlowWorkflow,
    serializeNeuroFlowWorkflow
} from '@/lib/neuroflow-workflow';
import { cn } from '@/lib/utils';
import {
    AlertTriangle, ChevronLeft, Layers, Loader2, Lock, Maximize, Plus, Route, RotateCcw, Unlock, ZoomIn, ZoomOut
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
    addEdge, Background, Connection,
    Edge,
    Node, Panel, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toast } from 'sonner';
import NeuralEdge from './NeuralEdge';
import NeuralNode from './NeuralNode';
import { NeuroFlowEditModal } from './NeuroFlowEditModal';
import { NeuroFlowPreviewModal } from './NeuroFlowPreviewModal';
import { BridgeNode } from './nodes/BridgeNode';
import { DiagnosticNode } from './nodes/DiagnosticNode';
import { MoodNode } from './nodes/MoodNode';
import { TableNode } from './nodes/TableNode';
import { TranscriptionNode } from './nodes/TranscriptionNode';
import { NodeType, SegundoCerebro } from './SegundoCerebro';
import { useReducedMotion } from 'framer-motion';
import { useSynapseNotesAgentRun } from '@/hooks/use-synapse-notes-agent-run';

const nodeTypes = {
  start: NeuralNode,
  root: NeuralNode,
  'free-note': NeuralNode,
  'linked-note': NeuralNode,
  patient: NeuralNode,
  evidence: NeuralNode,
  trigger: NeuralNode,
  thought: NeuralNode,
  emotion: NeuralNode,
  behavior: NeuralNode,
  'body-sensation': NeuralNode,
  belief: NeuralNode,
  schema: NeuralNode,
  'cognitive-distortion': NeuralNode,
  'defense-mechanism': NeuralNode,
  resource: NeuralNode,
  risk: NeuralNode,
  intervention: NeuralNode,
  task: NeuralNode,
  router: NeuralNode,
  condition: NeuralNode,
  loop: NeuralNode,
  stop: NeuralNode,
  neuropulse: NeuralNode,
  mermaid: NeuralNode,
  'neuroview-patient': NeuralNode,
  category: NeuralNode,
  action: NeuralNode,
  item: NeuralNode,
  logic: NeuralNode,
  quote: NeuralNode,
  document: NeuralNode,
  anamnesis: NeuralNode,
  somatic: NeuralNode,
  timeline: NeuralNode,
  mood: MoodNode,
  table: TableNode,
  diagnostic: DiagnosticNode,
  transcription: TranscriptionNode,
  bridge: BridgeNode,
};

const edgeTypes = {
  neural: NeuralEdge,
};

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

const flowToolbarButtonClass =
  "h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:active:scale-100";

interface NeuroFlowContentProps {
  flowId?: string;
  synapseRunId?: string | null;
  onBack?: () => void;
}

const NeuroFlowContent = ({ flowId, synapseRunId, onBack }: NeuroFlowContentProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [flowTitle, setFlowTitle] = useState("NeuroFlow Studio");
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const retrySaveTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const latestGraphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const stagedGraphRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const revealedNodeIdsRef = useRef<Set<string>>(new Set());
  const isSynapseReplayingRef = useRef(Boolean(synapseRunId));
  const saveRevisionRef = useRef<number | null>(null);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const isLoadingRef = useRef(true);
  const isHydratingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const hasAutoFittedRef = useRef(false);
  const flowTitleRef = useRef(flowTitle);
  const patientIdRef = useRef(patientId);
  const saveStateRef = useRef<() => Promise<void>>(async () => undefined);
  const { screenToFlowPosition, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const { events, playedEvents, eventsLoaded } = useSynapseNotesAgentRun(synapseRunId);

  // Modal States
  const [editModalNoteId, setEditModalNoteId] = useState<string | null>(null);
  const [previewModalFileData, setPreviewModalFileData] = useState<any | null>(null);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    flowTitleRef.current = flowTitle;
  }, [flowTitle]);

  useEffect(() => {
    patientIdRef.current = patientId;
  }, [patientId]);

  const updateNodeData = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setNodes((currentNodes) => currentNodes.map((node) =>
      node.id === nodeId
        ? { ...node, data: { ...(node.data || {}), ...patch } }
        : node
    ));
  }, [setNodes]);

  const attachRuntimeNodeData = useCallback((node: Node): Node => ({
    ...node,
    data: {
      ...(node.data || {}),
      onUpdateNodeData: updateNodeData,
    },
  }), [updateNodeData]);

  useEffect(() => {
    const handleOpenLib = () => setIsLibraryOpen(true);
    window.addEventListener('open-synaptic-library', handleOpenLib);
    return () => window.removeEventListener('open-synaptic-library', handleOpenLib);
  }, []);

  const loadFlow = useCallback(async () => {
    if (!flowId) return;
    const requestId = ++loadRequestRef.current;
    let loaded = false;
    isHydratingRef.current = true;
    hasAutoFittedRef.current = false;
    setIsLoading(true);
    setLoadError(null);
    try {
      const fetchFlow = () => supabase
          .from('neuro_flows')
          .select('title, patient_id, workflow, save_revision')
          .eq('id', flowId)
          .single();

      let { data: flowData, error: flowError } = await fetchFlow();
      for (let attempt = 0; attempt < 2 && flowError?.code === 'PGRST116'; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 240 * (attempt + 1)));
        const next = await fetchFlow();
        flowData = next.data;
        flowError = next.error;
      }

      if (requestId !== loadRequestRef.current) return;

      if (flowError) throw flowError;

      const currentPatientId = flowData?.patient_id;
      setPatientId(currentPatientId);
      setFlowTitle(flowData?.title || "NeuroFlow Studio");
      saveRevisionRef.current = typeof flowData?.save_revision === 'number' ? flowData.save_revision : 0;

      const workflow = parseStoredNeuroFlowWorkflow(flowData?.workflow)
        || emptyNeuroFlowWorkflow({
          title: flowData?.title || "NeuroFlow Studio",
          patientId: currentPatientId,
          ownerScope: currentPatientId ? 'patient' : 'none',
        });

      const restored = deserializeNeuroFlowWorkflow(workflow);
      const nextNodes = restored.nodes.length > 0
        ? restored.nodes.map((node) => ({
          ...node,
          data: { ...(node.data || {}), patientId: (node.data as any)?.patientId || currentPatientId },
        }))
        : [{
          id: 'root',
          type: 'root',
          position: { x: 250, y: 250 },
          data: { label: 'Início da Sessão', patientId: currentPatientId }
        }];

      const hydratedNodes = nextNodes.map(attachRuntimeNodeData);
      const hydratedEdges = restored.edges.map((edge) => ({
        ...edge,
        type: edge.type || 'neural',
        animated: shouldReduceMotion ? false : edge.animated ?? true,
      }));
      stagedGraphRef.current = { nodes: hydratedNodes, edges: hydratedEdges };
      if (synapseRunId) {
        setNodes([]);
        setEdges([]);
      } else {
        setNodes(hydratedNodes);
        setEdges(hydratedEdges);
      }

      lastSavedFingerprintRef.current = JSON.stringify({
        nodes: workflow.nodes,
        edges: workflow.edges,
        metadata: {
          ...workflow.metadata,
          updatedAt: undefined,
        },
      });
      loaded = true;
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('synapse:surface-ready', {
          detail: { target: 'neuroflow-canvas', runId: synapseRunId || null, flowId },
        }));
      });
    } catch (e) {
      if (requestId !== loadRequestRef.current) return;
      console.error("[NeuroFlow] Não foi possível carregar o mapeamento", e);
      setLoadError("Não foi possível abrir este mapeamento agora.");
    } finally {
      if (requestId === loadRequestRef.current) {
        window.setTimeout(() => {
          isHydratingRef.current = false;
          setIsLoading(false);
          setSaveStatus(loaded ? 'saved' : 'error');
        }, 0);
      }
    }
  }, [attachRuntimeNodeData, flowId, setNodes, setEdges, shouldReduceMotion, synapseRunId]);

  useEffect(() => {
    if (!synapseRunId || isLoading || !eventsLoaded) return;
    const staged = stagedGraphRef.current;
    const hasProtocol = events.length > 0;
    const completed = playedEvents.some((event) => event.event_type === 'complete');
    isSynapseReplayingRef.current = hasProtocol && !completed;

    if (!hasProtocol || completed) {
      revealedNodeIdsRef.current = new Set(staged.nodes.map((node) => node.id));
      setNodes(staged.nodes);
      setEdges(staged.edges);
      if (staged.nodes.length) {
        window.requestAnimationFrame(() => fitView({ padding: 0.28, duration: shouldReduceMotion ? 0 : 520 }));
      }
      return;
    }

    const visibleNodeIds = new Set(
      playedEvents
        .filter((event) => event.event_type === 'node_reveal')
        .map((event) => String(event.payload.nodeId || ''))
        .filter(Boolean),
    );
    const visibleEdgeIds = new Set(
      playedEvents
        .filter((event) => event.event_type === 'edge_reveal')
        .map((event) => String(event.payload.edgeId || ''))
        .filter(Boolean),
    );
    const newlyRevealedIds = new Set(Array.from(visibleNodeIds).filter((id) => !revealedNodeIdsRef.current.has(id)));
    revealedNodeIdsRef.current = visibleNodeIds;
    const visibleNodes = staged.nodes
      .filter((node) => visibleNodeIds.has(node.id))
      .map((node) => ({
        ...node,
        style: {
          ...(node.style || {}),
          opacity: newlyRevealedIds.has(node.id) && !shouldReduceMotion ? 0 : 1,
          filter: newlyRevealedIds.has(node.id) && !shouldReduceMotion ? 'blur(8px)' : 'blur(0px)',
          transition: 'opacity 360ms cubic-bezier(0.22, 1, 0.36, 1), filter 420ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
      }));
    const visibleEdges = staged.edges.filter((edge) => (
      visibleEdgeIds.has(edge.id)
      && visibleNodeIds.has(edge.source)
      && visibleNodeIds.has(edge.target)
    ));
    setNodes(visibleNodes);
    setEdges(visibleEdges);
    if (newlyRevealedIds.size && !shouldReduceMotion) {
      window.requestAnimationFrame(() => setNodes((current) => current.map((node) => (
        newlyRevealedIds.has(node.id)
          ? { ...node, style: { ...(node.style || {}), opacity: 1, filter: 'blur(0px)' } }
          : node
      ))));
    }

    const latestNode = visibleNodes[visibleNodes.length - 1];
    if (latestNode && !shouldReduceMotion) {
      window.requestAnimationFrame(() => fitView({ nodes: [latestNode], padding: 1.2, duration: 420, minZoom: 0.52, maxZoom: 0.9 }));
    }
  }, [events.length, eventsLoaded, fitView, isLoading, playedEvents, setEdges, setNodes, shouldReduceMotion, synapseRunId]);

  useEffect(() => {
    void loadFlow();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadFlow]);

  useEffect(() => {
    return () => {
      if (retrySaveTimerRef.current) {
        window.clearTimeout(retrySaveTimerRef.current);
      }
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Sincronização automática
  useEffect(() => {
    latestGraphRef.current = { nodes, edges };
  }, [nodes, edges]);

  const saveState = useCallback(async () => {
    if (!flowId || isLoadingRef.current || isHydratingRef.current || isSynapseReplayingRef.current) return;
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    isSavingRef.current = true;
    setSaveStatus('saving');
    let saveFailed = false;
    try {
      const { nodes: nodesToSave, edges: edgesToSave } = latestGraphRef.current;
      const workflow = serializeNeuroFlowWorkflow({
        nodes: nodesToSave,
        edges: edgesToSave,
        viewport: getViewport(),
        metadata: {
          title: flowTitleRef.current,
          patientId: patientIdRef.current,
          ownerScope: patientIdRef.current ? 'patient' : 'none',
        },
      });
      const nextFingerprint = JSON.stringify({
        nodes: workflow.nodes,
        edges: workflow.edges,
        viewport: workflow.viewport,
        metadata: {
          ...workflow.metadata,
          updatedAt: undefined,
        },
        links: workflow.links,
      });

      if (nextFingerprint === lastSavedFingerprintRef.current) {
        setSaveStatus('saved');
        return;
      }

      const { data, error } = await supabase.rpc('save_neuroflow_workflow' as any, {
        p_flow_id: flowId,
        p_workflow: workflow as any,
        p_expected_revision: saveRevisionRef.current,
      });

      if (error) throw error;

      const saved = Array.isArray(data) ? data[0] : data;
      if (saved && typeof saved.save_revision === 'number') {
        saveRevisionRef.current = saved.save_revision;
      }
      lastSavedFingerprintRef.current = nextFingerprint;
      setSaveStatus('saved');

    } catch (e) {
      saveFailed = true;
      console.error("[NeuroFlow] Erro ao salvar estado:", e);
      const errorMessage = e instanceof Error ? e.message : String((e as any)?.message || e);
      const isConflict = errorMessage.includes('save_conflict');
      setSaveStatus(isConflict ? 'conflict' : 'error');
      if (isConflict) {
        const { data: currentFlow } = await supabase
          .from('neuro_flows')
          .select('save_revision')
          .eq('id', flowId)
          .maybeSingle();

        if (typeof currentFlow?.save_revision === 'number') {
          saveRevisionRef.current = currentFlow.save_revision;
        }
      }
      pendingSaveRef.current = true;
      if (!retrySaveTimerRef.current) {
        retrySaveTimerRef.current = window.setTimeout(() => {
          retrySaveTimerRef.current = null;
          if (pendingSaveRef.current) {
            pendingSaveRef.current = false;
            void saveState();
          }
        }, 2500);
      }
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current && !saveFailed) {
        pendingSaveRef.current = false;
        window.setTimeout(() => void saveState(), 100);
      }
    }
  }, [flowId, getViewport]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  const scheduleSave = useCallback((delay = 1200) => {
    if (!flowId || isLoadingRef.current || isHydratingRef.current || isSynapseReplayingRef.current) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    setSaveStatus((current) => current === 'saving' ? current : 'pending');
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveStateRef.current();
    }, delay);
  }, [flowId]);

  useEffect(() => {
    if (isLoading || isHydratingRef.current) return;
    scheduleSave(1100);
  }, [nodes, edges, isLoading, scheduleSave]);

  useEffect(() => {
    return () => {
      void saveStateRef.current();
    };
  }, []);

  const handleInit = useCallback((instance: any) => {
    if (hasAutoFittedRef.current) return;
    hasAutoFittedRef.current = true;
    window.requestAnimationFrame(() => {
      instance.fitView({ padding: 0.32, duration: 0, minZoom: 0.35, maxZoom: 1.15 });
    });
  }, []);

  const handleMoveEnd = useCallback(() => {
    scheduleSave(2200);
  }, [scheduleSave]);

  const onConnect = useCallback((params: Connection | Edge) => {
    const edgeId = `edge-${crypto.randomUUID()}`;
    setEdges((eds) => addEdge({
      ...params,
      id: edgeId,
      type: 'neural',
      animated: !shouldReduceMotion
    }, eds));
  }, [setEdges, shouldReduceMotion]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow/type') as NodeType;
      const rawData = event.dataTransfer.getData('application/reactflow/data');
      const extraData = rawData ? JSON.parse(rawData) : {};

      if (!type || !reactFlowWrapper.current) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: {
          label: extraData.label || `Novo Bloco`,
          patientId, // Pass the patientId context
          ...extraData,
          onUpdateNodeData: updateNodeData,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, patientId, updateNodeData]
  );

  const onAddNode = useCallback((type: NodeType, data: any) => {
    // Get center of viewport
    const viewport = getViewport();
    const center = {
      x: -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom,
      y: -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom,
    };

    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position: center,
      data: {
        label: data.label || `Novo Bloco`,
        patientId,
        ...data,
        onUpdateNodeData: updateNodeData,
      },
    };

    setNodes((nds) => nds.concat(newNode));
  }, [getViewport, setNodes, patientId, updateNodeData]);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'document') {
      setPreviewModalFileData({ id: node.id, label: node.data.label, ...node.data });
    } else {
      // Prioritize sourceNoteId (imported notes from Notas tab)
      const sourceNoteId = node.data.sourceNoteId;
      const linkedId = node.data.linkedNoteIds?.[0];
      const noteIdToEdit = sourceNoteId || linkedId;
      if (noteIdToEdit) {
        setEditModalNoteId(noteIdToEdit);
      } else {
        toast.info("Importe uma nota da Biblioteca ou vincule uma nota a este bloco.");
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-transparent transition-colors duration-500">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-900 dark:text-white mb-6" />
        <p className="text-[10px] text-zinc-400 dark:text-zinc-700 font-black uppercase tracking-[0.6em]">Processando</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-transparent px-6">
        <section
          className="w-full max-w-[520px] rounded-[26px] border border-border/60 bg-card/90 p-6 text-center shadow-xl backdrop-blur-xl dark:border-white/[0.075] dark:bg-[linear-gradient(145deg,rgba(24,24,25,0.94),rgba(10,10,11,0.96))]"
          role="alert"
          aria-labelledby="neuroflow-load-error-title"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] border border-border/60 bg-muted/60 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.045]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id="neuroflow-load-error-title" className="mt-5 text-lg font-semibold tracking-[-0.02em] text-foreground">
            Não foi possível abrir o NeuroFlow
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            O mapeamento pode ainda estar sendo preparado. Tente novamente em alguns instantes.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            {onBack ? (
              <Button variant="outline" className="min-h-11 rounded-[14px]" onClick={onBack}>
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Voltar aos mapeamentos
              </Button>
            ) : null}
            <Button className="min-h-11 rounded-[14px]" onClick={() => void loadFlow()}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="relative isolate h-full min-h-0 w-full min-w-0 overflow-hidden bg-transparent [contain:layout_paint_size] transition-colors duration-500"
      ref={reactFlowWrapper as any}
      data-synapse-target="neuroflow-canvas"
      data-synapse-ready="true"
      data-synapse-run-id={synapseRunId || undefined}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={handleInit}
        onMoveEnd={handleMoveEnd}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        className="bg-transparent"
      >
        <Background
          color={theme === 'dark' ? "#ffffff" : "#000000"}
          gap={100}
          size={1}
          style={{ opacity: theme === 'dark' ? 0.02 : 0.05 }}
        />

        {/* HUD Overlay */}
        <Panel position="top-left" className="m-12">
          <div className="notes-toolbar-surface flex items-center gap-2 rounded-2xl border p-2 backdrop-blur-3xl">
            <button
              type="button"
              onClick={onBack}
              className={cn(flowToolbarButtonClass, "mr-1 text-foreground")}
              aria-label="Voltar"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>

            <div className="w-px h-6 bg-border/70 mx-1" />

            <button type="button" onClick={() => zoomIn()} className={flowToolbarButtonClass} aria-label="Aproximar"><ZoomIn size={18} /></button>
            <button type="button" onClick={() => zoomOut()} className={flowToolbarButtonClass} aria-label="Afastar"><ZoomOut size={18} /></button>
            <button type="button" onClick={() => fitView({ duration: shouldReduceMotion ? 0 : 400 })} className={flowToolbarButtonClass} aria-label="Ajustar visualizacao"><Maximize size={18} /></button>

            <div className="w-px h-6 bg-border/70 mx-1" />

            <button type="button" onClick={() => setIsLocked(!isLocked)} className={cn(
              flowToolbarButtonClass,
              isLocked
                ? "bg-foreground text-background shadow-lg"
                : ""
            )} aria-label={isLocked ? "Desbloquear canvas" : "Bloquear canvas"}>
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
          </div>
        </Panel>

        <Panel position="top-right" className="m-12">
          <Button
            onClick={() => setIsLibraryOpen(true)}
            className="notes-toolbar-surface h-14 w-14 rounded-full border text-foreground transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 flex items-center justify-center"
            aria-label="Adicionar bloco"
          >
            <Plus size={24} strokeWidth={3} />
          </Button>
        </Panel>

        <Panel position="top-center" className="mt-12">
          <div className="notes-toolbar-surface flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-[10px] font-semibold text-muted-foreground backdrop-blur-3xl">
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            Acompanhamento de hipóteses revisadas · mudanças voltam ao NeuroVision
          </div>
        </Panel>

        <SegundoCerebro isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onAddNode={onAddNode} />

        {/* Modals */}
        <NeuroFlowEditModal
          noteId={editModalNoteId}
          isOpen={!!editModalNoteId}
          onClose={() => setEditModalNoteId(null)}
        />
        <NeuroFlowPreviewModal
          fileData={previewModalFileData}
          isOpen={!!previewModalFileData}
          onClose={() => setPreviewModalFileData(null)}
        />

        <Panel position="bottom-center" className="mb-12">
          <div className="notes-toolbar-surface px-10 py-5 border backdrop-blur-[40px] rounded-full flex items-center gap-10">
            <div className="flex items-center gap-4">
              <Layers size={14} className="text-muted-foreground" />
              <span className="text-[10px] font-black text-foreground uppercase tracking-[0.32em]">{nodes.length} Blocos / {edges.length} Conexões</span>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' ? (
                <Loader2 size={12} className="animate-spin text-primary" />
              ) : saveStatus === 'error' || saveStatus === 'conflict' ? (
                <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_hsl(38_92%_50%/0.35)]" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]" />
              )}
              <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">
                {saveStatus === 'saving' ? "Salvando" : saveStatus === 'pending' ? "Pendente" : saveStatus === 'conflict' ? "Conflito" : saveStatus === 'error' ? "Pendente" : "Salvo"}
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>

      <style>{`
        .react-flow__viewport {
          transition: ${shouldReduceMotion ? "none" : "transform 0.1s ease-out"};
        }
      `}</style>
    </div>
  );
};

export const NeuroFlow = (props: NeuroFlowContentProps) => (
  <ReactFlowProvider>
    <NeuroFlowContent {...props} />
  </ReactFlowProvider>
);
