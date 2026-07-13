import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  useNotificationSettings,
} from "@/hooks/use-notification-settings";
import {
  disablePushNotifications,
  enablePushNotifications,
  getWebPushAvailability,
  getWebPushPermission,
  hasActivePushSubscription,
  logPushStep,
} from "@/lib/push-notifications";
import {
  BellRing,
  Loader2,
  Mail,
  Monitor,
  Smartphone,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Key = keyof Pick<
  NotificationSettings,
  | "email_enabled"
  | "email_appointment_reminders"
  | "email_payment_confirmations"
  | "email_security_alerts"
  | "in_app_enabled"
  | "in_app_new_patients"
  | "in_app_overdue_invoices"
  | "in_app_system_updates"
>;

const rows: Array<{
  key: Key;
  label: string;
  description: string;
  channel: "email" | "panel";
}> = [
  {
    key: "email_appointment_reminders",
    label: "Lembretes de consulta",
    description: "Avisos sobre os próximos agendamentos.",
    channel: "email",
  },
  {
    key: "email_payment_confirmations",
    label: "Movimentações financeiras",
    description: "Pagamentos, cobranças e recibos.",
    channel: "email",
  },
  {
    key: "email_security_alerts",
    label: "Segurança da conta",
    description: "Alterações importantes no seu acesso.",
    channel: "email",
  },
  {
    key: "in_app_new_patients",
    label: "Prontuários e pacientes",
    description: "Anamneses, documentos e revisões pendentes.",
    channel: "panel",
  },
  {
    key: "in_app_overdue_invoices",
    label: "Financeiro",
    description: "Pendências da Gestão Financeira e do NeuroFinance.",
    channel: "panel",
  },
  {
    key: "in_app_system_updates",
    label: "Agenda",
    description: "Reagendamentos, cancelamentos e mudanças nas sessões.",
    channel: "panel",
  },
];

const StatusPill = ({
  available,
  label,
}: {
  available: boolean;
  label?: string;
}) => (
  <span
    className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${available ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
  >
    {label || (available ? "Disponível" : "Indisponível")}
  </span>
);

export const PersistentNotificationSettings = () => {
  const { user } = useAuth();
  const { settings, isLoading, isSaving, saveSettingsAsync } =
    useNotificationSettings();
  const [state, setState] = useState<Partial<NotificationSettings>>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [webPushActive, setWebPushActive] = useState(false);
  const pushBusyRef = useRef(false);
  const webPush = useMemo(() => getWebPushAvailability(), []);
  const webPushPermission = getWebPushPermission();

  useEffect(() => {
    if (settings) {
      setState({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...settings,
        sms_enabled: false,
        sms_security_alerts: false,
        sms_appointments: false,
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!user?.id) return;
    void hasActivePushSubscription(user.id).then(setWebPushActive);
  }, [user?.id]);

  const persistPushPreference = async (enabled: boolean) => {
    const next = {
      ...state,
      push_enabled: enabled,
      sms_enabled: false,
      sms_security_alerts: false,
      sms_appointments: false,
    };
    logPushStep("push:settings-save", { enabled });
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
      toast.success(
        enabled
          ? "Alertas ativados neste navegador."
          : "Alertas desativados neste navegador.",
      );
    } catch (cause) {
      const permissionBlocked =
        cause instanceof Error && /permiss|bloquead/i.test(cause.message);
      toast.error(
        permissionBlocked
          ? "As notificações estão bloqueadas. Libere a permissão do site no navegador e tente novamente."
          : "Não foi possível alterar os alertas neste navegador agora.",
      );
    } finally {
      pushBusyRef.current = false;
      setPushBusy(false);
    }
  };

  const save = async () => {
    await saveSettingsAsync({
      ...state,
      sms_enabled: false,
      sms_security_alerts: false,
      sms_appointments: false,
    });
  };

  const browserStatusDescription = webPushPermission === "denied"
    ? "Os alertas estão bloqueados nas permissões deste navegador."
    : webPush.supported
      ? "Receba lembretes importantes mesmo quando esta aba não estiver aberta."
      : "Este navegador não permite alertas em segundo plano.";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-9">
      <header className="flex items-center justify-between gap-6 border-b border-border/10 pb-8">
        <div>
          <h2 className="text-2xl font-bold">Preferências de notificação</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha quais avisos deseja receber e onde eles devem aparecer.
          </p>
        </div>
        <Button
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded-full px-8"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </Button>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <Mail className="h-5 w-5" />
          <h3 className="text-sm font-bold uppercase tracking-widest">
            E-mail
          </h3>
          <Switch
            className="ml-auto"
            checked={Boolean(state.email_enabled)}
            onCheckedChange={(value) =>
              setState((current) => ({ ...current, email_enabled: value }))
            }
          />
        </div>
        {rows
          .filter((row) => row.channel === "email")
          .map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between border-b border-border/10 py-4 pl-9"
            >
              <div>
                <Label>{row.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {row.description}
                </p>
              </div>
              <Switch
                checked={Boolean(state[row.key])}
                disabled={!state.email_enabled}
                onCheckedChange={(value) =>
                  setState((current) => ({ ...current, [row.key]: value }))
                }
              />
            </div>
          ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <Monitor className="h-5 w-5" />
          <h3 className="text-sm font-bold uppercase tracking-widest">
            Dentro da NeuroNex
          </h3>
          <Switch
            className="ml-auto"
            checked={Boolean(state.in_app_enabled)}
            onCheckedChange={(value) =>
              setState((current) => ({ ...current, in_app_enabled: value }))
            }
          />
        </div>
        {rows
          .filter((row) => row.channel === "panel")
          .map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between border-b border-border/10 py-4 pl-9"
            >
              <div>
                <Label>{row.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {row.description}
                </p>
              </div>
              <Switch
                checked={Boolean(state[row.key])}
                disabled={!state.in_app_enabled}
                onCheckedChange={(value) =>
                  setState((current) => ({ ...current, [row.key]: value }))
                }
              />
            </div>
          ))}
      </section>

      <section className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <BellRing className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Alertas neste navegador</Label>
            <StatusPill available={webPush.supported} />
          </div>
          <p className="text-xs text-muted-foreground">
            {browserStatusDescription}
          </p>
        </div>
        {pushBusy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Switch
            disabled={!webPush.supported}
            checked={
              Boolean(state.push_enabled) &&
              webPushPermission === "granted" &&
              webPushActive
            }
            onCheckedChange={(value) => void toggleWebPush(value)}
          />
        )}
      </section>

      <section className="flex items-center gap-4 rounded-xl border border-border/10 bg-secondary/15 p-5 opacity-65">
        <Smartphone className="h-5 w-5" />
        <div className="flex-1">
          <Label>SMS</Label>
          <p className="text-xs text-muted-foreground">Em desenvolvimento.</p>
        </div>
        <Switch checked={false} disabled />
      </section>
    </div>
  );
};
