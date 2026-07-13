import { executeAgentTool } from "./executor.ts";

const equal = (actual: unknown, expected: unknown, label: string) => {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
  }
};

const context = {
  admin: {},
  userId: "user-test",
  sessionId: "session-test",
};

Deno.test("ação contínua do NeuroView preserva subgrafo, foco e modo", async () => {
  const result = await executeAgentTool("request_interface_action", {
    action: "open_neuroview_reasoning",
    patient_id: "patient-123456",
    notes_view: "neuroview",
    neuroview_scope: "subgraph",
    neuroview_mode: "3d",
    neuroview_node_ids: ["pat-patient-123456", "note-note-123456", "note-note-123456"],
    neuroview_focus_node_id: "note-note-123456",
  }, context);

  equal(result.ok, true, "resultado");
  equal(result.clientAction?.data?.neuroViewScope, "subgraph", "escopo");
  equal(result.clientAction?.data?.neuroViewMode, "3d", "modo");
  equal(result.clientAction?.data?.neuroViewNodeIds?.length, 2, "nodes únicos");
  equal(result.clientAction?.data?.neuroViewFocusNodeId, "note-note-123456", "foco");
});

Deno.test("subgrafo sem IDs não produz uma ação visual vazia", async () => {
  const result = await executeAgentTool("request_interface_action", {
    action: "open_neuroview_reasoning",
    neuroview_scope: "subgraph",
  }, context);

  equal(result.ok, false, "resultado");
  equal(result.error, "Subgrafo sem nodes válidos.", "erro seguro");
});

Deno.test("destino profundo do prontuário é validado e preserva o paciente", async () => {
  const result = await executeAgentTool("request_interface_action", {
    action: "navigate",
    destination: "patient.sessions.pending",
    patient_id: "patient-123456",
  }, context);

  equal(result.ok, true, "resultado");
  equal(result.clientAction?.data?.destination, "patient.sessions.pending", "destino");
  equal(result.clientAction?.data?.patientId, "patient-123456", "paciente");
});

Deno.test("destino profundo desconhecido é recusado", async () => {
  const result = await executeAgentTool("request_interface_action", {
    action: "navigate",
    destination: "admin.private-secrets",
  }, context);

  equal(result.ok, false, "resultado");
  equal(result.error, "Destino profundo inválido.", "erro seguro");
});
