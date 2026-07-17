import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { hasActivePushSubscription, listenForForegroundPush } from '@/lib/push-notifications';
import { setPwaBadge } from '@/lib/pwa-integrations';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

export type NotificationCategory = 'dashboard' | 'agenda' | 'prontuario' | 'teleconsulta' | 'neurodrive' | 'financeiro' | 'synapse' | 'ajustes' | 'seguranca' | 'sistema';
export type NotificationSeverity = 'success' | 'info' | 'warning' | 'destructive';
export type AppNotification = { id: string; userId: string; eventId: string | null; type: string; category: NotificationCategory; severity: NotificationSeverity; title: string; message: string; actionUrl: string | null; metadata: Record<string, unknown>; priority: string; createdAt: string; updatedAt: string | null; readAt: string | null; dismissedAt: string | null; isRead: boolean };
type Row = { id: string; user_id: string; event_id: string | null; type: string; category: string | null; severity: string | null; title: string; message: string; action_url: string | null; data: Record<string, unknown> | null; payload: Record<string, unknown> | null; priority: string | null; created_at: string | null; updated_at: string | null; read: boolean | null; read_at: string | null; dismissed_at: string | null };
type UseNotificationsOptions = { enableRealtime?: boolean; syncBadge?: boolean };

const EMPTY_NOTIFICATIONS: AppNotification[] = [];
const recentlyDismissed = new Map<string, AppNotification>();

const category = (value?: string | null): NotificationCategory => {
  const item = value?.toLowerCase();
  if (item === 'dashboard' || item === 'agenda' || item === 'prontuario' || item === 'teleconsulta' || item === 'neurodrive' || item === 'financeiro' || item === 'synapse' || item === 'ajustes') return item;
  if (item === 'pacientes') return 'prontuario';
  if (item === 'clinica' || item === 'clínica') return 'sistema';
  if (item === 'seguranca' || item === 'segurança') return 'seguranca';
  return 'sistema';
};

const severity = (value?: string | null): NotificationSeverity => value === 'success' || value === 'warning' || value === 'destructive' ? value : 'info';

const map = (row: Row): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  eventId: row.event_id,
  type: row.type,
  category: category(row.category || String(row.data?.category || '')),
  severity: severity(row.severity || String(row.data?.severity || row.priority || '')),
  title: row.title,
  message: row.message,
  actionUrl: row.action_url,
  metadata: { ...(row.payload || {}), ...(row.data || {}) },
  priority: row.priority || 'normal',
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at,
  readAt: row.read_at,
  dismissedAt: row.dismissed_at,
  isRead: Boolean(row.read || row.read_at),
});

export const useNotifications = ({ enableRealtime = false, syncBadge = false }: UseNotificationsOptions = {}) => {
  const { user } = useAuth();
  const { settings } = useNotificationSettings();
  const userId = user?.id;
  const client = useQueryClient();
  const key = useMemo(() => ['notifications', userId] as const, [userId]);
  const query = useQuery({ queryKey: key, enabled: Boolean(userId), staleTime: 30_000, queryFn: async () => {
    const result = await supabase.from('notifications').select('id,user_id,event_id,type,category,severity,title,message,action_url,data,payload,priority,created_at,updated_at,read,read_at,dismissed_at').eq('user_id', userId!).is('dismissed_at', null).order('created_at', { ascending: false }).limit(150);
    if (result.error) throw result.error;
    return (result.data || []).map((row) => map(row as Row));
  }});
  const invalidate = useCallback(() => { void client.invalidateQueries({ queryKey: key }); }, [client, key]);
  const updateCachedNotifications = useCallback(
    (updater: (current: AppNotification[]) => AppNotification[]) => {
      client.setQueryData<AppNotification[]>(key, (current) => updater(current || EMPTY_NOTIFICATIONS));
    },
    [client, key],
  );

  useEffect(() => {
    if (!userId || !enableRealtime) return;
    const channel = supabase.channel(`notifications:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      const row = payload.new as Row | undefined;
      const previousId = String((payload.old as Partial<Row> | null)?.id || '');

      if (payload.eventType === 'DELETE') {
        updateCachedNotifications((current) => current.filter((item) => item.id !== previousId));
        return;
      }

      if (row?.id) {
        const item = map(row);
        updateCachedNotifications((current) => {
          const withoutCurrent = current.filter((candidate) => candidate.id !== item.id);
          if (item.dismissedAt) return withoutCurrent;
          return [item, ...withoutCurrent].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        });
      }

      if (payload.eventType === 'INSERT') {
        const item = map(payload.new as Row);
        toast(item.title, { description: item.message, action: item.actionUrl ? { label: 'Abrir', onClick: () => { window.location.href = item.actionUrl!; } } : undefined });
      }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enableRealtime, updateCachedNotifications, userId]);

  useEffect(() => {
    if (!enableRealtime || !userId || !settings?.push_enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void hasActivePushSubscription(userId).then((active) => {
      if (!active || cancelled) return undefined;
      return listenForForegroundPush((title, body, actionUrl) => toast(title, { description: body, action: actionUrl ? { label: 'Abrir', onClick: () => { window.location.href = actionUrl; } } : undefined }));
    }).then((unsubscribe) => {
      if (!unsubscribe) return;
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    }).catch((error) => {
      console.error('[push:foreground-listener]', error);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enableRealtime, settings?.push_enabled, userId]);

  const update = (values: Record<string, unknown>) => async (id?: string) => {
    if (!userId) return;
    let request = supabase.from('notifications').update(values).eq('user_id', userId);
    if (id) request = request.eq('id', id);
    const result = await request;
    if (result.error) throw result.error;
  };
  const markRead = useMutation({
    mutationFn: (id: string) => update({ read: true, read_at: new Date().toISOString() })(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AppNotification[]>(key);
      updateCachedNotifications((current) => current.map((item) => item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item));
      return { previous };
    },
    onError: (_error, _id, context) => client.setQueryData(key, context?.previous),
  });
  const markAll = useMutation({
    mutationFn: () => update({ read: true, read_at: new Date().toISOString() })(),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AppNotification[]>(key);
      const readAt = new Date().toISOString();
      updateCachedNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt })));
      return { previous };
    },
    onError: (_error, _variables, context) => client.setQueryData(key, context?.previous),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => update({ dismissed_at: new Date().toISOString() })(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AppNotification[]>(key);
      const dismissedItem = previous?.find((item) => item.id === id);
      if (dismissedItem) recentlyDismissed.set(id, dismissedItem);
      updateCachedNotifications((current) => current.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (_error, _id, context) => client.setQueryData(key, context?.previous),
  });
  const dismissAll = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const dismissedAt = new Date().toISOString();
      const result = await supabase
        .from('notifications')
        .update({ dismissed_at: dismissedAt })
        .eq('user_id', userId)
        .is('dismissed_at', null);
      if (result.error) throw result.error;
    },
    onMutate: async () => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AppNotification[]>(key);
      updateCachedNotifications(() => EMPTY_NOTIFICATIONS);
      return { previous };
    },
    onSuccess: invalidate,
    onError: (_error, _variables, context) => client.setQueryData(key, context?.previous),
  });
  const restore = useMutation({
    mutationFn: (id: string) => update({ dismissed_at: null })(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AppNotification[]>(key);
      const restoredItem = recentlyDismissed.get(id);
      if (restoredItem) {
        updateCachedNotifications((current) => [restoredItem, ...current].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
      }
      return { previous, restoredItem };
    },
    onSuccess: (_data, id, context) => {
      recentlyDismissed.delete(id);
      if (!context?.restoredItem) invalidate();
    },
    onError: (_error, _id, context) => client.setQueryData(key, context?.previous),
  });
  const notifications = query.data || EMPTY_NOTIFICATIONS;
  const unreadCount = useMemo(() => notifications.reduce((count, item) => count + (item.isRead ? 0 : 1), 0), [notifications]);

  useEffect(() => {
    if (syncBadge) void setPwaBadge(unreadCount);
  }, [syncBadge, unreadCount]);

  return { ...query, notifications, unreadCount, markAsRead: markRead.mutateAsync, markAllAsRead: markAll.mutateAsync, dismiss: dismiss.mutateAsync, dismissAll: dismissAll.mutateAsync, restore: restore.mutateAsync, isMutating: markRead.isPending || markAll.isPending || dismiss.isPending || dismissAll.isPending || restore.isPending, refresh: query.refetch };
};

export const useUnreadNotificationCount = () => {
  const { unreadCount, isLoading } = useNotifications({ enableRealtime: true, syncBadge: true });
  return { unreadCount, isLoading };
};
