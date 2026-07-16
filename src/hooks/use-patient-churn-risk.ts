import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';
import { subDays, differenceInDays } from 'date-fns';
import {
  isAbsentAppointmentStatus,
  isAttendedAppointmentStatus,
  isCancelledAppointmentStatus,
} from '@/lib/appointment-status';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnRiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: string[];
}

const getRiskLevel = (score: number): RiskLevel => {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
};

const calculateChurnRisk = async (patientId: string, userId: string): Promise<ChurnRiskResult> => {
  const now = new Date();
  const ninetyDaysAgo = subDays(now, 90);
  const factors: string[] = [];
  let score = 0;

  // 1. Cancelamentos e faltas nos últimos 90 dias (peso: 30%)
  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, status, notes, start_time')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .gte('start_time', ninetyDaysAgo.toISOString())
    .order('start_time', { ascending: false });

  const total = appointments?.length || 0;
  const cancelled = appointments?.filter(a => isCancelledAppointmentStatus(a.status, a.notes)).length || 0;
  const noShow = appointments?.filter(a => isAbsentAppointmentStatus(a.status, a.notes)).length || 0;
  if (total > 0) {
    const cancelRate = (cancelled + noShow) / total;
    const cancelScore = Math.min(cancelRate * 100, 30);
    score += cancelScore;
    if (cancelRate > 0.3) factors.push(`${Math.round(cancelRate * 100)}% de cancelamentos/faltas`);
  }

  // 2. Tempo desde a última sessão (peso: 25%)
  const { data: lastSession } = await supabase
    .from('appointments')
    .select('start_time, status, notes')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .order('start_time', { ascending: false })
    .limit(20);

  const lastCompletedSession = lastSession?.find((appointment) =>
    isAttendedAppointmentStatus(appointment.status, appointment.notes)
  );

  if (lastCompletedSession) {
    const daysSinceLastSession = differenceInDays(now, new Date(lastCompletedSession.start_time));
    if (daysSinceLastSession > 60) {
      score += 25;
      factors.push(`${daysSinceLastSession} dias sem sessão`);
    } else if (daysSinceLastSession > 30) {
      score += 15;
      factors.push(`${daysSinceLastSession} dias sem sessão`);
    } else if (daysSinceLastSession > 14) {
      score += 8;
    }
  } else {
    // Nunca teve sessão completada
    score += 20;
    factors.push('Nenhuma sessão concluída registrada');
  }

  // 3. Inadimplência financeira (peso: 20%)
  const { data: unpaidInvoices } = await supabase
    .from('invoices')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .eq('status', 'pending')
    .lt('due_date', now.toISOString().split('T')[0]);

  if (unpaidInvoices && unpaidInvoices.length > 0) {
    const unpaidScore = Math.min(unpaidInvoices.length * 7, 20);
    score += unpaidScore;
    const totalDebt = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    factors.push(`R$ ${totalDebt.toLocaleString('pt-BR')} em faturas vencidas`);
  }

  // 4. Redução de frequência: mês atual vs anterior (peso: 15%)
  const thirtyDaysAgo = subDays(now, 30);
  const sixtyDaysAgo = subDays(now, 60);

  const currentMonthSessions = appointments?.filter(a =>
    new Date(a.start_time) >= thirtyDaysAgo && isAttendedAppointmentStatus(a.status, a.notes)
  ).length || 0;

  const previousMonthSessions = appointments?.filter(a => {
    const d = new Date(a.start_time);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo && isAttendedAppointmentStatus(a.status, a.notes);
  }).length || 0;

  if (previousMonthSessions > 0 && currentMonthSessions < previousMonthSessions) {
    const dropRate = 1 - (currentMonthSessions / previousMonthSessions);
    const dropScore = Math.min(dropRate * 15, 15);
    score += dropScore;
    if (dropRate > 0.5) factors.push(`Frequência caiu ${Math.round(dropRate * 100)}%`);
  }

  // 5. Sem agendamento futuro (peso: 10%)
  const { data: futureAppointments } = await supabase
    .from('appointments')
    .select('id, status, notes')
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .eq('visibility_status', 'visible')
    .is('archived_at', null)
    .gte('start_time', now.toISOString());

  const futureCount = futureAppointments?.filter((appointment) =>
    !isCancelledAppointmentStatus(appointment.status, appointment.notes)
  ).length || 0;

  if (futureCount === 0) {
    score += 10;
    factors.push('Sem agendamento futuro');
  }

  const finalScore = Math.min(Math.round(score), 100);

  return {
    riskScore: finalScore,
    riskLevel: getRiskLevel(finalScore),
    factors: factors.slice(0, 4),
  };
};

export const usePatientChurnRisk = (patientId?: string) => {
  const { user } = useAuth();

  return useQuery<ChurnRiskResult>({
    queryKey: ['patientChurnRisk', patientId],
    queryFn: () => calculateChurnRisk(patientId!, user!.id),
    enabled: !!patientId && !!user,
    staleTime: 1000 * 60 * 15, // 15 minutos de cache
    gcTime: 1000 * 60 * 60, // 1 hora
  });
};
