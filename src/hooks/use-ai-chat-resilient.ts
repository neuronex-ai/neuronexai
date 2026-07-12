import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { Message } from "@/types";
import type { SynapseProgressEvent } from "./use-ai-chat";

export {
  useChatSessionHistory,
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useSessionMessages,
} from "./use-ai-chat";

export type { ChatHistoryChannel } from "./use-ai-chat";

interface SendInput {
  message: string;
  sessionId: string;
  attachments?: unknown[];
  context?: Record<string, unknown>;
  streamProgress?: boolean;
  onProgress?: (event: SynapseProgressEvent) => void;
}

const INTERNAL_DATA = /\b(paciente|pacientes|consulta|consultas|agenda|agendamento|horário|horario|prontuário|prontuario|sessão|sessao|financeiro|saldo|receita|despesa|lançamento|lancamento|transação|transacao|nota|notas|documento|arquivo|medicação|medicacao|risco|cobrança|cobranca|fatura|neurofinance|neuroscan|teleconsulta|neuronotes|configuração|configuracao|integração|integracao|dashboard|synapse)\b/i;
const SAFE_FAILURE = "Não consegui consultar os dados confirmados do sistema agora. Para proteger a precisão das informações, não vou estimar nem inventar uma resposta.";

async function invokeProvider(name: string, input: SendInput) {
  const { data, error } = await supabase.functions.invoke(name, {
    body: {
      message: input.message,
      sessionId: input.sessionId,
      attachments: input.attachments || [],
      context: input.context || {},
    },
  });

  if (error || data?.error) {
    throw new Error(data?.error || error?.message || "O provedor não respondeu corretamente.");
  }

  const hasText = typeof data?.response === "string" && data.response.trim().length > 0;
  if (!hasText && !data?.clientAction) {
    throw new Error("O provedor retornou uma resposta vazia.");
  }

  return data;
}

async function sendWithFallback(input: SendInput) {
  try {
    // The full Synapse agent owns the canonical tool contract, confirmations
    // and grounded data access. Generic language gateways are recovery only.
    return await invokeProvider("synapse-text-fallback", input);
  } catch (canonicalAgentError) {
    console.warn("[Synapse] Agente com ferramentas indisponível.", canonicalAgentError);

    try {
      return await invokeProvider("synapse-text-gateway", input);
    } catch (gatewayError) {
      console.warn("[Synapse] Gateway de recuperação indisponível.", gatewayError);
    }

    if (INTERNAL_DATA.test(input.message)) {
      return {
        response: SAFE_FAILURE,
        clientAction: null,
        session_id: input.sessionId,
        provider: "system",
        model: "grounding_guard",
        grounded: false,
        toolsUsed: [],
        recordsFound: 0,
      };
    }

    return invokeProvider("gemini-text-chat", input);
  }
}

export const useSendChatMessage = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();

  return useMutation({
    mutationFn: async (input: SendInput) => {
      if (!session?.access_token) throw new Error("Sessão inválida.");
      input.onProgress?.({
        stage: "received",
        label: "Preparando solicitação",
        detail: "Consultando o contrato seguro de ferramentas",
      });
      const result = await sendWithFallback(input);
      input.onProgress?.({
        stage: "responding",
        label: result?.confirmationRequired ? "Aguardando confirmação" : "Resposta pronta",
        detail: result?.confirmationRequired
          ? "Revise a ação antes de confirmar"
          : "Organizando o retorno do Synapse",
      });
      return result;
    },
    onMutate: async ({ message, sessionId }) => {
      await queryClient.cancelQueries({ queryKey: ["sessionMessages", sessionId] });
      const previousMessages = queryClient.getQueryData<Message[]>(["sessionMessages", sessionId]);
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: message,
        role: "user",
        created_at: new Date().toISOString(),
        user_id: user?.id || "",
        session_id: sessionId,
      };

      queryClient.setQueryData(
        ["sessionMessages", sessionId],
        previousMessages ? [...previousMessages, optimisticMessage] : [optimisticMessage],
      );
      return { previousMessages };
    },
    onSuccess: (data, variables) => {
      if (typeof data.response === "string") {
        const assistantMessage: Message = {
          id: `ai-${Date.now()}`,
          content: data.response || "...",
          role: "assistant",
          created_at: new Date().toISOString(),
          user_id: user?.id || "",
          session_id: variables.sessionId,
        };
        queryClient.setQueryData(
          ["sessionMessages", variables.sessionId],
          (old: Message[] | undefined) => old ? [...old, assistantMessage] : [assistantMessage],
        );
      }
      queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
    },
    onError: (error, variables, mutationContext) => {
      toast.error(`Erro: ${error.message}`);
      if (mutationContext?.previousMessages) {
        queryClient.setQueryData(
          ["sessionMessages", variables.sessionId],
          mutationContext.previousMessages,
        );
      }
    },
  });
};
