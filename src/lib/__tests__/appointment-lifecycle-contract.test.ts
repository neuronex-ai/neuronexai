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
    const availability = source("supabase/functions/get-public-availability/index.ts");
    const page = source("src/pages/SecureConfirmAppointment.tsx");

    expect(availability).toContain("resolveAppointmentInvitation(db, token)");
    expect(availability).toContain("context.professional?.working_hours");
    expect(availability).toContain("durationMinutes");
    expect(availability).toContain("isBusy");
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
    expect(hook).toContain('table: "appointment_events"');
    expect(hook).toContain('table: "appointment_reschedule_requests"');
    expect(hook).toContain('.order("created_at", { ascending: false })');
    expect(review).toContain('db.rpc("review_appointment_reschedule"');
    expect(review).toContain("deliverPatientEmail");
    expect(review).toContain("notificationSent: true");
  });
});
