import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type WhatsAppLabel = {
  name: string;
};

export type WAConversation = {
  id: string;
  user_id?: string | null;
  remote_jid: string;
  canonical_remote_jid?: string | null;
  remote_jid_aliases?: string[] | null;
  identity_key?: string | null;
  identity_variants?: string[] | null;
  patient_name: string | null;
  patient_phone: string;
  conversation_kind?: "patient" | "psychologist";
  synapse_session_id?: string | null;
  contact_type?: "person" | "group";
  is_group?: boolean;
  deleted_at?: string | null;
  profile_picture_url?: string | null;
  contact_about?: string | null;
  contact_status?: string | null;
  last_message_preview?: string | null;
  last_message_at: string;
  unread_count: number;
  labels?: WhatsAppLabel[] | null;
  metadata?: Record<string, any> | null;
};

export type WAMessage = {
  id: string;
  conversation_id?: string | null;
  canonical_remote_jid?: string | null;
  identity_key?: string | null;
  identity_variants?: string[] | null;
  direction: "inbound" | "outbound";
  content: string | null;
  content_type: string;
  status: string;
  sender_kind?: "patient" | "psychologist" | "synapse" | "professional" | "system";
  is_from_ai?: boolean | null;
  media_base64?: string | null;
  media_mimetype?: string | null;
  media_filename?: string | null;
  media_url?: string | null;
  media_storage_path?: string | null;
  metadata?: Record<string, any> | null;
  delivered_at?: string | null;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
};

export type WhatsAppSettings = {
  user_id: string;
  instance_name: string;
  environment: "sandbox" | "production";
  is_active: boolean;
  connection_state: string | null;
  webhook_url: string | null;
  webhook_enabled: boolean | null;
  webhook_events: string[] | null;
  psychologist_remote_jid?: string | null;
  psychologist_phone?: string | null;
  last_error?: string | null;
  settings_applied_at?: string | null;
  last_status_at: string | null;
  last_sync_at: string | null;
};

type SendMessagePayload = {
  conversationId: string;
  remoteJid: string;
  message?: string;
  triggerAI?: boolean;
  messageType?: string;
  mediaBase64?: string;
  mediaMimetype?: string;
  mediaFilename?: string;
};

type SimulateInboundPayload = {
  phone: string;
  content: string;
};

type RefreshStatusOptions = {
  silent?: boolean;
};

type SyncMessagesPayload = {
  remoteJid: string;
  silent?: boolean;
};

type SyncPanelPayload = {
  remoteJid?: string | null;
};

type WhatsAppSyncResponse = {
  count?: number;
  messages?: number;
  contacts?: number;
  labels?: number;
  waitingForHistory?: boolean;
};

export type WhatsAppConnectResponse = {
  ok?: boolean;
  connected?: boolean;
  state?: string | null;
  instanceName?: string;
  environment?: "sandbox" | "production";
  recreated?: boolean;
  connection?: {
    qr?: string | null;
    qrImageSrc?: string | null;
    code?: string | null;
    pairingCode?: string | null;
    raw?: unknown;
  } | Record<string, any>;
};

const toIso = (value: unknown) =>
  typeof value === "string" && value ? value : new Date().toISOString();

const readEdgeErrorMessage = async (error: unknown, response?: Response | null) => {
  const candidateResponse = response || ((error as { context?: Response })?.context instanceof Response ? (error as { context: Response }).context : null);

  if (candidateResponse) {
    try {
      const text = await candidateResponse.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          const message = parsed.error || parsed.message || parsed.details;
          if (typeof message === "string" && message.trim()) return message.trim();
        } catch {
          if (!/Edge Function/i.test(text)) return text;
        }
      }
    } catch {
      // Keep the fallback below when the response body is not readable.
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (message && !/Edge Function/i.test(message)) return message;
  return "Não foi possível concluir a ação no WhatsApp Business.";
};

const invokeEvolution = async <T>(action: string, body: Record<string, unknown> = {}) => {
  const { data, error, response } = await supabase.functions.invoke("neurozap-evolution", {
    body: { action, ...body },
  });
  if (error) throw new Error(await readEdgeErrorMessage(error, response));
  const result = data as { ok?: boolean; error?: unknown; message?: unknown } | null;
  if (result?.ok === false || typeof result?.error === "string") {
    const message = typeof result.error === "string" ? result.error : result.message;
    throw new Error(typeof message === "string" && message.trim() ? message.trim() : "N\u00e3o foi poss\u00edvel concluir a a\u00e7\u00e3o no WhatsApp Business.");
  }
  return data as T;
};

const normalizeConnectionQr = (connection: any) => {
  const qr =
    typeof connection?.qr === "string"
      ? connection.qr
      : typeof connection?.base64 === "string"
        ? connection.base64
        : typeof connection?.qrcode?.base64 === "string"
          ? connection.qrcode.base64
          : typeof connection?.qrcode === "string"
            ? connection.qrcode
            : typeof connection?.code === "string"
              ? connection.code
              : null;

  return {
    qr,
    qrImageSrc:
      typeof connection?.qrImageSrc === "string"
        ? connection.qrImageSrc
        : qr?.startsWith("data:")
          ? qr
          : qr && qr.length > 120 && !/^https?:\/\//i.test(qr)
            ? `data:image/png;base64,${qr}`
            : null,
  };
};

const mapConversation = (row: Record<string, any>): WAConversation => ({
  id: String(row.id),
  user_id: row.user_id ?? null,
  remote_jid: String(row.remote_jid || row.contact_phone || row.patient_phone || ""),
  canonical_remote_jid: row.canonical_remote_jid ?? null,
  remote_jid_aliases: Array.isArray(row.remote_jid_aliases) ? row.remote_jid_aliases : [],
  identity_key: row.identity_key ?? null,
  identity_variants: Array.isArray(row.identity_variants) ? row.identity_variants : [],
  patient_name: row.patient_name ?? row.contact_name ?? row.name ?? null,
  patient_phone: String(row.patient_phone || row.contact_phone || ""),
  conversation_kind: row.conversation_kind === "psychologist" ? "psychologist" : "patient",
  synapse_session_id: row.synapse_session_id ?? null,
  contact_type: row.contact_type === "group" || row.is_group ? "group" : "person",
  is_group: Boolean(row.is_group || row.contact_type === "group" || String(row.remote_jid || "").includes("@g.us")),
  deleted_at: row.deleted_at ?? null,
  profile_picture_url: row.profile_picture_url ?? row.avatar_url ?? null,
  contact_about: row.contact_about ?? null,
  contact_status: row.contact_status ?? null,
  last_message_preview: row.last_message_preview ?? row.last_message ?? null,
  last_message_at: toIso(row.last_message_at || row.updated_at || row.created_at),
  unread_count: Number(row.unread_count || 0),
  labels: Array.isArray(row.labels) ? row.labels : [],
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
});

const mapMessage = (row: Record<string, any>): WAMessage => ({
  id: String(row.id),
  conversation_id: row.conversation_id ?? null,
  canonical_remote_jid: row.canonical_remote_jid ?? null,
  identity_key: row.identity_key ?? null,
  identity_variants: Array.isArray(row.identity_variants) ? row.identity_variants : [],
  direction: row.direction === "outbound" ? "outbound" : "inbound",
  content: row.content ?? row.message ?? "",
  content_type: row.content_type ?? row.message_type ?? "text",
  status: row.status ?? "sent",
  sender_kind: row.sender_kind ?? (row.is_from_ai ? "synapse" : row.direction === "outbound" ? "professional" : "patient"),
  is_from_ai: Boolean(row.is_from_ai),
  media_base64: row.media_base64 ?? null,
  media_mimetype: row.media_mimetype ?? null,
  media_filename: row.media_filename ?? null,
  media_url: row.media_url ?? null,
  media_storage_path: row.media_storage_path ?? null,
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
  delivered_at: row.delivered_at ?? null,
  read_at: row.read_at ?? null,
  edited_at: row.edited_at ?? null,
  deleted_at: row.deleted_at ?? null,
  created_at: toIso(row.created_at),
});

export function useWhatsAppAgent() {
  const queryClient = useQueryClient();

  const invalidateSettings = () => {
    void queryClient.invalidateQueries({ queryKey: ["whatsapp-settings"] });
  };

  const invalidateConversations = () => {
    void queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
  };

  const invalidateMessages = (conversationId?: string | null) => {
    void queryClient.invalidateQueries({
      queryKey: conversationId ? ["whatsapp-messages", conversationId] : ["whatsapp-messages"],
    });
  };

  const useRealtime = (activeConversationId?: string | null, enabled = true) => {
    useEffect(() => {
      if (!enabled) return;
      let cancelled = false;
      let fallbackTimer: ReturnType<typeof setInterval> | undefined;
      let channel: ReturnType<typeof supabase.channel> | undefined;

      const refreshActiveData = () => {
        invalidateSettings();
        invalidateConversations();
        invalidateMessages(activeConversationId);
      };

      const startFallbackPolling = () => {
        if (fallbackTimer) return;
        fallbackTimer = setInterval(refreshActiveData, 15000);
      };

      const stopFallbackPolling = () => {
        if (!fallbackTimer) return;
        clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      };

      supabase.auth
        .getUser()
        .then(({ data }) => {
          const userId = data.user?.id;
          if (cancelled || !userId) return;

          channel = supabase
            .channel(`neurozap:${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "whatsapp_settings", filter: `user_id=eq.${userId}` },
              () => invalidateSettings(),
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "whatsapp_conversations", filter: `user_id=eq.${userId}` },
              () => {
                invalidateConversations();
                invalidateMessages(activeConversationId);
              },
            )
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "whatsapp_messages", filter: `user_id=eq.${userId}` },
              () => {
                invalidateConversations();
                invalidateMessages(activeConversationId);
              },
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                stopFallbackPolling();
                refreshActiveData();
              }
              if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
                startFallbackPolling();
              }
            });
        })
        .catch(() => startFallbackPolling());

      return () => {
        cancelled = true;
        stopFallbackPolling();
        if (channel) supabase.removeChannel(channel);
      };
    }, [activeConversationId, enabled]);
  };

  const useSettings = () =>
    useQuery<WhatsAppSettings | null>({
      queryKey: ["whatsapp-settings"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("whatsapp_settings")
          .select("*")
          .maybeSingle();
        if (error) throw error;
        return (data as WhatsAppSettings | null) ?? null;
      },
    });

  const useConversations = (enabled = true) =>
    useQuery<WAConversation[]>({
      queryKey: ["whatsapp-conversations"],
      enabled,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .is("deleted_at", null)
          .order("last_message_at", { ascending: false });

        if (error) throw error;
        return (data || []).map((row) => mapConversation(row as Record<string, any>));
      },
    });

  const useMessages = (conversationId?: string, remoteJid?: string, enabled = true) =>
    useQuery<WAMessage[]>({
      queryKey: ["whatsapp-messages", conversationId, remoteJid],
      enabled: enabled && Boolean(conversationId || remoteJid),
      queryFn: async () => {
        if (conversationId) {
          const { data, error } = await supabase
            .from("whatsapp_messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

          if (error) throw error;
          if (data?.length) return data.map((row) => mapMessage(row as Record<string, any>));
        }

        if (!remoteJid) return [];

        const { data, error } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .or(`remote_jid.eq.${remoteJid},canonical_remote_jid.eq.${remoteJid}`)
          .order("created_at", { ascending: true });

        if (error) throw error;
        return (data || []).map((row) => mapMessage(row as Record<string, any>));
      },
    });

  const refreshStatus = useMutation({
    mutationFn: async (_options?: RefreshStatusOptions) => invokeEvolution("status"),
    onSuccess: () => invalidateSettings(),
    onError: (error, options) => {
      if (options?.silent) {
        console.warn("[NeuroZap] status refresh failed", error);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o WhatsApp Business.");
    },
  });

  const connect = useMutation({
    mutationFn: async () => invokeEvolution<WhatsAppConnectResponse>("connect"),
    onSuccess: (data) => {
      const { qr } = normalizeConnectionQr(data?.connection);
      if (qr && /^https?:\/\//.test(qr)) window.open(qr, "_blank", "noopener,noreferrer");
      toast.success("Conexão do WhatsApp Business iniciada.");
      invalidateSettings();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => invokeEvolution("logout"),
    onSuccess: () => {
      invalidateSettings();
      invalidateConversations();
      invalidateMessages();
      toast.success("WhatsApp Business desconectado.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível desconectar o WhatsApp Business.");
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      if ((payload.messageType || "text") !== "text" || payload.mediaBase64) {
        throw new Error("Envio de mídia entra na próxima etapa do NeuroZap.");
      }
      return invokeEvolution("sendText", {
        conversationId: payload.conversationId,
        remoteJid: payload.remoteJid,
        text: payload.message,
        triggerAI: payload.triggerAI,
      });
    },
    onSuccess: (_data, variables) => {
      invalidateMessages(variables.conversationId);
      invalidateConversations();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    },
  });

  const simulateInbound = useMutation({
    mutationFn: async (_payload: SimulateInboundPayload) => {
      throw new Error("Simulador local removido nesta versão real do WhatsApp Business.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível simular a mensagem.");
    },
  });

  const fullSync = useMutation({
    mutationFn: async () => invokeEvolution<WhatsAppSyncResponse>("syncConversations"),
    onSuccess: (data) => {
      invalidateConversations();
      invalidateSettings();
      if (data?.waitingForHistory) {
        toast.info("WhatsApp conectado. O histórico ainda está sendo disponibilizado pela conexão.");
        return;
      }
      toast.success(`${Number(data?.count || 0)} conversas e ${Number(data?.messages || 0)} mensagens sincronizadas.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível sincronizar o WhatsApp agora.");
    },
  });

  const syncPanel = useMutation({
    mutationFn: async (payload?: SyncPanelPayload) => {
      const status = await invokeEvolution("status").catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : "status_failed",
      }));
      const sync = await invokeEvolution<WhatsAppSyncResponse>("syncConversations");
      const selectedMessages = payload?.remoteJid
        ? await invokeEvolution<{ count?: number }>("syncMessages", { remoteJid: payload.remoteJid })
        : null;

      return {
        status,
        sync,
        selectedMessages,
      };
    },
    onSuccess: (data, variables) => {
      invalidateSettings();
      invalidateConversations();
      invalidateMessages();
      if (variables?.remoteJid) invalidateMessages(variables.remoteJid);

      if (data.sync?.waitingForHistory) {
        toast.info("WhatsApp conectado. O hist\u00f3rico ainda est\u00e1 sendo disponibilizado pela conex\u00e3o.");
        return;
      }

      const conversationCount = Number(data.sync?.count || 0);
      const messageCount = Number(data.sync?.messages || 0) + Number(data.selectedMessages?.count || 0);
      toast.success(`${conversationCount} conversas e ${messageCount} mensagens atualizadas.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel atualizar o painel do NeuroZap.");
    },
  });

  const syncMessages = useMutation({
    mutationFn: async ({ remoteJid }: SyncMessagesPayload) =>
      invokeEvolution<{ count?: number }>("syncMessages", { remoteJid }),
    onSuccess: () => {
      invalidateConversations();
      invalidateMessages();
    },
    onError: (error, variables) => {
      if (variables?.silent) {
        console.warn("[NeuroZap] message sync failed", error);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar as mensagens.");
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: (_data, conversationId) => {
      invalidateMessages(conversationId);
      invalidateConversations();
    },
  });

  return {
    useSettings,
    useConversations,
    useMessages,
    useRealtime,
    refreshStatus,
    connect,
    disconnect,
    sendMessage,
    simulateInbound,
    fullSync,
    syncPanel,
    syncMessages,
    markAsRead,
  };
}
