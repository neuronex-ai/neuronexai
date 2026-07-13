import { validateVoiceToolCall } from "./synapse-voice-policy.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";

export const MAX_SYNAPSE_VOICE_FUNCTIONS = 16;
export const SYNAPSE_VOICE_TOOLSET_VERSION = "neuronex.voice-core.v5";
export const SYNAPSE_VOICE_DISPATCH_TOOL_NAME = "execute_synapse_tool";

/**
 * Keep the Deepgram tool surface intentionally small. Besides improving intent
 * selection, both voice gateways reject settings with more than 16 functions.
 */
export const SYNAPSE_VOICE_CORE_TOOL_NAMES = [
  "get_system_help",
  "get_workspace_overview",
  "get_dashboard_daily_briefing",
  "get_dashboard_schedule",
  "search_patients",
  "get_patient_details",
  "get_clinical_history",
  "get_patient_system_snapshot",
  "get_calendar",
  "request_interface_action",
  "analyze_neuroview_patient_patterns",
  "create_neuroflow_from_patient_history",
  "create_neuropulse_cause_effect_diagram",
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

export function buildSynapseVoiceFunctions() {
  const coreNames = new Set<string>(SYNAPSE_VOICE_CORE_TOOL_NAMES);
  const availableTools = AGENT_TOOLS_V3
    .map(toDeepgramFunction);
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
  const missing = SYNAPSE_VOICE_CORE_TOOL_NAMES.filter((name) =>
    !selectedNames.has(name)
  );
  if (missing.length) {
    throw new Error(
      `Ferramentas essenciais de voz ausentes: ${missing.join(", ")}.`,
    );
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
  if (!delegatedTools.length) {
    throw new Error("Catalogo delegado de voz ausente.");
  }

  const functions = [
    ...SYNAPSE_VOICE_ONLY_TOOLS,
    ...selectedTools,
    buildDispatchTool(delegatedTools),
  ];
  if (functions.length > MAX_SYNAPSE_VOICE_FUNCTIONS) {
    throw new Error(
      `O nucleo de voz excedeu ${MAX_SYNAPSE_VOICE_FUNCTIONS} ferramentas (${functions.length}).`,
    );
  }

  return functions;
}
