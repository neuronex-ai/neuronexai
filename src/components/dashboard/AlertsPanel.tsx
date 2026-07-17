import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  MoreHorizontal,
  Settings,
  Shield,
  Sparkles,
  Trash2,
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
    dismissAll,
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

  const handleClearAll = useCallback(async () => {
    try {
      await dismissAll();
      toast.success('Lista de notificações limpa');
    } catch {
      toast.error('Não foi possível limpar as notificações');
    }
  }, [dismissAll]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-transparent" role="region" aria-label="Notificações">
      {isMobile ? (
        <header className="notification-panel-header sticky top-0 z-20 border-b border-border/35 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
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
                className="h-11 rounded-xl border-border/45 px-3 text-[8px] font-black uppercase tracking-[0.12em]"
              >
                <CheckCheck className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
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
                  className="h-11 w-11 rounded-[13px] border-0 bg-background/70"
                  aria-label="Filtrar notificações"
                >
                  <ListFilter className="h-4 w-4" aria-hidden="true" />
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
                        'flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[10px] font-black uppercase tracking-[0.12em] transition-colors',
                        filter === item.value
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {item.label}
                      {filter === item.value ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>
      ) : (
        <TooltipProvider delayDuration={300}>
          <header className="notification-liquid-header pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-4 pt-4">
            <div
              className="notification-liquid-toolbar pointer-events-auto flex items-center gap-1 p-1"
              role="toolbar"
              aria-label="Navegação e ações das notificações"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => startFilterTransition(() => setFilter('all'))}
                    className={cn(
                      'notification-liquid-control relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      filter === 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-label={unreadCount > 0 ? `Mostrar todas. ${unreadCount} não lida${unreadCount === 1 ? '' : 's'}` : 'Mostrar todas. Tudo em dia'}
                    aria-pressed={filter === 'all'}
                  >
                    {filter === 'all' ? (
                      <motion.span
                        layoutId="notification-toolbar-active"
                        className="notification-liquid-tab-active absolute inset-0 rounded-full"
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <Bell className="relative z-10 h-[17px] w-[17px]" aria-hidden="true" />
                    {unreadCount > 0 ? (
                      <span className="notification-unread-badge absolute right-0.5 top-0.5 z-20 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[7px] font-black leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>Todas as notificações</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'notification-liquid-control relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          filter !== 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                        aria-label={`Filtrar notificações. Filtro atual: ${activeFilterLabel}`}
                      >
                        {filter !== 'all' ? (
                          <motion.span
                            layoutId="notification-toolbar-active"
                            className="notification-liquid-tab-active absolute inset-0 rounded-full"
                            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 38 }}
                            aria-hidden="true"
                          />
                        ) : null}
                        <ListFilter className="relative z-10 h-[17px] w-[17px]" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>Filtrar: {activeFilterLabel}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="center"
                  side="bottom"
                  sideOffset={10}
                  className="notification-liquid-menu max-h-[min(420px,60vh)] min-w-60 overflow-y-auto rounded-[18px] p-1.5"
                >
                  <DropdownMenuRadioGroup
                    value={filter}
                    onValueChange={(value) => startFilterTransition(() => setFilter(value as NotificationFilter))}
                  >
                    {filters.map((item) => (
                      <DropdownMenuRadioItem
                        key={item.value}
                        value={item.value}
                        className="notification-liquid-menu-item min-h-11 cursor-pointer rounded-[13px] py-2 pl-9 pr-3 text-[12px] font-semibold"
                      >
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="mx-0.5 h-5 w-px bg-border/70 dark:bg-white/10" aria-hidden="true" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={unreadCount === 0 || isMutating}
                    onClick={() => void markAllAsRead()}
                    className="notification-liquid-control flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={unreadCount > 0 ? 'Marcar todas como lidas' : 'Todas as notificações já foram lidas'}
                  >
                    <CheckCheck className="h-[18px] w-[18px]" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  {unreadCount > 0 ? 'Marcar todas como lidas' : 'Tudo em dia'}
                </TooltipContent>
              </Tooltip>

              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={notifications.length === 0 || isMutating}
                        className="notification-liquid-control flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Limpar lista de notificações"
                      >
                        <Trash2 className="h-[17px] w-[17px]" aria-hidden="true" />
                      </button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>Limpar lista</TooltipContent>
                </Tooltip>
                <AlertDialogContent className="notification-clear-dialog max-w-sm rounded-[26px] border-border/55 p-5">
                  <AlertDialogHeader className="space-y-2 text-left">
                    <div className="notification-liquid-icon flex h-11 w-11 items-center justify-center rounded-[15px] text-destructive">
                      <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    <AlertDialogTitle className="pt-2 text-lg font-black tracking-[-0.025em]">Limpar notificações?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium leading-relaxed">
                      Todos os itens serão removidos desta central. Dados clínicos, financeiros e da agenda não serão apagados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-2 gap-2 sm:space-x-0">
                    <AlertDialogCancel className="h-11 rounded-xl px-4">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isMutating}
                      onClick={() => void handleClearAll()}
                      className="h-11 rounded-xl bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90"
                    >
                      Limpar lista
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <span className="sr-only" aria-live="polite">
              {unreadCount > 0 ? `${unreadCount} notificações não lidas` : 'Todas as notificações foram lidas'}
            </span>
          </header>
        </TooltipProvider>
      )}

      <div className={cn('notification-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]', isMobile ? 'px-4 pb-24 pt-4' : 'px-4 pb-6 pt-[84px]')}>
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
                className="mb-5"
              >
                <p className="mb-2.5 px-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
                <div className="space-y-2.5">
                  {items.map((notification) => {
                    if (isMobile) {
                      return (
                        <article
                          key={notification.id}
                          className={cn(
                            'notification-card relative overflow-hidden rounded-[18px] border p-3',
                            notification.isRead
                              ? 'border-border/35 bg-card/55'
                              : 'border-foreground/15 bg-card shadow-md',
                          )}
                        >
                          {!notification.isRead ? <span className="absolute left-0 top-6 h-8 w-1 rounded-r-full bg-foreground" aria-hidden="true" /> : null}
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
                                    className="h-11 rounded-xl px-4 text-[8px] font-black uppercase tracking-[0.12em]"
                                  >
                                    Abrir
                                    <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                ) : <span />}

                                <div className="flex items-center gap-1">
                                  {!notification.isRead ? (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => void handleRead(notification)}
                                      className="h-11 w-11 rounded-xl text-muted-foreground"
                                      aria-label="Marcar como lida"
                                    >
                                      <Check className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => void handleDismiss(notification)}
                                    className="h-11 w-11 rounded-xl text-muted-foreground hover:text-rose-500"
                                    aria-label="Dispensar notificação"
                                  >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    }

                    const financialScope = financeTag(notification);
                    const hasPrimaryAction = Boolean(notification.actionUrl) || !notification.isRead;
                    const notificationContent = (
                      <>
                        <div
                          className={cn(
                            'notification-liquid-icon patient-status-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]',
                            notification.severity === 'destructive'
                              ? 'text-rose-500'
                              : notification.severity === 'warning'
                                ? 'text-amber-600 dark:text-amber-300'
                                : notification.severity === 'success'
                                  ? 'text-emerald-600 dark:text-emerald-300'
                                  : 'text-muted-foreground',
                          )}
                        >
                          <NotificationIcon notification={notification} />
                        </div>

                        <div className="min-w-0 flex-1 py-0.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground">{categoryLabel[notification.category]}</p>
                            {financialScope ? (
                              <span className="shrink-0 rounded-md border border-border/45 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                                {financialScope}
                              </span>
                            ) : null}
                            <span className="ml-auto shrink-0 text-[9px] font-bold text-muted-foreground/75">{timeLabel(notification.createdAt)}</span>
                          </div>
                          <h4 className="mt-1 text-sm font-black leading-tight tracking-[-0.02em] text-foreground">{polishPortugueseUiText(notification.title)}</h4>
                          <p className={cn('mt-1 text-xs font-medium leading-relaxed text-muted-foreground', notification.actionUrl && 'line-clamp-3')}>{polishPortugueseUiText(notification.message)}</p>
                          {notification.actionUrl ? (
                            <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-foreground/75">
                              Abrir
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                            </span>
                          ) : null}
                        </div>
                      </>
                    );

                    return (
                      <article
                        key={notification.id}
                        className={cn(
                          'notification-card notification-card-liquid group relative overflow-hidden rounded-[19px] border p-2.5',
                          notification.isRead
                            ? 'border-border/30 bg-card/40'
                            : 'notification-card-unread border-foreground/15 bg-card/65',
                        )}
                      >
                        {!notification.isRead ? (
                          <span className="absolute left-2.5 top-2.5 z-20 h-1.5 w-1.5 rounded-full bg-foreground shadow-[0_0_0_3px_hsl(var(--background)/0.7)]" aria-hidden="true" />
                        ) : null}
                        <div className="relative z-10 flex min-w-0 items-start gap-1">
                          {hasPrimaryAction ? (
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => void handleAction(notification)}
                              className="notification-card-primary flex min-w-0 flex-1 items-start gap-3.5 rounded-[14px] p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-65"
                              aria-label={notification.actionUrl
                                ? `Abrir notificação: ${polishPortugueseUiText(notification.title)}`
                                : `Marcar como lida: ${polishPortugueseUiText(notification.title)}`}
                            >
                              {notificationContent}
                            </button>
                          ) : (
                            <div className="flex min-w-0 flex-1 items-start gap-3.5 p-2">
                              {notificationContent}
                            </div>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                disabled={isMutating}
                                className="notification-card-menu-control flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:cursor-wait disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Mais opções para ${polishPortugueseUiText(notification.title)}`}
                              >
                                <MoreHorizontal className="h-[17px] w-[17px]" aria-hidden="true" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              side="bottom"
                              sideOffset={6}
                              className="notification-liquid-menu min-w-52 rounded-[18px] p-1.5"
                            >
                              {notification.actionUrl ? (
                                <DropdownMenuItem
                                  onSelect={() => void handleAction(notification)}
                                  className="notification-liquid-menu-item min-h-11 cursor-pointer gap-3 rounded-[13px] px-3 text-[12px] font-semibold"
                                >
                                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                  Abrir
                                </DropdownMenuItem>
                              ) : null}
                              {!notification.isRead ? (
                                <DropdownMenuItem
                                  onSelect={() => void handleRead(notification)}
                                  className="notification-liquid-menu-item min-h-11 cursor-pointer gap-3 rounded-[13px] px-3 text-[12px] font-semibold"
                                >
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                  Marcar como lida
                                </DropdownMenuItem>
                              ) : null}
                              {notification.actionUrl || !notification.isRead ? <DropdownMenuSeparator className="bg-border/55" /> : null}
                              <DropdownMenuItem
                                onSelect={() => void handleDismiss(notification)}
                                className="notification-liquid-menu-item min-h-11 cursor-pointer gap-3 rounded-[13px] px-3 text-[12px] font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                Dispensar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </article>
                    );
                  })}
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
