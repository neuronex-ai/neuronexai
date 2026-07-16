import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  type AppointmentTimelineItem,
  type AppointmentTimelineVisualKind,
  repairAppointmentTimelineItem,
} from "@/lib/appointment-timeline";
import { repairTextEncodingDeep } from "@/lib/text-encoding";

export interface AppointmentRescheduleRequest {
  id: string;
  original_end_time: string;
  original_start_time: string;
  requested_end_time: string;
  requested_start_time: string;
  reason: string | null;
  review_reason: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn" | "expired_no_response";
  created_at: string;
  requested_at: string | null;
  within_free_window: boolean | null;
  professional_response_due_at: string | null;
  financial_right_protected: boolean;
  reaction_due_at: string | null;
  protection_reason: string | null;
  expired_without_response_at: string | null;
}

interface AppointmentLifecycleData {
  events: AppointmentTimelineItem[];
  requests: AppointmentRescheduleRequest[];
}

interface SafeAppointmentTimelineRpcRow {
  title: string;
  actor_name: string;
  channel_name: string;
  occurred_at: string;
  status_change: string | null;
  detail: string | null;
  visual_kind: AppointmentTimelineVisualKind;
}

interface ReviewInput {
  requestId: string;
  decision: "approve" | "reject";
  reason?: string;
}

interface ReviewResult {
  success: boolean;
  outcome: "approved" | "declined" | "response_overdue";
  notificationSent: boolean;
  notificationQueued?: boolean;
  repeatedRequest?: boolean;
  financialProtectionActive?: boolean;
  patientActionDeadline?: string | null;
  message?: string;
  warning?: string;
}

const lifecycleQueryKey = (appointmentId: string) => ["appointmentLifecycle", appointmentId] as const;

const toTimelineItem = (row: SafeAppointmentTimelineRpcRow): AppointmentTimelineItem => repairAppointmentTimelineItem({
  title: row.title,
  actorName: row.actor_name,
  channelName: row.channel_name,
  occurredAt: row.occurred_at,
  statusChange: row.status_change,
  detail: row.detail,
  visualKind: row.visual_kind,
});

export function useAppointmentLifecycle(
  appointmentId: string,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: lifecycleQueryKey(appointmentId),
    enabled: enabled && Boolean(appointmentId),
    queryFn: async (): Promise<AppointmentLifecycleData> => {
      const database = supabase as any;
      const [timelineResult, requestsResult] = await Promise.all([
        database.rpc("get_safe_appointment_timeline", {
          p_appointment_id: appointmentId,
        }),
        database
          .from("appointment_reschedule_requests")
          .select("id,original_start_time,original_end_time,requested_start_time,requested_end_time,reason,review_reason,status,created_at,requested_at,within_free_window,professional_response_due_at,financial_right_protected,reaction_due_at,protection_reason,expired_without_response_at")
          .eq("appointment_id", appointmentId)
          .order("created_at", { ascending: false }),
      ]);

      if (timelineResult.error) throw timelineResult.error;
      if (requestsResult.error) throw requestsResult.error;
      return {
        events: ((timelineResult.data || []) as SafeAppointmentTimelineRpcRow[]).map(toTimelineItem),
        requests: repairTextEncodingDeep((requestsResult.data || []) as AppointmentRescheduleRequest[]),
      };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!enabled || !appointmentId) return;
    const invalidateAppointment = () => {
      void queryClient.invalidateQueries({ queryKey: lifecycleQueryKey(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] });
    };
    const channel = supabase
      .channel(`appointment-lifecycle-${appointmentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `id=eq.${appointmentId}` },
        invalidateAppointment,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_reschedule_requests", filter: `appointment_id=eq.${appointmentId}` },
        invalidateAppointment,
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
      toast.success(
        result.outcome === "approved"
          ? "Novo horário aprovado."
          : result.outcome === "response_overdue"
            ? "O prazo de resposta venceu e os direitos do paciente foram protegidos."
            : "Solicitação recusada.",
      );
      if (result.message) toast.info(result.message);
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
    visibleRequest: query.data?.requests.find((request) =>
      request.status === "pending" || request.status === "expired_no_response"
    ) || null,
    reviewRequest: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
  };
}
