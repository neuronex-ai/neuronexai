import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20260716082615_immutable_synapse_appointment_action_plans.sql",
);
const executor = read("supabase/functions/synapse-text-fallback/executor.ts");
const fallback = read("supabase/functions/synapse-text-fallback/index.ts");
const voice = read("supabase/functions/synapse-voice-tool/index.ts");
const gemini = read("supabase/functions/gemini-text-chat/tools-exec.ts");
const n8n = read("supabase/functions/n8n-agent-gateway/index.ts");

const directAppointmentWrite = /\.from\(["']appointments["']\)[\s\S]{0,240}?\.(?:insert|update|delete)\(/u;

describe("immutable Synapse appointment plans", () => {
  it("stores a versioned SHA-256 snapshot with a fifteen-minute lifetime", () => {
    expect(migration).toContain("create table public.appointment_action_plans");
    expect(migration).toContain("create table public.appointment_action_plan_events");
    expect(migration).toContain("plan_version integer not null default 1");
    expect(migration).toContain("snapshot_version integer not null default 1");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("digest(v_snapshot::text, 'sha256')");
    expect(migration).toContain("Immutable appointment plan facts cannot change");
    expect(migration).toContain("appointment action plan events are append-only".replace(/^a/, "A"));
  });

  it("implements the complete state and ownership contract", () => {
    for (const status of [
      "prepared", "awaiting_confirmation", "confirmed", "executing", "completed",
      "cancelled", "expired", "superseded", "review_required", "failed",
    ]) expect(migration).toContain(`'${status}'`);
    expect(migration).toContain("appointment_action_plans_owner_select");
    expect(migration).toContain("grant select on table public.appointment_action_plans to authenticated");
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]*appointment_action_plans\s+to authenticated/iu);
  });

  it("exposes authenticated RPCs and isolated service-role adapters", () => {
    for (const operation of ["prepare", "execute", "get", "cancel"]) {
      expect(migration).toContain(`${operation}_appointment_action_plan`);
    }
    expect(migration).toContain("perform private.assert_appointment_plan_service_role()");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("set search_path = ''");
  });

  it("rejects expiry, stale state, divergent hashes and foreign conversations", () => {
    expect(migration).toContain("Appointment plan hash changed; review the latest version");
    expect(migration).toContain("Appointment plan belongs to another conversation");
    expect(migration).toContain("v_plan.expires_at <= now()");
    expect(migration).toContain("state_changed_before_execution");
    expect(migration).toContain("v_plan.plan_version + 1");
  });

  it("serializes preparation and execution and keeps recurrence transactional", () => {
    expect(migration).toContain("appointment-plan-idempotency:");
    expect(migration).toContain("appointment-plan:");
    expect(migration).toContain("for update");
    expect(migration.match(/public\.create_appointment_series_with_package\(/gu)).toHaveLength(1);
    expect(migration).not.toMatch(/for\s+.+loop[\s\S]{0,500}create_appointment_series_with_package/iu);
  });

  it("prepares communications and financial effects without provider calls", () => {
    expect(migration).toContain("insert into public.appointment_communication_outbox");
    expect(migration).toContain("execute_package_lifecycle_change_internal");
    expect(migration).toContain("financialAdjustmentStatus");
    expect(migration).not.toMatch(/\bfetch\s*\(|api\.asaas|gmail\.googleapis/iu);
  });

  it("stores only immutable plan references in pending appointment actions", () => {
    const pendingSection = executor.slice(
      executor.indexOf("const pendingAction: PendingAction", executor.indexOf("prepareAppointmentMutation")),
      executor.indexOf("export async function cancelPendingAppointmentPlan"),
    );
    expect(pendingSection).toContain("plan_id: plan.planId");
    expect(pendingSection).toContain("plan_version: plan.planVersion");
    expect(pendingSection).toContain("plan_hash: plan.planHash");
    expect(pendingSection).not.toContain("start_time:");
    expect(pendingSection).not.toContain("financial:");
  });

  it("removes direct appointment writes from every Synapse adapter", () => {
    for (const source of [executor, gemini, n8n]) {
      expect(source).not.toMatch(directAppointmentWrite);
    }
    expect(gemini).toContain("prepareAppointmentActionPlan");
    expect(n8n).toContain("prepareAppointmentActionPlan");
    expect(n8n).toContain("appointment_status_unchanged: true");
  });

  it("preserves conversation and voice ownership through prepare, confirm and cancel", () => {
    expect(fallback).toContain("correlationId: sourceRequestId");
    expect(fallback).toContain("cancelPendingAppointmentPlan(pending.action, toolContext)");
    expect(voice).toContain("voiceSessionId: voiceSessionId || null");
    expect(voice).toContain("pending.action.conversationId !== sessionId");
    expect(voice).toContain("cancelPendingAppointmentPlan(pending.action, toolContext)");
  });
});
