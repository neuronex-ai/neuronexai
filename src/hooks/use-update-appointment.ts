import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Appointment } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/SessionContextProvider";
import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { syncAppointmentFinancialEntryAfterUpdate } from "@/lib/financial-appointment-automation";
import { edgeFunctionUrl } from "@/lib/supabase-config";

interface UpdateAppointmentData {
  id: string;
  updates: Partial<Omit<Appointment, "id" | "user_id" | "created_at">>;
}

const syncGoogleUpdate = async (
  googleEventId: string,
  action: "update" | "delete",
  appointmentData: any,
  accessToken: string,
) => {
  try {
    await fetch(edgeFunctionUrl("google-calendar-manage"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        googleEventId,
        appointmentData,
      }),
    });
  } catch (e) {
    console.error("Background Google Sync Error:", e);
  }
};

const updateAppointmentFn = async (
  { id, updates }: UpdateAppointmentData,
  userId: string,
  accessToken: string,
) => {
  if (updates.start_time && updates.end_time) {
    const { data: hasConflict, error: conflictError } = await supabase.rpc(
      "check_appointment_overlap",
      {
        p_user_id: userId,
        p_start_time: updates.start_time,
        p_end_time: updates.end_time,
        p_exclude_appointment_id: id,
      },
    );

    if (conflictError) throw new Error(conflictError.message);
    if (hasConflict) {
      throw new Error(
        "Conflito de horário. Já existe um agendamento neste novo período.",
      );
    }
  }

  const { data: existingAppointment, error: fetchError } = await supabase
    .from("appointments")
    .select(`*, patient:patient_id (name, email, phone)`)
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !existingAppointment)
    throw new Error("Agendamento não encontrado.");

  const updatePayload = {
    ...updates,
    metadata: updates.metadata
      ? {
          ...(existingAppointment.metadata || {}),
          ...updates.metadata,
          localUpdatedAt: new Date().toISOString(),
        }
      : existingAppointment.metadata,
  };

  const { data: updatedAppointment, error: updateError } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  if (
    existingAppointment.google_event_id &&
    (updates.start_time ||
      updates.end_time ||
      updates.notes ||
      updates.location ||
      updates.status ||
      updates.metadata)
  ) {
    const action = isCancelledAppointmentStatus(
      updates.status,
      updates.notes || existingAppointment.notes,
    )
      ? "delete"
      : "update";
    syncGoogleUpdate(
      existingAppointment.google_event_id,
      action,
      updatedAppointment,
      accessToken,
    );
  }

  try {
    await syncAppointmentFinancialEntryAfterUpdate(
      existingAppointment as Appointment & {
        patient?: { name?: string | null } | null;
      },
      updatedAppointment as Appointment,
      userId,
    );
  } catch (financialError) {
    console.warn(
      "[useUpdateAppointment] Agendamento atualizado, mas a sincronização financeira não foi aplicada:",
      financialError,
    );
  }

  return updatedAppointment;
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const userId = user?.id;
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: (data: UpdateAppointmentData) => {
      if (!userId || !accessToken) throw new Error("Usuário não autenticado.");
      return updateAppointmentFn(data, userId, accessToken);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: ["appointmentsByDateRange"],
      });
      await queryClient.cancelQueries({ queryKey: ["appointments"] });

      const previousDateRangeAppointments = queryClient.getQueryData([
        "appointmentsByDateRange",
      ]);
      const previousAppointments = queryClient.getQueryData(["appointments"]);

      queryClient.setQueriesData(
        { queryKey: ["appointmentsByDateRange"] },
        (old: any) => {
          if (!old) return [];
          return old.map((apt: Appointment) =>
            apt.id === newData.id
              ? {
                  ...apt,
                  ...newData.updates,
                  metadata: newData.updates.metadata
                    ? { ...(apt.metadata || {}), ...newData.updates.metadata }
                    : apt.metadata,
                }
              : apt,
          );
        },
      );

      queryClient.setQueriesData({ queryKey: ["appointments"] }, (old: any) => {
        if (!old) return old;
        return old.map((apt: Appointment) =>
          apt.id === newData.id
            ? {
                ...apt,
                ...newData.updates,
                metadata: newData.updates.metadata
                  ? { ...(apt.metadata || {}), ...newData.updates.metadata }
                  : apt.metadata,
              }
            : apt,
        );
      });

      return { previousDateRangeAppointments, previousAppointments };
    },
    onError: (error, _, context) => {
      if (context?.previousDateRangeAppointments) {
        queryClient.setQueriesData(
          { queryKey: ["appointmentsByDateRange"] },
          context.previousDateRangeAppointments,
        );
      }
      if (context?.previousAppointments) {
        queryClient.setQueriesData(
          { queryKey: ["appointments"] },
          context.previousAppointments,
        );
      }
      console.error(
        "[useUpdateAppointment] Falha ao atualizar agendamento",
        error,
      );
      toast.error(getUserFacingErrorMessage(error, "save"));
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["financialEntries"] });
      queryClient.invalidateQueries({ queryKey: ["patientTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["financialMetrics"] });
      queryClient.invalidateQueries({ queryKey: ["advancedCashFlow"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-session-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["smartInsights"] });
      queryClient.invalidateQueries({ queryKey: ["churnAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["patientAppointments"] });

      if (data?.patient_id) {
        queryClient.invalidateQueries({
          queryKey: ["patients", data.patient_id],
        });
      }
    },
  });
};
