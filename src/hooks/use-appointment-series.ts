import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
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
}

const rpcErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("appointment_time_conflict")) {
    return "Um dos horários acabou de ser ocupado. Revise as datas e tente novamente.";
  }
  if (message.includes("working") || message.includes("availability")) {
    return "Uma ou mais datas estão fora da disponibilidade do profissional.";
  }
  return message || "Não foi possível validar a série de agendamentos.";
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
    },
    onSuccess: (result) => {
      if (!result.success) return;
      toast.success(
        `${appointmentSeriesSummary(result.frequency, result.totalOccurrences)} criadas com sucesso.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
      void queryClient.invalidateQueries({ queryKey: ["monthly-session-metrics"] });
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
