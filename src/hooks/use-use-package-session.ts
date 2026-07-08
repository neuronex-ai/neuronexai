import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UsePackageSessionData {
  packageId: string;
  patientId: string;
}

const markPackageSessionAsUsed = async ({ packageId, patientId: _patientId }: UsePackageSessionData, userId: string) => {
  // 1. Buscar o pacote atual
  const { data: currentPackage, error: fetchError } = await supabase
    .from('patient_packages')
    .select('sessions_used, total_sessions')
    .eq('id', packageId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !currentPackage) {
    throw new Error("Pacote não encontrado ou acesso negado.");
  }

  const newSessionsUsed = currentPackage.sessions_used + 1;

  if (newSessionsUsed > currentPackage.total_sessions) {
    throw new Error("Todas as sessões deste pacote já foram utilizadas.");
  }

  // 2. Atualizar o pacote
  const { data: updatedPackage, error: updateError } = await supabase
    .from('patient_packages')
    .update({ sessions_used: newSessionsUsed })
    .eq('id', packageId)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateError) {
    console.error('Erro ao usar sessão do pacote:', updateError);
    throw new Error(updateError.message);
  }

  return updatedPackage;
};

export const useUsePackageSession = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: (data: UsePackageSessionData) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      return markPackageSessionAsUsed(data, userId);
    },
    onSuccess: (data, variables) => {
      toast.success(`Sessão utilizada! Restam ${data.total_sessions - data.sessions_used} sessões.`);
      queryClient.invalidateQueries({ queryKey: ['patientPackages', variables.patientId] });
      queryClient.invalidateQueries({ queryKey: ['activePatientPackages', variables.patientId] });
      // Atualiza a projeção financeira em tempo real
      queryClient.invalidateQueries({ queryKey: ['advancedCashFlow'] });
      queryClient.invalidateQueries({ queryKey: ['financialMetrics'] });
    },
    onError: (error) => {
      toast.error(`Falha ao usar sessão: ${error.message}`);
    }
  });
};
