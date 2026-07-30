import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730224901_harden_agenda_creation_and_effect_outbox.sql",
  ),
  "utf8",
);

describe("Agenda backend hardening contract", () => {
  it("keeps provider work private, leased, idempotent and service-role-only", () => {
    expect(migration).toContain("create table private.appointment_effect_outbox");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("'waiting_connection'");
    expect(migration).toContain("unique (professional_id, idempotency_key)");
    expect(migration).toContain(
      "grant execute on function public.claim_appointment_effect_outbox",
    );
    expect(migration).toContain(
      "grant execute on function public.retry_appointment_effect_outbox",
    );
    expect(migration).not.toMatch(
      /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,80}private\.appointment_effect_outbox\s+to\s+(?:authenticated|anon)/iu,
    );
  });

  it("uses explicit cents and patient-decides semantics for NeuroFinance", () => {
    expect(migration).toContain("'amountCents', v_amount_cents");
    expect(migration).toContain("'paymentMethod', v_payment_method");
    expect(migration).toContain("'patient_decides'");
    expect(migration).toContain("'operationId', v_operation_id");
    expect(migration).toContain("v_amount_cents > 0");
  });

  it("preserves metadata and future open-series overrides", () => {
    expect(migration).toContain(
      "rename to execute_appointment_action_plan_core_20260716",
    );
    expect(migration).toContain("v_input_metadata - 'syncStatus' - 'googleSyncState'");
    expect(migration).toContain(
      "rename to generate_agenda_v2_occurrences_20260718",
    );
    expect(migration).toContain("series.default_config -> 'overrides'");
    expect(migration).toContain("appointments_persist_materialized_occurrence_override");
  });

  it("materializes accepted waitlist offers as confirmed appointments", () => {
    expect(migration).toContain(
      "add column if not exists appointment_snapshot jsonb not null",
    );
    expect(migration).toContain("'waitlistAcceptedAt', v_now");
    expect(migration).toContain("'confirmed',");
    expect(migration).toContain("'waitlist_acceptance'");
    expect(migration).toContain("offer.status = 'pending' and offer.expires_at <= now()");
  });

  it("patches Google state atomically without completing the outbox implicitly", () => {
    const start = migration.indexOf(
      "create or replace function public.patch_appointment_google_sync_effect",
    );
    const end = migration.indexOf(
      "revoke all on function public.patch_appointment_google_sync_effect",
      start,
    );
    const body = migration.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(body).toContain("effect.lease_token = p_lease_token");
    expect(body).toContain("v_appointment.confirmation_revision <> p_revision");
    expect(body).toContain("coalesce(appointment.metadata, '{}'::jsonb) - 'googleSyncError'");
    expect(body).not.toContain("status = 'completed'");
  });
});
