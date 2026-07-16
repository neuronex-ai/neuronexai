import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Appointment } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { formatISO } from 'date-fns';

interface PatientAppointment extends Appointment {
  patient_name: string;
  patient_initials: string;
}

const fetchPatientAppointments = async (_userId: string, patientId?: string): Promise<PatientAppointment[]> => {
  const now = formatISO(new Date());

  // If we have a specific patient ID, we should filter by it to be safe/explicit.
  let query = supabase
    .from('appointments')
    .select(`
      *,
      patient:patient_id (name)
    `)
    .eq('visibility_status', 'visible')
    .is('archived_at', null)
    .gte('start_time', now) // Only upcoming appointments
    .order('start_time', { ascending: true });

  if (patientId) {
    query = query.eq('patient_id', patientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar agendamentos do paciente:', error);
    throw new Error(error.message);
  }

  return data.map(apt => {
    const patientName = apt.patient?.name || 'Você';
    const patientInitials = patientName.substring(0, 2).toUpperCase();

    return {
      ...apt,
      patient_name: patientName,
      patient_initials: patientInitials,
    } as PatientAppointment;
  }) || [];
};

export const usePatientAppointments = (patientId?: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<PatientAppointment[], Error>({
    queryKey: ['patientAppointments', userId, patientId],
    queryFn: () => fetchPatientAppointments(userId!, patientId),
    enabled: !!userId,
  });
};
