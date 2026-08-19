import { validateVoiceToolCall } from "./synapse-voice-policy.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";

export const MAX_SYNAPSE_VOICE_FUNCTIONS = 16;
export const SYNAPSE_VOICE_TOOLSET_VERSION = "neuronex.voice-core.v10";
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

/**
 * Keep the Deepgram tool surface intentionally small. Besides improving intent
 * selection, both voice gateways reject settings with more than 16 functions.
 *
 * Generic operational mutations intentionally do NOT live in the dispatcher.
 * They must pass through prepare_action_group so the server owns review,
 * persistence, version/hash and confirmation. NeuroFlow/NeuroPulse remain
 * dispatcher exceptions because they are explicit named products with their
 * own confirmation semantics.
 */
export const SYNAPSE_VOICE_CORE_TOOL_NAMES = [
  "get_system_help",
  "search_workspace",
  "get_dashboard_daily_briefing",
  // get_dashboard_schedule remains reachable through execute_synapse_tool.
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
    description:
      "Use somente quando o profissional confirmar verbalmente uma acao pendente que a ferramenta preparou nesta conversa.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "cancel_pending_action",
    description:
      "Use quando o profissional cancelar uma acao pendente ou uma execucao em andamento.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "edit_action_group",
    description: [
      "Edita um campo visível de uma revisão de grupo que já está pendente nesta conversa.",
      "Use quando o profissional disser para mudar/corrigir um detalhe de um dos mini-cards antes de confirmar.",
      "Identifique o card pelo número exibido e o campo pelo nome humano mostrado na revisão, como horario, valor, descricao, vencimento ou meio de pagamento.",
      "Nunca invente plan_id, versao ou hash: o servidor vincula a edição à revisão pendente atual e gera uma nova versão segura.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        step_number: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          description: "Número 1-based do mini-card exibido na revisão.",
        },
        field: {
          type: "string",
          description: "Nome humano do campo visível a alterar, por exemplo valor ou horario.",
        },
        value: {
          type: "string",
          description: "Novo valor dito pelo profissional, preservado em formato humano para validação do servidor.",
        },
      },
      required: ["step_number", "field", "value"],
      additionalProperties: false,
    },
  },
  {
    name: "prepare_action_group",
    description: [
      "Prepara a revisão persistida para qualquer criação, alteração, envio ou pacote operacional solicitado por voz.",
      "É a rota obrigatória para anotações de prontuário, financeiro, e-mails, agenda e demais mutações operacionais, inclusive quando houver apenas uma etapa.",
      "Também é obrigatória para preparação completa, pós-sessão, 'faça tudo isso', pacote de ações, grupo de ações ou sequência operacional.",
      "Consultas internas, validações e carregamento de contexto não entram nos cards; faça-as apenas quando forem realmente necessárias para montar argumentos confiáveis.",
      "Nunca execute mutações separadamente antes de preparar a revisão.",
      "Todo prepare_action_group abre revisão versionada; ação crítica ou NeuroFinance recebe confirmação opaca adicional.",
      "Não confunda pacote/grupo/sequência operacional com NeuroFlow. NeuroFlow só existe quando o profissional disser explicitamente NeuroFlow.",
      "Cada etapa deve trazer arguments com todos os dados humanos já disponíveis na conversa. Reutilize explicitamente patient_name, valores e textos que o profissional já forneceu.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título humano curto do plano, como Pós-sessão de Mariana.",
        },
        intent: {
          type: "string",
          description: "Intenção estável e curta, como post_session_bundle ou preparation_bundle.",
        },
        spoken_summary: {
          type: "string",
          description: "Uma frase curta explicando o conjunto que será revisado.",
        },
        steps: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              area: {
                type: "string",
                description: "Área humana, por exemplo Agenda, Financeiro, Documento, Comunicação, Notas ou Interface.",
              },
              title: {
                type: "string",
                description: "Título curto da etapa.",
              },
              summary: {
                type: "string",
                description: "Frase curta que deve aparecer no mini-card horizontal.",
              },
              tool_name: {
                type: "string",
                description: "Nome exato de uma ferramenta executável permitida para os cards. Consultas nunca entram aqui.",
              },
              arguments: {
                type: "object",
                properties: {},
                description: "Argumentos canônicos da ferramenta escolhida. Preencha os campos humanos conhecidos; não invente IDs internos.",
                additionalProperties: false,
              },
              depends_on: {
                type: "array",
                items: { type: "integer" },
                description: "Números 1-based de etapas anteriores das quais esta etapa depende.",
              },
            },
            required: ["area", "title", "summary", "tool_name", "arguments"],
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

const compactDescription = (value: unknown, max = 180) =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const parameterSignature = (parameters: Record<string, any>) => {
  const properties = parameters?.properties && typeof parameters.properties === "object"
    ? Object.keys(parameters.properties)
    : [];
  const required = Array.isArray(parameters?.required)
    ? parameters.required.map((value: unknown) => String(value))
    : [];
  const optional = properties.filter((name) => !required.includes(name));
  return [
    required.length ? `obrigatorios=${required.join(",")}` : "obrigatorios=nenhum",
    optional.length ? `opcionais=${optional.join(",")}` : "",
  ].filter(Boolean).join("; ");
};

function requireDirectPatientName(tool: any) {
  if (!DIRECT_PATIENT_NAME_REQUIRED.has(tool?.name)) return tool;
  const copy = structuredClone(tool);
  const required = new Set(Array.isArray(copy?.parameters?.required) ? copy.parameters.required : []);
  required.add("patient_name");
  copy.parameters.required = Array.from(required);
  const current = String(copy.description || "");
  copy.description = `${current} Em voz, envie patient_name explicitamente com o nome já dito pelo profissional.`.trim();
  return copy;
}

function buildDispatchTool(
  delegatedTools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
) {
  const catalog = delegatedTools
    .map((tool) =>
      `${tool.name} [${parameterSignature(tool.parameters as Record<string, any>)}]: ${compactDescription(tool.description, 140)}`
    )
    .join("\n");

  return {
    name: SYNAPSE_VOICE_DISPATCH_TOOL_NAME,
    description: [
      "Executa consultas/capacidades permitidas que não possuem função de voz dedicada nesta sessão.",
      "Não use esta ponte para mutações operacionais genéricas: criação, alteração, envio, agenda e financeiro devem usar prepare_action_group para abrir revisão.",
      "Escolha tool_name exatamente no catálogo abaixo e envie em arguments os campos humanos disponíveis; IDs internos são opcionais e nunca devem ser pedidos ao profissional.",
      "NeuroFlow e NeuroPulse são as únicas exceções de mutação delegada e só podem ser escolhidos quando o profissional citar explicitamente o nome do produto.",
      "Catálogo:",
      catalog,
    ].join("\n"),
    parameters: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          enum: delegatedTools.map((tool) => tool.name),
          description: "Nome técnico exato da capacidade a executar.",
        },
        arguments: {
          type: "object",
          description: "Argumentos da capacidade escolhida. Prefira nomes, datas e termos humanos; reutilize o contexto durável.",
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
  const names = executableTools.map((candidate) => candidate.name);
  copy.parameters.properties.steps.items.properties.tool_name.enum = names;

  const unionProperties: Record<string, unknown> = {};
  for (const candidate of executableTools) {
    const properties = candidate.parameters?.properties && typeof candidate.parameters.properties === "object"
      ? candidate.parameters.properties
      : {};
    for (const [key, schema] of Object.entries(properties)) {
      if (!(key in unionProperties)) unionProperties[key] = schema;
    }
  }
  copy.parameters.properties.steps.items.properties.arguments = {
    type: "object",
    properties: unionProperties,
    additionalProperties: false,
    description: "Argumentos da ferramenta desta etapa. Use os nomes de campos do catálogo e repita explicitamente dados já ditos, sobretudo patient_name, valores e textos.",
  };

  const catalog = executableTools
    .map((candidate) => `${candidate.name} [${parameterSignature(candidate.parameters)}]`)
    .join("; ");
  copy.description = `${copy.description} Catálogo executável e campos: ${catalog}`;
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
    .map(requireDirectPatientName);

  const selectedNames = new Set(selectedTools.map((tool) => tool.name));
  const missing = SYNAPSE_VOICE_CORE_TOOL_NAMES.filter((name) => !selectedNames.has(name));
  if (missing.length) {
    throw new Error(`Ferramentas essenciais de voz ausentes: ${missing.join(", ")}.`);
  }

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
  if (!delegatedTools.length) throw new Error("Catálogo delegado de voz ausente.");

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
  if (!executableActionGroupTools.length) throw new Error("Catálogo executável de grupos ausente.");

  const voiceOnlyTools = SYNAPSE_VOICE_ONLY_TOOLS.map((tool) =>
    constrainActionGroupPlanner(tool, executableActionGroupTools)
  );
  const functions = [
    ...voiceOnlyTools,
    ...selectedTools,
    buildDispatchTool(delegatedTools),
  ];
  if (functions.length > MAX_SYNAPSE_VOICE_FUNCTIONS) {
    throw new Error(`O núcleo de voz excedeu ${MAX_SYNAPSE_VOICE_FUNCTIONS} ferramentas (${functions.length}).`);
  }

  return functions;
}
