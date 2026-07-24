import { describe, expect, it } from "vitest";

import { getPrepareAppointmentActionPlanErrorMessage } from "@/lib/appointment-action-plans";

describe("getPrepareAppointmentActionPlanErrorMessage", () => {
  it("translates a blocked appointment state without exposing RPC details", () => {
    const error = Object.assign(
      new Error(
        "RPC prepare_appointment_action_plan falhou: 55000 Appointment state does not allow this action",
      ),
      { code: "55000" },
    );

    const message = getPrepareAppointmentActionPlanErrorMessage(error, "reschedule");

    expect(message).toBe(
      "Este agendamento não pode ser reagendado no estado atual. Atualize a agenda e confira o status da sessão.",
    );
    expect(message).not.toMatch(/rpc|55000|prepare_appointment_action_plan/i);
  });

  it("translates missing schema-cache functions as a temporary interruption", () => {
    const error = Object.assign(
      new Error(
        "Could not find the function public.prepare_appointment_action_plan in the schema cache",
      ),
      { code: "PGRST202" },
    );

    const message = getPrepareAppointmentActionPlanErrorMessage(error, "reschedule");

    expect(message).toBe(
      "O reagendamento está temporariamente indisponível. Tente novamente em instantes.",
    );
    expect(message).not.toMatch(/pgrst|function|schema|cache/i);
  });

  it("reads structured errors nested as a cause and maps time conflicts", () => {
    const error = Object.assign(new Error("Falha ao preparar operação"), {
      cause: {
        code: "P0001",
        message: "appointment_time_conflict",
      },
    });

    expect(getPrepareAppointmentActionPlanErrorMessage(error, "reschedule")).toBe(
      "Este horário não está mais disponível. Escolha outro horário e tente novamente.",
    );
  });

  it("uses a safe generic message for unknown server errors", () => {
    const message = getPrepareAppointmentActionPlanErrorMessage(
      new Error("RPC prepare_appointment_action_plan falhou: XX999 internal detail"),
      "reschedule",
    );

    expect(message).toBe(
      "Não foi possível preparar o reagendamento. Atualize a agenda e tente novamente.",
    );
    expect(message).not.toMatch(/rpc|xx999|internal/i);
  });
});
