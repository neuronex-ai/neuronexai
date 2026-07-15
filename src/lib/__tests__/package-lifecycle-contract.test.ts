import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("versioned appointment package lifecycle", () => {
  const migration = source(
    "supabase/migrations/20260715095505_package_series_binding_lifecycle.sql",
  );
  const legacyNormalization = source(
    "supabase/migrations/20260715095931_normalize_legacy_future_package_reservations.sql",
  );
  const inProgressGuard = source(
    "supabase/migrations/20260715100538_block_in_progress_package_replacement.sql",
  );

  it("keeps a binding per occurrence and an append-only reserve/consume/release/reverse ledger", () => {
    expect(migration).toContain("create table public.appointment_package_bindings");
    for (const column of [
      "appointment_id",
      "series_id",
      "package_id",
      "professional_id",
      "patient_id",
      "bound_at",
      "released_at",
      "consumed_at",
      "replaced_by_binding_id",
      "idempotency_key",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain("action in ('reserve', 'consume', 'release', 'reverse')");
    expect(migration).toContain("patient_package_session_usages_binding_action_uidx");
  });

  it("releases package A and reserves package B without changing realized usage", () => {
    const execution = migration.slice(
      migration.indexOf("create or replace function public.execute_package_lifecycle_change_internal"),
    );
    expect(execution).toContain("'release'");
    expect(execution).toContain("'reserve'");
    expect(execution).toContain("sessions_reserved = greatest(sessions_reserved - v_affected_count, 0)");
    expect(execution).toContain("sessions_reserved = sessions_reserved + v_affected_count");
    expect(execution).not.toContain("sessions_used = 0");
    expect(execution).toContain("package_status = case when p_operation_type = 'replace' then 'replaced' else 'ended' end");
  });

  it("removes the legacy all-active-packages trigger and consumes only an explicit reservation", () => {
    expect(migration).toContain("drop trigger if exists tr_sync_package_sessions on public.appointments");
    expect(migration).toContain("drop function if exists public.sync_package_sessions()");
    expect(migration).toContain("private.consume_appointment_package_binding");
    expect(migration).toContain("binding.status = 'reserved'");
    expect(migration).toContain("tr_consume_bound_package_session");
  });

  it("reclassifies premature future consumes without deleting the legacy ledger", () => {
    expect(legacyNormalization).toContain("'reverse'");
    expect(legacyNormalization).toContain("'reserve'");
    expect(legacyNormalization).toContain("reverses_usage_id");
    expect(legacyNormalization).toContain("sessions_used = package.sessions_used - target.sessions_to_reclassify");
    expect(legacyNormalization).toContain("sessions_reserved = package.sessions_reserved + target.sessions_to_reclassify");
    expect(legacyNormalization).not.toMatch(/delete\s+from\s+public\.patient_package_session_usages/i);
  });

  it("blocks partial replacement, sensitive charges, insufficient balance and stale confirmations", () => {
    expect(migration).toContain("O novo pacote possui saldo para %s de %s sessões");
    expect(migration).toContain("A ocorrência selecionada já começou");
    expect(migration).toContain("'processing', 'partially_paid', 'disputed', 'partially_refunded', 'chargeback'");
    expect(migration).toContain("Existe NFS-e emitida ou em processamento");
    expect(migration).toContain("v_current_ids is distinct from v_expected_ids");
    expect(migration).toContain("package_replacement_operations_idempotency_uidx");
    expect(inProgressGuard).toContain("appointment_package_bindings_block_in_progress");
    expect(inProgressGuard).toContain("validate_package_lifecycle_progress_internal");
    const edge = source("supabase/functions/manage-package-lifecycle/index.ts");
    expect(edge).toContain('"validate_package_lifecycle_progress_internal"');
    expect(edge).toContain('"PACKAGE_OCCURRENCE_IN_PROGRESS"');
  });

  it("sequences provider work through an idempotent outbox", () => {
    expect(migration).toContain("create table public.package_financial_adjustment_outbox");
    expect(migration).toContain("depends_on_idempotency_key");
    expect(migration).toContain("'blocked'");
    expect(migration).toContain("releaseAfterCancellation");
    expect(migration).not.toMatch(/http_(get|post)|net\.http|asaas\.com/i);
  });

  it("protects physical deletion and replaces it with lifecycle actions in the professional UI", () => {
    const card = source("src/components/patients/PackageCard.tsx");
    expect(migration).toContain("patient_packages_prevent_historical_delete");
    expect(migration).toContain("revoke delete on table public.patient_packages from authenticated");
    expect(card).toContain("Encerrar pacote");
    expect(card).toContain("Substituir nas sessões futuras");
    expect(card).toContain("Remover vínculo das sessões futuras");
    expect(card).not.toContain("Excluir pacote");
    expect(card).not.toContain("useDeletePatientPackage");
  });

  it("creates the series and all package reservations in one database transaction", () => {
    const wrapper = migration.slice(
      migration.indexOf("create or replace function public.create_appointment_series_with_package"),
      migration.indexOf("create or replace function public.preview_package_lifecycle_change_internal"),
    );
    expect(wrapper).toContain("public.create_appointment_series(");
    expect(wrapper).toContain("private.reserve_package_appointments(");
    expect(wrapper.indexOf("public.create_appointment_series(")).toBeLessThan(
      wrapper.indexOf("private.reserve_package_appointments("),
    );
  });

  it("keeps technical package identifiers out of the human timeline DTO", () => {
    const timeline = source("src/lib/appointment-timeline.ts");
    expect(timeline).toContain('package_reservation_released: "Reserva do pacote liberada"');
    expect(timeline).toContain('package_ended_partial: "Pacote encerrado após uso parcial"');
    expect(timeline).toContain('financial_adjustment_review: "Ajuste financeiro aguardando revisão"');
    expect(timeline).not.toContain("packageId: record");
  });
});
