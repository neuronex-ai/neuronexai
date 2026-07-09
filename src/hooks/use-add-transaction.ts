import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { mapFinancialEntryToTransaction, toFinancialPaymentMethod } from './use-financial-entries';

export interface ExtendedTransactionData {
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  date: Date;
  payment_method?: string;
  installments?: number;
  external_reference?: string;
  attachment_url?: string;
  patient_id?: string;
  package_id?: string;
  create_new_package?: boolean;
  new_package_sessions?: number;
  debit_session?: boolean;
}

const addTransaction = async (data: ExtendedTransactionData, userId: string) => {
  let finalPackageId = data.package_id;

  if (data.create_new_package && data.patient_id && data.new_package_sessions) {
    const { data: newPkg, error: pkgError } = await supabase
      .from('patient_packages')
      .insert({
        user_id: userId,
        patient_id: data.patient_id,
        description: `Pacote Gerado: ${data.description}`,
        total_sessions: data.new_package_sessions,
        sessions_used: 0,
        price: data.amount,
        start_date: format(data.date, 'yyyy-MM-dd'),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (pkgError) throw new Error(`Erro ao criar pacote: ${pkgError.message}`);
    finalPackageId = newPkg.id;
  }

  const { data: entry, error } = await supabase
    .from('financial_entries')
    .insert({
      professional_id: userId,
      description: data.description,
      title: data.description,
      amount: Math.abs(Number(data.amount || 0)),
      type: data.type,
      due_date: format(data.date, 'yyyy-MM-dd'),
      competence_date: format(data.date, 'yyyy-MM-dd'),
      paid_at: data.date.toISOString(),
      status: 'paid',
      payment_method: toFinancialPaymentMethod(data.payment_method || 'pix'),
      origin: finalPackageId ? 'package' : 'manual',
      patient_id: data.patient_id || null,
      metadata: {
        category: data.category || null,
        installments: data.installments || 1,
        external_reference: data.external_reference || null,
        attachment_url: data.attachment_url || null,
        package_id: finalPackageId || null,
      },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (finalPackageId && data.debit_session !== false) {
    const { data: pkg } = await supabase
      .from('patient_packages')
      .select('sessions_used, total_sessions')
      .eq('id', finalPackageId)
      .single();

    if (pkg && pkg.sessions_used < pkg.total_sessions) {
      await supabase
        .from('patient_packages')
        .update({ sessions_used: pkg.sessions_used + 1 })
        .eq('id', finalPackageId);
    }
  }

  return mapFinancialEntryToTransaction(entry as any);
};

export const useAddTransaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: ExtendedTransactionData) => {
      if (!userId) throw new Error('Usuário não autenticado.');
      return addTransaction(data, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financialEntries'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });

      if (variables.patient_id) {
        queryClient.invalidateQueries({ queryKey: ['patientPackages', variables.patient_id] });
        queryClient.invalidateQueries({ queryKey: ['activePatientPackages', variables.patient_id] });
        queryClient.invalidateQueries({ queryKey: ['patientTransactions', variables.patient_id] });
        queryClient.invalidateQueries({ queryKey: ['patient', variables.patient_id] });
      }
    },
  });
};
