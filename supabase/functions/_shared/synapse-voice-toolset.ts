import { validateVoiceToolCall } from "./synapse-voice-policy.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";

export const MAX_SYNAPSE_VOICE_FUNCTIONS = 16;
export const SYNAPSE_VOICE_TOOLSET_VERSION = "neuronex.voice-core.v9";
export const SYNAPSE_VOICE_DISPATCH_TOOL_NAME = "execute_synapse_tool";

/**
 * Keep the Deepgram tool surface intentionally small. Besides improving intent
 * selection, both voice gateways reject settings with more than 16 functions.
 *
 * NeuroFlow/NeuroPulse remain available through execute_synapse_tool when the
 * professional explicitly names those products. They are intentionally not
 * direct core tools because generic words such as "fluxo", "grupo", "pacote"
 * or "pós-sessão" must prefer the operational action-group planner.
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
      "Prepara o pacote operacional persistido quando o profissional pede varios RESULTADOS executaveis no mesmo comando.",
      "E a ferramenta obrigatoria para preparacao completa, pos-sessao, 'faca tudo isso', pacote de acoes, grupo de acoes, sequencia operacional ou cinco ou mais resultados executaveis.",
      "Consultas internas, validacoes e carregamento de contexto nao contam como etapas e devem ser feitas como preflight fora dos cards.",
      "Todo prepare_action_group abre revisao versionada; para acao critica ou NeuroFinance o servidor acrescenta confirmacao opaca.",
      "Nao confunda pacote/grupo/sequencia operacional com NeuroFlow. NeuroFlow so deve ser criado quando o profissional disser explicitamente NeuroFlow.",
      "Nao execute as etapas separadamente antes de preparar o grupo.",
    ].join(" "),
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Titulo humano curto do plano, como Pos-sessao de Mariana.",
        },
        intent: {
          type: "string",
          description: "Intencao estavel e curta, como post_session_bundle ou preparation_bundle.",
        },
        spoken_summary: {
          type: "string",
          description: "Uma frase curta explicando o conjunto que sera revisado.",
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
                description: "Area humana, por exemplo Agenda, Financeiro, Documento, Comunicacao, Notas ou Interface.",
              },
              title: {
                type: "string",
                description: "Titulo curto da etapa.",
              },
              summary: {
                type: "string",
                description: "Frase curta que deve aparecer no mini-card horizontal.",
              },
              tool_name: {
                type: "string",
                description: "Nome exato de uma ferramenta executavel permitida para os cards. Consultas nunca entram aqui.",
              },
              arguments: {
                type: "object",
                description: "Argumentos humanos/canonicos ja conhecidos. Nao invente IDs internos.",
                additionalProperties: true,
              },
              depends_on: {
                type: "array",
                items: { type: "integer" },
                description: "Numeros 1-based de etapas anteriores das quais esta etapa depende.",
              },
            },
            required: ["area", "title", "summary", "tool_name"],
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

function buildDispatchTool(
  delegatedTools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
) {
  const catalog = delegatedTools
    .map((tool) =>
      `${tool.name} [${parameterSignature(tool.parameters)}]: ${compactDescription(tool.description, 140)}`
    )
    .join("\n");

  return {
    name: SYNAPSE_VOICE_DISPATCH_TOOL_NAME,
    description: [
      "Executa uma capacidade permitida do Synapse que nao possui uma funcao de voz dedicada nesta sessao.",
      "Escolha tool_name exatamente no catalogo abaixo e envie em arguments os campos humanos disponiveis; IDs internos sao opcionais e nunca devem ser pedidos ao profissional.",
      "NeuroFlow e NeuroPulse so podem ser escolhidos aqui quando o profissional citar explicitamente o nome do produto; nunca use esses produtos como substitutos de um pacote/grupo de acoes.",
      "Mutacoes apenas preparam uma acao e continuam exigindo confirmacao verbal separada.",
      "Catalogo:",
      catalog,
    ].join("\n"),
    parameters: {
      type: "object",
      properties: {
        tool_name: {
          type: "string",
          enum: delegatedTools.map((tool) => tool.name),
          description: "Nome tecnico exato da capacidade a executar.",
        },
        arguments: {
          type: "object",
          description: "Argumentos da capacidade escolhida. Prefira nomes, datas e termos humanos; reutilize o contexto duravel.",
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
  executableToolNames: string[],
) {
  if (tool?.name !== "prepare_action_group") return tool;
  const copy = structuredClone(tool);
  copy.parameters.properties.steps.items.properties.tool_name.enum = executableToolNames;
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
    });

  const selectedNames = new Set(selectedTools.map((tool) => tool.name));
  const missing = SYNAPSE_VOICE_CORE_TOOL_NAMES.filter((name) => !selectedNames.has(name));
  if (missing.length) {
    throw new Error(`Ferramentas essenciais de voz ausentes: ${missing.join(", ")}.`);
  }

  const delegatedTools = availableTools
    .filter((tool) => tool.name && !coreNames.has(tool.name))
    .filter((tool) => {
      try {
        validateVoiceToolCall(tool.name);
        return true;
      } catch {
        return false;
      }
    });
  if (!delegatedTools.length) throw new Error("Catalogo delegado de voz ausente.");

  const executableActionGroupTools = availableTools
    .filter((tool) => tool.name)
    .filter((tool) => {
      try {
        return validateVoiceToolCall(tool.name).executor !== "read";
      } catch {
        return false;
      }
    })
    .map((tool) => tool.name);
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
