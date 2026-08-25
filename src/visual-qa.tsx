import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { NextScheduleCard } from "@/components/dashboard/desktop/NextScheduleCard";
import type { Appointment } from "@/types";
import "@/index.css";
import "@/styles/dashboard-command-center-refinement.css";

const mockAppointment: Appointment = {
  id: "qa-appointment",
  user_id: "qa-professional",
  patient_id: "qa-patient",
  patient_name: "Carlos Almeida",
  start_time: "2026-08-25T19:00:00.000-03:00",
  end_time: "2026-08-25T19:50:00.000-03:00",
  type: "online",
  status: "confirmed",
  lifecycle_status: "confirmed",
  payment_status: "pending",
  series_id: "qa-series",
  occurrence_number: 5,
  occurrence_count: 6,
  location: "Teleconsulta NeuroNex",
  created_at: "2026-08-20T12:00:00.000Z",
  notes: null,
  metadata: {
    kind: "session",
    modality: "online",
    recurrence: { enabled: true, frequency: "weekly", count: 6 },
    financial: {
      mode: "neurofinance",
      transactionAmount: 220,
      neurofinanceChargeRequested: true,
    },
  },
};

const VisualQa = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <BrowserRouter>
      <main className="dashboard-desktop flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
        <section className="dashboard-morning-panel w-[520px] overflow-hidden rounded-[40px] border p-0">
          <div className="next-schedule-stage p-4">
            <NextScheduleCard
              today={new Date("2026-08-25T09:00:00.000-03:00")}
              appointment={mockAppointment}
              isLoading={false}
              expanded={expanded}
              onExpandedChange={setExpanded}
              latestSummaryText="Na última sessão, foram revisadas estratégias de regulação emocional e o plano de rotina para a semana."
              latestTopics={["Regulação emocional", "Rotina"]}
              latestNextSteps={["Revisar plano"]}
              loadingSessionNotes={false}
            />
          </div>
        </section>
      </main>
    </BrowserRouter>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VisualQa />
  </React.StrictMode>,
);
