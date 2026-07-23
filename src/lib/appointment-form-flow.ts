export type AppointmentEventType = "session" | "event";

export const APPOINTMENT_FORM_ID = "new-appointment-form";

const SESSION_ATTENDANCE_FIELDS = new Set([
  "patientId",
  "date",
  "startTime",
  "endTime",
  "recurrence",
  "recurrenceFrequency",
  "recurrenceCount",
]);

const EVENT_ATTENDANCE_FIELDS = new Set([
  "eventTitle",
  "eventCategory",
  "date",
  "startTime",
  "endTime",
  "recurrence",
  "recurrenceFrequency",
  "recurrenceCount",
]);

const FINANCIAL_FIELDS = new Set([
  "shouldCreateTransaction",
  "shouldGenerateNeurofinanceCharge",
  "transactionAmount",
  "transactionMethod",
  "installments",
  "usePackage",
  "packageId",
]);

export function getAppointmentStepLabels(
  eventType: AppointmentEventType,
  _recurrenceEnabled: boolean,
) {
  if (eventType === "event") {
    return ["Compromisso", "Detalhes", "Revisão"];
  }

  return ["Atendimento", "Sessão", "Financeiro", "Revisão"];
}

export function getAppointmentFieldStep(
  fieldName: string,
  eventType: AppointmentEventType,
  recurrenceEnabled: boolean,
) {
  const attendanceFields = eventType === "event"
    ? EVENT_ATTENDANCE_FIELDS
    : SESSION_ATTENDANCE_FIELDS;

  if (attendanceFields.has(fieldName)) return 1;
  if (FINANCIAL_FIELDS.has(fieldName)) return eventType === "session" ? 3 : 2;
  if (eventType === "event") return 2;
  if (recurrenceEnabled && fieldName.startsWith("recurrence")) return 1;
  return 2;
}

export function findFirstInvalidAppointmentField(
  errors: Record<string, unknown>,
) {
  return Object.keys(errors)[0] ?? null;
}
