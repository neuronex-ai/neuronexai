import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { isAttendedAppointmentStatus, isCancelledAppointmentStatus } from '@/lib/appointment-status';
import type { Appointment } from '@/types';
import {
  buildFinancialEntryIdempotencyKey,
  fetchFinancialAutomationSettings,
  type FinancialAutomationSettings,
  type FinancialEntry,
  type FinancialEntryStatus,
} from '@/hooks/use-financial-entries';

type AppointmentLike = Pick<Appointment, 'id' | 'patient_id' | 'start_time' | 'type' | 'status' | 'notes' | 'metadata'> & {
  patient?: { name?: string | null } | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const getPatientName = (appointment: Partial<AppointmentLike>, fallback?: string | null) => {
  if (appointment.patient?.name) return appointment.patient.name;
  return fallback || 'Paciente';
};

const isClinicalAppointment = (appointment: Partial<AppointmentLike>) => {
  const metadata = asRecord(appointment.metadata);
  return Boolean(appointment.patient_id) && appointment.type !== 'block' && metadata.kind !== 'event' && metadata.kind !== 'block';
};

export const hasExplicitFinancialIntent = (appointment: Partial<AppointmentLike>) => {
  const metadata = asRecord(appointment.metadata);
  const financial = asRecord(metadata.financial);
  const transactionAmount = Number(financial.transactionAmount || 0);
  const mode = String(financial.mode || "");
  return ["none", "manual", "neurofinance", "package", "insurance"].includes(mode)
    || financial.usePackage === true
    || transactionAmount > 0;
};

async function fetchLinkedFinancialEntry(userId: string, appointmentId: string) {
  const idempotencyKey = buildFinancialEntryIdempotencyKey(['appointment', 'primary', appointmentId]);
  const { data, error } = await supabase
    .from('financial_entries')
    .select('*')
    .eq('professional_id', userId)
    .or(`appointment_id.eq.${appointmentId},idempotency_key.eq.${idempotencyKey}`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as FinancialEntry | null;
}

export async function createAppointmentFinancialEntryIfEnabled(
  appointment: AppointmentLike,
  userId: string,
  patientName?: string | null,
  options: {
    settings?: FinancialAutomationSettings | null;
    status?: FinancialEntryStatus;
    skipExplicitFinancialIntent?: boolean;
  } = {}
) {
  if (!isClinicalAppointment(appointment)) return null;
  if (options.skipExplicitFinancialIntent !== false && hasExplicitFinancialIntent(appointment)) return null;

  const settings = options.settings ?? await fetchFinancialAutomationSettings(userId);
  if (!settings?.appointment_auto_create_enabled) return null;

  const amount = Number(settings.appointment_default_amount || 0);
  if (amount <= 0) return null;

  const existing = await fetchLinkedFinancialEntry(userId, appointment.id);
  if (existing) return existing;

  const startDate = new Date(appointment.start_time);
  const dueDate = addDays(startDate, Math.max(0, Number(settings.appointment_due_days || 0)));
  const entryStatus = options.status || 'planned';
  const displayPatient = getPatientName(appointment, patientName);
  const idempotencyKey = buildFinancialEntryIdempotencyKey(['appointment', 'primary', appointment.id]);

  const { data, error } = await supabase
    .from('financial_entries')
    .insert({
      professional_id: userId,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      type: 'income',
      title: `Sessao - ${displayPatient}`,
      description: `Sessao agendada para ${format(startDate, 'dd/MM/yyyy')}`,
      category_id: settings.appointment_default_category_id || null,
      amount,
      due_date: format(dueDate, 'yyyy-MM-dd'),
      competence_date: format(startDate, 'yyyy-MM-dd'),
      paid_at: null,
      status: entryStatus,
      payment_method: 'manual',
      origin: 'appointment',
      idempotency_key: idempotencyKey,
      metadata: {
        source: 'appointment_auto_create',
        patient_name: displayPatient,
        appointment_start_time: appointment.start_time,
        due_days: settings.appointment_due_days || 0,
      },
    })
    .select()
    .single();

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('duplicate') || message.includes('idempotency')) {
      const existingAfterRace = await fetchLinkedFinancialEntry(userId, appointment.id);
      if (existingAfterRace) return existingAfterRace;
    }
    throw error;
  }
  return data as FinancialEntry;
}

export async function syncAppointmentFinancialEntryAfterUpdate(
  previousAppointment: AppointmentLike,
  updatedAppointment: AppointmentLike,
  userId: string
) {
  if (!isClinicalAppointment(updatedAppointment)) return null;

  const existing = await fetchLinkedFinancialEntry(userId, updatedAppointment.id);
  const settings = await fetchFinancialAutomationSettings(userId);

  if (!existing) {
    if (isAttendedAppointmentStatus(updatedAppointment.status, updatedAppointment.notes)) {
      return createAppointmentFinancialEntryIfEnabled(updatedAppointment, userId, getPatientName(previousAppointment), {
        settings,
        status: 'pending',
      });
    }
    return null;
  }

  const patch: Record<string, unknown> = {};
  const currentStatus = existing.status;
  const canChangeLifecycle = currentStatus !== 'paid';

  if (updatedAppointment.patient_id !== previousAppointment.patient_id) {
    patch.patient_id = updatedAppointment.patient_id || null;
  }

  if (updatedAppointment.start_time !== previousAppointment.start_time && currentStatus !== 'paid' && currentStatus !== 'cancelled') {
    const startDate = new Date(updatedAppointment.start_time);
    const dueDays = Math.max(0, Number(settings?.appointment_due_days ?? existing.metadata?.due_days ?? 0));
    patch.competence_date = format(startDate, 'yyyy-MM-dd');
    patch.due_date = format(addDays(startDate, dueDays), 'yyyy-MM-dd');
    patch.description = `Sessao agendada para ${format(startDate, 'dd/MM/yyyy')}`;
    patch.metadata = {
      ...(existing.metadata || {}),
      appointment_start_time: updatedAppointment.start_time,
      due_days: dueDays,
      last_synced_from_appointment_at: new Date().toISOString(),
    };
  }

  if (canChangeLifecycle && isCancelledAppointmentStatus(updatedAppointment.status, updatedAppointment.notes)) {
    patch.status = 'cancelled';
    patch.paid_at = null;
  } else if (
    currentStatus !== 'cancelled' &&
    settings?.attended_status_moves_to_pending !== false &&
    isAttendedAppointmentStatus(updatedAppointment.status, updatedAppointment.notes)
  ) {
    patch.status = 'pending';
  }

  if (Object.keys(patch).length === 0) return existing;

  const { data, error } = await supabase
    .from('financial_entries')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .eq('professional_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as FinancialEntry;
}
