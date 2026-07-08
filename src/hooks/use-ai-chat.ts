import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { toast } from 'sonner';
import { Message } from '@/types';
import { edgeFunctionUrl } from '@/lib/supabase-config';

// --- Types ---
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const GEMINI_CHAT_URL = edgeFunctionUrl("gemini-text-chat");

// --- Fetch Sessions ---
const fetchChatSessions = async (userId: string): Promise<ChatSession[]> => {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};

export const useChatSessions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['chatSessions', user?.id],
    queryFn: () => fetchChatSessions(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
};

// --- Create Session ---
const createChatSession = async (userId: string, title: string = "Nova Conversa") => {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, title })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

export const useCreateChatSession = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (title?: string) => {
      if (!user) throw new Error("Usuário não autenticado");
      return createChatSession(user.id, title);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    }
  });
};

// --- Delete Session ---
const deleteChatSession = async (sessionId: string) => {
  // Cascate delete handled by DB usually, but explicit delete messages if needed
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw new Error(error.message);
};

export const useDeleteChatSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      toast.success("Conversa excluída.");
    },
    onError: () => toast.error("Erro ao excluir conversa.")
  });
};

// --- Fetch Messages for Session ---
const fetchMessages = async (sessionId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data as Message[] || [];
};

export const useSessionMessages = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: () => fetchMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh data when switching sessions to ensure history is visible
    refetchOnWindowFocus: false,
  });
};

// --- Send Message ---
const sendMessageToAI = async (message: string, sessionId: string, attachments: any[], context: any, accessToken: string) => {
  try {
    const response = await fetch(GEMINI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, sessionId, attachments, context }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Non-JSON response from Chat AI:", text);
      throw new Error("A IA não retornou uma resposta válida. Tente novamente.");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "A IA não retornou uma resposta válida. Tente novamente.");
    }

    // Allow empty text response when a clientAction is present (e.g., widget/navigation)
    const hasValidResponse = typeof data.response === 'string' && data.response.trim() !== "";
    if (!hasValidResponse && !data.clientAction) {
      console.error("Invalid AI response payload:", data);
      data.response = "Erro: A IA não retornou uma resposta válida. Tente novamente.";
    }

    return data;
  } catch (error: any) {
    console.error("Error in sendMessageToAI:", error);
    throw error;
  }
};

export const useSendChatMessage = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: ({ message, sessionId, attachments, context }: { message: string, sessionId: string, attachments?: any[], context?: any }) => {
      if (!accessToken) throw new Error("Sessão inválida.");
      if (!user?.id) throw new Error("UsuÃ¡rio nÃ£o autenticado");
      return sendMessageToAI(message, sessionId, attachments || [], context || {}, accessToken);
    },
    onMutate: async ({ message, sessionId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sessionMessages', sessionId] });
      const previousMessages = queryClient.getQueryData<Message[]>(['sessionMessages', sessionId]);

      if (message) {
        const optimisticMessage: Message = {
          id: 'temp-' + Date.now(),
          content: message,
          role: 'user',
          created_at: new Date().toISOString(),
          user_id: user?.id || '',
          session_id: sessionId
        };

        if (previousMessages) {
          queryClient.setQueryData(['sessionMessages', sessionId], [...previousMessages, optimisticMessage]);
        } else {
          queryClient.setQueryData(['sessionMessages', sessionId], [optimisticMessage]);
        }
      }

      return { previousMessages };
    },
    onSuccess: (data, variables) => {
      // Em vez de invalidar imediatamente, podemos inserir a resposta manualmente para ser mais fluido
      console.log("AI Response Data:", data);

      // Handle response even if empty string (might be accompanied by action)
      if (typeof data.response === 'string') {
        const aiMessage: Message = {
          id: 'ai-' + Date.now(),
          content: data.response || "...", // Fallback to ellipsis if truly empty
          role: 'assistant',
          created_at: new Date().toISOString(),
          user_id: user?.id || '',
          session_id: variables.sessionId
        };

        queryClient.setQueryData(['sessionMessages', variables.sessionId], (old: Message[] | undefined) => {
          return old ? [...old, aiMessage] : [aiMessage];
        });
      }

      if (data.grounded) {
        queryClient.invalidateQueries({ queryKey: ['sessionMessages', variables.sessionId] });
      }

      // Invalida em background para garantir consistência após um delay
      /*
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['sessionMessages', variables.sessionId] });
      }, 1000);
      */


      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
    onError: (error, variables, context) => {
      toast.error(`Erro: ${error.message}`);
      if (context?.previousMessages) {
        queryClient.setQueryData(['sessionMessages', variables.sessionId], context.previousMessages);
      }
    },
  });
};
