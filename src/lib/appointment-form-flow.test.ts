import { describe, expect, it } from "vitest";

import {
  findFirstInvalidAppointmentField,
  getAppointmentFieldStep,
  getAppointmentStepLabels,
} from "@/lib/appointment-form-flow";

describe("appointment form flow", () => {
  it("keeps the financial step in a recurring clinical appointment", () => {
    expect(getAppointmentStepLabels("session", true)).toEqual([
      "Atendimento",
      "Sessão",
      "Financeiro",
      "Revisão",
    ]);
  });

  it("always ends clinical and general appointments with a review step", () => {
    expect(getAppointmentStepLabels("session", false)).toEqual([
      "Atendimento",
      "Sessão",
      "Financeiro",
      "Revisão",
    ]);
    expect(getAppointmentStepLabels("event", false)).toEqual([
      "Compromisso",
      "Detalhes",
      "Revisão",
    ]);
  });

  it("sends hidden financial errors to the financial step", () => {
    expect(getAppointmentFieldStep("transactionAmount", "session", true)).toBe(3);
    expect(getAppointmentFieldStep("transactionAmount", "session", false)).toBe(3);
  });

  it("returns the first invalid field for focus recovery", () => {
    expect(findFirstInvalidAppointmentField({ patientId: {}, startTime: {} })).toBe("patientId");
    expect(findFirstInvalidAppointmentField({})).toBeNull();
  });
});
