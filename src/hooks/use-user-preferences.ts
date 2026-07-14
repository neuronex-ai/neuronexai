import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

export type UserThemePreference = 'light' | 'dark' | 'system';
export type UserDensityPreference = 'comfortable' | 'compact';

export interface UserPreferences {
  user_id: string;
  theme: UserThemePreference;
  density: UserDensityPreference;
  reduced_motion: boolean;
  language: string;
  timezone: string;
  week_starts_on: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'user_id'> = {
  theme: 'dark',
  density: 'comfortable',
  reduced_motion: false,
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  week_starts_on: 1,
};

const fetchUserPreferences = async (userId: string): Promise<UserPreferences> => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    user_id: userId,
    ...DEFAULT_USER_PREFERENCES,
    ...(data || {}),
  } as UserPreferences;
};

export const useUserPreferences = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['userPreferences', userId] as const, [userId]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchUserPreferences(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Partial<Omit<UserPreferences, 'user_id'>>) => {
      if (!userId) throw new Error('Usuário não autenticado.');

      const current = queryClient.getQueryData<UserPreferences>(queryKey) || {
        user_id: userId,
        ...DEFAULT_USER_PREFERENCES,
      };

      const payload: UserPreferences = {
        ...current,
        ...updates,
        user_id: userId,
      };

      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();

      if (error) throw error;
      return data as UserPreferences;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserPreferences>(queryKey);
      const optimistic: UserPreferences = {
        user_id: userId || '',
        ...DEFAULT_USER_PREFERENCES,
        ...(previous || {}),
        ...updates,
      };
      queryClient.setQueryData(queryKey, optimistic);
      return { previous };
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const preferences = useMemo<UserPreferences | null>(
    () => userId
      ? query.data || { user_id: userId, ...DEFAULT_USER_PREFERENCES }
      : null,
    [query.data, userId],
  );

  useEffect(() => {
    if (!preferences) return;

    const root = document.documentElement;
    root.dataset.density = preferences.density;
    root.lang = preferences.language || 'pt-BR';
    root.classList.toggle('reduce-motion', preferences.reduced_motion);
  }, [preferences]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-preferences:${userId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_preferences',
        filter: `user_id=eq.${userId}`,
      }, () => {
        void queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, userId]);

  return {
    preferences,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    updatePreferences: mutation.mutateAsync,
    refresh: query.refetch,
  };
};
