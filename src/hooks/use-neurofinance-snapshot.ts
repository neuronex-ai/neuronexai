"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";

export function useNeurofinanceSnapshot() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["neurofinance-snapshot", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("neurofinance_overview_snapshot_v")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}
