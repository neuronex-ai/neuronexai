import { SYNAPSE_READ_TOOL_NAMES } from "./synapse-tool-contract.ts";

const clean = (value: unknown, max = 160) => String(value ?? "").trim().slice(0, max);

/**
 * Stable, model-facing action vocabulary.
 *
 * The LLM expresses intent through action_kind. Runtime implementation names
 * remain server-owned and are never accepted as arbitrary executor input.
 */
export const SYNAPSE_ACTION_KIND_TO_TOOL = {
  patient_create: "create_patient",
  patient_update: "update_patient",
  patient_basic_info_update: "update_patient_basic_info",
  patient_inactivate: "inactivate_patient",
  session_note: "create_session_note",
  appointment_create: "create_appointment",
  appointment_reschedule: "reschedule_appointment",
  appointment_cancel: "cancel_appointment",
  teleconsultation_transcription_decision: "set_teleconsultation_transcription_decision",
  teleconsultation_close: "close_teleconsultation_room",
  personal_note_create: "create_personal_note",
  personal_note_update: "update_personal_note",
  personal_note_append: "append_to_personal_note",
  personal_note_rename: "rename_personal_note",
  personal_note_move: "move_note_to_module",
  personal_note_tag: "tag_personal_note",
  note_module_create: "create_note_module",
  note_module_rename: "rename_note_module",
  task_create: "create_task",
  task_update: "update_task",
  task_complete: "complete_task",
  task_reopen: "reopen_task",
  task_move: "move_task_category",
  file_link_patient: "link_file_to_patient",
  file_unlink_patient: "unlink_file_from_patient",
  manual_financial_entry: "create_financial_entry",
  neurofinance_charge: "create_neurofinance_charge",
  fiscal_invoice: "create_fiscal_invoice",
  appointment_reminder: "send_appointment_reminder",
  patient_email: "send_patient_email",
  patient_record_open: "request_interface_action",
} as const;

export type SynapseActionKind = keyof typeof SYNAPSE_ACTION_KIND_TO_TOOL;
export type SynapseCanonicalActionTool = (typeof SYNAPSE_ACTION_KIND_TO_TOOL)[SynapseActionKind];

export const SYNAPSE_ACTION_KINDS = Object.freeze(
  Object.keys(SYNAPSE_ACTION_KIND_TO_TOOL) as SynapseActionKind[],
);

export const SYNAPSE_ACTION_KIND_ENTRIES = Object.freeze(
  Object.entries(SYNAPSE_ACTION_KIND_TO_TOOL) as Array<[SynapseActionKind, SynapseCanonicalActionTool]>,
);

const TOOL_TO_ACTION_KIND = new Map<string, SynapseActionKind>();
for (const [kind, toolName] of SYNAPSE_ACTION_KIND_ENTRIES) {
  if (!TOOL_TO_ACTION_KIND.has(toolName)) TOOL_TO_ACTION_KIND.set(toolName, kind);
}

const LEGACY_PREFLIGHT_TOOLS = new Set<string>(SYNAPSE_READ_TOOL_NAMES);
const LEGACY_CANONICAL_TOOLS = new Set<string>([
  ...SYNAPSE_ACTION_KIND_ENTRIES.map(([, toolName]) => toolName),
  ...LEGACY_PREFLIGHT_TOOLS,
]);

export const canonicalToolForActionKind = (value: unknown) => {
  const kind = clean(value, 120) as SynapseActionKind;
  return SYNAPSE_ACTION_KIND_TO_TOOL[kind] || null;
};

export const actionKindForCanonicalTool = (value: unknown) =>
  TOOL_TO_ACTION_KIND.get(clean(value, 120)) || null;

export const isLegacyActionGroupToolAllowed = (value: unknown) =>
  LEGACY_CANONICAL_TOOLS.has(clean(value, 120));

export type ActionGroupStepIdentitySource =
  | "action_kind"
  | "actionKind"
  | "tool_name"
  | "toolName"
  | "action_type"
  | "actionType";

export type NormalizedActionGroupStepIdentity = {
  kind: SynapseActionKind | null;
  canonicalToolName: string | null;
  source: ActionGroupStepIdentitySource | null;
  rawIdentity: string;
  hasIdentityField: boolean;
};

/**
 * Compatibility bridge for model/runtime payloads created before action_kind.
 * Every alias still converges to a server-side allowlist; free tool names never
 * reach the executor.
 */
export function normalizeActionGroupStepIdentity(rawValue: unknown): NormalizedActionGroupStepIdentity {
  const raw = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
    ? rawValue as Record<string, unknown>
    : {};
  const candidates: Array<[ActionGroupStepIdentitySource, unknown]> = [
    ["action_kind", raw.action_kind],
    ["actionKind", raw.actionKind],
    ["tool_name", raw.tool_name],
    ["toolName", raw.toolName],
    ["action_type", raw.action_type],
    ["actionType", raw.actionType],
  ];
  const selected = candidates.find(([, value]) => clean(value, 120));
  if (!selected) {
    return {
      kind: null,
      canonicalToolName: null,
      source: null,
      rawIdentity: "",
      hasIdentityField: candidates.some(([, value]) => value !== undefined),
    };
  }

  const [source, value] = selected;
  const rawIdentity = clean(value, 120);
  const fromKind = canonicalToolForActionKind(rawIdentity);
  if (fromKind) {
    return {
      kind: rawIdentity as SynapseActionKind,
      canonicalToolName: fromKind,
      source,
      rawIdentity,
      hasIdentityField: true,
    };
  }

  // Legacy tool aliases are compatibility-only. The value must already be in
  // the canonical allowlist, including read-only preflights.
  if (isLegacyActionGroupToolAllowed(rawIdentity)) {
    return {
      kind: actionKindForCanonicalTool(rawIdentity),
      canonicalToolName: rawIdentity,
      source,
      rawIdentity,
      hasIdentityField: true,
    };
  }

  return {
    kind: null,
    canonicalToolName: null,
    source,
    rawIdentity,
    hasIdentityField: true,
  };
}
