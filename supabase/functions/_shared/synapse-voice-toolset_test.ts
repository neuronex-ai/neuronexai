import {
  buildSynapseVoiceFunctions,
  MAX_SYNAPSE_VOICE_FUNCTIONS,
  SYNAPSE_VOICE_CORE_TOOL_NAMES,
  SYNAPSE_VOICE_TOOLSET_VERSION,
} from "./synapse-voice-toolset.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
  }
};

Deno.test("núcleo Deepgram permanece curado e dentro do limite dos gateways", () => {
  const functions = buildSynapseVoiceFunctions();
  const names = functions.map((tool) => tool.name);

  equal(functions.length, 15, "quantidade de funções de voz");
  equal(
    SYNAPSE_VOICE_TOOLSET_VERSION,
    "neuronex.voice-core.v2",
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
});
