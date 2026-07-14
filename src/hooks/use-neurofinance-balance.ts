import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { FinancialOverviewSnapshot } from "@/lib/neurofinance-types";

export interface NeuroFinanceBalance {
    balance: number;
    pending: number;
    reserved: number;
    totalReceived: number;
    feesTotal: number;
    netVolume: number;
    paidOut: number;
    isStale: boolean;
    lastUpdatedAt: string | null;
    lastSyncError: string | null;
    reconciliationDifference: number;
    raw: {
        available_balance: number;
        pending_balance: number;
        reserved_balance: number;
        gross_volume: number;
        fees_total: number;
        net_volume: number;
        paid_out_balance: number;
    };
}

const EMPTY_BALANCE: NeuroFinanceBalance = {
    balance: 0,
    pending: 0,
    reserved: 0,
    totalReceived: 0,
    feesTotal: 0,
    netVolume: 0,
    paidOut: 0,
    isStale: true,
    lastUpdatedAt: null,
    lastSyncError: null,
    reconciliationDifference: 0,
    raw: {
        available_balance: 0,
        pending_balance: 0,
        reserved_balance: 0,
        gross_volume: 0,
        fees_total: 0,
        net_volume: 0,
        paid_out_balance: 0,
    },
};

function mapSnapshot(snapshot: FinancialOverviewSnapshot | null): NeuroFinanceBalance {
    if (!snapshot) return EMPTY_BALANCE;

    return {
        balance: Number(snapshot.available_balance || 0) / 100,
        pending: Number(snapshot.pending_receivables || 0) / 100,
        reserved: 0,
        totalReceived: Number(snapshot.gross_received || 0) / 100,
        feesTotal: Number(snapshot.fees_total || 0) / 100,
        netVolume: Number(snapshot.calculated_available_balance || 0) / 100,
        paidOut: Number(snapshot.total_outflow || 0) / 100,
        isStale: Boolean(snapshot.is_stale),
        lastUpdatedAt: snapshot.provider_as_of || snapshot.updated_at || null,
        lastSyncError: snapshot.last_sync_error || null,
        reconciliationDifference: Number(snapshot.reconciliation_difference || 0) / 100,
        raw: {
            available_balance: Number(snapshot.available_balance || 0),
            pending_balance: Number(snapshot.pending_receivables || 0),
            reserved_balance: 0,
            gross_volume: Number(snapshot.gross_received || 0),
            fees_total: Number(snapshot.fees_total || 0),
            net_volume: Number(snapshot.calculated_available_balance || 0),
            paid_out_balance: Number(snapshot.total_outflow || 0),
        },
    };
}

export const useNeuroFinanceBalanceSnapshot = (enabled=true) => {
    const { user } = useAuth();
    const queryKey = ["neurofinance-overview", user?.id];

    return useQuery<NeuroFinanceBalance, Error>({
        queryKey,
        queryFn: async () => {
            if (!user?.id) return EMPTY_BALANCE;

            const { data, error } = await supabase
                .from("neurofinance_overview_snapshot_v")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            if (error) throw error;
            return mapSnapshot(data as FinancialOverviewSnapshot | null);
        },
        enabled: Boolean(user?.id)&&enabled,
        staleTime: 1000 * 60 * 10,
        placeholderData: EMPTY_BALANCE,
    });
};

export const useNeuroFinanceBalance = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = useMemo(() => ["neurofinance-overview", user?.id] as const, [user?.id]);
    const query = useNeuroFinanceBalanceSnapshot();

    const sync = useMutation<unknown, Error, boolean>({
        mutationFn: async (force = false) => {
            const { data, error } = await supabase.functions.invoke("asaas-financial-sync", {
                body: { mode: "incremental", force },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ["neurofinance-overview-items"] });
            queryClient.invalidateQueries({ queryKey: ["neurofinance-statement"] });
        },
    });
    const {
        mutate: triggerSync,
        mutateAsync: syncNow,
        isPending: isSyncing,
        error: syncError,
    } = sync;

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`neurofinance-overview-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "neurofinance_overview_snapshots",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey });
                    queryClient.invalidateQueries({ queryKey: ["neurofinance-overview-items"] });
                    queryClient.invalidateQueries({ queryKey: ["neurofinance-statement"] });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, queryKey, user?.id]);

    useEffect(() => {
        if (!user?.id || isSyncing || !query.data) return;
        const updatedAt = query.data.lastUpdatedAt
            ? new Date(query.data.lastUpdatedAt).getTime()
            : 0;
        const shouldRefresh =
            !updatedAt ||
            query.data.isStale ||
            Date.now() - updatedAt > 10 * 60 * 1000;

        if (shouldRefresh) triggerSync(false);
    }, [isSyncing, query.data, triggerSync, user?.id]);

    return {
        ...query,
        data: query.data || EMPTY_BALANCE,
        syncNow: () => syncNow(false),
        isSyncing,
        syncError,
    };
};
