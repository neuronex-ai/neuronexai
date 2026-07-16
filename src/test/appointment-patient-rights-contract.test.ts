import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const compact = (value: string) => value.replace(/--[^\r\n]*/gu, " ").replace(/\s+/gu, " ").trim();

const migrationPath = "supabase/migrations/20260715215404_appointment_policy_and_patient_rights.sql";
const migration = read(migrationPath);
const compactMigration = compact(migration).toLowerCase();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function lastSqlFunction(qualifiedName: string) {
  const declaration = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+${escapeRegExp(qualifiedName)}\\s*\\(`,
    "giu",
  );
  const matches = [...migration.matchAll(declaration)];
  const start = matches.at(-1)?.index;
  if (start === undefined) throw new Error(`Missing SQL function ${qualifiedName}`);
  const bodyStart = migration.indexOf("as $$", start);
  const bodyEnd = migration.indexOf("\n$$;", bodyStart);
  if (bodyStart < 0 || bodyEnd < 0) throw new Error(`Cannot isolate SQL function ${qualifiedName}`);
  return migration.slice(start, bodyEnd + 4);
}

function responseObjectBodies(source: string) {
  return [...source.matchAll(/return\s+appointmentJson\s*\(\s*\{([\s\S]*?)\}\s*(?:,\s*\d+)?\s*\);/gu)]
    .map((match) => match[1]);
}

describe("secure appointment public surface", () => {
  it("builds the public appointment DTO from an explicit safe allowlist", () => {
    const dtoModule = "supabase/functions/_shared/appointment-public-dto.ts";
    const source = existsSync(resolve(root, dtoModule))
      ? read(dtoModule)
      : read("supabase/functions/_shared/appointment-lifecycle.ts");
    const serializer = source.match(
      /export function serializePublicAppointment\([^]*?\n\}/u,
    )?.[0] || "";

    expect(serializer).not.toBe("");
    expect(serializer).not.toMatch(/context\.(?:tokenHash|tokenRow)/u);
    expect(serializer).not.toMatch(/(?:appointment|patient|profile)\.(?:id|user_id|patient_id|email|metadata|audit_metadata)\b/u);
    expect(serializer).not.toMatch(/(?:id|appointmentId|patientId|professionalId|requestId|tokenId|metadata)\s*:/u);
    expect(serializer).not.toMatch(/status:\s*context\.pendingRequest\.status/u);
    expect(serializer).toMatch(/flow_state:\s*publicFlowState\(appointment\.lifecycle_status\)/u);

    const publicStateMapper = source.match(/function publicFlowState\([^]*?\n\}/u)?.[0] || "";
    expect(publicStateMapper).toMatch(/reschedule_rejected["']:\s*return\s+["']request_declined_actions_open/u);
    expect(publicStateMapper).toMatch(/professional_response_overdue["']:\s*return\s+["']professional_late_actions_open/u);
  });

  it("keeps the bearer-token route outside analytics-heavy providers and cookie UI", () => {
    const index = read("index.html");
    const surface = read("src/lib/application-surface.ts");
    const cookieConsent = read("src/components/landing/CookieConsent.tsx");
    const app = read("src/App.tsx");

    expect(index).not.toMatch(/googletagmanager|google-analytics|gtag\s*\(/iu);
    expect(surface).not.toMatch(/OPERATIONAL_ROUTE_ROOTS[\s\S]*?["']\/confirmar-agendamento["']/u);
    expect(cookieConsent).toMatch(/SENSITIVE_ROUTE_ROOTS[\s\S]*?["']\/confirmar-agendamento["']/u);
    expect(cookieConsent).toMatch(/if\s*\(isSensitiveRoute\(pathname\)\)\s*return\s+null/u);
    expect(app).toMatch(/<Route\s+path=["']\/confirmar-agendamento\/:token["']/u);
  });

  it("serves the secure route with private caching, no referrer and no indexing", () => {
    const config = JSON.parse(read("vercel.json")) as {
      headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
    };
    const secureRule = config.headers?.find((rule) => rule.source === "/confirmar-agendamento/(.*)");
    const headers = new Map(
      secureRule?.headers?.map(({ key, value }) => [key?.toLowerCase(), value?.toLowerCase()]) || [],
    );

    expect(headers.get("cache-control")).toContain("private");
    expect(headers.get("cache-control")).toContain("no-store");
    expect(headers.get("pragma")).toBe("no-cache");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("x-robots-tag")).toContain("noindex");
    expect(headers.get("x-robots-tag")).toContain("noarchive");
  });

  it("filters the exact rejected slot in the current appointment revision", () => {
    const source = read("supabase/functions/_shared/appointment-availability.ts");

    expect(source).toMatch(/from\(["']appointment_reschedule_requests["']\)[\s\S]*?\.eq\(["']appointment_revision["'],\s*appointment\.confirmation_revision\)/u);
    expect(source).toMatch(/\.eq\(["']status["'],\s*["']rejected["']\)/u);
    expect(source).toMatch(/rejected[\s\S]*?start\.getTime\(\)\s*===\s*slot\.start[\s\S]*?end\.getTime\(\)\s*===\s*slot\.end/u);
    expect(source).toMatch(/!rejected/u);
  });

  it("builds availability in the snapshot timezone instead of a fixed UTC offset", () => {
    const source = read("supabase/functions/_shared/appointment-availability.ts");

    expect(source).toMatch(/context\.policySnapshot\?\.timezone/u);
    expect(source).toMatch(/new\s+Intl\.DateTimeFormat\([\s\S]*?\{\s*timeZone\s*\}/u);
    expect(source).toMatch(/localDateTime\(date,\s*minute,\s*timeZone\)/u);
    expect(source).not.toMatch(/-\s*3\s*\*\s*60|03:00|america\/sao_paulo[^\r\n]*localdatetime/iu);
  });

  it("does not let the professional write cancellation, no-show or status directly from details", () => {
    const source = read("src/components/agenda/AppointmentDetailModal.tsx");
    const saveBody = source.match(/const\s+saveDetails\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};/u)?.[1] || "";

    expect(saveBody).not.toMatch(/\bstatus\s*:/u);
    expect(saveBody).not.toMatch(/cancelled_by_patient|cancelled_by_professional|\bno[_-]?show\b|\babsent\b/iu);
    expect(source).not.toMatch(/<SelectItem[^>]*value=["'](?:cancelled|cancelled_by_patient|no_show|absent|completed)["']/iu);
    expect(source).not.toMatch(/Paciente cancelou|N[aã]o compareceu/iu);
  });

  it("returns an allowlisted review result instead of raw appointment or request rows", () => {
    const source = read("supabase/functions/review-appointment-reschedule/index.ts");
    const responses = responseObjectBodies(source);

    expect(responses.length).toBeGreaterThan(0);
    for (const response of responses) {
      expect(response).not.toMatch(/^\s*(?:appointment|request|appointmentId|requestId|tokenId|metadata)\s*:/imu);
      expect(response).not.toMatch(/to_jsonb|reviewedAppointment|rescheduleResult\.data/iu);
    }
  });

  it("renders and sends separate cancellation and rescheduling deadlines", () => {
    const renderer = read("supabase/functions/_shared/operational-email.ts");
    const compactRenderer = compact(renderer);
    const reminder = read("supabase/functions/send-appointment-reminder/index.ts");
    const review = read("supabase/functions/review-appointment-reschedule/index.ts");

    expect(renderer).toMatch(/cancellationDeadline\?:\s*string/u);
    expect(renderer).toMatch(/rescheduleDeadline\?:\s*string/u);
    expect(compactRenderer).toMatch(/Cancelamento[^`]*safe\(cancellationDeadline\)/u);
    expect(compactRenderer).toMatch(/outro (?:hor[aá]rio|hor&aacute;rio)[^`]*safe\(rescheduleDeadline\)/iu);
    for (const source of [reminder, review]) {
      expect(source).toMatch(/cancellationDeadline:\s*freeCancellationDeadline/u);
      expect(source).toMatch(/rescheduleDeadline:\s*freeRescheduleDeadline/u);
    }
  });
});

describe("appointment policy and patient-rights migration contract", () => {
  it("treats both policy cutoffs as inclusive instants", () => {
    const action = compact(lastSqlFunction("public.process_appointment_public_action")).toLowerCase();

    expect(action).toContain("v_now <= v_snapshot.free_cancellation_cutoff_at");
    expect(action).toContain("v_now <= v_snapshot.free_reschedule_cutoff_at");
  });

  it("makes policy snapshots and appointment events append-only", () => {
    expect(compactMigration).toMatch(/create trigger appointment_policy_snapshots_immutable before update or delete on public\.appointment_policy_snapshots/u);
    expect(compactMigration).toMatch(/create trigger [a-z0-9_]*appointment_events[a-z0-9_]* before update or delete on public\.appointment_events/u);
    expect(compactMigration).toMatch(
      /revoke\s+(?:all|[^;]*\bupdate\b[^;]*\bdelete\b)\s+on table public\.appointment_events/u,
    );
  });

  it("grants cancellation protection only from the current pending or active reaction window", () => {
    const action = lastSqlFunction("public.process_appointment_public_action");
    const cancelStart = action.indexOf("if p_action = 'cancel' then");
    const cancelEnd = action.indexOf("elsif p_action = 'reschedule' then", cancelStart + 1);
    const cancellation = compact(action.slice(cancelStart, cancelEnd)).toLowerCase();

    expect(cancellation).not.toMatch(/protected_request\.status in \([^)]*'(?:rejected|expired_no_response)'/u);
    expect(cancellation).not.toMatch(/financial_right_protected[^;]*status in \([^)]*'rejected'/u);
    expect(cancellation).toMatch(/reaction_due_at|patient_action_due_at|current_[a-z0-9_]*protection/u);
  });

  it("turns a late professional response into protection and caps the SLA at appointment start", () => {
    const publicAction = compact(lastSqlFunction("public.process_appointment_public_action")).toLowerCase();
    const review = compact(lastSqlFunction("public.review_appointment_reschedule")).toLowerCase();
    const protectionAssignment = review.match(/v_permanent_protection\s*:=\s*([^;]+);/u)?.[1] || "";

    expect(publicAction).toMatch(/v_response_due_at\s*:=\s*least\s*\([^;]*v_appointment\.start_time/u);
    expect(protectionAssignment).toContain("v_response_late");
    expect(protectionAssignment).not.toMatch(/v_response_late\s+and/u);
    expect(review).toMatch(/v_now\s*>?=\s*v_request\.professional_response_due_at/u);
  });

  it("forbids plaintext confirmation secrets and binds every token to a revision", () => {
    expect(compactMigration).toMatch(/check\s*\(\s*token\s+is\s+null\s*\)/u);
    expect(compactMigration).toMatch(/check\s*\(\s*auth_code\s+is\s+null\s*\)/u);
    expect(compactMigration).toMatch(/appointment_confirmation_tokens[^;]*check\s*\(\s*token\s+is\s+null\s*\)/u);
    expect(compactMigration).toMatch(/appointment_confirmation_tokens_one_active_idx[^;]*appointment_id[^;]*where status in \('pending', 'sent', 'opened'\)[^;]*revoked_at is null/u);

    const resolver = read("supabase/functions/_shared/appointment-lifecycle.ts");
    expect(resolver).toMatch(/tokenResult\.data\.appointment_revision\s*!==\s*appointmentResult\.data\.confirmation_revision/u);
  });

  it("allows only one pending reschedule request per appointment", () => {
    expect(compactMigration).toMatch(
      /create unique index (?:if not exists )?[a-z0-9_]*pending[a-z0-9_]* on public\.appointment_reschedule_requests\s*\(\s*appointment_id\s*\)\s*where status = 'pending'/u,
    );
  });

  it("fingerprints idempotent commands and leases outbox claims", () => {
    expect(compactMigration).toMatch(/(?:request|payload|command)_fingerprint\s+(?:text|bytea)/u);
    expect(compactMigration).toMatch(/appointment_communication_outbox[^;]*lease_token\s+uuid/u);

    const claim = compact(lastSqlFunction("public.claim_appointment_communication_outbox")).toLowerCase();
    const complete = compact(lastSqlFunction("public.complete_appointment_communication_outbox")).toLowerCase();
    expect(claim).toMatch(/lease_token\s*=\s*gen_random_uuid\(\)/u);
    expect(claim).toMatch(/status = 'processing'[^;]*lease_expires_at\s*<=\s*now\(\)/u);
    expect(complete).toMatch(/p_lease_token\s+uuid/u);
    expect(complete).toMatch(/lease_token\s*=\s*p_lease_token/u);
  });

  it("exposes the professional timeline only through a safe human DTO", () => {
    expect(compactMigration).toMatch(/create or replace function public\.get_safe_appointment_timeline\s*\(/u);
    const safeTimeline = compact(lastSqlFunction("public.get_safe_appointment_timeline")).toLowerCase();
    expect(safeTimeline).not.toMatch(/ip_address|user_agent|token_hash|token_id/u);
    expect(safeTimeline).toMatch(/actor|channel|title|detail/u);

    const hook = read("src/hooks/use-appointment-lifecycle.ts");
    expect(hook).toMatch(/\.rpc\(["']get_safe_appointment_timeline["']/u);
    expect(hook).not.toMatch(/\.from\(["']appointment_events["']\)/u);
  });

  it("guards package consumption at the ledger boundary while patient rights are protected", () => {
    expect(compactMigration).toMatch(/create trigger [a-z0-9_]*(?:package|usage)[a-z0-9_]*(?:guard|protect)[a-z0-9_]* before insert on public\.patient_package_session_usages/u);
    const guard = compact(lastSqlFunction("private.guard_appointment_package_consumption")).toLowerCase();
    expect(guard).toMatch(/new\.action\s*(?:=|<>)\s*'consume'/u);
    expect(guard).toMatch(/patient_right_status\s*<>\s*'standard'|patient_right_status[^;]*\b(?:request_pending|reaction_window|financially_protected|disputed)\b/u);
    expect(guard).toMatch(/confirmed_revision[^;]*confirmation_revision/u);
  });
});
