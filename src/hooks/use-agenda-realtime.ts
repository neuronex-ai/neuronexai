import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';

export const useAgendaRealtime = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const channelId = Math.random().toString(36).substring(7);
        const channel = supabase
            .channel(`agenda-realtime-${channelId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointments',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    console.log('Realtime appointment change:', payload);
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                    queryClient.invalidateQueries({ queryKey: ['financial_metrics'] });
                    queryClient.invalidateQueries({ queryKey: ['transactions'] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'financial_entries',
                    filter: `professional_id=eq.${user.id}`,
                },
                () => {
                    console.log('Realtime financial entry change');
                    queryClient.invalidateQueries({ queryKey: ['transactions'] });
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                    queryClient.invalidateQueries({ queryKey: ['financial_metrics'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);
};
