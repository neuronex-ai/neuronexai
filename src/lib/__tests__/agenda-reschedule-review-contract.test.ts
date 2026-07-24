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

  it("keeps the review surface above its blur layer and translates prepare failures", () => {
    const dialog = source("src/components/ui/dialog.tsx");
    const review = source("src/components/appointments/AppointmentPlanReviewDialog.tsx");
    const calendar = source("src/components/agenda/CalendarView.tsx");

    expect(dialog).toContain("containerClassName?: string");
    expect(review).toContain('overlayClassName="z-[10030]');
    expect(review).toContain('containerClassName="z-[10031]"');
    expect(calendar).toContain("getPrepareAppointmentActionPlanErrorMessage(error, \"reschedule\")");
    expect(calendar).not.toContain(
      'toast.error(error instanceof Error ? error.message : "Não foi possível preparar o reagendamento.")',
    );
  });

  it("uses explicit inverse-theme borders in the monthly overflow popover", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");
    const styles = source("src/index.css");

    expect(calendar).toContain("agenda-month-overflow-item");
    expect(styles).toContain(".agenda-month-overflow-item {");
    expect(styles).toContain("border-color: rgba(255, 255, 255, 0.88) !important");
    expect(styles).toContain(".dark .agenda-month-overflow-item");
    expect(styles).toContain("border-color: rgba(0, 0, 0, 0.84) !important");
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
});
