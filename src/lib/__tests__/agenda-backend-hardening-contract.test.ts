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
    expect(migration).toContain(
      "queue_sequence bigint generated always as identity",
    );
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain(
      "predecessor.queue_sequence < effect.queue_sequence",
    );
    expect(migration).toContain(
      "order by effect.next_attempt_at, effect.queue_sequence",
    );
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
    expect(migration).toContain(
      "plan_config.config || coalesce(series.default_config, '{}'::jsonb)",
    );
    expect(migration).toContain(
      "drop trigger if exists agenda_v2_apply_occurrence_override",
    );
  });

  it("resolves availability independently for every generated occurrence", () => {
    const start = migration.indexOf(
      "create or replace function private.preview_agenda_v2_plan",
    );
    const end = migration.indexOf(
      "revoke all on function private.preview_agenda_v2_plan",
      start,
    );
    const body = migration.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(body).toContain(
      "v_version_id := private.agenda_v2_availability_version",
    );
    expect(body).toContain("'availabilityVersionId', v_version_id");
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

  it("does not mistake historical Google provenance for a new inbound mutation", () => {
    expect(migration).toContain("googleMutationMarker");
    expect(migration).toContain(
      "is distinct from (old.audit_metadata ->> 'googleMutationMarker')",
    );
    expect(migration).toContain(
      "when new.google_event_id is not null and not v_schedule_changed then 'synced'",
    );
  });

  it("keeps event safety checks while bypassing only clinical availability", () => {
    expect(migration).toContain("v_allow_outside_working_hours");
    expect(migration).toContain("if v_occurrence_start <= now() then");
    expect(migration).toContain("elsif not v_is_event");
    expect(migration).toContain("v_reason_code := 'appointment_conflict'");
    expect(migration).toContain("coalesce(nullif(v_previous_bypass, ''), 'off')");
  });

  it("makes only a safe explicit NeuroFinance decision confirmable", () => {
    expect(migration).toContain("explicit_neurofinance_plan_is_confirmable");
    expect(migration).toContain("old.status = 'review_required'");
    expect(migration).toContain("new.status = 'awaiting_confirmation'");
    expect(migration).toContain("'explicit_neurofinance_decision_confirmable'");
  });

  it("serializes waitlist acceptance and applies its approved snapshots", () => {
    const start = migration.indexOf(
      "create or replace function public.respond_waitlist_offer",
    );
    const end = migration.indexOf(
      "revoke all on function public.respond_waitlist_offer",
      start,
    );
    const body = migration.slice(start, end);
    const firstOfferRead = body.indexOf(
      "from public.professional_waitlist_offers offer",
    );
    const lockedOfferRead = body.indexOf(
      "from public.professional_waitlist_offers offer",
      firstOfferRead + 1,
    );

    expect(body.indexOf("from public.professional_waitlist_entries entry")).toBeLessThan(
      body.indexOf("perform pg_advisory_xact_lock"),
    );
    expect(body.indexOf("perform pg_advisory_xact_lock")).toBeLessThan(
      lockedOfferRead,
    );
    expect(body).toContain("v_policy_version_id");
    expect(body).toContain("private.reserve_package_appointments");
    expect(body).toContain("insert into public.financial_entries");
    expect(body).toContain("'idempotent', true");
  });

  it("exposes an authenticated atomic clinical-details patch", () => {
    expect(migration).toContain(
      "create or replace function public.patch_appointment_clinical_details",
    );
    expect(migration).toContain("v_patch - array[");
    expect(migration).toContain("'localUpdatedAt', now()");
    expect(migration).toContain(
      "grant execute on function public.patch_appointment_clinical_details",
    );
  });
});
