import { useAuth } from '@/components/auth/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings, useNotificationSettings } from '@/hooks/use-notification-settings';
import { getElectronAPI, isElectron } from '@/lib/electron';
import {
  disablePushNotifications,
  enablePushNotifications,
  getWebPushAvailability,
  getWebPushPermission,
  hasActivePushSubscription,
  logPushStep,
} from '@/lib/push-notifications';
import { BellRing, Laptop, Loader2, Mail, Monitor, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type Key = keyof Pick<NotificationSettings, 'email_enabled' | 'email_appointment_reminders' | 'email_payment_confirmations' | 'email_security_alerts' | 'in_app_enabled' | 'in_app_new_patients' | 'in_app_overdue_invoices' | 'in_app_system_updates'>;

const rows: Array<{ key: Key; label: string; description: string; channel: 'email' | 'panel' }> = [
  { key: 'email_appointment_reminders', label: 'Lembretes de consulta', description: 'Avisos sobre agendamentos proximos.', channel: 'email' },
  { key: 'email_payment_confirmations', label: 'Fluxo financeiro', description: 'Pagamentos, faturas e repasses.', channel: 'email' },
  { key: 'email_security_alerts', label: 'Seguranca', description: 'Mudancas importantes na conta.', channel: 'email' },
  { key: 'in_app_new_patients', label: 'Prontuario e pacientes', description: 'Anamneses, documentos e revisoes pendentes.', channel: 'panel' },
  { key: 'in_app_overdue_invoices', label: 'Financeiro', description: 'Gestao financeira e NeuroFinance.', channel: 'panel' },
  { key: 'in_app_system_updates', label: 'Agenda e sistema', description: 'Reagendamentos, cancelamentos e eventos operacionais.', channel: 'panel' },
];

const statusPill = (available: boolean, label?: string) => (
  <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${available ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
    {label || (available ? 'Disponivel' : 'Indisponivel')}
  </span>
);

export const PersistentNotificationSettings = () => {
  const { user } = useAuth();
  const { settings, isLoading, isSaving, saveSettingsAsync } = useNotificationSettings();
  const [state, setState] = useState<Partial<NotificationSettings>>(DEFAULT_NOTIFICATION_SETTINGS);
  const [pushBusy, setPushBusy] = useState(false);
  const [webPushActive, setWebPushActive] = useState(false);
  const [desktopSupported, setDesktopSupported] = useState(false);
  const pushBusyRef = useRef(false);
  const electronMode = isElectron();
  const webPush = useMemo(() => getWebPushAvailability(), []);
  const webPushPermission = getWebPushPermission();

  useEffect(() => {
    if (settings) {
      setState({ ...DEFAULT_NOTIFICATION_SETTINGS, ...settings, sms_enabled: false, sms_security_alerts: false, sms_appointments: false });
    }
  }, [settings]);

  useEffect(() => {
    if (!user?.id || electronMode) return;
    void hasActivePushSubscription(user.id).then(setWebPushActive);
  }, [electronMode, user?.id]);

  useEffect(() => {
    if (!electronMode) return;
    void getElectronAPI()?.notifications?.isSupported().then(setDesktopSupported).catch(() => setDesktopSupported(false));
  }, [electronMode]);

  const persistPushPreference = async (enabled: boolean) => {
    const next = { ...state, push_enabled: enabled, sms_enabled: false, sms_security_alerts: false, sms_appointments: false };
    logPushStep('push:settings-save', { enabled, electronMode });
    setState(next);
    await saveSettingsAsync(next);
  };

  const toggleWebPush = async (enabled: boolean) => {
    if (!user || pushBusyRef.current) return;
    pushBusyRef.current = true;
    setPushBusy(true);
    try {
      if (enabled) {
        await enablePushNotifications(user.id);
        setWebPushActive(true);
      } else {
        await disablePushNotifications(user.id);
        setWebPushActive(false);
      }
      await persistPushPreference(enabled);
      toast.success(enabled ? 'Notificacoes do navegador/PWA ativadas neste dispositivo.' : 'Notificacoes do navegador/PWA desativadas neste dispositivo.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nao foi possivel alterar as notificacoes nativas.');
    } finally {
      pushBusyRef.current = false;
      setPushBusy(false);
    }
  };

  const toggleDesktopPush = async (enabled: boolean) => {
    if (pushBusyRef.current) return;
    pushBusyRef.current = true;
    setPushBusy(true);
    try {
      if (enabled) {
        const api = getElectronAPI();
        if (!api?.notifications) throw new Error('O app desktop nao conseguiu acessar as notificacoes nativas do Windows.');
        const supported = await api.notifications.isSupported();
        if (!supported) throw new Error('O app desktop nao conseguiu acessar as notificacoes nativas do Windows.');
        const permission = await api.notifications.requestPermission();
        if (permission !== 'granted') throw new Error('Permissao de notificacao nativa nao concedida.');
      }
      await persistPushPreference(enabled);
      toast.success(enabled ? 'Notificacoes do app desktop ativadas.' : 'Notificacoes do app desktop desativadas.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Nao foi possivel alterar as notificacoes do app desktop.');
    } finally {
      pushBusyRef.current = false;
      setPushBusy(false);
    }
  };

  const save = async () => {
    await saveSettingsAsync({ ...state, sms_enabled: false, sms_security_alerts: false, sms_appointments: false });
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-52" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;

  return <div className="max-w-3xl space-y-9">
    <header className="flex items-center justify-between gap-6 border-b border-border/10 pb-8"><div><h2 className="text-2xl font-bold">Preferencias de alerta</h2><p className="mt-2 text-sm text-muted-foreground">E-mail institucional, central interna e notificacoes nativas por dispositivo.</p></div><Button onClick={() => void save()} disabled={isSaving} className="rounded-full px-8">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button></header>

    <section className="space-y-4"><div className="flex items-center gap-4"><Mail className="h-5 w-5" /><h3 className="text-sm font-bold uppercase tracking-widest">E-mail</h3><Switch className="ml-auto" checked={Boolean(state.email_enabled)} onCheckedChange={(value) => setState((current) => ({ ...current, email_enabled: value }))} /></div>{rows.filter((row) => row.channel === 'email').map((row) => <div key={row.key} className="flex items-center justify-between border-b border-border/10 py-4 pl-9"><div><Label>{row.label}</Label><p className="text-xs text-muted-foreground">{row.description}</p></div><Switch checked={Boolean(state[row.key])} disabled={!state.email_enabled} onCheckedChange={(value) => setState((current) => ({ ...current, [row.key]: value }))} /></div>)}</section>

    <section className="space-y-4"><div className="flex items-center gap-4"><Monitor className="h-5 w-5" /><h3 className="text-sm font-bold uppercase tracking-widest">Dentro da NeuroNex</h3><Switch className="ml-auto" checked={Boolean(state.in_app_enabled)} onCheckedChange={(value) => setState((current) => ({ ...current, in_app_enabled: value }))} /></div>{rows.filter((row) => row.channel === 'panel').map((row) => <div key={row.key} className="flex items-center justify-between border-b border-border/10 py-4 pl-9"><div><Label>{row.label}</Label><p className="text-xs text-muted-foreground">{row.description}</p></div><Switch checked={Boolean(state[row.key])} disabled={!state.in_app_enabled} onCheckedChange={(value) => setState((current) => ({ ...current, [row.key]: value }))} /></div>)}</section>

    <section className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5"><BellRing className="h-5 w-5 text-primary" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><Label>Notificacoes do navegador/PWA</Label>{statusPill(!electronMode && webPush.supported, electronMode ? 'Web/PWA' : undefined)}</div><p className="text-xs text-muted-foreground">{electronMode ? 'Este canal fica disponivel no navegador ou PWA. No app desktop, use o canal abaixo.' : webPush.reason}</p></div>{pushBusy && !electronMode ? <Loader2 className="h-5 w-5 animate-spin" /> : <Switch disabled={electronMode || !webPush.supported} checked={!electronMode && Boolean(state.push_enabled) && webPushPermission === 'granted' && webPushActive} onCheckedChange={(value) => void toggleWebPush(value)} />}</section>

    {electronMode ? <section className="flex items-center gap-4 rounded-xl border border-border/20 bg-card p-5"><Laptop className="h-5 w-5" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><Label>Notificacoes do app desktop</Label>{statusPill(desktopSupported)}</div><p className="text-xs text-muted-foreground">Usa notificacoes nativas do Windows quando o NeuroNex Desktop esta aberto, minimizado ou em segundo plano.</p></div>{pushBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Switch disabled={!desktopSupported} checked={Boolean(state.push_enabled) && desktopSupported} onCheckedChange={(value) => void toggleDesktopPush(value)} />}</section> : null}

    <section className="flex items-center gap-4 rounded-xl border border-border/10 bg-secondary/15 p-5 opacity-65"><Smartphone className="h-5 w-5" /><div className="flex-1"><Label>SMS</Label><p className="text-xs text-muted-foreground">Indisponivel ate a contratacao e validacao de um provedor.</p></div><Switch checked={false} disabled /></section>
  </div>;
};
