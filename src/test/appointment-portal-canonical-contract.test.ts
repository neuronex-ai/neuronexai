import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("patient portal canonical appointment adapter", () => {
  const migration = read(
    "supabase/migrations/20260716081528_canonical_patient_appointment_command.sql",
  );
  const adapter = read(
    "supabase/functions/patient-portal-appointment-action/index.ts",
  );
  const legacyConfirmationAdapter = read(
    "supabase/functions/confirm-appointment/index.ts",
  );
  const portalCurrent = read(
    "supabase/functions/patient-portal-current/index.ts",
  );
  const legacyModal = read(
    "src/components/patient-portal/RequestAppointmentModal.tsx",
  );

  it("routes public links and portal sessions through one private command", () => {
    expect(migration).toContain(
      "create or replace function private.apply_appointment_command",
    );
    expect(
      migration.match(/private\.apply_appointment_command\(/gu)?.length || 0,
    ).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("'public_appointment'");
    expect(migration).toContain("'patient_portal'");
    expect(migration).toContain("p_expected_revision");
    expect(migration).toContain("errcode = '40001'");
  });

  it("authenticates the portal relationship and exposes only adapter actions", () => {
    expect(adapter).toContain("requireActivePatientPortal(request)");
    expect(adapter).toContain("resolveAppointmentContextById");
    expect(adapter).toContain(
      '"process_patient_portal_appointment_action_internal"',
    );
    expect(adapter).toContain("serializePublicAppointment(refreshed)");
    expect(adapter).toContain("calculatePatientAppointmentAvailability");
    expect(adapter).not.toMatch(
      /\.from\(["']appointments["']\)\s*\.(?:insert|update|delete)/u,
    );
  });

  it("keeps the legacy confirmation URL as a canonical command adapter", () => {
    expect(legacyConfirmationAdapter).toContain(
      'db.rpc("process_appointment_public_action"',
    );
    expect(legacyConfirmationAdapter).toContain(
      'compatibility_endpoint: "confirm-appointment"',
    );
    expect(legacyConfirmationAdapter).not.toMatch(
      /\.from\(["']appointments["']\)\s*\.(?:insert|update|delete)/u,
    );
    expect(legacyConfirmationAdapter).not.toMatch(
      /\.from\(["']appointment_confirmation_tokens["']\)\s*\.delete/u,
    );
  });

  it("never moves the official time while requesting a reschedule", () => {
    const requestSection = migration.slice(
      migration.indexOf(
        "insert into public.appointment_reschedule_requests",
      ),
      migration.indexOf(
        "create or replace function public.process_appointment_public_action",
      ),
    );
    expect(requestSection).toContain("requested_start_time");
    expect(requestSection).not.toContain(
      "start_time = p_requested_start_time",
    );
    expect(requestSection).not.toContain(
      "end_time = p_requested_end_time",
    );
  });

  it("removes portal notes, metadata and direct appointment creation", () => {
    const appointmentsLoader = portalCurrent.slice(
      portalCurrent.indexOf("async function loadAppointments"),
      portalCurrent.indexOf("async function loadDocuments"),
    );
    expect(appointmentsLoader).not.toMatch(/\bnotes\b|\bmetadata\b/u);
    expect(portalCurrent).not.toMatch(
      /\.from\(["']appointments["']\)\s*\n?\s*\.insert/u,
    );
    expect(portalCurrent).toContain('if (action === "request_appointment")');
    expect(portalCurrent).toContain("410");
    expect(legacyModal).not.toContain(".from('appointments')");
    expect(legacyModal).not.toContain('.from("appointments")');
  });

  it("keeps confirmation versioned and the DTO free of technical metadata", () => {
    const dto = read(
      "supabase/functions/_shared/appointment-public-dto.ts",
    );
    expect(dto).toContain(
      "revision: Number(appointment.confirmation_revision || 1)",
    );
    expect(dto).not.toMatch(/audit_metadata|tokenHash|tokenRow/u);
    expect(migration).toContain(
      "v_appointment.confirmation_revision <> p_expected_revision",
    );
  });
});
