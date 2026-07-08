import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { addDays, addMonths, format, isBefore, startOfDay, startOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ProjectionMode = 'mixed' | 'packages_only' | 'online_only';
export type ViewType = 'daily' | 'monthly';

export interface FlowDetail {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  source: 'financial_entry' | 'recurring' | 'package' | 'invoice';
  patient_name?: string;
  installment_info?: string;
}

export interface ChartPoint {
  date: string;
  Projetado: number;
  Realizado: number;
  fullLabel: string;
  details: FlowDetail[];
}

export const useProjectedCashFlow = (mode: ProjectionMode, rangeDays: number, viewType: ViewType = 'daily') => {
  return useQuery({
    queryKey: ['projected-cash-flow-v4', mode, rangeDays, viewType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const today = startOfDay(new Date());
      const startDate = subDays(today, 30);
      const totalRange = rangeDays + 30;

      const dailyData: ChartPoint[] = [];
      for (let i = 0; i <= totalRange; i++) {
        const currentDay = addDays(startDate, i);
        dailyData.push({
          date: currentDay.toISOString(),
          Projetado: 0,
          Realizado: 0,
          fullLabel: format(currentDay, viewType === 'monthly' ? "MMMM 'de' yyyy" : "dd 'de' MMMM", { locale: ptBR }),
          details: []
        });
      }

      const [
        { data: financialEntries },
        { data: recInvoices },
        { data: recExpenses },
        { data: packages },
        { data: pendingInvoices }
      ] = await Promise.all([
        supabase.from('financial_entries').select('*, patients(name)').eq('professional_id', user.id).limit(5000),
        supabase.from('recurring_invoices').select('*, patients(name)').eq('user_id', user.id).eq('active', true),
        supabase.from('recurring_expenses').select('*').eq('user_id', user.id).eq('active', true),
        supabase.from('patient_packages').select('*, patients(name)').eq('user_id', user.id).gt('total_sessions', 0),
        supabase.from('invoices').select('*, patients(name)').eq('user_id', user.id).eq('status', 'pending')
      ]);

      dailyData.forEach((point) => {
        const currentDay = new Date(point.date);
        const isPast = isBefore(currentDay, today);
        const dayOfMonth = currentDay.getDate();


        // REALIZADO (Histórico)
        if (isPast || format(currentDay, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
          financialEntries?.forEach((entry: any) => {
            const entryDate = entry.paid_at?.slice(0, 10) || entry.competence_date || entry.due_date || entry.created_at?.slice(0, 10);
            if (entry.status === 'paid' && entryDate === format(currentDay, 'yyyy-MM-dd')) {
              const val = Number(entry.amount);
              point.Realizado += entry.type === 'income' ? val : -val;
              point.details.push({
                id: entry.id,
                type: entry.type as 'income' | 'expense',
                description: entry.description || entry.title,
                amount: val,
                source: 'financial_entry',
                patient_name: entry.patients?.name,
              });
            }
          });
        }

        // PROJETADO (Futuro)
        if (!isPast) {
          financialEntries?.forEach((entry: any) => {
            const entryDate = entry.due_date || entry.competence_date || entry.created_at?.slice(0, 10);
            if (entry.status !== 'paid' && entryDate === format(currentDay, 'yyyy-MM-dd')) {
              const val = Number(entry.amount);
              point.Projetado += entry.type === 'income' ? val : -val;
              point.details.push({
                id: entry.id,
                type: entry.type as 'income' | 'expense',
                description: entry.description || entry.title,
                amount: val,
                source: 'financial_entry',
                patient_name: entry.patients?.name,
              });
            }
          });

          // 1. Assinaturas Recorrentes
          recInvoices?.forEach(rec => {
            if (rec.day_of_month === dayOfMonth) {
              const val = Number(rec.amount);
              point.Projetado += val;
              point.details.push({
                id: rec.id, type: 'income', source: 'recurring', amount: val,
                description: rec.description || "Assinatura Recorrente",
                patient_name: (rec.patients as any)?.name
              });
            }
          });

          // 2. Despesas Fixas
          recExpenses?.forEach(exp => {
            if (exp.day_of_month === dayOfMonth) {
              const val = Number(exp.amount);
              point.Projetado -= val;
              point.details.push({
                id: exp.id, type: 'expense', source: 'recurring', amount: val,
                description: exp.description
              });
            }
          });

          // 3. Faturas Avulsas Pendentes
          pendingInvoices?.forEach(inv => {
            if (inv.due_date && format(new Date(inv.due_date), 'yyyy-MM-dd') === format(currentDay, 'yyyy-MM-dd')) {
              const val = Number(inv.amount);
              point.Projetado += val;
              point.details.push({
                id: inv.id, type: 'income', source: 'invoice', amount: val,
                description: `Fatura ${inv.invoice_number}`, patient_name: (inv.patients as any)?.name
              });
            }
          });

          // 4. Pacotes de Sessões (Projeção amigável)
          if (mode === 'mixed' || mode === 'packages_only') {
            packages?.forEach(pkg => {
              const sessionsRemaining = pkg.total_sessions - pkg.sessions_used;
              if (sessionsRemaining <= 0) return;

              // Se o pacote tem um due_day, projetamos a entrada nesse dia de cada mês
              const dueDay = pkg.due_day || 1;
              if (dayOfMonth === dueDay) {
                const pkgEndDate = pkg.end_date ? new Date(pkg.end_date) : addMonths(today, 6);
                if (isBefore(currentDay, pkgEndDate)) {
                  // Calculamos qual "sessão" seria essa baseada nos meses à frente (considerando 29 dias/mês)
                  const monthsAhead = Math.floor((currentDay.getTime() - today.getTime()) / (29 * 24 * 60 * 60 * 1000)) + 1;
                  const currentSession = pkg.sessions_used + monthsAhead;

                  if (currentSession <= pkg.total_sessions) {
                    const sessionVal = Number(pkg.price) / pkg.total_sessions;
                    point.Projetado += sessionVal;
                    point.details.push({
                      id: pkg.id, type: 'income', source: 'package', amount: sessionVal,
                      description: `Parcela do Pacote`,
                      patient_name: (pkg.patients as any)?.name,
                      installment_info: `${currentSession}ª de ${pkg.total_sessions} sessões`
                    });
                  }
                }
              }
            });
          }
        }
      });

      if (viewType === 'monthly') {
        const monthlyAggregation: Record<string, ChartPoint> = {};
        dailyData.forEach(day => {
          const d = new Date(day.date);
          const monthKey = format(d, 'yyyy-MM');
          if (!monthlyAggregation[monthKey]) {
            monthlyAggregation[monthKey] = {
              date: startOfMonth(d).toISOString(),
              Projetado: 0, Realizado: 0,
              fullLabel: format(d, 'MMMM yyyy', { locale: ptBR }),
              details: []
            };
          }
          monthlyAggregation[monthKey].Projetado += day.Projetado;
          monthlyAggregation[monthKey].Realizado += day.Realizado;

          // Agregamos detalhes preservando a unicidade por descrição/pacote para não poluir
          day.details.forEach(det => {
            monthlyAggregation[monthKey].details.push({ ...det });
          });
        });
        return Object.values(monthlyAggregation).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      return dailyData;
    }
  });
};
