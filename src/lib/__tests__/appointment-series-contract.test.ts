import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("transactional appointment series contract", () => {
  const migrationPath =
    "supabase/migrations/20260715080146_transactional_appointment_series.sql";

  it("models recurrence outside metadata and preserves independent appointments", () => {
    const migration = source(migrationPath);

    expect(migration).toContain("create table if not exists public.appointment_series");
    expect(migration).toContain("add column if not exists series_id uuid");
    expect(migration).toContain("add column if not exists occurrence_number smallint");
    expect(migration).toContain("add column if not exists occurrence_count smallint");
    expect(migration).toContain("appointments_series_occurrence_uidx");
    expect(migration).toContain("v_clean_metadata := p_metadata - 'recurrence'");
    expect(migration).toContain("The legacy recurring_appointments table is intentionally left untouched");
  });

  it("generates the exact requested count for weekly, biweekly and monthly series", () => {
    const migration = source(migrationPath);

    expect(migration).toContain("for v_index in 1..p_occurrence_count loop");
    expect(migration).toContain("(v_index - 1) * interval '7 days'");
    expect(migration).toContain("(v_index - 1) * interval '14 days'");
    expect(migration).toContain("make_interval(months => v_index - 1)");
    expect(migration).not.toContain("1..p_occurrence_count + 1");
  });

  it("validates every occurrence before inserts and revalidates under a professional lock", () => {
    const migration = source(migrationPath);
    const createFunction = migration.slice(
      migration.indexOf("create or replace function public.create_appointment_series"),
    );

    expect(migration).toContain("private.validate_appointment_series");
    expect(migration).toContain("v_occurrence_start <= now()");
    expect(migration).toContain("outside_working_hours");
    expect(migration).toContain("appointment_conflict");
    expect(migration).toContain("appointments_prevent_time_conflict");
    expect(createFunction.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      createFunction.indexOf("insert into public.appointment_series"),
    );
    expect(createFunction.indexOf("private.validate_appointment_series")).toBeLessThan(
      createFunction.indexOf("insert into public.appointment_series"),
    );
    expect(createFunction).toContain("return jsonb_build_object('success', false) || v_validation");
  });

  it("uses canonical action plans and does not create finance or recurrence in a frontend loop", () => {
    const modal = source("src/components/agenda/NewAppointmentModal.tsx");
    const addAppointmentHook = source("src/hooks/use-add-appointment.ts");

    expect(modal).toContain("prepareAgendaSeries({");
    expect(modal).toContain("executePreparedAgendaSeries({");
    expect(modal).toContain("prepared_plan: preparedSinglePlan.plan");
    expect(modal).not.toContain("createSeries({");
    expect(modal).toContain("A série e as reservas de pacote são confirmadas juntas.");
    expect(modal).not.toContain("addRecurrenceInterval");
    expect(modal).not.toMatch(/for\s*\([^)]*recurrence/i);
    expect(addAppointmentHook).toContain(
      "appointmentData.prepared_plan || await prepareNewAppointment",
    );
    expect(addAppointmentHook).toContain("executeAppointmentActionPlan(prepared)");
    expect(addAppointmentHook).toContain("appointmentData.package_id || null");
  });
});
