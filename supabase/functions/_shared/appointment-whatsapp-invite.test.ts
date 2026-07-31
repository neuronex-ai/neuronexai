import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAppointmentWhatsAppInviteMessage,
  normalizeWhatsAppRecipient,
} from "./appointment-whatsapp-invite.ts";

Deno.test("normaliza telefone brasileiro sem duplicar o DDI", () => {
  assertEquals(normalizeWhatsAppRecipient("(11) 98888-7777"), "5511988887777");
  assertEquals(normalizeWhatsAppRecipient("+55 11 98888-7777"), "5511988887777");
  assertEquals(normalizeWhatsAppRecipient("123"), null);
});

Deno.test("monta convite curto com o link de confirmação canônico", () => {
  const message = buildAppointmentWhatsAppInviteMessage({
    patientName: "Carlos Souza",
    professionalName: "Dra. Ana",
    appointmentDate: "5 de agosto de 2026",
    appointmentTime: "16:40",
    confirmationUrl: "https://app.neuronex.test/confirmar-agendamento/token",
  });

  assertStringIncludes(message, "Olá, Carlos!");
  assertStringIncludes(message, "5 de agosto de 2026, às 16:40");
  assertStringIncludes(message, "confirmar-agendamento/token");
});
