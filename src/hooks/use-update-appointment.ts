import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  prepareAndExecuteAppointmentAction,
  type AppointmentActionOriginChannel,
} from "@/lib/appointment-action-plans";
import { isCancelledAppointmentStatus } from "@/lib/appointment-status";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import { hasMaterialAppointmentChanges } from "@/lib/appointment-change-detection";
import type { Appointment } from "@/types";

interface UpdateAppointmentData {
  id: string;
  updates: Partial<Omit<Appointment, "id" | "user_id" | "created_at">>;
  originChannel?: AppointmentActionOriginChannel;
  suppressErrorToast?: boolean;
}

const MATERIAL_FIELDS = new Set(["start_time", "end_time", "type", "location"]);
const DIRECT_CLINICAL_FIELDS = new Set(["notes", "metadata"]);
const EDITABLE_METADATA_FIELDS = new Set([
  "kind",
  "sessionType",
  "modality",
  "durationMinutes",
  "eventTitle",
  "eventCategory",
  "eventCategoryLabel",
  "eventLocation",
  "eventNotes",
]);

const editableMetadataPatch = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, fieldValue]) => EDITABLE_METADATA_FIELDS.has(key) && fieldValue !== undefined),
  );
};

const updateAppointmentFn = async ({
  id,
  updates,
  originChannel = "professional_app",
}: UpdateAppointmentData, userId: string) => {
  const { data: existingAppointment, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (fetchError || !existingAppointment) throw new Error("Agendamento não encontrado.");

  const changedKeys = Object.keys(updates).filter((key) => (updates as Record<string, unknown>)[key] !== undefined);
  const hasMaterialChange = hasMaterialAppointmentChanges(
    existingAppointment as Pick<Appointment, "start_time" | "end_time" | "type" | "location">,
    updates,
  );
  const cancellationRequested = updates.status !== undefined && isCancelledAppointmentStatus(updates.status, updates.notes);

  if (updates.status !== undefined && !cancellationRequested) {
    throw new Error("Esta mudança de estado exige o comando específico do ciclo do agendamento.");
  }
  const unsupported = changedKeys.filter((key) => !MATERIAL_FIELDS.has(key) && !DIRECT_CLINICAL_FIELDS.has(key) && key !== "status");
  if (unsupported.length) {
    throw new Error("Um campo protegido do agendamento não pode ser alterado diretamente.");
  }

  let currentAppointment = existingAppointment as Appointment;
  if (cancellationRequested) {
    const plan = await prepareAndExecuteAppointmentAction("cancel", {
      appointment_id: id,
      reason: updates.notes || "Cancelamento confirmado pelo profissional",
      communication: {
        sendConfirmation: true,
        provider: "configured",
        template: "appointment_cancelled",
        reminderPolicy: "cancelled",
      },
    }, `${originChannel}:cancel:${id}:${crypto.randomUUID()}`, originChannel);
    if (!plan.result) throw new Error("O cancelamento não retornou um resultado válido.");
  } else if (hasMaterialChange) {
    const startTime = updates.start_time || existingAppointment.start_time;
    const endTime = updates.end_time || existingAppointment.end_time;
    await prepareAndExecuteAppointmentAction("reschedule", {
      appointment_id: id,
      start_time: startTime,
      end_time: endTime,
      type: updates.type || existingAppointment.type,
      location: updates.location === undefined ? existingAppointment.location : updates.location,
      communication: {
        sendConfirmation: true,
        provider: "configured",
        template: "appointment_reconfirmation_required",
        reminderPolicy: "professional_settings",
      },
    }, `${originChannel}:reschedule:${id}:${crypto.randomUUID()}`, originChannel);
  }

  const hasClinicalPatch = !cancellationRequested
    && (updates.notes !== undefined || updates.metadata !== undefined);
  if (hasClinicalPatch) {
    const database = supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const { data, error } = await database.rpc("patch_appointment_clinical_details", {
      p_appointment_id: id,
      p_notes: updates.notes ?? null,
      p_notes_set: updates.notes !== undefined,
      p_metadata_patch: editableMetadataPatch(updates.metadata),
    });
    if (error || !data) {
      const clinicalDetailsError = new Error("Não foi possível salvar os detalhes deste agendamento.");
      if (error) {
        Object.assign(clinicalDetailsError, { cause: error });
      }
      throw clinicalDetailsError;
    }
    currentAppointment = data as Appointment;
  } else if (hasMaterialChange || cancellationRequested) {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (error || !data) throw new Error("A alteração foi concluída, mas o agendamento não pôde ser recarregado.");
    currentAppointment = data as Appointment;
  }

  return currentAppointment;
};

export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: UpdateAppointmentData) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      return updateAppointmentFn(data, user.id);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["appointmentsByDateRange"] });
      await queryClient.cancelQueries({ queryKey: ["appointments"] });
      const previousDateRangeAppointments = queryClient.getQueryData(["appointmentsByDateRange"]);
      const previousAppointments = queryClient.getQueryData(["appointments"]);
      const optimistic = (old: Appointment[] | undefined) => old?.map((appointment) => appointment.id === newData.id
        ? {
          ...appointment,
          ...newData.updates,
          metadata: newData.updates.metadata
            ? { ...(appointment.metadata || {}), ...newData.updates.metadata }
            : appointment.metadata,
        }
        : appointment);
      queryClient.setQueriesData({ queryKey: ["appointmentsByDateRange"] }, optimistic);
      queryClient.setQueriesData({ queryKey: ["appointments"] }, optimistic);
      return { previousDateRangeAppointments, previousAppointments };
    },
    onError: (error, variables, context) => {
      if (context?.previousDateRangeAppointments) {
        queryClient.setQueriesData({ queryKey: ["appointmentsByDateRange"] }, context.previousDateRangeAppointments);
      }
      if (context?.previousAppointments) {
        queryClient.setQueriesData({ queryKey: ["appointments"] }, context.previousAppointments);
      }
      console.error("[useUpdateAppointment] Falha ao atualizar agendamento", error);
      if (!variables.suppressErrorToast) {
        toast.error(getUserFacingErrorMessage(error, "save"));
      }
    },
    onSettled: (data) => {
      for (const queryKey of [
        "appointmentsByDateRange", "appointments", "financialEntries", "patientTransactions",
        "financialMetrics", "advancedCashFlow", "monthly-session-metrics", "dashboard-activities",
        "dashboardAlerts", "smartInsights", "churnAlerts", "patientAppointments", "appointment-lifecycle",
      ]) void queryClient.invalidateQueries({ queryKey: [queryKey] });
      if (data?.patient_id) void queryClient.invalidateQueries({ queryKey: ["patients", data.patient_id] });
    },
  });
};
