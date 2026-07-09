import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from '@/types';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import {
  fromLegacyTransactionStatus,
  mapFinancialEntryToTransaction,
  toFinancialPaymentMethod,
} from './use-financial-entries';

interface UpdateTransactionData {
  id: string;
  updates: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'appointment_id'>>;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) return format(value, 'yyyy-MM-dd');
  if (typeof value === 'string') return value.slice(0, 10);
  return null;
}

const updateTransaction = async ({ id, updates }: UpdateTransactionData, userId: string) => {
  const entryPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.description !== undefined) {
    entryPatch.description = updates.description;
    entryPatch.title = updates.description;
  }
  if (updates.amount !== undefined) entryPatch.amount = Math.abs(Number(updates.amount || 0));
  if (updates.type !== undefined) entryPatch.type = updates.type;
  if (updates.payment_method !== undefined) {
    entryPatch.payment_method = toFinancialPaymentMethod(updates.payment_method);
  }
  if (updates.status !== undefined) {
    const financialStatus = fromLegacyTransactionStatus(updates.status);
    entryPatch.status = financialStatus;
    entryPatch.paid_at = financialStatus === 'paid' ? new Date().toISOString() : null;
  }

  const normalizedDate = normalizeDate(updates.date);
  if (normalizedDate) {
    entryPatch.due_date = normalizedDate;
    entryPatch.competence_date = normalizedDate;
  }

  const metadataUpdates: Record<string, unknown> = {};
  if (updates.category !== undefined) metadataUpdates.category = updates.category;
  if (updates.installments !== undefined) metadataUpdates.installments = updates.installments;
  if (updates.package_id !== undefined) metadataUpdates.package_id = updates.package_id;
  if (updates.external_reference !== undefined) metadataUpdates.external_reference = updates.external_reference;
  if (updates.attachment_url !== undefined) metadataUpdates.attachment_url = updates.attachment_url;

  if (Object.keys(metadataUpdates).length > 0) {
    const { data: existingEntry, error: existingError } = await supabase
      .from('financial_entries')
      .select('metadata')
      .eq('id', id)
      .eq('professional_id', userId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    entryPatch.metadata = {
      ...((existingEntry?.metadata as Record<string, unknown> | null) || {}),
      ...metadataUpdates,
    };
  }

  const { data: entry, error } = await supabase
    .from('financial_entries')
    .update(entryPatch)
    .eq('id', id)
    .eq('professional_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return mapFinancialEntryToTransaction(entry as any);
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: UpdateTransactionData) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      return updateTransaction(data, userId);
    },
    onSuccess: () => {
      toast.success('Transação atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactionsByDateRange'] });
      queryClient.invalidateQueries({ queryKey: ['patientTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
    },
    onError: (error) => {
      toast.error(`Falha ao atualizar transação: ${error.message}`);
    },
  });
};
