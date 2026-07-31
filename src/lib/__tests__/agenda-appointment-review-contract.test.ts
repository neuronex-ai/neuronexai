import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Agenda appointment review contract", () => {
  const modal = source("src/components/agenda/NewAppointmentModal.tsx");
  const invoice = source("src/components/financeiro/NewInvoiceModal.tsx");
  const appointmentHook = source("src/hooks/use-add-appointment.ts");

  it("reviews every appointment as a numbered cause-and-effect flow", () => {
    expect(modal).toContain("O que vai acontecer");
    expect(modal).toContain('aria-label="Resumo do agendamento"');
    expect(modal).toContain("Ver no Google Maps");
    expect(modal).toContain("renderFinalReview()");
  });

  it("supports a plan-gated NeuroFinance charge linked to the appointment", () => {
    expect(modal).toContain('canAccess("advanced_finance")');
    expect(modal).toContain('mode: "neurofinance"');
    expect(modal).toContain("prepared_plan: preparedSinglePlan.plan");
    expect(appointmentHook).toContain("financial: appointmentData.financial");
    expect(modal).toContain("Paciente decide");
  });

  it("offers Patient decides in the standalone NeuroFinance charge flow", () => {
    expect(invoice).toContain('const PATIENT_DECIDES_METHODS = ["pix", "card", "boleto"]');
    expect(invoice).toContain("Paciente decide");
    expect(invoice).toContain('canAccess("advanced_finance")');
  });

  it("prepares an individual action plan before review and executes that exact plan", () => {
    expect(modal).toContain("prepareAsync: prepareAppointment");
    expect(modal).toContain("prepareSingleAppointmentForReview(form.getValues())");
    expect(modal).toContain("prepared_plan: preparedSinglePlan.plan");
    expect(modal).toContain('plan.status === "review_required"');
    expect(modal).toContain('plan.status !== "awaiting_confirmation"');
  });

  it("invalidates stale individual plans using the normalized draft fingerprint", () => {
    expect(modal).toContain("buildSingleAppointmentIntent");
    expect(modal).toContain("appointmentPayloadFingerprint(payloadBase)");
    expect(modal).toContain("lastSingleDraftIdentityRef.current === currentSingleDraftIdentity");
    expect(modal).toContain("current?.fingerprint === currentSingleFingerprint");
    expect(modal).toContain("currentSingleFingerprintRef.current === intent.fingerprint");
    expect(modal).toContain("currentSingleIdempotencyKeyRef.current === idempotencyKey");
  });

  it("prepares recurring plans before review and executes only the reviewed hash", () => {
    expect(modal).toContain("prepareAgendaSeries");
    expect(modal).toContain("prepareSeriesAppointmentForReview(form.getValues())");
    expect(modal).toContain("preparedSeriesPlan.fingerprint !== seriesIntent.fingerprint");
    expect(modal).toContain("executePreparedAgendaSeries({");
    expect(modal).toContain("plan: preparedSeriesPlan.plan");
    expect(modal).not.toContain("createAgendaSeries({");
  });
});
