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
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
};

Deno.test("núcleo Deepgram permanece curado e dentro do limite dos gateways", () => {
  const functions = buildSynapseVoiceFunctions();
  const names = functions.map((tool) => tool.name);
  equal(functions.length, 15, "quantidade de funções de voz");
  equal(SYNAPSE_VOICE_TOOLSET_VERSION, "neuronex.voice-core.v10", "versão do payload de sessão");
  equal(functions.length <= MAX_SYNAPSE_VOICE_FUNCTIONS, true, "limite do gateway");
  equal(new Set(names).size, names.length, "nomes únicos");
  equal(names[0], "confirm_pending_action", "primeira função exclusiva de voz");
  equal(names[1], "cancel_pending_action", "segunda função exclusiva de voz");
  equal(names[2], "edit_action_group", "edição versionada exclusiva de voz");
  equal(names[3], "prepare_action_group", "planejador persistido exclusivo de voz");
  for (const required of SYNAPSE_VOICE_CORE_TOOL_NAMES) equal(names.includes(required), true, `ferramenta ${required}`);
  equal(names.includes(SYNAPSE_VOICE_DISPATCH_TOOL_NAME), true, "ponte de consultas/capacidades delegadas");
  equal(names.includes("search_workspace"), true, "busca unificada no núcleo");
  equal(names.includes("get_workspace_overview"), false, "overview movido ao dispatcher");
  equal(names.includes("get_dashboard_schedule"), false, "agenda simples permanece no dispatcher");
  equal(names.includes("create_neuroflow_from_patient_history"), false, "NeuroFlow fora do núcleo direto");
  equal(names.includes("create_neuropulse_cause_effect_diagram"), false, "NeuroPulse fora do núcleo direto");
});

Deno.test("dispatcher não permite mais mutações operacionais genéricas", () => {
  const functions = buildSynapseVoiceFunctions();
  const dispatch = functions.find((tool) => tool.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME);
  const delegatedNames = dispatch?.parameters?.properties?.tool_name?.enum || [];
  for (const name of ["get_notes_desktop_overview", "get_financial_summary", "get_teleconsultation_readiness", "get_dashboard_schedule", "create_neuroflow_from_patient_history", "create_neuropulse_cause_effect_diagram"]) {
    equal(delegatedNames.includes(name), true, `capacidade delegada ${name}`);
  }
  for (const name of ["create_session_note", "create_appointment", "reschedule_appointment", "create_financial_entry", "send_patient_email"]) {
    equal(delegatedNames.includes(name), false, `mutação operacional ${name} deve passar pelo planner`);
  }
  for (const name of ["delete_file", "delete_task", "neurofinance_refund"]) equal(delegatedNames.includes(name), false, `capacidade bloqueada ${name}`);
});

Deno.test("todo catálogo V3 está no núcleo, dispatcher, planner ou bloqueado", () => {
  const functions = buildSynapseVoiceFunctions();
  const direct = new Set(functions.map((tool) => tool.name));
  const dispatch = functions.find((tool) => tool.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME);
  const delegated = new Set(dispatch?.parameters?.properties?.tool_name?.enum || []);
  const planner = functions.find((tool) => tool.name === "prepare_action_group");
  const planned = new Set(planner?.parameters?.properties?.steps?.items?.properties?.tool_name?.enum || []);
  const blocked = new Set<string>(SYNAPSE_VOICE_BLOCKED_TOOL_NAMES);
  for (const tool of AGENT_TOOLS_V3) {
    const name = tool.function.name;
    equal(direct.has(name) || delegated.has(name) || planned.has(name) || blocked.has(name), true, `cobertura de ${name}`);
  }
});

Deno.test("ferramentas diretas centradas em paciente exigem patient_name explícito", () => {
  const functions = buildSynapseVoiceFunctions();
  for (const name of ["get_patient_details", "get_clinical_history", "get_patient_system_snapshot", "analyze_neuroview_patient_patterns"]) {
    const tool = functions.find((candidate) => candidate.name === name);
    const required = tool?.parameters?.required || [];
    equal(required.includes("patient_name"), true, `${name} exige patient_name em voz`);
  }
});

Deno.test("NeuroView fica direto; NeuroFlow e NeuroPulse exigem seleção explícita pelo dispatcher", () => {
  const functions = buildSynapseVoiceFunctions();
  const neuroview = functions.find((candidate) => candidate.name === "analyze_neuroview_patient_patterns");
  equal(Boolean(neuroview), true, "NeuroView direto");
  equal(Boolean(neuroview?.parameters?.properties?.patient_name), true, "patient_name em NeuroView");
  const dispatch = functions.find((candidate) => candidate.name === SYNAPSE_VOICE_DISPATCH_TOOL_NAME);
  const delegatedNames = dispatch?.parameters?.properties?.tool_name?.enum || [];
  equal(delegatedNames.includes("create_neuroflow_from_patient_history"), true, "NeuroFlow delegado");
  equal(delegatedNames.includes("create_neuropulse_cause_effect_diagram"), true, "NeuroPulse delegado");
});

Deno.test("prepare_action_group expõe argumentos reais das ferramentas e só recebe resultados executáveis", () => {
  const functions = buildSynapseVoiceFunctions();
  const tool = functions.find((candidate) => candidate.name === "prepare_action_group");
  equal(Boolean(tool), true, "planner registrado");
  equal(tool?.parameters?.properties?.steps?.minItems, 1, "mínimo de etapas");
  equal(tool?.parameters?.properties?.steps?.maxItems, 12, "máximo de etapas");
  const items = tool?.parameters?.properties?.steps?.items || {};
  const stepProperties = items.properties || {};
  const executableNames = stepProperties.tool_name?.enum || [];
  const argumentProperties = stepProperties.arguments?.properties || {};
  const requiredStepFields = items.required || [];

  equal(Boolean(stepProperties.tool_name), true, "ferramenta executável por etapa");
  equal(new Set(executableNames).size, executableNames.length, "enum executável sem duplicatas");
  equal(executableNames.includes("create_session_note"), true, "anotação executável permitida no grupo");
  equal(executableNames.includes("create_financial_entry"), true, "financeiro executável permitido no grupo");
  equal(executableNames.includes("send_patient_email"), true, "comunicação executável permitida no grupo");
  equal(executableNames.includes("request_interface_action"), true, "navegação final permitida no grupo");
  equal(executableNames.includes("get_calendar"), false, "consulta de agenda proibida nos cards");
  equal(executableNames.includes("get_patient_details"), false, "consulta de paciente proibida nos cards");
  for (const field of ["patient_name", "notes", "amount", "entry_type", "subject", "body", "action", "destination"]) {
    equal(Boolean(argumentProperties[field]), true, `planner expõe argumento ${field}`);
  }
  equal(requiredStepFields.includes("arguments"), true, "cada etapa deve trazer arguments explicitamente");
  equal(Boolean(stepProperties.depends_on), true, "dependências explícitas");
  equal(Boolean(stepProperties.risk), false, "modelo não escolhe risco");
  equal(Boolean(stepProperties.confirmation_policy), false, "modelo não escolhe confirmação");
  equal(String(tool?.description || "").includes("Rota obrigatoria para qualquer criacao, alteracao, envio ou pacote operacional"), true, "planner é rota única de mutação operacional por voz");
  equal(String(tool?.description || "").includes("NeuroFlow so quando citado explicitamente"), true, "planner diferencia grupo operacional de NeuroFlow");
  const serialized = JSON.stringify(functions);
  if (serialized.length > 120000) throw new Error(`toolset de voz excessivamente grande: ${serialized.length} caracteres`);
});

Deno.test("edit_action_group só altera campo allowlisted de uma revisão pendente", () => {
  const tool = buildSynapseVoiceFunctions().find((candidate) => candidate.name === "edit_action_group");
  equal(Boolean(tool), true, "editor registrado");
  equal(Boolean(tool?.parameters?.properties?.step_number), true, "card pode ser referenciado por número");
  equal(Boolean(tool?.parameters?.properties?.field), true, "campo humano obrigatório");
  equal(Boolean(tool?.parameters?.properties?.value), true, "novo valor obrigatório");
  equal(Boolean(tool?.parameters?.properties?.plan_hash), false, "modelo nunca escolhe hash");
});

Deno.test("navegação assistida expõe as superfícies read-first do Desktop", () => {
  const functions = buildSynapseVoiceFunctions();
  const navigation = functions.find((tool) => tool.name === "request_interface_action");
  const elements = navigation?.parameters?.properties?.element?.enum || [];
  for (const element of ["dashboard_agenda", "agenda_calendar", "patient_summary", "finance_entries"]) equal(elements.includes(element), true, `superfície ${element}`);
  const actions = navigation?.parameters?.properties?.action?.enum || [];
  const destinations = navigation?.parameters?.properties?.destination?.enum || [];
  const scopes = navigation?.parameters?.properties?.neuroview_scope?.enum || [];
  const modes = navigation?.parameters?.properties?.neuroview_mode?.enum || [];
  equal(actions.includes("open_neuroview_reasoning"), true, "ação contínua do NeuroView");
  equal(scopes.join(","), "all,patient,subgraph", "escopos do NeuroView");
  equal(modes.join(","), "2d,3d", "modos do NeuroView");
  equal(Boolean(navigation?.parameters?.properties?.neuroview_node_ids), true, "IDs do subgrafo");
  equal(Boolean(navigation?.parameters?.properties?.neuroview_focus_node_id), true, "node focal");
  for (const destination of ["patient.sessions.pending", "notes.files.patients", "finance.extrato.assinaturas", "teleconsultation.notes", "settings.integrations", "global.search"]) equal(destinations.includes(destination), true, `destino profundo ${destination}`);
});
