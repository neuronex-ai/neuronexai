import {
  buildSynapseVoiceFunctions,
  MAX_SYNAPSE_VOICE_FUNCTIONS,
  SYNAPSE_VOICE_CORE_TOOL_NAMES,
  SYNAPSE_VOICE_DISPATCH_TOOL_NAME,
  SYNAPSE_VOICE_TOOLSET_VERSION,
} from "./synapse-voice-toolset.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";
import { SYNAPSE_VOICE_BLOCKED_TOOL_NAMES } from "./synapse-tool-contract.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("núcleo Deepgram permanece curado e dentro do limite dos gateways", () => {
  const functions = buildSynapseVoiceFunctions();
  const names = functions.map((tool) => tool.name);

  equal(functions.length, 16, "quantidade de funções de voz");
  equal(
    SYNAPSE_VOICE_TOOLSET_VERSION,
    "neuronex.voice-core.v6",
    "versão do payload de sessão",
  );
  equal(
    functions.length <= MAX_SYNAPSE_VOICE_FUNCTIONS,
    true,
    "limite do gateway",
  );
  equal(new Set(names).size, names.length, "nomes únicos");
  equal(names[0], "confirm_pending_action", "primeira função exclusiva de voz");
  equal(names[1], "cancel_pending_action", "segunda função exclusiva de voz");

  for (const required of SYNAPSE_VOICE_CORE_TOOL_NAMES) {
    equal(names.includes(required), true, `ferramenta ${required}`);
  }
  equal(
    names.includes(SYNAPSE_VOICE_DISPATCH_TOOL_NAME),
    true,
    "ponte para o catalogo completo",
  );
  equal(names.includes("search_workspace"), true, "busca unificada no núcleo");
  equal(names.includes("get_workspace_overview"), false, "overview movido ao dispatcher");
});

Deno.test("ponte de voz alcanca capacidades permitidas fora do nucleo sem liberar exclusoes", () => {
  const functions = buildSynapseVoiceFunctions();
  const dispatch = functions.find((tool) =>
    tool.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME
  );
  const delegatedNames = dispatch?.parameters?.properties?.tool_name?.enum || [];

  for (
    const name of [
      "create_appointment",
      "reschedule_appointment",
      "get_notes_desktop_overview",
      "get_financial_summary",
      "send_patient_email",
      "get_teleconsultation_readiness",
    ]
  ) {
    equal(delegatedNames.includes(name), true, `capacidade delegada ${name}`);
  }

  for (const name of ["delete_file", "delete_task", "neurofinance_refund"]) {
    equal(delegatedNames.includes(name), false, `capacidade bloqueada ${name}`);
  }
});

Deno.test("todo o catálogo V3 está no núcleo, dispatcher ou bloqueado por política", () => {
  const functions = buildSynapseVoiceFunctions();
  const direct = new Set(functions.map((tool) => tool.name));
  const dispatch = functions.find((tool) => tool.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME);
  const delegated = new Set(dispatch?.parameters?.properties?.tool_name?.enum || []);
  const blocked = new Set<string>(SYNAPSE_VOICE_BLOCKED_TOOL_NAMES);
  for (const tool of AGENT_TOOLS_V3) {
    const name = tool.function.name;
    equal(direct.has(name) || delegated.has(name) || blocked.has(name), true, `cobertura de ${name}`);
  }
});

Deno.test("NeuroView, NeuroFlow e NeuroPulse chegam ao Deepgram com schema real", () => {
  const functions = buildSynapseVoiceFunctions();
  for (
    const name of [
      "analyze_neuroview_patient_patterns",
      "create_neuroflow_from_patient_history",
      "create_neuropulse_cause_effect_diagram",
    ]
  ) {
    const tool = functions.find((candidate) => candidate.name === name);
    equal(Boolean(tool), true, `registro de ${name}`);
    equal(tool?.parameters?.type, "object", `schema de ${name}`);
    equal(
      Boolean(tool?.parameters?.properties?.patient_name),
      true,
      `patient_name em ${name}`,
    );
  }
});

Deno.test("navegação assistida expõe as superfícies read-first do Desktop", () => {
  const functions = buildSynapseVoiceFunctions();
  const navigation = functions.find((tool) =>
    tool.name === "request_interface_action"
  );
  const elements = navigation?.parameters?.properties?.element?.enum || [];

  for (
    const element of [
      "dashboard_agenda",
      "agenda_calendar",
      "patient_summary",
      "finance_entries",
    ]
  ) {
    equal(elements.includes(element), true, `superfície ${element}`);
  }

  const actions = navigation?.parameters?.properties?.action?.enum || [];
  const destinations = navigation?.parameters?.properties?.destination?.enum || [];
  const scopes = navigation?.parameters?.properties?.neuroview_scope?.enum || [];
  const modes = navigation?.parameters?.properties?.neuroview_mode?.enum || [];
  equal(actions.includes("open_neuroview_reasoning"), true, "ação contínua do NeuroView");
  equal(scopes.join(","), "all,patient,subgraph", "escopos do NeuroView");
  equal(modes.join(","), "2d,3d", "modos do NeuroView");
  equal(Boolean(navigation?.parameters?.properties?.neuroview_node_ids), true, "IDs do subgrafo");
  equal(Boolean(navigation?.parameters?.properties?.neuroview_focus_node_id), true, "node focal");
  for (const destination of [
    "patient.sessions.pending",
    "notes.files.patients",
    "finance.extrato.assinaturas",
    "teleconsultation.notes",
    "settings.integrations",
    "global.search",
  ]) {
    equal(destinations.includes(destination), true, `destino profundo ${destination}`);
  }
});
