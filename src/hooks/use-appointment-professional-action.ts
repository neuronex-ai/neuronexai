import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { prepareAndExecuteAppointmentAction } from "@/lib/appointment-action-plans";

export type ProfessionalAppointmentAction = "cancel" | "archive";

export interface ProfessionalAppointmentActionPreview {
  action: ProfessionalAppointmentAction;
  actionLabel: string;
  canExecute: boolean;
  appointmentDate: string;
  currentStatus: string;
  warnings: string[];
  blockers: string[];
  preserved: {
    history: boolean;
    packageLinks: number;
    financialRecords: number;
    fiscalDocuments: number;
    clinicalRecords: number;
  };
}

interface ExecuteResult {
  success: boolean;
  action: ProfessionalAppointmentAction;
  message: string;
  emailRequired: boolean;
  idempotentReplay: boolean;
}

const normalizePreview = (value: unknown): ProfessionalAppointmentActionPreview => {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const preserved = (record.preserved && typeof record.preserved === "object"
    ? record.preserved
    : {}) as Record<string, unknown>;
  return {
    action: record.action === "archive" ? "archive" : "cancel",
    actionLabel: String(record.actionLabel || "Ação do agendamento"),
    canExecute: Boolean(record.canExecute),
    appointmentDate: String(record.appointmentDate || ""),
    currentStatus: String(record.currentStatus || "Situação atualizada"),
    warnings: Array.isArray(record.warnings) ? record.warnings.map(String) : [],
    blockers: Array.isArray(record.blockers) ? record.blockers.map(String) : [],
    preserved: {
      history: preserved.history !== false,
      packageLinks: Number(preserved.packageLinks || 0),
      financialRecords: Number(preserved.financialRecords || 0),
      fiscalDocuments: Number(preserved.fiscalDocuments || 0),
      clinicalRecords: Number(preserved.clinicalRecords || 0),
    },
  };
};

export const useProfessionalAppointmentActionPreview = (
  appointmentId: string,
  action: ProfessionalAppointmentAction | null,
  enabled: boolean,
) => useQuery({
  queryKey: ["professional-appointment-action-preview", appointmentId, action],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("preview_professional_appointment_action", {
      p_appointment_id: appointmentId,
      p_action: action!,
    });
    if (error) throw error;
    return normalizePreview(data);
  },
  enabled: Boolean(enabled && appointmentId && action),
  staleTime: 5_000,
});

export const useExecuteProfessionalAppointmentAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      appointmentId,
      action,
      reason,
      idempotencyKey,
    }: {
      appointmentId: string;
      action: ProfessionalAppointmentAction;
      reason: string;
      idempotencyKey: string;
    }) => {
      if (action === "cancel") {
        const plan = await prepareAndExecuteAppointmentAction("cancel", {
          appointment_id: appointmentId,
          reason,
          communication: {
            sendConfirmation: true,
            provider: "configured",
            template: "appointment_cancelled",
            reminderPolicy: "cancelled",
          },
        }, idempotencyKey);
        const result = plan.result || {};
        return {
          success: true,
          action,
          message: String(result.message || "Agendamento cancelado pelo fluxo profissional."),
          emailRequired: false,
          idempotentReplay: Boolean(result.idempotentReplay),
        } satisfies ExecuteResult;
      }
      const { data, error } = await supabase.rpc("execute_professional_appointment_action", {
        p_appointment_id: appointmentId,
        p_action: action,
        p_reason: reason,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return data as unknown as ExecuteResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointmentsByDateRange"] });
      queryClient.invalidateQueries({ queryKey: ["appointment-lifecycle"] });
      queryClient.invalidateQueries({ queryKey: ["patient-complete-appointment-history"] });
      queryClient.invalidateQueries({ queryKey: ["patient-record-summary"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-session-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-activities"] });
    },
  });
};
