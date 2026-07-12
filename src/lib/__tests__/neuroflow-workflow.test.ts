import { describe, expect, it } from 'vitest';
import {
  NEUROFLOW_WORKFLOW_SCHEMA,
  deserializeNeuroFlowWorkflow,
  serializeNeuroFlowWorkflow,
  parseStoredNeuroFlowWorkflow,
  validateNeuroFlowWorkflow,
} from '../neuroflow-workflow';

describe('neuroflow workflow v2', () => {
  it('serializes and deserializes nodes, edges and viewport', () => {
    const workflow = serializeNeuroFlowWorkflow({
      nodes: [
        { id: 'a', type: 'item', position: { x: 10.4, y: 20.6 }, data: { label: 'A', sourceNoteId: 'note-1' } },
        { id: 'b', type: 'diagnostic', position: { x: 120, y: 220 }, data: { label: 'B', patientId: 'patient-1' } },
      ],
      edges: [
        { id: 'edge-1', source: 'a', target: 'b', type: 'neural', data: { relation: 'sustenta', polarity: 'supports' } },
      ],
      viewport: { x: 1, y: 2, zoom: 0.85 },
      metadata: { title: 'Formulação' },
    });

    expect(workflow.schema).toBe(NEUROFLOW_WORKFLOW_SCHEMA);
    expect(workflow.edges).toHaveLength(1);
    expect(workflow.links.map((link) => link.type)).toEqual(expect.arrayContaining(['note', 'patient']));

    const restored = deserializeNeuroFlowWorkflow(workflow);
    expect(restored.nodes[0].position).toEqual({ x: 10, y: 21 });
    expect(restored.edges[0].source).toBe('a');
  });

  it('rejects edges pointing to missing nodes', () => {
    expect(() => validateNeuroFlowWorkflow({
      schema: NEUROFLOW_WORKFLOW_SCHEMA,
      nodes: [{ id: 'a', type: 'item', position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: 'edge-1', source: 'a', target: 'missing' }],
      viewport: {},
      metadata: {},
      links: [],
    })).toThrow(/conexao invalida/i);
  });

  it('repairs legacy mojibake while loading a stored workflow', () => {
    const restored = parseStoredNeuroFlowWorkflow({
      schema: NEUROFLOW_WORKFLOW_SCHEMA,
      nodes: [{ id: 'a', type: 'item', position: { x: 0, y: 0 }, data: { label: 'HipÃ³tese clÃ­nica' } }],
      edges: [],
      viewport: {},
      metadata: { title: 'SessÃ£o inicial' },
      links: [],
    });

    expect(restored?.nodes[0].data.label).toBe('Hipótese clínica');
    expect(restored?.metadata.title).toBe('Sessão inicial');
  });
});
