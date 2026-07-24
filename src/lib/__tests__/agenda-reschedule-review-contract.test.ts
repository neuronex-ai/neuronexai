import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("agenda drag reschedule review contract", () => {
  it("prepares an immutable plan and opens the canonical review dialog", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");

    expect(calendar).toContain('prepareAppointmentActionPlan("reschedule"');
    expect(calendar).toContain("requestAppointmentPlanReview({");
    expect(calendar).toContain('originChannel: "professional_app"');
    expect(calendar).not.toContain("updateAppointment.mutateAsync({");
  });

  it("allows the hash-bound appointment action plan command through the database guard", () => {
    const migration = source(
      "supabase/migrations/20260723235534_allow_appointment_action_plan_reschedule_guard.sql",
    );

    expect(migration).toContain(
      "'professional_appointment_action', 'appointment_action_plan'",
    );
    expect(migration).toContain(
      "revoke all on function private.guard_appointment_database_owned_fields()",
    );
  });

  it("keeps the waitlist vacancy as a read-only review before offering it", () => {
    const waitlist = source("src/components/agenda/ProfessionalWaitlistPanel.tsx");
    const page = source("src/pages/desktop/DesktopAgenda.tsx");

    expect(waitlist).toContain('"Oferecer a vaga"');
    expect(waitlist).toContain("findProfessionalWaitlistSuggestion(entry, appointments, {");
    expect(waitlist).toContain('offer.status === "pending"');
    expect(waitlist).toContain("new Date(offer.expires_at) > now");
    expect(waitlist).toContain("reservedOffers,");
    expect(waitlist).toContain("value={offerStart}");
    expect(waitlist).toContain("value={offerDuration}");
    expect(waitlist.match(/readOnly/g)).toHaveLength(2);
    expect(waitlist).toContain("Confirmar e oferecer");
    expect(page).toContain("overflow-visible");
    expect(page).toContain("appointments={appointments}");
  });
});
