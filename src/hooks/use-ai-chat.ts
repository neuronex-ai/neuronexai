import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  origin_channel?: 'panel' | 'voice' | 'whatsapp' | 'system';
  last_channel?: 'panel' | 'voice' | 'whatsapp' | 'system';
  last_message_at?: string | null;
  messages?: Array<{ id: string }>;
  context_state?: {
    source?: string | null;
    remoteJid?: string | null;
    pushName?: string | null;
    phoneNumber?: string | null;
    conversation_kind?: 'patient' | 'psychologist' | null;
  } | null;
}

export type ChatHistoryChannel = 'text' | 'voice' | 'whatsapp';

const CHAT_HISTORY_PAGE_SIZE = 48;
const CHAT_MESSAGE_RENDER_LIMIT = 160;

const SYNAPSE_CHAT_URL = edgeFunctionUrl("synapse-text-fallback");

export type SynapseProgressEvent = {
  stage?: string;
  label?: string;
  detail?: string;
  toolName?: string;
  recordsFound?: number;
  generatedAt?: string;
};

type SendChatMessageVariables = {
  message: string;
  sessionId: string;
  attachments?: any[];
  context?: any;
  streamProgress?: boolean;
  onProgress?: (event: SynapseProgressEvent) => void;
};

const parseSsePayload = (raw: string) => {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw.trim() };
  }
};

const readEventStream = async (
  response: Response,
  onProgress?: (event: SynapseProgressEvent) => void,
) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("A IA não retornou uma resposta válida. Tente novamente.");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: any = null;

  const consumeBlock = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }

    const payload = parseSsePayload(dataLines.join("\n"));
    if (!payload) return;

    if (event === "progress") onProgress?.(payload as SynapseProgressEvent);
    else if (event === "final") finalPayload = payload;
    else if (event === "error") throw new Error(payload.error || payload.message || "Falha ao processar a solicitação.");
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) consumeBlock(block);
    }

    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) consumeBlock(buffer);
      break;
    }
  }

  if (!finalPayload) throw new Error("A IA não concluiu a resposta. Tente novamente.");
  return finalPayload;
};

// --- Fetch Sessions ---
const fetchChatSessions = async (userId: string): Promise<ChatSession[]> => {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id,title,created_at,updated_at,context_state')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(160);

  if (error) throw new Error(error.message);
  return data || [];
};

export const useChatSessions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['chatSessions', user?.id],
    queryFn: () => fetchChatSessions(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};

export const useChatSessionHistory = (channel: ChatHistoryChannel, enabled = true) => {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ['chatSessionHistory', user?.id, channel],
    enabled: Boolean(user?.id && enabled),
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async ({ pageParam }) => {
      const offset = Number(pageParam || 0);
      let query = supabase
        .from('chat_sessions')
        .select('id,title,created_at,updated_at,context_state,origin_channel,last_channel,last_message_at,messages!inner(id)')
        .eq('user_id', user!.id)
        .in('messages.role', ['user', 'assistant'])
        .neq('messages.content', '')
        .limit(1, { referencedTable: 'messages' });

      query = channel === 'text'
        ? query.eq('origin_channel', 'panel')
        : query.eq('origin_channel', channel);

      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .range(offset, offset + CHAT_HISTORY_PAGE_SIZE - 1);

      if (error) throw error;

      const batch = (data || []) as ChatSession[];
      const sessions = batch.filter((session) => !session.title.startsWith('NeuroPulse Analysis'));

      return {
        sessions,
        nextOffset: offset + batch.length,
        hasMore: batch.length === CHAT_HISTORY_PAGE_SIZE,
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextOffset : undefined,
  });
};

// --- Create Session ---
const createChatSession = async (userId: string, title: string = "Nova Conversa") => {
  const safeTitle = title.trim().replace(/\s+/g, ' ').slice(0, 72) || 'Conversa com o Synapse';
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ user_id: userId, title: safeTitle })
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
      queryClient.invalidateQueries({ queryKey: ['chatSessionHistory'] });
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
      queryClient.invalidateQueries({ queryKey: ['chatSessionHistory'] });
      toast.success("Conversa excluída.");
    },
    onError: () => toast.error("Erro ao excluir conversa.")
  });
};

// --- Fetch Messages for Session ---
const fetchMessages = async (sessionId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('id,content,role,created_at,user_id,session_id,attachments')
    .eq('session_id', sessionId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(CHAT_MESSAGE_RENDER_LIMIT);

  if (error) throw new Error(error.message);
  return ((data as Message[] | null) || []).reverse();
};

export const useSessionMessages = (sessionId: string | null) => {
  return useQuery({
    queryKey: ['sessionMessages', sessionId],
    queryFn: () => fetchMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
};

// --- Send Message ---
const sendMessageToAI = async (
  message: string,
  sessionId: string,
  attachments: any[],
  context: any,
  accessToken: string,
  options: { streamProgress?: boolean; onProgress?: (event: SynapseProgressEvent) => void } = {},
) => {
  try {
    const wantsProgressStream = Boolean(options.streamProgress && options.onProgress);
    const response = await fetch(SYNAPSE_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': wantsProgressStream ? 'text/event-stream' : 'application/json',
        ...(wantsProgressStream ? { 'X-Synapse-Progress': 'stream' } : {}),
      },
      body: JSON.stringify({
        message,
        sessionId,
        attachments,
        context,
        streamProgress: wantsProgressStream,
        requestId: crypto.randomUUID(),
      }),
    });

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/event-stream")) {
      const streamedData = await readEventStream(response, options.onProgress);
      if (!response.ok || streamedData?.error) {
        throw new Error(streamedData?.error || "A IA não retornou uma resposta válida. Tente novamente.");
      }
      return streamedData;
    }

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
    mutationFn: ({ message, sessionId, attachments, context, streamProgress, onProgress }: SendChatMessageVariables) => {
      if (!accessToken) throw new Error("Sessão inválida.");
      if (!user?.id) throw new Error("Usuário não autenticado");
      return sendMessageToAI(message, sessionId, attachments || [], context || {}, accessToken, { streamProgress, onProgress });
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
