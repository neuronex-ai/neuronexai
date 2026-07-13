import { validateVoiceToolCall } from "./synapse-voice-policy.ts";
import { AGENT_TOOLS_V3 } from "../synapse-text-fallback/tools-v3.ts";

export const MAX_SYNAPSE_VOICE_FUNCTIONS = 16;
export const SYNAPSE_VOICE_TOOLSET_VERSION = "neuronex.voice-core.v4";

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

export function buildSynapseVoiceFunctions() {
  const coreNames = new Set<string>(SYNAPSE_VOICE_CORE_TOOL_NAMES);
  const selectedTools = AGENT_TOOLS_V3
    .map(toDeepgramFunction)
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

  const functions = [...SYNAPSE_VOICE_ONLY_TOOLS, ...selectedTools];
  if (functions.length > MAX_SYNAPSE_VOICE_FUNCTIONS) {
    throw new Error(
      `O nucleo de voz excedeu ${MAX_SYNAPSE_VOICE_FUNCTIONS} ferramentas (${functions.length}).`,
    );
  }

  return functions;
}
