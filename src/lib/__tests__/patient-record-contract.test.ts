import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("desktop patient record contract", () => {
  it("keeps the record header outside independent scrolling regions", () => {
    const detail = source("src/pages/patients-view/PatientDetail.tsx");

    expect(detail).toContain("relative h-dvh w-full overflow-hidden");
    expect(detail).toContain("patient-record-header");
    expect(detail).toContain("patient-record-scrollbar z-20 min-h-0");
    expect(detail).toContain("patient-record-scrollbar relative h-full min-h-0");
    expect(detail).toContain('tabIndex={isActive ? 0 : -1}');
    expect(detail).toContain('role="tablist"');
    expect(detail).toContain('{ val: "summary", label: "Resumo"');
    expect(detail).toContain('{ val: "sessions", label: "Sessões"');
  });

  it("preserves legacy links while rendering Summary and Sessions", () => {
    const detail = source("src/pages/patients-view/PatientDetail.tsx");

    expect(detail).toContain('requestedTab === "history" || requestedTab === "pending_reviews"');
    expect(detail).toContain('canonicalParams.set("tab", "sessions")');
    expect(detail).toContain('requestedTab === "pending_reviews" ? "pending" : "history"');
    expect(detail).toContain("PatientRecordSummaryTab");
    expect(detail).toContain("PatientSessionsTab");
  });

  it("prefers the ownership-checked RPC and keeps an RLS-preserving compatibility fallback", () => {
    const hook = source("src/hooks/use-patient-record-summary.ts");
    const migration = source("supabase/migrations/20260712185135_patient_record_summary_rpc.sql");

    expect(hook).toContain('supabase.rpc("get_patient_record_summary"');
    expect(hook).toContain('supabase.from("patients").select("id,risk_score")');
    expect(hook).toContain("if (!patientResult.data) throw");
    expect(hook).toContain("return fetchPatientRecordSummaryFallback(patientId)");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("p.user_id = v_user_id");
    expect(migration).toContain("v_user_id uuid := (select auth.uid())");
    expect(migration).toContain("revoke all on function public.get_patient_record_summary(uuid) from public, anon");
    expect(migration).toContain("pp.package_status = 'active'");
    expect(migration).toContain("Patient anamneses owner delete");
    expect(migration).not.toContain('USING (true)');
  });

  it("shares the mood chart and uses accessible anamnesis dialogs", () => {
    const portal = source("src/pages/PatientPortal.tsx");
    const mood = source("src/components/patients/PatientMoodTab.tsx");
    const template = source("src/components/patients/anamnesis/TemplateAnamnesis.tsx");
    const view = source("src/components/patients/anamnesis/ViewAnamnesis.tsx");

    expect(portal).toContain('import { MoodTrendChart } from "@/components/patients/MoodTrendChart"');
    expect(mood).toContain('import { MoodTrendChart } from "@/components/patients/MoodTrendChart"');
    expect(template).toContain("onCloseAutoFocus");
    expect(template).toContain("<Dialog open=");
    expect(view).toContain("<AlertDialog open={confirmDeleteOpen}");
    expect(view).not.toContain('className="fixed inset-0');
    expect(view).toContain("onResetToSelection?.()");
  });

  it("does not reintroduce blue-shifted neutral surfaces", () => {
    const files = [
      "src/pages/patients-view/PatientDetail.tsx",
      "src/components/patients/PatientUnifiedTimeline.tsx",
      "src/components/patients/PatientPendingSessionReviewsTab.tsx",
      "src/components/patients/PackageCard.tsx",
      "src/components/patients/anamnesis/ViewAnamnesis.tsx",
    ];

    const combined = files.map(source).join("\n").toLowerCase();
    expect(combined).not.toMatch(/#(?:0b0b0d|0a0a0b|141415|080809|18181a)/);
    expect(combined).not.toContain("premium-noise");
  });
});
