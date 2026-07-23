import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Agenda appointment review contract", () => {
  const modal = source("src/components/agenda/NewAppointmentModal.tsx");
  const invoice = source("src/components/financeiro/NewInvoiceModal.tsx");

  it("reviews every appointment as a numbered cause-and-effect flow", () => {
    expect(modal).toContain("O que vai acontecer");
    expect(modal).toContain('aria-label="Resumo do agendamento"');
    expect(modal).toContain("Ver no Google Maps");
    expect(modal).toContain("renderFinalReview()");
  });

  it("supports a plan-gated NeuroFinance charge linked to the appointment", () => {
    expect(modal).toContain('canAccess("advanced_finance")');
    expect(modal).toContain('appointmentId: target.appointmentId');
    expect(modal).toContain('operationId: `agenda-charge-${target.appointmentId}`');
    expect(modal).toContain("Paciente decide");
  });

  it("offers Patient decides in the standalone NeuroFinance charge flow", () => {
    expect(invoice).toContain('const PATIENT_DECIDES_METHODS = ["pix", "card", "boleto"]');
    expect(invoice).toContain("Paciente decide");
    expect(invoice).toContain('canAccess("advanced_finance")');
  });
});
