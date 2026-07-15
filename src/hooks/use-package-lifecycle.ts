import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { readSupabaseFunctionError } from "@/lib/read-supabase-function-error";

export type PackageLifecycleOperation = "replace" | "end" | "release";
export type PackageLifecycleScope = "only_this" | "this_and_next" | "all_future";
export type PackageFinancialStrategy =
  | "keep_existing"
  | "cancel_and_recreate_per_session"
  | "cancel_and_create_single"
  | "cancel_without_replacement"
  | "manual_review";

export interface PackageLifecycleOccurrence {
  appointmentId: string;
  seriesId: string | null;
  occurrenceNumber: number | null;
  occurrenceCount: number | null;
  startTime: string;
  endTime: string;
}

export interface PackageLifecyclePreview {
  operationType: PackageLifecycleOperation;
  scope: PackageLifecycleScope;
  sourcePackage: {
    id: string;
    description: string;
    totalSessions: number;
    sessionsUsed: number;
    sessionsReserved: number;
    billingMode: string;
    billingStatus: string;
  };
  targetPackage: {
    id: string;
    description: string;
    availableSessions: number;
    billingMode: string;
    billingStatus: string;
    expectedAmount: number | null;
  } | null;
  affectedCount: number;
  occurrences: PackageLifecycleOccurrence[];
  firstStartTime: string | null;
  lastStartTime: string | null;
  preservedHistory: {
    consumedSessions: number;
    paidCharges: number;
    fiscalDocuments: number;
  };
  financialImpact: {
    pendingCharges: number;
    sameConditionCharges: number;
    sensitiveCharges: number;
    nfseUnderReview: number;
    strategy: PackageFinancialStrategy;
  };
  hardBlocks: string[];
  reviewReasons: string[];
  canExecute: boolean;
}

export interface PackageLifecycleInput {
  sourcePackageId: string;
  targetPackageId: string | null;
  operationType: PackageLifecycleOperation;
  scope: PackageLifecycleScope;
  anchorAppointmentId: string | null;
  financialStrategy: PackageFinancialStrategy;
}

export interface PackageLifecycleExecution extends PackageLifecycleInput {
  reason: string;
  idempotencyKey: string;
  expectedAppointmentIds: string[];
}

export interface PackageLifecycleResult {
  success: boolean;
  operationId: string;
  status: "completed" | "pending_financial" | "review_required";
  affectedCount: number;
  reviewReasons?: string[];
  idempotentReplay: boolean;
}

async function invokePackageLifecycle<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Sessão expirada. Entre novamente.");

  const { data, error } = await supabase.functions.invoke<T>("manage-package-lifecycle", {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    throw new Error(await readSupabaseFunctionError(error, "Não foi possível atualizar o pacote."));
  }
  if (!data) throw new Error("A NeuroNex não retornou o resultado da operação.");
  return data;
}

export function usePackageFutureOccurrences(sourcePackageId: string, enabled = true) {
  return useQuery({
    queryKey: ["packageFutureOccurrences", sourcePackageId],
    enabled: enabled && Boolean(sourcePackageId),
    queryFn: async (): Promise<PackageLifecycleOccurrence[]> => {
      const { data, error } = await supabase
        .from("appointment_package_bindings")
        .select("appointment_id,series_id,appointments!inner(id,series_id,occurrence_number,occurrence_count,start_time,end_time,status,lifecycle_status)")
        .eq("package_id", sourcePackageId)
        .eq("status", "reserved")
        .gt("appointments.start_time", new Date().toISOString())
        .order("bound_at", { ascending: true });
      if (error) throw error;

      return (data || []).flatMap((row) => {
        const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
        if (!appointment) return [];
        return [{
          appointmentId: appointment.id,
          seriesId: appointment.series_id,
          occurrenceNumber: appointment.occurrence_number,
          occurrenceCount: appointment.occurrence_count,
          startTime: appointment.start_time,
          endTime: appointment.end_time,
        }];
      }).sort((left: PackageLifecycleOccurrence, right: PackageLifecycleOccurrence) =>
        left.startTime.localeCompare(right.startTime));
    },
  });
}

export function usePackageLifecycle() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: async (input: PackageLifecycleInput) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      return invokePackageLifecycle<PackageLifecyclePreview>({ mode: "preview", ...input });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (input: PackageLifecycleExecution) => {
      if (!user?.id) throw new Error("Sessão expirada. Entre novamente.");
      return invokePackageLifecycle<PackageLifecycleResult>({ mode: "execute", ...input });
    },
    onSuccess: (result) => {
      if (result.status === "review_required") {
        toast.warning("Nenhuma sessão foi alterada. A NeuroNex criou uma pendência de revisão.");
      } else if (result.status === "pending_financial") {
        toast.warning("Substituição concluída com pendência financeira.");
      } else {
        toast.success("Pacote atualizado sem alterar o histórico realizado.");
      }
      void queryClient.invalidateQueries({ queryKey: ["patientPackages"] });
      void queryClient.invalidateQueries({ queryKey: ["packageFutureOccurrences"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    preview: previewMutation.mutateAsync,
    previewResult: previewMutation.data || null,
    previewError: previewMutation.error,
    resetPreview: previewMutation.reset,
    isPreviewing: previewMutation.isPending,
    execute: executeMutation.mutateAsync,
    isExecuting: executeMutation.isPending,
  };
}
