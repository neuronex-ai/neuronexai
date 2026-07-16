import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("appointment lifecycle contract", () => {
  it("keeps the operational lifecycle separate from the clinical status", () => {
    const migration = source("supabase/migrations/20260715041535_appointment_lifecycle_state_machine.sql");

    expect(migration).toContain("add column if not exists lifecycle_status");
    expect(migration).toContain("create table if not exists public.appointment_events");
    expect(migration).toContain("create table if not exists public.appointment_reschedule_requests");
    expect(migration).toContain("Clinical attendance outcome retained for reports and billing compatibility");
    expect(migration).toContain("revoke all on public.appointments from anon");
  });

  it("stores only invitation hashes and routes public writes through service-role RPCs", () => {
    const migration = source("supabase/migrations/20260715041535_appointment_lifecycle_state_machine.sql");
    const sender = source("supabase/functions/send-appointment-reminder/index.ts");

    expect(migration).toContain("alter column token drop not null");
    expect(migration).toContain("set token = null");
    expect(migration).toContain("grant execute on function public.process_appointment_public_action");
    expect(sender).toContain("appointmentTokenHash(rawToken)");
    expect(sender).toContain("token_hash: tokenHash");
    expect(sender).not.toMatch(/select\([^)]*auth_code/);
    expect(sender).not.toMatch(/select\([^)]*\btoken\b/);
  });

  it("binds confirmations and secure links to the current appointment revision", () => {
    const migration = source("supabase/migrations/20260715184553_version_appointment_confirmation_cycle.sql");
    const sender = source("supabase/functions/send-appointment-reminder/index.ts");
    const shared = source("supabase/functions/_shared/appointment-lifecycle.ts");
    const smoke = source("supabase/tests/appointment_reconfirmation_cloud_smoke.sql");

    expect(migration).toContain("add column if not exists confirmation_revision");
    expect(migration).toContain("add column if not exists appointment_revision");
    expect(migration).toContain("lifecycle_status := 'awaiting_reconfirmation'");
    expect(migration).toContain("status = 'revoked'");
    expect(migration).toContain("new.confirmation_revision := old.confirmation_revision");
    expect(migration).toContain("appointment_reconfirmation_required");
    expect(migration).toContain("confirmation-revision:' || new.confirmation_revision::text || ':confirmed");
    expect(sender).toContain("appointment_revision: appointment.confirmation_revision");
    expect(shared).toContain("SUPERSEDED_INVITATION");
    expect(shared).toMatch(
      /tokenResult\.data\.appointment_revision\s*!==\s*appointmentResult\.data\.confirmation_revision/u,
    );

    expect(smoke).toContain("patient-requested time approval incorrectly required reconfirmation");
    expect(smoke).toContain("material professional change did not start revision 2");
    expect(smoke).toContain("internal update incremented the revision again");
    expect(smoke).toContain("revision 1 token confirmed revision 2");
    expect(smoke).toContain("did not preserve both versioned confirmations");
    expect(smoke).toContain("raw confirmation token was persisted");
  });

  it("creates a pending reschedule request without moving the official appointment", () => {
    const migration = source("supabase/migrations/20260715041535_appointment_lifecycle_state_machine.sql");
    const publicAction = migration.slice(
      migration.indexOf("create or replace function public.process_appointment_public_action"),
      migration.indexOf("create or replace function public.review_appointment_reschedule"),
    );

    expect(publicAction).toContain("insert into public.appointment_reschedule_requests");
    expect(publicAction).toContain("lifecycle_status = 'reschedule_requested'");
    expect(publicAction).not.toContain("start_time = p_requested_start_time");
    expect(publicAction).not.toContain("end_time = p_requested_end_time");
  });

  it("derives availability from the secure token and preserves the appointment duration", () => {
    const publicAvailability = source("supabase/functions/get-public-availability/index.ts");
    const availability = source("supabase/functions/_shared/appointment-availability.ts");
    const page = source("src/pages/SecureConfirmAppointment.tsx");

    expect(publicAvailability).toContain("resolveAppointmentInvitation");
    expect(publicAvailability).toContain("calculatePatientAppointmentAvailability");
    expect(availability).toContain("context.professional?.working_hours");
    expect(availability).toContain("durationMinutes");
    expect(availability).toContain("const busy");
    expect(page).toContain('"get-public-availability"');
    expect(page).toContain("requestedStartTime: selectedSlot.startTime");
    expect(page).not.toContain("AVAILABLE_TIMES");
  });

  it("exposes professional review, realtime history and automatic patient communication", () => {
    const detail = source("src/components/agenda/AppointmentDetailModal.tsx");
    const hook = source("src/hooks/use-appointment-lifecycle.ts");
    const review = source("supabase/functions/review-appointment-reschedule/index.ts");

    expect(detail).toContain("AppointmentTimelinePanel");
    expect(detail).toContain("AppointmentRescheduleReview");
    expect(hook).toContain('database.rpc("get_safe_appointment_timeline"');
    expect(hook).not.toContain('.from("appointment_events")');
    expect(hook).not.toContain('table: "appointment_events"');
    expect(hook).toContain('table: "appointments"');
    expect(hook).toContain('table: "appointment_reschedule_requests"');
    expect(hook).toContain('.order("created_at", { ascending: false })');
    expect(review).toContain('db.rpc("review_appointment_reschedule"');
    expect(review).toContain("deliverPatientEmail");
    expect(review).toContain("notificationSent: true");
  });

  it("does not let the detail modal bypass protected lifecycle outcomes", () => {
    const detail = source("src/components/agenda/AppointmentDetailModal.tsx");
    const saveDetails = detail.slice(
      detail.indexOf("const saveDetails"),
      detail.indexOf("const handleWhatsApp"),
    );

    expect(saveDetails).not.toMatch(/\bstatus\s*:/);
    expect(detail).not.toContain("cancelled_by_patient");
    expect(detail).not.toContain("cancelled_by_professional");
    expect(detail).not.toContain("APPOINTMENT_STATUS_VALUES.map");
    expect(detail).toContain("invitationBlockedByPendingRequest");
    expect(detail).toContain("Analise a solicitação de reagendamento antes de reenviar");
  });
});
