import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Appointment } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { getAppointmentDisplayTitle } from '@/lib/appointment-utils';
import { isCancelledAppointmentStatus } from '@/lib/appointment-status';

const fetchAppointmentsByRange = async (userId: string, startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patient:patients(name, email, phone)')
    .eq('user_id', userId)
    .eq('visibility_status', 'visible')
    .is('archived_at', null)
    .gte('start_time', startDate)
    .lte('end_time', endDate);

  if (error) throw new Error(error.message);

  return data.map(apt => {
    const appointment = {
      ...apt,
      patient_name: apt.patient?.name,
      patient_email: apt.patient?.email,
      patient_phone: apt.patient?.phone,
    } as Appointment;

    return {
      ...appointment,
      patient_name: getAppointmentDisplayTitle(appointment),
    };
  }).filter((apt: Appointment) => !isCancelledAppointmentStatus(apt.status, apt.notes)) as Appointment[];
};

export const useAppointmentsByRange = (startDate: Date, endDate: Date) => {
  const { user } = useAuth();

  return useQuery<Appointment[], Error>({
    queryKey: ['appointments', user?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: () => fetchAppointmentsByRange(user!.id, startDate.toISOString(), endDate.toISOString()),
    enabled: !!user,
  });
};
