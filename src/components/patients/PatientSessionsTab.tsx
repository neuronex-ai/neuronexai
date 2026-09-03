import { useEffect, useState } from "react";
import { Clock3, FileText } from "lucide-react";

import { ClinicalSummaryCard } from "@/components/patients/ClinicalSummaryCard";
import { PatientHistoryTab } from "@/components/patients/PatientHistoryTab";
import { PatientPendingSessionReviewsTab } from "@/components/patients/PatientPendingSessionReviewsTab";
import { MagneticSegmentedControl } from "@/components/ui/magnetic-segmented-control";
import type { Patient, SessionNote } from "@/types";

interface PatientSessionsTabProps {
  patient: Patient;
  patientId: string;
  latestNote?: SessionNote;
  view: "history" | "pending";
  onViewChange: (view: "history" | "pending") => void;
}

const views = [
  { value: "history" as const, label: "Histórico", icon: FileText },
  { value: "pending" as const, label: "Pendentes", icon: Clock3 },
];

export function PatientSessionsTab({ patient, patientId, latestNote, view, onViewChange }: PatientSessionsTabProps) {
  const [mountedViews, setMountedViews] = useState<Set<"history" | "pending">>(() => new Set([view]));

  useEffect(() => {
    setMountedViews((current) => {
      if (current.has(view)) return current;
      const next = new Set(current);
      next.add(view);
      return next;
    });
  }, [view]);

  return (
    <div className="space-y-4 pb-6">
      <div className="patient-record-panel flex flex-col gap-4 rounded-[26px] border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="px-2">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">Jornada clínica</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-foreground">Sessões</h2>
        </div>
        <MagneticSegmentedControl
          id="patient-sessions"
          indicatorId="patient-sessions-active-view"
          value={view}
          onValueChange={onViewChange}
          ariaLabel="Visualização das sessões"
          className="desktop-retina-inset min-h-11 border border-border/45 bg-background/48 p-1"
          triggerClassName="min-h-11 min-w-32 rounded-[14px] px-4 text-[9px] font-black uppercase tracking-[0.15em]"
          options={views.map((item) => ({
            value: item.value,
            ariaLabel: item.label,
            label: <><item.icon className="h-3.5 w-3.5" aria-hidden="true" />{item.label}</>,
          }))}
        />
      </div>

      <div className="relative min-h-[420px]">
        {mountedViews.has("history") ? (
          <div
            id="patient-sessions-panel-history"
            role="tabpanel"
            aria-labelledby="patient-sessions-tab-history"
            tabIndex={view === "history" ? 0 : -1}
            hidden={view !== "history"}
            className="space-y-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
          >
            <ClinicalSummaryCard latestNote={latestNote} patient={patient} />
            <PatientHistoryTab patientId={patientId} />
          </div>
        ) : null}

        {mountedViews.has("pending") ? (
          <div
            id="patient-sessions-panel-pending"
            role="tabpanel"
            aria-labelledby="patient-sessions-tab-pending"
            tabIndex={view === "pending" ? 0 : -1}
            hidden={view !== "pending"}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
          >
            <PatientPendingSessionReviewsTab patientId={patientId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}