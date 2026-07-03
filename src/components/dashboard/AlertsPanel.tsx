import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type AppNotification, type NotificationCategory } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
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
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

type NotificationFilter = 'all' | NotificationCategory;
const NOTIFICATION_PAGE_SIZE = 30;

const filters: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'dashboard', label: 'Painel' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'prontuario', label: 'Prontuario' },
  { value: 'teleconsulta', label: 'Teleconsulta' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'neurodrive', label: 'NeuroDrive' },
  { value: 'synapse', label: 'Synapse' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'seguranca', label: 'Seguranca' },
  { value: 'sistema', label: 'Sistema' },
];

const categoryLabel: Record<NotificationCategory, string> = {
  dashboard: 'Painel',
  agenda: 'Agenda',
  prontuario: 'Prontuario',
  teleconsulta: 'Teleconsulta',
  neurodrive: 'NeuroDrive',
  financeiro: 'Financeiro',
  synapse: 'Synapse',
  ajustes: 'Ajustes',
  seguranca: 'Seguranca',
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
  if (scope === 'gestao' || scope === 'gestao_financeira') return 'Gestao';
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
  } = useNotifications();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [visibleCount, setVisibleCount] = useState(NOTIFICATION_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(NOTIFICATION_PAGE_SIZE);
  }, [filter, notifications.length]);

  const filteredNotifications = useMemo(() => {
    const sorted = [...notifications].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    return filter === 'all'
      ? sorted
      : sorted.filter((notification) => notification.category === filter);
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
      groups.set(label, [...(groups.get(label) || []), notification]);
    });
    return Array.from(groups.entries());
  }, [visibleNotifications]);

  const handleRead = async (notification: AppNotification) => {
    if (!notification.isRead) await markAsRead(notification.id);
  };

  const handleAction = async (notification: AppNotification) => {
    await handleRead(notification);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const handleDismiss = async (notification: AppNotification) => {
    await dismiss(notification.id);
    toast.success('Notificação dispensada', {
      action: {
        label: 'Desfazer',
        onClick: () => void restore(notification.id),
      },
    });
  };

  const handleDragEnd = (notification: AppNotification, info: PanInfo) => {
    if (info.offset.x <= -85) void handleDismiss(notification);
    if (info.offset.x >= 85) void handleRead(notification);
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-transparent">
      <header className="sticky top-0 z-20 border-b border-border/35 bg-background/92 px-5 pb-4 pt-6 backdrop-blur-2xl dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Central persistente</p>
            </div>
            <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-foreground">Notificações</h3>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Tudo em dia'}
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isMutating}
              onClick={() => void markAllAsRead()}
              className="h-9 rounded-xl border-border/45 px-3 text-[8px] font-black uppercase tracking-[0.12em] dark:border-white/10"
            >
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Ler todas
            </Button>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border/35 bg-muted/45 px-3 py-2 dark:border-white/8">
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
                className="h-10 w-10 rounded-xl border-border/50 bg-background/70"
                aria-label="Filtrar notificacoes"
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
                    onClick={() => setFilter(item.value)}
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

      <div className={cn('min-h-0 flex-1 overflow-y-auto custom-scrollbar', isMobile ? 'px-4 pb-24 pt-4' : 'px-4 pb-5 pt-4')}>
        <AnimatePresence mode="popLayout">
          {groupedNotifications.length > 0 ? (
            groupedNotifications.map(([label, items]) => (
              <motion.section
                key={label}
                layout
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
                className="mb-6"
              >
                <p className="mb-3 px-2 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
                <div className="space-y-3">
                  {items.map((notification) => (
                    <motion.article
                      key={notification.id}
                      layout
                      drag={isMobile ? 'x' : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.22}
                      onDragEnd={(_event, info) => handleDragEnd(notification, info)}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                      className={cn(
                        'group relative overflow-hidden rounded-[24px] border p-4 shadow-sm transition',
                        notification.isRead
                          ? 'border-border/35 bg-card/55 dark:border-white/8'
                          : 'border-foreground/15 bg-card shadow-md dark:border-white/15',
                      )}
                    >
                      {!notification.isRead ? <span className="absolute left-0 top-6 h-8 w-1 rounded-r-full bg-foreground" /> : null}
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
                            notification.severity === 'destructive'
                              ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                              : notification.severity === 'warning'
                                ? 'border-amber-500/20 bg-amber-500/10 text-amber-600'
                                : notification.severity === 'success'
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                                  : 'border-border/35 bg-muted/55 text-muted-foreground dark:border-white/8',
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
                              <h4 className="mt-1 text-sm font-black leading-tight tracking-[-0.02em] text-foreground">{notification.title}</h4>
                            </div>
                            <span className="shrink-0 text-[9px] font-bold text-muted-foreground">{timeLabel(notification.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground">{notification.message}</p>

                          <div className="mt-4 flex items-center justify-between gap-2">
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
                    </motion.article>
                  ))}
                </div>
              </motion.section>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center"
            >
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-border/35 bg-muted/45 dark:border-white/8">
                <Shield className="h-10 w-10 text-muted-foreground/35" strokeWidth={1.2} />
              </div>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Nenhuma notificação</p>
              <p className="mt-2 max-w-xs text-xs font-medium leading-relaxed text-muted-foreground/75">
                Não há itens nesta categoria. Leitura e descarte permanecem sincronizados entre dispositivos.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
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
