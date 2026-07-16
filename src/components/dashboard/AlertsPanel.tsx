import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type AppNotification, type NotificationCategory } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  CircleDollarSign,
  FileText,
  FolderOpen,
  Info,
  LayoutDashboard,
  Loader2,
  ListFilter,
  Settings,
  Shield,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { polishPortugueseUiText } from '@/lib/portuguese-ui-text';

type NotificationFilter = 'all' | NotificationCategory;
const NOTIFICATION_PAGE_SIZE = 30;

const filters: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'dashboard', label: 'Painel' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'prontuario', label: 'Prontuário' },
  { value: 'teleconsulta', label: 'Teleconsulta' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'neurodrive', label: 'NeuroDrive' },
  { value: 'synapse', label: 'Synapse' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'sistema', label: 'Sistema' },
];

const categoryLabel: Record<NotificationCategory, string> = {
  dashboard: 'Painel',
  agenda: 'Agenda',
  prontuario: 'Prontuário',
  teleconsulta: 'Teleconsulta',
  neurodrive: 'NeuroDrive',
  financeiro: 'Financeiro',
  synapse: 'Synapse',
  ajustes: 'Ajustes',
  seguranca: 'Segurança',
  sistema: 'Sistema',
};

const groupLabel = (dateValue: string) => {
  const date = new Date(dateValue);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "dd 'de' MMMM", { locale: ptBR });
};

const timeLabel = (dateValue: string) => format(new Date(dateValue), 'HH:mm');

const NotificationIcon = ({ notification }: { notification: AppNotification }) => {
  if (notification.severity === 'success') return <CheckCheck className="h-4 w-4" />;
  if (notification.severity === 'warning') return <AlertTriangle className="h-4 w-4" />;
  if (notification.severity === 'destructive') return <AlertCircle className="h-4 w-4" />;
  if (notification.category === 'dashboard') return <LayoutDashboard className="h-4 w-4" />;
  if (notification.category === 'agenda') return <CalendarDays className="h-4 w-4" />;
  if (notification.category === 'financeiro') return <CircleDollarSign className="h-4 w-4" />;
  if (notification.category === 'prontuario') return <FileText className="h-4 w-4" />;
  if (notification.category === 'teleconsulta') return <Video className="h-4 w-4" />;
  if (notification.category === 'neurodrive') return <FolderOpen className="h-4 w-4" />;
  if (notification.category === 'synapse') return <Sparkles className="h-4 w-4" />;
  if (notification.category === 'ajustes') return <Settings className="h-4 w-4" />;
  if (notification.category === 'seguranca') return <Shield className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
};

const financeTag = (notification: AppNotification) => {
  if (notification.category !== 'financeiro') return null;
  const scope = String(notification.metadata.financeScope || notification.metadata.finance_scope || '').toLowerCase();
  if (scope === 'neurofinance') return 'NeuroFinance';
  if (scope === 'gestao' || scope === 'gestao_financeira') return 'Gestão';
  return null;
};

export const AlertsPanel = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    dismiss,
    restore,
    isMutating,
  } = useNotifications({ enableRealtime: false, syncBadge: false });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [visibleCount, setVisibleCount] = useState(NOTIFICATION_PAGE_SIZE);
  const [isFilterPending, startFilterTransition] = useTransition();

  useEffect(() => {
    setVisibleCount(NOTIFICATION_PAGE_SIZE);
  }, [filter]);

  const filteredNotifications = useMemo(() => {
    return filter === 'all'
      ? notifications
      : notifications.filter((notification) => notification.category === filter);
  }, [filter, notifications]);

  const visibleNotifications = useMemo(
    () => filteredNotifications.slice(0, visibleCount),
    [filteredNotifications, visibleCount],
  );

  const hasMoreNotifications = filteredNotifications.length > visibleNotifications.length;
  const activeFilterLabel = filters.find((item) => item.value === filter)?.label || 'Todas';

  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, AppNotification[]>();
    visibleNotifications.forEach((notification) => {
      const label = groupLabel(notification.createdAt);
      const existing = groups.get(label);
      if (existing) existing.push(notification);
      else groups.set(label, [notification]);
    });
    return Array.from(groups.entries());
  }, [visibleNotifications]);

  const handleRead = useCallback(async (notification: AppNotification) => {
    if (!notification.isRead) await markAsRead(notification.id);
  }, [markAsRead]);

  const handleAction = useCallback(async (notification: AppNotification) => {
    await handleRead(notification);
    if (notification.actionUrl) navigate(notification.actionUrl);
  }, [handleRead, navigate]);

  const handleDismiss = useCallback(async (notification: AppNotification) => {
    await dismiss(notification.id);
    toast.success('Notificação dispensada', {
      action: {
        label: 'Desfazer',
        onClick: () => void restore(notification.id),
      },
    });
  }, [dismiss, restore]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-transparent">
      <header className="notification-panel-header sticky top-0 z-20 border-b border-border/35 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground">Central persistente</p>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <h3 className="text-[17px] font-black tracking-[-0.035em] text-foreground">Notificações</h3>
              <p className="text-[10px] font-medium text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Tudo em dia'}
              </p>
            </div>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={() => void markAllAsRead()}
              className="h-9 rounded-xl border-border/45 px-3 text-[8px] font-black uppercase tracking-[0.12em]"
            >
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Ler todas
            </Button>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-[13px] bg-muted/45 px-3 py-1.5">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">Filtro</p>
            <p className="mt-0.5 truncate text-xs font-black text-foreground">{activeFilterLabel}</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-[11px] border-0 bg-background/70"
                aria-label="Filtrar notificações"
              >
                <ListFilter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-64 rounded-2xl border-border/60 p-2 shadow-2xl">
              <div className="space-y-1">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => startFilterTransition(() => setFilter(item.value))}
                    className={cn(
                      'flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-left text-[10px] font-black uppercase tracking-[0.12em] transition-colors',
                      filter === item.value
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {item.label}
                    {filter === item.value ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className={cn('notification-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]', isMobile ? 'px-4 pb-24 pt-4' : 'px-3 pb-4 pt-3')}>
        <motion.div
          key={filter}
          initial={reduceMotion ? false : { opacity: 0, x: 3 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          aria-busy={isFilterPending}
        >
          {groupedNotifications.length > 0 ? (
            groupedNotifications.map(([label, items]) => (
              <section
                key={label}
                className="mb-4"
              >
                <p className="mb-2 px-2 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
                <div className="space-y-2">
                  {items.map((notification) => (
                    <article
                      key={notification.id}
                      className={cn(
                        'notification-card desktop-tactile group relative overflow-hidden rounded-[18px] border p-3',
                        notification.isRead
                          ? 'border-border/35 bg-card/55'
                          : 'border-foreground/15 bg-card shadow-md',
                      )}
                    >
                      {!notification.isRead ? <span className="absolute left-0 top-6 h-8 w-1 rounded-r-full bg-foreground" /> : null}
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'patient-status-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]',
                            notification.severity === 'destructive'
                              ? 'bg-rose-500/10 text-rose-500'
                              : notification.severity === 'warning'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                                : notification.severity === 'success'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                  : 'bg-muted/55 text-muted-foreground',
                          )}
                        >
                          <NotificationIcon notification={notification} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">{categoryLabel[notification.category]}</p>
                                {financeTag(notification) ? (
                                  <span className="rounded-md border border-border/45 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                                    {financeTag(notification)}
                                  </span>
                                ) : null}
                              </div>
                              <h4 className="mt-1 text-sm font-black leading-tight tracking-[-0.02em] text-foreground">{polishPortugueseUiText(notification.title)}</h4>
                            </div>
                            <span className="shrink-0 text-[9px] font-bold text-muted-foreground">{timeLabel(notification.createdAt)}</span>
                          </div>
                          <p className="mt-1.5 text-xs font-medium leading-relaxed text-muted-foreground">{polishPortugueseUiText(notification.message)}</p>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            {notification.actionUrl ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleAction(notification)}
                                className="h-9 rounded-xl px-4 text-[8px] font-black uppercase tracking-[0.12em]"
                              >
                                Abrir
                                <ArrowRight className="ml-2 h-3.5 w-3.5" />
                              </Button>
                            ) : <span />}

                            <div className="flex items-center gap-1">
                              {!notification.isRead ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void handleRead(notification)}
                                  className="h-9 w-9 rounded-xl text-muted-foreground"
                                  aria-label="Marcar como lida"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => void handleDismiss(notification)}
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-rose-500"
                                aria-label="Dispensar notificação"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-border/35 bg-muted/45 dark:border-zinc-800/80">
                <Shield className="h-10 w-10 text-muted-foreground/35" strokeWidth={1.2} />
              </div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Nenhuma notificação</p>
              <p className="mt-2 max-w-xs text-xs font-medium leading-relaxed text-muted-foreground/75">
                Não há itens nesta categoria. Leitura e descarte permanecem sincronizados entre dispositivos.
              </p>
            </div>
          )}
        </motion.div>
        {hasMoreNotifications ? (
          <div className="px-2 pb-4 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleCount((current) => current + NOTIFICATION_PAGE_SIZE)}
              className="h-11 w-full rounded-2xl border-border/60 text-[10px] font-black uppercase tracking-[0.14em]"
            >
              Mostrar mais
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
