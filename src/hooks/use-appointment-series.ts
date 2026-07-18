import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { prepareAndExecuteAppointmentAction } from "@/lib/appointment-action-plans";
import type { AppointmentMetadata } from "@/lib/appointment-metadata";
import {
  appointmentSeriesSummary,
  normalizeAppointmentSeriesCreateResult,
  normalizeAppointmentSeriesPreview,
  type AppointmentRecurrenceFrequency,
} from "@/lib/appointment-recurrence";

interface AppointmentSeriesTimes {
  startTime: Date;
  endTime: Date;
  frequency: AppointmentRecurrenceFrequency;
  occurrenceCount: number;
}

export interface CreateAppointmentSeriesInput extends AppointmentSeriesTimes {
  patientId: string | null;
  packageId?: string | null;
  type: "presencial" | "online" | "block";
  notes: string | null;
  location: string | null;
  metadata: AppointmentMetadata;
  financial?: {
    mode: "none" | "manual" | "neurofinance" | "package";
    value_per_session?: number;
    total?: number;
    charge_mode?: "per_occurrence" | "series";
  };
}

const errorText = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    return [value.code, value.message, value.details, value.hint]
      .filter(Boolean)
      .map(String)
      .join(" ");
  }
  return "";
};

const isMissingAppointmentPlanRpc = (error: unknown) => {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = String(value.code || "").toUpperCase();
  const message = errorText(error).toLowerCase();
  const referencesPlanRpc =
    message.includes("prepare_appointment_action_plan")
    || message.includes("execute_appointment_action_plan");

  return referencesPlanRpc && (
    code === "PGRST202"
    || code === "42883"
    || message.includes("could not find the function")
    || message.includes("schema cache")
    || message.includes("does not exist")
  );
};

const rpcErrorMessage = (error: unknown) => {
  const message = errorText(error);
  if (message.includes("appointment_time_conflict") || message.includes("schedule changed")) {
    return "Um dos horários acabou de ser ocupado. Revise as datas e tente novamente.";
  }
  if (message.includes("working") || message.includes("availability")) {
    return "Uma ou mais datas estão fora da disponibilidade do profissional.";
  }
  return message || "Não foi possível validar a série de agendamentos.";
};

const createSeriesWithLegacyRpc = async (input: CreateAppointmentSeriesInput) => {
  const database = supabase as any;
  const { data, error } = await database.rpc("create_appointment_series_with_package", {
    p_patient_id: input.patientId,
    p_start_time: input.startTime.toISOString(),
    p_end_time: input.endTime.toISOString(),
    p_frequency: input.frequency,
    p_occurrence_count: input.occurrenceCount,
    p_type: input.type,
    p_notes: input.notes,
    p_location: input.location,
    p_metadata: input.metadata,
    p_package_id: input.packageId || null,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return normalizeAppointmentSeriesCreateResult(data);
};

export function useAppointmentSeries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: async (input: AppointmentSeriesTimes) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      const database = supabase as any;
      const { data, error } = await database.rpc("preview_appointment_series", {
        p_start_time: input.startTime.toISOString(),
        p_end_time: input.endTime.toISOString(),
        p_frequency: input.frequency,
        p_occurrence_count: input.occurrenceCount,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return normalizeAppointmentSeriesPreview(data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateAppointmentSeriesInput) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      try {
        const plan = await prepareAndExecuteAppointmentAction("create", {
          patient_id: input.patientId,
          start_time: input.startTime.toISOString(),
          end_time: input.endTime.toISOString(),
          frequency: input.frequency,
          occurrence_count: input.occurrenceCount,
          type: input.type,
          notes: input.notes,
          location: input.location,
          metadata: input.metadata,
          package_id: input.packageId || null,
          communication: {
            sendConfirmation: Boolean(input.patientId),
            provider: "configured",
            template: "appointment_invitation",
            reminderPolicy: "professional_settings",
          },
          financial: input.financial || {
            mode: input.packageId ? "package" : "none",
            value_per_session: 0,
            total: 0,
            charge_mode: "per_occurrence",
          },
          fiscal: {
            automationEnabled: false,
            trigger: "professional_settings",
            potentialDocuments: input.patientId ? input.occurrenceCount : 0,
            blocked: false,
          },
        }, `professional-app:series:${crypto.randomUUID()}`);
        const result = plan.result || {};
        const appointmentIds = Array.isArray(result.appointmentIds) ? result.appointmentIds.map(String) : [];
        return {
          success: true,
          seriesId: String(result.seriesId || ""),
          frequency: input.frequency,
          totalOccurrences: appointmentIds.length,
          appointmentIds,
          appointments: appointmentIds.map((appointmentId) => ({ appointmentId })),
        };
      } catch (error) {
        if (isMissingAppointmentPlanRpc(error)) {
          console.warn(
            "[useAppointmentSeries] RPC de planos ausente; usando a transação de série compatível.",
            error,
          );
          return createSeriesWithLegacyRpc(input);
        }
        throw new Error(rpcErrorMessage(error));
      }
    },
    onSuccess: (result) => {
      if (!result.success) return;
      toast.success(`${appointmentSeriesSummary(result.frequency, result.totalOccurrences)} criadas com sucesso.`);
      for (const queryKey of ["appointments", "appointmentsByDateRange", "dashboard-activities", "monthly-session-metrics"]) {
        void queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    },
    onError: (error: Error) => {
      console.error("[useAppointmentSeries] Falha ao criar série", error);
      toast.error(error.message);
    },
  });

  return {
    previewSeries: previewMutation.mutateAsync,
    createSeries: createMutation.mutateAsync,
    isPreviewingSeries: previewMutation.isPending,
    isCreatingSeries: createMutation.isPending,
  };
}
