import { describe, expect, it } from "vitest";

import { getAppointmentPlanErrorMessage } from "../appointment-action-plan-errors";

describe("appointment action plan error messages", () => {
  it("turns the protected appointment state into a human rescheduling message", () => {
    const error = Object.assign(
      new Error("RPC prepare_appointment_action_plan failed: Appointment state does not allow this action"),
      { code: "55000" },
    );

    expect(getAppointmentPlanErrorMessage(error, "reschedule")).toBe(
      "Este agendamento não pode ser reagendado no estado atual. Atualize a Agenda e tente novamente.",
    );
  });

  it("keeps a newly occupied slot actionable without exposing the database conflict", () => {
    expect(
      getAppointmentPlanErrorMessage({ code: "23P01", message: "slot conflict" }, "reschedule"),
    ).toBe("O horário escolhido acabou de ser ocupado. Escolha outro horário para continuar.");
  });

  it("hides stale RPC and schema-cache implementation details", () => {
    expect(
      getAppointmentPlanErrorMessage(
        "Could not find the function public.prepare_appointment_action_plan in the schema cache",
        "reschedule",
      ),
    ).toBe("Estamos atualizando a Agenda. Tente novamente em instantes.");
  });
});
