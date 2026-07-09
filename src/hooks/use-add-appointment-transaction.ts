import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getUserFacingErrorMessage } from '@/lib/user-facing-error';
import {
  buildFinancialEntryIdempotencyKey,
  fromLegacyTransactionStatus,
  mapFinancialEntryToTransaction,
  toFinancialPaymentMethod,
} from './use-financial-entries';

interface NewAppointmentTransactionData {
  appointmentId: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: Date;
  payment_method?: string;
  installments?: number;
  patient_id?: string | null;
  package_id?: string | null;
  status?: string;
}

const addAppointmentTransaction = async (data: NewAppointmentTransactionData, userId: string) => {
  const financialStatus = fromLegacyTransactionStatus(data.status);
  const idempotencyKey = buildFinancialEntryIdempotencyKey(['appointment', 'explicit', data.appointmentId]);
  const payload = {
    professional_id: userId,
    appointment_id: data.appointmentId,
    title: data.description,
    description: data.description,
    amount: Math.abs(Number(data.amount || 0)),
    type: data.type,
    due_date: format(data.date, 'yyyy-MM-dd'),
    competence_date: format(data.date, 'yyyy-MM-dd'),
    paid_at: financialStatus === 'paid' ? data.date.toISOString() : null,
    payment_method: toFinancialPaymentMethod(data.payment_method || 'pix'),
    patient_id: data.patient_id || null,
    status: financialStatus,
    origin: 'appointment',
    idempotency_key: idempotencyKey,
    metadata: {
      category: data.category || 'Sessao',
      installments: data.installments || 1,
      package_id: data.package_id || null,
      source: 'appointment_explicit_financial_entry',
    },
  };

  const { data: existingEntry, error: existingError } = await supabase
    .from('financial_entries')
    .select('*')
    .eq('professional_id', userId)
    .or(`appointment_id.eq.${data.appointmentId},idempotency_key.eq.${idempotencyKey}`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  const query = existingEntry
    ? supabase
        .from('financial_entries')
        .update({
          ...payload,
          status: existingEntry.status === 'paid' && financialStatus !== 'paid' ? 'paid' : financialStatus,
          paid_at: existingEntry.status === 'paid' && financialStatus !== 'paid' ? existingEntry.paid_at : payload.paid_at,
          metadata: {
            ...(existingEntry.metadata || {}),
            ...payload.metadata,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingEntry.id)
        .eq('professional_id', userId)
        .select()
        .single()
    : supabase
        .from('financial_entries')
        .insert(payload)
        .select()
        .single();

  const { data: entry, error } = await query;
  if (error) throw error;

  return mapFinancialEntryToTransaction(entry as any);
};

export const useAddAppointmentTransaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: NewAppointmentTransactionData) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      return addAppointmentTransaction(data, userId);
    },
    onSuccess: () => {
      toast.success('Transação de consulta registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['patientTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
    },
    onError: (error) => {
      console.error('[useAddAppointmentTransaction] Falha ao registrar movimentação', error);
      toast.error(getUserFacingErrorMessage(error, 'save'));
    },
  });
};
