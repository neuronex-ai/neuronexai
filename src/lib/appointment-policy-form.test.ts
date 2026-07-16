import { describe, expect, it } from "vitest";

import {
  appointmentPolicyFingerprint,
  DEFAULT_APPOINTMENT_POLICY,
  normalizeAppointmentPolicyDraft,
} from "@/lib/appointment-policy-form";

describe("appointment policy form", () => {
  it("normalizes decimal hours and whitespace before comparing versions", () => {
    const equivalent = {
      ...DEFAULT_APPOINTMENT_POLICY,
      freeCancellationHours: " 24,0 ",
      timezone: " America/Sao_Paulo ",
    };

    expect(appointmentPolicyFingerprint(equivalent)).toBe(
      appointmentPolicyFingerprint(DEFAULT_APPOINTMENT_POLICY),
    );
  });

  it("rejects values outside the database policy limits", () => {
    expect(() =>
      normalizeAppointmentPolicyDraft({
        ...DEFAULT_APPOINTMENT_POLICY,
        professionalResponseSlaHours: "0",
      }),
    ).toThrow("prazo de resposta do profissional");

    expect(() =>
      normalizeAppointmentPolicyDraft({
        ...DEFAULT_APPOINTMENT_POLICY,
        minimumPatientReactionHours: "721",
      }),
    ).toThrow("entre 0 e 720 horas");
  });

  it("rejects an invalid IANA timezone", () => {
    expect(() =>
      normalizeAppointmentPolicyDraft({
        ...DEFAULT_APPOINTMENT_POLICY,
        timezone: "Brasil/Sao-Paulo",
      }),
    ).toThrow("fuso horário IANA válido");
  });
});
