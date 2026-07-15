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
    sessions_reserved: number;
  } | null;
  openBalance: number;
  latestMood: { mood_score: number; created_at: string | null } | null;
  riskScore: number;
}

export const emptyPatientRecordSummary: PatientRecordSummary = {
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

export function asPatientRecordSummary(value: unknown): PatientRecordSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyPatientRecordSummary;

  const record = value as Partial<PatientRecordSummary>;
  return {
    completedSessions: Number(record.completedSessions || 0),
    pendingReviews: Number(record.pendingReviews || 0),
    documents: Number(record.documents || 0),
    activeGoals: Number(record.activeGoals || 0),
    nextSession: record.nextSession ?? null,
    lastSession: record.lastSession ?? null,
    activePackage: record.activePackage
      ? { ...record.activePackage, sessions_reserved: Number(record.activePackage.sessions_reserved || 0) }
      : null,
    openBalance: Number(record.openBalance || 0),
    latestMood: record.latestMood ?? null,
    riskScore: Number(record.riskScore || 0),
  };
}

const OPEN_FINANCIAL_STATUSES = ["planned", "pending", "overdue"] as const;

async function fetchPatientRecordSummaryFallback(patientId: string): Promise<PatientRecordSummary> {
  const [
    patientResult,
    completedSessionsResult,
    pendingReviewsResult,
    documentsResult,
    activeGoalsResult,
    nextSessionResult,
    lastSessionResult,
    packagesResult,
    financialResult,
    latestMoodResult,
  ] = await Promise.all([
    supabase.from("patients").select("id,risk_score").eq("id", patientId).maybeSingle(),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .in("status", ["attended", "completed"]),
    supabase
      .from("session_notes")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("review_status", "pending_review"),
    supabase
      .from("document_files")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .is("deleted_at", null),
    supabase
      .from("patient_goals")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("is_completed", false),
    supabase
      .from("appointments")
      .select("id,start_time,type")
      .eq("patient_id", patientId)
      .gte("start_time", new Date().toISOString())
      .not("status", "in", "(cancelled,cancelled_by_patient,cancelled_by_professional)")
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id,start_time,type")
      .eq("patient_id", patientId)
      .in("status", ["attended", "completed"])
      .order("start_time", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("patient_packages")
      .select("id,description,total_sessions,sessions_used,sessions_reserved,active,end_date,start_date,package_status")
      .eq("patient_id", patientId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("financial_entries")
      .select("amount")
      .eq("patient_id", patientId)
      .eq("type", "income")
      .in("status", [...OPEN_FINANCIAL_STATUSES]),
    supabase
      .from("patient_mood_logs")
      .select("mood_score,created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (patientResult.error) throw patientResult.error;
  if (!patientResult.data) throw new Error("patient record not available");

  const today = new Date().toISOString().slice(0, 10);
  const activePackage = (packagesResult.data || []).find((item) => {
    const active = String(item.active ?? "true").toLowerCase();
    return !["false", "inactive", "cancelled", "completed"].includes(active)
      && !["paused", "completed", "cancelled", "ended", "replaced"].includes(String(item.package_status || "active"))
      && item.sessions_used + item.sessions_reserved < item.total_sessions
      && (!item.end_date || item.end_date >= today);
  }) ?? null;

  return {
    completedSessions: completedSessionsResult.count ?? 0,
    pendingReviews: pendingReviewsResult.count ?? 0,
    documents: documentsResult.count ?? 0,
    activeGoals: activeGoalsResult.count ?? 0,
    nextSession: nextSessionResult.data ?? null,
    lastSession: lastSessionResult.data ?? null,
    activePackage: activePackage
      ? {
          id: activePackage.id,
          description: activePackage.description,
          total_sessions: activePackage.total_sessions,
          sessions_used: activePackage.sessions_used,
          sessions_reserved: activePackage.sessions_reserved,
        }
      : null,
    openBalance: (financialResult.data || []).reduce((total, entry) => total + Math.abs(Number(entry.amount || 0)), 0),
    latestMood: latestMoodResult.data ?? null,
    riskScore: Number(patientResult.data.risk_score || 0),
  };
}

export async function fetchPatientRecordSummary(patientId: string): Promise<PatientRecordSummary> {
  const { data, error } = await supabase.rpc("get_patient_record_summary", {
    p_patient_id: patientId,
  });

  if (!error) {
    const summary = asPatientRecordSummary(data);
    if (!summary.activePackage) return summary;

    const packageResult = await supabase
      .from("patient_packages")
      .select("sessions_reserved,package_status,active,end_date")
      .eq("id", summary.activePackage.id)
      .maybeSingle();
    if (packageResult.error || !packageResult.data) return summary;

    const reserved = packageResult.data.sessions_reserved || 0;
    const available = summary.activePackage.total_sessions - summary.activePackage.sessions_used - reserved;
    const inactive = ["paused", "completed", "cancelled", "ended", "replaced"].includes(
      String(packageResult.data.package_status || "active"),
    );
    return {
      ...summary,
      activePackage: inactive || available <= 0
        ? null
        : { ...summary.activePackage, sessions_reserved: reserved },
    };
  }

  // Keeps the summary useful while a newly pulled frontend is ahead of the
  // linked database migration. Every fallback query still relies on RLS and
  // begins with an owner-scoped patient lookup.
  return fetchPatientRecordSummaryFallback(patientId);
}

export function usePatientRecordSummary(patientId: string) {
  return useQuery({
    queryKey: ["patient-record-summary", patientId],
    queryFn: () => fetchPatientRecordSummary(patientId),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}
