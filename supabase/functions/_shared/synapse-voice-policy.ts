const clean = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);

export type VoiceToolRiskLevel = "low" | "medium" | "high" | "blocked";

export class VoiceToolPolicyError extends Error {
  code: string;
  riskLevel: VoiceToolRiskLevel;

  constructor(message: string, code = "voice_tool_blocked", riskLevel: VoiceToolRiskLevel = "blocked") {
    super(message);
    this.name = "VoiceToolPolicyError";
    this.code = code;
    this.riskLevel = riskLevel;
  }
}

export const VOICE_READ_TOOLS = new Set([
  "get_system_help",
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
]);

export const VOICE_CONFIRMATION_TOOLS = new Set([
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
  "create_note_module",
  "rename_note_module",
  "create_task",
  "update_task",
  "complete_task",
  "reopen_task",
  "move_task_category",
  "link_file_to_patient",
  "unlink_file_from_patient",
  "create_financial_entry",
  "create_neurofinance_charge",
  "create_fiscal_invoice",
  "send_appointment_reminder",
  "send_patient_email",
  "create_neuroflow_from_patient_history",
  "create_neuropulse_cause_effect_diagram",
]);

export const VOICE_BLOCKED_TOOLS = new Set([
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
]);

const SECRET_RE = /(authorization|token|secret|key|password|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;
const HIGH_SENSITIVITY_RE = /(notes|prontuario|clinical|diagnosis|body|content|transcript|cpf|email|phone)/i;

export function validateVoiceToolCall(nameValue: unknown) {
  const name = clean(nameValue, 120);
  if (!name) {
    throw new VoiceToolPolicyError("Ferramenta de voz ausente.", "missing_tool", "blocked");
  }

  if (VOICE_BLOCKED_TOOLS.has(name) || /^delete_/i.test(name) || /(pix|payout|refund|reembolso)/i.test(name)) {
    throw new VoiceToolPolicyError(
      "Essa acao nao esta disponivel por voz nesta versao. Use a interface para revisar com seguranca.",
      "blocked_voice_action",
      "blocked",
    );
  }

  if (VOICE_READ_TOOLS.has(name)) {
    return { name, riskLevel: "low" as VoiceToolRiskLevel, confirmationRequired: false };
  }

  if (name === "confirm_pending_action" || name === "cancel_pending_action") {
    return { name, riskLevel: "medium" as VoiceToolRiskLevel, confirmationRequired: false };
  }

  if (VOICE_CONFIRMATION_TOOLS.has(name)) {
    return { name, riskLevel: "high" as VoiceToolRiskLevel, confirmationRequired: true };
  }

  throw new VoiceToolPolicyError(
    "Essa ferramenta ainda nao foi liberada para o Synapse de voz.",
    "unknown_voice_tool",
    "blocked",
  );
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (SECRET_RE.test(key)) return "[redacted]";
  if (HIGH_SENSITIVITY_RE.test(key)) return clean(value, 240);
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return clean(value, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return depth > 2 ? `[array:${value.length}]` : value.slice(0, 12).map((item, index) => sanitizeValue(String(index), item, depth + 1));
  if (typeof value === "object") return sanitizeVoiceAuditPayload(value as Record<string, unknown>, depth + 1);
  return clean(value, 300);
}

export function sanitizeVoiceAuditPayload(payload: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
  if (depth > 3) return { truncated: true };
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload).slice(0, 50)) {
    output[key] = sanitizeValue(key, value, depth);
  }
  return output;
}

export function voicePolicyFailurePayload(error: unknown, toolName: string) {
  const message = error instanceof Error ? error.message : "Acao de voz bloqueada por seguranca.";
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
