import { executeAgentTool } from "./executor.ts";
import {
  buildNeuroFlowRevealEvents,
  buildNeuroPulseRevealEvents,
  buildNeuroViewFocusEvents,
  buildNeuroPulseNoteRecord,
  cleanupNeuroPulseArtifacts,
} from "./neuro-notes-tools.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("NeuroFlow e NeuroPulse nunca acessam o banco antes da confirmação", async () => {
  let databaseAccesses = 0;
  const admin = new Proxy({}, {
    get() {
      databaseAccesses += 1;
      throw new Error("o banco não deve ser acessado ao preparar a ação");
    },
  });

  for (
    const toolName of [
      "create_neuroflow_from_patient_history",
      "create_neuropulse_cause_effect_diagram",
    ]
  ) {
    const result = await executeAgentTool(
      toolName,
      { patient_name: "Paciente Teste", objective: "Mapear padrão" },
      { admin, userId: "user-test", sessionId: "session-test" },
    );

    equal(result.ok, true, `preparo de ${toolName}`);
    equal(result.pendingAction?.status, "pending", `pendência de ${toolName}`);
    equal(
      result.pendingAction?.toolName,
      toolName,
      `ferramenta pendente de ${toolName}`,
    );
  }

  equal(databaseAccesses, 0, "acessos ao banco antes da confirmação");
});

Deno.test("nota NeuroPulse não usa uma string no campo UUID module_id", () => {
  const record = buildNeuroPulseNoteRecord({
    userId: "user-test",
    patientId: "patient-test",
    title: "NeuroPulse de teste",
    content: '<pre class="mermaid">flowchart TD</pre>',
  });

  equal(record.module_id, null, "module_id do NeuroPulse");
  equal(record.patient_id, "patient-test", "paciente da nota");
});

Deno.test("cleanup compensatório remove entry e nota parcialmente persistidas", async () => {
  const deleted: Array<{ table: string; id: string; userId: string }> = [];
  const admin = {
    from(table: string) {
      return {
        delete() {
          let id = "";
          return {
            eq(column: string, value: string) {
              if (column === "id") {
                id = value;
                return this;
              }
              if (column === "user_id") {
                deleted.push({ table, id, userId: value });
                return Promise.resolve({ error: null });
              }
              return this;
            },
          };
        },
      };
    },
  };

  await cleanupNeuroPulseArtifacts(admin, "user-test", {
    noteId: "note-test",
    entryId: "entry-test",
  });

  equal(deleted.length, 2, "artefatos removidos");
  equal(
    deleted.some((item) =>
      item.table === "neuro_pulse_entries" && item.id === "entry-test"
    ),
    true,
    "entry removida",
  );
  equal(
    deleted.some((item) =>
      item.table === "personal_notes" && item.id === "note-test"
    ),
    true,
    "nota removida",
  );
});

Deno.test("protocolo NeuroFlow revela nós antes das arestas e termina explicitamente", () => {
  const events = buildNeuroFlowRevealEvents({
    nodes: [
      { id: "patient", type: "patient", data: { label: "Paciente" } },
      { id: "evidence", type: "evidence", data: { label: "Evidência" } },
    ],
    edges: [{ id: "edge-1", source: "patient", target: "evidence", label: "sustenta" }],
  });

  equal(events[0].type, "node_reveal", "primeiro evento");
  equal(events[1].type, "node_reveal", "segundo evento");
  equal(events[2].type, "edge_reveal", "aresta após os nós");
  equal(events.at(-1)?.type, "complete", "evento terminal");
});

Deno.test("NeuroView e NeuroPulse usam eventos focais ordenados", () => {
  const neuroView = buildNeuroViewFocusEvents(
    [{ id: "pat-1" }, { id: "note-1" }],
    [{ source: "pat-1", target: "note-1", reason: "evidência" }],
  );
  equal(neuroView[0].type, "focus_node", "foco inicial NeuroView");
  equal(neuroView.some((event) => event.type === "focus_link"), true, "conexão real NeuroView");
  equal(neuroView.at(-1)?.type, "complete", "fim NeuroView");

  const neuroPulse = buildNeuroPulseRevealEvents();
  equal(neuroPulse[0].type, "node_reveal", "primeiro nó NeuroPulse");
  equal(neuroPulse.some((event) => event.type === "edge_reveal"), true, "arestas NeuroPulse");
  equal(neuroPulse.at(-1)?.type, "complete", "fim NeuroPulse");
});
