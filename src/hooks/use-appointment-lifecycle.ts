import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export interface AppointmentTimelineEvent {
  id: string;
  appointment_id: string;
  psychologist_id: string;
  patient_id: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_type: "psychologist" | "patient" | "system" | "edge_function" | "provider";
  actor_user_id: string | null;
  action_origin: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppointmentRescheduleRequest {
  id: string;
  appointment_id: string;
  psychologist_id: string;
  patient_id: string | null;
  original_start_time: string;
  original_end_time: string;
  requested_start_time: string;
  requested_end_time: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reviewed_by: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

interface AppointmentLifecycleData {
  events: AppointmentTimelineEvent[];
  requests: AppointmentRescheduleRequest[];
}

interface ReviewInput {
  requestId: string;
  decision: "approve" | "reject";
  reason?: string;
}

interface ReviewResult {
  success: boolean;
  decision: "approve" | "reject";
  notificationSent: boolean;
  warning?: string;
}

const lifecycleQueryKey = (appointmentId: string) => ["appointmentLifecycle", appointmentId] as const;

export function useAppointmentLifecycle(appointmentId: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: lifecycleQueryKey(appointmentId),
    enabled: enabled && Boolean(appointmentId),
    queryFn: async (): Promise<AppointmentLifecycleData> => {
      const database = supabase as any;
      const [eventsResult, requestsResult] = await Promise.all([
        database
          .from("appointment_events")
          .select("id,appointment_id,psychologist_id,patient_id,event_type,from_status,to_status,actor_type,actor_user_id,action_origin,metadata,created_at")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: true }),
        database
          .from("appointment_reschedule_requests")
          .select("id,appointment_id,psychologist_id,patient_id,original_start_time,original_end_time,requested_start_time,requested_end_time,reason,status,reviewed_by,review_reason,reviewed_at,created_at,updated_at,metadata")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (requestsResult.error) throw requestsResult.error;
      return {
        events: (eventsResult.data || []) as AppointmentTimelineEvent[],
        requests: (requestsResult.data || []) as AppointmentRescheduleRequest[],
      };
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!enabled || !appointmentId) return;
    const channel = supabase
      .channel(`appointment-lifecycle-${appointmentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_events", filter: `appointment_id=eq.${appointmentId}` },
        () => void queryClient.invalidateQueries({ queryKey: lifecycleQueryKey(appointmentId) }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_reschedule_requests", filter: `appointment_id=eq.${appointmentId}` },
        () => void queryClient.invalidateQueries({ queryKey: lifecycleQueryKey(appointmentId) }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appointmentId, enabled, queryClient]);

  const reviewMutation = useMutation({
    mutationFn: async (input: ReviewInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");

      const { data, error } = await supabase.functions.invoke<ReviewResult>("review-appointment-reschedule", {
        body: input,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error || !data?.success) throw error || new Error("Não foi possível analisar a solicitação.");
      return data;
    },
    onSuccess: (result) => {
      toast.success(result.decision === "approve" ? "Novo horário aprovado." : "Solicitação recusada.");
      if (result.warning) toast.warning(result.warning);
    },
    onError: (error: Error) => {
      console.error("[useAppointmentLifecycle:review]", error);
      toast.error(error.message || "Não foi possível analisar a solicitação.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: lifecycleQueryKey(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboardAlerts"] });
    },
  });

  return {
    ...query,
    events: query.data?.events || [],
    requests: query.data?.requests || [],
    pendingRequest: query.data?.requests.find((request) => request.status === "pending") || null,
    reviewRequest: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
  };
}
