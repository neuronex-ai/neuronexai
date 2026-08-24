import { supabase } from '@/integrations/supabase/client';
import { prepareAndExecuteAppointmentAction } from '@/lib/appointment-action-plans';
import type { Appointment } from '@/types';

export interface TeleconsultationTranscriptionDecision {
  enabled: boolean;
  decidedAt?: string;
  decidedBy?: string;
  noticeVersion?: string;
  notes?: string;
}

interface PersistTeleconsultationDecisionInput {
  appointmentId: string;
  professionalId: string;
  enabled: boolean;
  notes?: string;
}

interface PersistTeleconsultationDecisionDependencies {
  execute: typeof prepareAndExecuteAppointmentAction;
  readAppointment: (appointmentId: string, professionalId: string) => Promise<Appointment>;
  createIdempotencyKey: () => string;
}

const readAppointment = async (appointmentId: string, professionalId: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .eq('user_id', professionalId)
    .single();

  if (error || !data) {
    throw new Error('A decisão foi enviada, mas não pôde ser confirmada no agendamento.');
  }

  return data as Appointment;
};

const defaultDependencies: PersistTeleconsultationDecisionDependencies = {
  execute: prepareAndExecuteAppointmentAction,
  readAppointment,
  createIdempotencyKey: () => crypto.randomUUID(),
};

export const getTeleconsultationTranscriptionDecision = (
  metadata: Appointment['metadata'],
): TeleconsultationTranscriptionDecision | null => {
  const decision = metadata?.teleconsultationTranscription;
  return decision && typeof decision.enabled === 'boolean'
    ? decision as TeleconsultationTranscriptionDecision
    : null;
};

export const persistTeleconsultationTranscriptionDecision = async (
  input: PersistTeleconsultationDecisionInput,
  dependencies: PersistTeleconsultationDecisionDependencies = defaultDependencies,
) => {
  await dependencies.execute(
    'set_teleconsultation_transcription',
    {
      appointment_id: input.appointmentId,
      enabled: input.enabled,
      notes: input.notes?.trim() || undefined,
    },
    `professional_app:teleconsultation-consent:${input.appointmentId}:${dependencies.createIdempotencyKey()}`,
    'professional_app',
  );

  const appointment = await dependencies.readAppointment(input.appointmentId, input.professionalId);
  const decision = getTeleconsultationTranscriptionDecision(appointment.metadata);

  if (!decision || decision.enabled !== input.enabled) {
    throw new Error('A preferência de transcrição não foi confirmada. Tente novamente antes de entrar na sala.');
  }

  return { appointment, decision };
};
