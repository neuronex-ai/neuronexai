export const normalizeWhatsAppRecipient = (value: unknown) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
};

export const buildAppointmentWhatsAppInviteMessage = ({
  patientName,
  professionalName,
  appointmentDate,
  appointmentTime,
  confirmationUrl,
}: {
  patientName: string;
  professionalName: string;
  appointmentDate: string;
  appointmentTime: string;
  confirmationUrl: string;
}) => {
  const firstName = patientName.trim().split(/\s+/)[0] || "Olá";
  return [
    `Olá, ${firstName}! ${professionalName} reservou seu atendimento para ${appointmentDate}, às ${appointmentTime}.`,
    "Confirme ou solicite uma alteração pelo link seguro:",
    confirmationUrl,
  ].join("\n\n");
};
