import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/SessionContextProvider";
import {
  buildFinancialEntryIdempotencyKey,
  fromLegacyTransactionStatus,
  toFinancialPaymentMethod,
} from "@/hooks/use-financial-entries";
import { supabase } from "@/integrations/supabase/client";
import { prepareAndExecuteAppointmentAction } from "@/lib/appointment-action-plans";
import { createAppointmentFinancialEntryIfEnabled } from "@/lib/financial-appointment-automation";
import {
  buildEventMetadata,
  getAppointmentMetadata,
  type AppointmentMetadata,
} from "@/lib/appointment-metadata";
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
      syncStatus: "pending",
    });
  }
  return getAppointmentMetadata({
    ...appointmentData,
    start_time: appointmentData.start_time.toISOString(),
    end_time: appointmentData.end_time.toISOString(),
  } as Appointment);
};

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

const createExplicitFinancialEntry = async (
  appointment: Appointment,
  userId: string,
  patientName: string | null | undefined,
  metadata: AppointmentMetadata,
) => {
  const financial = metadata.financial;
  const amount = Number(financial?.transactionAmount || 0);
  if (!appointment.patient_id || financial?.usePackage || amount <= 0) return false;

  const idempotencyKey = buildFinancialEntryIdempotencyKey([
    "appointment",
    "explicit",
    appointment.id,
  ]);
  const status = fromLegacyTransactionStatus("pending");
  const payload = {
    professional_id: userId,
    appointment_id: appointment.id,
    title: `Sessão - ${patientName || "Paciente"}`,
    description: `Sessão - ${patientName || "Paciente"}`,
    amount: Math.abs(amount),
    type: "income" as const,
    due_date: format(new Date(appointment.start_time), "yyyy-MM-dd"),
    competence_date: format(new Date(appointment.start_time), "yyyy-MM-dd"),
    paid_at: null,
    payment_method: toFinancialPaymentMethod(financial?.transactionMethod || "pix"),
    patient_id: appointment.patient_id,
    status,
    origin: "appointment" as const,
    idempotency_key: idempotencyKey,
    metadata: {
      category: "Sessão",
      installments: financial?.installments || 1,
      package_id: null,
      source: "appointment_explicit_financial_entry",
    },
  };

  const { data: existing, error: existingError } = await supabase
    .from("financial_entries")
    .select("id,status,paid_at,metadata")
    .eq("professional_id", userId)
    .or(`appointment_id.eq.${appointment.id},idempotency_key.eq.${idempotencyKey}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  const query = existing
    ? supabase
        .from("financial_entries")
        .update({
          ...payload,
          status: existing.status === "paid" ? "paid" : status,
          paid_at: existing.status === "paid" ? existing.paid_at : null,
          metadata: {
            ...(existing.metadata || {}),
            ...payload.metadata,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("professional_id", userId)
    : supabase.from("financial_entries").insert(payload);

  const { error } = await query;
  if (error) throw error;
  return true;
};

const applyFinancialEffects = async (
  appointment: Appointment,
  userId: string,
  patientName: string | null | undefined,
  metadata: AppointmentMetadata,
) => {
  const hasExplicitIntent =
    !metadata.financial?.usePackage
    && Number(metadata.financial?.transactionAmount || 0) > 0;

  try {
    if (hasExplicitIntent) {
      await createExplicitFinancialEntry(appointment, userId, patientName, metadata);
    } else {
      await createAppointmentFinancialEntryIfEnabled(appointment, userId, patientName);
    }
  } catch (error) {
    console.warn("[useAddAppointment] Agendamento criado, mas o financeiro falhou", error);
    toast.warning("Agendamento criado, mas o lançamento financeiro precisa ser revisado.");
  }

  return hasExplicitIntent;
};

const insertAppointmentDirectly = async (
  appointmentData: NewAppointmentData,
  userId: string,
): Promise<AppointmentCreationResult> => {
  const metadata = resolveMetadata(appointmentData);
  const patientData = await loadPatientData(appointmentData.patient_id, userId, metadata);
  const appointmentId = appointmentData.id || crypto.randomUUID();

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      id: appointmentId,
      user_id: userId,
      patient_id: appointmentData.patient_id,
      start_time: appointmentData.start_time.toISOString(),
      end_time: appointmentData.end_time.toISOString(),
      type: appointmentData.type,
      notes: appointmentData.notes || null,
      location: appointmentData.location,
      status: "unscored",
      metadata: {
        ...metadata,
        origin: metadata.origin || "neuronex",
        syncStatus: metadata.syncStatus || "pending",
        ...(appointmentData.type === "online"
          ? { teleconsultationRoom: { status: "waiting" } }
          : {}),
      },
      google_event_id: null,
      google_meet_link: null,
    })
    .select("*")
    .single();

  if (error || !data) throw error || new Error("O servidor não retornou o agendamento criado.");
  let createdAppointment = data as Appointment;

  if (appointmentData.type === "online") {
    try {
      const { data: invite, error: inviteError } = await supabase.functions.invoke<{ meetLink?: string }>(
        "ensure-teleconsultation-invite",
        { body: { appointmentId } },
      );
      if (inviteError) throw inviteError;
      if (invite?.meetLink) {
        const { data: updated } = await supabase
          .from("appointments")
          .update({ google_meet_link: invite.meetLink })
          .eq("id", appointmentId)
          .eq("user_id", userId)
          .select("*")
          .single();
        if (updated) createdAppointment = updated as Appointment;
      }
    } catch (error) {
      console.warn("[useAddAppointment] Convite da teleconsulta não criado", error);
      toast.warning("Agendamento criado, mas o link da teleconsulta precisa ser revisado.");
    }
  }

  const suppressLegacyFinancialCall = await applyFinancialEffects(
    createdAppointment,
    userId,
    patientData.name,
    metadata,
  );

  return {
    newAppointment: suppressLegacyFinancialCall ? null : createdAppointment,
    createdAppointment,
    patientData,
  };
};

const addAppointment = async (
  appointmentData: NewAppointmentData,
  userId: string,
): Promise<AppointmentCreationResult> => {
  const metadata = resolveMetadata(appointmentData);

  try {
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
    const suppressLegacyFinancialCall = await applyFinancialEffects(
      createdAppointment,
      userId,
      patientData.name,
      metadata,
    );

    return {
      newAppointment: suppressLegacyFinancialCall ? null : createdAppointment,
      createdAppointment,
      patientData,
    };
  } catch (error) {
    if (!isMissingAppointmentPlanRpc(error)) throw error;

    console.warn(
      "[useAddAppointment] RPC de planos ausente no banco; usando criação direta compatível.",
      error,
    );
    return insertAppointmentDirectly(appointmentData, userId);
  }
};

export const useAddAppointment = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
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
};
