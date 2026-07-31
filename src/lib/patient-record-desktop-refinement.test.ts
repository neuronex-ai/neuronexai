import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceOf = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("patient record desktop refinement contracts", () => {
  it("keeps the previously delivered appointment and patient-record surfaces connected", () => {
    const summaryTab = sourceOf("src/components/patients/PatientRecordSummaryTab.tsx");
    const financeTab = sourceOf("src/components/patients/PatientFinanceTab.tsx");
    const appointmentDetails = sourceOf("src/components/agenda/AppointmentDetailModal.tsx");
    const appointmentEmail = sourceOf("supabase/functions/send-appointment-reminder/index.ts");

    expect(summaryTab).toContain("PatientCompleteAppointmentHistory");
    expect(financeTab).toContain("usePatientInvoices(patientId)");
    expect(financeTab).toContain('{ value: "nfse" as const, label: "NFS-e"');
    expect(appointmentDetails).toContain('Arquivar {isSession ? "agendamento" : "evento"}');
    expect(appointmentDetails).toContain('Cancelar {isSession ? "agendamento" : "evento"}');
    expect(appointmentEmail).toContain('/confirmar-agendamento/${rawToken}');
  });

  it("keeps session summaries traceable to their originating appointment", () => {
    const timelineHook = sourceOf("src/hooks/use-patient-timeline.ts");
    const pendingReviews = sourceOf("src/components/patients/PatientPendingSessionReviewsTab.tsx");
    const unifiedTimeline = sourceOf("src/components/patients/PatientUnifiedTimeline.tsx");
    const appointmentSource = sourceOf("src/components/patients/SessionAppointmentSource.tsx");

    expect(timelineHook).toContain("appointment_id");
    expect(pendingReviews).toContain("SessionAppointmentSource");
    expect(unifiedTimeline).toContain("SessionAppointmentSource");
    expect(appointmentSource).toContain("AppointmentDetailModal");
    expect(appointmentSource).toContain("Origem:");
    expect(appointmentSource).not.toContain("{appointmentId}");
  });

  it("shows a human financial origin and only edits manual movements", () => {
    const financeTab = sourceOf("src/components/patients/PatientFinanceTab.tsx");
    const transactionModal = sourceOf("src/components/financeiro/EditTransactionModal.tsx");

    expect(financeTab).toContain("managementOriginOf(transaction)");
    expect(transactionModal).toContain('originLabel === "Lançamento manual"');
    expect(transactionModal).toContain("TransactionDetailView");
    expect(transactionModal).toContain("EditTransactionForm");
  });

  it("uses compact accessible status icons and neutral dark-mode edges", () => {
    const statusIcon = sourceOf("src/components/patients/PatientStatusIcon.tsx");
    const moodTab = sourceOf("src/components/patients/PatientMoodTab.tsx");
    const touchedSurfaces = [
      "src/components/dashboard/AlertsPanel.tsx",
      "src/components/financeiro/EditTransactionModal.tsx",
      "src/components/financeiro/TransactionDetailView.tsx",
      "src/components/patients/MedicationUpdateForm.tsx",
      "src/components/patients/MedicationUpdateModal.tsx",
      "src/components/patients/PatientMoodTab.tsx",
      "src/components/patients/PatientRecordSummaryTab.tsx",
    ].map(sourceOf).join("\n");

    expect(statusIcon).toContain("TooltipContent");
    expect(statusIcon).toContain("aria-label={label}");
    expect(moodTab).toContain("patient-status-icon");
    expect(touchedSurfaces).not.toMatch(/dark:border-white/);
  });
});
