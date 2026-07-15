const EXTERNAL_SIDE_EFFECT_TOOLS = new Set([
  "create_neurofinance_charge",
  "create_fiscal_invoice",
  "send_appointment_reminder",
  "send_patient_email",
]);

export function whatsappExternalActionsEnabled(value: unknown) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function shouldBlockSynapseExternalAction(input: {
  channel?: string | null;
  toolName: string;
  allowWhatsappExternalActions?: unknown;
}) {
  return input.channel === "whatsapp" &&
    EXTERNAL_SIDE_EFFECT_TOOLS.has(input.toolName) &&
    !whatsappExternalActionsEnabled(input.allowWhatsappExternalActions);
}
