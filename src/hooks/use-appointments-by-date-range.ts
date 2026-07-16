import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Appointment } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatISO } from 'date-fns';
import { useEffect } from 'react';
import { getAppointmentDisplayTitle } from '@/lib/appointment-utils';

interface FetchAppointmentsByDateRangeParams {
  startDate: Date;
  endDate: Date;
  userId: string;
}

const fetchAppointmentsByDateRange = async ({ startDate, endDate, userId }: FetchAppointmentsByDateRangeParams): Promise<Appointment[]> => {
  const startISO = formatISO(startDate, { representation: 'complete' });
  const endISO = formatISO(endDate, { representation: 'complete' });

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patient_id (name, email, phone)
    `)
    .eq('user_id', userId)
    .eq('visibility_status', 'visible')
    .is('archived_at', null)
    .gte('start_time', startISO)
    .lte('start_time', endISO)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Erro ao buscar agendamentos por período:', error);
    throw new Error(error.message);
  }

  return data.map(apt => {
    const appointment = {
      ...apt,
      patient_name: apt.patient?.name,
      patient_email: apt.patient?.email,
      patient_phone: apt.patient?.phone,
      patient_initials: apt.patient?.name ? apt.patient.name.substring(0, 2).toUpperCase() : '??'
    } as Appointment;

    return {
      ...appointment,
      patient_name: getAppointmentDisplayTitle(appointment),
    };
  }) as Appointment[];
};

export const useAppointmentsByDateRange = (startDate: Date, endDate: Date) => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Setup Realtime Subscription
  useEffect(() => {
    if (!userId) return;

    const channelId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`appointments_realtime_${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `user_id=eq.${userId}`,
        },
        (_payload) => {
          // Invalida a query para forçar recarregamento quando houver mudanças
          queryClient.invalidateQueries({ queryKey: ['appointmentsByDateRange'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return useQuery<Appointment[], Error>({
    queryKey: ['appointmentsByDateRange', startDate.toISOString(), endDate.toISOString(), userId],
    queryFn: () => fetchAppointmentsByDateRange({ startDate, endDate, userId: userId! }),
    enabled: !!startDate && !!endDate && !!userId,
  });
};
