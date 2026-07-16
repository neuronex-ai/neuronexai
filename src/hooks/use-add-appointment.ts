import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { prepareAndExecuteAppointmentAction } from "@/lib/appointment-action-plans";
import { buildEventMetadata, getAppointmentMetadata, type AppointmentMetadata } from "@/lib/appointment-metadata";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";
import type { Appointment, Patient } from "@/types";

interface NewAppointmentData {
  id?: string;
  patient_id: string | null;
  start_time: Date;
  end_time: Date;
  type: "presencial" | "online" | "block";
  notes: string;
  location: string | null;
  metadata?: AppointmentMetadata;
  package_id?: string | null;
  financial?: {
    mode: "none" | "manual" | "neurofinance" | "package";
    value_per_session?: number;
    total?: number;
    charge_mode?: "per_occurrence" | "series";
    payment_method?: string | null;
    installments?: number;
  };
}

const resolveMetadata = (appointmentData: NewAppointmentData): AppointmentMetadata => {
  if (appointmentData.metadata) return appointmentData.metadata;
  if (appointmentData.type === "block" && !appointmentData.patient_id) {
    return buildEventMetadata({
      title: appointmentData.notes || "Compromisso",
      location: appointmentData.location,
      notes: appointmentData.notes,
      syncStatus: "pending",
    });
  }
  return getAppointmentMetadata({
    ...appointmentData,
    start_time: appointmentData.start_time.toISOString(),
    end_time: appointmentData.end_time.toISOString(),
  } as Appointment);
};

const addAppointment = async (appointmentData: NewAppointmentData, userId: string) => {
  const metadata = resolveMetadata(appointmentData);
  const idempotencyKey = `professional-app:create:${appointmentData.id || crypto.randomUUID()}`;
  const plan = await prepareAndExecuteAppointmentAction("create", {
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
  }, idempotencyKey);

  const result = plan.result || {};
  const appointmentIds = Array.isArray(result.appointmentIds) ? result.appointmentIds.map(String) : [];
  const appointmentId = appointmentIds[0] || String(result.appointmentId || "");
  if (!appointmentId) throw new Error("O servidor não retornou o agendamento criado.");

  const { data: newAppointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .eq("user_id", userId)
    .single();
  if (appointmentError || !newAppointment) throw new Error("O agendamento foi criado, mas não pôde ser recarregado.");

  let patientData: Partial<Patient> = {
    name: metadata.kind === "event" ? metadata.eventTitle || "Compromisso" : "Bloqueio de Agenda",
  };
  if (appointmentData.patient_id) {
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id,name,email,phone")
      .eq("id", appointmentData.patient_id)
      .eq("user_id", userId)
      .single();
    if (patientError || !patient) throw new Error("O paciente do agendamento não pôde ser recarregado.");
    patientData = patient;
  }

  return { newAppointment: newAppointment as Appointment, patientData };
};

export const useAddAppointment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: NewAppointmentData) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      return addAppointment(data, user.id);
    },
    onSuccess: ({ newAppointment, patientData }) => {
      if (newAppointment.metadata?.kind === "event") toast.success("Compromisso registrado com sucesso!");
      else if (patientData.name !== "Bloqueio de Agenda") toast.success(`Consulta para ${patientData.name} agendada com sucesso!`);
      else toast.success("Bloqueio de horário criado.");

      for (const queryKey of [
        "appointments", "appointmentsByDateRange", "financialEntries", "patientTransactions",
        "financialMetrics", "advancedCashFlow", "monthly-session-metrics", "dashboard-activities",
      ]) void queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (error) => {
      console.error("[useAddAppointment] Falha ao criar agendamento", error);
      toast.error(getUserFacingErrorMessage(error, "save"));
    },
  });
};
