import {
  getSynapseToolPolicy,
  SYNAPSE_READ_TOOL_NAMES,
  SYNAPSE_TEXT_CONFIRMATION_TOOL_NAMES,
  SYNAPSE_VOICE_BLOCKED_TOOL_NAMES,
} from "./synapse-tool-contract.ts";

const clean = (value: unknown, max = 5000) =>
  String(value ?? "").trim().slice(0, max);

export type VoiceToolRiskLevel = "low" | "medium" | "high" | "blocked";

export class VoiceToolPolicyError extends Error {
  code: string;
  riskLevel: VoiceToolRiskLevel;

  constructor(
    message: string,
    code = "voice_tool_blocked",
    riskLevel: VoiceToolRiskLevel = "blocked",
  ) {
    super(message);
    this.name = "VoiceToolPolicyError";
    this.code = code;
    this.riskLevel = riskLevel;
  }
}

export const VOICE_READ_TOOLS = new Set<string>(SYNAPSE_READ_TOOL_NAMES);
export const VOICE_CONFIRMATION_TOOLS = new Set<string>(
  SYNAPSE_TEXT_CONFIRMATION_TOOL_NAMES.filter((name) =>
    getSynapseToolPolicy(name)?.voiceAvailability === "confirmation"
  ),
);
export const VOICE_BLOCKED_TOOLS = new Set<string>(
  SYNAPSE_VOICE_BLOCKED_TOOL_NAMES,
);

const SECRET_RE =
  /(authorization|token|secret|key|password|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;
const HIGH_SENSITIVITY_RE =
  /(patient|name|notes|prontuario|clinical|diagnosis|body|content|transcript|cpf|email|phone|address|amount|value|subject|title)/i;

function redactedAuditValue(value: unknown) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return `[redacted:string:${value.length}]`;
  if (Array.isArray(value)) return `[redacted:array:${value.length}]`;
  if (typeof value === "object") return "[redacted:object]";
  return `[redacted:${typeof value}]`;
}

export function validateVoiceToolCall(nameValue: unknown) {
  const name = clean(nameValue, 120);
  if (!name) {
    throw new VoiceToolPolicyError(
      "Ferramenta de voz ausente.",
      "missing_tool",
      "blocked",
    );
  }

  const policy = getSynapseToolPolicy(name);
  if (!policy) {
    throw new VoiceToolPolicyError(
      "Essa ferramenta ainda nao foi liberada para o Synapse de voz.",
      "unknown_voice_tool",
      "blocked",
    );
  }

  if (policy.voiceAvailability === "blocked") {
    throw new VoiceToolPolicyError(
      "Essa acao nao esta disponivel por voz nesta versao. Use a interface para revisar com seguranca.",
      "blocked_voice_action",
      "blocked",
    );
  }

  return {
    name,
    riskLevel: policy.riskLevel as VoiceToolRiskLevel,
    confirmationRequired: policy.confirmationRequired,
    executor: policy.executor,
  };
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (SECRET_RE.test(key)) return "[redacted]";
  if (HIGH_SENSITIVITY_RE.test(key)) return redactedAuditValue(value);
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return clean(value, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return depth > 2
      ? `[array:${value.length}]`
      : value.slice(0, 12).map((item, index) =>
        sanitizeValue(String(index), item, depth + 1)
      );
  }
  if (typeof value === "object") {
    return sanitizeVoiceAuditPayload(
      value as Record<string, unknown>,
      depth + 1,
    );
  }
  return clean(value, 300);
}

export function sanitizeVoiceAuditPayload(
  payload: Record<string, unknown> = {},
  depth = 0,
): Record<string, unknown> {
  if (depth > 3) return { truncated: true };
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload).slice(0, 50)) {
    output[key] = sanitizeValue(key, value, depth);
  }
  return output;
}

export function voicePolicyFailurePayload(error: unknown, toolName: string) {
  const message = error instanceof Error
    ? error.message
    : "Acao de voz bloqueada por seguranca.";
  return {
    ok: false,
    tool: clean(toolName, 120),
    spoken_summary: message,
    message,
    retryable: false,
    needs_clarification: false,
    confirmation_required: false,
    data: null,
    error: message,
    grounded: true,
    recordCount: 0,
  };
}
