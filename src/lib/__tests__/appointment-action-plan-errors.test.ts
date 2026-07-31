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

  it("maps a past-time plan review to the scheduling fields instead of finance", () => {
    expect(
      getAppointmentPlanErrorMessage(
        { code: "APPOINTMENT_PLAN_REVIEW_REQUIRED", message: "A data ou o horário já passou. past_time" },
        "create",
      ),
    ).toBe("A data ou o horário escolhido já passou. Selecione um horário futuro para continuar.");
  });

  it("keeps invalid same-day intervals actionable", () => {
    expect(
      getAppointmentPlanErrorMessage({ code: "crosses_day" }, "create"),
    ).toBe("O horário final precisa ser posterior ao horário inicial no mesmo dia.");
  });

  it("never exposes the protected-field trigger or PostgreSQL code", () => {
    const message = getAppointmentPlanErrorMessage({
      code: "P0001",
      message: "Appointment lifecycle, outcome, patient and financial fields are database-owned",
    }, "create");

    expect(message).toContain("Nenhuma alteração foi feita");
    expect(message).not.toMatch(/P0001|database-owned|Appointment lifecycle/i);
  });

  it("explains that CPF is required only for the NeuroFinance charge", () => {
    expect(
      getAppointmentPlanErrorMessage({ code: "PATIENT_DOCUMENT_REQUIRED" }, "create"),
    ).toBe(
      "Complete o CPF do paciente para gerar a cobrança NeuroFinance. O agendamento pode ser criado sem cobrança.",
    );
  });
});
