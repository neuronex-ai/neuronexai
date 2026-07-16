import { useQuery } from '@tanstack/react-query';
import type { Transaction } from '@/types';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { fetchFinancialEntries, mapFinancialEntryToTransaction } from './use-financial-entries';
import { repairTextEncodingDeep } from '@/lib/text-encoding';

const fetchPatientTransactions = async (patientId: string, userId: string): Promise<Transaction[]> => {
  const entries = await fetchFinancialEntries(userId, { patientId, limit: 500 });
  return repairTextEncodingDeep(entries.map(mapFinancialEntryToTransaction));
};

export const usePatientTransactions = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<Transaction[], Error>({
    queryKey: ['patientTransactions', patientId, userId],
    queryFn: () => fetchPatientTransactions(patientId, userId!),
    enabled: !!patientId && !!userId,
  });
};
