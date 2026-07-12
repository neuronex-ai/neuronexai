"use client";

import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";

type FinancialEntryRow = {
  amount: number | string | null;
  type: "income" | "expense" | string | null;
  status: string | null;
  due_date: string | null;
  competence_date: string | null;
  paid_at: string | null;
  created_at: string | null;
};

const paidStatuses = new Set(["paid", "received", "completed", "confirmed"]);
const openStatuses = new Set(["planned", "pending", "overdue", "scheduled", "processing"]);

const referenceDate = (entry: FinancialEntryRow) =>
  (entry.paid_at || entry.competence_date || entry.due_date || entry.created_at || "").slice(0, 10);

export function useDashboardManagerialMetrics() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["dashboard-managerial-metrics", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado");

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const start = format(monthStart, "yyyy-MM-dd");
      const end = format(monthEnd, "yyyy-MM-dd");
      const startTimestamp = monthStart.toISOString();
      const endTimestamp = monthEnd.toISOString();

      const { data, error } = await supabase
        .from("financial_entries")
        .select("amount,type,status,due_date,competence_date,paid_at,created_at")
        .eq("professional_id", userId)
        .neq("status", "cancelled")
        .or([
          `and(paid_at.gte.${startTimestamp},paid_at.lte.${endTimestamp})`,
          `and(competence_date.gte.${start},competence_date.lte.${end})`,
          `and(due_date.gte.${start},due_date.lte.${end})`,
          `and(created_at.gte.${startTimestamp},created_at.lte.${endTimestamp})`,
        ].join(","))
        .order("due_date", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const monthEntries = ((data || []) as FinancialEntryRow[]).filter((entry) => {
        const date = referenceDate(entry);
        return date >= start && date <= end;
      });

      const metrics = monthEntries.reduce(
        (acc, entry) => {
          const amount = Math.abs(Number(entry.amount || 0));
          const status = String(entry.status || "").toLowerCase();
          const isPaid = paidStatuses.has(status);
          const isOpen = openStatuses.has(status) || !isPaid;

          if (entry.type === "income") {
            if (isPaid) acc.income += amount;
            if (isOpen) acc.receivable += amount;
          }

          if (entry.type === "expense") {
            if (isPaid) acc.expense += amount;
            if (isOpen) acc.payable += amount;
          }

          return acc;
        },
        { income: 0, expense: 0, receivable: 0, payable: 0 },
      );

      return {
        ...metrics,
        result: metrics.income - metrics.expense,
      };
    },
  });
}
