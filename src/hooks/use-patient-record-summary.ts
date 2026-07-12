import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface PatientRecordSummary {
  completedSessions: number;
  pendingReviews: number;
  documents: number;
  activeGoals: number;
  nextSession: { id: string; start_time: string | null; type: string } | null;
  lastSession: { id: string; start_time: string | null; type: string } | null;
  activePackage: {
    id: string;
    description: string;
    total_sessions: number;
    sessions_used: number;
  } | null;
  openBalance: number;
  latestMood: { mood_score: number; created_at: string | null } | null;
  riskScore: number;
}

const emptySummary: PatientRecordSummary = {
  completedSessions: 0,
  pendingReviews: 0,
  documents: 0,
  activeGoals: 0,
  nextSession: null,
  lastSession: null,
  activePackage: null,
  openBalance: 0,
  latestMood: null,
  riskScore: 0,
};

function asSummary(value: unknown): PatientRecordSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptySummary;

  const record = value as Partial<PatientRecordSummary>;
  return {
    completedSessions: Number(record.completedSessions || 0),
    pendingReviews: Number(record.pendingReviews || 0),
    documents: Number(record.documents || 0),
    activeGoals: Number(record.activeGoals || 0),
    nextSession: record.nextSession ?? null,
    lastSession: record.lastSession ?? null,
    activePackage: record.activePackage ?? null,
    openBalance: Number(record.openBalance || 0),
    latestMood: record.latestMood ?? null,
    riskScore: Number(record.riskScore || 0),
  };
}

async function fetchPatientRecordSummary(patientId: string): Promise<PatientRecordSummary> {
  const { data, error } = await supabase.rpc("get_patient_record_summary", {
    p_patient_id: patientId,
  });

  if (error) throw error;
  return asSummary(data);
}

export function usePatientRecordSummary(patientId: string) {
  return useQuery({
    queryKey: ["patient-record-summary", patientId],
    queryFn: () => fetchPatientRecordSummary(patientId),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}
