import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  toSafeAppointmentTimeline,
  type AppointmentTimelineNames,
  type AppointmentTimelineRecord,
} from "@/lib/appointment-timeline";

export interface AppointmentRescheduleRequest {
  id: string;
  original_start_time: string;
  requested_start_time: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  created_at: string;
}

interface AppointmentLifecycleData {
  events: AppointmentTimelineRecord[];
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

export function useAppointmentLifecycle(
  appointmentId: string,
  enabled = true,
  timelineNames: AppointmentTimelineNames = {},
) {
  const queryClient = useQueryClient();
  const { patientName, psychologistName } = timelineNames;
  const query = useQuery({
    queryKey: lifecycleQueryKey(appointmentId),
    enabled: enabled && Boolean(appointmentId),
    queryFn: async (): Promise<AppointmentLifecycleData> => {
      const database = supabase as any;
      const [eventsResult, requestsResult] = await Promise.all([
        database
          .from("appointment_events")
          .select("event_type,from_status,to_status,actor_type,action_origin,created_at")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false }),
        database
          .from("appointment_reschedule_requests")
          .select("id,original_start_time,requested_start_time,reason,status,created_at")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (requestsResult.error) throw requestsResult.error;
      return {
        events: (eventsResult.data || []) as AppointmentTimelineRecord[],
        requests: (requestsResult.data || []) as AppointmentRescheduleRequest[],
      };
    },
    staleTime: 15_000,
  });

  const safeTimeline = useMemo(
    () => toSafeAppointmentTimeline(query.data?.events || [], { patientName, psychologistName }),
    [patientName, psychologistName, query.data?.events],
  );

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
    events: safeTimeline,
    requests: query.data?.requests || [],
    pendingRequest: query.data?.requests.find((request) => request.status === "pending") || null,
    reviewRequest: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
  };
}
