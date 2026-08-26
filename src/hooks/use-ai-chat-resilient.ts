import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { Message } from "@/types";
import type { SynapseProgressEvent } from "./use-ai-chat";
import { requiresCanonicalSynapseAgent } from "@/lib/synapse-grounding-policy";
import { edgeFunctionUrl } from "@/lib/supabase-config";
import { emitSynapseTextAgentProgress } from "@/lib/synapse-text-agent-progress";

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

const SAFE_FAILURE = "Não consegui consultar os dados confirmados do sistema agora. Para proteger a precisão das informações, não vou estimar nem inventar uma resposta.";

const publishProgress = (input: SendInput, event: SynapseProgressEvent) => {
  input.onProgress?.(event);
  emitSynapseTextAgentProgress(input.sessionId, event);
};

const parseSsePayload = (raw: string) => {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw.trim() };
  }
};

const readCanonicalEventStream = async (
  response: Response,
  input: SendInput,
) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("O Synapse não retornou um fluxo de resposta válido.");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: any = null;

  const consumeBlock = (block: string) => {
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }

    const payload = parseSsePayload(dataLines.join("\n"));
    if (!payload) return;

    if (eventName === "progress") {
      publishProgress(input, payload as SynapseProgressEvent);
      return;
    }

    if (eventName === "final") {
      finalPayload = payload;
      return;
    }

    if (eventName === "error") {
      throw new Error(payload.error || payload.message || "Falha ao processar a solicitação.");
    }
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

  if (!finalPayload) {
    throw new Error("O Synapse não concluiu a resposta. Tente novamente.");
  }

  return finalPayload;
};

async function invokeCanonicalProvider(
  input: SendInput,
  accessToken: string,
) {
  if (!input.streamProgress || !input.onProgress) {
    return invokeProvider("synapse-text-fallback", input);
  }

  const response = await fetch(edgeFunctionUrl("synapse-text-fallback"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Synapse-Progress": "stream",
    },
    body: JSON.stringify({
      message: input.message,
      sessionId: input.sessionId,
      attachments: input.attachments || [],
      context: input.context || {},
      streamProgress: true,
      requestId: crypto.randomUUID(),
    }),
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const data = await readCanonicalEventStream(response, input);
    if (!response.ok || data?.error) {
      throw new Error(data?.error || "O agente principal do Synapse não respondeu corretamente.");
    }
    return data;
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    throw new Error(data?.error || "O agente principal do Synapse não respondeu corretamente.");
  }

  return data;
}

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

async function sendWithFallback(
  input: SendInput,
  accessToken: string,
) {
  try {
    // The full Synapse agent owns the canonical tool contract, confirmations
    // and grounded data access. Generic language gateways are recovery only.
    return await invokeCanonicalProvider(input, accessToken);
  } catch (canonicalAgentError) {
    console.warn("[Synapse] Agente com ferramentas indisponível.", canonicalAgentError);

    if (requiresCanonicalSynapseAgent(input.message)) {
      return {
        response: SAFE_FAILURE,
        clientAction: null,
        session_id: input.sessionId,
        provider: "system",
        model: "grounding_guard",
        grounded: false,
        retryable: true,
        toolsUsed: [],
        recordsFound: 0,
      };
    }

    try {
      return await invokeProvider("synapse-text-gateway", input);
    } catch (gatewayError) {
      console.warn("[Synapse] Gateway de recuperação indisponível.", gatewayError);
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

      publishProgress(input, {
        stage: "received",
        label: "Preparando solicitação",
        detail: "Consultando o contrato seguro de ferramentas",
      });

      try {
        const result = await sendWithFallback(input, session.access_token);

        publishProgress(input, result?.confirmationRequired
          ? {
              stage: "confirmation_required",
              label: "Aguardando confirmação",
              detail: "Revise a ação antes de confirmar",
            }
          : {
              stage: "responding",
              label: "Resposta pronta",
              detail: "Organizando o retorno do Synapse",
            });

        return result;
      } catch (error) {
        publishProgress(input, {
          stage: "error",
          label: "Não foi possível concluir",
          detail: error instanceof Error ? error.message : "Falha ao processar a solicitação.",
        });
        throw error;
      }
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
      queryClient.invalidateQueries({ queryKey: ["chatSessionHistory"] });
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
