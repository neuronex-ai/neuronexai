import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { edgeFunctionUrl } from '@/lib/supabase-config';
import { useGoogleAuth } from '@/hooks/use-google-auth';

const POLL_URL = edgeFunctionUrl("google-calendar-poll");

export const useGoogleCalendarSync = () => {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const queryClient = useQueryClient();
  const { isConnected, isLoading: isLoadingConnection } = useGoogleAuth();

  useQuery({
    queryKey: ['googleCalendarSync', session?.user?.id],
    queryFn: async () => {
      if (!accessToken || !isConnected) return null;

      try {
          const response = await fetch(POLL_URL, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (response.ok) {
              const data = await response.json();
              if (data.imported > 0) {
                  // CRÍTICO: Invalida o cache de agendamentos para mostrar os novos bloqueios na UI imediatamente
                  queryClient.invalidateQueries({ queryKey: ['appointments'] });
                  queryClient.invalidateQueries({ queryKey: ['appointmentsByDateRange'] });
                  
                  toast.success(`Agenda atualizada: ${data.imported} eventos do Google importados.`);
              }
              return data;
          }
          if (response.status !== 404) {
            console.error("[useGoogleCalendarSync] Poll recusado", response.status);
          }
      } catch (e) {
          console.error("Background Sync Error:", e);
      }
      return null;
    },
    enabled: Boolean(accessToken && isConnected && !isLoadingConnection),
    refetchInterval: 1000 * 60 * 2, // Poll a cada 2 minutos
    refetchOnWindowFocus: Boolean(isConnected), // Sincroniza ao voltar para a aba apenas se conectado
    staleTime: 0 // Sempre tenta buscar dados frescos
  });
};
