import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("agenda drag reschedule review contract", () => {
  it("prepares an immutable plan and opens the canonical review dialog", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");
    const conflictDialog = source(
      "src/components/agenda/AppointmentRescheduleConflictDialog.tsx",
    );

    expect(calendar).toContain('prepareAppointmentActionPlan("reschedule"');
    expect(calendar).toContain("requestAppointmentPlanReview({");
    expect(calendar).toContain("getAppointmentPlanIssues(plan)");
    expect(calendar).toContain("<AppointmentRescheduleConflictDialog");
    expect(calendar).toContain('originChannel: "professional_app"');
    expect(calendar).not.toContain("updateAppointment.mutateAsync({");
    expect(conflictDialog).toContain("suggestAppointmentSmartFit");
    expect(conflictDialog).toContain("anchorStart: conflict.requestedStart");
    expect(conflictDialog).toContain('plan.status === "review_required"');
    expect(conflictDialog).toContain('plan.status === "awaiting_confirmation"');
    expect(conflictDialog).toContain("onPlanReady(plan)");
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
    const waitlistHook = source("src/hooks/use-professional-waitlist.ts");
    const migration = source(
      "supabase/migrations/20260723235534_allow_appointment_action_plan_reschedule_guard.sql",
    );
    const page = source("src/pages/desktop/DesktopAgenda.tsx");

    expect(waitlist).toContain('"Oferecer a vaga"');
    expect(waitlist).toContain("await suggestOfferSlot(entry.id)");
    expect(waitlist).toContain('offer.status === "pending"');
    expect(waitlist).toContain("new Date(offer.expires_at) > now");
    expect(waitlist).toContain("value={offerStart}");
    expect(waitlist).toContain("value={offerDuration}");
    expect(waitlist).toContain("startsAt: offerStartIso");
    expect(waitlist).toContain("endsAt: offerEndIso");
    expect(waitlist.match(/readOnly/g)).toHaveLength(2);
    expect(waitlist).toContain("Confirmar e oferecer");
    expect(waitlist).toContain('entry.status === "active" || entry.status === "offered"');
    expect(waitlistHook).toContain('database.rpc("suggest_professional_waitlist_slot"');
    expect(migration).toContain(
      "create or replace function public.suggest_professional_waitlist_slot",
    );
    expect(migration).toContain("from public.professional_waitlist_windows configured");
    expect(migration).toContain("private.agenda_v2_is_available(");
    expect(migration).toContain("v_entry.availability_version_id");
    expect(migration).toContain("from public.appointment_slot_holds hold");
    expect(migration).toContain("v_entry.minimum_duration_minutes as minutes");
    expect(migration).toContain("to authenticated;");
    expect(page).toContain("overflow-visible");
    expect(page).toContain(
      "<ProfessionalWaitlistPanel onClose={() => setWaitlistOpen(false)} />",
    );
  });

  it("closes accepted waitlist entries into the agenda and notifies the professional", () => {
    const waitlistHook = source("src/hooks/use-professional-waitlist.ts");
    const realtime = source("src/hooks/use-agenda-realtime.ts");
    const migration = source(
      "supabase/migrations/20260724223701_agenda_waitlist_acceptance_feedback.sql",
    );

    expect(waitlistHook).toContain('.in("status", ["active", "paused", "offered"])');
    expect(realtime).toContain("['appointmentsByDateRange']");
    expect(migration).toContain("'waitlist-offer-accepted:' || v_offer.id::text");
    expect(migration).toContain("'Vaga aceita na lista de espera'");
    expect(migration).toContain("set status = 'scheduled'");
    expect(migration).toContain("v_has_accepted_offer");
  });
});
