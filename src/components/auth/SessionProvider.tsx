import { useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { NeuroNexLoadingLoop } from '@/components/ui/neuronex-loading-loop';
import { AuthContext } from './SessionContextProvider';

interface SessionContextProviderProps {
  children: ReactNode;
}

export const SessionContextProvider = ({ children }: SessionContextProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    setIsLoading(false);
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  useEffect(() => {
    // 1. Obter a sessão inicial
    fetchSession();

    // 2. Monitorar mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = { session, user, isLoading, refetchUser: fetchSession, signOut };

  if (isLoading) {
    return <NeuroNexLoadingLoop surface="page" label="Carregando sessão" />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};