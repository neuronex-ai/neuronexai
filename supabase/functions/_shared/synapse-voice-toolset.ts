import { validateVoiceToolCall } from "./synapse-voice-policy.ts";
import {
  SYNAPSE_ACTION_KIND_ENTRIES,
  type SynapseActionKind,
} from "./synapse-action-kind.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";

export const MAX_SYNAPSE_VOICE_FUNCTIONS = 16;
export const SYNAPSE_VOICE_TOOLSET_VERSION = "neuronex.voice-core.v12-theme-stable";
export const SYNAPSE_VOICE_DISPATCH_TOOL_NAME = "execute_synapse_tool";

const DELEGATED_MUTATION_EXCEPTIONS = new Set([
  "create_neuroflow_from_patient_history",
  "create_neuropulse_cause_effect_diagram",
]);

const DIRECT_PATIENT_NAME_REQUIRED = new Set([
  "get_patient_details",
  "get_clinical_history",
  "get_patient_system_snapshot",
  "analyze_neuroview_patient_patterns",
]);

/** Generic operational mutations are reviewed through prepare_action_group. */
export const SYNAPSE_VOICE_CORE_TOOL_NAMES = [
  "get_system_help",
  "search_workspace",
  "get_dashboard_daily_briefing",
  "search_patients",
  "get_patient_details",
  "get_clinical_history",
  "get_patient_system_snapshot",
  "get_calendar",
  "request_interface_action",
  "analyze_neuroview_patient_patterns",
] as const;

export const SYNAPSE_VOICE_ONLY_TOOLS = [
  {
    name: "confirm_pending_action",
    description: "Use somente quando o profissional confirmar verbalmente uma acao pendente preparada nesta conversa.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "cancel_pending_action",
    description: "Use quando o profissional cancelar uma acao pendente ou uma execucao em andamento.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "edit_action_group",
    description: "Edita um campo visivel da revisao pendente. Identifique o card por numero e o campo pelo nome humano exibido. Nunca invente plan_id, versao ou hash.",
    parameters: {
      type: "object",
      properties: {
        step_number: { type: "integer", minimum: 1, maximum: 12 },
        field: { type: "string" },
        value: { type: "string" },
      },
      required: ["step_number", "field", "value"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_action_group",
    description: [
      "Rota obrigatoria para qualquer criacao, alteracao, envio ou pacote operacional por voz, inclusive uma unica etapa.",
      "Expresse cada efeito por action_kind; o servidor escolhe a ferramenta canonica. Nunca envie nomes internos de ferramenta.",
      "Consultas/validacoes sao preflight e nao viram cards. Nunca execute mutacoes separadamente antes da revisao.",
      "Cada etapa deve trazer arguments com os dados humanos ja ditos, especialmente patient_name, valores e textos.",
      "Area, titulo e resumo sao opcionais: o servidor deriva defaults seguros quando faltarem.",
      "SMOKE VISUAL: se o profissional disser 'mostrar mini-cards', 'teste dos mini-cards', 'quero ver os mini-cards' ou pedir apenas para validar os cards de revisao, chame prepare_action_group IMEDIATAMENTE, sem pesquisar paciente e sem chamar nenhuma outra ferramenta antes. Use exatamente title='Teste rapido dos mini-cards', intent='smoke_action_group_review', spoken_summary='Preparei duas acoes simples de teste para voce revisar.' e exatamente dois steps: (1) action_kind='note_module_create', arguments={name:'Teste Synapse - mini-cards'}, area='Notas', title='Criar modulo de teste', summary='Criar um modulo de teste para validar o primeiro mini-card.'; (2) action_kind='task_create', arguments={title:'Validar mini-cards do Synapse'}, area='Tarefas', title='Criar tarefa de teste', summary='Criar uma tarefa simples para validar o segundo mini-card.'. Nao confirme nem execute automaticamente; pare na revisao visual.",
      "Todo plano abre revisao versionada; critico/NeuroFinance recebe confirmacao opaca. NeuroFlow e NeuroPulse usam suas rotas explicitas.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        intent: { type: "string" },
        spoken_summary: { type: "string" },
        steps: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              action_kind: { type: "string" },
              arguments: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
              area: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              depends_on: { type: "array", items: { type: "integer" } },
            },
            required: ["action_kind", "arguments"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "intent", "spoken_summary", "steps"],
      additionalProperties: false,
    },
  },
] as const;

const toDeepgramFunction = (tool: any) => {
  const fn = tool?.function || {};
  return {
    name: String(fn.name || ""),
    description: String(fn.description || ""),
    parameters: fn.parameters || { type: "object", properties: {} },
  };
};

function exposeDesktopThemeControl(tool: any) {
  if (tool?.name !== "request_interface_action") return tool;
  const copy = structuredClone(tool);
  copy.description = `${String(copy.description || "")} Tema do Desktop: claro/escuro/alternar usa action='navigate', target='synapse' e query='__synapse_theme:light', '__synapse_theme:dark' ou '__synapse_theme:toggle'. NeuroView 3D: patient ressalta paciente e notas como hover; neuroview_node_ids aceita uma nota, várias notas ou uma tag; scope=all mantém o panorama e subgraph isola o grupo; neuroview_focus_node_id move a câmera sem desfazer o grupo.`.trim();
  return copy;
}

function requireDirectPatientName(tool: any) {
  if (!DIRECT_PATIENT_NAME_REQUIRED.has(tool?.name)) return tool;
  const copy = structuredClone(tool);
  const required = new Set(Array.isArray(copy?.parameters?.required) ? copy.parameters.required : []);
  required.add("patient_name");
  copy.parameters.required = Array.from(required);
  copy.description = `${String(copy.description || "")} Em voz, envie patient_name explicitamente com o nome ja dito.`.trim();
  return copy;
}

function buildDispatchTool(
  delegatedTools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
) {
  return {
    name: SYNAPSE_VOICE_DISPATCH_TOOL_NAME,
    description: [
      "Executa consultas/capacidades permitidas sem funcao dedicada.",
      "Nao use para mutacoes operacionais: criacao, alteracao, envio, agenda e financeiro usam prepare_action_group.",
      "NeuroFlow/NeuroPulse sao excecoes apenas quando citados explicitamente.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          enum: delegatedTools.map((tool) => tool.name),
        },
        arguments: {
          type: "object",
          description: "Argumentos humanos da capacidade escolhida.",
          additionalProperties: true,
        },
      },
      required: ["tool_name"],
      additionalProperties: false,
    },
  };
}

function constrainActionGroupPlanner(
  tool: any,
  executableTools: Array<{ name: string; description: string; parameters: Record<string, any> }>,
) {
  if (tool?.name !== "prepare_action_group") return tool;
  const copy = structuredClone(tool);
  const executableByName = new Map(executableTools.map((candidate) => [candidate.name, candidate]));
  const supportedKinds = SYNAPSE_ACTION_KIND_ENTRIES.filter(([, canonicalTool]) =>
    executableByName.has(canonicalTool)
  );
  if (!supportedKinds.length) throw new Error("Catalogo action_kind executavel ausente.");

  copy.parameters.properties.steps.items.properties.action_kind.enum = supportedKinds.map(([kind]) => kind);
  copy.parameters.properties.steps.items.properties.action_kind.description =
    "Intencao operacional estavel. O servidor converte action_kind para a implementacao canonica.";

  const unionProperties: Record<string, unknown> = {};
  for (const [, canonicalTool] of supportedKinds) {
    const candidate = executableByName.get(canonicalTool);
    const properties = candidate?.parameters?.properties && typeof candidate.parameters.properties === "object"
      ? candidate.parameters.properties
      : {};
    for (const [key, schema] of Object.entries(properties)) {
      if (!(key in unionProperties)) unionProperties[key] = schema;
    }
  }
  if (unionProperties.datetime && typeof unionProperties.datetime === "object") {
    unionProperties.datetime = {
      ...unionProperties.datetime as Record<string, unknown>,
      description: "Data/hora completa do agendamento em Brasília, no formato YYYY-MM-DDTHH:mm:ss-03:00. Converta expressões como amanhã, daqui a N dias e 4 da tarde usando a data/hora atual do prompt; nunca omita mês/ano no valor enviado.",
    };
  }
  copy.parameters.properties.steps.items.properties.arguments = {
    type: "object",
    properties: unionProperties,
    additionalProperties: false,
    description: "Dados humanos da etapa; repita patient_name, valores, textos, datas e destino que o profissional informou.",
  };
  return copy;
}

export function buildSynapseVoiceFunctions() {
  const coreNames = new Set<string>(SYNAPSE_VOICE_CORE_TOOL_NAMES);
  const availableTools = AGENT_TOOLS_V3.map(toDeepgramFunction);
  const selectedTools = availableTools
    .filter((tool) => tool.name && coreNames.has(tool.name))
    .filter((tool) => {
      try {
        validateVoiceToolCall(tool.name);
        return true;
      } catch {
        return false;
      }
    })
    .map(requireDirectPatientName)
    .map(exposeDesktopThemeControl);

  const selectedNames = new Set(selectedTools.map((tool) => tool.name));
  const missing = SYNAPSE_VOICE_CORE_TOOL_NAMES.filter((name) => !selectedNames.has(name));
  if (missing.length) throw new Error(`Ferramentas essenciais de voz ausentes: ${missing.join(", ")}.`);

  const delegatedTools = availableTools
    .filter((tool) => tool.name && !coreNames.has(tool.name))
    .filter((tool) => {
      try {
        const policy = validateVoiceToolCall(tool.name);
        return policy.executor !== "mutation" || DELEGATED_MUTATION_EXCEPTIONS.has(tool.name);
      } catch {
        return false;
      }
    });
  if (!delegatedTools.length) throw new Error("Catalogo delegado de voz ausente.");

  const executableActionGroupTools = Array.from(new Map(
    availableTools
      .filter((tool) => tool.name)
      .filter((tool) => {
        try {
          const policy = validateVoiceToolCall(tool.name);
          return policy.executor !== "read" && !DELEGATED_MUTATION_EXCEPTIONS.has(tool.name);
        } catch {
          return false;
        }
      })
      .map((tool) => [tool.name, tool]),
  ).values());
  if (!executableActionGroupTools.length) throw new Error("Catalogo executavel de grupos ausente.");

  const voiceOnlyTools = SYNAPSE_VOICE_ONLY_TOOLS.map((tool) =>
    constrainActionGroupPlanner(tool, executableActionGroupTools)
  );
  const functions = [
    ...voiceOnlyTools,
    ...selectedTools,
    buildDispatchTool(delegatedTools),
  ];
  if (functions.length > MAX_SYNAPSE_VOICE_FUNCTIONS) {
    throw new Error(`O nucleo de voz excedeu ${MAX_SYNAPSE_VOICE_FUNCTIONS} ferramentas (${functions.length}).`);
  }
  return functions;
}
