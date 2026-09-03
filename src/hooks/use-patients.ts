import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { isCancelledAppointmentStatus } from '@/lib/appointment-status';

const DIRECTORY_APPOINTMENT_PAGE_SIZE = 1000;

type DirectoryAppointmentRow = {
  patient_id: string | null;
  start_time: string;
  end_time: string;
  status: string | null;
  notes: string | null;
  type: string | null;
  lifecycle_status: string | null;
};

type PatientSessionContext = Record<
  string,
  {
    last_session: string | null;
    next_session: string | null;
  }
>;

const fetchPatients = async (userId: string): Promise<Patient[]> => {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pacientes:', error);
    throw new Error(error.message);
  }

  return data || [];
};

const isUsableClinicalAppointment = (appointment: DirectoryAppointmentRow) => {
  if (!appointment.patient_id || appointment.type === 'block') return false;
  if (appointment.lifecycle_status === 'cancelled') return false;
  return !isCancelledAppointmentStatus(appointment.status, appointment.notes);
};

const fetchDirectoryAppointmentRows = async (
  userId: string,
  direction: 'past' | 'future',
): Promise<DirectoryAppointmentRow[]> => {
  const now = new Date().toISOString();
  const rows: DirectoryAppointmentRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('appointments')
      .select('patient_id,start_time,end_time,status,notes,type,lifecycle_status')
      .eq('user_id', userId)
      .eq('visibility_status', 'visible')
      .is('archived_at', null)
      .not('patient_id', 'is', null)
      .neq('type', 'block');

    query = direction === 'past'
      ? query.lt('end_time', now).order('end_time', { ascending: false })
      : query.gte('start_time', now).order('start_time', { ascending: true });

    const { data, error } = await query.range(
      from,
      from + DIRECTORY_APPOINTMENT_PAGE_SIZE - 1,
    );

    if (error) {
      console.error('Erro ao buscar contexto de sessões dos pacientes:', error);
      throw new Error(error.message);
    }

    const page = (data || []) as DirectoryAppointmentRow[];
    rows.push(...page);

    if (page.length < DIRECTORY_APPOINTMENT_PAGE_SIZE) break;
    from += DIRECTORY_APPOINTMENT_PAGE_SIZE;
  }

  return rows;
};

const fetchPatientSessionContext = async (userId: string): Promise<PatientSessionContext> => {
  const [pastAppointments, futureAppointments] = await Promise.all([
    fetchDirectoryAppointmentRows(userId, 'past'),
    fetchDirectoryAppointmentRows(userId, 'future'),
  ]);

  const context: PatientSessionContext = {};

  for (const appointment of pastAppointments) {
    if (!isUsableClinicalAppointment(appointment) || !appointment.patient_id) continue;
    const current = context[appointment.patient_id] || {
      last_session: null,
      next_session: null,
    };
    if (!current.last_session) current.last_session = appointment.start_time;
    context[appointment.patient_id] = current;
  }

  for (const appointment of futureAppointments) {
    if (!isUsableClinicalAppointment(appointment) || !appointment.patient_id) continue;
    const current = context[appointment.patient_id] || {
      last_session: null,
      next_session: null,
    };
    if (!current.next_session) current.next_session = appointment.start_time;
    context[appointment.patient_id] = current;
  }

  return context;
};

export const usePatients = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const patientsQuery = useQuery<Patient[], Error>({
    queryKey: ['patients', userId],
    queryFn: () => fetchPatients(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const sessionContextQuery = useQuery<PatientSessionContext, Error>({
    queryKey: ['appointments', 'patient-directory-context', userId],
    queryFn: () => fetchPatientSessionContext(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 30,
  });

  const sessionContext = sessionContextQuery.data || {};
  const hasCanonicalSessionContext = sessionContextQuery.isSuccess;
  const data = patientsQuery.data?.map((patient) => ({
    ...patient,
    // `patients.last_session` / `patients.next_session` are legacy denormalized
    // fields and can drift. The Agenda is the canonical source for directory UI.
    // Keep the legacy values only as a graceful fallback if the Agenda read fails.
    last_session: hasCanonicalSessionContext
      ? sessionContext[patient.id]?.last_session ?? null
      : patient.last_session,
    next_session: hasCanonicalSessionContext
      ? sessionContext[patient.id]?.next_session ?? null
      : patient.next_session,
  }));

  return {
    ...patientsQuery,
    data,
    error: patientsQuery.error || sessionContextQuery.error,
    isError: patientsQuery.isError || sessionContextQuery.isError,
    isLoading: patientsQuery.isLoading || sessionContextQuery.isLoading,
    isFetching: patientsQuery.isFetching || sessionContextQuery.isFetching,
  };
};
