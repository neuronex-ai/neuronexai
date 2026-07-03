import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { format, isSameDay } from 'date-fns';
import { isCancelledAppointmentStatus } from '@/lib/appointment-status';
import { getAsaasAccountState } from '@/lib/asaas-account-status';
import {
  FINANCIAL_ACCOUNT_SAFE_SELECT,
  FINANCIAL_ACCOUNTS_READ_TABLE,
  NB_PAYMENTS_READ_TABLE,
  NB_PAYMENTS_SAFE_SELECT,
  NB_PAYOUTS_READ_TABLE,
  NB_PAYOUTS_SAFE_SELECT,
  normalizeFinancialAccountRow,
  normalizeNbPaymentRow,
  normalizeNbPayoutRow,
} from '@/lib/neurofinance-safe-selects';

export interface DashboardAlert {
  id: string;
  type: 'success' | 'warning' | 'info' | 'destructive';
  title: string;
  message: string;
  time: string;
  actionLink?: string;
}

const centsToBRL = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fetchDashboardAlerts = async (userId: string): Promise<DashboardAlert[]> => {
  const alerts: DashboardAlert[] = [];
  const now = new Date();

  const { data: settings } = await supabase
    .from('user_notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const inAppEnabled = settings?.in_app_enabled ?? true;
  if (!inAppEnabled) return [];

  const { data: financialAccount } = await (supabase as any)
    .from(FINANCIAL_ACCOUNTS_READ_TABLE)
    .select(FINANCIAL_ACCOUNT_SAFE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();

  const normalizedFinancialAccount = normalizeFinancialAccountRow(financialAccount);
  const accountState = getAsaasAccountState(normalizedFinancialAccount);

  if (!normalizedFinancialAccount || accountState.uiStatus === 'not_started' || accountState.uiStatus === 'account_missing') {
    alerts.push({
      id: 'payment-connect',
      type: 'warning',
      title: 'NeuroFinance pendente',
      message: 'Ative sua subconta Asaas de produção para receber cobranças automáticas.',
      time: 'Financeiro',
      actionLink: '/financeiro/neurofinance',
    });
  } else if (normalizedFinancialAccount.last_sync_error) {
    alerts.push({
      id: 'asaas-sync-error',
      type: 'destructive',
      title: 'Sincronização Asaas',
      message: 'Não foi possível sincronizar sua subconta Asaas. Verifique o painel financeiro.',
      time: 'Financeiro',
      actionLink: '/financeiro/neurofinance',
    });
  } else if (['pending', 'onboarding', 'pending_review', 'restricted', 'disabled'].includes(normalizedFinancialAccount.status)) {
    alerts.push({
      id: 'asaas-review',
      type: normalizedFinancialAccount.status === 'restricted' || normalizedFinancialAccount.status === 'disabled' ? 'destructive' : 'warning',
      title: 'Conta Asaas em análise',
      message: 'Sua subconta ainda precisa de validação para liberar cobranças e repasses.',
      time: 'Financeiro',
      actionLink: '/financeiro/neurofinance',
    });
  }

  if (settings?.in_app_overdue_invoices ?? true) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: recentPayments } = await (supabase as any)
      .from(NB_PAYMENTS_READ_TABLE)
      .select(NB_PAYMENTS_SAFE_SELECT)
      .eq('user_id', userId)
      .eq('status', 'paid')
      .gte('updated_at', yesterday.toISOString());

    const normalizedRecentPayments = (recentPayments || []).map(normalizeNbPaymentRow);
    if (normalizedRecentPayments.length > 0) {
      const totalReceived = normalizedRecentPayments.reduce((sum, payment) => sum + (payment.gross_amount || 0), 0);
      alerts.push({
        id: 'recent-asaas-payments',
        type: 'success',
        title: 'Pagamento recebido',
        message: `${normalizedRecentPayments.length} pagamento(s) confirmado(s): ${centsToBRL(totalReceived)}.`,
        time: 'Financeiro',
        actionLink: '/financeiro/neurofinance',
      });
    }

    const { data: problematicPayouts } = await (supabase as any)
      .from(NB_PAYOUTS_READ_TABLE)
      .select(NB_PAYOUTS_SAFE_SELECT)
      .eq('user_id', userId)
      .in('status', ['failed', 'canceled'])
      .gte('updated_at', yesterday.toISOString());

    const normalizedProblematicPayouts = (problematicPayouts || []).map(normalizeNbPayoutRow);
    if (normalizedProblematicPayouts.length > 0) {
      alerts.push({
        id: 'asaas-payout-issues',
        type: 'warning',
        title: 'Repasse com atenção',
        message: `${normalizedProblematicPayouts.length} repasse(s) tiveram falha ou cancelamento recente.`,
        time: 'Financeiro',
        actionLink: '/financeiro/neurofinance',
      });
    }
  }

  if (settings?.in_app_new_patients ?? true) {
    const { count: pendingPatients } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (pendingPatients && pendingPatients > 0) {
      alerts.push({
        id: 'pending-patients',
        type: 'info',
        title: 'Novos pacientes',
        message: `${pendingPatients} cadastro(s) aguardando revisão ou aprovação.`,
        time: 'Pacientes',
        actionLink: '/pacientes',
      });
    }
  }

  if (settings?.in_app_system_updates ?? true) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: recentReschedules } = await supabase
      .from('appointments')
      .select('id, start_time, created_at, updated_at, status, notes, patient:patient_id(name)')
      .eq('user_id', userId)
      .gte('updated_at', yesterday.toISOString());

    const rescheduled = recentReschedules?.filter(apt => {
      if (isCancelledAppointmentStatus(apt.status, apt.notes)) return false;
      const created = new Date(apt.created_at).getTime();
      const updated = new Date(apt.updated_at).getTime();
      return (updated - created) > 60000;
    });

    if (rescheduled && rescheduled.length > 0) {
      alerts.push({
        id: 'recent-reschedules',
        type: 'info',
        title: 'Consultas reagendadas',
        message: `${rescheduled.length} consulta(s) foram reagendadas recentemente.`,
        time: 'Agenda',
        actionLink: '/agenda',
      });
    }
  }

  if (settings?.in_app_system_updates ?? true) {
    const { data: upcomingAppointments, error: aptError } = await supabase
      .from('appointments')
      .select('id, start_time, status, notes, patient:patient_id(name)')
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .neq('type', 'block')
      .order('start_time', { ascending: true })
      .limit(10);

    const visibleUpcoming = (upcomingAppointments || [])
      .filter((apt) => !isCancelledAppointmentStatus(apt.status, apt.notes))
      .slice(0, 3);

    if (aptError) {
      console.error('Error fetching upcoming appointments for alerts:', aptError);
    } else if (visibleUpcoming.length > 0) {
      visibleUpcoming.forEach((apt, index) => {
        const startTime = new Date(apt.start_time);
        const isToday = isSameDay(now, startTime);
        const timeStr = format(startTime, 'HH:mm');
        const dateStr = isToday ? 'hoje' : `em ${format(startTime, 'dd/MM')}`;
        const patientName = Array.isArray(apt.patient) ? apt.patient[0]?.name : (apt.patient as any)?.name;

        alerts.push({
          id: `upcoming-apt-${apt.id}`,
          type: 'info',
          title: index === 0 ? 'Próxima sessão' : 'Agendamento futuro',
          message: `Consulta com ${patientName || 'Paciente'} ${dateStr} às ${timeStr}.`,
          time: 'Agenda',
          actionLink: `/agenda?appointmentId=${apt.id}`,
        });
      });
    } else {
      alerts.push({
        id: 'free-day',
        type: 'info',
        title: 'Agenda livre',
        message: 'Nenhum atendimento futuro agendado.',
        time: 'Agenda',
        actionLink: '/agenda',
      });
    }
  }

  return alerts;
};

export const useDashboardAlerts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboardAlerts', user?.id],
    queryFn: () => fetchDashboardAlerts(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });
};
