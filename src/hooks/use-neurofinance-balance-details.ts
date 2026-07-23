import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import type { Transaction } from "@/types";
import type { AccountMovement } from "@/lib/neurofinance-types";
import {
    filterBalanceDetailsByView,
    mapAccountMovementToTransaction,
    neuroFinanceOverviewItemsQueryKey,
    parseAccountMovementRows,
    type NeuroFinanceBalanceDetailView,
} from "@/lib/neurofinance-statement-data";

export type BalanceDetailView = NeuroFinanceBalanceDetailView;

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

export async function fetchNeuroFinanceOverviewItems() {
    const items: AccountMovement[] = [];

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
            .rpc("get_neurofinance_overview_items", {
                p_end_at: null,
                p_limit: PAGE_SIZE,
                p_offset: from,
                p_start_at: null,
            });

        if (error) throw error;
        const pageItems = parseAccountMovementRows(data || []);
        items.push(...pageItems);
        if (pageItems.length < PAGE_SIZE) break;
    }

    return items;
}

export const useNeuroFinanceBalanceDetails = (view: BalanceDetailView, enabled = true) => {
    const { user } = useAuth();

    return useQuery<AccountMovement[], Error, Transaction[]>({
        queryKey: neuroFinanceOverviewItemsQueryKey(user?.id),
        queryFn: async () => {
            if (!user?.id) return [];
            return fetchNeuroFinanceOverviewItems();
        },
        select: (items) => filterBalanceDetailsByView(items, view)
            .map((item) => mapAccountMovementToTransaction(item, user?.id || "")),
        enabled: Boolean(user?.id) && enabled,
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });
};
