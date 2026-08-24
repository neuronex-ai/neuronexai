import {
  buildSynapseVoiceFunctions,
  MAX_SYNAPSE_VOICE_FUNCTIONS,
  SYNAPSE_VOICE_CORE_TOOL_NAMES,
  SYNAPSE_VOICE_DISPATCH_TOOL_NAME,
  SYNAPSE_VOICE_TOOLSET_VERSION,
} from "./synapse-voice-toolset.ts";
import { canonicalToolForActionKind } from "./synapse-action-kind.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";
import { SYNAPSE_VOICE_BLOCKED_TOOL_NAMES } from "./synapse-tool-contract.ts";

const equal = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
};

Deno.test("núcleo Deepgram estável fica abaixo do teto de funções", () => {
  const functions = buildSynapseVoiceFunctions();
  const names = functions.map((tool) => tool.name);
  equal(functions.length, 15, "quantidade de funções de voz");
  equal(SYNAPSE_VOICE_TOOLSET_VERSION, "neuronex.voice-core.v12-theme-stable", "versão do payload");
  equal(functions.length <= MAX_SYNAPSE_VOICE_FUNCTIONS, true, "limite do gateway");
  equal(new Set(names).size, names.length, "nomes únicos");
  equal(names[0], "confirm_pending_action", "confirm primeiro");
  equal(names[1], "cancel_pending_action", "cancel segundo");
  equal(names[2], "edit_action_group", "editor terceiro");
  equal(names[3], "prepare_action_group", "planner quarto");
  for (const required of SYNAPSE_VOICE_CORE_TOOL_NAMES) {
    equal(names.includes(required), true, `ferramenta ${required}`);
  }
  equal(names.includes(SYNAPSE_VOICE_DISPATCH_TOOL_NAME), true, "dispatcher presente");
  equal(names.includes("draft_soap_from_audio"), false, "SOAP não ocupa slot direto da sessão live");
});

Deno.test("dispatcher não expõe mutações operacionais genéricas", () => {
  const functions = buildSynapseVoiceFunctions();
  const dispatch = functions.find((tool) => tool.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME);
  const delegated = dispatch?.parameters?.properties?.tool_name?.enum || [];
  for (const name of [
    "get_notes_desktop_overview",
    "get_financial_summary",
    "get_teleconsultation_readiness",
    "get_dashboard_schedule",
    "create_neuroflow_from_patient_history",
    "create_neuropulse_cause_effect_diagram",
  ]) equal(delegated.includes(name), true, `delegada ${name}`);
  for (const name of [
    "create_session_note",
    "create_appointment",
    "reschedule_appointment",
    "create_financial_entry",
    "send_patient_email",
  ]) equal(delegated.includes(name), false, `mutação ${name} deve usar planner`);
});

Deno.test("catálogo V3 permanece coberto por núcleo, dispatcher, planner ou bloqueio", () => {
  const functions = buildSynapseVoiceFunctions();
  const direct = new Set(functions.map((tool) => tool.name));
  const dispatch = functions.find((tool) => tool.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME);
  const delegated = new Set(dispatch?.parameters?.properties?.tool_name?.enum || []);
  const planner = functions.find((tool) => tool.name === "prepare_action_group");
  const actionKinds = planner?.parameters?.properties?.steps?.items?.properties?.action_kind?.enum || [];
  const planned = new Set(actionKinds.map((kind: unknown) => canonicalToolForActionKind(kind)).filter(Boolean));
  const blocked = new Set<string>(SYNAPSE_VOICE_BLOCKED_TOOL_NAMES);
  for (const tool of AGENT_TOOLS_V3) {
    const name = tool.function.name;
    equal(direct.has(name) || delegated.has(name) || planned.has(name) || blocked.has(name), true, `cobertura ${name}`);
  }
});

Deno.test("leituras diretas de paciente exigem patient_name", () => {
  const functions = buildSynapseVoiceFunctions();
  for (const name of [
    "get_patient_details",
    "get_clinical_history",
    "get_patient_system_snapshot",
    "analyze_neuroview_patient_patterns",
  ]) {
    const tool = functions.find((candidate) => candidate.name === name);
    equal(Boolean(tool?.parameters?.required?.includes("patient_name")), true, `${name} exige patient_name`);
  }
});

Deno.test("planner expõe intenções estáveis e argumentos humanos", () => {
  const tool = buildSynapseVoiceFunctions().find((candidate) => candidate.name === "prepare_action_group");
  const items = tool?.parameters?.properties?.steps?.items || {};
  const properties = items.properties || {};
  const actionKinds = properties.action_kind?.enum || [];
  const argumentsSchema = properties.arguments?.properties || {};
  for (const kind of [
    "session_note",
    "manual_financial_entry",
    "patient_email",
    "appointment_create",
    "patient_record_open",
    "neurofinance_charge",
    "fiscal_invoice",
    "note_module_create",
    "task_create",
  ]) equal(actionKinds.includes(kind), true, `action_kind ${kind}`);
  for (const field of ["patient_name", "notes", "amount", "entry_type", "subject", "body", "action", "destination", "name", "title"]) {
    equal(Boolean(argumentsSchema[field]), true, `argumento ${field}`);
  }
  equal(Boolean(argumentsSchema.datetime), true, "datetime de agendamento presente");
  equal(String(argumentsSchema.datetime?.description || "").includes("4 da tarde"), true, "datetime orienta período falado");
  equal(items.required?.includes("action_kind"), true, "action_kind obrigatório");
  equal(items.required?.includes("arguments"), true, "arguments obrigatório");
  equal(Boolean(properties.depends_on), true, "depends_on presente");
  const serialized = JSON.stringify(buildSynapseVoiceFunctions());
  if (serialized.length > 180000) throw new Error(`toolset excessivamente grande: ${serialized.length}`);
});

Deno.test("edit_action_group mantém contrato simples e seguro", () => {
  const tool = buildSynapseVoiceFunctions().find((candidate) => candidate.name === "edit_action_group");
  equal(Boolean(tool?.parameters?.properties?.step_number), true, "step_number presente");
  equal(Boolean(tool?.parameters?.properties?.field), true, "field presente");
  equal(Boolean(tool?.parameters?.properties?.value), true, "value presente");
  equal(Boolean(tool?.parameters?.properties?.plan_hash), false, "hash não é model-facing");
});

Deno.test("request_interface_action preserva navegação, tema e grupos do NeuroView 3D", () => {
  const navigation = buildSynapseVoiceFunctions().find((tool) => tool.name === "request_interface_action");
  const description = String(navigation?.description || "");
  equal(description.includes("__synapse_theme:light"), true, "diretiva light");
  equal(description.includes("__synapse_theme:dark"), true, "diretiva dark");
  equal(description.includes("__synapse_theme:toggle"), true, "diretiva toggle");
  equal(description.includes("várias notas"), true, "grupo de notas 3D");
  equal(description.includes("uma tag"), true, "grupo por tag 3D");
  equal(description.includes("sem desfazer o grupo"), true, "foco preserva o grupo");
  const actions = navigation?.parameters?.properties?.action?.enum || [];
  const destinations = navigation?.parameters?.properties?.destination?.enum || [];
  equal(actions.includes("open_neuroview_reasoning"), true, "NeuroView contínuo");
  for (const destination of [
    "patient.sessions.pending",
    "notes.files.patients",
    "finance.extrato.assinaturas",
    "teleconsultation.notes",
    "settings.integrations",
    "global.search",
  ]) equal(destinations.includes(destination), true, `destino ${destination}`);
});
