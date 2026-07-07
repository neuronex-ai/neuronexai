import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

export interface FinancialPlanningGoal {
  id: string;
  professional_id: string;
  month: string;
  revenue_goal_cents: number;
  expense_limit_cents: number;
  desired_profit_cents: number;
  target_sessions: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialPlanningGoalInput {
  revenueGoal: number;
  expenseLimit: number;
  desiredProfit: number;
  targetSessions: number;
  notes?: string | null;
}

const monthKeyOf = (month: Date) => format(startOfMonth(month), "yyyy-MM-dd");
export const toPlanningCents = (value: number) => Math.round(Math.max(0, Number(value || 0)) * 100);
export const fromPlanningCents = (value?: number | null) => Math.max(0, Number(value || 0)) / 100;

export function useFinancialPlanning(month: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const monthKey = monthKeyOf(month);
  const queryKey = ["financial-planning-goal", userId, monthKey] as const;

  const goal = useQuery<FinancialPlanningGoal | null, Error>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("financial_planning_goals")
        .select("*")
        .eq("professional_id", userId)
        .eq("month", monthKey)
        .maybeSingle();

      if (error) throw error;
      return (data as FinancialPlanningGoal | null) || null;
    },
  });

  const saveGoal = useMutation({
    mutationFn: async (input: FinancialPlanningGoalInput) => {
      if (!userId) throw new Error("Usuário não autenticado");

      const payload = {
        professional_id: userId,
        month: monthKey,
        revenue_goal_cents: toPlanningCents(input.revenueGoal),
        expense_limit_cents: toPlanningCents(input.expenseLimit),
        desired_profit_cents: toPlanningCents(input.desiredProfit),
        target_sessions: Math.max(0, Math.round(Number(input.targetSessions || 0))),
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("financial_planning_goals")
        .upsert(payload, { onConflict: "professional_id,month" })
        .select("*")
        .single();

      if (error) throw error;
      return data as FinancialPlanningGoal;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["financial-planning-goal"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-managerial-metrics"] });
    },
  });

  return {
    monthKey,
    goal: goal.data || null,
    isLoading: goal.isLoading,
    error: goal.error,
    saveGoal,
  };
}
