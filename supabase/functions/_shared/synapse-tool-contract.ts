/**
 * Authoritative execution policy shared by Synapse text and voice runtimes.
 *
 * Tool schemas remain close to the LLM gateway, but no runtime may decide risk,
 * confirmation or voice availability independently from this registry.
 */
export type SynapseToolRiskLevel = "low" | "medium" | "high";
export type SynapseVoiceAvailability = "direct" | "confirmation" | "blocked";
export type SynapseToolExecutor = "read" | "mutation" | "interface";

export interface SynapseToolPolicy {
  name: string;
  riskLevel: SynapseToolRiskLevel;
  confirmationRequired: boolean;
  voiceAvailability: SynapseVoiceAvailability;
  executor: SynapseToolExecutor;
  telemetry: "metadata-only";
}

export const SYNAPSE_READ_TOOL_NAMES = [
  "get_system_help",
  "search_workspace",
  "get_workspace_overview",
  "list_patients",
  "search_patients",
  "get_patient_details",
  "get_clinical_history",
  "get_patients_directory_overview",
  "search_patient_directory",
  "get_patient_card_summary",
  "list_patients_without_next_session",
  "list_pending_patients",
  "get_calendar",
  "get_agenda_daily_overview",
  "get_agenda_week_overview",
  "get_appointment_details",
  "find_available_slots",
  "get_teleconsultation_overview",
  "get_next_teleconsultation",
  "get_teleconsultation_session_status",
  "get_teleconsultation_readiness",
  "get_notes_desktop_overview",
  "search_personal_notes",
  "get_personal_note_details",
  "list_recent_notes",
  "list_notes_by_module",
  "list_uncategorized_notes",
  "summarize_note",
  "extract_tasks_from_note",
  "list_note_modules",
  "get_note_module_overview",
  "get_tasks_overview",
  "list_tasks",
  "list_today_tasks",
  "list_overdue_tasks",
  "search_tasks",
  "get_task_details",
  "get_files_overview",
  "search_personal_files",
  "search_patient_files",
  "list_recent_files",
  "get_file_details",
  "list_files_by_patient",
  "get_notion_connection_status",
  "get_financial_summary",
  "list_financial_entries",
  "list_personal_notes",
  "list_documents",
  "request_interface_action",
  "get_dashboard_daily_briefing",
  "get_dashboard_schedule",
  "get_dashboard_next_appointment",
  "get_dashboard_attention_queue",
  "get_dashboard_financial_overview",
  "get_neurofinance_status",
  "get_neurofinance_overview",
  "list_neurofinance_charges",
  "get_neurofinance_charge",
  "get_patient_system_snapshot",
  "get_patient_payment_status",
  "get_patient_timeline",
  "analyze_neuroview_patient_patterns",
  "list_fiscal_invoices",
  "get_fiscal_invoice",
] as const;

export const SYNAPSE_TEXT_CONFIRMATION_TOOL_NAMES = [
  "create_patient",
  "update_patient",
  "update_patient_basic_info",
  "inactivate_patient",
  "create_session_note",
  "create_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "set_teleconsultation_transcription_decision",
  "close_teleconsultation_room",
  "create_personal_note",
  "update_personal_note",
  "append_to_personal_note",
  "rename_personal_note",
  "move_note_to_module",
  "tag_personal_note",
  "delete_personal_note",
  "create_note_module",
  "rename_note_module",
  "delete_note_module",
  "create_task",
  "update_task",
  "complete_task",
  "reopen_task",
  "move_task_category",
  "delete_task",
  "link_file_to_patient",
  "unlink_file_from_patient",
  "delete_file",
  "create_financial_entry",
  "create_neurofinance_charge",
  "create_fiscal_invoice",
  "send_appointment_reminder",
  "send_patient_email",
  "create_neuroflow_from_patient_history",
  "create_neuropulse_cause_effect_diagram",
] as const;

export const SYNAPSE_VOICE_BLOCKED_TOOL_NAMES = [
  "delete_personal_note",
  "delete_note_module",
  "delete_task",
  "delete_file",
  "asaas_pix",
  "asaas_pix_out",
  "asaas_payout",
  "asaas_refund",
  "asaas_bill_payment",
  "neurofinance_pix_out",
  "neurofinance_payout",
  "neurofinance_refund",
  "send_bulk_message",
  "delete_patient",
  "delete_account",
  "change_subscription",
  "manage_permissions",
] as const;

const READ_TOOLS = new Set<string>(SYNAPSE_READ_TOOL_NAMES);
const CONFIRMATION_TOOLS = new Set<string>(
  SYNAPSE_TEXT_CONFIRMATION_TOOL_NAMES,
);
const VOICE_BLOCKED_TOOLS = new Set<string>(SYNAPSE_VOICE_BLOCKED_TOOL_NAMES);
const FINANCIAL_DESTRUCTIVE_PATTERN = /(pix|payout|refund|reembolso)/i;

export const SYNAPSE_TEXT_CONFIRMATION_TOOLS = new Set<string>(
  SYNAPSE_TEXT_CONFIRMATION_TOOL_NAMES,
);

export function getSynapseToolPolicy(
  nameValue: unknown,
): SynapseToolPolicy | null {
  const name = String(nameValue ?? "").trim().slice(0, 120);
  if (!name) return null;

  if (name === "confirm_pending_action" || name === "cancel_pending_action") {
    return {
      name,
      riskLevel: "medium",
      confirmationRequired: false,
      voiceAvailability: "direct",
      executor: "mutation",
      telemetry: "metadata-only",
    };
  }

  if (name === "prepare_action_group" || name === "edit_action_group") {
    return {
      name,
      riskLevel: "medium",
      // Preparation/editing only persists a new immutable review version; the
      // requested business effects still require the server-derived policy.
      confirmationRequired: false,
      voiceAvailability: "direct",
      executor: "mutation",
      telemetry: "metadata-only",
    };
  }

  // execute_action_group is intentionally server-internal. The model must
  // reach it only through confirm_pending_action + exact plan id/version/hash.
  if (name === "execute_action_group") {
    return {
      name,
      riskLevel: "high",
      confirmationRequired: true,
      voiceAvailability: "blocked",
      executor: "mutation",
      telemetry: "metadata-only",
    };
  }

  if (READ_TOOLS.has(name)) {
    return {
      name,
      riskLevel: "low",
      confirmationRequired: false,
      voiceAvailability: "direct",
      executor: name === "request_interface_action" ? "interface" : "read",
      telemetry: "metadata-only",
    };
  }

  if (CONFIRMATION_TOOLS.has(name)) {
    const voiceBlocked = VOICE_BLOCKED_TOOLS.has(name) ||
      /^delete_/i.test(name) ||
      FINANCIAL_DESTRUCTIVE_PATTERN.test(name);
    return {
      name,
      riskLevel: "high",
      confirmationRequired: true,
      voiceAvailability: voiceBlocked ? "blocked" : "confirmation",
      executor: "mutation",
      telemetry: "metadata-only",
    };
  }

  if (
    VOICE_BLOCKED_TOOLS.has(name) ||
    /^delete_/i.test(name) ||
    FINANCIAL_DESTRUCTIVE_PATTERN.test(name)
  ) {
    return {
      name,
      riskLevel: "high",
      confirmationRequired: true,
      voiceAvailability: "blocked",
      executor: "mutation",
      telemetry: "metadata-only",
    };
  }

  return null;
}

export const isSynapseTextMutation = (name: unknown) =>
  getSynapseToolPolicy(name)?.executor === "mutation";
