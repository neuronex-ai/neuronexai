import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  AppointmentPlanReviewRequiredError,
  executeAppointmentActionPlan,
  prepareAppointmentActionPlan,
  type AppointmentActionPlan,
} from "@/lib/appointment-action-plans";
import {
  buildEventMetadata,
  getAppointmentMetadata,
  type AppointmentMetadata,
} from "@/lib/appointment-metadata";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { Appointment, Patient } from "@/types";

export interface NewAppointmentData {
  id?: string;
  idempotency_key?: string;
  prepared_plan?: AppointmentActionPlan;
  patient_id: string | null;
  start_time: Date;
  end_time: Date;
  type: "presencial" | "online" | "block";
  notes: string;
  location: string | null;
  metadata?: AppointmentMetadata;
  package_id?: string | null;
  financial?: {
    mode: "none" | "manual" | "neurofinance" | "package" | "insurance";
    value_per_session?: number;
    total?: number;
    charge_mode?: "per_occurrence" | "series";
    payment_method?: string | null;
    installments?: number;
  };
}

type AppointmentCreationResult = {
  /**
   * Compatibilidade temporária com o modal desktop antigo. Quando o lançamento
   * financeiro explícito já foi tratado aqui, retornamos null para impedir que
   * o modal tente executar novamente a rotina removida no refactor.
   */
  newAppointment: Appointment | null;
  createdAppointment: Appointment;
  patientData: Partial<Patient>;
};

const resolveMetadata = (appointmentData: NewAppointmentData): AppointmentMetadata => {
  if (appointmentData.metadata) return appointmentData.metadata;
  if (appointmentData.type === "block" && !appointmentData.patient_id) {
    return buildEventMetadata({
      title: appointmentData.notes || "Compromisso",
      location: appointmentData.location,
      notes: appointmentData.notes,
      syncStatus: "not_configured",
    });
  }
  return getAppointmentMetadata({
    ...appointmentData,
    start_time: appointmentData.start_time.toISOString(),
    end_time: appointmentData.end_time.toISOString(),
  } as Appointment);
};

const loadPatientData = async (patientId: string | null, userId: string, metadata: AppointmentMetadata) => {
  if (!patientId) {
    return {
      name: metadata.kind === "event"
        ? metadata.eventTitle || "Compromisso"
        : "Bloqueio de Agenda",
    } satisfies Partial<Patient>;
  }

  const { data: patient, error } = await supabase
    .from("patients")
    .select("id,name,email,phone")
    .eq("id", patientId)
    .eq("user_id", userId)
    .single();

  if (error || !patient) throw new Error("O paciente do agendamento não pôde ser carregado.");
  return patient as Partial<Patient>;
};

const appointmentPlanInput = (
  appointmentData: NewAppointmentData,
  metadata: AppointmentMetadata,
) => ({
  patient_id: appointmentData.patient_id,
  start_time: appointmentData.start_time.toISOString(),
  end_time: appointmentData.end_time.toISOString(),
  frequency: "single",
  occurrence_count: 1,
  type: appointmentData.type,
  notes: appointmentData.notes || null,
  location: appointmentData.location,
  metadata,
  package_id: appointmentData.package_id || null,
  communication: {
    sendConfirmation: Boolean(appointmentData.patient_id),
    provider: "configured",
    template: "appointment_invitation",
    reminderPolicy: "professional_settings",
  },
  financial: appointmentData.financial || {
    mode: appointmentData.package_id ? "package" : "none",
    value_per_session: 0,
    total: 0,
    charge_mode: "per_occurrence",
  },
  fiscal: {
    automationEnabled: false,
    trigger: "professional_settings",
    potentialDocuments: appointmentData.patient_id ? 1 : 0,
    blocked: false,
  },
});

const prepareNewAppointment = async (appointmentData: NewAppointmentData) => {
  const metadata = resolveMetadata(appointmentData);
  const idempotencyKey = appointmentData.idempotency_key
    || `professional-app:create:${appointmentData.id || crypto.randomUUID()}`;
  return prepareAppointmentActionPlan(
    "create",
    appointmentPlanInput(appointmentData, metadata),
    idempotencyKey,
  );
};

const addAppointment = async (
  appointmentData: NewAppointmentData,
  userId: string,
): Promise<AppointmentCreationResult> => {
  const metadata = resolveMetadata(appointmentData);

  const prepared = appointmentData.prepared_plan || await prepareNewAppointment(appointmentData);
  if (prepared.status === "review_required") {
    throw new AppointmentPlanReviewRequiredError(prepared);
  }
  if (prepared.status !== "awaiting_confirmation") {
    throw new Error("O plano não está disponível para confirmação. Revise o resumo novamente.");
  }
  const plan = await executeAppointmentActionPlan(prepared);
  if (plan.status !== "completed") {
    throw new Error("Os dados mudaram durante a confirmação. Revise o agendamento atualizado.");
  }

    const result = plan.result || {};
    const appointmentIds = Array.isArray(result.appointmentIds)
      ? result.appointmentIds.map(String)
      : [];
    const appointmentId = appointmentIds[0] || String(result.appointmentId || "");
    if (!appointmentId) throw new Error("O servidor não retornou o agendamento criado.");

    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .eq("user_id", userId)
      .single();
    if (error || !appointment) throw new Error("O agendamento foi criado, mas não pôde ser recarregado.");

    const patientData = await loadPatientData(appointmentData.patient_id, userId, metadata);
    const createdAppointment = appointment as Appointment;
  return {
    // O action plan já materializa pacote e lançamentos manuais. Reexecutar a
    // automação legada aqui causaria duplicidade e quebraria financial.mode=none.
    newAppointment: appointmentData.financial ? null : createdAppointment,
    createdAppointment,
    patientData,
  };
};

export const useAddAppointment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: (data: NewAppointmentData) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      return addAppointment(data, user.id);
    },
    onSuccess: ({ createdAppointment, patientData }) => {
      if (createdAppointment.metadata?.kind === "event") {
        toast.success("Compromisso registrado com sucesso!");
      } else if (patientData.name !== "Bloqueio de Agenda") {
        toast.success(`Consulta para ${patientData.name} agendada com sucesso!`);
      } else {
        toast.success("Bloqueio de horário criado.");
      }

      for (const queryKey of [
        "appointments",
        "appointmentsByDateRange",
        "financialEntries",
        "patientTransactions",
        "financialMetrics",
        "advancedCashFlow",
        "monthly-session-metrics",
        "dashboard-activities",
      ]) {
        void queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    },
    onError: (error) => {
      console.error("[useAddAppointment] Falha ao criar agendamento", error);
      toast.error(getUserFacingErrorMessage(error, "save"));
    },
  });

  return {
    ...mutation,
    prepareAsync: (data: NewAppointmentData) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      return prepareNewAppointment(data);
    },
  };
};
