import { useQuery } from '@tanstack/react-query';
import { Transaction } from '@/types';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { fetchFinancialEntries, mapFinancialEntryToTransaction } from './use-financial-entries';

interface FetchTransactionsParams {
  startDate?: Date;
  endDate?: Date;
  userId: string;
  limit?: number;
}

const fetchTransactions = async ({ startDate, endDate, userId, limit = 100 }: FetchTransactionsParams): Promise<Transaction[]> => {
  const entries = await fetchFinancialEntries(userId, { startDate, endDate, limit });
  return entries.map(mapFinancialEntryToTransaction);
};

export const useTransactions = (startDate?: Date, endDate?: Date, limit: number = 500) => {
  const { user } = useAuth();
  const userId = user?.id;

  const startStr = startDate ? format(startDate, 'yyyy-MM-dd') : 'all';
  const endStr = endDate ? format(endDate, 'yyyy-MM-dd') : 'all';

  return useQuery<Transaction[], Error>({
    queryKey: ['transactions', userId, startStr, endStr, limit],
    queryFn: () => {
      if (!userId) throw new Error('Usuário não autenticado');
      return fetchTransactions({ startDate, endDate, userId, limit });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
};
