import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { hasMaterialAppointmentChanges } from "@/lib/appointment-change-detection";
import { isAppointmentDraggable } from "@/lib/appointment-drag";
import {
  getAppointmentSyncPresentation,
  isWaitlistAppointment,
  normalizeAppointmentSyncStatus,
} from "@/lib/appointment-metadata";
import type { Appointment } from "@/types";

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: "appointment-1",
  user_id: "professional-1",
  patient_id: "patient-1",
  start_time: "2099-08-04T12:00:00.000Z",
  end_time: "2099-08-04T12:50:00.000Z",
  type: "presencial",
  status: "unscored",
  lifecycle_status: "confirmed",
  notes: null,
  location: "Clínica",
  created_at: "2099-01-01T00:00:00.000Z",
  metadata: { kind: "session", origin: "neuronex" },
  ...overrides,
});

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Agenda lifecycle UI", () => {
  it("normalizes legacy Google states without showing a pending sync while disconnected", () => {
    expect(normalizeAppointmentSyncStatus("pending")).toBe("not_configured");
    expect(normalizeAppointmentSyncStatus("pending", { googleEventId: "google-1" })).toBe("queued");
    expect(normalizeAppointmentSyncStatus("imported")).toBe("synced");
    expect(normalizeAppointmentSyncStatus("pending_professional_review")).toBe("conflict");
    expect(getAppointmentSyncPresentation("pending").label).toBe("Google não conectado");
  });

  it("recognizes waitlist provenance from the origin or persisted identifiers", () => {
    expect(isWaitlistAppointment(appointment({ metadata: { kind: "session", origin: "waitlist" } }))).toBe(true);
    expect(isWaitlistAppointment(appointment({ metadata: { kind: "session", waitlistOfferId: "offer-1" } }))).toBe(true);
    expect(isWaitlistAppointment(appointment())).toBe(false);
  });

  it("does not classify equivalent detail values as a reschedule", () => {
    const current = appointment();
    expect(hasMaterialAppointmentChanges(current, {
      start_time: "2099-08-04T09:00:00.000-03:00",
      end_time: current.end_time,
      type: current.type,
      location: "  Clínica  ",
    })).toBe(false);
    expect(hasMaterialAppointmentChanges(current, {
      start_time: "2099-08-04T13:00:00.000Z",
    })).toBe(true);
  });

  it("allows only future, active appointments to be dragged", () => {
    const now = new Date("2099-08-04T10:00:00.000Z");
    expect(isAppointmentDraggable(appointment(), now)).toBe(true);
    expect(isAppointmentDraggable(appointment({ status: "cancelled_by_patient" }), now)).toBe(false);
    expect(isAppointmentDraggable(appointment({ lifecycle_status: "reschedule_requested" }), now)).toBe(false);
    expect(isAppointmentDraggable(appointment({ lifecycle_status: "completed" }), now)).toBe(false);
    expect(isAppointmentDraggable(appointment({ start_time: "2099-08-04T09:00:00.000Z" }), now)).toBe(false);
  });

  it("keeps drag review accessible and checks conflicts against the unfiltered collection", () => {
    const calendar = read("src/components/agenda/CalendarView.tsx");
    const conflictDialog = read("src/components/agenda/AppointmentRescheduleConflictDialog.tsx");
    expect(calendar).toContain("useSensor(KeyboardSensor)");
    expect(calendar).toContain("accessibility={{");
    expect(calendar).toContain("new Date(newStart.getTime() + duration)");
    expect(calendar).toContain("getAppointmentPlanIssues(plan)");
    expect(conflictDialog).toContain("suggestAppointmentSmartFit");
    expect(calendar).toContain("<WaitlistOriginMark appointment={app}");
    expect(calendar).toContain("dragIdempotencyRef");
  });

  it("mounts Google polling once in the desktop shell and only when connected", () => {
    const layout = read("src/components/layout/Layout.tsx");
    const syncHook = read("src/hooks/use-google-calendar-sync.ts");
    const dashboard = read("src/components/dashboard/desktop/DesktopDashboardCommandCenter.tsx");
    expect(layout).toContain("<DesktopGoogleCalendarSync />");
    expect(syncHook).toContain("accessToken && isConnected && !isLoadingConnection");
    expect(dashboard).not.toContain("useGoogleCalendarSync()");
  });

  it("uses Google sendUpdates as a query parameter and returns provider failures as HTTP errors", () => {
    const createFunction = read("supabase/functions/google-calendar-sync/index.ts");
    const manageFunction = read("supabase/functions/google-calendar-manage/index.ts");
    expect(createFunction).toContain("events?sendUpdates=${sendUpdates}");
    expect(createFunction).not.toMatch(/body:\s*JSON\.stringify\([\s\S]*?sendUpdates:/u);
    expect(manageFunction).toContain("status: 502");
    expect(manageFunction).toContain("status: 401");
  });

  it("shows one status disclosure and moves origin into the detail cards", () => {
    const detail = read("src/components/agenda/AppointmentDetailModal.tsx");
    const calendar = read("src/components/agenda/CalendarView.tsx");
    expect(detail).toContain("getAppointmentDetailStatusLabel");
    expect(detail).toContain("getAppointmentOriginLabel");
    expect(detail).toContain("Abrir histórico do agendamento");
    expect(detail).toContain('label="Origem"');
    expect(detail).not.toContain("PopoverTrigger");
    expect(detail).not.toContain('aria-label="Contexto do agendamento"');
    expect(detail).not.toContain("Status do agendamento");
    expect(detail).toContain("Detalhes da sessão");
    expect(detail).toContain("Detalhes do evento");
    expect(detail).toContain("if (!hasAnyChange)");
    expect(detail).not.toContain("Pendente de sync");
    expect(calendar).toContain('role="img"');
    expect(calendar).toContain('aria-label="Criado pela lista de espera inteligente"');
  });

  it("cancels the deterministic Google event even before its id was persisted locally", () => {
    const provider = read("supabase/functions/_shared/google-calendar-provider.ts");
    expect(provider).toContain('if (input.operation === "cancel")');
    expect(provider).toContain("method: \"DELETE\"");
    expect(provider).not.toContain('if (!existingEventId) return { skipped: true, reason: "never_synced" };');
  });
});
