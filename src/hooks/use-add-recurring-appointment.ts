import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NewRecurringAppointmentFormValues } from '@/lib/validation';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { addWeeks, addMonths, isBefore, setHours, setMinutes, addMinutes, isSameDay, startOfDay } from 'date-fns';
import { buildSessionMetadata } from '@/lib/appointment-metadata';
import { createAppointmentFinancialEntryIfEnabled } from '@/lib/financial-appointment-automation';
import type { Appointment } from '@/types';
import { edgeFunctionUrl } from '@/lib/supabase-config';

interface RecurringAppointmentData {
  patient_id: string;
  start_time: Date;
  end_time: Date;
  type: 'presencial' | 'online';
  notes: string;
  location: string | null;
}

// URL da Edge Function para sincronizar com Google Calendar (a mesma usada para agendamento único)
const GOOGLE_CALENDAR_SYNC_URL = edgeFunctionUrl("google-calendar-sync");

// Função auxiliar para sincronizar (simulada para recorrência)
const syncAppointmentToGoogle = async (appointment: any, patient: any, accessToken: string) => {
  // Para simplificar, vamos apenas sincronizar o primeiro evento e notificar o usuário sobre a necessidade de criar a recorrência manualmente no Google.
  
  console.warn("Recurrence: Google Calendar sync is currently limited to single events. Please create recurrence manually in Google Calendar.");
  
  // Simula a chamada para a Edge Function de agendamento único para o primeiro evento
  const response = await fetch(GOOGLE_CALENDAR_SYNC_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appointment, patient }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.details || "Falha ao sincronizar o primeiro evento com o Google Calendar.");
  }

  return response.json();
};

const generateAppointments = (values: NewRecurringAppointmentFormValues): RecurringAppointmentData[] => {
  const appointments: RecurringAppointmentData[] = [];
  let currentDate = startOfDay(values.date); // Começa no início do dia
  const endDateLimit = startOfDay(values.endDate); // Limite no início do dia
  const durationMinutes = parseInt(values.duration, 10);
  const [hour, minute] = values.startTime.split(':').map(Number);

  while (isBefore(currentDate, endDateLimit) || isSameDay(currentDate, endDateLimit)) {
    let startTime = currentDate;
    startTime = setHours(startTime, hour);
    startTime = setMinutes(startTime, minute);
    
    const endTime = addMinutes(startTime, durationMinutes);

    appointments.push({
      patient_id: values.patient_id,
      start_time: startTime,
      end_time: endTime,
      type: values.type,
      notes: values.notes || "",
      location: values.type === 'presencial' ? values.location || null : null,
    });

    // Calcula a próxima data
    if (values.repetition === 'weekly') {
      currentDate = addWeeks(currentDate, 1);
    } else if (values.repetition === 'biweekly') {
      currentDate = addWeeks(currentDate, 2);
    } else if (values.repetition === 'monthly') {
      currentDate = addMonths(currentDate, 1);
    }
    
    // Se a próxima data ultrapassar o limite, paramos
    if (isBefore(endDateLimit, currentDate) && !isSameDay(endDateLimit, currentDate)) break;
  }

  return appointments;
};

const addRecurringAppointments = async (values: NewRecurringAppointmentFormValues, userId: string, accessToken: string) => {
  const appointmentsToCreate = generateAppointments(values);
  
  if (appointmentsToCreate.length === 0) {
    throw new Error("Nenhuma consulta gerada no período selecionado.");
  }
  
  // 1. Buscar dados do paciente (necessário para o sync do Google)
  const { data: patientData, error: patientError } = await supabase
    .from('patients')
    .select('name, email, phone')
    .eq('id', values.patient_id)
    .single();

  if (patientError || !patientData) {
    throw new Error("Paciente não encontrado.");
  }
  
  // 2. Sincronizar apenas o primeiro evento com o Google
  let googleEventId = null;
  let googleMeetLink = null;
  
  try {
    toast.info(`Agendando ${appointmentsToCreate.length} consultas. Sincronizando o primeiro evento com o Google...`);
    
    const firstAppointment = appointmentsToCreate[0];
    const syncResult = await syncAppointmentToGoogle(
      { 
        ...firstAppointment, 
        id: 'temp', 
        user_id: userId,
        created_at: new Date().toISOString(),
        status: 'unscored',
        metadata: buildSessionMetadata({
          modality: firstAppointment.type,
          durationMinutes: parseInt(values.duration, 10),
          syncStatus: 'pending',
          financial: undefined,
        }),
        patient_name: patientData.name,
        patient_initials: patientData.name.substring(0, 2).toUpperCase(),
      } as any, 
      patientData as any, 
      accessToken
    );
    
    googleEventId = syncResult.googleEventId;
    googleMeetLink = syncResult.googleMeetLink;
    toast.success("Primeiro agendamento sincronizado com Google Calendar!");

  } catch (e: any) {
    console.warn("Google Sync Failed for recurrence:", e.message);
    toast.warning(`Agendamentos criados, mas falha na sincronização com Google: ${e.message}`);
  }
  
  // 3. Preparar dados para inserção em massa no Supabase
  const insertData = appointmentsToCreate.map(apt => ({
    user_id: userId,
    patient_id: apt.patient_id,
    start_time: apt.start_time.toISOString(),
    end_time: apt.end_time.toISOString(),
    type: apt.type,
    notes: apt.notes || null,
    location: apt.location || null,
    status: 'unscored',
    metadata: {
      ...buildSessionMetadata({
      modality: apt.type,
      durationMinutes: parseInt(values.duration, 10),
      origin: 'neuronex',
      syncStatus: apt === appointmentsToCreate[0] && googleEventId ? 'synced' : 'pending',
      }),
      recurrence: {
        enabled: true,
        frequency: values.repetition,
        count: appointmentsToCreate.length,
      },
    },
    // Apenas o primeiro evento terá o ID do Google, os demais serão locais
    google_event_id: apt === appointmentsToCreate[0] ? googleEventId : null,
    google_meet_link: apt === appointmentsToCreate[0] ? googleMeetLink : null,
  }));

  const { data, error: insertError } = await supabase
    .from('appointments')
    .insert(insertData)
    .select();

  if (insertError) {
    console.error('Erro ao adicionar agendamentos recorrentes:', insertError);
    throw new Error(insertError.message);
  }

  const insertedData = data || [];
  let securedData: typeof insertedData;
  try {
    securedData = await Promise.all(insertedData.map(async (appointment) => {
      if (appointment.type !== 'online') return appointment;
      const { data: invite, error: inviteError } = await supabase.functions.invoke<{
        meetLink: string;
      }>('ensure-teleconsultation-invite', {
        body: { appointmentId: appointment.id },
      });
      if (inviteError || !invite?.meetLink) {
        throw new Error('Não foi possível criar o convite seguro de uma das teleconsultas recorrentes.');
      }
      return { ...appointment, google_meet_link: invite.meetLink };
    }));
  } catch (inviteError) {
    const createdIds = insertedData.map((appointment) => appointment.id);
    if (createdIds.length) await supabase.from('appointments').delete().in('id', createdIds).eq('user_id', userId);
    throw inviteError;
  }

  const firstSecuredAppointment = securedData[0];
  if (firstSecuredAppointment?.google_event_id && firstSecuredAppointment.type === 'online') {
    await supabase.functions.invoke('google-calendar-manage', {
      body: {
        action: 'update',
        googleEventId: firstSecuredAppointment.google_event_id,
        appointmentData: firstSecuredAppointment,
      },
    });
  }

  toast.success(`${securedData.length} consultas agendadas com sucesso!`);

  try {
    await Promise.all(
      securedData.map((appointment) =>
        createAppointmentFinancialEntryIfEnabled(
          appointment as Appointment,
          userId,
          patientData.name
        )
      )
    );
  } catch (financialError) {
    console.warn('[useAddRecurringAppointment] Agendamentos criados, mas a automacao financeira parcial falhou:', financialError);
  }

  return securedData;
};

export const useAddRecurringAppointment = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const userId = user?.id;
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: (data: NewRecurringAppointmentFormValues) => {
      if (!userId || !accessToken) throw new Error("Usuário não autenticado ou sessão inválida.");
      return addRecurringAppointments(data, userId, accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointmentsByDateRange'] });
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['patientTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-session-metrics'] });
    },
  });
};
