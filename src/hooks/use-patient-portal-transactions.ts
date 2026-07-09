import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Transaction } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { mapFinancialEntryToTransaction } from './use-financial-entries';

const fetchPatientPortalTransactions = async (_userId: string, patientId?: string): Promise<Transaction[]> => {
  let entriesQuery = supabase
    .from('financial_entries')
    .select('*')
    .order('due_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (patientId) {
    entriesQuery = entriesQuery.eq('patient_id', patientId);
  }

  const { data: entries, error } = await entriesQuery;
  if (error) throw new Error(error.message);

  return (entries || []).map((entry) => mapFinancialEntryToTransaction(entry as any));
};

export const usePatientPortalTransactions = (patientId?: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<Transaction[], Error>({
    queryKey: ['patientPortalTransactions', userId, patientId],
    queryFn: () => fetchPatientPortalTransactions(userId!, patientId),
    enabled: !!userId,
  });
};
