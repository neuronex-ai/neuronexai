import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const migration = read("supabase/migrations/20260716023000_appointment_archive_and_patient_history.sql");
const compact = (value: string) => value.replace(/--[^\r\n]*/gu, " ").replace(/\s+/gu, " ").trim();

function sqlFunction(name: string) {
  const start = migration.toLowerCase().lastIndexOf(`create or replace function public.${name.toLowerCase()}(`);
  if (start < 0) throw new Error(`Missing SQL function ${name}`);
  const bodyStart = migration.indexOf("as $$", start);
  const bodyEnd = migration.indexOf("\n$$;", bodyStart);
  if (bodyStart < 0 || bodyEnd < 0) throw new Error(`Cannot isolate SQL function ${name}`);
  return compact(migration.slice(start, bodyEnd + 4)).toLowerCase();
}

describe("appointment archive and patient-record interface contract", () => {
  it("archives visually without deleting immutable appointment history", () => {
    const execute = sqlFunction("execute_professional_appointment_action");

    expect(migration).toMatch(/archived_at\s+timestamptz/u);
    expect(migration).toMatch(/visibility_status[^;]*visible[^;]*archived/u);
    expect(execute).toMatch(/pg_advisory_xact_lock/u);
    expect(execute).toMatch(/idempotency/u);
    expect(execute).toMatch(/visibility_status\s*=\s*'archived'/u);
    expect(execute).toMatch(/appointment_archived/u);
    expect(execute).not.toMatch(/delete\s+from\s+public\.appointments/u);
  });

  it("keeps archived appointments out of agenda queries but in the complete patient history", () => {
    for (const path of [
      "src/hooks/use-appointments.ts",
      "src/hooks/use-appointments-by-date-range.ts",
      "src/hooks/use-appointments-by-range.ts",
      "src/hooks/use-patient-appointments.ts",
      "src/hooks/use-day-operations.ts",
      "src/hooks/use-dashboard-alerts.ts",
      "src/hooks/use-smart-insights.ts",
      "src/hooks/use-smart-availability.ts",
      "src/hooks/use-patient-churn-risk.ts",
    ]) {
      const source = read(path);
      expect(source).toMatch(/visibility_status["'],\s*["']visible/u);
      expect(source).toMatch(/archived_at["'],\s*null/u);
    }

    const historyFunction = sqlFunction("get_patient_complete_appointment_history");
    const historyHook = read("src/hooks/use-patient-complete-appointment-history.ts");
    const historyView = read("src/components/patients/PatientCompleteAppointmentHistory.tsx");
    expect(historyFunction).toMatch(/get_safe_appointment_timeline/u);
    expect(historyFunction).toMatch(/'archived'/u);
    expect(historyHook).toMatch(/rpc\(["']get_patient_complete_appointment_history["']/u);
    expect(historyHook).not.toMatch(/\.from\(["']appointment_events["']/u);
    expect(historyView).toMatch(/item\.archiveLabel/u);
  });

  it("exposes professional cancel and archive actions through a preview-first dialog", () => {
    const modal = read("src/components/agenda/AppointmentDetailModal.tsx");
    const dialog = read("src/components/agenda/AppointmentProfessionalActionDialog.tsx");
    const hook = read("src/hooks/use-appointment-professional-action.ts");

    expect(modal).toMatch(/Arquivar \{isSession \? "agendamento" : "evento"\}/u);
    expect(modal).toMatch(/Cancelar \{isSession \? "agendamento" : "evento"\}/u);
    expect(modal).toMatch(/AppointmentProfessionalActionDialog/u);
    expect(dialog).toMatch(/preview/u);
    expect(dialog).toMatch(/Motivo/u);
    expect(dialog).toMatch(/action:\s*["']cancel["']/u);
    expect(hook).toMatch(/preview_professional_appointment_action/u);
    expect(hook).toMatch(/execute_professional_appointment_action/u);
  });

  it("keeps charges and NFS-e scoped to the current patient", () => {
    const finance = read("src/components/patients/PatientFinanceTab.tsx");
    const invoiceModal = read("src/components/financeiro/InvoiceEmissionModal.tsx");
    const rps = read("src/components/financeiro/invoice/GenerateRPSForm.tsx");
    const externalInvoice = read("src/components/financeiro/invoice/RegisterExternalInvoiceForm.tsx");

    expect(finance).toMatch(/Movimenta(?:ç|Ã§)ões/u);
    expect(finance).toMatch(/Cobranças/u);
    expect(finance).toMatch(/NFS-e/u);
    expect(finance).toMatch(/initialPatientId=\{patientId\}/u);
    for (const source of [invoiceModal, rps, externalInvoice]) {
      expect(source).toMatch(/initialPatientId/u);
    }
  });

  it("keeps the appointment email template linked to the secure public route", () => {
    const app = read("src/App.tsx");
    const sender = read("supabase/functions/send-appointment-reminder/index.ts");
    const renderer = read("supabase/functions/_shared/operational-email.ts");

    expect(app).toMatch(/path=["']\/confirmar-agendamento\/:token["']/u);
    expect(sender).toMatch(/confirmationUrl\s*=\s*`\$\{appPublicUrl\(\)\}\/confirmar-agendamento\/\$\{rawToken\}`/u);
    expect(sender).toMatch(/actionLabel:\s*isCancellation\s*\?\s*["']Ver detalhes["']\s*:\s*["']Gerenciar agendamento["']/u);
    expect(renderer).toMatch(/actionUrl/u);
    expect(renderer).toMatch(/actionLabel/u);
  });

  it("does not reintroduce raw audit data into the patient history UI", () => {
    const historyHook = read("src/hooks/use-patient-complete-appointment-history.ts");
    const historyView = read("src/components/patients/PatientCompleteAppointmentHistory.tsx");
    const combined = `${historyHook}\n${historyView}`;

    expect(combined).not.toMatch(/event_id|appointment_id|actor_user_id|token_hash|token_id|ip_address|user_agent|raw_metadata/iu);
    expect(historyView).not.toMatch(/JSON\.stringify/u);
  });
});
