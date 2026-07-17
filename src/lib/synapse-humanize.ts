import { normalizeSynapseWidgetType } from "@/lib/synapse-widget-parser";

const ACTION_LABELS: Record<string, string> = {
  create_appointment: "Agendamento criado",
  reschedule_appointment: "Agendamento remarcado",
  cancel_appointment: "Agendamento cancelado",
  find_available_slots: "Horários disponíveis",
  get_calendar: "Agenda atualizada",
  create_patient: "Paciente cadastrado",
  update_patient: "Paciente atualizado",
  update_patient_info: "Paciente atualizado",
  get_patient_details: "Prontuário localizado",
  search_patients: "Busca de pacientes",
  list_patients: "Pacientes encontrados",
  send_email: "E-mail preparado",
  draft_email: "Rascunho de e-mail",
  create_invoice: "Cobrança criada",
  draft_invoice: "Cobrança preparada",
  send_payment_reminder: "Lembrete preparado",
  create_transaction: "Lançamento registrado",
  get_financial_metrics: "Resumo financeiro",
  list_transactions: "Lançamentos financeiros",
  generate_document: "Documento preparado",
  draft_official_document: "Documento oficial",
  clinical_history: "Histórico clínico",
  create_session_note: "Nota clínica registrada",
  detect_risk_patterns: "Alerta clínico",
  synapse_action: "Ação do Synapse",
};

const CATEGORY_LABELS = [
  [/appointment|calendar|agenda|slot/i, "Agenda"],
  [/patient|paciente|clinical|history|risk|prontuario/i, "Paciente"],
  [/finance|invoice|payment|transaction|cobranca/i, "Financeiro"],
  [/document|note|nota/i, "Documento"],
] as const;

const TECHNICAL_TOKEN_RE = /\b(?:payload|params|tool|endpoint|json|uuid|session_id|clientaction|function_call|synapse_widget|appointment_id|patient_id)\b/gi;
const SNAKE_CASE_RE = /\b[a-z]+(?:_[a-z0-9]+){1,}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export const humanizeSynapseActionType = (type?: string | null) => {
  const normalized = normalizeSynapseWidgetType(type || "synapse_action");
  if (ACTION_LABELS[normalized]) return ACTION_LABELS[normalized];
  const category = CATEGORY_LABELS.find(([pattern]) => pattern.test(normalized));
  return category?.[1] || "Ação do Synapse";
};

export const sanitizeSynapseDisplayText = (value: unknown, fallback = "Ação do Synapse") => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const cleaned = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(UUID_RE, " ")
    .replace(TECHNICAL_TOKEN_RE, " ")
    .replace(/[{}[\]"]/g, " ")
    .replace(SNAKE_CASE_RE, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
};

const MARKDOWN_LITERAL_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`|\]\([^)]+\)|<https?:\/\/[^>]+>)/g;

export const sanitizeSynapseMarkdown = (value: unknown) =>
  String(value ?? "")
    .split(MARKDOWN_LITERAL_RE)
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(UUID_RE, " ")
        .replace(TECHNICAL_TOKEN_RE, " ")
        .replace(SNAKE_CASE_RE, " ")
        .replace(/\(\s*\)/g, "")
        .replace(/[ \t]+([,.;:!?])/g, "$1")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+$/gm, "");
    })
    .join("")
    .trim();

export const humanizeSynapseWidgetTitle = (title: unknown, type?: string | null) => {
  const fallback = humanizeSynapseActionType(type);
  const cleaned = sanitizeSynapseDisplayText(title, fallback);
  if (cleaned === "Ação do Synapse" && fallback !== cleaned) return fallback;
  return cleaned;
};
