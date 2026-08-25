import { useState, useEffect, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { NeuroNexLoadingLoop } from '@/components/ui/neuronex-loading-loop';
import { getDesktopWelcomeStorageKey } from '@/lib/desktop-session-welcome';
import { AuthContext } from './SessionContextProvider';

interface SessionContextProviderProps {
  children: ReactNode;
}

export const SessionContextProvider = ({ children }: SessionContextProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  const fetchSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    lastUserIdRef.current = session?.user?.id ?? null;
    setSession(session);
    setUser(session?.user ?? null);
    setIsLoading(false);
  }

  const signOut = async () => {
    const userId = lastUserIdRef.current;
    await supabase.auth.signOut();
    if (userId && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(getDesktopWelcomeStorageKey(userId));
    }
    lastUserIdRef.current = null;
    setSession(null);
    setUser(null);
  };

  useEffect(() => {
    // 1. Obter a sessão inicial
    fetchSession();

    // 2. Monitorar mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && lastUserIdRef.current && typeof window !== 'undefined') {
        window.sessionStorage.removeItem(getDesktopWelcomeStorageKey(lastUserIdRef.current));
      }
      lastUserIdRef.current = session?.user?.id ?? null;
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
