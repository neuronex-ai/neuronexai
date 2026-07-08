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
    ChevronLeft, Layers, Loader2, Lock, Maximize, Plus, Unlock, ZoomIn, ZoomOut
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
import { useSynapseNotesAgentRun } from '@/hooks/use-synapse-notes-agent-run';
import { SynapseAgentRunOverlay } from './SynapseAgentRunOverlay';

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

interface NeuroFlowContentProps {
  flowId?: string;
  synapseRunId?: string | null;
  onBack?: () => void;
}

const NeuroFlowContent = ({ flowId, synapseRunId, onBack }: NeuroFlowContentProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { run: synapseRun } = useSynapseNotesAgentRun(synapseRunId);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const saveRevisionRef = useRef<number | null>(null);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const isLoadingRef = useRef(true);
  const isHydratingRef = useRef(false);
  const hasAutoFittedRef = useRef(false);
  const flowTitleRef = useRef(flowTitle);
  const patientIdRef = useRef(patientId);
  const saveStateRef = useRef<() => Promise<void>>(async () => undefined);
  const { screenToFlowPosition, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const { theme } = useTheme();

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
    isHydratingRef.current = true;
    hasAutoFittedRef.current = false;
    setIsLoading(true);
    try {
      const { data: flowData, error: flowError } = await supabase
        .from('neuro_flows')
        .select('title, patient_id, workflow, save_revision')
        .eq('id', flowId)
        .single();

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

      setNodes(nextNodes.map(attachRuntimeNodeData));
      setEdges(restored.edges.map((edge) => ({
        ...edge,
        type: edge.type || 'neural',
        animated: edge.animated ?? true,
      })));

      lastSavedFingerprintRef.current = JSON.stringify({
        nodes: workflow.nodes,
        edges: workflow.edges,
        metadata: {
          ...workflow.metadata,
          updatedAt: undefined,
        },
      });
    } catch (e) {
      console.error(e);
    } finally {
      window.setTimeout(() => {
        isHydratingRef.current = false;
        setIsLoading(false);
        setSaveStatus('saved');
      }, 0);
    }
  }, [attachRuntimeNodeData, flowId, setNodes, setEdges]);

  useEffect(() => { loadFlow(); }, [loadFlow]);

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
    if (!flowId || isLoadingRef.current || isHydratingRef.current) return;
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
    if (!flowId || isLoadingRef.current || isHydratingRef.current) return;
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
      animated: true
    }, eds));
  }, [setEdges]);

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

  return (
    <div
      className="relative isolate h-full min-h-0 w-full min-w-0 overflow-hidden bg-transparent [contain:layout_paint_size] transition-colors duration-500"
      ref={reactFlowWrapper as any}
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
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/70 text-foreground transition-all mr-1"
              aria-label="Voltar"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>

            <div className="w-px h-6 bg-border/70 mx-1" />

            <button onClick={() => zoomIn()} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all" aria-label="Aproximar"><ZoomIn size={18} /></button>
            <button onClick={() => zoomOut()} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all" aria-label="Afastar"><ZoomOut size={18} /></button>
            <button onClick={() => fitView()} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all" aria-label="Ajustar visualizacao"><Maximize size={18} /></button>

            <div className="w-px h-6 bg-border/70 mx-1" />

            <button onClick={() => setIsLocked(!isLocked)} className={cn(
              "h-10 w-10 flex items-center justify-center rounded-xl transition-all",
              isLocked
                ? "bg-foreground text-background shadow-lg"
                : "hover:bg-muted/70 text-muted-foreground hover:text-foreground"
            )} aria-label={isLocked ? "Desbloquear canvas" : "Bloquear canvas"}>
              {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
          </div>
        </Panel>

        <Panel position="top-right" className="m-12">
          <Button
            onClick={() => setIsLibraryOpen(true)}
            className="notes-toolbar-surface h-14 w-14 rounded-full border text-foreground hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            aria-label="Adicionar bloco"
          >
            <Plus size={24} strokeWidth={3} />
          </Button>
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

      <SynapseAgentRunOverlay run={synapseRun} title="Synapse / NeuroFlow" compact />

      <style>{`
        .react-flow__viewport {
          transition: transform 0.1s ease-out;
        }
      `}</style>
    </div>
  );
};

export const NeuroFlow = (props: any) => (
  <ReactFlowProvider>
    <NeuroFlowContent {...props} />
  </ReactFlowProvider>
);
