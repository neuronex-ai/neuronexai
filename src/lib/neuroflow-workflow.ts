import type { Edge, Node, Viewport } from 'reactflow';
import { repairTextEncodingDeep } from '@/lib/text-encoding';

export const NEUROFLOW_WORKFLOW_SCHEMA = 'neuroflow.workflow.v2' as const;

export type NeuroFlowWorkflowSchema = typeof NEUROFLOW_WORKFLOW_SCHEMA;

export type NeuroFlowLinkType = 'patient' | 'note' | 'file' | 'neuropulse' | 'neuroflow' | 'mermaid';

export interface NeuroFlowWorkflowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  selected?: boolean;
  data: Record<string, unknown>;
}

export interface NeuroFlowWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string | null;
  animated?: boolean;
  data?: {
    relation?: string;
    strength?: number;
    polarity?: 'supports' | 'challenges' | 'neutral' | string;
    hypothesis?: string;
    [key: string]: unknown;
  };
}

export interface NeuroFlowWorkflowLink {
  type: NeuroFlowLinkType;
  id: string;
  nodeId?: string;
  label?: string;
}

export interface NeuroFlowWorkflow {
  schema: NeuroFlowWorkflowSchema;
  nodes: NeuroFlowWorkflowNode[];
  edges: NeuroFlowWorkflowEdge[];
  viewport: Partial<Viewport>;
  metadata: {
    title?: string;
    patientId?: string | null;
    ownerScope?: 'patient' | 'professional' | 'none';
    updatedAt?: string;
    [key: string]: unknown;
  };
  links: NeuroFlowWorkflowLink[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const sanitizeJsonValue = (value: unknown): unknown => {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return repairTextEncodingDeep(value);
  if (Array.isArray(value)) return value.map(sanitizeJsonValue).filter((item) => item !== undefined);
  if (!isRecord(value)) return undefined;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, sanitizeJsonValue(item)] as const)
      .filter(([, item]) => item !== undefined)
  );
};

const sanitizeJsonRecord = (value: unknown): Record<string, unknown> => {
  const sanitized = sanitizeJsonValue(value);
  return isRecord(sanitized) ? sanitized : {};
};

export const emptyNeuroFlowWorkflow = (metadata: NeuroFlowWorkflow['metadata'] = {}): NeuroFlowWorkflow => ({
  schema: NEUROFLOW_WORKFLOW_SCHEMA,
  nodes: [],
  edges: [],
  viewport: {},
  metadata: repairTextEncodingDeep(metadata),
  links: [],
});

export const serializeNeuroFlowWorkflow = ({
  nodes,
  edges,
  viewport,
  metadata = {},
}: {
  nodes: Node[];
  edges: Edge[];
  viewport: Partial<Viewport>;
  metadata?: NeuroFlowWorkflow['metadata'];
}): NeuroFlowWorkflow => {
  const workflow: NeuroFlowWorkflow = {
    schema: NEUROFLOW_WORKFLOW_SCHEMA,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type || 'item',
      position: {
        x: Math.round(finiteNumber(node.position?.x)),
        y: Math.round(finiteNumber(node.position?.y)),
      },
      width: typeof node.width === 'number' ? node.width : null,
      height: typeof node.height === 'number' ? node.height : null,
      selected: false,
      data: sanitizeJsonRecord(node.data),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      type: edge.type || 'neural',
      label: typeof edge.label === 'string' ? repairTextEncodingDeep(edge.label) : null,
      animated: edge.animated ?? true,
      data: sanitizeJsonRecord(edge.data),
    })),
    viewport: {
      x: finiteNumber(viewport.x),
      y: finiteNumber(viewport.y),
      zoom: finiteNumber(viewport.zoom, 1),
    },
    metadata: {
      ...repairTextEncodingDeep(metadata),
      updatedAt: new Date().toISOString(),
    },
    links: collectWorkflowLinks(nodes),
  };

  return validateNeuroFlowWorkflow(workflow);
};

export const deserializeNeuroFlowWorkflow = (workflow: NeuroFlowWorkflow): { nodes: Node[]; edges: Edge[]; viewport: Partial<Viewport> } => ({
  nodes: workflow.nodes.map((node) => ({
    id: node.id,
    type: node.type || 'item',
    position: node.position,
    width: node.width || undefined,
    height: node.height || undefined,
    data: { ...(node.data || {}) },
  })),
  edges: workflow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    type: edge.type || 'neural',
    label: edge.label || undefined,
    animated: edge.animated ?? true,
    data: edge.data || {},
  })),
  viewport: workflow.viewport || {},
});

export const validateNeuroFlowWorkflow = (workflow: NeuroFlowWorkflow): NeuroFlowWorkflow => {
  if (workflow.schema !== NEUROFLOW_WORKFLOW_SCHEMA) {
    throw new Error('NeuroFlow workflow schema invalido.');
  }

  const nodeIds = new Set(workflow.nodes.map((node) => node.id).filter(Boolean));
  if (nodeIds.size !== workflow.nodes.length) {
    throw new Error('NeuroFlow workflow contem nodes sem id ou ids duplicados.');
  }

  const invalidEdge = workflow.edges.find((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target));
  if (invalidEdge) {
    throw new Error(`NeuroFlow workflow contem conexao invalida: ${invalidEdge.id}.`);
  }

  return workflow;
};

export const parseStoredNeuroFlowWorkflow = (value: unknown): NeuroFlowWorkflow | null => {
  if (!isRecord(value) || value.schema !== NEUROFLOW_WORKFLOW_SCHEMA) return null;

  const repaired = repairTextEncodingDeep(value);

  return validateNeuroFlowWorkflow({
    schema: NEUROFLOW_WORKFLOW_SCHEMA,
    nodes: Array.isArray(repaired.nodes) ? repaired.nodes as NeuroFlowWorkflowNode[] : [],
    edges: Array.isArray(repaired.edges) ? repaired.edges as NeuroFlowWorkflowEdge[] : [],
    viewport: isRecord(repaired.viewport) ? repaired.viewport : {},
    metadata: isRecord(repaired.metadata) ? repaired.metadata : {},
    links: Array.isArray(repaired.links) ? repaired.links as NeuroFlowWorkflowLink[] : [],
  });
};

const collectWorkflowLinks = (nodes: Node[]): NeuroFlowWorkflowLink[] => {
  const links = new Map<string, NeuroFlowWorkflowLink>();

  const add = (link: NeuroFlowWorkflowLink) => {
    links.set(`${link.type}:${link.id}:${link.nodeId || ''}`, link);
  };

  nodes.forEach((node) => {
    const data = isRecord(node.data) ? node.data : {};
    if (typeof data.patientId === 'string') add({ type: 'patient', id: data.patientId, nodeId: node.id });
    if (typeof data.sourceNoteId === 'string') add({ type: 'note', id: data.sourceNoteId, nodeId: node.id, label: String(data.label || '') });
    if (typeof data.linkedNoteId === 'string') add({ type: 'note', id: data.linkedNoteId, nodeId: node.id, label: String(data.label || '') });
    if (typeof data.filePath === 'string') add({ type: 'file', id: data.filePath, nodeId: node.id, label: String(data.fileName || data.label || '') });
    if (typeof data.neuroPulseId === 'string') add({ type: 'neuropulse', id: data.neuroPulseId, nodeId: node.id, label: String(data.label || '') });
    if (typeof data.mermaidCode === 'string') add({ type: 'mermaid', id: node.id, nodeId: node.id, label: String(data.label || 'Mermaid') });
    if (typeof data.flowId === 'string') add({ type: 'neuroflow', id: data.flowId, nodeId: node.id, label: String(data.label || '') });
  });

  return Array.from(links.values());
};
